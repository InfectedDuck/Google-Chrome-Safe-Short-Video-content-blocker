importScripts("shared.js");

const RB = self.ReelsBlocker;
const SETTINGS_KEY = "settings";
const SCHEDULE_ALARM = "apply-schedule";

function chromeCall(api, method, argument) {
  return new Promise((resolve, reject) => {
    const callback = (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    };

    if (typeof argument === "undefined") {
      api[method](callback);
      return;
    }

    api[method](argument, callback);
  });
}

async function getSettings() {
  const result = await chromeCall(chrome.storage.local, "get", { [SETTINGS_KEY]: RB.DEFAULT_SETTINGS });
  return RB.normalizeSettings(result[SETTINGS_KEY]);
}

async function enableStaticRules(enabled) {
  await chromeCall(chrome.declarativeNetRequest, "updateEnabledRulesets", {
    enableRulesetIds: enabled ? [RB.STATIC_RULESET_ID] : [],
    disableRulesetIds: enabled ? [] : [RB.STATIC_RULESET_ID]
  });
}

async function syncDynamicRules(rules) {
  const currentRules = await chromeCall(chrome.declarativeNetRequest, "getDynamicRules");
  const managedIds = new Set(RB.managedRuleIds());
  const removeRuleIds = currentRules.map((rule) => rule.id).filter((id) => managedIds.has(id));

  await chromeCall(chrome.declarativeNetRequest, "updateDynamicRules", {
    removeRuleIds,
    addRules: rules
  });
}

async function ensureScheduleAlarm() {
  await chromeCall(chrome.alarms, "clear", SCHEDULE_ALARM);

  await new Promise((resolve, reject) => {
    chrome.alarms.create(SCHEDULE_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: 1
    }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

async function applySettings() {
  const settings = await getSettings();
  const active = RB.isBlockingActive(settings.schedule, new Date());
  const dynamicRules = active ? RB.buildDynamicRules(settings) : [];

  await enableStaticRules(active);
  await syncDynamicRules(dynamicRules);
  await ensureScheduleAlarm();
}

chrome.runtime.onInstalled.addListener(() => {
  applySettings();
});

chrome.runtime.onStartup.addListener(() => {
  applySettings();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCHEDULE_ALARM) {
    applySettings();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && Object.prototype.hasOwnProperty.call(changes, SETTINGS_KEY)) {
    applySettings();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "applySettings") {
    return false;
  }

  applySettings()
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
