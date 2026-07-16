import Papa from 'papaparse';

export interface ReconciliationResult {
    unmatchedCsvItems: any[]; // In CSV, but not in Appwrite
    missingAppwriteItems: any[]; // In Appwrite, but not in CSV
    matchedItems: any[]; // Matches found
    soldItemsToUpdate: any[]; // Found in Appwrite as not sold, but CSV says Sold
    placedItemsToUpdate: any[]; // Found in CSV as In Stock, but Appwrite says received
}

// Helper to extract clean words for fuzzy matching
function getKeywords(str: string): Set<string> {
    if (!str) return new Set();
    const clean = str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const words = clean.split(/\s+/).filter(w => w.length > 2); // Ignore short words like "of", "a"
    return new Set(words);
}

// Helper to calculate overlap percentage
function calculateOverlap(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) return 0;
    let overlap = 0;
    for (const word of setA) {
        if (setB.has(word)) overlap++;
    }
    return overlap / Math.min(setA.size, setB.size); // Subset matching
}

export function reconcileBoothInventory(csvText: string, appwriteItems: any[]): Promise<ReconciliationResult> {
    return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const csvItems = results.data as any[];
                const result: ReconciliationResult = {
                    unmatchedCsvItems: [],
                    missingAppwriteItems: [],
                    matchedItems: [],
                    soldItemsToUpdate: [],
                    placedItemsToUpdate: []
                };

                // Track which appwrite items haven't been matched yet
                let unmatchedAppwrite = [...appwriteItems];

                csvItems.forEach(csvRow => {
                    const csvName = (csvRow['Name'] || csvRow['Item Name'] || csvRow['Item'] || csvRow['Title'] || '').trim();
                    const csvStatusRaw = (csvRow['Status'] || csvRow['Inventory'] || csvRow['State'] || '').trim().toLowerCase();
                    const qtyStr = csvRow['Quantity'] || csvRow['Qty'] || csvRow['In Stock'] || '1';
                    const parsedQty = parseInt(qtyStr, 10);
                    const qty = isNaN(parsedQty) ? 1 : parsedQty;
                    
                    if (!csvName) return; // skip empty rows

                    const matchedForThisRow = [];

                    // Attempt to find up to 'matchCount' matches for this single CSV row
                    // Even if qty is 0 (e.g. out of stock), we still need to match the item at least once to update its status!
                    const matchCount = Math.max(1, qty);

                    for (let q = 0; q < matchCount; q++) {
                        // 1. Primary Match: Exact Title (Case Insensitive)
                        let matchIndex = unmatchedAppwrite.findIndex(item => 
                            item.title?.toLowerCase().trim() === csvName.toLowerCase()
                        );

                        // 2. Smart Sync Fallback: Fuzzy Word Overlap
                        // Reduced threshold to 50% for broader bundle matching (e.g. "Shadowrun 4e/5e")
                        if (matchIndex === -1) {
                            const csvKeywords = getKeywords(csvName);
                            let bestMatchIdx = -1;
                            let bestOverlap = 0;

                            unmatchedAppwrite.forEach((item, idx) => {
                                const itemKeywords = getKeywords(item.title || '');
                                const overlap = calculateOverlap(csvKeywords, itemKeywords);
                                if (overlap > bestOverlap) {
                                    bestOverlap = overlap;
                                    bestMatchIdx = idx;
                                }
                            });

                            if (bestOverlap >= 0.50 && bestMatchIdx > -1) {
                                matchIndex = bestMatchIdx;
                            }
                        }

                        if (matchIndex > -1) {
                            const matchedItem = unmatchedAppwrite[matchIndex];
                            const qty = Number(matchedItem.quantity || 1);
                            
                            if (qty > 1) {
                                const clonedItem = { ...matchedItem };
                                const unitCost = Number(matchedItem.cost || 0) / qty;
                                
                                // Decrement quantity and cost basis in memory for the unmatched pool
                                matchedItem.quantity = qty - 1;
                                matchedItem.cost = Math.max(0, Number(matchedItem.cost || 0) - unitCost);
                                
                                matchedForThisRow.push({
                                    ...clonedItem,
                                    isQuantitySplit: true,
                                    unitCost
                                });
                            } else {
                                matchedForThisRow.push(matchedItem);
                                unmatchedAppwrite.splice(matchIndex, 1); // remove from pool
                            }
                        } else {
                            // If we can't find another match, stop trying to fill the quantity
                            break;
                        }
                    }

                    if (matchedForThisRow.length > 0) {
                        matchedForThisRow.forEach(matchedItem => {
                            result.matchedItems.push({ csv: csvRow, appwrite: matchedItem });
                            
                            // Status reconciliation
                            // Consider it sold if status says 'sold', 'out of stock', quantity is 0, or if it's explicitly a Sales Report (Sale# or Sold Date exists)
                            const isSalesReportRow = csvRow['Sale#'] !== undefined || csvRow['Sold Date'] !== undefined;
                            const isSoldInCsv = isSalesReportRow || csvStatusRaw.includes('sold') || csvStatusRaw.includes('out of stock') || qty === 0;
                            
                            if (isSoldInCsv && matchedItem.status !== 'sold') {
                                
                                // Financial Math
                                const rawAmount = csvRow['Amount'] || csvRow['Agreed Price'] || csvRow['Agreed'] || '0';
                                const rawCostSplit = csvRow['Cost/Split'] || '0';
                                const rawConsignorPct = csvRow['Consignor %'] || '100'; // Default to 100% consignor split
                                
                                const soldPrice = parseFloat(rawAmount.replace(/[^0-9.]/g, '')) || 0;
                                let commissionPaid = 0;

                                // If they use "Cost/Split", it's usually the payout the consignor receives
                                if (csvRow['Cost/Split'] !== undefined) {
                                    const payout = parseFloat(rawCostSplit.replace(/[^0-9.-]/g, '')) || 0;
                                    commissionPaid = Math.max(0, soldPrice - payout);
                                } else {
                                    // Fallback to percentage
                                    const consignorPct = parseFloat(rawConsignorPct.replace(/[^0-9.]/g, '')) || 100;
                                    commissionPaid = soldPrice * ((100 - consignorPct) / 100);
                                }

                                if (matchedItem.isQuantitySplit) {
                                    result.soldItemsToUpdate.push({
                                        id: matchedItem.$id,
                                        title: csvName, // Use the specific name from the CSV!
                                        currentStatus: matchedItem.status,
                                        soldPrice,
                                        commissionPaid,
                                        isQuantitySplit: true,
                                        unitCost: matchedItem.unitCost,
                                        parentLotId: matchedItem.$id
                                    });
                                } else {
                                    result.soldItemsToUpdate.push({
                                        id: matchedItem.$id,
                                        title: matchedItem.title,
                                        currentStatus: matchedItem.status,
                                        soldPrice,
                                        commissionPaid
                                    });
                                }
                            } else if (!isSoldInCsv && matchedItem.status !== 'placed' && matchedItem.status !== 'sold') {
                                if (!matchedItem.isQuantitySplit) {
                                    // If it's in the CSV and not sold, it is physically in the booth and should be "placed"
                                    result.placedItemsToUpdate.push({
                                        id: matchedItem.$id,
                                        title: matchedItem.title,
                                        currentStatus: matchedItem.status
                                    });
                                }
                            }
                        });
                    } else {
                        // We found 0 exact matches for this row.
                        // Calculate the Top 5 best candidates for manual linking
                        const csvKeywords = getKeywords(csvName);
                        const suggestions = unmatchedAppwrite.map(item => {
                            const itemKeywords = getKeywords(item.title || '');
                            const overlap = calculateOverlap(csvKeywords, itemKeywords);
                            return { item, score: overlap };
                        }).filter(s => s.score > 0)
                          .sort((a,b) => b.score - a.score)
                          .slice(0, 5)
                          .map(s => s.item);

                        csvRow._suggestions = suggestions;
                        result.unmatchedCsvItems.push(csvRow);
                    }
                });

                // Anything left in unmatchedAppwrite that is NOT marked as "sold" is missing from the booth
                result.missingAppwriteItems = unmatchedAppwrite.filter(item => item.status !== 'sold'); 
                
                resolve(result);
            },
            error: (err) => {
                reject(err);
            }
        });
    });
}
