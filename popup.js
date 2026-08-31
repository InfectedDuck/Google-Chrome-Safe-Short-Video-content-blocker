(async function () {
  "use strict";

  const R = ReelLess;
  const platformList = document.getElementById("platformList");
  const core = R.PLATFORMS.filter((platform) => R.CORE_PLATFORM_IDS.includes(platform.id));
  const glyphs = { youtube: "YT", instagram: "IG", facebook: "FB", tiktok: "TT" };
  let state = await chrome.runtime.sendMessage({ type: "getState" });
  let settings = R.normalizeSettings(state && state.settings);

  function applyAppearance() {
    const theme = settings.appearance === "system"
      ? (globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : settings.appearance;
    document.documentElement.dataset.theme = theme;
  }

  function renderStatus() {
    const now = new Date();
    const active = R.isScheduleActive(settings, now);
    const paused = settings.pausedUntil && Date.parse(settings.pausedUntil) > now.getTime();
    const ultimate = settings.ultimate && settings.ultimate.enabled;
    document.getElementById("statusDot").classList.toggle("active", active);
    document.getElementById("statusText").textContent = ultimate ? "Ultimate Lock is active" : active ? "Protection is active" : paused ? `Paused until ${new Date(settings.pausedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Outside your schedule";
    document.getElementById("resumeButton").hidden = !paused || ultimate;
    document.getElementById("pauseDuration").disabled = ultimate;
    document.getElementById("pauseButton").disabled = ultimate;
    document.getElementById("ultimateNotice").hidden = !ultimate;
  }

  function renderPlatforms() {
    platformList.textContent = "";
    core.forEach((platform) => {
      const row = document.createElement("div");
      row.className = "platform-row";
      const checked = settings.platforms[platform.id].mode !== "off";
      row.innerHTML = `<span class="platform-label"><span class="platform-glyph">${glyphs[platform.id]}</span>${platform.label}</span><label class="switch"><input type="checkbox" data-platform="${platform.id}" ${checked ? "checked" : ""} ${settings.ultimate && settings.ultimate.enabled ? "disabled" : ""} aria-label="Protect ${platform.label}"><span></span></label>`;
      platformList.appendChild(row);
    });
  }

  async function save() {
    settings = R.normalizeSettings(settings);
    await chrome.storage.local.set({ [R.SETTINGS_KEY]: settings });
  }

  platformList.addEventListener("change", async (event) => {
    const id = event.target.dataset.platform;
    if (!id) return;
    if (settings.ultimate && settings.ultimate.enabled) return;
    const platform = R.platformById(id);
    settings.platforms[id].mode = event.target.checked ? platform.defaultMode : "off";
    await save();
    renderStatus();
  });

  document.getElementById("pauseButton").addEventListener("click", async () => {
    if (settings.ultimate && settings.ultimate.enabled) return;
    const duration = document.getElementById("pauseDuration").value;
    const result = await chrome.runtime.sendMessage({ type: "pause", duration });
    if (result && result.settings) settings = R.normalizeSettings(result.settings);
    renderStatus();
  });

  document.getElementById("resumeButton").addEventListener("click", async () => {
    if (settings.ultimate && settings.ultimate.enabled) return;
    settings.pausedUntil = null;
    await save();
    renderStatus();
  });

  document.getElementById("settingsButton").addEventListener("click", () => chrome.runtime.openOptionsPage());
  document.getElementById("dismissReview").addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "dismissReview" });
    document.getElementById("reviewPrompt").hidden = true;
  });

  const stats = R.normalizeStats(state && state.stats);
  const meta = R.normalizeMeta(state && state.meta);
  document.getElementById("todayCount").textContent = stats.todayCount.toLocaleString();
  document.getElementById("totalCount").textContent = stats.totalCount.toLocaleString();
  document.getElementById("reviewLink").href = `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`;
  document.getElementById("reviewPrompt").hidden = !(meta.reviewShown && !meta.reviewDismissed);
  applyAppearance();
  renderPlatforms();
  renderStatus();
})();
