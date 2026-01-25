import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const promos = [
  { name: 'promo_small', width: 440, height: 280 },
  { name: 'promo_large', width: 1400, height: 560 }
];

for (const promo of promos) {
  const svgPath = path.join(__dirname, '..', `${promo.name}.svg`);
  const svgContent = fs.readFileSync(svgPath, 'utf-8');
  
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: promo.width
    }
  });
  
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  
  fs.writeFileSync(path.join(__dirname, '..', `${promo.name}.png`), pngBuffer);
  console.log(`Generated ${promo.name}.png (${promo.width}x${promo.height})`);
}

console.log('Done!');
