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

/**
 * Normalizes single-unit cost vs total batch cost basis for multi-quantity items
 * using the same ROI heuristic as ItemCard.vue.
 * Example: HUCK-1309 (qty: 10, rawCost: 4.14, unitResale: 15.00) -> totalCost: 41.40, unitCost: 4.14
 */
export const resolveMultiQtyCost = (rawCostVal, quantityVal, unitResaleVal = 0) => {
    const rawCost = parseFloat(String(rawCostVal ?? 0).replace(/[$,]/g, ''));
    const qty = Math.max(1, Number(quantityVal) || 1);
    const unitResale = parseFloat(String(unitResaleVal ?? 0).replace(/[$,]/g, '')) || 0;

    if (isNaN(rawCost) || rawCost <= 0) {
        return { totalCost: 0, unitCost: 0, isDetectedUnitCost: false };
    }
    if (qty <= 1) {
        return { totalCost: rawCost, unitCost: rawCost, isDetectedUnitCost: false };
    }

    const totalEst = unitResale * qty;
    let isUnit = false;
    if (totalEst > 0) {
        const singleRoi = ((totalEst - rawCost) / rawCost) * 100;
        const batchCost = rawCost * qty;
        const batchRoi = ((totalEst - batchCost) / batchCost) * 100;
        // Matches ItemCard.vue: if single unit cost produces >2000% ROI while batch cost is standard retail ROI (<1500%)
        if (singleRoi > 2000 && batchRoi > -50 && batchRoi < 1500) {
            isUnit = true;
        }
    }

    const totalCost = isUnit ? Number((Number(rawCost * qty) || 0).toFixed(2)) : rawCost;
    const unitCost = Number((Number(totalCost / qty) || 0).toFixed(2));
    return { totalCost: Number(totalCost ?? 0), unitCost: Number(unitCost ?? 0), isDetectedUnitCost: isUnit };
};

export function useItemDrawerForm() {
    const isAcquisitionUnlocked = ref(false);

    const editForm = reactive({
        title: '',
        tagTitle: '',
        quantity: 1,
        cost: '',
        resalePrice: '',
        soldPrice: '',
        estLow: '',
        estHigh: '',
        storageLocation: 'HG',
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
        countryOfOrigin: '',
        redFlags: []
    });

    // Auto-calculate ROI / Margin % (Calculated per-unit so multi-quantity batches reflect accurate margins)
    const calculatedMargin = computed(() => {
        const qty = Math.max(1, Number(editForm.quantity) || 1);
        const price = parseFloat(editForm.resalePrice || editForm.soldPrice || 0);
        const { unitCost } = resolveMultiQtyCost(editForm.cost, qty, price);
        if (price > 0 && unitCost >= 0) {
            return Math.round(((price - unitCost) / price) * 100);
        }
        return null;
    });

    // Auto-fill sold price when flipping status to 'sold'
    watch(() => editForm.status, (newStatus) => {
        if (newStatus === 'sold' && (!editForm.soldPrice || editForm.soldPrice === '') && editForm.resalePrice) {
            const rp = parseFloat(editForm.resalePrice);
            if (!isNaN(rp) && rp > 0) {
                editForm.soldPrice = Number((rp * 0.85) || 0).toFixed(2);
                addToast({ type: 'info', message: 'Auto-filled Sold Price based on default payout.' });
            }
        }
    });

    const formatMoney = (val) => {
        if (val === undefined || val === null || val === '') return '';
        const num = parseFloat(val);
        return isNaN(num) ? '' : Number(num ?? 0).toFixed(2);
    };

    const resetForm = () => {
        editForm.title = '';
        editForm.tagTitle = '';
        editForm.quantity = 1;
        editForm.cost = '';
        editForm.resalePrice = '';
        editForm.soldPrice = '';
        editForm.estLow = '';
        editForm.estHigh = '';
        editForm.storageLocation = 'HG';
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
        editForm.redFlags = [];
        isAcquisitionUnlocked.value = true;
    };

    const initForm = (item) => {
        isAcquisitionUnlocked.value = !item;

        if (item) {
            editForm.title = item.title || '';
            
            // Extract Tag Title (<= 38 chars for thermal barcode sticker label)
            let initialTag = item.tagTitle || item.tag_title || '';
            if (!initialTag && item.conditionNotes && typeof item.conditionNotes === 'string') {
                const tagMatch = item.conditionNotes.match(/\[TAG_TITLE:[ \t]*([^\]]+)\]/i);
                if (tagMatch && tagMatch[1]?.trim()) initialTag = tagMatch[1].trim();
            }
            if (!initialTag && item.rawAnalysis) {
                try {
                    const parsed = typeof item.rawAnalysis === 'string' ? JSON.parse(item.rawAnalysis) : item.rawAnalysis;
                    const obj = Array.isArray(parsed) ? parsed[0] : parsed;
                    if (obj?.tag_title || obj?.tagTitle) initialTag = obj.tag_title || obj.tagTitle;
                } catch (e) {}
            }
            editForm.tagTitle = initialTag || '';

            editForm.quantity = item.quantity || 1;
            const rawCost = item.cost ?? item.purchasePrice ?? getNoteValue(item.conditionNotes, 'Paid', true);
            const rawResale = item.resalePrice || item.priceFair || item.listPrice || getNoteValue(item.conditionNotes, 'Resale', true);
            const rawEstHigh = item.estHigh || getNoteValue(item.conditionNotes, 'Est. High', true);
            const { totalCost } = resolveMultiQtyCost(rawCost, editForm.quantity, rawResale || rawEstHigh);
            editForm.cost = rawCost !== null && rawCost !== undefined && rawCost !== '' ? formatMoney(totalCost) : '';
            editForm.resalePrice = formatMoney(rawResale);
            editForm.soldPrice = formatMoney(item.soldPrice);
            editForm.estLow = formatMoney(item.estLow || getNoteValue(item.conditionNotes, 'Est. Low', true));
            editForm.estHigh = formatMoney(item.estHigh || getNoteValue(item.conditionNotes, 'Est. High', true));
            const rawItemLoc = String(item.storageLocation || '').trim();
            editForm.storageLocation = (!rawItemLoc || rawItemLoc.toLowerCase() === 'backstock') ? 'HG' : rawItemLoc;
            editForm.sourcingLocation = item.sourcingLocation || getNoteValue(item.conditionNotes, 'Location') || '';
            editForm.orderId = item.orderId || getNoteValue(item.conditionNotes, 'Order #') || getNoteValue(item.conditionNotes, 'Imported from Order #') || '';
            editForm.status = item.status || 'acquired';
            editForm.parentLotId = item.parentLotId || null;
            editForm.redFlags = Array.isArray(item.redFlags) ? [...item.redFlags] : [];

            let desc = item.marketDescription || item.description || '';
            if (desc && typeof desc === 'string') {
                if (
                    desc.trim().startsWith('{') && desc.includes('"identity"') ||
                    desc.includes('Speed Scout Appraisal Report') ||
                    desc.includes('Sourcing Catalyst (Why Pay Up)')
                ) {
                    desc = '';
                }
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
