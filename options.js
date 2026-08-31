(async function () {
  "use strict";

  const R = ReelLess;
  const stored = await chrome.storage.local.get([R.SETTINGS_KEY, R.LEGACY_SETTINGS_KEY]);
  let settings = R.normalizeSettings(stored[R.SETTINGS_KEY] || stored[R.LEGACY_SETTINGS_KEY]);
  let saveTimer = null;
  let unlockEnd = 0;
  let unlockInterval = null;

  const coreContainer = document.getElementById("corePlatforms");
  const detailedCoreContainer = document.getElementById("detailedCorePlatforms");
  const advancedContainer = document.getElementById("advancedPlatforms");
  const status = document.getElementById("saveStatus");
  const ultimatePanel = document.getElementById("ultimatePanel");
  const ultimateSetup = document.getElementById("ultimateSetup");
  const ultimateRelease = document.getElementById("ultimateRelease");
  const ultimateFeedback = document.getElementById("ultimateFeedback");
  const appearanceSelect = document.getElementById("appearance");

  function resolvedAppearance() {
    if (settings.appearance === "system") return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    return settings.appearance;
  }

  function applyAppearance() {
    document.documentElement.dataset.theme = resolvedAppearance();
  }

  function modeOptions(selected) {
    return R.PLATFORM_MODES.map((mode) => `<option value="${mode.value}" ${mode.value === selected ? "selected" : ""}>${mode.label}</option>`).join("");
  }

  function markStatus(message, error) {
    status.textContent = message;
    status.style.color = error ? "#ff998b" : "";
  }

  function locked() {
    return Boolean(settings.ultimate && settings.ultimate.enabled);
  }

  function setUltimateFeedback(message, error) {
    ultimateFeedback.textContent = message || "";
    ultimateFeedback.style.color = error ? "#ff998b" : "";
  }

  async function save() {
    clearTimeout(saveTimer);
    settings = R.normalizeSettings(settings);
    markStatus("Saving...");
    await chrome.storage.local.set({ [R.SETTINGS_KEY]: settings });
    await chrome.runtime.sendMessage({ type: "applySettings" }).catch(() => null);
    markStatus(settings.ultimate.enabled ? "Ultimate Lock active" : "Saved locally");
  }

  function queueSave() {
    if (locked()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 180);
  }

  function platformCard(platform) {
    const card = document.createElement("article");
    card.className = "platform-card";
    const checked = settings.platforms[platform.id].mode !== "off";
    const coverage = platform.id === "youtube" ? "Shorts links, shelves, and tabs" : platform.id === "tiktok" ? "For You and video pages" : "Reels links and direct Reel visits";
    card.innerHTML = `<header><span class="platform-mark">${platform.id === "youtube" ? "YT" : platform.id === "instagram" ? "IG" : platform.id === "facebook" ? "FB" : "TT"}</span><strong>${platform.label}</strong></header><p>${coverage}</p><label class="core-toggle"><input type="checkbox" data-core-toggle="${platform.id}" ${checked ? "checked" : ""}><span></span><b>${checked ? "Protected" : "Off"}</b></label>`;
    return card;
  }

  function advancedRow(platform) {
    const row = document.createElement(platform.core ? "article" : "details");
    row.className = `advanced-platform ${platform.core ? "core-mode-card" : "optional-site"}`;
    const choices = platform.sections.map((section) => `<label><input type="checkbox" data-platform="${platform.id}" data-section="${section.id}" ${settings.platforms[platform.id].sections[section.id] ? "checked" : ""}>${section.label}</label>`).join("");
    const permissionState = platform.core ? "" : `<div class="permission-state" data-permission-state="${platform.id}"><span>Checking optional access...</span><button type="button" data-grant="${platform.id}" hidden>Grant access</button></div>`;
    const controls = `<select class="mode-select" data-platform="${platform.id}" aria-label="${platform.label} blocking mode">${modeOptions(settings.platforms[platform.id].mode)}</select><div class="section-choices" ${settings.platforms[platform.id].mode === "selected" ? "" : "hidden"}>${choices}</div>${permissionState}`;
    if (platform.core) {
      row.innerHTML = `<div><strong>${platform.label}</strong><p>Choose a narrower or wider protection mode.</p></div>${controls}`;
    } else {
      const mode = settings.platforms[platform.id].mode;
      row.innerHTML = `<summary><span><strong>${platform.label}</strong><small>${mode === "off" ? "Off — optional access" : R.PLATFORM_MODES.find((item) => item.value === mode).label}</small></span><span class="row-chevron" aria-hidden="true"></span></summary><div class="advanced-platform-body">${controls}</div>`;
    }
    return row;
  }

  function renderPlatforms() {
    coreContainer.textContent = "";
    detailedCoreContainer.textContent = "";
    advancedContainer.textContent = "";
    R.PLATFORMS.forEach((platform) => {
      if (platform.core) {
        coreContainer.appendChild(platformCard(platform));
        detailedCoreContainer.appendChild(advancedRow(platform));
      } else {
        advancedContainer.appendChild(advancedRow(platform));
      }
    });
    refreshPermissionStates();
  }

  function renderCustom() {
    const list = document.getElementById("customList");
    list.textContent = "";
    settings.customEntries.forEach((entry) => {
      const item = document.createElement("li");
      item.innerHTML = `<span>${entry}</span><button type="button" data-remove="${entry}">Remove</button>`;
      list.appendChild(item);
    });
  }

  function renderUltimate() {
    const isLocked = locked();
    document.body.classList.toggle("ultimate-active", isLocked);
    ultimateSetup.hidden = isLocked;
    ultimateRelease.hidden = !isLocked;
    document.getElementById("ultimateDescription").textContent = isLocked
      ? `Ultimate Lock is enforcing: ${settings.ultimate.profile === "block_shortform" ? "all core short-form content" : "your platform choices"}.`
      : "Lock protection to remove in-extension pausing and setting changes. Choose what stays blocked before you turn it on.";

    document.querySelectorAll("main input, main select, main button").forEach((control) => {
      if (ultimatePanel.contains(control)) return;
      control.disabled = isLocked;
    });
    document.querySelector("details.advanced").setAttribute("aria-disabled", String(isLocked));
    if (isLocked) markStatus("Ultimate Lock active");
  }

  function renderAll() {
    const preset = document.getElementById("schedulePreset");
    preset.innerHTML = R.SCHEDULE_PRESETS.map((item) => `<option value="${item.value}">${item.label}</option>`).join("");
    preset.value = settings.schedulePreset;
    document.getElementById("customStart").value = settings.customStart;
    document.getElementById("customEnd").value = settings.customEnd;
    document.getElementById("protectionEnabled").checked = settings.protectionEnabled;
    appearanceSelect.value = settings.appearance;
    applyAppearance();
    document.querySelectorAll(".custom-time").forEach((node) => { node.hidden = settings.schedulePreset !== "custom"; });
    renderPlatforms();
    renderCustom();
    renderUltimate();
  }

  async function requestPlatform(platform) {
    try { return await chrome.permissions.request({ origins: platform.permissionPatterns }); } catch (_error) { return false; }
  }

  async function hasPlatformPermission(platform) {
    try { return await chrome.permissions.contains({ origins: platform.permissionPatterns }); } catch (_error) { return false; }
  }

  async function refreshPermissionStates() {
    for (const platform of R.PLATFORMS.filter((item) => !item.core)) {
      const container = document.querySelector(`[data-permission-state="${platform.id}"]`);
      if (!container) continue;
      const enabled = settings.platforms[platform.id].mode !== "off";
      const granted = enabled && await hasPlatformPermission(platform);
      container.querySelector("span").textContent = !enabled ? "No site access requested" : granted ? "Optional access granted" : "Access needed to activate this site";
      container.querySelector("button").hidden = !enabled || granted || locked();
    }
  }

  async function removePlatformPermission(platform) {
    try { await chrome.permissions.remove({ origins: platform.permissionPatterns }); } catch (_error) {}
  }

  async function onModeChange(select) {
    if (locked()) return;
    const platform = R.platformById(select.dataset.platform);
    const next = select.value;
    if (!platform.core && next !== "off" && !(await hasPlatformPermission(platform))) {
      markStatus(`Waiting for ${platform.label} access...`);
      const granted = await requestPlatform(platform);
      if (!granted) {
        select.value = "off";
        settings.platforms[platform.id].mode = "off";
        const choices = select.closest(".advanced-platform")?.querySelector(".section-choices");
        if (choices) choices.hidden = true;
        await save();
        await refreshPermissionStates();
        markStatus(`${platform.label} access was not granted`, true);
        return;
      }
    }
    settings.platforms[platform.id].mode = next;
    const coreToggle = document.querySelector(`input[data-core-toggle="${platform.id}"]`);
    if (coreToggle) coreToggle.checked = next !== "off";
    const choices = select.closest(".advanced-platform")?.querySelector(".section-choices");
    if (choices) choices.hidden = next !== "selected";
    await save();
    if (!platform.core && next === "off") await removePlatformPermission(platform);
    await refreshPermissionStates();
  }

  function resetUnlock(message) {
    clearInterval(unlockInterval);
    unlockInterval = null;
    unlockEnd = 0;
    document.getElementById("confirmUnlock").disabled = true;
    document.getElementById("startUnlock").disabled = false;
    document.getElementById("unlockTimer").textContent = message || "Keep this Settings page open and focused for one minute.";
  }

  function updateUnlockTimer() {
    const remaining = Math.max(0, unlockEnd - Date.now());
    if (remaining === 0) {
      clearInterval(unlockInterval);
      unlockInterval = null;
      document.getElementById("confirmUnlock").disabled = false;
      document.getElementById("startUnlock").disabled = true;
      document.getElementById("unlockTimer").textContent = "Wait complete. Confirm removal while this page remains open.";
      return;
    }
    document.getElementById("unlockTimer").textContent = `Keep this Settings page open and focused: ${Math.ceil(remaining / 1000)} seconds remaining.`;
  }

  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (locked()) return;
    if (target.matches("select[data-platform]")) return onModeChange(target);
    if (target.matches("input[data-core-toggle]")) {
      const platform = R.platformById(target.dataset.coreToggle);
      settings.platforms[platform.id].mode = target.checked ? platform.defaultMode : "off";
      const detailed = document.querySelector(`#detailedCorePlatforms select[data-platform="${platform.id}"]`);
      if (detailed) {
        detailed.value = settings.platforms[platform.id].mode;
        detailed.closest(".advanced-platform").querySelector(".section-choices").hidden = settings.platforms[platform.id].mode !== "selected";
      }
      return queueSave();
    }
    if (target.matches("input[data-section]")) {
      settings.platforms[target.dataset.platform].sections[target.dataset.section] = target.checked;
      queueSave();
    }
  });

  document.getElementById("protectionEnabled").addEventListener("change", (event) => {
    if (locked()) return;
    settings.protectionEnabled = event.target.checked;
    if (event.target.checked) settings.pausedUntil = null;
    queueSave();
  });
  appearanceSelect.addEventListener("change", (event) => {
    if (locked()) return;
    settings.appearance = event.target.value;
    applyAppearance();
    queueSave();
  });
  document.getElementById("schedulePreset").addEventListener("change", (event) => {
    if (locked()) return;
    settings.schedulePreset = event.target.value;
    document.querySelectorAll(".custom-time").forEach((node) => { node.hidden = event.target.value !== "custom"; });
    queueSave();
  });
  document.getElementById("customStart").addEventListener("change", (event) => { if (!locked()) { settings.customStart = event.target.value; queueSave(); } });
  document.getElementById("customEnd").addEventListener("change", (event) => { if (!locked()) { settings.customEnd = event.target.value; queueSave(); } });

  document.getElementById("customForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (locked()) return;
    const input = document.getElementById("customEntry");
    const error = document.getElementById("customError");
    const checked = R.validateEntry(input.value);
    error.textContent = checked.ok ? "" : checked.error;
    if (!checked.ok || settings.customEntries.includes(checked.value)) return;
    if (R.platformForUrl(`https://${checked.value.split("/")[0]}/`)) {
      error.textContent = "Use the platform controls above for supported sites.";
      return;
    }
    const pattern = R.permissionPatternForEntry(checked.value);
    const granted = await chrome.permissions.request({ origins: [pattern] }).catch(() => false);
    if (!granted) {
      error.textContent = "Site access was not granted, so nothing was added.";
      return;
    }
    settings.customEntries.push(checked.value);
    input.value = "";
    await save();
    renderCustom();
  });

  document.getElementById("customList").addEventListener("click", async (event) => {
    if (locked()) return;
    const entry = event.target.dataset.remove;
    if (!entry) return;
    settings.customEntries = settings.customEntries.filter((item) => item !== entry);
    const pattern = R.permissionPatternForEntry(entry);
    await save();
    if (!settings.customEntries.some((item) => R.permissionPatternForEntry(item) === pattern)) {
      await chrome.permissions.remove({ origins: [pattern] }).catch(() => false);
    }
    renderCustom();
  });

  advancedContainer.addEventListener("click", async (event) => {
    if (locked()) return;
    const id = event.target.dataset.grant;
    if (!id) return;
    const platform = R.platformById(id);
    const granted = await requestPlatform(platform);
    if (!granted) {
      settings.platforms[id].mode = "off";
      await save();
      renderPlatforms();
      markStatus(`${platform.label} access was not granted`, true);
      return;
    }
    await save();
    await refreshPermissionStates();
  });

  document.getElementById("enableUltimate").addEventListener("click", async () => {
    const phrase = document.getElementById("ultimateConfirmPhrase").value.trim();
    if (phrase !== "I ACCEPT THE LOCK") {
      setUltimateFeedback("Type I ACCEPT THE LOCK exactly before enabling Ultimate Lock.", true);
      return;
    }
    const profile = document.getElementById("ultimateProfile").value;
    settings = R.createUltimateSettings(settings, profile);
    await save();
    renderAll();
    setUltimateFeedback("Ultimate Lock is active. Use the one-minute continuous unlock flow when you genuinely want to remove it.");
  });

  document.getElementById("startUnlock").addEventListener("click", () => {
    const action = document.getElementById("unlockAction").value;
    const phrase = document.getElementById("unlockPhrase").value.trim();
    if (action !== "remove_ultimate" || phrase !== "REMOVE ULTIMATE") {
      setUltimateFeedback("Choose Remove Ultimate Lock and type REMOVE ULTIMATE exactly to start the wait.", true);
      return;
    }
    setUltimateFeedback("");
    unlockEnd = Date.now() + 60000;
    document.getElementById("startUnlock").disabled = true;
    updateUnlockTimer();
    unlockInterval = setInterval(updateUnlockTimer, 250);
  });

  document.getElementById("confirmUnlock").addEventListener("click", async () => {
    const action = document.getElementById("unlockAction").value;
    const phrase = document.getElementById("unlockPhrase").value.trim();
    if (unlockEnd > Date.now() || action !== "remove_ultimate" || phrase !== "REMOVE ULTIMATE") {
      resetUnlock();
      setUltimateFeedback("The unlock conditions changed. Start the one-minute wait again.", true);
      return;
    }
    settings = R.releaseUltimateSettings(settings);
    await save();
    resetUnlock();
    renderAll();
    setUltimateFeedback("Ultimate Lock has been removed. Protection remains on until you change it.");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && unlockEnd) {
      resetUnlock("Timer reset because Settings was left. Start again when you are ready.");
      setUltimateFeedback("The one-minute wait must be continuous.", true);
    }
  });
  window.addEventListener("blur", () => {
    if (unlockEnd) {
      resetUnlock("Timer reset because Settings lost focus. Start again when you are ready.");
      setUltimateFeedback("The one-minute wait must be continuous.", true);
    }
  });
  window.addEventListener("pagehide", () => resetUnlock());
  globalThis.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (settings.appearance === "system") applyAppearance();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[R.SETTINGS_KEY]) return;
    settings = R.normalizeSettings(changes[R.SETTINGS_KEY].newValue);
    if (unlockEnd) resetUnlock();
    renderAll();
  });

  renderAll();
  await chrome.storage.local.set({ [R.SETTINGS_KEY]: settings });
})();
