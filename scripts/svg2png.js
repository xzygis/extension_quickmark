import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [16, 48, 128];
const svgPath = path.join(__dirname, '..', 'icon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf-8');

for (const size of sizes) {
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: size
    }
  });
  
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  
  fs.writeFileSync(path.join(__dirname, '..', `icon${size}.png`), pngBuffer);
  console.log(`Generated icon${size}.png`);
}

console.log('Done!');
