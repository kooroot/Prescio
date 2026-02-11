const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const htmlFile = process.argv[2] || 'clip.html';
const outputName = process.argv[3] || 'output';
const durationSec = parseInt(process.argv[4]) || 15;

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 800 });
  
  const framesDir = path.join(__dirname, `frames-${outputName}`);
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir);
  }
  
  fs.readdirSync(framesDir).forEach(f => fs.unlinkSync(path.join(framesDir, f)));
  
  console.log(`Loading ${htmlFile}...`);
  await page.goto(`file://${path.join(__dirname, htmlFile)}`, {
    waitUntil: 'networkidle0'
  });
  
  const fps = 10;
  const totalFrames = fps * durationSec;
  const interval = 1000 / fps;
  
  console.log(`Capturing ${totalFrames} frames (${durationSec}s)...`);
  
  for (let i = 0; i < totalFrames; i++) {
    const frameNum = String(i).padStart(4, '0');
    await page.screenshot({ 
      path: path.join(framesDir, `frame_${frameNum}.png`),
      type: 'png'
    });
    
    if (i % 30 === 0) console.log(`Frame ${i}/${totalFrames}`);
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  console.log('Done capturing!');
  await browser.close();
})();
