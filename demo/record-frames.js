const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  // Use system Chrome
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 800 });
  
  const framesDir = path.join(__dirname, 'frames');
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir);
  }
  
  // Clean old frames
  fs.readdirSync(framesDir).forEach(f => fs.unlinkSync(path.join(framesDir, f)));
  
  console.log('Loading page...');
  await page.goto(`file://${path.join(__dirname, 'clip.html')}`, {
    waitUntil: 'networkidle0'
  });
  
  // Capture frames at 10fps for 35 seconds = 350 frames
  const fps = 10;
  const duration = 35;
  const totalFrames = fps * duration;
  const interval = 1000 / fps;
  
  console.log(`Capturing ${totalFrames} frames...`);
  
  for (let i = 0; i < totalFrames; i++) {
    const frameNum = String(i).padStart(4, '0');
    await page.screenshot({ 
      path: path.join(framesDir, `frame_${frameNum}.png`),
      type: 'png'
    });
    
    if (i % 50 === 0) {
      console.log(`Frame ${i}/${totalFrames}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  console.log('Frames captured!');
  await browser.close();
  
  console.log('Now run: ffmpeg -framerate 10 -i frames/frame_%04d.png -c:v libx264 -pix_fmt yuv420p prescio-clip.mp4');
})();
