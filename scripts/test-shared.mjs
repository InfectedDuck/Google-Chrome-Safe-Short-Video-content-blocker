import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../shared.js", import.meta.url), "utf8");
const sandbox = { self: {}, URL };

vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const RB = sandbox.self.ReelsBlocker;

assert.equal(RB.validateEntry("facebook.com/reel").ok, true);
assert.equal(RB.validateEntry("https://www.facebook.com/reel/").value, "facebook.com/reel");
assert.equal(RB.validateEntry("facebook.com/reel?tracked=1").ok, false);
assert.equal(RB.validateEntry("*.example.com").ok, false);
assert.equal(RB.validateEntry("example").ok, false);

const settings = RB.normalizeSettings({
  customEntries: ["facebook.com/reel", "facebook.com/reel", "https://www.snapchat.com/spotlight/"],
  presets: { "reddit-shorts": true },
  schedule: { mode: "custom", customStart: "22:00", customEnd: "06:00" }
});

assert.equal(JSON.stringify(settings.customEntries), JSON.stringify(["facebook.com/reel", "snapchat.com/spotlight"]));
assert.equal(RB.buildDynamicRules(settings).length, 3);
assert.equal(RB.isBlockingActive(settings.schedule, new Date("2026-05-29T23:00:00")), true);
assert.equal(RB.isBlockingActive(settings.schedule, new Date("2026-05-29T12:00:00")), false);
assert.equal(RB.isBlockingActive({ mode: "work_hours" }, new Date("2026-05-29T10:00:00")), true);

console.log("Shared logic tests passed.");
