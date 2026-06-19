const STORAGE_KEY = "health-daily-v2";
const OLD_STORAGE_KEY = "health-daily-v1";
const TASK_LABELS = {
  medicine: "吃药",
  exercise: "运动",
  weight: "体重"
};

const todayKey = () => new Date().toLocaleDateString("sv-SE");
const blankDay = () => ({ medicine: false, exercise: false, weight: null });

function createProfile(name, days = {}) {
  const trimmed = name.trim() || "家人";
  return {
    id: globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: trimmed,
    avatar: trimmed.slice(0, 1),
    days
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);

  const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || "null");
  const firstProfile = createProfile("安安", old?.days || {});
  return {
    activeProfileId: firstProfile.id,
    reminderEnabled: false,
    lastReminderDate: null,
    profiles: [firstProfile]
  };
}

const state = loadState();
state.profiles ||= [createProfile("安安")];
state.activeProfileId ||= state.profiles[0].id;

const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

function activeProfile() {
  return state.profiles.find(profile => profile.id === state.activeProfileId) || state.profiles[0];
}

function ensureToday(profile = activeProfile()) {
  profile.days ||= {};
  profile.days[todayKey()] ||= blankDay();
  return profile.days[todayKey()];
}

const today = () => ensureToday(activeProfile());

const dateLabel = document.querySelector("#dateLabel");
const activeProfileAvatar = document.querySelector("#activeProfileAvatar");
const activeProfileName = document.querySelector("#activeProfileName");
const profileMenuButton = document.querySelector("#profileMenuButton");
const profileList = document.querySelector("#profileList");
const addProfileButton = document.querySelector("#addProfileButton");
const reminderButton = document.querySelector("#reminderButton");
const reminderCard = document.querySelector("#reminderCard");
const reminderTitle = document.querySelector("#reminderTitle");
const reminderText = document.querySelector("#reminderText");
const enableReminder = document.querySelector("#enableReminder");
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
const backdrop = document.querySelector("#sheetBackdrop");
const weightSheet = document.querySelector("#weightSheet");
const profileSheet = document.querySelector("#profileSheet");
const weightInput = document.querySelector("#weightInput");
const profileNameInput = document.querySelector("#profileNameInput");
const toast = document.querySelector("#toast");

dateLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
  month: "long", day: "numeric", weekday: "long"
}).format(new Date());

function completedCount(day = today()) {
  return Number(Boolean(day.medicine)) + Number(Boolean(day.exercise)) + Number(day.weight !== null);
}

function pendingTasks(day = today()) {
  return Object.entries(TASK_LABELS)
    .filter(([key]) => key === "weight" ? day.weight === null : !day[key])
    .map(([, label]) => label);
}

function allPendingSummaries() {
  return state.profiles
    .map(profile => {
      const pending = pendingTasks(ensureToday(profile));
      return pending.length ? `${profile.name}：${pending.join("、")}` : "";
    })
    .filter(Boolean);
}

function calculateStreak(profile = activeProfile()) {
  let streak = 0;
  const cursor = new Date();
  if (completedCount(ensureToday(profile)) < 3) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const key = cursor.toLocaleDateString("sv-SE");
    if (!profile.days[key] || completedCount(profile.days[key]) < 3) return streak;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
}

function renderProfiles() {
  profileList.innerHTML = "";
  state.profiles.forEach(profile => {
    ensureToday(profile);
    const count = completedCount(profile.days[todayKey()]);
    const button = document.createElement("button");
    button.className = `profile-chip${profile.id === state.activeProfileId ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <span class="chip-avatar">${profile.avatar}</span>
      <span class="chip-copy">
        <strong>${profile.name}</strong>
        <small>今日完成 ${count}/3</small>
      </span>
      <span class="chip-actions">
        ${state.profiles.length > 1 ? `<span class="delete-profile" data-delete="${profile.id}">删除</span>` : ""}
      </span>
    `;
    button.addEventListener("click", event => {
      const deleteId = event.target.dataset.delete;
      if (deleteId) {
        deleteProfile(deleteId);
        return;
      }
      state.activeProfileId = profile.id;
      showToast(`已切换到 ${profile.name}`);
      render();
    });
    profileList.appendChild(button);
  });
}

function deleteProfile(profileId) {
  if (state.profiles.length <= 1) {
    showToast("至少需要保留一个使用者");
    return;
  }
  const profile = state.profiles.find(item => item.id === profileId);
  const confirmed = confirm(`确定删除 ${profile.name} 的所有记录吗？`);
  if (!confirmed) return;
  state.profiles = state.profiles.filter(item => item.id !== profileId);
  if (state.activeProfileId === profileId) state.activeProfileId = state.profiles[0].id;
  showToast("已删除使用者");
  render();
}

function renderChart() {
  const profile = activeProfile();
  const points = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toLocaleDateString("sv-SE");
    const weight = profile.days[key]?.weight;
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

function renderReminder() {
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  reminderCard.classList.toggle("enabled", state.reminderEnabled && permission === "granted");
  if (permission === "unsupported") {
    reminderTitle.textContent = "当前浏览器不支持通知";
    reminderText.textContent = "请在 iPhone 主屏幕打开这个 App，并使用 iOS 16.4 或更新系统。";
    enableReminder.textContent = "不可用";
    enableReminder.disabled = true;
    return;
  }
  if (state.reminderEnabled && permission === "granted") {
    reminderTitle.textContent = "22:00 未完成提醒已开启";
    reminderText.textContent = "每天打开过 App 后，会自动预约今晚 10 点，检查所有使用者的未完成事项。";
    enableReminder.textContent = "已开启";
    enableReminder.disabled = true;
    return;
  }
  if (permission === "denied") {
    reminderTitle.textContent = "通知权限已关闭";
    reminderText.textContent = "请到 iPhone 设置里允许“每日健康”的通知，然后回到 App。";
    enableReminder.textContent = "已关闭";
    enableReminder.disabled = true;
    return;
  }
  reminderTitle.textContent = "22:00 未完成提醒未开启";
  reminderText.textContent = "开启后，App 会在晚上 10 点提醒所有使用者还有哪些事项没完成。";
  enableReminder.textContent = "开启";
  enableReminder.disabled = false;
}

function render() {
  const profile = activeProfile();
  const day = ensureToday(profile);
  const count = completedCount(day);
  activeProfileAvatar.textContent = profile.avatar;
  activeProfileName.textContent = profile.name;
  document.querySelector(".avatar span").textContent = state.reminderEnabled ? "🔔" : "⏰";
  document.querySelectorAll("[data-task]").forEach(card => card.classList.toggle("done", day[card.dataset.task]));
  weightTask.classList.toggle("done", day.weight !== null);
  weightTaskHint.textContent = day.weight !== null ? `今日已记录 ${day.weight.toFixed(1)} kg，点击可修改` : "记录今天身体的变化";
  currentWeight.textContent = day.weight !== null ? `${day.weight.toFixed(1)} kg` : "-- kg";
  progressRing.style.background = `conic-gradient(var(--green) ${count * 120}deg, #e5e8e3 0deg)`;
  progressValue.textContent = `${count}/3`;
  completionText.textContent = count === 0 ? "还未开始" : count === 3 ? "全部完成" : `已完成 ${count} 项`;
  progressTitle.textContent = ["慢慢来，先完成一件", "很好，已经开始了", "只差最后一件", `${profile.name} 今天完成啦`][count];
  progressHint.textContent = count === 3 ? "每一次坚持，都在照顾未来的自己。" : "规律的小事，也会带来很大的改变。";
  streakValue.textContent = calculateStreak(profile);
  renderProfiles();
  renderReminder();
  renderChart();
  save();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function showNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (navigator.serviceWorker?.ready) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, {
        body,
        icon: "icons/app-icon-blue.png",
        badge: "icons/app-icon-blue.png"
      });
    });
    return;
  }
  new Notification(title, { body, icon: "icons/app-icon-blue.png" });
}

function scheduleReminder() {
  clearTimeout(scheduleReminder.timer);
  if (!state.reminderEnabled || !("Notification" in window) || Notification.permission !== "granted") return;

  const now = new Date();
  const target = new Date();
  target.setHours(22, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  scheduleReminder.timer = setTimeout(() => {
    const pending = allPendingSummaries();
    state.lastReminderDate = todayKey();
    save();
    if (pending.length) {
      showNotification("每日健康：还有事项未完成", pending.join("；"));
    } else {
      showNotification("每日健康：今天都完成了", "所有使用者的吃药、运动和体重记录都已经完成。");
    }
    scheduleReminder();
  }, target - now);
}

function checkMissedReminder() {
  if (!state.reminderEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const alreadyReminded = state.lastReminderDate === todayKey();
  if (now.getHours() < 22 || alreadyReminded) return;
  const pending = allPendingSummaries();
  if (!pending.length) return;
  state.lastReminderDate = todayKey();
  save();
  showNotification("每日健康：还有事项未完成", pending.join("；"));
}

function openSheet(sheet) {
  sheet.hidden = false;
  backdrop.hidden = false;
}

function closeSheets() {
  weightSheet.hidden = true;
  profileSheet.hidden = true;
  backdrop.hidden = true;
}

function openWeightSheet() {
  weightInput.value = today().weight ?? "";
  openSheet(weightSheet);
  setTimeout(() => weightInput.focus(), 100);
}

function openProfileSheet() {
  profileNameInput.value = "";
  openSheet(profileSheet);
  setTimeout(() => profileNameInput.focus(), 100);
}

document.querySelectorAll("[data-task]").forEach(card => card.addEventListener("click", () => {
  const key = card.dataset.task;
  today()[key] = !today()[key];
  showToast(today()[key] ? `${TASK_LABELS[key]}已完成` : "已取消打卡");
  render();
}));

weightTask.addEventListener("click", openWeightSheet);
addProfileButton.addEventListener("click", openProfileSheet);
profileMenuButton.addEventListener("click", () => profileList.scrollIntoView({ behavior: "smooth", block: "center" }));
reminderButton.addEventListener("click", () => enableReminder.click());
document.querySelectorAll("[data-close-sheet]").forEach(button => button.addEventListener("click", closeSheets));
backdrop.addEventListener("click", closeSheets);

document.querySelector("#saveWeight").addEventListener("click", () => {
  const value = Number(weightInput.value);
  if (!value || value < 20 || value > 300) {
    showToast("请输入 20 至 300 kg 之间的体重");
    return;
  }
  today().weight = Math.round(value * 10) / 10;
  closeSheets();
  showToast("今天的体重已记录");
  render();
});

document.querySelector("#saveProfile").addEventListener("click", () => {
  const name = profileNameInput.value.trim();
  if (!name) {
    showToast("请输入使用者姓名");
    return;
  }
  const profile = createProfile(name);
  state.profiles.push(profile);
  state.activeProfileId = profile.id;
  closeSheets();
  showToast(`已新增 ${profile.name}`);
  render();
});

enableReminder.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showToast("当前浏览器不支持通知");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    showToast("通知权限没有开启");
    render();
    return;
  }
  state.reminderEnabled = true;
  showToast("22:00 提醒已开启");
  render();
  scheduleReminder();
});

weightInput.addEventListener("keydown", event => {
  if (event.key === "Enter") document.querySelector("#saveWeight").click();
});

profileNameInput.addEventListener("keydown", event => {
  if (event.key === "Enter") document.querySelector("#saveProfile").click();
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

state.profiles.forEach(ensureToday);
render();
scheduleReminder();
checkMissedReminder();
