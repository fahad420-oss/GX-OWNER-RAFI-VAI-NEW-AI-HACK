/**
 * GX 444 — Main Application Controller
 * Handles Demo Lock auth, 30s tab-safe countdown, dashboard actions,
 * history UI, statistics charts, iframe portal handling, and settings.
 */
(function (global) {
  "use strict";

  const { RandomEngine, History, Statistics } = global.GX444;

  const SESSION_KEY = "gx444_demo_unlocked";
  const SETTINGS_KEY = "gx444_settings_v1";
  const DEFAULT_DEMO_PASSCODE = "GX444";
  const CYCLE_DURATION_MS = 30000;

  const state = {
    unlocked: false,
    hiddenDisplay: false,
    currentResult: null,
    filterType: "ALL",
    searchQuery: "",
    timerRunning: false,
    remainingMs: CYCLE_DURATION_MS,
    targetEndTime: null,
    timerIntervalId: null,
    embedLoaded: false,
    embedTimeoutId: null,
    settings: {
      sound: true,
      vibration: true,
      theme: "neon-carbon"
    }
  };

  let audioCtx = null;
  let toastTimeoutId = null;

  // Cached DOM References
  const el = {};

  function cacheElements() {
    el.loginScreen = document.getElementById("login-screen");
    el.appShell = document.getElementById("app-shell");
    el.loginForm = document.getElementById("login-form");
    el.loginPassword = document.getElementById("login-password");
    el.togglePwBtn = document.getElementById("toggle-password-btn");
    el.loginError = document.getElementById("login-error");
    el.logoutBtn = document.getElementById("logout-btn");

    el.simulatorCards = document.getElementById("simulator-cards");
    el.privacyShield = document.getElementById("privacy-shield");
    el.signalStatusPill = document.getElementById("signal-status-pill");
    el.signalStatusText = document.getElementById("signal-status-text");
    el.signalDisplay = document.getElementById("signal-display");
    el.signalCaption = document.getElementById("signal-caption");
    el.signalTimestamp = document.getElementById("signal-timestamp");
    el.classificationBadge = document.getElementById("classification-badge");
    el.numberDisplay = document.getElementById("number-display");

    el.timerDisplay = document.getElementById("timer-display");
    el.timerToggleBtn = document.getElementById("timer-toggle-btn");
    el.timerProgressBar = document.getElementById("timer-progressbar");
    el.timerProgressFill = document.getElementById("timer-progress-fill");

    el.btnHide = document.getElementById("btn-hide");
    el.btnHideLabel = document.getElementById("btn-hide-label");
    el.btnHistory = document.getElementById("btn-history");
    el.btnRefresh = document.getElementById("btn-refresh");
    el.btnReset = document.getElementById("btn-reset");

    el.historySearch = document.getElementById("history-search");
    el.historyCountBadge = document.getElementById("history-count-badge");
    el.historyTbody = document.getElementById("history-tbody");
    el.exportCsvBtn = document.getElementById("export-csv-btn");
    el.clearHistoryBtn = document.getElementById("clear-history-btn");
    el.filterBtns = document.querySelectorAll(".filter-btn");

    el.statTotal = document.getElementById("stat-total");
    el.statBig = document.getElementById("stat-big");
    el.statSmall = document.getElementById("stat-small");
    el.statStreaks = document.getElementById("stat-streaks");
    el.statCurrentStreak = document.getElementById("stat-current-streak");
    el.splitBarBig = document.getElementById("split-bar-big");
    el.splitBarSmall = document.getElementById("split-bar-small");
    el.numberFreqChart = document.getElementById("number-freq-chart");
    el.recent10Strip = document.getElementById("recent-10-strip");
    el.recent50Count = document.getElementById("recent-50-count");
    el.recent50Big = document.getElementById("recent-50-big");
    el.recent50Small = document.getElementById("recent-50-small");

    el.toggleEmbedBtn = document.getElementById("toggle-embed-btn");
    el.embedPlaceholder = document.getElementById("embed-placeholder");
    el.embedBlockedMsg = document.getElementById("embed-blocked-msg");
    el.externalIframe = document.getElementById("external-iframe");

    el.settingSound = document.getElementById("setting-sound");
    el.settingVibration = document.getElementById("setting-vibration");
    el.vibrationSupportNote = document.getElementById("vibration-support-note");
    el.settingTheme = document.getElementById("setting-theme");
    el.settingsClearHistoryBtn = document.getElementById("settings-clear-history-btn");
    el.settingsResetAllBtn = document.getElementById("settings-reset-all-btn");

    el.bottomNavItems = document.querySelectorAll(".bottom-nav .nav-item");
    el.toast = document.getElementById("toast");
    el.confirmModal = document.getElementById("confirm-modal");
    el.modalTitle = document.getElementById("modal-title");
    el.modalMessage = document.getElementById("modal-message");
    el.modalCancelBtn = document.getElementById("modal-cancel-btn");
    el.modalConfirmBtn = document.getElementById("modal-confirm-btn");
  }

  /* ========================================================================
     Feedback Utilities (Toast, Modal, Web Audio, Vibration)
     ======================================================================== */

  function showToast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.hidden = false;
    clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => {
      el.toast.hidden = true;
    }, 2600);
  }

  function showConfirmModal({ title, message, onConfirm }) {
    el.modalTitle.textContent = title;
    el.modalMessage.textContent = message;
    el.confirmModal.hidden = false;

    const cleanup = () => {
      el.confirmModal.hidden = true;
      el.modalConfirmBtn.removeEventListener("click", handleConfirm);
      el.modalCancelBtn.removeEventListener("click", cleanup);
    };

    const handleConfirm = () => {
      cleanup();
      if (typeof onConfirm === "function") onConfirm();
    };

    el.modalConfirmBtn.addEventListener("click", handleConfirm);
    el.modalCancelBtn.addEventListener("click", cleanup);
  }

  function playTone(kind) {
    if (!state.settings.sound) return;
    const AudioContextClass = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      if (!audioCtx) {
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = kind === "result" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(kind === "result" ? 680 : 480, now);
      if (kind === "result") {
        osc.frequency.exponentialRampToValueAtTime(920, now + 0.11);
      }

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (err) {
      // Ignore audio errors on restricted devices
    }
  }

  function triggerVibration(pattern = 24) {
    if (!state.settings.vibration) return;
    if (global.navigator && typeof global.navigator.vibrate === "function") {
      try {
        global.navigator.vibrate(pattern);
      } catch (err) {
        // Ignore vibration restriction
      }
    }
  }

  /* ========================================================================
     Settings Persistence
     ======================================================================== */

  function loadSettings() {
    try {
      const raw = global.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state.settings = {
          sound: parsed.sound !== false,
          vibration: parsed.vibration !== false,
          theme: parsed.theme === "oled-obsidian" ? "oled-obsidian" : "neon-carbon"
        };
      }
    } catch (err) {
      console.error("GX 444: Failed to load settings.", err);
    }
    applySettingsToUI();
  }

  function saveSettings() {
    try {
      global.localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch (err) {
      console.error("GX 444: Failed to save settings.", err);
    }
  }

  function applySettingsToUI() {
    document.documentElement.setAttribute("data-theme", state.settings.theme);
    el.settingSound.checked = state.settings.sound;
    el.settingVibration.checked = state.settings.vibration;
    el.settingTheme.value = state.settings.theme;

    const canVibrate = Boolean(global.navigator && typeof global.navigator.vibrate === "function");
    if (!canVibrate) {
      el.vibrationSupportNote.textContent = "Vibration API not supported on this browser.";
    } else {
      el.vibrationSupportNote.textContent = "Haptic pulse on supported Android devices.";
    }
  }

  /* ========================================================================
     Demo Lock Authentication (Static UI Demo Lock)
     ======================================================================== */

  function checkInitialSession() {
    let unlocked = false;
    try {
      unlocked = global.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (err) {
      unlocked = false;
    }

    if (unlocked) {
      openDashboard();
    } else {
      showLoginScreen();
    }
  }

  function showLoginScreen() {
    state.unlocked = false;
    stopTimer();
    el.appShell.hidden = true;
    el.loginScreen.hidden = false;
    el.loginPassword.value = "";
    el.loginError.hidden = true;
  }

  function openDashboard() {
    state.unlocked = true;
    el.loginScreen.hidden = true;
    el.appShell.hidden = false;

    try {
      global.sessionStorage.setItem(SESSION_KEY, "1");
    } catch (err) {
      // Ignore storage error
    }

    renderHistory();
    renderStatistics();
    resetTimer(true);
  }

  function handleLoginSubmit(event) {
    event.preventDefault();
    const entered = el.loginPassword.value.trim();

    if (!entered) {
      el.loginError.textContent = "Please enter the demo passcode (default: GX444).";
      el.loginError.hidden = false;
      return;
    }

    if (entered.toUpperCase() !== DEFAULT_DEMO_PASSCODE) {
      el.loginError.textContent = "Invalid demo passcode. Enter GX444 to unlock the demo simulator.";
      el.loginError.hidden = false;
      triggerVibration([30, 40, 30]);
      return;
    }

    el.loginError.hidden = true;
    playTone("result");
    triggerVibration(25);
    openDashboard();
    showToast("GX 444 Demo Simulator Unlocked");
  }

  function togglePasswordVisibility() {
    const isHidden = el.loginPassword.type === "password";
    el.loginPassword.type = isHidden ? "text" : "password";
    el.togglePwBtn.textContent = isHidden ? "HIDE" : "SHOW";
    el.togglePwBtn.setAttribute("aria-pressed", String(isHidden));
    el.togglePwBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  }

  function handleLogout() {
    try {
      global.sessionStorage.removeItem(SESSION_KEY);
    } catch (err) {
      // Ignore
    }
    showLoginScreen();
    showToast("GX 444 Locked");
  }

  /* ========================================================================
     Dashboard Simulation & 30s Tab-Accurate Countdown
     ======================================================================== */

  function generateAndDisplayResult() {
    try {
      const result = RandomEngine.generateDemoResult();
      state.currentResult = result;
      History.add(result);
      renderDashboardCards();
      renderHistory();
      renderStatistics();
      playTone("result");
      triggerVibration(30);
    } catch (err) {
      console.error("GX 444 RNG Error:", err);
      showToast("Error: Web Crypto RNG unavailable.");
    }
  }

  function renderDashboardCards() {
    const res = state.currentResult;

    if (!res) {
      el.signalStatusPill.className = "status-pill status-waiting";
      el.signalStatusText.textContent = "WAITING";
      el.signalDisplay.className = "signal-value state-waiting";
      el.signalDisplay.textContent = "WAITING";
      el.signalCaption.textContent = "Press REFRESH or wait for countdown to generate a demo result.";
      el.signalTimestamp.textContent = "--:--:--";

      el.classificationBadge.className = "class-badge class-neutral";
      el.classificationBadge.textContent = "STANDBY";
      el.numberDisplay.className = "glow-number state-waiting";
      el.numberDisplay.textContent = "—";
      return;
    }

    const isBig = res.classification === "BIG";

    el.signalStatusPill.className = "status-pill status-result";
    el.signalStatusText.textContent = "DEMO RESULT";

    el.signalDisplay.className = `signal-value ${isBig ? "state-big" : "state-small"}`;
    el.signalDisplay.textContent = res.classification;
    el.signalCaption.textContent = `Demo digit ${res.number} classified as ${res.classification} (${isBig ? "5–9" : "0–4"}).`;
    el.signalTimestamp.textContent = res.timestamp;

    el.classificationBadge.className = `class-badge ${isBig ? "class-big" : "class-small"}`;
    el.classificationBadge.textContent = res.classification;

    el.numberDisplay.className = `glow-number ${isBig ? "state-big" : "state-small"}`;
    el.numberDisplay.textContent = String(res.number);
    // Retrigger pop animation
    void el.numberDisplay.offsetWidth;
    el.numberDisplay.classList.add("pop");
  }

  function startTimer() {
    if (state.timerRunning) return;
    state.timerRunning = true;
    state.targetEndTime = Date.now() + state.remainingMs;
    el.timerToggleBtn.textContent = "PAUSE";

    clearInterval(state.timerIntervalId);
    state.timerIntervalId = setInterval(tickTimer, 250);
    renderTimerUI();
  }

  function pauseTimer() {
    if (!state.timerRunning) return;
    if (state.targetEndTime) {
      state.remainingMs = Math.max(0, state.targetEndTime - Date.now());
    }
    state.timerRunning = false;
    state.targetEndTime = null;
    clearInterval(state.timerIntervalId);
    el.timerToggleBtn.textContent = "RESUME";
    renderTimerUI();
  }

  function stopTimer() {
    state.timerRunning = false;
    state.targetEndTime = null;
    clearInterval(state.timerIntervalId);
  }

  function resetTimer(autoStart = true) {
    stopTimer();
    state.remainingMs = CYCLE_DURATION_MS;
    renderTimerUI();
    if (autoStart && state.unlocked) {
      startTimer();
    } else {
      el.timerToggleBtn.textContent = "RESUME";
    }
  }

  function tickTimer() {
    if (!state.timerRunning || !state.targetEndTime) return;

    const now = Date.now();
    const diff = state.targetEndTime - now;

    if (diff <= 0) {
      generateAndDisplayResult();
      state.remainingMs = CYCLE_DURATION_MS;
      state.targetEndTime = Date.now() + CYCLE_DURATION_MS;
    } else {
      state.remainingMs = diff;
    }

    renderTimerUI();
  }

  function renderTimerUI() {
    const secondsLeft = Math.ceil(state.remainingMs / 1000);
    const clamped = Math.max(0, Math.min(30, secondsLeft));
    const pct = Math.max(0, Math.min(100, (state.remainingMs / CYCLE_DURATION_MS) * 100));

    el.timerDisplay.textContent = `${clamped}s`;
    el.timerProgressFill.style.width = `${pct.toFixed(1)}%`;
    el.timerProgressBar.setAttribute("aria-valuenow", String(clamped));
  }

  function handleVisibilityChange() {
    if (!document.hidden && state.unlocked && state.timerRunning && state.targetEndTime) {
      // Re-sync accurately after Android tab wake-up
      tickTimer();
    }
  }

  /* ========================================================================
     Dashboard Action Buttons
     ======================================================================== */

  function toggleHideDisplay() {
    state.hiddenDisplay = !state.hiddenDisplay;
    el.simulatorCards.hidden = state.hiddenDisplay;
    el.privacyShield.hidden = !state.hiddenDisplay;
    el.btnHideLabel.textContent = state.hiddenDisplay ? "SHOW" : "HIDE";
    playTone("click");
    triggerVibration(15);
  }

  function jumpToHistory() {
    playTone("click");
    const target = document.getElementById("history-section");
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }

  function handleRefreshAction() {
    if (state.hiddenDisplay) {
      toggleHideDisplay();
    }
    generateAndDisplayResult();
    resetTimer(state.timerRunning);
    showToast("New demo result generated");
  }

  function handleResetAction() {
    state.currentResult = null;
    renderDashboardCards();
    resetTimer(true);
    playTone("click");
    triggerVibration(20);
    showToast("Simulator display & 30s timer reset");
  }

  /* ========================================================================
     History Rendering & Controls
     ======================================================================== */

  function renderHistory() {
    const allCount = History.getAll().length;
    const filtered = History.filter({
      query: state.searchQuery,
      type: state.filterType
    });

    el.historyCountBadge.textContent = `${allCount} ${allCount === 1 ? "Record" : "Records"}`;
    el.historyTbody.textContent = "";

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.className = "empty-cell";
      td.textContent = allCount === 0 ? "No demo results generated yet." : "No matching history records.";
      tr.appendChild(td);
      el.historyTbody.appendChild(tr);
      return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((item, index) => {
      const tr = document.createElement("tr");
      const isBig = item.classification === "BIG";

      const tdIdx = document.createElement("td");
      tdIdx.textContent = String(index + 1);

      const tdNum = document.createElement("td");
      const numSpan = document.createElement("span");
      numSpan.className = `num-pill ${isBig ? "num-pill-big" : "num-pill-small"}`;
      numSpan.textContent = String(item.number);
      tdNum.appendChild(numSpan);

      const tdType = document.createElement("td");
      const typeSpan = document.createElement("span");
      typeSpan.className = isBig ? "text-neon" : "text-cyan";
      typeSpan.style.fontWeight = "800";
      typeSpan.textContent = item.classification;
      tdType.appendChild(typeSpan);

      const tdTime = document.createElement("td");
      tdTime.style.fontFamily = "var(--font-mono)";
      tdTime.style.fontSize = "0.8rem";
      tdTime.textContent = item.timestamp;

      tr.append(tdIdx, tdNum, tdType, tdTime);
      fragment.appendChild(tr);
    });

    el.historyTbody.appendChild(fragment);
  }

  function requestClearHistory() {
    showConfirmModal({
      title: "Clear Demo History?",
      message: "This will permanently delete all stored demo results and reset calculated statistics.",
      onConfirm: () => {
        History.clear();
        renderHistory();
        renderStatistics();
        playTone("click");
        showToast("History cleared");
      }
    });
  }

  function handleExportCsv() {
    const res = History.exportCSV();
    if (!res.ok) {
      showToast("No history records to export");
      return;
    }
    playTone("click");
    showToast(`Exported ${res.count} records to CSV`);
  }

  /* ========================================================================
     Statistics Rendering
     ======================================================================== */

  function renderStatistics() {
    const stats = Statistics.calculate(History.getAll());

    el.statTotal.textContent = String(stats.total);
    el.statBig.textContent = `${stats.bigCount} (${stats.bigPct}%)`;
    el.statSmall.textContent = `${stats.smallCount} (${stats.smallPct}%)`;
    el.statStreaks.textContent = `BIG: ${stats.longestBigStreak} | SMALL: ${stats.longestSmallStreak}`;

    if (stats.currentStreak.count > 0) {
      el.statCurrentStreak.textContent = `Current: ${stats.currentStreak.type} ×${stats.currentStreak.count}`;
    } else {
      el.statCurrentStreak.textContent = "Streak: —";
    }

    if (stats.total === 0) {
      el.splitBarBig.style.width = "50%";
      el.splitBarBig.textContent = "0%";
      el.splitBarSmall.style.width = "50%";
      el.splitBarSmall.textContent = "0%";
    } else {
      el.splitBarBig.style.width = `${stats.bigPct}%`;
      el.splitBarBig.textContent = stats.bigPct >= 12 ? `${stats.bigPct}%` : "";
      el.splitBarSmall.style.width = `${stats.smallPct}%`;
      el.splitBarSmall.textContent = stats.smallPct >= 12 ? `${stats.smallPct}%` : "";
    }

    // Render 0-9 frequency bar chart
    el.numberFreqChart.textContent = "";
    const chartFrag = document.createDocumentFragment();
    for (let digit = 0; digit <= 9; digit += 1) {
      const count = stats.numberCounts[digit];
      const heightPct = stats.total > 0 ? Math.round((count / stats.maxNumberCount) * 100) : 0;

      const col = document.createElement("div");
      col.className = "freq-col";

      const countLbl = document.createElement("span");
      countLbl.className = "freq-count";
      countLbl.textContent = String(count);

      const track = document.createElement("div");
      track.className = "freq-bar-track";

      const fill = document.createElement("div");
      fill.className = `freq-bar-fill ${digit >= 5 ? "freq-bar-big" : "freq-bar-small"}`;
      fill.style.height = `${heightPct}%`;
      track.appendChild(fill);

      const digitLbl = document.createElement("span");
      digitLbl.className = "freq-digit";
      digitLbl.textContent = String(digit);

      col.append(countLbl, track, digitLbl);
      chartFrag.appendChild(col);
    }
    el.numberFreqChart.appendChild(chartFrag);

    // Render Recent 10
    el.recent10Strip.textContent = "";
    if (stats.recent10.length === 0) {
      const empty = document.createElement("span");
      empty.className = "empty-note";
      empty.textContent = "No results yet.";
      el.recent10Strip.appendChild(empty);
    } else {
      const stripFrag = document.createDocumentFragment();
      stats.recent10.forEach((item) => {
        const chip = document.createElement("span");
        chip.className = `recent-chip ${item.classification === "BIG" ? "recent-chip-big" : "recent-chip-small"}`;
        chip.textContent = `${item.number} (${item.classification[0]})`;
        stripFrag.appendChild(chip);
      });
      el.recent10Strip.appendChild(stripFrag);
    }

    // Render Recent 50
    el.recent50Count.textContent = `${stats.recent50.total} / 50`;
    el.recent50Big.textContent = `${stats.recent50.bigCount} (${stats.recent50.bigPct}%)`;
    el.recent50Small.textContent = `${stats.recent50.smallCount} (${stats.recent50.smallPct}%)`;
  }

  /* ========================================================================
     Embedded Website Section (Respects X-Frame-Options & CSP)
     ======================================================================== */

  function toggleExternalPreview() {
    if (state.embedLoaded) {
      // Unload preview
      clearTimeout(state.embedTimeoutId);
      state.embedLoaded = false;
      el.externalIframe.src = "about:blank";
      el.externalIframe.hidden = true;
      el.embedBlockedMsg.hidden = true;
      el.embedPlaceholder.hidden = false;
      el.toggleEmbedBtn.textContent = "LOAD PREVIEW";
      return;
    }

    state.embedLoaded = true;
    el.embedPlaceholder.hidden = true;
    el.embedBlockedMsg.hidden = true;
    el.externalIframe.hidden = false;
    el.toggleEmbedBtn.textContent = "CLOSE PREVIEW";

    // Attach load/error handlers; if cross-origin blocks silently, warn user if needed.
    el.externalIframe.onload = () => {
      clearTimeout(state.embedTimeoutId);
    };

    el.externalIframe.onerror = () => {
      clearTimeout(state.embedTimeoutId);
      showEmbedBlocked();
    };

    el.externalIframe.src = "https://dkwin9.com/";

    // Fallback notice if frame takes too long or is blocked silently by browser security headers
    clearTimeout(state.embedTimeoutId);
    state.embedTimeoutId = setTimeout(() => {
      // If user sees blank/blocked frame due to X-Frame-Options, ensure clear guidance is accessible
      try {
        // Cross-origin access throws if loaded; if still about:blank, it failed/blocked
        if (el.externalIframe.contentWindow && el.externalIframe.contentWindow.location.href === "about:blank") {
          showEmbedBlocked();
        }
      } catch (err) {
        // Cross-origin frame loaded or browser blocked inspection
      }
    }, 5000);
  }

  function showEmbedBlocked() {
    el.externalIframe.hidden = true;
    el.embedPlaceholder.hidden = true;
    el.embedBlockedMsg.hidden = false;
  }

  /* ========================================================================
     Reset All Demo Data & Bottom Nav Highlighting
     ======================================================================== */

  function requestResetAllDemoData() {
    showConfirmModal({
      title: "Reset All GX 444 Demo Data?",
      message: "This clears saved history, resets settings to defaults, and resets the simulator display.",
      onConfirm: () => {
        History.clear();
        state.currentResult = null;
        state.hiddenDisplay = false;
        el.simulatorCards.hidden = false;
        el.privacyShield.hidden = true;
        el.btnHideLabel.textContent = "HIDE";

        state.settings = {
          sound: true,
          vibration: true,
          theme: "neon-carbon"
        };
        saveSettings();
        applySettingsToUI();

        renderDashboardCards();
        renderHistory();
        renderStatistics();
        resetTimer(true);
        showToast("All GX 444 demo data reset");
      }
    });
  }

  function setupBottomNav() {
    el.bottomNavItems.forEach((link) => {
      link.addEventListener("click", () => {
        el.bottomNavItems.forEach((item) => item.classList.remove("active"));
        link.classList.add("active");
      });
    });
  }

  /* ========================================================================
     Event Binding & Init
     ======================================================================== */

  function bindEvents() {
    el.loginForm.addEventListener("submit", handleLoginSubmit);
    el.togglePwBtn.addEventListener("click", togglePasswordVisibility);
    el.logoutBtn.addEventListener("click", handleLogout);

    el.timerToggleBtn.addEventListener("click", () => {
      playTone("click");
      if (state.timerRunning) pauseTimer();
      else startTimer();
    });

    el.btnHide.addEventListener("click", toggleHideDisplay);
    el.btnHistory.addEventListener("click", jumpToHistory);
    el.btnRefresh.addEventListener("click", handleRefreshAction);
    el.btnReset.addEventListener("click", handleResetAction);

    el.historySearch.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderHistory();
    });

    el.filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        el.filterBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.filterType = btn.dataset.filter || "ALL";
        renderHistory();
      });
    });

    el.exportCsvBtn.addEventListener("click", handleExportCsv);
    el.clearHistoryBtn.addEventListener("click", requestClearHistory);

    el.toggleEmbedBtn.addEventListener("click", toggleExternalPreview);

    el.settingSound.addEventListener("change", (e) => {
      state.settings.sound = e.target.checked;
      saveSettings();
      if (state.settings.sound) playTone("click");
    });

    el.settingVibration.addEventListener("change", (e) => {
      state.settings.vibration = e.target.checked;
      saveSettings();
      if (state.settings.vibration) triggerVibration(20);
    });

    el.settingTheme.addEventListener("change", (e) => {
      state.settings.theme = e.target.value;
      saveSettings();
      applySettingsToUI();
      showToast("Theme updated");
    });

    el.settingsClearHistoryBtn.addEventListener("click", requestClearHistory);
    el.settingsResetAllBtn.addEventListener("click", requestResetAllDemoData);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    setupBottomNav();
  }

  function init() {
    cacheElements();
    loadSettings();
    bindEvents();
    renderDashboardCards();
    checkInitialSession();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);