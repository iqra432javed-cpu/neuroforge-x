// static/js/app.js

// ========== UTILITIES ==========
function getHistory() {
  return JSON.parse(localStorage.getItem("neuroforge_history") || "[]");
}

function saveHistory(history) {
  localStorage.setItem("neuroforge_history", JSON.stringify(history));
}

function getToday() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

// ========== MIND ENGINE ==========
function calculateMindType(total) {
  if (total >= 16) return "Focused Architect";
  if (total >= 13) return "Strategic Explorer";
  if (total >= 10) return "Growing Explorer";
  return "Unstable Dreamer";
}

// score‑based rank logic
function calculateRank(total) {
  if (total >= 17) return "Architect";
  if (total >= 13) return "Builder";
  if (total >= 10) return "Explorer";
  return "Dreamer";
}

function generateAnalysis(result) {
  const analysis = [];
  if (result.execution <= 2) analysis.push("⚠️ Execution is your biggest weakness");
  if (result.consistency <= 2) analysis.push("⚠️ Consistency is unstable");
  if (result.discipline <= 2) analysis.push("⚠️ Discipline needs improvement");
  if (result.focus >= 4) analysis.push("✅ Strong focus ability");
  if (result.discipline >= 4) analysis.push("✅ Strong discipline");
  if (analysis.length === 0) analysis.push("💡 Balanced profile, time to optimize");
  return analysis;
}

// ========== ONBOARDING SUBMIT ==========
function handleOnboarding() {
  const form = document.querySelector(".onboarding-form");
  if (!form) return;

  const button = form.querySelector("button");
  const selects = form.querySelectorAll("select");

  // Enable button only when all selected
  function check() {
    let ok = true;
    selects.forEach(s => { if (!s.value) ok = false; });
    button.disabled = !ok;
  }

  selects.forEach(s => s.addEventListener("change", check));

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const focus = parseInt(form.focus.value) || 0;
    const discipline = parseInt(form.discipline.value) || 0;
    const confidence = parseInt(form.confidence.value) || 0;
    const consistency = parseInt(form.consistency.value) || 0;

    const total = focus + discipline + confidence + consistency;

    const result = {
      date: getToday(),
      focus,
      discipline,
      execution: confidence,
      consistency,
      total,
      mindType: calculateMindType(total)
    };

    const history = getHistory();

    // prevent duplicate same‑day spam
    if (history.length && history[history.length - 1].date === result.date) {
      history[history.length - 1] = result;
    } else {
      history.push(result);
    }

    saveHistory(history);

    // Save last viewed index
    localStorage.setItem("neuroforge_last_index", history.length - 1);

    // Go to result page
    window.location.href = "result.html";
  });
}

// ========== LOAD RESULT ==========
function loadResult() {
  const resultTitle = document.querySelector("#result-title");
  if (!resultTitle) return;

  const history = getHistory();
  if (history.length === 0) return;

  const index = parseInt(localStorage.getItem("neuroforge_last_index") || (history.length - 1));
  const r = history[index];

  // Fill data
  const bigResult = document.querySelector(".big-result");
  if (bigResult) bigResult.textContent = r.mindType;

  const bars = document.querySelectorAll(".progress-fill");
  const labels = document.querySelectorAll(".score-label");
  const values = [r.focus, r.discipline, r.execution, r.consistency];

  bars.forEach((bar, i) => {
    const percent = (values[i] / 5) * 100;
    bar.style.width = "0";
    setTimeout(() => {
      bar.style.width = percent + "%";
    }, 200);

    if (labels[i]) {
      labels[i].textContent = values[i] + " / 5";
    }
  });

  // Analysis list
  const analysisList = document.querySelector(".analysis");
  if (analysisList) {
    analysisList.innerHTML = "";
    generateAnalysis(r).forEach(item => {
      const li = document.createElement("li");
      li.textContent = item;
      analysisList.appendChild(li);
    });
  }
}

// ========== DASHBOARD ==========
function loadDashboard() {
  const dash = document.querySelector("#dashboard-title");
  if (!dash) return;

  const history = getHistory();
  if (history.length === 0) return;

  const last = history[history.length - 1];

  const cards = document.querySelectorAll(".stat-card .big-result");
  if (cards.length >= 4) {
    cards[0].textContent = last.mindType;
    cards[1].textContent = last.total + " / 20";
    cards[2].textContent = last.date;
    cards[3].textContent = calculateRank(last.total);
  }
}

// ========== PROFILE TIMELINE ==========
function loadProfile() {
  const timeline = document.querySelector(".timeline");
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
        <button type="button" class="btn-secondary" data-index="${index}">📄 View Report</button>
      </article>
    `;
    timeline.appendChild(li);
  });

  timeline.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") {
      const i = e.target.getAttribute("data-index");
      localStorage.setItem("neuroforge_last_index", i);
      window.location.href = "result.html";
    }
  });
}

// ========== INIT ==========
document.addEventListener("DOMContentLoaded", () => {
  handleOnboarding();
  loadResult();
  loadDashboard();
  loadProfile();
});
const rankLabel = document.querySelector("#rank-label");
if(rankLabel){
  rankLabel.textContent = "🏆 Rank: " + calculateRank(r.total);
}
