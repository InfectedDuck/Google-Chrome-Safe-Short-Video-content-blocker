import assert from "node:assert/strict";
import R from "../shared.js";

const at = (year, month, day, hour, minute = 0) => new Date(year, month - 1, day, hour, minute, 0, 0);

// "Always on" is a true always-active state, including both midnight boundaries.
const defaults = R.getDefaultSettings();
assert.equal(R.isScheduleActive(defaults, at(2026, 8, 31, 0, 0)), true);
assert.equal(R.isScheduleActive(defaults, at(2026, 8, 31, 23, 59)), true);
assert.equal(R.isScheduleActive(defaults, at(2026, 9, 1, 0, 0)), true);

// Cross-midnight schedules include the start and exclude the end.
const sleep = R.normalizeSettings({ schedulePreset: "custom", customStart: "22:00", customEnd: "07:00" });
assert.equal(R.isScheduleActive(sleep, at(2026, 8, 31, 21, 59)), false);
assert.equal(R.isScheduleActive(sleep, at(2026, 8, 31, 22, 0)), true);
assert.equal(R.isScheduleActive(sleep, at(2026, 9, 1, 6, 59)), true);
assert.equal(R.isScheduleActive(sleep, at(2026, 9, 1, 7, 0)), false);

// Pauses expire cleanly at their exact boundary.
const pauseEnd = at(2026, 8, 31, 12, 15);
const paused = R.normalizeSettings({ pausedUntil: pauseEnd.toISOString() });
assert.equal(R.isScheduleActive(paused, at(2026, 8, 31, 12, 14)), false);
assert.equal(R.isScheduleActive(paused, pauseEnd), true);
assert.equal(new Date(R.pauseUntil("tomorrow", at(2026, 8, 31, 23, 50))).getTime(), at(2026, 9, 1, 0, 0).getTime());

// v1 settings migrate to the current schema without losing advanced selections or custom entries.
const migrated = R.normalizeSettings({
  globalMode: "custom",
  schedule: { mode: "custom", customStart: "08:10", customEnd: "16:40" },
  platforms: {
    youtube: { mode: "off", sections: { shorts: false } },
    reddit: { mode: "selected", sections: { popular: true, shorts: false } }
  },
  customEntries: ["example.com/reels", "https://www.example.com/reels/", "invalid"]
});
assert.equal(migrated.schemaVersion, 5);
assert.equal(migrated.schedulePreset, "custom");
assert.equal(migrated.customStart, "08:10");
assert.equal(migrated.platforms.youtube.mode, "off");
assert.equal(migrated.platforms.reddit.mode, "selected");
assert.equal(migrated.platforms.reddit.sections.popular, true);
assert.deepEqual(migrated.customEntries, ["example.com/reels"]);
assert.equal(migrated.appearance, "dark", "existing settings receive the dark appearance default");
assert.equal(R.normalizeSettings({ appearance: "light" }).appearance, "light");
assert.equal(R.normalizeSettings({ appearance: "system" }).appearance, "system");
assert.equal(R.normalizeSettings({ appearance: "unknown" }).appearance, "dark");

// v4 settings retain supported choices but lose the retired Direct-message field.
const v4DirectSetting = R.normalizeSettings({
  schemaVersion: 4,
  platforms: {
    instagram: { mode: "selected", sections: { reels: false, explore: true, direct_videos: true } },
    facebook: { mode: "selected", sections: { reels: false, watch: true, marketplace: false, direct_videos: true } }
  }
});
assert.equal(v4DirectSetting.schemaVersion, 5);
assert.deepEqual(v4DirectSetting.platforms.instagram.sections, { reels: false, explore: true });
assert.deepEqual(v4DirectSetting.platforms.facebook.sections, { reels: false, watch: true, marketplace: false });
assert.equal(Object.hasOwn(v4DirectSetting.platforms.instagram.sections, "direct_videos"), false);
assert.equal(typeof R.shouldBlockDirectVideos, "undefined", "The retired Direct-message behavior must not remain public");

// Ultimate Lock forces always-on protection and restores its saved platform snapshot if settings are tampered with.
const ultimate = R.createUltimateSettings(R.normalizeSettings({
  platforms: { instagram: { mode: "off" }, reddit: { mode: "selected", sections: { popular: true } } }
}), "keep_current");
assert.equal(ultimate.ultimate.enabled, true);
assert.equal(ultimate.schedulePreset, "always");
assert.equal(ultimate.platforms.instagram.mode, "off");
const tamperedUltimate = R.normalizeSettings({ ...ultimate, protectionEnabled: false, schedulePreset: "work_hours", platforms: { instagram: { mode: "all" } } });
assert.equal(tamperedUltimate.protectionEnabled, true);
assert.equal(tamperedUltimate.pausedUntil, null);
assert.equal(tamperedUltimate.schedulePreset, "always");
assert.equal(tamperedUltimate.platforms.instagram.mode, "off");
const coreUltimate = R.createUltimateSettings(R.normalizeSettings({ platforms: { youtube: { mode: "off" }, tiktok: { mode: "off" } } }), "block_shortform");
assert.equal(coreUltimate.platforms.youtube.mode, "shortform");
assert.equal(coreUltimate.platforms.tiktok.mode, "all");
assert.equal(R.releaseUltimateSettings(coreUltimate).ultimate.enabled, false);

// Statistics roll over locally without retaining URLs, titles, or history.
assert.deepEqual(R.normalizeStats({ localDay: "2026-08-30", todayCount: 9, totalCount: 41 }, at(2026, 8, 31, 0, 0)), {
  localDay: "2026-08-31", todayCount: 0, totalCount: 41
});
assert.deepEqual(Object.keys(R.normalizeStats({}, at(2026, 8, 31, 0, 0))), ["localDay", "todayCount", "totalCount"]);

// Core URL decisions use navigation guards, not DNR redirects.
assert.equal(R.shouldBlockUrl(defaults, "https://www.youtube.com/shorts/abc").blocked, true);
assert.equal(R.shouldBlockUrl(defaults, "https://www.youtube.com/@study/shorts").blocked, true);
assert.equal(R.shouldBlockUrl(defaults, "https://www.youtube.com/watch?v=abc").blocked, false);
assert.equal(R.shouldBlockUrl(defaults, "https://www.instagram.com/reels/abc").blocked, true);
assert.equal(R.shouldBlockUrl(defaults, "https://www.instagram.com/direct/inbox/").blocked, false);
assert.equal(R.shouldBlockUrl(defaults, "https://www.facebook.com/reel/abc").blocked, true);
assert.equal(R.shouldBlockUrl(defaults, "https://www.tiktok.com/messages").blocked, true);
assert.equal(R.youtubeWatchUrl("https://m.youtube.com/shorts/a_b-9"), "https://m.youtube.com/watch?v=a_b-9");

// TikTok utility sections can be explicitly allowed in Advanced settings.
const utility = R.normalizeSettings({ platforms: { tiktok: { mode: "selected", sections: { feed: true, videos: true, messages: false, upload: false, settings: false } } } });
assert.equal(R.shouldBlockUrl(utility, "https://www.tiktok.com/").blocked, true);
assert.equal(R.shouldBlockUrl(utility, "https://www.tiktok.com/messages").blocked, false);

// DNR is block-only and limited to custom entries with an explicitly granted origin.
const custom = R.normalizeSettings({ customEntries: ["example.com/reels", "another.test"] });
const rules = R.buildDynamicRules(custom, ["example.com/reels"], at(2026, 8, 31, 12));
assert.equal(rules.length, 1);
assert.equal(rules[0].action.type, "block");
assert.equal(new RegExp(rules[0].condition.regexFilter).test("https://example.com/reels/123"), true);
assert.equal(new RegExp(rules[0].condition.regexFilter).test("https://example.com/home"), false);
assert.equal(new RegExp(rules[0].condition.regexFilter).test("https://www.example.com/reels/123"), false);
assert.equal(R.permissionPatternForEntry("example.com/reels"), "*://example.com/*");

// Review eligibility is neutral, delayed, and permanently dismissible.
const eligibleDate = at(2026, 8, 31, 12);
assert.equal(R.reviewEligible({ activeDayCount: 7 }, { localDay: R.localDay(eligibleDate), todayCount: 10, totalCount: 10 }, eligibleDate), true);
assert.equal(R.reviewEligible({ activeDayCount: 30, reviewDismissed: true }, { totalCount: 100 }, eligibleDate), false);

console.log("Shared schema, schedule, URL, counter, and rule tests passed.");
