import fs from "node:fs";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const sharedSource = fs.readFileSync(new URL("../shared.js", import.meta.url), "utf8");
const guardSource = fs.readFileSync(new URL("../site_guard.js", import.meta.url), "utf8");
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fixture({ url, html, settings }) {
  const messages = [];
  const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true });
  dom.window.HTMLMediaElement.prototype.pause = () => {};
  dom.window.chrome = {
    storage: {
      local: { get: async () => ({ settingsV2: settings }) },
      onChanged: { addListener() {} }
    },
    runtime: {
      sendMessage: async (message) => { messages.push(message); return { ok: true }; },
      openOptionsPage() {}
    }
  };
  dom.window.eval(sharedSource);
  dom.window.eval(guardSource);
  await wait(180);
  return { dom, document: dom.window.document, messages };
}

const defaults = (await import("../shared.js")).default.getDefaultSettings();
const shared = (await import("../shared.js")).default;

// YouTube: known Shorts shelf is hidden while the surrounding main layout and normal video remain.
let result = await fixture({
  url: "https://www.youtube.com/watch?v=useful",
  settings: defaults,
  html: `<main id="main"><ytd-reel-shelf-renderer id="shorts"><a href="/shorts/abc">Shorts</a></ytd-reel-shelf-renderer><ytd-rich-item-renderer id="normal"><a href="/watch?v=lesson">Lesson</a></ytd-rich-item-renderer></main>`
});
assert.equal(result.document.getElementById("shorts").dataset.reellessHidden, "true");
assert.equal(result.document.getElementById("normal").hasAttribute("data-reelless-hidden"), false);
assert.equal(result.document.getElementById("main").hasAttribute("data-reelless-hidden"), false);
result.dom.window.close();

// Direct-message pages are intentionally outside ReelLess protection and remain untouched.
result = await fixture({
  url: "https://www.instagram.com/direct/t/friend",
  settings: defaults,
  html: `<main id="main"><article><button id="play-video" aria-label="Play video">Play</button><video id="friend-video"></video><p>Friend message</p></article></main>`
});
const playControl = result.document.getElementById("play-video");
assert.equal(playControl.dispatchEvent(new result.dom.window.Event("pointerdown", { bubbles: true, cancelable: true })), true, "Direct video controls must not be intercepted");
assert.equal(result.document.getElementById("friend-video").hasAttribute("data-reelless-direct-video"), false);
assert.equal(result.document.getElementById("main").hasAttribute("data-reelless-hidden"), false);
assert.equal(result.document.getElementById("reelless-direct-blocked-notice"), null);
assert.equal(result.messages.filter((message) => message.type === "recordBlockAttempt").length, 0);
result.dom.window.close();

// Messenger conversations are likewise not modified or counted.
result = await fixture({
  url: "https://www.messenger.com/t/friend",
  settings: defaults,
  html: `<main id="main"><div role="article"><video id="friend-video"></video><p>Friend message</p></div></main>`
});
assert.equal(result.document.getElementById("friend-video").hasAttribute("data-reelless-direct-video"), false);
assert.equal(result.document.getElementById("main").hasAttribute("data-reelless-hidden"), false);
assert.equal(result.messages.filter((message) => message.type === "recordBlockAttempt").length, 0);
result.dom.window.close();

// Instagram: changed markup still hides only the small Reel card, never role=main.
result = await fixture({
  url: "https://www.instagram.com/",
  settings: defaults,
  html: `<main role="main" id="main"><div role="list"><div role="listitem" id="reel-card"><a href="/reel/xyz">Reel</a></div><div role="listitem" id="photo-card"><a href="/p/photo">Photo</a></div></div></main>`
});
assert.equal(result.document.getElementById("reel-card").dataset.reellessHidden, "true");
assert.equal(result.document.getElementById("photo-card").hasAttribute("data-reelless-hidden"), false);
assert.equal(result.document.getElementById("main").hasAttribute("data-reelless-hidden"), false);
result.document.querySelector("#photo-card a").setAttribute("href", "/reel/changed-in-place");
await wait(180);
assert.equal(result.document.getElementById("photo-card").dataset.reellessHidden, "true");
result.dom.window.close();

// Ultimate Lock removes the focus screen's pause action.
result = await fixture({
  url: "https://www.tiktok.com/",
  settings: (await import("../shared.js")).default.createUltimateSettings(defaults, "block_shortform"),
  html: `<main><h1>TikTok fixture</h1></main>`
});
assert.ok(result.document.getElementById("reelless-focus-screen"));
assert.equal(result.document.querySelector('[data-action="pause"]'), null);
result.dom.window.close();

// Facebook: a dynamically inserted SPA Reel entry is found by the debounced observer.
result = await fixture({
  url: "https://www.facebook.com/",
  settings: defaults,
  html: `<main id="main"><a href="/friends">Friends</a><section id="spa"></section></main>`
});
result.document.getElementById("spa").innerHTML = `<article id="late-reel"><a href="/reels/123">Late Reel</a></article>`;
await wait(180);
assert.equal(result.document.getElementById("late-reel").dataset.reellessHidden, "true");
assert.equal(result.document.getElementById("main").hasAttribute("data-reelless-hidden"), false);
result.dom.window.close();

// TikTok: utility sections remain available while feed links are removed in selected mode.
const tiktokUtility = JSON.parse(JSON.stringify(defaults));
tiktokUtility.platforms.tiktok = {
  mode: "selected",
  sections: { feed: true, videos: true, messages: false, upload: false, settings: false }
};
result = await fixture({
  url: "https://www.tiktok.com/messages",
  settings: tiktokUtility,
  html: `<main id="main"><nav><a id="feed-link" href="/foryou">For You</a><a id="messages-link" href="/messages">Messages</a></nav></main>`
});
assert.equal(result.document.getElementById("feed-link").dataset.reellessHidden, "true");
assert.equal(result.document.getElementById("messages-link").hasAttribute("data-reelless-hidden"), false);
assert.equal(result.document.getElementById("reelless-focus-screen"), null);
result.dom.window.close();

// Default TikTok navigation uses the calm in-page focus screen and counts one deliberate attempt.
result = await fixture({
  url: "https://www.tiktok.com/",
  settings: defaults,
  html: `<main><h1>TikTok fixture</h1></main>`
});
assert.ok(result.document.getElementById("reelless-focus-screen"));
assert.equal(result.messages.filter((message) => message.type === "recordBlockAttempt").length, 1);
result.dom.window.close();

// Every optional platform is checked offline against its configured short-form route. This
// proves both the entry-point guard and direct-navigation focus screen without using accounts.
const advancedFixtures = [
  { id: "x", home: "https://x.com/home", short: "https://x.com/video/fixture" },
  { id: "reddit", home: "https://www.reddit.com/", short: "https://www.reddit.com/r/videos/fixture" },
  { id: "snapchat", home: "https://www.snapchat.com/", short: "https://www.snapchat.com/spotlight/fixture" },
  { id: "twitch", home: "https://www.twitch.tv/", short: "https://www.twitch.tv/clips/fixture" },
  { id: "pinterest", home: "https://www.pinterest.com/", short: "https://www.pinterest.com/watch/fixture" },
  { id: "linkedin", home: "https://www.linkedin.com/feed/", short: "https://www.linkedin.com/video/fixture" },
  { id: "threads", home: "https://www.threads.net/", short: "https://www.threads.net/media/fixture" }
];

assert.deepEqual(
  advancedFixtures.map((item) => item.id),
  shared.PLATFORMS.filter((platform) => !shared.CORE_PLATFORM_IDS.includes(platform.id)).map((platform) => platform.id),
  "The fixture matrix must cover every optional platform"
);

for (const platformFixture of advancedFixtures) {
  const settings = JSON.parse(JSON.stringify(defaults));
  settings.platforms[platformFixture.id].mode = "shortform";

  result = await fixture({
    url: platformFixture.home,
    settings,
    html: `<main id="main"><article id="blocked-card"><a id="blocked-link" href="${platformFixture.short}">Short video</a></article><article id="useful-card"><a href="/useful">Useful page</a></article></main>`
  });
  const blockedLink = result.document.getElementById("blocked-link");
  assert.equal(result.document.getElementById("blocked-card").dataset.reellessHidden, "true", `${platformFixture.id} should hide its configured short-form entry point`);
  assert.equal(result.document.getElementById("useful-card").hasAttribute("data-reelless-hidden"), false, `${platformFixture.id} should preserve unrelated content`);
  assert.equal(result.document.getElementById("main").hasAttribute("data-reelless-hidden"), false, `${platformFixture.id} must never hide the page main layout`);
  assert.equal(
    blockedLink.dispatchEvent(new result.dom.window.MouseEvent("click", { bubbles: true, cancelable: true })),
    false,
    `${platformFixture.id} should intercept a deliberate short-form click`
  );
  assert.ok(result.document.getElementById("reelless-focus-screen"), `${platformFixture.id} should show the focus screen after an intercepted click`);
  assert.equal(result.messages.filter((message) => message.type === "recordBlockAttempt").length, 1, `${platformFixture.id} should count one deliberate click`);
  result.dom.window.close();

  result = await fixture({
    url: platformFixture.short,
    settings,
    html: "<main id=main><h1>Optional platform fixture</h1></main>"
  });
  assert.ok(result.document.getElementById("reelless-focus-screen"), `${platformFixture.id} should block direct short-form navigation`);
  assert.equal(result.messages.filter((message) => message.type === "recordBlockAttempt").length, 1, `${platformFixture.id} should count one direct navigation`);
  result.dom.window.close();
}

console.log("Core and optional platform DOM, mutation, safety-ancestor, and focus-screen tests passed.");
