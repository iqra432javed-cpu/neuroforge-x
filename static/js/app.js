/* app.js - Refactored Neuroforge core
   - Safe storage
   - Local-date handling (no UTC off-by-one)
   - Unified XP/level logic
   - Achievements, time achievements
   - Toast queue (accessible)
   - Event-driven UI updates
   - Export / import / reset
*/

const Neuroforge = (function () {
  // ====== CONFIG & KEYS ======
  const KEYS = {
    HISTORY: "neuroforge_history",
    ACHIEVEMENTS: "neuroforge_achievements",
    XP: "neuroforge_xp",
    STREAK: "neuroforge_streak",
    LAST_ACTIVE: "neuroforge_last_active",
    LAST_INDEX: "neuroforge_last_index"
  };

  const CONFIG = {
    MAX_SCORE: 20,
    INACTIVITY_PENALTY_PER_DAY: 5,
    ONBOARDING_BASE_XP: 50,
    TOAST_DISPLAY_MS: 2500,
    TOAST_TRANSITION_MS: 600,
    DEFAULT_XP: 0,
    DEFAULT_STREAK: 0
  };

  const RANK_THRESHOLDS = [
    { name: "Dreamer", min: 0, max: 9 },
    { name: "Explorer", min: 10, max: 12 },
    { name: "Builder", min: 13, max: 16 },
    { name: "Architect", min: 17, max: 20 }
  ];

  // ====== SAFE STORAGE HELPERS ======
  function safeGetRaw(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.error("localStorage.getItem failed:", key, err);
      return null;
    }
  }

  function safeSetRaw(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.error("localStorage.setItem failed:", key, err);
      return false;
    }
  }

  function safeGetJSON(key, fallback) {
    const raw = safeGetRaw(key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn("Corrupt JSON in localStorage key:", key, err);
      // attempt to reset the key with fallback to avoid repeated errors
      safeSetJSON(key, fallback);
      return fallback;
    }
  }

  function safeSetJSON(key, obj) {
    return safeSetRaw(key, JSON.stringify(obj));
  }

  // ====== DATE HELPERS (local calendar days) ======
  function toLocalISODate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseLocalISODate(iso) {
    if (!iso || typeof iso !== "string") return null;
    const parts = iso.split("-");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return new Date(y, m - 1, d); // local midnight
  }

  function diffInDaysLocal(aISO, bISO) {
    const a = parseLocalISODate(aISO);
    const b = parseLocalISODate(bISO);
    if (!a || !b) return NaN;
    const msPerDay = 24 * 60 * 60 * 1000;
    // Use round to avoid DST / minor ms diffs
    return Math.round((b - a) / msPerDay);
  }

  // ====== STORAGE WRAPPERS (public-like APIs) ======
  const getHistory = () => safeGetJSON(KEYS.HISTORY, []);
  const saveHistory = (history) => safeSetJSON(KEYS.HISTORY, history);

  const getAchievements = () => safeGetJSON(KEYS.ACHIEVEMENTS, []);
  const saveAchievements = (a) => safeSetJSON(KEYS.ACHIEVEMENTS, a);

  const getXP = () => {
    const v = safeGetRaw(KEYS.XP);
    if (v == null) return CONFIG.DEFAULT_XP;
    const n = Number(v);
    return Number.isFinite(n) ? n : CONFIG.DEFAULT_XP;
  };
  const setXP = (v) => safeSetRaw(KEYS.XP, String(Math.max(0, Math.floor(v))));

  const getStreak = () => {
    const v = safeGetRaw(KEYS.STREAK);
    if (v == null) return CONFIG.DEFAULT_STREAK;
    const n = Number(v);
    return Number.isFinite(n) ? n : CONFIG.DEFAULT_STREAK;
  };
  const setStreak = (v) => safeSetRaw(KEYS.STREAK, String(Math.max(0, Math.floor(v))));

  const getLastActive = () => safeGetRaw(KEYS.LAST_ACTIVE);
  const setLastActive = (d) => safeSetRaw(KEYS.LAST_ACTIVE, d);

  const getLastIndex = () => {
    const v = safeGetRaw(KEYS.LAST_INDEX);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const setLastIndex = (v) => safeSetRaw(KEYS.LAST_INDEX, String(v));

  // ====== XP & LEVEL LOGIC (single source) ======
  function xpForLevel(level) {
    return Math.floor(100 * Math.pow(level, 1.4) + level * 50);
  }

  function computeLevelFromXP(totalXP) {
    let remaining = Math.max(0, Math.floor(totalXP));
    let level = 1;
    while (remaining >= xpForLevel(level)) {
      remaining -= xpForLevel(level);
      level++;
    }
    return { level, current: remaining, required: xpForLevel(level) };
  }

  function getLevel() {
    return computeLevelFromXP(getXP()).level;
  }

  function getXPIntoLevel() {
    return computeLevelFromXP(getXP());
  }

  // ====== RANK & LORE HELPERS ======
  function calculateMindType(total) {
    if (total >= 17) return "Focused Architect";
    if (total >= 13) return "Strategic Builder";
    if (total >= 10) return "Growing Explorer";
    return "Unstable Dreamer";
  }

  function calculateRank(total) {
    if (total >= 17) return "Architect";
    if (total >= 13) return "Builder";
    if (total >= 10) return "Explorer";
    return "Dreamer";
  }

  function getNextRankName(rank) {
    if (rank === "Dreamer") return "Explorer";
    if (rank === "Explorer") return "Builder";
    if (rank === "Builder") return "Architect";
    return "Architect";
  }

  function progressToNextRankPercent(total) {
    // Find current threshold
    const currentThreshold = RANK_THRESHOLDS.find(r => total >= r.min && total <= r.max) || RANK_THRESHOLDS[0];
    const idx = RANK_THRESHOLDS.indexOf(currentThreshold);
    const nextIdx = Math.min(idx + 1, RANK_THRESHOLDS.length - 1);
    const next = RANK_THRESHOLDS[nextIdx];
    if (currentThreshold === next) return 100;
    const span = currentThreshold.max - currentThreshold.min;
    const progress = span === 0 ? 1 : (total - currentThreshold.min) / span;
    return Math.max(0, Math.min(100, Math.round(progress * 100)));
  }

  function getLoreTitle(level) {
    if (level >= 100) return "🌌 Transcendent Entity";
    if (level >= 50) return "👑 Neural Overlord";
    if (level >= 20) return "🏛️ Architect of Will";
    if (level >= 10) return "🏹 Thought Warrior";
    if (level >= 5) return "⚔️ Mind Trainee";
    return "🧠 Wandering Mind";
  }

  // ====== ACHIEVEMENTS ======
  const ALL_ACHIEVEMENTS = [
    { id: "first_analysis", title: "🧠 First Awakening", check: (s) => s.historyCount >= 1 },
    { id: "three_day_streak", title: "🔥 3 Day Streak", check: (s) => s.streak >= 3 },
    { id: "seven_day_streak", title: "🔥 7 Day Streak", check: (s) => s.streak >= 7 },
    { id: "thirty_day_streak", title: "👑 Consistency Master", check: (s) => s.streak >= 30 },
    { id: "five_sessions", title: "📊 5 Analyses", check: (s) => s.historyCount >= 5 },
    { id: "level_5", title: "🧬 Level 5", check: (s) => s.level >= 5 },
    { id: "level_10", title: "🧬 Level 10", check: (s) => s.level >= 10 },
    { id: "builder_rank", title: "🏗️ Builder Rank", check: (s) => ["Builder","Architect"].includes(s.rank) },
    { id: "architect_rank", title: "🏛️ Architect Rank", check: (s) => s.rank === "Architect" },
    // time-based achieved handled separately but define here for list
    { id: "night_owl", title: "🌙 Night Owl" },
    { id: "early_bird", title: "🌞 Early Bird" }
  ];

  function unlockAchievement(id) {
    const unlocked = getAchievements();
    if (unlocked.includes(id)) return false;
    unlocked.push(id);
    saveAchievements(unlocked);
    const a = ALL_ACHIEVEMENTS.find(x => x.id === id);
    showToast(`🏅 Achievement Unlocked: ${a ? a.title : id}`);
    // emit event
    document.dispatchEvent(new CustomEvent("neuroforge:achievement-unlocked", { detail: { id } }));
    return true;
  }

  function checkAchievements(state) {
    ALL_ACHIEVEMENTS.forEach(a => {
      if (a.check && a.check(state)) unlockAchievement(a.id);
    });
  }

  // ====== TIME ACHIEVEMENTS ======
  function checkTimeAchievements() {
    const hour = new Date().getHours();
    // Night Owl: 00:00 - 04:59 local time
    if (hour >= 0 && hour <= 4) unlockAchievement("night_owl");
    // Early Bird: 05:00 - 08:59 local time
    if (hour >= 5 && hour <= 8) unlockAchievement("early_bird");
  }

  // ====== TOAST QUEUE (accessible) ======
  let toastQueue = [];
  let toastActive = false;

  function showToast(message) {
    toastQueue.push(message);
    if (!toastActive) processToast();
  }

  function processToast() {
    if (!toastQueue.length) { toastActive = false; return; }
    toastActive = true;
    const message = toastQueue.shift();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.textContent = message;
    document.body.appendChild(toast);

    // Force layout then add visible for CSS transitions
    requestAnimationFrame(() => toast.classList.add("visible"));

    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => {
        toast.remove();
        processToast();
      }, CONFIG.TOAST_TRANSITION_MS);
    }, CONFIG.TOAST_DISPLAY_MS);
  }

  // ====== XP / STREAK HANDLERS ======
  function grantXP(amount) {
    setXP(getXP() + Number(amount || 0));
    showToast(`✨ +${amount} XP gained`);
    document.dispatchEvent(new CustomEvent("neuroforge:state-changed"));
  }

  function applyDailyXPDecay() {
    const last = getLastActive();
    const today = toLocalISODate();
    if (!last) return;
    const diffDays = diffInDaysLocal(last, today);
    if (!Number.isFinite(diffDays)) return;
    if (diffDays >= 1) {
      const loss = diffDays * CONFIG.INACTIVITY_PENALTY_PER_DAY;
      setXP(Math.max(0, getXP() - loss));
      showToast(`⚠️ Inactivity penalty: -${loss} XP`);
    }
  }

  function updateStreak() {
    const today = toLocalISODate();
    const last = getLastActive();
    if (!last) {
      setStreak(1);
    } else {
      const diffDays = diffInDaysLocal(last, today);
      if (!Number.isFinite(diffDays)) {
        setStreak(1);
      } else if (diffDays === 1) {
        setStreak(getStreak() + 1);
        showToast(`🔥 Streak: ${getStreak()} days`);
      } else if (diffDays > 1) {
        setStreak(1);
        applyDailyXPDecay();
      } // diffDays === 0 => nothing
    }
    setLastActive(today);
    document.dispatchEvent(new CustomEvent("neuroforge:state-changed"));
  }

  // ====== ONBOARDING ======
  function handleOnboarding() {
    const form = document.querySelector(".onboarding-form");
    if (!form) return;

    const button = form.querySelector("button");
    const selects = form.querySelectorAll("select");

    const check = () => {
      if (!button) return;
      button.disabled = [...selects].some(s => !s.value);
    };
    selects.forEach(s => s.addEventListener("change", check));
    // run once on load to set initial state
    check();

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const focus = Number(form.focus.value) || 0;
      const discipline = Number(form.discipline.value) || 0;
      const execution = Number(form.execution.value) || 0;
      const consistency = Number(form.consistency.value) || 0;

      const total = focus + discipline + execution + consistency;

      const result = {
        date: toLocalISODate(),
        focus, discipline, execution, consistency,
        total,
        mindType: calculateMindType(total),
        rank: calculateRank(total)
      };

      const history = getHistory();
      history.push(result);
      saveHistory(history);
      setLastIndex(history.length - 1);

      updateStreak();
      const streakBonus = getStreak() * 10;
      const xpGain = CONFIG.ONBOARDING_BASE_XP + total * 5 + streakBonus;
      grantXP(xpGain);

      const state = {
        historyCount: history.length,
        streak: getStreak(),
        xp: getXP(),
        level: getLevel(),
        rank: result.rank
      };

      checkAchievements(state);
      checkTimeAchievements();

      if (button) {
        button.textContent = "✅ Neural Data Saved";
        button.disabled = true;
      }

      // small delay then navigate to result page (if exists)
      setTimeout(() => window.location.href = "result.html", 500);
    });
  }

  // ====== RESULT ======
  function loadResult() {
    if (!document.querySelector("#result-title")) return;

    const history = getHistory();
    if (!history.length) return;

    const index = getLastIndex();
    const i = (Number.isFinite(index) && index !== null) ? index : history.length - 1;
    const r = history[Math.max(0, Math.min(history.length - 1, i))];

    const big = document.querySelector(".big-result");
    if (big) big.textContent = r.mindType;

    const rankLabel = document.querySelector("#rank-label");
    if (rankLabel) rankLabel.textContent = "🏆 Rank: " + r.rank;

    // Rank Progress
    const rankBar = document.querySelector("#resultProgress");
    const rankText = document.querySelector("#resultProgressText");
    if (rankBar && rankText) {
      const percent = progressToNextRankPercent(r.total);
      rankBar.style.width = percent + "%";
      rankBar.setAttribute("aria-valuenow", percent);
      rankText.textContent = `${percent}% to ${getNextRankName(r.rank)}`;
    }

    // XP Progress
    const xpBar = document.querySelector("#xpProgress");
    const xpText = document.querySelector("#xpProgressText");
    if (xpBar && xpText) {
      const xpInfo = getXPIntoLevel();
      const percent = Math.floor((xpInfo.current / xpInfo.required) * 100);
      xpBar.style.width = percent + "%";
      xpBar.setAttribute("aria-valuenow", percent);
      xpText.textContent = `🧬 Level ${xpInfo.level} — ${percent}% to next level`;
    }
  }

  // ====== DASHBOARD ======
  function loadDashboard() {
    if (!document.querySelector("#dashboard-title")) return;

    const history = getHistory();
    if (!history.length) return;

    const last = history[history.length - 1];

    const cards = document.querySelectorAll(".stat-card .big-result");
    if (cards.length >= 4) {
      cards[0].textContent = last.mindType;
      cards[1].textContent = `${last.total} / ${CONFIG.MAX_SCORE}`;
      cards[2].textContent = last.date;
      cards[3].textContent = last.rank;
    }

    const xpEl = document.querySelector("#xpValue");
    const levelEl = document.querySelector("#levelValue");
    const streakEl = document.querySelector("#streakValue");
    const loreEl = document.querySelector("#loreTitle");

    if (xpEl) xpEl.textContent = getXP();
    if (levelEl) levelEl.textContent = getLevel();
    if (streakEl) streakEl.textContent = getStreak();
    if (loreEl) loreEl.textContent = getLoreTitle(getLevel());
  }

  // ====== PROFILE ======
  function loadProfile() {
    const timeline = document.querySelector("#timelineList");
    if (!timeline) return;

    const history = getHistory();
    timeline.innerHTML = "";

    history.forEach((r, i) => {
      const li = document.createElement("li");
      li.className = "timeline-item";
      li.innerHTML = `
        <article>
          <strong>${r.date}</strong>
          <p>🧠 ${r.mindType}</p>
          <p>📊 Score: ${r.total} / ${CONFIG.MAX_SCORE}</p>
          <p>🏆 Rank: ${r.rank}</p>
          <button class="btn-secondary">📄 View Report</button>
        </article>
      `;
      const btn = li.querySelector("button");
      if (btn) {
        btn.addEventListener("click", () => {
          setLastIndex(i);
          window.location.href = "result.html";
        });
      }
      timeline.appendChild(li);
    });

    const achList = document.querySelector("#achievementList");
    if (achList) {
      const unlocked = getAchievements();
      achList.innerHTML = "";
      ALL_ACHIEVEMENTS.forEach(a => {
        const li = document.createElement("li");
        const isUnlocked = unlocked.includes(a.id);
        li.textContent = `${isUnlocked ? "✅" : "🔒"} ${a.title}`;
        achList.appendChild(li);
      });
    }
  }

  // ====== EXPORT / IMPORT / RESET HELPERS ======
  function exportData() {
    const payload = {
      history: getHistory(),
      achievements: getAchievements(),
      xp: getXP(),
      streak: getStreak(),
      lastActive: getLastActive()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neuroforge_export_${toLocalISODate()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("📤 Data exported");
  }

  function importData(json) {
    try {
      const obj = typeof json === "string" ? JSON.parse(json) : json;
      if (obj.history) safeSetJSON(KEYS.HISTORY, obj.history);
      if (obj.achievements) safeSetJSON(KEYS.ACHIEVEMENTS, obj.achievements);
      if (Number.isFinite(Number(obj.xp))) safeSetRaw(KEYS.XP, String(Number(obj.xp)));
      if (Number.isFinite(Number(obj.streak))) safeSetRaw(KEYS.STREAK, String(Number(obj.streak)));
      if (obj.lastActive) safeSetRaw(KEYS.LAST_ACTIVE, obj.lastActive);
      document.dispatchEvent(new CustomEvent("neuroforge:state-changed"));
      showToast("📥 Data imported");
      return true;
    } catch (err) {
      console.error("Import failed", err);
      showToast("❌ Import failed");
      return false;
    }
  }

  function resetAllData(confirmReset = true) {
    if (confirmReset && !confirm("Reset all Neuroforge data? This cannot be undone.")) return false;
    try {
      localStorage.removeItem(KEYS.HISTORY);
      localStorage.removeItem(KEYS.ACHIEVEMENTS);
      localStorage.removeItem(KEYS.XP);
      localStorage.removeItem(KEYS.STREAK);
      localStorage.removeItem(KEYS.LAST_ACTIVE);
      localStorage.removeItem(KEYS.LAST_INDEX);
      document.dispatchEvent(new CustomEvent("neuroforge:state-changed"));
      showToast("♻️ Data reset");
      return true;
    } catch (err) {
      console.error("Reset failed", err);
      showToast("❌ Reset failed");
      return false;
    }
  }

  // ====== INITIALIZATION ======
  function neuroforgeInit() {
    // Run maintenance
    applyDailyXPDecay();
    // Ensure achievements for time-of-day are checked
    checkTimeAchievements();

    // compute state-based achievements
    const history = getHistory();
    const lastEntry = history[history.length - 1] || {};
    const state = {
      historyCount: history.length,
      streak: getStreak(),
      xp: getXP(),
      level: getLevel(),
      rank: lastEntry.rank || null
    };
    checkAchievements(state);

    // wire onboarding
    handleOnboarding();

    // load views
    loadDashboard();
    loadResult();
    loadProfile();

    // UI should react to state changes (XP / streak / achievements)
    document.addEventListener("neuroforge:state-changed", () => {
      loadDashboard();
      loadResult();
      loadProfile();
    });

    // expose some debug elements if present
    const exportBtn = document.querySelector("#exportData");
    if (exportBtn) exportBtn.addEventListener("click", exportData);

    const importInput = document.querySelector("#importData");
    if (importInput) {
      importInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => importData(reader.result);
        reader.readAsText(file);
      });
    }

    const resetBtn = document.querySelector("#resetData");
    if (resetBtn) resetBtn.addEventListener("click", () => resetAllData(true));
  }

  // Bootstrap on DOM ready
  document.addEventListener("DOMContentLoaded", neuroforgeInit);

  // Public API for testing or extensions
  return {
    // state & utilities
    getHistory, saveHistory,
    getAchievements, saveAchievements,
    getXP, setXP,
    getStreak, setStreak,
    getLastActive, setLastActive,
    getLevel, getXPIntoLevel,
    grantXP, updateStreak,
    unlockAchievement,
    exportData, importData, resetAllData,
    // small helpers
    toLocalISODate, diffInDaysLocal,
    // constants (read-only views)
    CONFIG: Object.assign({}, CONFIG),
    RANK_THRESHOLDS: Object.freeze(RANK_THRESHOLDS)
  };
})();

/* End of app.js */
