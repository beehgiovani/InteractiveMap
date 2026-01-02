import React, { useState } from 'react';
import { syncLotsToSupabase } from '../lib/supabaseSync';
import { Lot, LotInfo } from '../types';
import { Loader2, Database, UploadCloud, CheckCircle2, X } from 'lucide-react';

interface MigrationToolProps {
    lots: Lot[];
    lotsData: Map<string, LotInfo>;
    onClose: () => void;
}

export default function MigrationTool({ lots, lotsData, onClose }: MigrationToolProps) {
    const [status, setStatus] = useState<'idle' | 'syncing' | 'complete' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(p => [...p, msg]);

    const startMigration = async () => {
        try {
            setStatus('syncing');
            addLog("Starting migration from Local Data...");
            addLog(`Found ${lots.length} lots in memory.`);
            
            setProgress(0);
            
            await syncLotsToSupabase(lots, lotsData, (count) => {
                setProgress(count);
            });

            addLog("Migration to Supabase complete!");
            setStatus('complete');

        } catch (e: any) {
            console.error(e);
            addLog(`Error: ${e.message}`);
            setStatus('error');
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg relative">
                 <button 
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  <X size={20} />
                </button>

                <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                    Migração: Local para Supabase
                </h2>

                <div className="bg-gray-100 rounded p-4 h-48 overflow-y-auto font-mono text-xs mb-4">
                    {logs.map((L, i) => <div key={i}>{L}</div>)}
                </div>

                {status === 'syncing' ? (
                    <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span>Enviando p/ Supabase...</span>
                            <span>{progress} / {lots.length}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded overflow-hidden">
                            <div 
                                className="h-full bg-blue-600 transition-all duration-300"
                                style={{ width: `${lots.length ? (progress / lots.length) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                ) : null}

                <div className="flex justify-end gap-2">
                    {status === 'idle' && (
                        <button 
                            onClick={startMigration}
                            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
                        >
                            <UploadCloud size={18} />
                            Iniciar Migração (Local)
                        </button>
                    )}
                    
                    {status === 'complete' && (
                        <div className="flex items-center gap-2 text-green-600 font-bold">
                            <CheckCircle2 />
                            Migração Concluída
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
