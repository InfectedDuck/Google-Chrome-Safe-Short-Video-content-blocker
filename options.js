(function () {
  "use strict";

  const RB = self.ReelsBlocker;
  const SETTINGS_KEY = "settings";
  const state = {
    settings: RB.normalizeSettings()
  };

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

  function storageSet(value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(value, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  function sendApplyMessage() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "applySettings" }, () => {
        resolve();
      });
    });
  }

  function setStatus(message) {
    document.getElementById("saveStatus").textContent = message;
  }

  function setEntryError(message) {
    document.getElementById("entryError").textContent = message;
  }

  function readFormSettings() {
    const modeInput = document.querySelector("input[name='mode']:checked");
    const presets = {};

    RB.PRESETS.forEach((preset) => {
      const checkbox = document.querySelector(`[data-preset="${preset.id}"]`);
      presets[preset.id] = Boolean(checkbox && checkbox.checked);
    });

    return RB.normalizeSettings({
      schedule: {
        mode: modeInput ? modeInput.value : "always",
        customStart: document.getElementById("customStart").value,
        customEnd: document.getElementById("customEnd").value
      },
      customEntries: state.settings.customEntries,
      presets
    });
  }

  function renderEntries() {
    const list = document.getElementById("entryList");
    list.textContent = "";

    state.settings.customEntries.forEach((entry) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const button = document.createElement("button");

      label.textContent = entry;
      button.type = "button";
      button.textContent = "x";
      button.setAttribute("aria-label", `Remove ${entry}`);
      button.addEventListener("click", () => {
        state.settings.customEntries = state.settings.customEntries.filter((value) => value !== entry);
        renderEntries();
        setStatus("Unsaved changes");
      });

      item.append(label, button);
      list.append(item);
    });
  }

  function renderPresets() {
    const container = document.getElementById("presetList");
    container.textContent = "";

    RB.PRESETS.forEach((preset) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      const text = document.createElement("span");

      input.type = "checkbox";
      input.dataset.preset = preset.id;
      input.checked = Boolean(state.settings.presets[preset.id]);
      text.textContent = preset.label;
      input.addEventListener("change", () => setStatus("Unsaved changes"));

      label.append(input, text);
      container.append(label);
    });
  }

  function renderSettings() {
    const settings = state.settings;
    const modeInput = document.querySelector(`input[name='mode'][value='${settings.schedule.mode}']`);

    if (modeInput) {
      modeInput.checked = true;
    }

    document.getElementById("customStart").value = settings.schedule.customStart;
    document.getElementById("customEnd").value = settings.schedule.customEnd;
    renderEntries();
    renderPresets();
  }

  async function loadSettings() {
    const result = await storageGet({ [SETTINGS_KEY]: RB.DEFAULT_SETTINGS });
    state.settings = RB.normalizeSettings(result[SETTINGS_KEY]);
    renderSettings();
  }

  document.getElementById("entryForm").addEventListener("submit", (event) => {
    event.preventDefault();

    if (state.settings.customEntries.length >= RB.MAX_CUSTOM_ENTRIES) {
      setEntryError(`You can add up to ${RB.MAX_CUSTOM_ENTRIES} custom entries.`);
      return;
    }

    const input = document.getElementById("entryInput");
    const result = RB.validateEntry(input.value);

    if (!result.ok) {
      setEntryError(result.error);
      return;
    }

    if (state.settings.customEntries.includes(result.value)) {
      setEntryError("That entry is already in the list.");
      return;
    }

    state.settings.customEntries.push(result.value);
    input.value = "";
    setEntryError("");
    setStatus("Unsaved changes");
    renderEntries();
  });

  document.querySelectorAll("input[name='mode'], input[type='time']").forEach((input) => {
    input.addEventListener("change", () => setStatus("Unsaved changes"));
  });

  document.getElementById("saveButton").addEventListener("click", async () => {
    setStatus("Saving...");
    state.settings = readFormSettings();
    await storageSet({ [SETTINGS_KEY]: state.settings });
    await sendApplyMessage();
    setStatus("Saved locally");
  });

  loadSettings().catch((error) => {
    setStatus(error.message);
  });
})();
