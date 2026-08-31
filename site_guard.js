(function () {
  "use strict";

  if (globalThis.__reellessGuardLoaded) return;
  globalThis.__reellessGuardLoaded = true;

  const R = globalThis.ReelLess;
  if (!R || !globalThis.chrome || !chrome.storage) return;

  let settings = R.getDefaultSettings();
  let lastHandled = "";
  let lastHref = location.href;
  let debounceTimer = null;
  let observer = null;

  function eventId(kind) {
    return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function record(kind) {
    chrome.runtime.sendMessage({ type: "recordBlockAttempt", eventId: eventId(kind) }).catch(() => {});
  }

  function removeFocusScreen() {
    const screen = document.getElementById("reelless-focus-screen");
    if (screen) screen.remove();
  }

  function clearMarkers() {
    document.querySelectorAll("[data-reelless-hidden], [data-reelless-checked]").forEach((node) => {
      node.removeAttribute("data-reelless-hidden");
      node.removeAttribute("data-reelless-checked");
    });
  }

  function focusCopy(platform) {
    if (platform.id === "tiktok") {
      return {
        title: "TikTok is outside your focus plan",
        body: "ReelLess is keeping TikTok feed and video pages out of this session. You can change your boundary when you mean to."
      };
    }
    return {
      title: "This section is outside your focus plan",
      body: `${platform.label} matches a boundary you chose in ReelLess.`
    };
  }

  function showFocusScreen(platform) {
    if (document.getElementById("reelless-focus-screen")) return;
    const mount = () => {
      if (!document.documentElement || document.getElementById("reelless-focus-screen")) return;
      const copy = focusCopy(platform);
      const screen = document.createElement("section");
      screen.id = "reelless-focus-screen";
      screen.dataset.theme = settings.appearance === "system"
        ? (globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : settings.appearance;
      screen.setAttribute("role", "dialog");
      screen.setAttribute("aria-modal", "true");
      screen.setAttribute("aria-labelledby", "reelless-focus-title");
      screen.innerHTML = `
        <div class="reelless-card">
          <div class="reelless-mark" aria-hidden="true">ReelLess</div>
          <h1 id="reelless-focus-title"></h1>
          <p></p>
          <div class="reelless-actions">
            <button type="button" data-action="pause">Pause for 15 minutes</button>
            <button type="button" data-action="settings">Open settings</button>
          </div>
        </div>`;
      screen.querySelector("h1").textContent = copy.title;
      screen.querySelector("p").textContent = settings.ultimate.enabled ? `${copy.body} Ultimate Lock is active, so pausing is unavailable.` : copy.body;
      const pauseButton = screen.querySelector('[data-action="pause"]');
      if (settings.ultimate.enabled) {
        pauseButton.remove();
      } else {
        pauseButton.addEventListener("click", async () => {
          const response = await chrome.runtime.sendMessage({ type: "pause", duration: 15 }).catch(() => null);
          if (response && response.locked) return;
          removeFocusScreen();
          scheduleScan();
        });
      }
      screen.querySelector('[data-action="settings"]').addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
      });
      document.documentElement.appendChild(screen);
    };
    if (document.documentElement) mount();
    else document.addEventListener("DOMContentLoaded", mount, { once: true });
  }

  function redirectTarget(decision, url) {
    if (decision.reason === "all") return null;
    if (decision.platform.id === "youtube" && decision.section && decision.section.id === "shorts") return R.youtubeWatchUrl(url);
    if (decision.platform.id === "instagram" && decision.section && decision.section.id === "reels") return decision.platform.homeUrl;
    if (decision.platform.id === "facebook" && decision.section && decision.section.id === "reels") return decision.platform.homeUrl;
    return null;
  }

  function handleCurrentNavigation() {
    const decision = R.shouldBlockUrl(settings, location.href, new Date());
    if (!decision.blocked) {
      lastHandled = "";
      removeFocusScreen();
      return;
    }
    const key = `${location.href}|${decision.platform.id}|${decision.reason}`;
    if (key === lastHandled) return;
    lastHandled = key;
    record("navigation");
    const target = redirectTarget(decision, new URL(location.href));
    if (target && target !== location.href) {
      location.replace(target);
      return;
    }
    showFocusScreen(decision.platform);
  }

  function safeContainer(anchor, platform) {
    let candidate = anchor;
    if (platform.id === "youtube") {
      candidate = anchor.closest("ytd-reel-shelf-renderer, ytd-rich-section-renderer, ytd-reel-item-renderer, ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, tp-yt-paper-tab") || anchor;
    } else if (platform.id === "instagram" || platform.id === "facebook") {
      const card = anchor.closest("article, [role='article'], li, [role='listitem']");
      if (card && card.querySelectorAll("a[href]").length <= 8) candidate = card;
    } else {
      const card = anchor.closest("article, li, [role='listitem']");
      if (card && card.querySelectorAll("a[href]").length <= 8) candidate = card;
    }
    if (!candidate || candidate === document.body || candidate === document.documentElement) return anchor;
    if (candidate.matches("main, [role='main'], header") || candidate.querySelector("main, [role='main']")) return anchor;
    return candidate;
  }

  function hideBlockedEntryPoints() {
    if (!R.isScheduleActive(settings, new Date())) return;
    const currentPlatform = R.platformForUrl(location.href);
    if (!currentPlatform) return;
    const anchors = document.querySelectorAll("a[href]:not([data-reelless-checked])");
    const limit = Math.min(anchors.length, 4000);
    for (let index = 0; index < limit; index += 1) {
      const anchor = anchors[index];
      anchor.setAttribute("data-reelless-checked", "true");
      let url;
      try { url = new URL(anchor.href, location.href); } catch (_error) { continue; }
      const decision = R.shouldBlockUrl(settings, url, new Date());
      if (!decision.blocked || !decision.platform || decision.platform.id !== currentPlatform.id || !decision.section) continue;
      safeContainer(anchor, currentPlatform).setAttribute("data-reelless-hidden", "true");
    }
  }

  function scan() {
    debounceTimer = null;
    if (location.href !== lastHref) {
      lastHref = location.href;
      lastHandled = "";
    }
    handleCurrentNavigation();
    if (!document.getElementById("reelless-focus-screen")) {
      hideBlockedEntryPoints();
    }
  }

  function scheduleScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scan, 80);
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    let url;
    try { url = new URL(anchor.href, location.href); } catch (_error) { return; }
    const decision = R.shouldBlockUrl(settings, url, new Date());
    if (!decision.blocked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    record("click");
    const target = redirectTarget(decision, url);
    if (target) location.assign(target);
    else showFocusScreen(decision.platform);
  }, true);

  ["popstate", "hashchange", "yt-navigate-finish", "yt-page-data-updated"].forEach((name) => {
    globalThis.addEventListener(name, scheduleScan, true);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[R.SETTINGS_KEY]) return;
    settings = R.normalizeSettings(changes[R.SETTINGS_KEY].newValue);
    clearMarkers();
    lastHandled = "";
    scheduleScan();
  });

  chrome.storage.local.get([R.SETTINGS_KEY, R.LEGACY_SETTINGS_KEY]).then((stored) => {
    settings = R.normalizeSettings(stored[R.SETTINGS_KEY] || stored[R.LEGACY_SETTINGS_KEY]);
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === "attributes")) clearMarkers();
      scheduleScan();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
    setInterval(scheduleScan, 750);
    scheduleScan();
  }).catch(() => {});
})();
