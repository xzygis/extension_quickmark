import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [16, 48, 128];
const svgPath = path.join(__dirname, '..', 'icon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf-8');

async function convert() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  const page = await browser.newPage();

  for (const size of sizes) {
    await page.setViewport({ width: size, height: size });
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; }
            body { width: ${size}px; height: ${size}px; }
            svg { width: 100%; height: 100%; }
          </style>
        </head>
        <body>${svgContent}</body>
      </html>
    `;
    
    await page.setContent(html);
    await page.screenshot({
      path: path.join(__dirname, '..', `icon${size}.png`),
      omitBackground: true
    });
    
    console.log(`Generated icon${size}.png`);
  }

  await browser.close();
  console.log('Done!');
}

convert().catch(console.error);
