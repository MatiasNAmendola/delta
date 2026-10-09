// Phone wake check: node estela-celu.mjs <url> <out.png>   (PW_CORE=<path to playwright-core> if it is not installed)
const { chromium } = await import(process.env.PW_CORE ?? 'playwright-core');
const [,, url, out] = process.argv;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36' }); const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(40000);
await page.locator('#playBtn').tap({ timeout: 60000 });
await page.waitForTimeout(8000);
const b = await page.locator('#btnForward').boundingBox(); for (let i=0;i<4;i++){ await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2); await page.waitForTimeout(150);} await page.waitForTimeout(9000);
await page.screenshot({ path: out });

await browser.close();
