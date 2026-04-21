const phoneInput = document.querySelector("#phone");
const codeInput = document.querySelector("#code");
const sendCodeBtn = document.querySelector("#sendCodeBtn");
const submitBtn = document.querySelector("#submitBtn");
const loginForm = document.querySelector("#loginForm");
const message = document.querySelector("#message");

const authView = document.querySelector("#authView");
const dashboardView = document.querySelector("#dashboardView");
const logoutBtn = document.querySelector("#logoutBtn");
const welcomeText = document.querySelector("#welcomeText");
const profileOutput = document.querySelector("#profileOutput");

const cacheNoteInput = document.querySelector("#cacheNoteInput");
const historySearchInput = document.querySelector("#historySearchInput");
const saveSessionBtn = document.querySelector("#saveSessionBtn");
const saveLocalBtn = document.querySelector("#saveLocalBtn");
const saveMysqlBtn = document.querySelector("#saveMysqlBtn");
const clearCacheBtn = document.querySelector("#clearCacheBtn");
const refreshProfileBtn = document.querySelector("#refreshProfileBtn");

const memoryStatus = document.querySelector("#memoryStatus");
const sessionStatus = document.querySelector("#sessionStatus");
const localStatus = document.querySelector("#localStatus");
const memoryOutput = document.querySelector("#memoryOutput");
const sessionOutput = document.querySelector("#sessionOutput");
const localOutput = document.querySelector("#localOutput");
const sessionHistoryOutput = document.querySelector("#sessionHistoryOutput");
const localHistoryOutput = document.querySelector("#localHistoryOutput");

const TOKEN_KEY = "demo_sms_token";
const USER_KEY = "demo_sms_user";
const SESSION_NOTE_KEY = "demo_cache_session_note";
const LOCAL_NOTE_KEY = "demo_cache_local_note";
const SESSION_HISTORY_KEY = "demo_cache_session_history";
const LOCAL_HISTORY_KEY = "demo_cache_local_history";

const memoryCache = {
  note: "",
  updatedAt: "",
};

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = "message";
  if (type) {
    message.classList.add(`is-${type}`);
  }
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function validateCode(code) {
  return /^\d{4}$/.test(code);
}

function nowLabel() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function getStoredHistory(storage, key) {
  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(storage, key, note) {
  const nextEntry = {
    historyId: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    note,
    createdAt: nowLabel(),
  };
  const history = [nextEntry, ...getStoredHistory(storage, key)].slice(0, 10);
  storage.setItem(key, JSON.stringify(history));
}

function normalizeUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  return {
    ...user,
    id: user.id ?? null,
  };
}

function normalizeSaveLocalResult(result, fallbackNote) {
  if (!result || typeof result !== "object") {
    return {
      id: null,
      ny: fallbackNote,
    };
  }

  return {
    ...result,
    id: result.id ?? null,
    ny: result.ny ?? fallbackNote,
  };
}

function renderHistoryList(container, items) {
  if (!items.length) {
    container.innerHTML = '<p class="history-empty">暂无历史</p>';
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="history-item">
          <p class="history-item__time">${item.createdAt}</p>
          <p class="history-item__text">${item.note}</p>
        </article>
      `
    )
    .join("");
}

function showAuthView() {
  authView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
}

function showDashboardView() {
  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
}

function renderProfile(user) {
  if (!user) {
    welcomeText.textContent = "这里会演示不同缓存位置的生命周期和使用场景。";
    profileOutput.textContent = "暂无用户信息";
    return;
  }

  const normalizedUser = normalizeUser(user);
  const idLabel =
    normalizedUser.id === null || normalizedUser.id === undefined
      ? "暂未返回"
      : normalizedUser.id;

  welcomeText.textContent = `欢迎回来，${normalizedUser.nickname}。你现在看到的是登录后的二级界面。`;
  profileOutput.textContent = JSON.stringify(
    {
      source: "浏览器 token + Redis 会话",
      cachedAt: nowLabel(),
      explanation: "前端保存 token，请求 /me 时由后端去 Redis 取回用户信息。",
      primaryKeyId: idLabel,
      user: normalizedUser,
    },
    null,
    2
  );
}

function renderCacheLab() {
  const sessionNote = sessionStorage.getItem(SESSION_NOTE_KEY) || "";
  const localNote = localStorage.getItem(LOCAL_NOTE_KEY) || "";
  const keyword = historySearchInput.value.trim().toLowerCase();
  const sessionHistory = getStoredHistory(sessionStorage, SESSION_HISTORY_KEY);
  const localHistory = getStoredHistory(localStorage, LOCAL_HISTORY_KEY);
  const filteredSessionHistory = keyword
    ? sessionHistory.filter((item) => item.note.toLowerCase().includes(keyword))
    : sessionHistory;
  const filteredLocalHistory = keyword
    ? localHistory.filter((item) => item.note.toLowerCase().includes(keyword))
    : localHistory;

  memoryOutput.textContent = memoryCache.note
    ? JSON.stringify(memoryCache, null, 2)
    : "暂无内容";
  sessionOutput.textContent = sessionNote || "暂无内容";
  localOutput.textContent = localNote || "暂无内容";
  renderHistoryList(sessionHistoryOutput, filteredSessionHistory);
  renderHistoryList(localHistoryOutput, filteredLocalHistory);

  memoryStatus.textContent = memoryCache.note
    ? `已有内存缓存，最后更新于 ${memoryCache.updatedAt}。刷新页面后会消失。`
    : "页面运行期间可用，刷新后消失。";

  sessionStatus.textContent = sessionHistory.length
    ? `当前标签页里已有 ${sessionHistory.length} 条 sessionStorage 历史，关闭该标签页后会消失。`
    : "当前标签页有效，关闭标签页后消失。";

  localStatus.textContent = localHistory.length
    ? `localStorage 里已有 ${localHistory.length} 条历史，刷新页面或重新打开浏览器后通常还在。`
    : "刷新页面后仍然存在，适合保存登录态。";
}

function enterDashboard(user) {
  showDashboardView();
  renderProfile(user || getStoredUser());
  renderCacheLab();
}

function resetAuthForm() {
  phoneInput.value = "";
  codeInput.value = "";
  submitBtn.disabled = false;
  submitBtn.textContent = "登录 / 注册";
  sendCodeBtn.disabled = false;
  sendCodeBtn.textContent = "获取验证码";
}

async function sendSmsCode(phone) {
  const response = await fetch("http://127.0.0.1:8000/send_code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || "验证码发送失败");
  }

  return result;
}

async function loginWithSms(phone, code) {
  const response = await fetch("http://127.0.0.1:8000/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone, code }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || "登录失败");
  }

  return result;
}

async function fetchCurrentUser() {
  const response = await fetch("http://127.0.0.1:8000/me", {
    method: "GET",
    headers: {
      ...getAuthHeaders(),
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || "获取用户失败");
  }

  return result;
}

async function saveLocalStorageToMysql(ny) {
  const response = await fetch("http://127.0.0.1:8000/save_local", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ ny }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || "保存到 MySQL 失败");
  }

  return normalizeSaveLocalResult(result, ny);
}

(async function init() {
  const token = getToken();
  const cachedUser = getStoredUser();

  if (!token) {
    showAuthView();
    renderCacheLab();
    return;
  }

  if (cachedUser) {
    enterDashboard(cachedUser);
  }

  try {
    const result = await fetchCurrentUser();
    const normalizedUser = normalizeUser(result.user);
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
    enterDashboard(normalizedUser);
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    showAuthView();
    setMessage("登录状态已失效，请重新登录", "error");
  }
})();

sendCodeBtn.addEventListener("click", async () => {
  const phone = phoneInput.value.trim();

  if (!validatePhone(phone)) {
    setMessage("请输入正确手机号", "error");
    return;
  }

  try {
    setMessage("发送中...");
    sendCodeBtn.disabled = true;

    const result = await sendSmsCode(phone);
    setMessage(`验证码：${result.code}`, "success");
    codeInput.value = result.code;
  } catch (err) {
    setMessage(err.message, "error");
  } finally {
    sendCodeBtn.disabled = false;
    sendCodeBtn.textContent = "获取验证码";
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const phone = phoneInput.value.trim();
  const code = codeInput.value.trim();

  if (!validatePhone(phone)) {
    setMessage("手机号格式错误", "error");
    return;
  }

  if (!validateCode(code)) {
    setMessage("验证码必须是4位数字", "error");
    return;
  }

  try {
    setMessage("登录中...");
    submitBtn.disabled = true;

    const result = await loginWithSms(phone, code);
    localStorage.setItem(TOKEN_KEY, result.token);

    const userResult = await fetchCurrentUser();
    const normalizedUser = normalizeUser(userResult.user);
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));

    setMessage("");
    enterDashboard(normalizedUser);
  } catch (err) {
    setMessage(err.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

refreshProfileBtn.addEventListener("click", async () => {
  try {
    refreshProfileBtn.disabled = true;
    refreshProfileBtn.textContent = "刷新中...";

    const result = await fetchCurrentUser();
    const normalizedUser = normalizeUser(result.user);
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
    renderProfile(normalizedUser);
    renderCacheLab();
  } catch (err) {
    alert(err.message);
  } finally {
    refreshProfileBtn.disabled = false;
    refreshProfileBtn.textContent = "从接口刷新";
  }
});

saveSessionBtn.addEventListener("click", () => {
  const note = cacheNoteInput.value.trim();

  if (!note) {
    alert("先输入一点学习笔记再保存。");
    return;
  }

  memoryCache.note = note;
  memoryCache.updatedAt = nowLabel();
  sessionStorage.setItem(SESSION_NOTE_KEY, note);
  saveHistory(sessionStorage, SESSION_HISTORY_KEY, note);
  renderCacheLab();
});

saveLocalBtn.addEventListener("click", () => {
  const note = cacheNoteInput.value.trim();

  if (!note) {
    alert("先输入一点学习笔记再保存。");
    return;
  }

  memoryCache.note = note;
  memoryCache.updatedAt = nowLabel();
  localStorage.setItem(LOCAL_NOTE_KEY, note);
  saveHistory(localStorage, LOCAL_HISTORY_KEY, note);
  renderCacheLab();
});

saveMysqlBtn.addEventListener("click", async () => {
  const localNote = localStorage.getItem(LOCAL_NOTE_KEY) || "";

  if (!localNote) {
    alert("请先存一条 localStorage 内容，再保存到 MySQL。");
    return;
  }

  try {
    saveMysqlBtn.disabled = true;
    saveMysqlBtn.textContent = "保存中...";

    const result = await saveLocalStorageToMysql(localNote);
    const idText =
      result.id === null || result.id === undefined ? "未返回 id" : `id=${result.id}`;
    alert(`已写入 MySQL：${result.ny}（${idText}）`);
  } catch (err) {
    alert(err.message);
  } finally {
    saveMysqlBtn.disabled = false;
    saveMysqlBtn.textContent = "保存 localStorage 到 MySQL";
  }
});

clearCacheBtn.addEventListener("click", () => {
  memoryCache.note = "";
  memoryCache.updatedAt = "";
  sessionStorage.removeItem(SESSION_NOTE_KEY);
  localStorage.removeItem(LOCAL_NOTE_KEY);
  sessionStorage.removeItem(SESSION_HISTORY_KEY);
  localStorage.removeItem(LOCAL_HISTORY_KEY);
  cacheNoteInput.value = "";
  historySearchInput.value = "";
  renderCacheLab();
});

historySearchInput.addEventListener("input", () => {
  renderCacheLab();
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  memoryCache.note = "";
  memoryCache.updatedAt = "";
  resetAuthForm();
  renderProfile(null);
  renderCacheLab();
  showAuthView();
  setMessage("已退出登录", "success");
});
