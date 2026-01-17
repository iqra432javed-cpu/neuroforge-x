// static/js/app.js

// ================== STORAGE ==================
const getHistory = () => JSON.parse(localStorage.getItem("neuroforge_history") || "[]");
const saveHistory = (history) => localStorage.setItem("neuroforge_history", JSON.stringify(history));
const getToday = () => new Date().toISOString().split("T")[0];

// ================== ENGINE ==================
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

const generateAnalysis = (r) => {
  const insights = [];
  if (r.execution <= 2) insights.push("⚠️ Execution is your biggest weakness");
  if (r.consistency <= 2) insights.push("⚠️ Consistency is unstable");
  if (r.discipline <= 2) insights.push("⚠️ Discipline needs improvement");
  if (r.focus >= 4) insights.push("✅ Strong focus ability");
  if (r.discipline >= 4) insights.push("✅ Strong discipline");
  if (!insights.length) insights.push("💡 Balanced profile. Time to optimize.");
  return insights;
};

const generatePlan = (r) => {
  const plan = [];
  plan.push("Day 1: Clarify goals and remove distractions");
  plan.push("Day 2: Build a 60–90 min deep work block");
  if (r.execution <= 2) plan.push("Day 3: Finish one small task completely");
  else plan.push("Day 3: Increase execution intensity");
  if (r.discipline <= 2) plan.push("Day 4: Fix routine and sleep schedule");
  else plan.push("Day 4: Lock in your routine");
  plan.push("Day 5: Do work even when motivation is low");
  plan.push("Day 6: Review and optimize your system");
  plan.push("Day 7: Reflect and upgrade your plan");
  return plan.slice(0, 7);
};

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
    const execution = +form.confidence.value;
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

    button.textContent = "✅ Analysis Saved!";
    setTimeout(() => window.location.href = "result.html", 500);
  });
}

// ================== RESULT PAGE ==================
function loadResult() {
  if (!document.querySelector("#result-title")) return;

  const history = getHistory();
  if (!history.length) return;

  const index = +localStorage.getItem("neuroforge_last_index") || history.length - 1;
  const r = history[index];

  // Mind type
  const bigResult = document.querySelector(".big-result");
  if (bigResult) bigResult.textContent = r.mindType;

  // Rank
  const rankLabel = document.querySelector("#rank-label");
  if (rankLabel) rankLabel.textContent = "🏆 Rank: " + r.rank;

  // Bars
  const bars = document.querySelectorAll(".progress-fill");
  const labels = document.querySelectorAll(".score-label");
  const values = [r.focus, r.discipline, r.execution, r.consistency];

  bars.forEach((bar, i) => {
    const percent = (values[i] / 5) * 100;
    bar.style.width = "0";
    setTimeout(() => {
      bar.style.width = percent + "%";
      bar.setAttribute("aria-valuenow", percent);
    }, 200);
    if (labels[i]) labels[i].textContent = values[i] + " / 5";
  });

  // Analysis
  const analysisList = document.querySelector(".analysis");
  if (analysisList) {
    analysisList.innerHTML = "";
    generateAnalysis(r).forEach(t => {
      const li = document.createElement("li");
      li.textContent = t;
      analysisList.appendChild(li);
    });
  }

  // Rank Progress
  const progressBar = document.querySelector("#resultProgress");
  const progressText = document.querySelector("#resultProgressText");
  if (progressBar && progressText) {
    const percent = Math.min((r.total / 20) * 100, 100);
    progressBar.style.width = percent + "%";
    progressText.textContent = `${Math.round(percent)}% to ${getNextRank(r.rank)}`;
  }

  // Plan
  const planList = document.querySelector("#resultPlanList");
  if (planList) {
    planList.innerHTML = "";
    generatePlan(r).forEach(step => {
      const li = document.createElement("li");
      li.textContent = step;
      planList.appendChild(li);
    });
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

  const welcome = document.querySelector("#welcomeRank");
  if (welcome) welcome.textContent = last.rank;

  const progress = document.querySelector("#rankProgress");
  const progressText = document.querySelector("#rankProgressText");
  if (progress && progressText) {
    const percent = Math.min((last.total / 20) * 100, 100);
    progress.style.width = percent + "%";
    progressText.textContent = `${Math.round(percent)}% to ${getNextRank(last.rank)}`;
  }
}

// ================== PROFILE ==================
function loadProfile() {
  const timeline = document.querySelector("#timelineList");
  if (!timeline) return;

  const history = getHistory();
  timeline.innerHTML = "";

  history.forEach((r, index) => {
    const li = document.createElement("li");
    li.className = "timeline-item";
    li.innerHTML = `
      <article>
        <strong>${r.date}</strong>
        <p>🧠 ${r.mindType}</p>
        <p>📊 Score: ${r.total} / 20</p>
        <p>🏆 Rank: ${r.rank}</p>
        <button class="btn-secondary" data-index="${index}">📄 View Report</button>
      </article>
    `;
    timeline.appendChild(li);
  });

  timeline.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") {
      const i = e.target.dataset.index;
      localStorage.setItem("neuroforge_last_index", i);
      window.location.href = "result.html";
    }
  });
}

// ================== INIT ==================
document.addEventListener("DOMContentLoaded", () => {
  handleOnboarding();
  loadResult();
  loadDashboard();
  loadProfile();
});
