
import { MapData, Lot, Quadra } from "@/types";

/**
 * Dados do mapa do Jardim Acapulco
 * Total de Lotes: aprox 2431
 * Estrutura: Quadras numeradas.
 */

// --- CONFIGURAÇÃO GLOBAL ---
// Ajuste esses valores para "casar" com a imagem de fundo (1024x747)
const GLOBAL_OFFSET_X = 0;
const GLOBAL_OFFSET_Y = 0;
const SCALE = 1; // 1 unidade = 1 pixel na imagem base

// Tamanhos convertidos para Pixels (estimativa inicial)
const LOT_WIDTH = 8 * SCALE;
const LOT_DEPTH = 20 * SCALE;
const STREET_WIDTH = 15 * SCALE;
const GAP = 2 * SCALE; 

interface BlockConfig {
    id: number; // Número da Quadra
    x: number;
    y: number;
    rotation?: number; // Graus
    type: 'rect' | 'angled' | 'irregular';
    rows?: number; // Para type rect
    cols?: number; // Para type rect (geralmente 2 para quadras padrão)
    lotStart?: number; // Número do primeiro lote
    lotCount?: number; // Total de lotes (para overrides)
    lotWidth?: number;
    lotDepth?: number;
}

// Lista de Configurações das Quadras
// Posicionamento INICIAL de teste para calibração
const blockConfigs: BlockConfig[] = [
    // --- ZONA 1: ESQUERDA ---
    // Colocando em posições visíveis (x < 1024, y < 747)
    { id: 1, x: 100, y: 100, rotation: -45, type: 'angled', lotCount: 14 },
    { id: 2, x: 150, y: 150, rotation: -45, type: 'angled', lotCount: 16 },
    { id: 3, x: 200, y: 200, rotation: -45, type: 'angled', lotCount: 18 },
    
    // --- ZONA 2: CENTRAL ---
    { id: 10, x: 400, y: 100, type: 'rect', rows: 8, cols: 2 },
    { id: 11, x: 500, y: 100, type: 'rect', rows: 8, cols: 2 },
];

// Função Helper para rotacionar pontos
const rotate = (x: number, y: number, cx: number, cy: number, angle: number) => {
    const rad = angle * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = x - cx;
    const dy = y - cy;
    return [
        (dx * cos) - (dy * sin) + cx,
        (dx * sin) + (dy * cos) + cy
    ] as [number, number];
};

function generateBlock(config: BlockConfig): Quadra {
    const { id, x, y, rotation = 0, type, rows = 10, cols = 2, lotStart = 1 } = config;
    const lots: Lot[] = [];
    const qId = String(id);
    
    const w = config.lotWidth || LOT_WIDTH;
    const d = config.lotDepth || LOT_DEPTH;

    if (type === 'rect') {
        let count = lotStart;
        // Coluna 1 (Esquerda)
        for (let r = 0; r < rows; r++) {
            const lx = x;
            const ly = y + (r * (d + GAP));
            lots.push(createLot(qId, count++, lx, ly, w, d, rotation, x, y));
        }
        // Coluna 2 (Direita) - Espelhada ou ao lado
        for (let r = 0; r < rows; r++) {
            const lx = x + w + GAP;
            const ly = y + (r * (d + GAP));
            lots.push(createLot(qId, count++, lx, ly, w, d, rotation, x, y));
        }
    } else if (type === 'angled') {
         // Lotes dispostos linearmente mas o bloco todo rotacionado
         const count = config.lotCount || 10;
         for(let i=0; i<count; i++) {
             const col = i % 2;
             const row = Math.floor(i / 2);
             
             const lx = x + (col * (w + GAP));
             const ly = y + (row * (d + GAP));
             lots.push(createLot(qId, i+1, lx, ly, w, d, rotation, x, y));
         }
    }

    return { id: qId, name: `Quadra ${id}`, lots };
}

function createLot(qId: string, lNum: number, x: number, y: number, w: number, h: number, rot: number, cx: number, cy: number): Lot {
    // Pontos básicos (Retângulo)
    let p1: [number, number] = [x, y];
    let p2: [number, number] = [x + w, y];
    let p3: [number, number] = [x + w, y + h];
    let p4: [number, number] = [x, y + h];

    // Rotacionar se necessário
    if (rot !== 0) {
        p1 = rotate(p1[0], p1[1], cx, cy, rot);
        p2 = rotate(p2[0], p2[1], cx, cy, rot);
        p3 = rotate(p3[0], p3[1], cx, cy, rot);
        p4 = rotate(p4[0], p4[1], cx, cy, rot);
    }
    
    const id = `${qId}-${lNum}`;
    return {
        id,
        quadra: qId,
        lote: String(lNum),
        coordinates: [p1, p2, p3, p4],
        info: { id, quadra: qId, lote: String(lNum), notes: "", createdAt: new Date(), updatedAt: new Date() }
    };
}

// --- GERAÇÃO FINAL ---

const quadras: Quadra[] = [];

// 1. Processar Configs Manuais de Quadras Residenciais
blockConfigs.forEach(cfg => {
    quadras.push(generateBlock(cfg));
});

// 2. Preencher Grid Automaticamente (Zona 3 - O grosso do mapa)
// COMENTADO TEMPORARIAMENTE PARA NÃO POLUIR A TELA ENQUANTO ALINHAMOS
/*
const Z3_START_X = 18000;
const Z3_START_Y = 2000;
const Z3_COLS = 8;
let currentQ = 41;

for (let c = 0; c < Z3_COLS; c++) {
    for (let r = 0; r < 10; r++) {
        if (currentQ > 117) break;
        // Se já existe config manual, pular
        if (!blockConfigs.find(b => b.id === currentQ)) {
             // Lógica simples para pular área do Shopping no canto inferior direito
             const isShoppingArea = (c >= 6 && r >= 8);
             
             if (!isShoppingArea) {
                 quadras.push(generateBlock({
                     id: currentQ,
                     x: Z3_START_X + (c * (2*LOT_WIDTH + STREET_WIDTH)),
                     y: Z3_START_Y + (r * (10*LOT_DEPTH + STREET_WIDTH)),
                     type: 'rect',
                     rows: 12
                 }));
             }
        }
        currentQ++;
    }
}
*/

// 3. ADICIONAR ÁREAS ESPECIAIS (Ancoradas em pontos estratégicos)
const adminX = 600; // Posição arbitrária visível
const adminY = 600;

quadras.push({
    id: "admin",
    name: "Administração",
    lots: [{
        id: "admin-main",
        quadra: "admin",
        lote: "Sede",
        coordinates: [
             [adminX, adminY],
             [adminX + 50, adminY],
             [adminX + 50, adminY + 30],
             [adminX, adminY + 30]
        ],
        info: { 
            id: "admin-main", quadra: "admin", lote: "Sede", 
            notes: "Administração e Ambulatório", 
            createdAt: new Date(), updatedAt: new Date() 
        }
    }]
});

// BOUNDS DEFINIDOS PELA IMAGEM: 1024 x 747
export const MAP_BOUNDS = {
    minX: 0,
    minY: 0,
    maxX: 1024,
    maxY: 747,
    width: 1024,
    height: 747
};

export const streets = []; 

export const mapDataComplete: MapData = { quadras };

export function getMapStatistics() {
    return {
        totalQuadras: quadras.length,
        totalLotes: quadras.reduce((acc, q) => acc + q.lots.length, 0)
    };
}


