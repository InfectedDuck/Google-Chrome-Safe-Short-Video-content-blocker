import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const extensionPath = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const candidates = [
  process.env.REELLESS_CHROME_PATH,
  chromium.executablePath(),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable"
].filter(Boolean);
const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
if (!executablePath) throw new Error("Chrome for Testing was not found. Run: npx playwright-core install chromium");

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "reelless-smoke-"));
const browserErrors = [];
let context;

function observePage(page) {
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
}

try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    // Chrome does not load unpacked extensions reliably in its regular headless mode.
    // Set REELLESS_HEADLESS=1 only on a runner whose Chrome build supports extensions there.
    headless: process.env.REELLESS_HEADLESS === "1",
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });
  context.on("page", observePage);
  context.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`context console: ${message.text()}`);
  });
  context.on("weberror", (error) => browserErrors.push(`web error: ${error.error().message}`));
  context.pages().forEach(observePage);

  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15000 });
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, "extension service worker should have an id");

  const popup = await context.newPage();
  observePage(popup);
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForSelector("text=Protected sites");
  assert.equal(await popup.locator(".platform-row").count(), 4);
  assert.equal(await popup.locator("#statusText").textContent(), "Protection is active");

  const settings = await context.newPage();
  observePage(settings);
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await settings.waitForSelector("text=Core protection");
  assert.equal(await settings.locator("#corePlatforms .platform-card").count(), 4);
  assert.equal(await settings.locator("#advancedPlatforms .advanced-platform").count(), 7);
  assert.equal(await settings.locator("details.advanced").getAttribute("open"), null, "Advanced controls should start collapsed");
  assert.equal(await settings.locator(".advanced-summary-action").count(), 1, "Advanced controls should have a visible disclosure affordance");
  assert.equal(await settings.locator(".advanced-chevron").count(), 1, "Advanced controls should show a state chevron");
  assert.equal(await settings.locator("input[data-direct-toggle]").count(), 0, "Retired Direct-video controls must not appear in Settings");
  assert.equal(await settings.locator("#ultimateSetup").isVisible(), true, "Ultimate Lock setup should be visible before enabling it");
  assert.equal(await settings.locator("#ultimateRelease").isHidden(), true, "Ultimate Lock removal controls must stay hidden before enabling it");
  assert.equal(await settings.locator("#appearance").inputValue(), "dark", "dark should be the default appearance");
  await settings.selectOption("#appearance", "light");
  await settings.waitForFunction(() => document.documentElement.dataset.theme === "light");
  await settings.selectOption("#appearance", "dark");
  await settings.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await settings.waitForTimeout(300);
  await settings.locator("details.advanced > summary").click();
  assert.equal(await settings.locator("details.advanced").getAttribute("open"), "", "Advanced controls should open from the full disclosure row");
  await settings.selectOption("#schedulePreset", "custom");
  await settings.fill("#customStart", "22:00");
  await settings.fill("#customEnd", "07:00");
  await settings.waitForTimeout(300);
  await settings.selectOption("#schedulePreset", "always");
  await settings.waitForTimeout(300);

  const youtube = await context.newPage();
  observePage(youtube);
  await youtube.route("https://www.youtube.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: `<main id="main"><ytd-reel-shelf-renderer id="shorts"><a href="/shorts/abc">Shorts</a></ytd-reel-shelf-renderer><a id="lesson" href="/watch?v=lesson">Lesson</a></main>`
  }));
  await youtube.goto("https://www.youtube.com/watch?v=fixture");
  await youtube.waitForFunction(() => document.querySelector("#shorts")?.dataset.reellessHidden === "true");
  assert.equal(await youtube.locator("#main").getAttribute("data-reelless-hidden"), null);
  await youtube.goto("https://www.youtube.com/shorts/directfixture");
  await youtube.waitForURL("https://www.youtube.com/watch?v=directfixture");

  const instagram = await context.newPage();
  observePage(instagram);
  await instagram.route("https://www.instagram.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<main>Instagram fixture</main>" }));
  await instagram.goto("https://www.instagram.com/reel/directfixture");
  await instagram.waitForURL("https://www.instagram.com/");

  const instagramDirect = await context.newPage();
  observePage(instagramDirect);
  await instagramDirect.route("https://www.instagram.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<main id=conversation><p>Friend message</p><button id=playVideo aria-label='Play video'>Play</button><video id=friendVideo controls></video></main>"
  }));
  await instagramDirect.goto("https://www.instagram.com/direct/t/friend");
  await instagramDirect.waitForTimeout(250);
  assert.equal(await instagramDirect.locator("#friendVideo").getAttribute("data-reelless-direct-video"), null, "Direct-message videos must remain outside ReelLess protection");
  assert.equal(await instagramDirect.locator("#conversation").getAttribute("data-reelless-hidden"), null, "direct conversation layout must remain");
  assert.equal(await instagramDirect.locator("#reelless-direct-blocked-notice").count(), 0);

  const facebook = await context.newPage();
  observePage(facebook);
  await facebook.route("https://www.facebook.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<main>Facebook fixture</main>" }));
  await facebook.goto("https://www.facebook.com/reel/directfixture");
  await facebook.waitForURL("https://www.facebook.com/");

  const messenger = await context.newPage();
  observePage(messenger);
  await messenger.route("https://www.messenger.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<main id=conversation><p>Friend message</p><video id=friendVideo controls></video></main>"
  }));
  await messenger.goto("https://www.messenger.com/t/friend");
  await messenger.waitForTimeout(250);
  assert.equal(await messenger.locator("#friendVideo").getAttribute("data-reelless-direct-video"), null, "Messenger videos must remain outside ReelLess protection");
  assert.equal(await messenger.locator("#conversation").getAttribute("data-reelless-hidden"), null, "Messenger conversation layout must remain");

  const tiktok = await context.newPage();
  observePage(tiktok);
  await tiktok.route("https://www.tiktok.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<main><h1>TikTok fixture</h1></main>"
  }));
  await tiktok.goto("https://www.tiktok.com/");
  await tiktok.waitForSelector("#reelless-focus-screen");
  assert.match(await tiktok.locator("#reelless-focus-title").textContent(), /TikTok is outside your focus plan/i);

  await settings.selectOption("#ultimateProfile", "keep_current");
  await settings.fill("#ultimateConfirmPhrase", "I ACCEPT THE LOCK");
  await settings.locator("#enableUltimate").click();
  await settings.waitForSelector("#ultimateRelease:not([hidden])");
  assert.equal(await settings.locator("#ultimateSetup").isHidden(), true, "Ultimate setup must be hidden while the lock is active");
  assert.equal(await settings.locator("#ultimateRelease").isVisible(), true, "Ultimate removal controls should appear only while the lock is active");
  assert.equal(await settings.locator("#protectionEnabled").isDisabled(), true, "Ultimate Lock disables normal protection controls");
  assert.equal(await settings.locator("#confirmUnlock").isDisabled(), true, "Ultimate removal begins with a disabled confirmation");
  await popup.reload();
  await popup.waitForSelector("#ultimateNotice:not([hidden])");
  assert.match(await popup.locator("#statusText").textContent(), /Ultimate Lock (is )?active/);
  assert.equal(await popup.locator("#pauseButton").isDisabled(), true, "Ultimate Lock disables popup pauses");

  await tiktok.reload();
  await tiktok.waitForSelector("#reelless-focus-screen");
  assert.equal(await tiktok.locator('[data-action="pause"]').count(), 0, "Ultimate Lock removes the focus-screen pause action");

  const runtimeState = await worker.evaluate(async () => {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const scripts = await chrome.scripting.getRegisteredContentScripts();
    return { rules, scripts };
  });
  assert.equal(runtimeState.rules.length, 0, "no ungranted custom DNR rules should exist");
  assert.equal(runtimeState.scripts.length, 0, "no ungranted Advanced guards should exist");

  assert.deepEqual(browserErrors, [], browserErrors.join("\n"));
  console.log(`Chrome extension smoke tests passed (${extensionId}).`);
} finally {
  if (context) await context.close();
  if (profile.startsWith(os.tmpdir())) fs.rmSync(profile, { recursive: true, force: true });
}
