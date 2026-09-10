import { ref, reactive, computed, watch } from 'vue';
import { addToast } from '../stores/toast';

export const getNoteValue = (notes, key, isCurrency = false) => {
    if (!notes) return null;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escapedKey}:[ \\t]*([^\\n\\r]+)`, 'i');
    const match = notes.match(regex);
    if (match) {
        let val = match[1].trim();
        if (isCurrency) val = val.replace('$', '').trim();
        return val;
    }
    return null;
};

export function useItemDrawerForm() {
    const isAcquisitionUnlocked = ref(false);

    const editForm = reactive({
        title: '',
        quantity: 1,
        cost: '',
        resalePrice: '',
        soldPrice: '',
        estLow: '',
        estHigh: '',
        storageLocation: '',
        sourcingLocation: '',
        orderId: '',
        status: 'acquired',
        parentLotId: null,
        description: '',
        condition_notes: '',
        itemCondition: '',
        existingGalleryIds: [],
        sellingLocations: [],
        keywords: [],
        countryOfOrigin: ''
    });

    // Auto-calculate ROI / Margin %
    const calculatedMargin = computed(() => {
        const cost = parseFloat(editForm.cost || 0);
        const price = parseFloat(editForm.resalePrice || editForm.soldPrice || 0);
        if (price > 0 && cost >= 0) {
            return Math.round(((price - cost) / price) * 100);
        }
        return null;
    });

    // Auto-fill sold price when flipping status to 'sold'
    watch(() => editForm.status, (newStatus) => {
        if (newStatus === 'sold' && (!editForm.soldPrice || editForm.soldPrice === '') && editForm.resalePrice) {
            const rp = parseFloat(editForm.resalePrice);
            if (!isNaN(rp) && rp > 0) {
                editForm.soldPrice = (rp * 0.85).toFixed(2);
                addToast({ type: 'info', message: 'Auto-filled Sold Price based on default payout.' });
            }
        }
    });

    const formatMoney = (val) => {
        if (val === undefined || val === null || val === '') return '';
        const num = parseFloat(val);
        return isNaN(num) ? '' : num.toFixed(2);
    };

    const resetForm = () => {
        editForm.title = '';
        editForm.quantity = 1;
        editForm.cost = '';
        editForm.resalePrice = '';
        editForm.soldPrice = '';
        editForm.estLow = '';
        editForm.estHigh = '';
        editForm.storageLocation = '';
        editForm.sourcingLocation = '';
        editForm.orderId = '';
        editForm.status = 'acquired';
        editForm.parentLotId = null;
        editForm.description = '';
        editForm.condition_notes = '';
        editForm.itemCondition = '';
        editForm.existingGalleryIds = [];
        editForm.sellingLocations = [];
        editForm.keywords = [];
        editForm.countryOfOrigin = '';
        isAcquisitionUnlocked.value = true;
    };

    const initForm = (item) => {
        isAcquisitionUnlocked.value = !item;

        if (item) {
            editForm.title = item.title || '';
            editForm.quantity = item.quantity || 1;
            editForm.cost = formatMoney(item.cost || item.purchasePrice || getNoteValue(item.conditionNotes, 'Paid', true));
            editForm.resalePrice = formatMoney(item.resalePrice || item.priceFair || item.listPrice || getNoteValue(item.conditionNotes, 'Resale', true));
            editForm.soldPrice = formatMoney(item.soldPrice);
            editForm.estLow = formatMoney(item.estLow || getNoteValue(item.conditionNotes, 'Est. Low', true));
            editForm.estHigh = formatMoney(item.estHigh || getNoteValue(item.conditionNotes, 'Est. High', true));
            editForm.storageLocation = item.storageLocation || '';
            editForm.sourcingLocation = item.sourcingLocation || getNoteValue(item.conditionNotes, 'Location') || '';
            editForm.orderId = item.orderId || getNoteValue(item.conditionNotes, 'Order #') || getNoteValue(item.conditionNotes, 'Imported from Order #') || '';
            editForm.status = item.status || 'acquired';
            editForm.parentLotId = item.parentLotId || null;

            let desc = item.marketDescription || item.description || '';
            if (desc && typeof desc === 'string' && desc.trim().startsWith('{') && desc.includes('"identity"')) {
                desc = '';
            }
            editForm.description = desc;

            const rawNotes = item.conditionNotes || item.condition_notes || '';
            editForm.condition_notes = rawNotes
                .replace(/\[[A-Z0-9_ ]+:[^\]]+\]/gi, '')
                .replace(/--- IMPORT DETAILS ---[\s\S]*/gi, '')
                .trim();

            editForm.itemCondition = getNoteValue(item.conditionNotes, 'Condition') || '';
            editForm.existingGalleryIds = Array.isArray(item.galleryImageIds) ? [...item.galleryImageIds] : [];
            editForm.sellingLocations = Array.isArray(item.sellingLocations) ? [...item.sellingLocations] : [];
            editForm.keywords = Array.isArray(item.keywords) ? [...item.keywords] : [];
            editForm.countryOfOrigin = item.countryOfOrigin || '';
        } else {
            resetForm();
        }
    };

    return {
        editForm,
        calculatedMargin,
        isAcquisitionUnlocked,
        initForm,
        resetForm,
        formatMoney,
        getNoteValue
    };
}
