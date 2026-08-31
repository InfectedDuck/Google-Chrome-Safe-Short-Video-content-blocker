import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const output = path.join(root, "store-assets");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "reelless-assets-"));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "reelless-captures-"));
const executablePath = process.env.REELLESS_CHROME_PATH || chromium.executablePath();
let context;

const fixtureStyle = `
  *{box-sizing:border-box}body{margin:0;background:#f6f7f9;color:#18212a;font-family:Inter,Arial,sans-serif}
  .bar{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 34px;background:white;border-bottom:1px solid #e4e7eb}
  .brand{font-size:21px;font-weight:850}.search{width:260px;padding:12px 18px;border-radius:99px;background:#eef1f4;color:#7a8792}
  main{padding:32px}.layout{display:grid;grid-template-columns:190px 1fr;gap:28px}.nav{display:grid;align-content:start;gap:9px}.nav a{padding:13px 15px;border-radius:12px;color:inherit;text-decoration:none}.nav a:first-child{background:#e8ecef;font-weight:800}
  .feed{max-width:760px}.feed h1{margin:0 0 18px;font-size:24px}.card{margin-bottom:14px;padding:18px;border:1px solid #e1e5e9;border-radius:16px;background:white}.thumb{height:170px;border-radius:12px;background:#d6dfd9}.card strong{display:block;margin-top:11px}
  .shorts-row{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.short{height:240px;border-radius:15px;background:#456b59;color:white;padding:15px;display:flex;align-items:end;font-weight:800}.reelless-note{padding:25px;border:2px dashed #66bdaa;border-radius:16px;background:#e9faf6;color:#176454;font-weight:800;text-align:center}
`;

async function setState(worker, enabled = true) {
  await worker.evaluate(async ({ enabled }) => {
    const stored = await chrome.storage.local.get("settingsV2");
    const settings = ReelLess.normalizeSettings(stored.settingsV2 || ReelLess.getDefaultSettings());
    settings.protectionEnabled = enabled;
    settings.pausedUntil = null;
    settings.schedulePreset = "always";
    settings.platforms.youtube.mode = "shortform";
    settings.platforms.instagram.mode = "shortform";
    settings.platforms.facebook.mode = "shortform";
    settings.platforms.tiktok.mode = "all";
    await chrome.storage.local.set({
      settingsV2: settings,
      statsV1: { localDay: new Date().toLocaleDateString("en-CA"), todayCount: 12, totalCount: 146 }
    });
  }, { enabled });
  await new Promise((resolve) => setTimeout(resolve, 180));
}

async function screenshotUrl(url, routePattern, body, destination, viewport = { width: 640, height: 720 }) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.route(routePattern, (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body }));
  await page.goto(url);
  await page.waitForTimeout(300);
  await page.screenshot({ path: destination });
  await page.close();
}

async function compose(destination, title, panels, widths) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  const images = panels.map((panel) => `data:image/png;base64,${fs.readFileSync(panel.path).toString("base64")}`);
  const columns = widths || panels.map(() => "1fr");
  await page.setContent(`<!doctype html><style>*{box-sizing:border-box}html,body{width:1280px;height:800px;overflow:hidden}body{margin:0;padding:28px 32px 32px;background:#1f2421;color:#edf0ed;font-family:"Segoe UI",Arial,sans-serif}header{height:56px;display:flex;align-items:flex-start;justify-content:space-between}h1{margin:0;font-size:27px;font-weight:650;letter-spacing:-.03em}header span{color:#aeb9b2;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}.panels{height:684px;display:grid;grid-template-columns:${columns.join(" ")};gap:14px}.panel{position:relative;overflow:hidden;border:1px solid #3c4540;border-radius:8px;background:#282e2a}.panel b{position:absolute;bottom:14px;left:14px;z-index:2;padding:7px 10px;border:1px solid #4d5751;border-radius:5px;background:#282e2a;color:#edf0ed;font-size:11px}.panel img{width:100%;height:100%;object-fit:cover;object-position:left top}</style><header><h1>${title}</h1><span>Real ReelLess UI</span></header><div class="panels">${panels.map((panel, index) => `<div class="panel"><b>${panel.label}</b><img src="${images[index]}"></div>`).join("")}</div>`);
  await page.screenshot({ path: destination });
  await page.close();
}

try {
  fs.mkdirSync(output, { recursive: true });
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: process.env.REELLESS_HEADLESS === "1",
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`, "--no-first-run", "--no-default-browser-check"]
  });
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15000 });
  const id = new URL(worker.url()).host;
  await setState(worker, true);

  // 1. Actual popup with seeded local-only counters.
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 1280, height: 800 });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.addStyleTag({ content: "html,body{width:1280px!important;height:800px!important;overflow:hidden!important}body{display:grid;place-items:center;background:#1f2421}.shell{width:370px;transform:scale(1.24);box-shadow:0 10px 28px rgba(0,0,0,.22);border:1px solid #3c4540;border-radius:9px;background:#1f2421}" });
  await popup.screenshot({ path: path.join(output, "01-popup.png") });
  await popup.close();

  // 2. Real YouTube guard fixture before and after enabling protection.
  const ytBody = `<meta charset="utf-8"><style>${fixtureStyle}</style><div class="bar"><span class="brand">YouTube fixture</span><span class="search">Search</span></div><main><div class="layout"><nav class="nav"><a href="/">Home</a><a href="/shorts/abc">Shorts</a><a href="/feed/subscriptions">Subscriptions</a></nav><section class="feed"><h1>Recommended</h1><ytd-reel-shelf-renderer><div class="shorts-row"><a href="/shorts/a" class="short">Quick clip</a><a href="/shorts/b" class="short">One more</a><a href="/shorts/c" class="short">Keep scrolling</a></div></ytd-reel-shelf-renderer><div class="reelless-note">Shorts shelf removed - useful videos remain below</div><div class="card"><div class="thumb"></div><strong>Long-form study session</strong></div></section></div></main>`;
  const ytBefore = path.join(scratch, "yt-before.png");
  const ytAfter = path.join(scratch, "yt-after.png");
  await setState(worker, false);
  await screenshotUrl("https://www.youtube.com/watch?v=fixture", "https://www.youtube.com/**", ytBody.replace('<div class="reelless-note">Shorts shelf removed - useful videos remain below</div>', ""), ytBefore);
  await setState(worker, true);
  await screenshotUrl("https://www.youtube.com/watch?v=fixture", "https://www.youtube.com/**", ytBody, ytAfter);
  await compose(path.join(output, "02-youtube-before-after.png"), "YouTube without the Shorts detour", [{ label: "Before", path: ytBefore }, { label: "With ReelLess", path: ytAfter }]);

  // 3. Actual Instagram and Facebook guards on representative desktop fixtures.
  const ig = path.join(scratch, "instagram.png");
  const fb = path.join(scratch, "facebook.png");
  const socialBody = (name, reelPath) => `<style>${fixtureStyle}</style><div class="bar"><span class="brand">${name} fixture</span><span class="search">Search</span></div><main><div class="layout"><nav class="nav"><a href="/">Home</a><a href="${reelPath}">Reels</a><a href="/messages">Messages</a></nav><section class="feed"><h1>Your feed</h1><article class="card"><a href="${reelPath}"><div class="short">Reel preview</div></a></article><div class="reelless-note">Reels entry points removed locally</div><article class="card"><div class="thumb"></div><strong>Normal feed post remains</strong></article></section></div></main>`;
  await screenshotUrl("https://www.instagram.com/", "https://www.instagram.com/**", socialBody("Instagram", "/reel/fixture"), ig);
  await screenshotUrl("https://www.facebook.com/", "https://www.facebook.com/**", socialBody("Facebook", "/reels/fixture"), fb);
  await compose(path.join(output, "03-instagram-facebook.png"), "Reels links disappear; useful sections remain", [{ label: "Instagram", path: ig }, { label: "Facebook", path: fb }]);

  // 4. Actual Advanced settings with optional access language visible.
  const advanced = await context.newPage();
  await advanced.setViewportSize({ width: 1280, height: 800 });
  await advanced.goto(`chrome-extension://${id}/options.html`);
  await advanced.locator("details.advanced > summary").click();
  await advanced.locator("#moreSitesTitle").scrollIntoViewIfNeeded();
  await advanced.addStyleTag({ content: "::-webkit-scrollbar{display:none}" });
  await advanced.screenshot({ path: path.join(output, "04-advanced-settings.png") });
  await advanced.close();

  // 5. Actual focus screen beside the actual counted-attempt popup.
  const focus = path.join(scratch, "focus.png");
  await screenshotUrl("https://www.tiktok.com/", "https://www.tiktok.com/**", `<style>${fixtureStyle}</style><main><h1>TikTok fixture</h1></main>`, focus, { width: 820, height: 720 });
  const miniPopup = path.join(scratch, "popup.png");
  const countPage = await context.newPage();
  await countPage.setViewportSize({ width: 460, height: 720 });
  await countPage.goto(`chrome-extension://${id}/popup.html`);
  await countPage.waitForSelector(".shell");
  await countPage.addStyleTag({ content: "html,body{width:460px!important;height:720px!important;overflow:hidden!important}body{display:grid;place-items:center;background:#1f2421}.shell{width:370px}" });
  await countPage.screenshot({ path: miniPopup });
  await countPage.close();
  await compose(path.join(output, "05-focus-count.png"), "A blocked page and local counts", [{ label: "TikTok focus screen", path: focus }, { label: "Local counts", path: miniPopup }], ["1.55fr", ".85fr"]);

  // Small promotional tile, rendered from the same brand/UI palette.
  const promo = await context.newPage();
  await promo.setViewportSize({ width: 440, height: 280 });
  await promo.setContent(`<!doctype html><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#1b211d;color:#edf1ed;font-family:"Segoe UI",Arial,sans-serif}.top{display:flex;align-items:center;gap:12px}.top img{width:48px;height:48px;border-radius:8px}.top strong{font-size:21px}h1{max-width:350px;margin:29px 0 12px;font-size:31px;font-weight:680;line-height:1;letter-spacing:-.045em}p{margin:0;color:#b7c2ba;font-size:13px}.pill{position:absolute;right:24px;bottom:22px;padding:7px 10px;border:1px solid #486a57;border-radius:999px;color:#aad0b8;font-size:10px;font-weight:800;letter-spacing:.06em}</style><div class="top"><img src="data:image/png;base64,${fs.readFileSync(path.join(root, "icons", "icon-128.png")).toString("base64")}"><strong>ReelLess</strong></div><h1>Keep the useful parts.</h1><p>Shorts & Reels blocker for Chrome</p><span class="pill">LOCAL ONLY</span>`);
  await promo.screenshot({ path: path.join(output, "promo-440x280.png") });
  await promo.close();

  // Optional Store marquee using the same palette and message as the product UI.
  const marquee = await context.newPage();
  await marquee.setViewportSize({ width: 1400, height: 560 });
  await marquee.setContent(`<!doctype html><style>*{box-sizing:border-box}body{display:grid;grid-template-columns:1.1fr .9fr;gap:60px;align-items:center;width:1400px;height:560px;margin:0;padding:68px 96px;background:#1b211d;color:#edf1ed;font-family:"Segoe UI",Arial,sans-serif}.brand{display:flex;align-items:center;gap:13px;font-size:22px;font-weight:750}.brand img{width:52px;height:52px;border-radius:10px}h1{max-width:620px;margin:30px 0 16px;font-size:58px;font-weight:680;line-height:.97;letter-spacing:-.06em}p{max-width:520px;margin:0;color:#b7c2ba;font-size:18px;line-height:1.5}.card{padding:24px;border:1px solid #405148;border-radius:14px;background:#242c27}.status{display:flex;align-items:center;gap:9px;padding-bottom:18px;border-bottom:1px solid #3b4941;font-size:14px;font-weight:700}.dot{width:9px;height:9px;border-radius:50%;background:#4c9a77}.counts{display:grid;grid-template-columns:1fr 1fr;margin:18px 0;border-bottom:1px solid #3b4941}.counts div{padding:0 0 17px}.counts div+div{padding-left:18px;border-left:1px solid #3b4941}.counts strong,.counts span{display:block}.counts strong{font-size:29px}.counts span{margin-top:5px;color:#afbbb2;font-size:11px}.sites{display:grid;gap:8px}.site{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #35433b;font-size:12px}.site b{color:#aad4ba}</style><div><div class="brand"><img src="data:image/png;base64,${fs.readFileSync(path.join(root, "icons", "icon-128.png")).toString("base64")}"><span>ReelLess</span></div><h1>Keep the useful parts. Lose the endless video.</h1><p>Short-form protection for YouTube, Instagram, Facebook, and TikTok.</p></div><div class="card"><div class="status"><span class="dot"></span><span>Protection is active</span></div><div class="counts"><div><strong>12</strong><span>blocked today</span></div><div><strong>146</strong><span>since install</span></div></div><div class="sites"><div class="site"><span>YouTube Shorts</span><b>On</b></div><div class="site"><span>Instagram Reels</span><b>On</b></div><div class="site"><span>Facebook Reels</span><b>On</b></div><div class="site"><span>TikTok feeds</span><b>On</b></div></div></div>`);
  await marquee.screenshot({ path: path.join(output, "marquee-1400x560.png") });
  await marquee.close();

  fs.copyFileSync(path.join(output, "01-popup.png"), path.join(output, "screenshot-1280x800.png"));
  console.log("Created five verified 1280×800 listing screenshots, a 440×280 promo tile, and a 1400×560 marquee tile.");
} finally {
  if (context) await context.close();
  if (profile.startsWith(os.tmpdir())) fs.rmSync(profile, { recursive: true, force: true });
  if (scratch.startsWith(os.tmpdir())) fs.rmSync(scratch, { recursive: true, force: true });
}
