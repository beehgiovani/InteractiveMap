import { db } from "../firebase";
import { collection, writeBatch, doc, getDoc, setDoc } from "firebase/firestore";
import { Lot, LotInfo } from "../../../shared/types";

// Helper to batch writes (Firestore has a limit of 500 writes per batch)
export const syncLotsToFirestore = async (lots: Lot[], lotsData: Map<string, LotInfo>, onlyIds?: string[], deletedIds?: string[]) => {
    const batchSize = 450; 
    const lotsCollection = collection(db, "lots_v2");
    const metadataCollection = collection(db, "metadata_v2");
    
    let batch = writeBatch(db);
    let count = 0;
    let totalBatches = 0;

    // 1. Process Deletions First
    if (deletedIds && deletedIds.length > 0) {
        console.log(`Processing ${deletedIds.length} deletions...`);
        for (const id of deletedIds) {
            const lotRef = doc(lotsCollection, id);
            batch.delete(lotRef);
            count++;
            if (count >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }
    }

    const lotsToSync = onlyIds 
        ? lots.filter(l => onlyIds.includes(l.id))
        : lots;

    console.log(`Starting sync of ${lotsToSync.length} lots...`);

    // 2. Sync Geometry (Lots)
    for (const lot of lotsToSync) {
        if (!lot.id) continue;
        
        const lotRef = doc(lotsCollection, lot.id);
        
        // Merge geometry with detailed info if available
        const info = lotsData.get(lot.id) || lot.info || {};
        
        // Firestore doesn't support nested arrays (Array<Array<number>>).
        // Convert [[x,y], [x,y]] to [{x,y}, {x,y}]
        const firestoreCoordinates = lot.coordinates.map((p: any) => {
            if (Array.isArray(p)) return { x: p[0], y: p[1] };
            return { x: p.x, y: p.y };
        });
        
        let firestoreCenter = null;
        if (lot.center) {
            const c: any = lot.center;
            if (Array.isArray(c)) {
                firestoreCenter = { x: c[0], y: c[1] };
            } else {
                firestoreCenter = { x: c.x, y: c.y };
            }
        }

        // Explicitly construct object to avoid "Spread" including nested arrays from legacy data
        const dataToSave = {
            id: lot.id,
            quadra: lot.quadra,
            lote: lot.lote,
            
            // Info fields
            notes: info.notes || "",
            owner: info.owner || "",
            ownerContact: info.ownerContact || "",
            price: info.price || null,
            area: info.area || null,
            photos: info.photos || [],
            documents: info.documents || [],
            website: info.website || "",
            testada: info.testada || null,
            zona: info.zona || "",
            setor: info.setor || "",
            loteGeo: info.loteGeo || "",
            ownerCpf: info.ownerCpf || "",
            status: info.status || "neutro",
            isAvailable: info.isAvailable || false,
            aliases: info.aliases || [],
            displayId: info.displayId || "",
            history: info.history || null,

            createdAt: info.createdAt ? new Date(info.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: new Date().toISOString(),

            // Geometry
            coordinates: firestoreCoordinates,
            center: firestoreCenter,
            
            lastSynced: new Date().toISOString()
        };

        batch.set(lotRef, dataToSave, { merge: true });
        count++;

        if (count >= batchSize) {
            await batch.commit();
            console.log(`Batch ${++totalBatches} committed.`);
            batch = writeBatch(db);
            count = 0;
        }
    }

    // Commit remaining
    if (count > 0) {
        await batch.commit();
        console.log(`Final batch committed.`);
    }

    // 3. Sync Metadata (e.g. timestamp)
    await setDoc(doc(metadataCollection, "map_state"), {
        totalLots: lots.length,
        lastUpdated: new Date().toISOString()
    }, { merge: true });

    console.log("Sync complete!");
};

// Helper to fetch all lots from Firestore
export const fetchLotsFromFirestore = async (
    onProgress?: (current: number, total: number) => void
): Promise<{ locLots: Lot[], infoMap: Map<string, LotInfo> }> => {
    
    // 1. Get total count first
    const metadataRef = doc(db, "metadata_v2", "map_state");
    const metadataSnap = await getDoc(metadataRef);
    const totalDocs = metadataSnap.exists() ? metadataSnap.data().totalLots : 2500; // Est.

    const lotsCollection = collection(db, "lots_v2");
    // Firestore SDK doesn't support "get all" efficiently without cost. 
    // We will get all docs in one shot (standard reads).
    
    // NOTE: In a real large app, we'd paginate or sync only changes. 
    // For 2500 lots, a single fetch is acceptable (~1-2MB).
    
    const querySnapshot = await import("firebase/firestore").then(m => m.getDocs(lotsCollection));
    
    const locLots: Lot[] = [];
    const infoMap = new Map<string, LotInfo>();

    let processed = 0;
    const total = querySnapshot.size;

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Convert Firestore {x,y} back to [x,y]
        // @ts-ignore
        const coordinates = data.coordinates?.map((p: any) => [p.x, p.y] as [number, number]) || [];
        // @ts-ignore
        const center = data.center ? [data.center.x, data.center.y] as [number, number] : null;

        const lot: Lot = {
            id: data.id,
            quadra: data.quadra,
            lote: data.lote,
            coordinates: coordinates,
            center: center,
            info: {
                id: data.id,
                quadra: data.quadra,
                lote: data.lote,
                notes: data.notes,
                owner: data.owner,
                ownerContact: data.ownerContact,
                price: data.price,
                area: data.area,
                photos: data.photos,
                documents: data.documents,
                website: data.website,
                testada: data.testada,
                zona: data.zona,
                setor: data.setor,
                loteGeo: data.loteGeo,
                ownerCpf: data.ownerCpf,
                status: data.status,
                isAvailable: data.isAvailable,
                aliases: data.aliases,
                displayId: data.displayId,
                history: data.history,

                createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
                updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
            }
        };

        locLots.push(lot);
        infoMap.set(lot.id, lot.info);
        
        processed++;
        if (onProgress && processed % 50 === 0) {
            onProgress(processed, total);
        }
    });

    if (onProgress) onProgress(total, total);
    return { locLots, infoMap };
};

export const checkCloudStatus = async (): Promise<{ lastUpdated: Date | null, totalLots: number }> => {
    try {
        const metadataRef = doc(db, "metadata_v2", "map_state");
        const snap = await getDoc(metadataRef);
        if (snap.exists()) {
            const data = snap.data();
            return {
                lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null,
                totalLots: data.totalLots || 0
            };
        }
        return { lastUpdated: null, totalLots: 0 };
    } catch (e) {
        console.error("Error checking cloud status:", e);
        return { lastUpdated: null, totalLots: 0 };
    }
};
