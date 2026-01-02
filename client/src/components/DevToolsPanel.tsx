import React from 'react';

interface DevToolsPanelProps {
  isDevMode: boolean;
  setIsDevMode: (value: boolean) => void;
  manualLots: any[];
  editorMode: string;
  setEditorMode: (mode: string) => void;
  deleteModeType: string;
  setDeleteModeType: (type: string) => void;
  activeQuadra: string;
  setActiveQuadra: (value: string) => void;
  nextLotNumber: string;
  setNextLotNumber: (value: string) => void;
  currentPoints: any[];
  setCurrentPoints: (points: any[]) => void;
  finishDrawingLot: () => void;
  setManualLots: (lots: any[]) => void;
}

export default function DevToolsPanel({
  isDevMode,
  setIsDevMode,
  manualLots,
  editorMode,
  setEditorMode,
  deleteModeType,
  setDeleteModeType,
  activeQuadra,
  setActiveQuadra,
  nextLotNumber,
  setNextLotNumber,
  currentPoints,
  setCurrentPoints,
  finishDrawingLot,
  setManualLots
}: DevToolsPanelProps) {
  
  const handleFixCenters = () => {
    const updated = manualLots.map(lot => {
      const xs = lot.coordinates.map((p: [number, number]) => p[0]);
      const ys = lot.coordinates.map((p: [number, number]) => p[1]);
      const center: [number, number] = [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2
      ];
      return { ...lot, center };
    });
    setManualLots(updated);
    alert('✅ Centros recalculados com sucesso!');
  };

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-3 z-50 max-w-sm">
      {/* Toggle Dev Mode Button */}
      <button 
        className={`px-4 py-2 rounded-lg shadow-lg font-bold transition-all ${
          isDevMode ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-white text-gray-800 hover:bg-gray-100'
        }`}
        onClick={() => setIsDevMode(!isDevMode)}
      >
        {isDevMode ? '🔧 Modo Dev: ON' : '🔧 Modo Dev: OFF'}
      </button>

      {isDevMode && (
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 space-y-4 animate-in slide-in-from-right-5 border border-gray-200 max-h-[calc(100vh-120px)] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <h3 className="font-bold text-gray-800 text-sm">Ferramentas de Desenvolvimento</h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">v2.0</span>
          </div>

          {/* Estatísticas */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-3 rounded-lg border border-blue-200">
            <div className="text-xs font-semibold text-blue-900 mb-2">📊 Estatísticas</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/80 p-2 rounded">
                <div className="text-gray-600">Lotes</div>
                <div className="font-bold text-blue-600 text-lg">{manualLots.length}</div>
              </div>
              <div className="bg-white/80 p-2 rounded">
                <div className="text-gray-600">Quadras</div>
                <div className="font-bold text-cyan-600 text-lg">
                  {new Set(manualLots.map(l => l.quadra)).size}
                </div>
              </div>
            </div>
          </div>

          {/* Ferramentas de Edição */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <span>✏️</span> Edição de Lotes
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                className={`px-3 py-2 text-xs rounded-lg font-medium transition-all ${
                  editorMode === 'draw-lot' 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setEditorMode('draw-lot')}
                title="Desenhar lote ponto a ponto"
              >
                ✏️ Desenhar
              </button>
              <button 
                className={`px-3 py-2 text-xs rounded-lg font-medium transition-all ${
                  editorMode === 'edit-vertex' 
                    ? 'bg-purple-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setEditorMode('edit-vertex')}
                title="Editar vértices dos lotes"
              >
                📍 Vértices
              </button>
              <button 
                className={`px-3 py-2 text-xs rounded-lg font-medium transition-all ${
                  editorMode === 'edit-info' 
                    ? 'bg-amber-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setEditorMode('edit-info')}
                title="Editar número do lote/quadra"
              >
                📝 Info
              </button>
              <button 
                className={`px-3 py-2 text-xs rounded-lg font-medium transition-all ${
                  editorMode === 'delete' 
                    ? 'bg-red-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setEditorMode('delete')}
                title="Excluir lotes ou quadras"
              >
                🗑️ Excluir
              </button>
            </div>
          </div>

          {/* Ferramentas de Criação */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <span>🏗️</span> Criação em Massa
            </div>
            <button 
              className={`w-full px-3 py-2 text-xs rounded-lg font-medium transition-all ${
                editorMode === 'create-grid' 
                  ? 'bg-green-500 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setEditorMode('create-grid')}
              title="Criar grade automática de lotes"
            >
              🏗️ Criar Grade de Quadra
            </button>
            <button 
              className={`w-full px-3 py-2 text-xs rounded-lg font-medium transition-all ${
                editorMode === 'move' 
                  ? 'bg-indigo-500 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setEditorMode('move')}
              title="Mover e arrastar quadras"
            >
              🔄 Mover Quadras
            </button>
          </div>

          {/* Modo de Exclusão */}
          {editorMode === 'delete' && (
            <div className="bg-red-50 p-3 rounded-lg border border-red-200 space-y-2 animate-in fade-in">
              <div className="text-xs font-semibold text-red-900">⚠️ Modo de Exclusão</div>
              <div className="flex gap-2">
                <button 
                  className={`flex-1 px-2 py-1.5 text-xs rounded font-medium transition-all ${
                    deleteModeType === 'lot' 
                      ? 'bg-red-500 text-white' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setDeleteModeType('lot')}
                >
                  Lote Individual
                </button>
                <button 
                  className={`flex-1 px-2 py-1.5 text-xs rounded font-medium transition-all ${
                    deleteModeType === 'quadra' 
                      ? 'bg-red-500 text-white' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setDeleteModeType('quadra')}
                >
                  Quadra Inteira
                </button>
              </div>
            </div>
          )}

          {/* Modo de Desenho */}
          {editorMode === 'draw-lot' && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-2 animate-in fade-in">
              <div className="text-xs font-semibold text-blue-900">✏️ Desenhar Lote</div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Quadra:</label>
                  <input 
                    type="text" 
                    value={activeQuadra} 
                    onChange={e => setActiveQuadra(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Ex: 1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Lote:</label>
                  <input 
                    type="text" 
                    value={nextLotNumber} 
                    onChange={e => setNextLotNumber(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Ex: 1"
                  />
                </div>
                <div className="bg-blue-100 p-2 rounded text-xs text-blue-800">
                  <strong>{currentPoints.length}</strong> pontos marcados
                </div>
                <button 
                  className="w-full px-3 py-2 bg-blue-500 text-white text-xs rounded-lg font-medium hover:bg-blue-600 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={finishDrawingLot}
                  disabled={currentPoints.length < 3}
                >
                  ✅ Finalizar Lote
                </button>
                <button 
                  className="w-full px-3 py-1.5 bg-gray-300 text-gray-700 text-xs rounded-lg font-medium hover:bg-gray-400 transition-all"
                  onClick={() => setCurrentPoints([])}
                >
                  ❌ Limpar Pontos
                </button>
                <div className="text-[10px] text-gray-500 text-center italic">
                  Clique no mapa para adicionar pontos.<br/>
                  Duplo-clique para finalizar.
                </div>
              </div>
            </div>
          )}

          {/* Ferramentas Utilitárias */}
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <span>🛠️</span> Utilitários
            </div>
            <button 
              className="w-full px-3 py-2 text-xs bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-all shadow-md"
              onClick={handleFixCenters}
              title="Recalcular centros de todos os lotes"
            >
              🎯 Corrigir Centros dos Lotes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
