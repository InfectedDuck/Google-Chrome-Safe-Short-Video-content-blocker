import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const sharedSource = fs.readFileSync(new URL("../shared.js", import.meta.url), "utf8");
const workerSource = fs.readFileSync(new URL("../service_worker.js", import.meta.url), "utf8");
const listeners = { installed: [], startup: [], alarm: [], changed: [], message: [], added: [], removed: [] };
const store = {
  settings: {
    globalMode: "custom",
    platforms: { reddit: { mode: "selected", sections: { popular: true } } },
    customEntries: ["example.com/reels"]
  }
};
const granted = new Set();
let dynamicRules = [{ id: 44, action: { type: "block" }, condition: {} }];
let registered = [];

function pick(keys) {
  if (typeof keys === "string") return { [keys]: store[keys] };
  if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, store[key]]));
  return { ...store };
}

const chrome = {
  runtime: {
    id: "test-extension-id",
    getURL: (path) => `chrome-extension://test-extension-id/${path}`,
    onInstalled: { addListener: (fn) => listeners.installed.push(fn) },
    onStartup: { addListener: (fn) => listeners.startup.push(fn) },
    onMessage: { addListener: (fn) => listeners.message.push(fn) }
  },
  tabs: { create: async () => ({}) },
  storage: {
    local: {
      get: async (keys) => pick(keys),
      set: async (values) => Object.assign(store, JSON.parse(JSON.stringify(values)))
    },
    onChanged: { addListener: (fn) => listeners.changed.push(fn) }
  },
  alarms: {
    create: async () => {},
    onAlarm: { addListener: (fn) => listeners.alarm.push(fn) }
  },
  permissions: {
    contains: async ({ origins }) => origins.every((origin) => granted.has(origin)),
    onAdded: { addListener: (fn) => listeners.added.push(fn) },
    onRemoved: { addListener: (fn) => listeners.removed.push(fn) }
  },
  declarativeNetRequest: {
    getDynamicRules: async () => dynamicRules,
    updateDynamicRules: async ({ removeRuleIds, addRules }) => {
      dynamicRules = dynamicRules.filter((rule) => !removeRuleIds.includes(rule.id)).concat(JSON.parse(JSON.stringify(addRules)));
    }
  },
  scripting: {
    getRegisteredContentScripts: async () => registered,
    registerContentScripts: async (scripts) => { registered.push(...JSON.parse(JSON.stringify(scripts))); },
    unregisterContentScripts: async ({ ids }) => { registered = registered.filter((item) => !ids.includes(item.id)); }
  }
};

const sandbox = { chrome, console, setTimeout, clearTimeout, Date, URL };
sandbox.globalThis = sandbox;
sandbox.importScripts = (path) => {
  assert.equal(path, "shared.js");
  vm.runInContext(sharedSource, sandbox);
};

vm.createContext(sandbox);
vm.runInContext(workerSource, sandbox);
await new Promise((resolve) => setTimeout(resolve, 20));

assert.equal(listeners.message.length, 1);
assert.equal(store.settingsV2.schemaVersion, 5, "v1 settings should migrate to the current schema");
assert.equal(store.settingsV2.platforms.reddit.mode, "selected");
assert.equal(dynamicRules.length, 0, "denied custom permission must fail safely");
assert.equal(registered.length, 0, "denied advanced permission must not register a guard");

function message(payload) {
  return new Promise((resolve) => listeners.message[0](payload, {}, resolve));
}

granted.add("*://example.com/*");
for (const origin of sandbox.ReelLess.platformById("reddit").permissionPatterns) granted.add(origin);
let response = await message({ type: "applySettings" });
assert.equal(response.ok, true);
assert.equal(dynamicRules.length, 1);
assert.equal(dynamicRules[0].action.type, "block");
assert.equal(registered.some((item) => item.id === "reelless-advanced-reddit"), true);

const optionalPlatforms = sandbox.ReelLess.PLATFORMS.filter((platform) => !sandbox.ReelLess.CORE_PLATFORM_IDS.includes(platform.id));
for (const platform of optionalPlatforms) {
  store.settingsV2.platforms[platform.id].mode = "shortform";
  for (const origin of platform.permissionPatterns) granted.add(origin);
}
response = await message({ type: "applySettings" });
assert.equal(response.ok, true);
assert.deepEqual(
  Array.from(registered, (item) => item.id).sort(),
  Array.from(optionalPlatforms, (platform) => `reelless-advanced-${platform.id}`).sort(),
  "Every enabled optional platform with granted access should receive exactly one dynamic guard"
);
for (const platform of optionalPlatforms) {
  const guard = registered.find((item) => item.id === `reelless-advanced-${platform.id}`);
  assert.deepEqual([...guard.matches], [...platform.permissionPatterns], `${platform.id} guard must be restricted to its exact granted origins`);
  assert.deepEqual([...guard.js], ["shared.js", "site_guard.js"]);
  assert.deepEqual([...guard.css], ["site_guard.css"]);
}

store.settingsV2.platforms.x.mode = "off";
response = await message({ type: "applySettings" });
assert.equal(response.ok, true);
assert.equal(registered.some((item) => item.id === "reelless-advanced-x"), false, "A disabled optional platform must remove its guard even when access remains granted");
assert.equal(registered.length, optionalPlatforms.length - 1);

await message({ type: "recordBlockAttempt", eventId: "same-deliberate-attempt" });
await message({ type: "recordBlockAttempt", eventId: "same-deliberate-attempt" });
assert.equal(store.statsV1.totalCount, 1, "duplicate click/navigation event must count once");
assert.deepEqual(Object.keys(store.statsV1), ["localDay", "todayCount", "totalCount"]);

granted.clear();
response = await message({ type: "applySettings" });
assert.equal(response.ok, true);
assert.equal(dynamicRules.length, 0, "custom rules are removed when access is removed");
assert.equal(registered.length, 0, "all advanced guards are removed when optional access is removed");

store.settingsV2 = sandbox.ReelLess.createUltimateSettings(store.settingsV2, "block_shortform");
response = await message({ type: "pause", duration: 15 });
assert.equal(response.ok, true);
assert.equal(response.locked, true, "Ultimate Lock must reject pause requests");
assert.equal(response.settings.pausedUntil, null);

console.log("Service worker migration, optional permission, dynamic guard, counter, and Ultimate Lock tests passed.");
