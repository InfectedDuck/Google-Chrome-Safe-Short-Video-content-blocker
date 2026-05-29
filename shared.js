(function (root) {
  "use strict";

  const STATIC_RULESET_ID = "shortform_block_rules";
  const CUSTOM_RULE_START = 10000;
  const PRESET_RULE_START = 20000;
  const MAX_CUSTOM_ENTRIES = 50;

  const PRESETS = [
    {
      id: "facebook-reels",
      label: "Facebook Reels",
      entries: ["facebook.com/reel", "facebook.com/reels"]
    },
    {
      id: "snapchat-spotlight",
      label: "Snapchat Spotlight",
      entries: ["snapchat.com/spotlight"]
    },
    {
      id: "reddit-shorts",
      label: "Reddit Shorts",
      entries: ["reddit.com/r/shorts"]
    }
  ];

  const DEFAULT_SETTINGS = {
    schedule: {
      mode: "always",
      customStart: "09:00",
      customEnd: "17:00"
    },
    customEntries: [],
    presets: {}
  };

  function escapeRegex(value) {
    return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }

  function unique(values) {
    return Array.from(new Set(values));
  }

  function defaultPresetSettings() {
    return PRESETS.reduce((result, preset) => {
      result[preset.id] = false;
      return result;
    }, {});
  }

  function normalizeTime(value, fallback) {
    return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
      ? value
      : fallback;
  }

  function normalizeSettings(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const sourceSchedule = source.schedule && typeof source.schedule === "object" ? source.schedule : {};
    const mode = ["always", "work_hours", "custom"].includes(sourceSchedule.mode)
      ? sourceSchedule.mode
      : DEFAULT_SETTINGS.schedule.mode;
    const customEntries = Array.isArray(source.customEntries)
      ? source.customEntries.map((entry) => validateEntry(entry)).filter((result) => result.ok).map((result) => result.value)
      : [];

    return {
      schedule: {
        mode,
        customStart: normalizeTime(sourceSchedule.customStart, DEFAULT_SETTINGS.schedule.customStart),
        customEnd: normalizeTime(sourceSchedule.customEnd, DEFAULT_SETTINGS.schedule.customEnd)
      },
      customEntries: unique(customEntries).slice(0, MAX_CUSTOM_ENTRIES),
      presets: {
        ...defaultPresetSettings(),
        ...(source.presets && typeof source.presets === "object" ? source.presets : {})
      }
    };
  }

  function validateEntry(input) {
    const raw = String(input || "").trim().toLowerCase();

    if (!raw) {
      return { ok: false, error: "Enter a domain or domain/path." };
    }

    if (/[?#*\\\s]/.test(raw)) {
      return { ok: false, error: "Use a plain domain or path without spaces, wildcards, query strings, or hashes." };
    }

    let value = raw;
    if (/^https?:\/\//.test(value)) {
      try {
        const parsed = new URL(value);
        value = `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
      } catch (_error) {
        return { ok: false, error: "That URL could not be read." };
      }
    }

    if (value.includes("://") || value.startsWith("/") || value.includes("//")) {
      return { ok: false, error: "Use a domain like example.com/reels." };
    }

    const slashIndex = value.indexOf("/");
    const rawHost = slashIndex === -1 ? value : value.slice(0, slashIndex);
    const rawPath = slashIndex === -1 ? "" : value.slice(slashIndex);
    const host = rawHost.replace(/^www\./, "");

    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) {
      return { ok: false, error: "Use a valid domain, such as example.com." };
    }

    if (rawPath && !/^\/[a-z0-9._~!$&'()+,;=:@%/-]+$/.test(rawPath)) {
      return { ok: false, error: "Use a simple URL path." };
    }

    const path = rawPath.replace(/\/+$/, "");
    return { ok: true, value: `${host}${path}` };
  }

  function entryToRegexFilter(entry) {
    const slashIndex = entry.indexOf("/");
    const host = slashIndex === -1 ? entry : entry.slice(0, slashIndex);
    const path = slashIndex === -1 ? "" : entry.slice(slashIndex);
    const hostFilter = `([^/]+\\.)?${escapeRegex(host)}`;

    if (!path) {
      return `^https?://${hostFilter}([/?#]|$)`;
    }

    return `^https?://${hostFilter}${escapeRegex(path)}([/?#]|$)`;
  }

  function createRule(id, entry) {
    return {
      id,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: entryToRegexFilter(entry),
        resourceTypes: ["main_frame", "sub_frame"]
      }
    };
  }

  function enabledPresetEntries(settings) {
    return PRESETS
      .filter((preset) => Boolean(settings.presets[preset.id]))
      .flatMap((preset) => preset.entries);
  }

  function buildDynamicRules(settings) {
    const normalized = normalizeSettings(settings);
    const customEntries = unique(normalized.customEntries).slice(0, MAX_CUSTOM_ENTRIES);
    const presetEntries = unique(enabledPresetEntries(normalized));
    const customRules = customEntries.map((entry, index) => createRule(CUSTOM_RULE_START + index, entry));
    const presetRules = presetEntries.map((entry, index) => createRule(PRESET_RULE_START + index, entry));

    return customRules.concat(presetRules);
  }

  function managedRuleIds() {
    const ids = [];

    for (let id = CUSTOM_RULE_START; id < CUSTOM_RULE_START + MAX_CUSTOM_ENTRIES; id += 1) {
      ids.push(id);
    }

    for (let id = PRESET_RULE_START; id < PRESET_RULE_START + 100; id += 1) {
      ids.push(id);
    }

    return ids;
  }

  function toMinutes(value) {
    const parts = value.split(":").map((part) => Number.parseInt(part, 10));
    return parts[0] * 60 + parts[1];
  }

  function isWithinWindow(start, end, date) {
    const current = date.getHours() * 60 + date.getMinutes();
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);

    if (startMinutes === endMinutes) {
      return true;
    }

    if (startMinutes < endMinutes) {
      return current >= startMinutes && current < endMinutes;
    }

    return current >= startMinutes || current < endMinutes;
  }

  function isBlockingActive(schedule, date) {
    const normalized = normalizeSettings({ schedule }).schedule;

    if (normalized.mode === "always") {
      return true;
    }

    if (normalized.mode === "work_hours") {
      return isWithinWindow("09:00", "17:00", date);
    }

    return isWithinWindow(normalized.customStart, normalized.customEnd, date);
  }

  function modeLabel(mode) {
    if (mode === "work_hours") {
      return "Work";
    }

    if (mode === "custom") {
      return "Custom";
    }

    return "Always";
  }

  root.ReelsBlocker = {
    CUSTOM_RULE_START,
    DEFAULT_SETTINGS,
    MAX_CUSTOM_ENTRIES,
    PRESET_RULE_START,
    PRESETS,
    STATIC_RULESET_ID,
    buildDynamicRules,
    entryToRegexFilter,
    isBlockingActive,
    managedRuleIds,
    modeLabel,
    normalizeSettings,
    validateEntry
  };
})(typeof self !== "undefined" ? self : globalThis);
