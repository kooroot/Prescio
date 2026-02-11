const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const path = require('path');

const Config = {
  followNewTab: false,
  fps: 30,
  videoFrame: {
    width: 600,
    height: 800,
  },
  videoCrf: 18,
  videoCodec: 'libx264',
  videoPreset: 'ultrafast',
  videoBitrate: 3000,
  aspectRatio: '3:4',
};

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 800 });
  
  const recorder = new PuppeteerScreenRecorder(page, Config);
  
  const outputPath = path.join(__dirname, 'prescio-clip.mp4');
  
  console.log('Starting recording...');
  await recorder.start(outputPath);
  
  // Load the page
  await page.goto(`file://${path.join(__dirname, 'clip.html')}`, {
    waitUntil: 'networkidle0'
  });
  
  // Wait for animation to complete (about 35 seconds for all messages + reveal)
  console.log('Recording animation...');
  await new Promise(resolve => setTimeout(resolve, 38000));
  
  console.log('Stopping recording...');
  await recorder.stop();
  
  await browser.close();
  
  console.log(`Video saved to: ${outputPath}`);
})();
