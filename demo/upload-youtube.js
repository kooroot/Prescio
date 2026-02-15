#!/usr/bin/env node
/**
 * Upload video to YouTube Shorts using Puppeteer
 * Uses OpenClaw browser profile to maintain login state
 * 
 * Usage: node upload-youtube.js <video.mp4> "<title>" "<description>"
 */

const puppeteer = require('puppeteer');
const path = require('path');

const videoFile = process.argv[2];
const title = process.argv[3] || 'AI Mafia Game #Shorts';
const description = process.argv[4] || 'AI agents playing Mafia - can you spot the impostor?\n\n#Shorts #Prescio #AImafia #Monad';

if (!videoFile) {
  console.error('Usage: node upload-youtube.js <video.mp4> "<title>" "<description>"');
  process.exit(1);
}

const STUDIO_URL = 'https://studio.youtube.com/channel/UCNEMt7OwMTNfIgvLg0r4w5Q';
const USER_DATA_DIR = '/Users/kooroot/.openclaw/browser/openclaw/user-data';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('Launching browser with OpenClaw profile...');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    userDataDir: USER_DATA_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,900'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  // Hide automation indicators
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  
  console.log('Navigating to YouTube Studio...');
  await page.goto(STUDIO_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Wait for page to load
  await sleep(3000);
  console.log('Page title:', await page.title());
  
  // Click Create button
  console.log('Looking for Create button...');
  try {
    await page.waitForSelector('#create-icon', { timeout: 10000 });
    await page.click('#create-icon');
    console.log('Clicked Create button');
    await sleep(1000);
    
    // Click Upload videos option
    const uploadOption = await page.waitForSelector('tp-yt-paper-item:has-text("Upload videos"), #text-item-0', { timeout: 5000 });
    await uploadOption.click();
    console.log('Clicked Upload videos');
    await sleep(2000);
  } catch (e) {
    console.log('Trying alternative selector for Create...');
    // Try clicking the button with text "Create"
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent);
      if (text && text.includes('Create')) {
        await btn.click();
        console.log('Clicked Create (alternative)');
        await sleep(1000);
        break;
      }
    }
    
    // Look for Upload videos menu item
    const items = await page.$$('tp-yt-paper-item, ytcp-text-menu-item');
    for (const item of items) {
      const text = await item.evaluate(el => el.textContent);
      if (text && text.includes('Upload videos')) {
        await item.click();
        console.log('Clicked Upload videos (alternative)');
        await sleep(2000);
        break;
      }
    }
  }
  
  // Wait for upload dialog
  console.log('Waiting for upload dialog...');
  await sleep(2000);
  
  // Set up file chooser handler
  const absolutePath = path.resolve(videoFile);
  console.log(`Will upload: ${absolutePath}`);
  
  // Find the file input and upload
  const fileInput = await page.$('input[name="Filedata"]');
  if (fileInput) {
    await fileInput.uploadFile(absolutePath);
    console.log('File uploaded via input');
  } else {
    // Try using fileChooser
    console.log('Using fileChooser method...');
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 5000 }),
      page.click('button:has-text("Select files")').catch(() => {
        return page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Select files'));
          if (btn) btn.click();
        });
      })
    ]);
    await fileChooser.accept([absolutePath]);
    console.log('File selected via fileChooser');
  }
  
  // Wait for upload to start
  console.log('Waiting for upload to process...');
  await sleep(8000);
  
  // Wait for title input
  try {
    console.log('Looking for title input...');
    const textbox = await page.waitForSelector('div[id="textbox"]', { timeout: 30000 });
    
    if (textbox) {
      // Clear existing text and type title
      await textbox.click({ clickCount: 3 });
      await sleep(500);
      await page.keyboard.type(title);
      console.log(`Title set: ${title}`);
    }
    
    await sleep(2000);
    
    // Click "No, it's not made for kids" if prompted
    const notForKids = await page.$('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]');
    if (notForKids) {
      await notForKids.click();
      console.log('Selected: Not made for kids');
    }
    
    // Click Next buttons to proceed through wizard
    for (let i = 0; i < 3; i++) {
      await sleep(2000);
      const nextBtn = await page.$('#next-button');
      if (nextBtn) {
        await nextBtn.click();
        console.log(`Clicked Next (${i + 1}/3)`);
      }
    }
    
    // Set visibility to Public
    await sleep(2000);
    const publicRadio = await page.$('tp-yt-paper-radio-button[name="PUBLIC"]');
    if (publicRadio) {
      await publicRadio.click();
      console.log('Set visibility: Public');
    }
    
    // Wait for upload to complete before clicking Done
    console.log('Waiting for upload to finish...');
    await sleep(15000);  // Give time for upload
    
    // Click Done
    const doneBtn = await page.$('#done-button');
    if (doneBtn) {
      await doneBtn.click();
      console.log('Clicked Done');
    }
    
    await sleep(5000);
    
    // Try to get video URL
    console.log('Looking for video URL...');
    const linkElement = await page.$('a.style-scope.ytcp-video-info');
    if (linkElement) {
      const href = await linkElement.evaluate(el => el.href);
      console.log(`SUCCESS! Video URL: ${href}`);
    } else {
      console.log('Could not find video URL, but upload may have succeeded');
    }
    
  } catch (err) {
    console.error('Error during upload process:', err.message);
    // Take screenshot for debugging
    await page.screenshot({ path: '/tmp/youtube-upload-error.png' });
    console.log('Screenshot saved to /tmp/youtube-upload-error.png');
  }
  
  await sleep(3000);
  await browser.close();
  console.log('Done!');
})();
