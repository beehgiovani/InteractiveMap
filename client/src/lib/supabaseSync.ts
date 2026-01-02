import { supabase } from '../supabase';
import { Lot, LotInfo } from '../types';

/**
 * Syncs a batch of lots to Supabase 'lots' table.
 * Uses upsert (insert or update).
 */
export const syncLotsToSupabase = async (lots: Lot[], lotsData: Map<string, LotInfo>, onProgress?: (count: number) => void) => {
    const BATCH_SIZE = 100;
    let processed = 0;

    // chunk array
    for (let i = 0; i < lots.length; i += BATCH_SIZE) {
        const chunk = lots.slice(i, i + BATCH_SIZE);
        
        const rows = chunk.map(lot => {
            const info = lotsData.get(lot.id) || lot.info || {};
            
            // Prepare coordinates as JSON
            // We store them exactly as is, Supabase handles JSONB
            // But we should normalize to avoid array-of-arrays vs objects ambiguity if we want SQL querying later.
            // For now, mirroring Firestore structure is safest for frontend compatibility.
            // But let's stick to the current [number, number][] format if possible.
            
            return {
                id: lot.id,
                quadra: lot.quadra,
                lote: lot.lote,
                created_at: info.createdAt ? new Date(info.createdAt).toISOString() : new Date().toISOString(),
                updated_at: new Date().toISOString(),
                
                // Info
                area: typeof info.area === 'number' ? info.area : null,
                price: typeof info.price === 'number' ? info.price : null,
                owner: info.owner || null,
                owner_contact: info.ownerContact || null,
                notes: info.notes || null,
                
                // JSONB fields
                coordinates: lot.coordinates, 
                center: lot.center,
                photos: info.photos || [],
                documents: info.documents || [],
            };
        });

        const { error } = await supabase
            .from('lots')
            .upsert(rows, { onConflict: 'id' });

        if (error) {
            console.error('Error syncing batch to Supabase:', error);
            throw error;
        }

        processed += chunk.length;
        if (onProgress) onProgress(processed);
    }
};

/**
 * Uploads a file to Supabase Storage 'lot-attachments' bucket.
 * Returns the public URL.
 */
export const uploadToSupabaseStorage = async (file: File, path: string): Promise<string> => {
    const { data, error } = await supabase.storage
        .from('lot-attachments')
        .upload(path, file, {
            cacheControl: '3600',
            upsert: true
        });

    if (error) {
        throw error;
    }

    const { data: publicData } = supabase.storage
        .from('lot-attachments')
        .getPublicUrl(data.path);

    return publicData.publicUrl;
};
