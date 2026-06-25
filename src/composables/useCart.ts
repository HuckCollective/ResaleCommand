import { ref, computed } from 'vue';
import { client, databases, storage, ID, Query } from '../lib/appwrite';
import { Permission, Role, type Models } from 'appwrite';
import { useAuth } from './useAuth';

export interface CartExpense extends Models.Document {
    amount: number;
    note: string;
    receiptImageId: string | null;
    date: string;
    cartId: string;
    tenantId: string;
}

export interface Cart extends Models.Document {
    source: string;
    tenantId: string;
    buyerId: string;
    date: string;
    status: string;
    itemCount: number;
    totalCost?: number;
    completedAt?: string;
}

export interface CartItem extends Models.Document {
    title: string;
    identity: string;
    cost: number;
    resalePrice: number;
    condition?: string;
    galleryImageIds: string[];
    imageId: string | null;
    rawAnalysis?: string;
    conditionNotes?: string;
    url?: string;
    status?: string;
}

// -- Shared State --
const activeCart = ref<Cart | null>(null);
const cartItems = ref<CartItem[]>([]);
const cartExpenses = ref<CartExpense[]>([]); // NEW: Expenses list
const loading = ref(false);
const error = ref<string | null>(null);

// Config
import { isAlphaMode } from '../stores/env';

const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID;
const CARTS_COL = 'carts'; 
const getCollectionId = () => isAlphaMode.get() 
    ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
    : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');
const EXPENSES_COL = 'expenses'; // New collection for line-item costs
const BUCKET_ID = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID; // 'item_images' (or use a 'receipts' bucket if preferred)

let unsubscribe: (() => void) | null = null;

export function useCart() {
    const { user } = useAuth();

    const cartTotalItems = computed(() => cartItems.value.length);
    
    // Sum of all recorded expenses
    const cartTotalCost = computed(() => {
        return cartExpenses.value.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    });

    const hasActiveCart = computed(() => !!activeCart.value);

    // -- Actions --

    const startCart = async (source: string, teamId: string, userId: string) => {
        console.log('[useCart] startCart called with:', { source, teamId, userId });
        loading.value = true;
        try {
            let permissions: string[] = [];
            if (teamId) {
                const role = Role.team(teamId);
                permissions = [
                    Permission.read(role),
                    Permission.update(role),
                    Permission.delete(role),
                ];
            }

            const cart = await databases.createDocument(
                DB_ID,
                CARTS_COL,
                ID.unique(),
                {
                    source,
                    tenantId: teamId,
                    buyerId: userId,
                    date: new Date().toISOString(),
                    status: 'active',
                    itemCount: 0
                },
                permissions
            );
            console.log('[useCart] startCart success, new cart:', cart);
            setActiveCart(cart as unknown as Cart);
        } catch (e: any) {
            console.error('[useCart] Failed to start cart:', e);
            error.value = e.message;
            throw e; // Propagate error to caller
        } finally {
            loading.value = false;
        }
    };

    const setActiveCart = (cart: Cart) => {
        console.log('[useCart] setActiveCart called with:', cart);
        activeCart.value = cart;
        cartItems.value = []; 
        cartExpenses.value = []; // Reset
        
        if (unsubscribe) unsubscribe();

        unsubscribe = client.subscribe(
            `databases.${DB_ID}.collections.${CARTS_COL}.documents.${cart.$id}`,
            (response) => {
                if (response.events.includes('databases.*.documents.*.update')) {
                    console.log('[useCart] Cart updated via subscription:', response.payload);
                    activeCart.value = response.payload as unknown as Cart;
                }
            }
        );

        fetchCartItems(cart.$id);
        fetchExpenses(cart.$id); // Load expenses too
    };

    const fetchCartItems = async (cartId: string) => {
        console.log('[useCart] fetchCartItems called for cartId:', cartId);
        try {
            // Attempt an indexed query first
            try {
                const result = await databases.listDocuments(
                    DB_ID,
                    getCollectionId(),
                    [Query.equal('cartId', cartId)]
                );
                cartItems.value = result.documents as unknown as CartItem[];
                console.log('[useCart] fetchCartItems result (indexed):', result.documents);
            } catch (queryErr) {
                console.warn('[useCart] cartId index query failed, falling back to local filter:', queryErr);
                // Fallback: Fetch recent items and string match
                const fallbackResult = await databases.listDocuments(DB_ID, getCollectionId(), [
                    Query.orderDesc('$createdAt'),
                    Query.limit(100) // Large enough to cover a typical trip count
                ]);
                const filtered = fallbackResult.documents.filter(doc => doc.cartId === cartId);
                cartItems.value = filtered as unknown as CartItem[];
                console.log('[useCart] fetchCartItems result (fallback):', filtered);
            }
        } catch (e) {
            console.error('[useCart] Failed to fetch cart items completely', e);
        }
    };

    // NEW: Fetch Expenses
    const fetchExpenses = async (cartId: string) => {
        console.log('[useCart] fetchExpenses called for cartId:', cartId);
        try {
            try {
                const result = await databases.listDocuments(
                    DB_ID,
                    EXPENSES_COL,
                    [Query.equal('cartId', cartId)]
                );
                cartExpenses.value = result.documents as unknown as CartExpense[];
                console.log('[useCart] fetchExpenses result (indexed):', result.documents);
            } catch (queryErr) {
                console.warn('[useCart] Expenses cartId index query failed, falling back to local filter:', queryErr);
                const fallbackResult = await databases.listDocuments(DB_ID, EXPENSES_COL, [
                    Query.orderDesc('$createdAt'),
                    Query.limit(100)
                ]);
                const filtered = fallbackResult.documents.filter(doc => doc.cartId === cartId);
                cartExpenses.value = filtered as unknown as CartExpense[];
                console.log('[useCart] fetchExpenses result (fallback):', filtered);
            }
        } catch (e) {
            // Expenses collection might not exist yet, ignore silently for now
            console.warn('[useCart] Could not fetch expenses (Collection might be missing or error)');
        }
    };

    const addItemToCart = async (itemData: any) => {
        console.log('[useCart] addItemToCart called with:', itemData);
        if (!activeCart.value) {
            console.error('[useCart] No active cart found in addItemToCart');
            return;
        }
        try {
            console.log('[useCart] Creating item in database...');
            
            let permissions: string[] = [];
            if (activeCart.value.tenantId) {
                const role = Role.team(activeCart.value.tenantId);
                permissions = [
                    Permission.read(role),
                    Permission.update(role),
                    Permission.delete(role),
                ];
            } else if (user.value) {
                const role = Role.user(user.value.$id);
                permissions = [
                    Permission.read(role),
                    Permission.update(role),
                    Permission.delete(role),
                ];
            }

            const newItem = await databases.createDocument(
                DB_ID,
                getCollectionId(),
                ID.unique(),
                {
                    ...itemData,
                    cartId: activeCart.value.$id,
                    tenantId: activeCart.value.tenantId,
                },
                permissions
            );
            console.log('[useCart] Item created successfully:', newItem);
            cartItems.value.push(newItem as unknown as CartItem);
            await databases.updateDocument(DB_ID, CARTS_COL, activeCart.value.$id, {
                itemCount: cartItems.value.length
            });
            console.log('[useCart] Cart updated with new item count.');
        } catch (e: any) {
            console.error('[useCart] addItemToCart failed:', e);
            error.value = e.message;
            throw e;
        }
    };

    // NEW: Add Expense Line Item
    const addExpense = async (amount: number, note: string, receiptFile?: File) => {
        if (!activeCart.value) return;
        loading.value = true;
        try {
            let receiptImageId: string | null = null;
            if (receiptFile) {
                // Upload to Storage
                const upload = await storage.createFile(BUCKET_ID, ID.unique(), receiptFile);
                receiptImageId = upload.$id;
            }

            let permissions: string[] = [];
            if (activeCart.value.tenantId) {
                const role = Role.team(activeCart.value.tenantId);
                permissions = [
                    Permission.read(role),
                    Permission.update(role),
                    Permission.delete(role),
                ];
            }

            const expense = await databases.createDocument(
                DB_ID,
                EXPENSES_COL,
                ID.unique(),
                {
                    cartId: activeCart.value.$id,
                    tenantId: activeCart.value.tenantId,
                    amount: amount, // Float
                    note: note,
                    receiptImageId: receiptImageId,
                    date: new Date().toISOString()
                },
                permissions
            );

            cartExpenses.value.push(expense as unknown as CartExpense);

            // Update Total on Cart Object for fast access
            await databases.updateDocument(DB_ID, CARTS_COL, activeCart.value.$id, {
                totalCost: cartTotalCost.value
            });

        } catch (e: any) {
            console.error("Add Expense Failed", e);
            throw new Error(`Failed to add expense: ${e.message}`);
        } finally {
            loading.value = false;
        }
    };

    // NEW: Finish Cart
    const finishCart = async () => {
        if (!activeCart.value) return;
        loading.value = true;
        try {
            try {
                await databases.updateDocument(DB_ID, CARTS_COL, activeCart.value.$id, {
                    status: 'completed',
                    completedAt: new Date().toISOString()
                });
            } catch (innerErr: any) {
                console.warn("Cart update failed, trying fallback without completedAt:", innerErr.message);
                await databases.updateDocument(DB_ID, CARTS_COL, activeCart.value.$id, {
                    status: 'completed'
                });
            }

            // Update all items in this cart to 'received'
            const updatePromises = cartItems.value.map(item => {
                 return databases.updateDocument(
                     DB_ID,
                     getCollectionId(),
                     item.$id,
                     { status: 'received' }
                 ).catch(err => {
                     console.error(`Failed to update item ${item.$id} to received:`, err);
                 });
            });
            await Promise.allSettled(updatePromises);
            
            leaveCart();
        } catch (e: any) {
            error.value = e.message;
            throw e; // Throw error so UI can prevent navigation
        } finally {
            loading.value = false;
        }
    };
    
    // NEW: Abort Cart
    const abortCart = async () => {
        if (!activeCart.value) return;
        loading.value = true;
        try {
            await databases.updateDocument(DB_ID, CARTS_COL, activeCart.value.$id, {
                status: 'aborted'
            });
            
            // Delete all items in this cart to clean up DB
            const deletePromises = cartItems.value.map(item => {
                 return databases.deleteDocument(DB_ID, getCollectionId(), item.$id)
                 .catch(err => console.error(`Failed to delete aborted item ${item.$id}:`, err));
            });
            await Promise.allSettled(deletePromises);
            
            leaveCart();
        } catch (e: any) {
            error.value = e.message;
            throw e; 
        } finally {
            loading.value = false;
        }
    };
    
    const checkActiveCart = async (userId: string) => {
         loading.value = true;
         try {
             const result = await databases.listDocuments(
                 DB_ID,
                 CARTS_COL,
                 [
                     Query.equal('buyerId', userId),
                     Query.equal('status', 'active'),
                     Query.orderDesc('$createdAt'),
                     Query.limit(1)
                 ]
             );
             if (result.documents.length > 0) setActiveCart(result.documents[0] as unknown as Cart);
         } catch (e) {
             console.log("No active cart found");
         } finally {
             loading.value = false;
         }
    };
    
    const leaveCart = () => {
        if (unsubscribe) unsubscribe();
        unsubscribe = null;
        activeCart.value = null;
        cartItems.value = [];
        cartExpenses.value = [];
    };

    const deleteItem = async (itemId: string) => {
        if (!activeCart.value) return;
        loading.value = true;
        try {
            await databases.deleteDocument(DB_ID, getCollectionId(), itemId);
            cartItems.value = cartItems.value.filter(i => i.$id !== itemId);
            await databases.updateDocument(DB_ID, CARTS_COL, activeCart.value.$id, {
                itemCount: cartItems.value.length
            });
        } catch (e: any) {
            console.error('[useCart] Failed to delete item:', e);
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    };

    const updateItem = async (itemId: string, updates: any) => {
        loading.value = true;
        try {
            const updated = await databases.updateDocument(DB_ID, getCollectionId(), itemId, updates);
            const index = cartItems.value.findIndex(i => i.$id === itemId);
            if (index !== -1) {
                cartItems.value[index] = updated as unknown as CartItem;
            }
        } catch (e: any) {
            console.error('[useCart] Failed to update item:', e);
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    };

    return {
        activeCart,
        cartItems,
        cartExpenses,
        loading,
        error,
        cartTotalItems,
        cartTotalCost,
        hasActiveCart,
        startCart,
        addItemToCart,
        addExpense,
        finishCart,
        abortCart,
        checkActiveCart,
        leaveCart,
        deleteItem,
        updateItem
    };
}
