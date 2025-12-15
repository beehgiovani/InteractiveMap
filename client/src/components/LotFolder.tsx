/**
 * Componente de Pasta do Lote
 * 
 * Interface para gerenciar informações específicas de um lote
 * Permite adicionar, editar e visualizar notas e dados do lote
 */

import { useState, useEffect } from "react";
import { Lot, LotInfo } from "@/types";
import { Button } from "@/components/ui/button";
import { X, Save, Edit2, Trash2 } from "lucide-react";

interface LotFolderProps {
  lot: Lot;
  onClose: () => void;
  onSave: (lotInfo: LotInfo) => void;
}

export default function LotFolder({ lot, onClose, onSave }: LotFolderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State for all editable fields
  const [notes, setNotes] = useState(lot.info.notes);
  const [documentation, setDocumentation] = useState(lot.info.documentation || "");
  const [owner, setOwner] = useState(lot.info.owner || "");
  const [price, setPrice] = useState(lot.info.price !== undefined ? lot.info.price.toString() : "");
  const [area, setArea] = useState(lot.info.area !== undefined ? lot.info.area.toString() : "");

  // Sync when a different lot is selected
  useEffect(() => {
    setNotes(lot.info.notes);
    setDocumentation(lot.info.documentation || "");
    setOwner(lot.info.owner || "");
    setPrice(lot.info.price !== undefined ? lot.info.price.toString() : "");
    setArea(lot.info.area !== undefined ? lot.info.area.toString() : "");
  }, [lot.info]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedInfo: LotInfo = {
        ...lot.info,
        notes,
        documentation,
        owner,
        price: price === "" ? undefined : Number(price),
        area: area === "" ? undefined : Number(area),
        updatedAt: new Date(),
      };
      onSave(updatedInfo);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearNotes = () => {
    if (window.confirm("Deseja limpar todas as notas deste lote?")) {
      setNotes("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Quadra {lot.quadra} - Lote {lot.lote}</h2>
            <p className="text-blue-100 text-sm mt-1">ID: {lot.id}</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-blue-700 rounded-full p-2 transition-colors" aria-label="Fechar">
            <X size={24} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Informações do Lote */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Informações do Lote</h3>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <label className="text-sm font-medium text-gray-600">Quadra</label>
                <p className="text-lg font-semibold text-gray-800">{lot.quadra}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Lote</label>
                <p className="text-lg font-semibold text-gray-800">{lot.lote}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Criado em</label>
                <p className="text-sm text-gray-700">
                  {new Date(lot.info.createdAt).toLocaleDateString("pt-BR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Atualizado em</label>
                <p className="text-sm text-gray-700">
                  {new Date(lot.info.updatedAt).toLocaleDateString("pt-BR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          </div>

          {/* Campos adicionais */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Documentação</h3>
            <textarea
              value={documentation}
              onChange={e => setDocumentation(e.target.value)}
              className="w-full h-24 p-2 border rounded"
              placeholder="Inserir documentação..."
            />
          </div>
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Proprietário</label>
              <input
                type="text"
                value={owner}
                onChange={e => setOwner(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Nome do proprietário"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Preço (R$)</label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Valor de venda"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Área (m²)</label>
              <input
                type="number"
                value={area}
                onChange={e => setArea(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Metragem"
              />
            </div>
          </div>

          {/* Notas */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Notas</h3>
              {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium">
                  <Edit2 size={16} />Editar
                </button>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Adicione informações sobre este lote..."
                className="w-full h-48 p-4 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-600 resize-none"
              />
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg min-h-48 text-gray-700 whitespace-pre-wrap">
                {notes || (<span className="text-gray-400 italic">Nenhuma nota adicionada. Clique em &quot;Editar&quot; para adicionar.</span>)}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé com Botões */}
        <div className="bg-gray-100 p-6 border-t border-gray-200 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {isEditing && (
              <button onClick={handleClearNotes} className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm font-medium">
                <Trash2 size={16} />Limpar
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              {isEditing ? "Cancelar" : "Fechar"}
            </Button>
            {isEditing && (
              <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Save size={16} className="mr-2" />{isSaving ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
