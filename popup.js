(function () {
  "use strict";

  const RB = self.ReelsBlocker;
  const SETTINGS_KEY = "settings";

  function storageGet(defaults) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(defaults, (result) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(result);
      });
    });
  }

  function setText(id, text) {
    document.getElementById(id).textContent = text;
  }

  async function render() {
    const result = await storageGet({ [SETTINGS_KEY]: RB.DEFAULT_SETTINGS });
    const settings = RB.normalizeSettings(result[SETTINGS_KEY]);
    const active = RB.isBlockingActive(settings.schedule, new Date());
    const enabledPresets = RB.PRESETS.filter((preset) => Boolean(settings.presets[preset.id])).length;

    setText("activeStatus", active ? "Blocking is active" : "Schedule is paused");
    setText("modeLabel", RB.modeLabel(settings.schedule.mode));
    setText("customCount", String(settings.customEntries.length));
    setText("presetCount", String(enabledPresets));
  }

  document.getElementById("openOptions").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  render().catch(() => {
    setText("activeStatus", "Open settings to refresh");
  });
})();
