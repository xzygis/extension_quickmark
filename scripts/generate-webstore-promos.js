import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to convert image file to Base64
const getBase64Image = (filePath) => {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return '';
  }
  const ext = path.extname(filePath).replace('.', '');
  return `data:image/${ext};base64,${fs.readFileSync(filePath, 'base64')}`;
};

  // Colors and theme matching the actual QuickMark logo/UI
  const theme = {
    bgMain: '#6366f1', // The exact indigo color from icon.svg
    bgDark: '#4f46e5',
    text: '#ffffff',
    textLight: 'rgba(255, 255, 255, 0.9)',
    accent: '#fbbf24', // The exact amber color of the star in icon.svg
    uiBg: '#f8fafc',
    uiBorder: '#e2e8f0',
    green: '#22c55e',
    red: '#ef4444',
    purple: '#a855f7'
  };

  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="48" height="48">
    <rect width="128" height="128" rx="24" fill="url(#bg)"/>
    <path d="M64 20l13 28 31 4-22 22 5 30-27-14-27 14 5-30-22-22 31-4z" fill="#fbbf24"/>
    <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#f8fafc"/></linearGradient></defs>
  </svg>`;
  
  const iconSvgDark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="72" height="72">
    <rect width="128" height="128" rx="24" fill="#ffffff"/>
    <path d="M64 20l13 28 31 4-22 22 5 30-27-14-27 14 5-30-22-22 31-4z" fill="#fbbf24"/>
  </svg>`;

async function generatePromos() {
  const assetsDir = path.join(__dirname, '../webstore_assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Load screenshots
  const img1 = getBase64Image(path.join(assetsDir, 'quckmark-1.png')); // Main UI
  const img2 = getBase64Image(path.join(assetsDir, 'quickmark-2.png')); // Edit Modal
  const img3 = getBase64Image(path.join(assetsDir, 'quickmark-3.png')); // Batch mode
  const img4 = getBase64Image(path.join(assetsDir, 'quickmark-4.png')); // Settings

  if (!img1 || !img2 || !img3 || !img4) {
    console.error('Missing screenshots. Please ensure all 4 screenshots are in webstore_assets folder.');
    return;
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // 1. Generate Promo Small (440x280) - Elegant Minimalist Design
  console.log('Generating Promo Small (440x280)...');
  await page.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });
  
  const smallHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
      body {
        margin: 0; width: 440px; height: 280px;
        background: linear-gradient(135deg, ${theme.bgMain} 0%, ${theme.bgDark} 100%);
        font-family: 'Inter', sans-serif;
        display: flex; flex-direction: column; overflow: hidden;
        align-items: center; justify-content: center; position: relative;
      }
      
      /* Subtle decorative background */
      .bg-decoration {
        position: absolute; width: 300px; height: 300px; border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
        top: -100px; right: -100px; z-index: 1;
      }
      
      /* Central Content Container */
      .content-wrapper {
        z-index: 10; display: flex; flex-direction: column; align-items: center; text-align: center;
        width: 100%; padding: 0 20px; box-sizing: border-box;
      }
      
      .logo-container {
        display: flex; align-items: center; justify-content: center;
        width: 72px; height: 72px; background: white; border-radius: 20px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2); margin-bottom: 20px;
      }
      
      .title {
        color: white; font-size: 38px; font-weight: 900; margin: 0 0 8px 0;
        letter-spacing: -1px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .subtitle-pill {
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.3);
        backdrop-filter: blur(4px);
        color: white; padding: 6px 16px; border-radius: 20px;
        font-size: 14px; font-weight: 600; letter-spacing: 0.5px;
      }
      
      /* Bottom fade for a polished look */
      .bottom-fade {
        position: absolute; bottom: 0; left: 0; width: 100%; height: 80px;
        background: linear-gradient(to top, rgba(0,0,0,0.15) 0%, transparent 100%);
        z-index: 2; pointer-events: none;
      }
    </style>
  </head>
  <body>
    <div class="bg-decoration"></div>
    <div class="content-wrapper">
      <div class="logo-container">
        ${iconSvgDark}
      </div>
      <h1 class="title">QuickMark</h1>
      <div class="subtitle-pill">SMART BOOKMARK MANAGER</div>
    </div>
    <div class="bottom-fade"></div>
  </body>
  </html>`;

  await page.setContent(smallHtml, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(assetsDir, 'promo_small_440x280.png'), type: 'png' });


  // 2. Generate Promo Marquee (1400x560) - Multi-screen composition
  console.log('Generating Promo Marquee (1400x560)...');
  await page.setViewport({ width: 1400, height: 560, deviceScaleFactor: 1 });
  
  const marqueeHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800;900&display=swap');
      body {
        margin: 0; width: 1400px; height: 560px;
        background: linear-gradient(135deg, ${theme.bgMain} 0%, ${theme.bgDark} 100%);
        font-family: 'Inter', sans-serif;
        display: flex; align-items: center; overflow: hidden; position: relative;
      }
      .bg-circle-1 {
        position: absolute; width: 800px; height: 800px; border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%); top: -200px; right: -200px;
      }
      
      .left-col { width: 720px; position: relative; z-index: 10; padding-left: 80px; }
      
      .mock-ui {
        width: 720px; height: 480px; background: ${theme.uiBg};
        border-radius: 16px; box-shadow: 0 30px 60px rgba(0,0,0,0.3);
        padding: 32px; box-sizing: border-box; display: flex; flex-direction: column;
      }
      .mock-topbar { display: flex; gap: 24px; margin-bottom: 32px; align-items: center; }
      .mock-search { flex: 1; height: 48px; background: ${theme.uiBorder}; border-radius: 24px; }
      .mock-btn { width: 80px; height: 48px; background: ${theme.bgMain}; border-radius: 24px; }
      
      .mock-content { display: flex; gap: 24px; flex: 1; }
      .mock-col { flex: 1; display: flex; flex-direction: column; gap: 24px; }
      
      .mock-card { background: white; border-radius: 12px; padding: 24px; border: 1px solid ${theme.uiBorder}; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
      .mock-card-header { display: flex; gap: 16px; margin-bottom: 24px; }
      .mock-card-line-1 { height: 10px; width: 80px; background: ${theme.bgMain}; border-radius: 5px; }
      .mock-card-line-2 { height: 10px; width: 140px; background: #cbd5e1; border-radius: 5px; margin-top: 6px;}
      
      .mock-item { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
      .mock-icon { width: 32px; height: 32px; border-radius: 50%; }
      .mock-icon.c1 { background: ${theme.accent}; }
      .mock-icon.c2 { background: ${theme.green}; }
      .mock-icon.c3 { background: ${theme.red}; }
      .mock-icon.c4 { background: #3b82f6; }
      .mock-icon.c5 { background: ${theme.purple}; }
      .mock-icon.c6 { background: #ec4899; }
      .mock-icon.c7 { background: #14b8a6; }
      
      .mock-lines { flex: 1; }
      .mock-line-1 { height: 10px; width: 100%; background: #475569; border-radius: 5px; margin-bottom: 10px; }
      .mock-line-2 { height: 8px; width: 60%; background: #94a3b8; border-radius: 4px; }

      .right-col { flex: 1; padding-left: 80px; z-index: 10; display: flex; flex-direction: column; justify-content: center; }
      .logo-row { display: flex; align-items: center; gap: 20px; margin-bottom: 16px; }
      .title { color: white; font-size: 72px; font-weight: 900; margin: 0; letter-spacing: -1.5px; }
      .subtitle { color: ${theme.textLight}; font-size: 28px; font-weight: 700; margin: 0 0 12px 0; }
      .subtitle-zh { color: rgba(255, 255, 255, 0.7); font-size: 24px; font-weight: 500; margin: 0 0 48px 0; }
      
      .features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px 32px; }
      .feature { display: flex; align-items: center; gap: 16px; color: white; font-size: 20px; font-weight: 600; }
      .f-icon { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; }
      .f-icon svg { width: 20px; height: 20px; fill: white; }
    </style>
  </head>
  <body>
    <div class="bg-circle-1"></div>
    
    <div class="left-col">
      <div class="mock-ui">
        <div class="mock-topbar">
          <div class="mock-search"></div>
          <div class="mock-btn"></div>
        </div>
        <div class="mock-content">
          <div class="mock-col">
            <div class="mock-card">
              <div class="mock-card-header"><div class="mock-card-line-1"></div><div class="mock-card-line-2"></div></div>
              <div class="mock-item"><div class="mock-icon c1"></div><div class="mock-lines"><div class="mock-line-1"></div><div class="mock-line-2"></div></div></div>
              <div class="mock-item"><div class="mock-icon c2"></div><div class="mock-lines"><div class="mock-line-1"></div><div class="mock-line-2"></div></div></div>
              <div class="mock-item"><div class="mock-icon c3"></div><div class="mock-lines"><div class="mock-line-1"></div><div class="mock-line-2"></div></div></div>
              <div class="mock-item" style="margin-bottom:0;"><div class="mock-icon c4"></div><div class="mock-lines"><div class="mock-line-1"></div><div class="mock-line-2"></div></div></div>
            </div>
          </div>
          <div class="mock-col">
            <div class="mock-card">
              <div class="mock-card-header"><div class="mock-card-line-1" style="background:${theme.green};"></div><div class="mock-card-line-2"></div></div>
              <div class="mock-item"><div class="mock-icon c5"></div><div class="mock-lines"><div class="mock-line-1"></div><div class="mock-line-2"></div></div></div>
              <div class="mock-item"><div class="mock-icon c6"></div><div class="mock-lines"><div class="mock-line-1"></div><div class="mock-line-2"></div></div></div>
              <div class="mock-item" style="margin-bottom:0;"><div class="mock-icon c7"></div><div class="mock-lines"><div class="mock-line-1"></div><div class="mock-line-2"></div></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="right-col">
      <div class="logo-row">
        ${iconSvgDark}
        <h1 class="title">QuickMark</h1>
      </div>
      <div class="subtitle">Smart Bookmark Manager</div>
      <div class="subtitle-zh">新标签页智能书签管理器</div>
      
      <div class="features-grid">
        <div class="feature"><div class="f-icon"><svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></div>One-Click Save</div>
        <div class="feature"><div class="f-icon"><svg viewBox="0 0 24 24"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg></div>Tags System</div>
        <div class="feature"><div class="f-icon"><svg viewBox="0 0 24 24"><path d="M3 3v18h18V3H3zm16 16H5V5h14v14zM11 7h2v2h-2zM7 7h2v2H7zm8 0h2v2h-2z"/></svg></div>Smart Groups</div>
        <div class="feature"><div class="f-icon"><svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></div>Instant Search</div>
        <div class="feature"><div class="f-icon"><svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg></div>Cloud Sync</div>
        <div class="feature"><div class="f-icon"><svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg></div>Dark Mode</div>
      </div>
    </div>
  </body>
  </html>`;

  await page.setContent(marqueeHtml, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(assetsDir, 'promo_marquee_1400x560.png'), type: 'png' });

  // 3. Generate screenshot wraps (1280x800) with beautiful backgrounds
  console.log('Generating wrapped screenshots (1280x800)...');
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  
  const generateWrappedScreenshot = async (imgSrc, filename, title, subtitle) => {
    const wrapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=swap');
        body {
          margin: 0; width: 1280px; height: 800px;
          background: ${theme.bgGradient};
          font-family: 'Inter', sans-serif;
          display: flex; flex-direction: column; align-items: center;
          padding-top: 60px; box-sizing: border-box;
        }
        .text-container { text-align: center; margin-bottom: 40px; }
        .title { color: ${theme.text}; font-size: 48px; font-weight: 800; margin: 0 0 12px 0; }
        .subtitle { color: #4338ca; font-size: 24px; font-weight: 500; margin: 0; }
        .img-wrapper {
          width: 1040px; height: 585px; /* 16:9 ratio */
          border-radius: 16px;
          box-shadow: 0 30px 60px -15px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.5);
          overflow: hidden;
        }
        .img-wrapper img { width: 100%; height: 100%; object-fit: cover; object-position: left top; }
      </style>
    </head>
    <body>
      <div class="text-container">
        <h1 class="title">${title}</h1>
        <p class="subtitle">${subtitle}</p>
      </div>
      <div class="img-wrapper">
        <img src="${imgSrc}">
      </div>
    </body>
    </html>`;
    
    await page.setContent(wrapHtml, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(assetsDir, filename), type: 'png' });
  };

  await generateWrappedScreenshot(img1, '1_dashboard.png', 'Beautiful New Tab Dashboard', 'Organize your bookmarks with cards or list views');
  await generateWrappedScreenshot(img2, '2_smart_tags.png', 'Smart Tags & Custom Groups', 'Find any page instantly with powerful categorization');
  await generateWrappedScreenshot(img3, '3_batch_mode.png', 'Powerful Batch Operations', 'Easily manage hundreds of bookmarks at once');
  await generateWrappedScreenshot(img4, '4_cloud_sync.png', 'Google Cloud Sync', 'Automatically sync your bookmarks across all devices');

  console.log('✅ All store assets generated successfully!');
  await browser.close();
}

generatePromos().catch(console.error);