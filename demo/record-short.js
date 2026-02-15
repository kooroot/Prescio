#!/usr/bin/env node
/**
 * Record HTML clip to MP4 for YouTube Shorts
 * Usage: node record-short.js <clip.html> <output.mp4>
 */

const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const path = require('path');

const clipFile = process.argv[2];
const outputFile = process.argv[3] || 'output.mp4';

if (!clipFile) {
  console.error('Usage: node record-short.js <clip.html> <output.mp4>');
  process.exit(1);
}

// YouTube Shorts format: 1080x1920 (9:16)
const Config = {
  followNewTab: false,
  fps: 30,
  videoFrame: {
    width: 1080,
    height: 1920,
  },
  videoCrf: 18,
  videoCodec: 'libx264',
  videoPreset: 'ultrafast',
  videoBitrate: 5000,
  aspectRatio: '9:16',
};

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1080,1920', '--window-position=0,0']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  
  const recorder = new PuppeteerScreenRecorder(page, Config);
  
  const outputPath = path.resolve(outputFile);
  
  console.log('Starting recording...');
  await recorder.start(outputPath);
  
  // Load the page
  const clipPath = path.resolve(clipFile);
  console.log(`Loading: ${clipPath}`);
  await page.goto(`file://${clipPath}`, {
    waitUntil: 'networkidle0'
  });
  
  // Wait for animation to complete (about 25 seconds for messages + reveal)
  console.log('Recording animation...');
  await new Promise(resolve => setTimeout(resolve, 28000));
  
  console.log('Stopping recording...');
  await recorder.stop();
  
  await browser.close();
  
  console.log(`Video saved to: ${outputPath}`);
})();
