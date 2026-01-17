Here’s a **finalized refined version of `app.js`** that integrates all the fixes and enhancements we discussed. It’s clean, modular, and future‑proof:

```js
// ================== STORAGE ==================
const getHistory = () => JSON.parse(localStorage.getItem("neuroforge_history") || "[]");
const saveHistory = (history) => localStorage.setItem("neuroforge_history", JSON.stringify(history));

const getAchievements = () => JSON.parse(localStorage.getItem("neuroforge_achievements") || "[]");
const saveAchievements = (a) => localStorage.setItem("neuroforge_achievements", JSON.stringify(a));

const getXP = () => +localStorage.getItem("neuroforge_xp") || 0;
const setXP = (v) => localStorage.setItem("neuroforge_xp", v);

const getStreak = () => +localStorage.getItem("neuroforge_streak") || 0;
const setStreak = (v) => localStorage.setItem("neuroforge_streak", v);

const getLastActive = () => localStorage.getItem("neuroforge_last_active");
const setLastActive = (d) => localStorage.setItem("neuroforge_last_active", d);

const getToday = () => new Date().toISOString().split("T")[0];

// ================== LEVEL SYSTEM ==================
const xpForLevel = (level) => Math.floor(100 * Math.pow(level, 1.4) + level * 50);

function getLevel() {
  let xp = getXP();
  let level = 1;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
  }
  return level;
}

function getXPIntoLevel() {
  let xp = getXP();
  let level = 1;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
  }
  return { level, current: xp, required: xpForLevel(level) };
}

// ================== LORE TITLES ==================
function getLoreTitle(level) {
  if (level >= 100) return "🌌 Transcendent Entity";
  if (level >= 50) return "👑 Neural Overlord";
  if (level >= 20) return "🏛️ Architect of Will";
  if (level >= 10) return "🏹 Thought Warrior";
  if (level >= 5) return "⚔️ Mind Trainee";
  return "🧠 Wandering Mind";
}

// ================== RANK SYSTEM ==================
const calculateMindType = (total) => {
  if (total >= 17) return "Focused Architect";
  if (total >= 13) return "Strategic Builder";
  if (total >= 10) return "Growing Explorer";
  return "Unstable Dreamer";
};

const calculateRank = (total) => {
  if (total >= 17) return "Architect";
  if (total >= 13) return "Builder";
  if (total >= 10) return "Explorer";
  return "Dreamer";
};

const getNextRank = (rank) => {
  if (rank === "Dreamer") return "Explorer";
  if (rank === "Explorer") return "Builder";
  if (rank === "Builder") return "Architect";
  return "Architect";
};

// ================== ACHIEVEMENTS ==================
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
  { id: "night_owl", title: "🌙 Night Owl" }, // handled separately
  { id: "early_bird", title: "🌞 Early Bird" } // handled separately
];

function unlockAchievement(id) {
  const unlocked = getAchievements();
  if (unlocked.includes(id)) return false;

  unlocked.push(id);
  saveAchievements(unlocked);

  const a = ALL_ACHIEVEMENTS.find(x => x.id === id);
  showToast(`🏅 Achievement Unlocked: ${a ? a.title : id}`);
  return true;
}

function checkAchievements(state) {
  ALL_ACHIEVEMENTS.forEach(a => {
    if (a.check && a.check(state)) unlockAchievement(a.id);
  });
}

// ================== TIME ACHIEVEMENTS ==================
function checkTimeAchievements() {
  const hour = new Date().getHours();
  if (hour >= 0 && hour <= 4) unlockAchievement("night_owl");
  if (hour >= 5 && hour <= 8) unlockAchievement("early_bird");
}

// ================== XP ==================
function grantXP(amount) {
  setXP(getXP() + amount);
  showToast(`✨ +${amount} XP gained`);
}

function applyDailyXPDecay() {
  const last = getLastActive();
  const today = getToday();
  if (!last) return;

  const diffDays = Math.floor((new Date(today) - new Date(last)) / (1000 * 60 * 60 * 24));
  if (diffDays >= 1) {
    const xp = getXP();
    const loss = diffDays * 5; // 5 XP per inactive day
    setXP(Math.max(0, xp - loss));
    showToast(`⚠️ Inactivity penalty: -${loss} XP`);
  }
}

// ================== STREAK ==================
function updateStreak() {
  const today = getToday();
  const last = getLastActive();

  if (!last) {
    setStreak(1);
  } else {
    const diffDays = Math.floor((new Date(today) - new Date(last)) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      setStreak(getStreak() + 1);
      showToast(`🔥 Streak: ${getStreak()} days`);
    } else if (diffDays > 1) {
      setStreak(1);
      applyDailyXPDecay();
    }
  }
  setLastActive(today);
}

// ================== TOAST QUEUE ==================
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
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("visible"), 50);
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => {
      toast.remove();
      processToast();
    }, 500);
  }, 2500);
}

// ================== ONBOARDING ==================
function handleOnboarding() {
  const form = document.querySelector(".onboarding-form");
  if (!form) return;

  const button = form.querySelector("button");
  const selects = form.querySelectorAll("select");

  const check = () => {
    button.disabled = [...selects].some(s => !s.value);
  };
  selects.forEach(s => s.addEventListener("change", check));

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const focus = +form.focus.value;
    const discipline = +form.discipline.value;
    const execution = +form.execution.value;
    const consistency = +form.consistency.value;

    const total = focus + discipline + execution + consistency;

    const result = {
      date: getToday(),
      focus, discipline, execution, consistency,
      total,
      mindType: calculateMindType(total),
      rank: calculateRank(total)
    };

    const history = getHistory();
    history.push(result);
    saveHistory(history);
    localStorage.setItem("neuroforge_last_index", history.length - 1);

    updateStreak();
    grantXP(50 + total * 5 + getStreak() * 10);

    const state = {
      historyCount: history.length,
      streak: getStreak(),
      xp: getXP(),
      level: getLevel(),
      rank: result.rank
    };

    checkAchievements(state);
    checkTimeAchievements();

    button.textContent = "✅ Neural Data Saved";
    setTimeout(() => window.location.href = "result.html", 500);
  });
}

// ================== RESULT ==================
function loadResult() {
  if (!document.querySelector("#result-title")) return;

  const history = getHistory();
  if (!history.length) return;

  const index = +localStorage.getItem("neuroforge_last_index") || history.length - 1;
  const r = history[index];

  const big = document.querySelector(".big-result");
  if (big) big.textContent = r.mindType;

  const rankLabel = document.querySelector("#rank-label");
  if (rankLabel) rankLabel.textContent = "🏆 Rank: " + r.rank;

  // ===== Rank Progress =====
  const rankBar = document.querySelector("#resultProgress");
  const rankText = document.querySelector("#resultProgressText");
  if (rankBar && rankText) {
    const percent = Math.min((r.total / 20) * 100, 100);
    rankBar.style.width = percent + "%";
    rankBar.setAttribute("aria-valuenow", percent);
    rankText.textContent = `${Math.round(percent)}% to ${getNextRank(r.rank)}`;
  }

  // ===== XP Progress =====
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

// ================== DASHBOARD ==================
function loadDashboard() {
  if (!document.querySelector("#dashboard-title")) return;

  const history = getHistory();
  if (!history.length) return;

  const last = history[history.length - 1];

  const cards = document.querySelectorAll(".stat-card .big-result");
  if (cards.length >= 4) {
    cards[0].textContent = last.mindType;
    cards[1].textContent = `${last.total} / 20`;
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

// ================== PROFILE ==================
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
        <p>📊 Score: ${r.total} / 20</p>
        <p>🏆 Rank: ${r.rank}</p>
        <button class="btn-secondary">📄 View Report</button>
      </article>
    `;

    li.querySelector("button").addEventListener("click", () => {
      localStorage.setItem("neuroforge_last_index", i);
      window.location.href = "result.html";
    });

    timeline.appendChild(li);
  });

  // ===== Achievements List (if exists) =====
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

// ================== INIT ==================
document.addEventListener("DOMContentLoaded", () => {
  handleOnboarding();
  loadResult();
  loadDashboard();
  loadProfile();
});
