import { useState, useEffect, useCallback } from 'react';
import { Lot, LotInfo } from '../types';
import { fetchAllLots, subscribeLots, updateLot, deleteLot, createLot } from '../lib/supabaseLots';

/**
 * Custom hook for managing lots with Supabase real-time sync
 */
export function useSupabaseLots() {
    const [lots, setLots] = useState<Lot[]>([]);
    const [lotsData, setLotsData] = useState<Map<string, LotInfo>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    
    // Load initial data
    useEffect(() => {
        let mounted = true;
        
        async function loadData() {
            try {
                setLoading(true);
                console.log('📥 Loading lots from Supabase...');
                
                const { lots: fetchedLots, lotsData: fetchedData } = await fetchAllLots();
                
                if (mounted) {
                    setLots(fetchedLots);
                    setLotsData(fetchedData);
                    setLastSynced(new Date());
                    setError(null);
                    
                    // Cache to localStorage for offline access
                    localStorage.setItem('manualMapData_v2', JSON.stringify(fetchedLots));
                    localStorage.setItem('lotsData_v2', JSON.stringify(Object.fromEntries(fetchedData)));
                    localStorage.setItem('last_supabase_sync', new Date().toISOString());
                    
                    console.log(`✅ Loaded ${fetchedLots.length} lots from Supabase`);
                }
            } catch (err) {
                console.error('Error loading lots:', err);
                if (mounted) {
                    setError(err as Error);
                    
                    // Fallback to localStorage if Supabase fails
                    try {
                        const cachedLots = localStorage.getItem('manualMapData_v2');
                        const cachedData = localStorage.getItem('lotsData_v2');
                        
                        if (cachedLots && cachedData) {
                            const parsedLots = JSON.parse(cachedLots);
                            const parsedData = JSON.parse(cachedData);
                            
                            // Deserialize LotInfo data and convert date strings to Date objects
                            const dataMap = new Map<string, LotInfo>(
                                Object.entries(parsedData).map(([key, value]: [string, any]) => [
                                    key,
                                    {
                                        ...value,
                                        createdAt: new Date(value.createdAt),
                                        updatedAt: new Date(value.updatedAt),
                                        status: value.status || 'neutro',
                                        isAvailable: value.isAvailable || false,
                                        refCode: value.refCode || '',
                                        zona: value.zona || '',
                                        setor: value.setor || '',
                                        loteGeo: value.loteGeo || '',
                                        ownerCpf: value.ownerCpf || '',
                                        documentation: value.documentation || '',
                                        website: value.website || '',
                                        testada: value.testada,
                                        displayId: value.displayId,
                                        aliases: value.aliases || [],
                                        history: value.history ? {
                                            ...value.history,
                                            timestamp: new Date(value.history.timestamp)
                                        } : undefined
                                    } as LotInfo
                                ])
                            );
                            
                            setLots(parsedLots);
                            setLotsData(dataMap);
                            console.log('✅ Loaded from localStorage cache');
                        }
                    } catch (cacheErr) {
                        console.error('Failed to load cache:', cacheErr);
                    }
                }
            } finally {
                if (mounted) setLoading(false);
            }
        }
        
        loadData();
        
        return () => {
            mounted = false;
        };
    }, []);
    
    // Subscribe to real-time changes with automatic polling fallback
    useEffect(() => {
        if (loading) return; // Wait until initial load completes
        
        console.log('🔄 Setting up real-time subscription...');
        
        let pollingInterval: NodeJS.Timeout | null = null;
        let realtimeActive = false;
        
        // Polling fallback function
        const startPolling = () => {
            if (pollingInterval) return; // Already polling
            
            console.log('🔄 Starting polling fallback (checks every 10 seconds)...');
            
            const poll = async () => {
                try {
                    const { lots: freshLots, lotsData: freshData } = await fetchAllLots();
                    
                    // Only update if data changed
                    if (JSON.stringify(freshLots) !== JSON.stringify(lots)) {
                        console.log('🔄 Polling: Data changed, updating...');
                        setLots(freshLots);
                        setLotsData(freshData);
                        setLastSynced(new Date());
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }
            };
            
            pollingInterval = setInterval(poll, 10000); // Poll every 10 seconds
        };
        
        // Try to setup Realtime subscription
        const unsubscribe = subscribeLots(
            (payload) => {
                if (!realtimeActive) {
                    console.log('✅ Realtime activated! Stopping polling...');
                    realtimeActive = true;
                    if (pollingInterval) {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                    }
                }
                
                console.log('Real-time event:', payload.eventType, payload.new?.id);
                
                if (payload.eventType === 'INSERT') {
                    const newRow = payload.new;
                    
                    const newInfo: LotInfo = {
                        id: newRow.id,
                        quadra: newRow.quadra,
                        lote: newRow.lote,
                        notes: newRow.notes || '',
                        owner: newRow.owner || '',
                        ownerContact: newRow.owner_contact || '',
                        price: newRow.price,
                        area: newRow.area,
                        photos: newRow.photos || [],
                        documents: newRow.documents || [],
                        status: newRow.status || 'neutro',
                        isAvailable: newRow.is_available || false,
                        refCode: newRow.ref_code || '',
                        zona: newRow.zona || '',
                        setor: newRow.setor || '',
                        loteGeo: newRow.lote_geo || '',
                        ownerCpf: newRow.owner_cpf || '',
                        documentation: newRow.documentation || '',
                        website: newRow.website || '',
                        testada: newRow.testada,
                        displayId: newRow.display_id,
                        aliases: newRow.aliases || [],
                        history: newRow.history,
                        createdAt: new Date(newRow.created_at),
                        updatedAt: new Date(newRow.updated_at),
                    };
                    
                    const newLot: Lot = {
                        id: newRow.id,
                        quadra: newRow.quadra,
                        lote: newRow.lote,
                        coordinates: newRow.coordinates,
                        center: newRow.center,
                        info: newInfo,
                    };
                    
                    setLots(prev => [...prev, newLot]);
                    setLotsData(prev => new Map(prev).set(newRow.id, newInfo));
                    
                } else if (payload.eventType === 'UPDATE') {
                    const updatedRow = payload.new;
                    
                    // Update lotsData first
                    setLotsData(prev => {
                        const newMap = new Map(prev);
                        const existing = newMap.get(updatedRow.id);
                        const updatedInfo: LotInfo = {
                            ...existing,
                            id: updatedRow.id,
                            quadra: updatedRow.quadra,
                            lote: updatedRow.lote,
                            notes: updatedRow.notes || '',
                            owner: updatedRow.owner || '',
                            ownerContact: updatedRow.owner_contact || '',
                            price: updatedRow.price,
                            area: updatedRow.area,
                            photos: updatedRow.photos || [],
                            documents: updatedRow.documents || [],
                            status: updatedRow.status || 'neutro',
                            isAvailable: updatedRow.is_available || false,
                            refCode: updatedRow.ref_code || '',
                            zona: updatedRow.zona || '',
                            setor: updatedRow.setor || '',
                            loteGeo: updatedRow.lote_geo || '',
                            ownerCpf: updatedRow.owner_cpf || '',
                            documentation: updatedRow.documentation || '',
                            website: updatedRow.website || '',
                            testada: updatedRow.testada,
                            displayId: updatedRow.display_id,
                            aliases: updatedRow.aliases || [],
                            history: updatedRow.history,
                            createdAt: existing?.createdAt || new Date(updatedRow.created_at),
                            updatedAt: new Date(updatedRow.updated_at),
                        };
                        newMap.set(updatedRow.id, updatedInfo);
                        return newMap;
                    });
                    
                    // Update lots with the updated info
                    setLots(prev => prev.map(lot =>
                        lot.id === updatedRow.id
                            ? {
                                ...lot,
                                quadra: updatedRow.quadra,
                                lote: updatedRow.lote,
                                coordinates: updatedRow.coordinates,
                                center: updatedRow.center,
                                info: {
                                    ...lot.info,
                                    quadra: updatedRow.quadra,
                                    lote: updatedRow.lote,
                                    notes: updatedRow.notes || '',
                                    owner: updatedRow.owner || '',
                                    ownerContact: updatedRow.owner_contact || '',
                                    price: updatedRow.price,
                                    area: updatedRow.area,
                                    photos: updatedRow.photos || [],
                                    documents: updatedRow.documents || [],
                                    status: updatedRow.status || 'neutro',
                                    isAvailable: updatedRow.is_available || false,
                                    zona: updatedRow.zona || '',
                                    setor: updatedRow.setor || '',
                                    loteGeo: updatedRow.lote_geo || '',
                                    ownerCpf: updatedRow.owner_cpf || '',
                                    documentation: updatedRow.documentation || '',
                                    website: updatedRow.website || '',
                                    testada: updatedRow.testada,
                                    displayId: updatedRow.display_id,
                                    aliases: updatedRow.aliases || [],
                                    history: updatedRow.history,
                                    updatedAt: new Date(updatedRow.updated_at),
                                },
                            }
                            : lot
                    ));
                    
                } else if (payload.eventType === 'DELETE') {
                    const deletedId = payload.old.id;
                    
                    setLots(prev => prev.filter(lot => lot.id !== deletedId));
                    setLotsData(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(deletedId);
                        return newMap;
                    });
                }
                
                setLastSynced(new Date());
            },
            (err) => {
                console.error('Real-time subscription error:', err);
                console.warn('⚠️ Realtime sync failed. Switching to polling mode (updates every 10s).');
                console.warn('📖 To enable Realtime, see: ENABLE_REALTIME.md');
                
                // Start polling as fallback
                startPolling();
            },
            (status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime connected successfully!');
                    realtimeActive = true;
                    if (pollingInterval) {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                    }
                }
            }
        );
        
        // Give Realtime 3 seconds to connect, otherwise start polling
        const fallbackTimer = setTimeout(() => {
            if (!realtimeActive) {
                console.warn('⚠️ Realtime did not activate in 3 seconds. Starting polling fallback...');
                startPolling();
            }
        }, 3000);
        
        return () => {
            clearTimeout(fallbackTimer);
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
            console.log('🔌 Unsubscribing from real-time changes');
            unsubscribe();
        };
    }, [loading]);
    
    // Update lot
    const handleUpdateLot = useCallback(async (id: string, lot: Partial<Lot>, lotInfo?: Partial<LotInfo>) => {
        try {
            await updateLot(id, lot, lotInfo);
            // Real-time subscription will handle the update
        } catch (err) {
            console.error('Error updating lot:', err);
            throw err;
        }
    }, []);
    
    // Delete lot
    const handleDeleteLot = useCallback(async (id: string) => {
        try {
            await deleteLot(id);
            // Real-time subscription will handle the deletion
        } catch (err) {
            console.error('Error deleting lot:', err);
            throw err;
        }
    }, []);
    
    // Create lot
    const handleCreateLot = useCallback(async (lot: Lot, lotInfo: LotInfo) => {
        try {
            await createLot(lot, lotInfo);
            // Real-time subscription will handle the insertion
        } catch (err) {
            console.error('Error creating lot:', err);
            throw err;
        }
    }, []);
    
    return {
        lots,
        lotsData,
        loading,
        error,
        lastSynced,
        updateLot: handleUpdateLot,
        deleteLot: handleDeleteLot,
        createLot: handleCreateLot,
        setLots, // For batch operations
        setLotsData, // For batch operations
    };
}
