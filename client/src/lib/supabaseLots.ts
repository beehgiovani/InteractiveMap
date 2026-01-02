import { supabase } from '../supabase';
import { Lot, LotInfo } from '../types';

/**
 * Supabase Lots Data Layer
 * 
 * Manages all CRUD operations for lots in Supabase
 */

export interface SupabaseLot {
    id: string;
    quadra: string;
    lote: string;
    created_at: string;
    updated_at: string;
    area: number | null;
    price: number | null;
    owner: string | null;
    owner_contact: string | null;
    notes: string | null;
    coordinates: any; // JSONB
    center: any; // JSONB
    photos: string[];

    documents: string[];
    status: string; // 'disponivel' | 'vendido' | 'reservado'
    ownerCpf?: string; // Maps to owner_cpf in DB if snake_case, but let's assume raw for now or handle mapping
    owner_cpf?: string | null; // DB column name likely
    is_available?: boolean; // New column for commercial availability check
    ref_code?: string | null; // Cód Referência Imobiliária
    zona?: string | null;
    setor?: string | null;
    lote_geo?: string | null;
    documentation?: string | null;
    website?: string | null;
    testada?: number | null;
    display_id?: string | null;
    aliases?: string[]; // JSONB
    history?: any; // JSONB
}

/**
 * Fetch all lots from Supabase
 */
export async function fetchAllLots(): Promise<{ lots: Lot[], lotsData: Map<string, LotInfo> }> {
    const { data, error } = await supabase
        .from('lots')
        .select('*')
        .order('quadra', { ascending: true })
        .order('lote', { ascending: true});
    
    if (error) {
        console.error('Error fetching lots:', error);
        throw error;
    }
    
    const lots: Lot[] = [];
    const lotsData = new Map<string, LotInfo>();
    
    data?.forEach((row: SupabaseLot) => {
        const info: LotInfo = {
            id: row.id,
            quadra: row.quadra,
            lote: row.lote,
            notes: row.notes || '',
            owner: row.owner || '',
            ownerContact: row.owner_contact || '',
            price: row.price || undefined,
            area: row.area || undefined,

            zona: row.zona || "",
            setor: row.setor || "",
            loteGeo: row.lote_geo || "",
            ownerCpf: row.owner_cpf || "",
            // Map legacy statuses if necessary, or use row value if it matches.
            // Legacy: 'disponivel' -> Livre + Available?
            // Let's assume we migrate data or handle fallback.
            status: (['neutro', 'livre', 'ocupado', 'disponivel', 'vendido', 'reservado'].includes(row.status) ? row.status as 'neutro' | 'livre' | 'ocupado' | 'disponivel' | 'vendido' | 'reservado' : 'neutro'),
            isAvailable: row.is_available ?? (row.status === 'disponivel'), // Fallback for legacy data
            refCode: row.ref_code || "",
            photos: row.photos || [],
            documents: (row.documents || []).map(d => ({ name: 'Documento', url: d })),
            documentation: row.documentation || undefined,
            website: row.website || undefined,
            testada: row.testada || undefined,
            displayId: row.display_id || undefined,
            aliases: row.aliases || [],
            history: row.history || undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };

        const lot: Lot = {
            id: row.id,
            quadra: row.quadra,
            lote: row.lote,
            coordinates: row.coordinates || [],
            center: row.center || null,
            info: info,
        };
        
        lots.push(lot);
        lotsData.set(row.id, info);
    });
    
    console.log(`Loaded ${lots.length} lots from Supabase`);
    return { lots, lotsData };
}

/**
 * Create a new lot
 */
export async function createLot(lot: Lot, lotInfo: LotInfo): Promise<void> {
    const row: Partial<SupabaseLot> = {
        id: lot.id,
        quadra: lot.quadra,
        lote: lot.lote,
        coordinates: lot.coordinates,
        center: lot.center,
        area: lotInfo.area || null,
        price: lotInfo.price || null,
        owner: lotInfo.owner || null,
        owner_contact: lotInfo.ownerContact || null,
        owner_cpf: lotInfo.ownerCpf || null,
        status: lotInfo.status || 'neutro',
        is_available: lotInfo.isAvailable || false,
        ref_code: lotInfo.refCode || null,
        notes: lotInfo.notes || null,
        photos: lotInfo.photos || [],
        documents: lotInfo.documents ? lotInfo.documents.map(d => d.url) : [],

        zona: lotInfo.zona || null,
        setor: lotInfo.setor || null,
        lote_geo: lotInfo.loteGeo || null,
        documentation: lotInfo.documentation || null,
        website: lotInfo.website || null,
        testada: lotInfo.testada || null,
        display_id: lotInfo.displayId || null,
        aliases: lotInfo.aliases || [],
        history: lotInfo.history || null,
        created_at: lotInfo.createdAt?.toISOString() || new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    
    const { error } = await supabase
        .from('lots')
        .insert(row);
    
    if (error) {
        console.error('Error creating lot:', error);
        throw error;
    }
}

/**
 * Update an existing lot
 */
export async function updateLot(id: string, lot: Partial<Lot>, lotInfo?: Partial<LotInfo>): Promise<void> {
    const updates: Partial<SupabaseLot> = {
        updated_at: new Date().toISOString(),
    };
    
    // Update geometry if provided
    if (lot.coordinates) updates.coordinates = lot.coordinates;
    if (lot.center) updates.center = lot.center;
    if (lot.quadra) updates.quadra = lot.quadra;
    if (lot.lote) updates.lote = lot.lote;
    
    // Update info if provided
    if (lotInfo) {
        if (lotInfo.area !== undefined) updates.area = lotInfo.area || null;
        if (lotInfo.price !== undefined) updates.price = lotInfo.price || null;
        if (lotInfo.owner !== undefined) updates.owner = lotInfo.owner || null;
        if (lotInfo.ownerContact !== undefined) updates.owner_contact = lotInfo.ownerContact || null;
        if (lotInfo.ownerCpf !== undefined) updates.owner_cpf = lotInfo.ownerCpf || null;
        if (lotInfo.status !== undefined) updates.status = lotInfo.status || 'neutro';
        if (lotInfo.isAvailable !== undefined) updates.is_available = lotInfo.isAvailable;
        if (lotInfo.refCode !== undefined) updates.ref_code = lotInfo.refCode || null;
        if (lotInfo.notes !== undefined) updates.notes = lotInfo.notes || null;
        if (lotInfo.photos) updates.photos = lotInfo.photos;

        if (lotInfo.documents) updates.documents = lotInfo.documents.map(d => d.url);
        if (lotInfo.zona !== undefined) updates.zona = lotInfo.zona || null;
        if (lotInfo.setor !== undefined) updates.setor = lotInfo.setor || null;

        if (lotInfo.loteGeo !== undefined) updates.lote_geo = lotInfo.loteGeo || null;
        if (lotInfo.documentation !== undefined) updates.documentation = lotInfo.documentation || null;
        if (lotInfo.website !== undefined) updates.website = lotInfo.website || null;
        if (lotInfo.testada !== undefined) updates.testada = lotInfo.testada || null;
        if (lotInfo.displayId !== undefined) updates.display_id = lotInfo.displayId || null;
        if (lotInfo.aliases !== undefined) updates.aliases = lotInfo.aliases;
        if (lotInfo.history !== undefined) updates.history = lotInfo.history || null;
    }
    
    const { error } = await supabase
        .from('lots')
        .update(updates)
        .eq('id', id);
    
    if (error) {
        console.error('Error updating lot:', error);
        throw error;
    }
}

/**
 * Delete a lot
 */
export async function deleteLot(id: string): Promise<void> {
    const { error } = await supabase
        .from('lots')
        .delete()
        .eq('id', id);
    
    if (error) {
        console.error('Error deleting lot:', error);
        throw error;
    }
}

/**
 * Batch upsert lots (for migrations and bulk operations)
 */
export async function batchUpsertLots(lots: Lot[], lotsData: Map<string, LotInfo>, onProgress?: (count: number) => void): Promise<void> {
    const BATCH_SIZE = 100;
    let processed = 0;
    
    for (let i = 0; i < lots.length; i += BATCH_SIZE) {
        const chunk = lots.slice(i, i + BATCH_SIZE);
        
        const rows = chunk.map(lot => {
            const info = lotsData.get(lot.id) || lot.info || {};
            
            return {
                id: lot.id,
                quadra: lot.quadra,
                lote: lot.lote,
                created_at: info.createdAt ? new Date(info.createdAt).toISOString() : new Date().toISOString(),
                updated_at: new Date().toISOString(),
                area: typeof info.area === 'number' ? info.area : null,
                price: typeof info.price === 'number' ? info.price : null,
                owner: info.owner || null,
                owner_contact: info.ownerContact || null,
                owner_cpf: info.ownerCpf || null,
                status: info.status || 'neutro',
                is_available: info.isAvailable || false,
                ref_code: info.refCode || null,
                notes: info.notes || null,
                coordinates: lot.coordinates,
                center: lot.center,
                photos: info.photos || [],

                documents: info.documents ? info.documents.map(d => d.url) : [],
                zona: info.zona || null,
                setor: info.setor || null,

                lote_geo: info.loteGeo || null,
                documentation: info.documentation || null,
                website: info.website || null,
                testada: info.testada || null,
                display_id: info.displayId || null,
                aliases: info.aliases || [],
                history: info.history || null,
            };
        });
        
        const { error } = await supabase
            .from('lots')
            .upsert(rows, { onConflict: 'id' });
        
        if (error) {
            console.error('Error in batch upsert:', error);
            throw error;
        }
        
        processed += chunk.length;
        if (onProgress) onProgress(processed);
    }
}

/**
 * Subscribe to real-time changes
 */
export function subscribeLots(
    onChange: (payload: any) => void,
    onError?: (error: Error) => void,
    onStatus?: (status: string) => void
) {
    const channel = supabase
        .channel('lots_changes')
        .on(
            'postgres_changes',
            {
                event: '*', // INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'lots',
            },
            (payload) => {
                console.log('Real-time change detected:', payload);
                onChange(payload);
            }
        )
        .subscribe((status) => {
            if (onStatus) onStatus(status);
            
            if (status === 'SUBSCRIBED') {
                console.log('✅ Real-time subscription active');
            } else if (status === 'CHANNEL_ERROR') {
                const error = new Error('Real-time subscription failed');
                console.error(error);
                if (onError) onError(error);
            }
        });
    
    // Return unsubscribe function
    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Batch delete lots
 */
export async function batchDeleteLots(ids: string[]): Promise<void> {
    const { error } = await supabase
        .from('lots')
        .delete()
        .in('id', ids);
    
    if (error) {
        console.error('Error in batch delete:', error);
        throw error;
    }
}
