const STORAGE_KEY = "health-daily-v1";
const todayKey = () => new Date().toLocaleDateString("sv-SE");

const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"days":{}}');
state.days ||= {};
state.days[todayKey()] ||= { medicine: false, exercise: false, weight: null };

const today = () => state.days[todayKey()];
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

const dateLabel = document.querySelector("#dateLabel");
const progressRing = document.querySelector("#progressRing");
const progressValue = document.querySelector("#progressValue");
const progressTitle = document.querySelector("#progressTitle");
const progressHint = document.querySelector("#progressHint");
const completionText = document.querySelector("#completionText");
const streakValue = document.querySelector("#streakValue");
const weightTask = document.querySelector("#weightTask");
const weightTaskHint = document.querySelector("#weightTaskHint");
const currentWeight = document.querySelector("#currentWeight");
const weightChart = document.querySelector("#weightChart");
const chartEmpty = document.querySelector("#chartEmpty");
const sheet = document.querySelector("#weightSheet");
const backdrop = document.querySelector("#sheetBackdrop");
const weightInput = document.querySelector("#weightInput");
const toast = document.querySelector("#toast");

dateLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
  month: "long", day: "numeric", weekday: "long"
}).format(new Date());

function completedCount(day = today()) {
  return Number(Boolean(day.medicine)) + Number(Boolean(day.exercise)) + Number(day.weight !== null);
}

function calculateStreak() {
  let streak = 0;
  const cursor = new Date();
  if (completedCount(today()) < 3) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const key = cursor.toLocaleDateString("sv-SE");
    if (!state.days[key] || completedCount(state.days[key]) < 3) return streak;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
}

function renderChart() {
  const points = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toLocaleDateString("sv-SE");
    const weight = state.days[key]?.weight;
    points.push({ date, weight: typeof weight === "number" ? weight : null });
  }
  const values = points.filter(point => point.weight !== null).map(point => point.weight);
  chartEmpty.hidden = values.length > 0;
  weightChart.innerHTML = "";
  if (!values.length) return;
  const min = Math.min(...values) - .5;
  const max = Math.max(...values) + .5;
  points.forEach(point => {
    const column = document.createElement("div");
    column.className = "chart-column";
    const height = point.weight === null ? 0 : 25 + ((point.weight - min) / (max - min || 1)) * 70;
    column.innerHTML = point.weight === null
      ? `<span class="chart-value">&nbsp;</span><span class="chart-bar" style="height:5px;opacity:.13"></span><span class="chart-day">${point.date.getMonth() + 1}/${point.date.getDate()}</span>`
      : `<span class="chart-value">${point.weight}</span><span class="chart-bar" style="height:${height}px"></span><span class="chart-day">${point.date.getMonth() + 1}/${point.date.getDate()}</span>`;
    weightChart.appendChild(column);
  });
}

function render() {
  const day = today();
  const count = completedCount(day);
  document.querySelectorAll("[data-task]").forEach(card => card.classList.toggle("done", day[card.dataset.task]));
  weightTask.classList.toggle("done", day.weight !== null);
  weightTaskHint.textContent = day.weight !== null ? `今日已记录 ${day.weight.toFixed(1)} kg，点击可修改` : "记录今天身体的变化";
  currentWeight.textContent = day.weight !== null ? `${day.weight.toFixed(1)} kg` : "-- kg";
  progressRing.style.background = `conic-gradient(var(--green) ${count * 120}deg, #e5e8e3 0deg)`;
  progressValue.textContent = `${count}/3`;
  completionText.textContent = count === 0 ? "还未开始" : count === 3 ? "全部完成" : `已完成 ${count} 项`;
  progressTitle.textContent = ["慢慢来，先完成一件", "很好，已经开始了", "只差最后一件", "今天的计划完成啦"][count];
  progressHint.textContent = count === 3 ? "每一次坚持，都在照顾未来的自己。" : "规律的小事，也会带来很大的改变。";
  streakValue.textContent = calculateStreak();
  renderChart();
  save();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function openSheet() {
  weightInput.value = today().weight ?? "";
  sheet.hidden = false;
  backdrop.hidden = false;
  setTimeout(() => weightInput.focus(), 100);
}

function closeSheet() {
  sheet.hidden = true;
  backdrop.hidden = true;
}

document.querySelectorAll("[data-task]").forEach(card => card.addEventListener("click", () => {
  const key = card.dataset.task;
  today()[key] = !today()[key];
  showToast(today()[key] ? `${key === "medicine" ? "吃药" : "运动"}已完成` : "已取消打卡");
  render();
}));

weightTask.addEventListener("click", openSheet);
document.querySelector("#sheetClose").addEventListener("click", closeSheet);
backdrop.addEventListener("click", closeSheet);
document.querySelector("#saveWeight").addEventListener("click", () => {
  const value = Number(weightInput.value);
  if (!value || value < 20 || value > 300) {
    showToast("请输入 20 至 300 kg 之间的体重");
    return;
  }
  today().weight = Math.round(value * 10) / 10;
  closeSheet();
  showToast("今天的体重已记录");
  render();
});

weightInput.addEventListener("keydown", event => {
  if (event.key === "Enter") document.querySelector("#saveWeight").click();
});

render();
