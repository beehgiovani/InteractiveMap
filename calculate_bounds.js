
import fs from 'fs';
// Load the JSON directly
const rawData = fs.readFileSync('./client/src/data/jardim_acapulco.json', 'utf8');
const data = JSON.parse(rawData);

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

data.features.forEach(f => {
    if (f.geometry.type === 'Polygon') {
        f.geometry.coordinates[0].forEach(p => {
             if (p[0] < minX) minX = p[0];
             if (p[0] > maxX) maxX = p[0];
             if (p[1] < minY) minY = p[1];
             if (p[1] > maxY) maxY = p[1];
        });
    } else if (f.geometry.type === 'Point') {
        const [x, y] = f.geometry.coordinates;
             if (x < minX) minX = x;
             if (x > maxX) maxX = x;
             if (y < minY) minY = y;
             if (y > maxY) maxY = y;
    }
});

console.log(`MinX: ${minX}, MinY: ${minY}`);
console.log(`MaxX: ${maxX}, MaxY: ${maxY}`);
console.log(`Width: ${maxX - minX}, Height: ${maxY - minY}`);
console.log(`Ratio: ${(maxX - minX) / (maxY - minY)}`);
