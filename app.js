const STORAGE_KEY = "hf-workbench-v1";
const DUAL_INTERNAL_TITLE = "华方和复新均可";

const HOLIDAYS_2026 = new Set([
  "2026-01-01", "2026-01-02", "2026-01-03",
  "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
  "2026-04-04", "2026-04-05", "2026-04-06",
  "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
  "2026-06-19", "2026-06-20", "2026-06-21",
  "2026-09-25", "2026-09-26", "2026-09-27",
  "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07",
]);

const ADJUSTED_WORKDAYS_2026 = new Set([
  "2026-01-04", "2026-02-14", "2026-02-28", "2026-05-09", "2026-09-20", "2026-10-10",
]);

const ledgerHeaders = [
  "日期",
  "期货公司",
  "合同抬头",
  "序号",
  "客户",
  "类型",
  "保证金是否已到",
  "合约",
  "区间",
  "入场价",
  "赔付（元/吨）",
  "每日量（吨）",
  "交易日（个）",
  "挂单状态",
  "上区间",
  "下区间",
  "客户毛基",
  "现货毛基",
  "超交毛基",
  "做单量（吨）",
  "熔断价格",
  "收盘价",
  "熔断状态",
  "备注",
];

const todayQuoteText = "";
const todayDealText = "";

const state = loadState();
let lastOrderCheck = null;
const cloudConfig = window.HF_CLOUD_CONFIG || {};
const cloudClient = cloudConfig.url && cloudConfig.publishableKey && window.supabase
  ? window.supabase.createClient(cloudConfig.url, cloudConfig.publishableKey)
  : null;
let currentUser = null;
let cloudSaveTimer = null;
let cloudPollTimer = null;

const els = {
  workDate: document.getElementById("workDate"),
  dateMessage: document.getElementById("dateMessage"),
  contractCode: document.getElementById("contractCode"),
  futureCompany: document.getElementById("futureCompany"),
  seedTodayBtn: document.getElementById("seedTodayBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  quoteCompany: document.getElementById("quoteCompany"),
  quoteProduct: document.getElementById("quoteProduct"),
  buyBasisInput: document.getElementById("buyBasisInput"),
  sellBasisInput: document.getElementById("sellBasisInput"),
  quoteDemand: document.getElementById("quoteDemand"),
  quoteInput: document.getElementById("quoteInput"),
  candidateTable: document.getElementById("candidateTable"),
  extractQuotesBtn: document.getElementById("extractQuotesBtn"),
  sealSelectedBtn: document.getElementById("sealSelectedBtn"),
  clearSealedBtn: document.getElementById("clearSealedBtn"),
  quoteMessage: document.getElementById("quoteMessage"),
  quoteTable: document.getElementById("quoteTable"),
  orderInput: document.getElementById("orderInput"),
  clearOrderInputBtn: document.getElementById("clearOrderInputBtn"),
  checkOrderBtn: document.getElementById("checkOrderBtn"),
  orderMessage: document.getElementById("orderMessage"),
  orderParsed: document.getElementById("orderParsed"),
  orderRoute: document.getElementById("orderRoute"),
  standardOutput: document.getElementById("standardOutput"),
  copyStandardBtn: document.getElementById("copyStandardBtn"),
  registerOrderBtn: document.getElementById("registerOrderBtn"),
  dealInput: document.getElementById("dealInput"),
  parseDealsBtn: document.getElementById("parseDealsBtn"),
  dealMessage: document.getElementById("dealMessage"),
  closePriceControls: document.getElementById("closePriceControls"),
  orderRegisterTable: document.getElementById("orderRegisterTable"),
  receiptCustomer: document.getElementById("receiptCustomer"),
  receiptTitle: document.getElementById("receiptTitle"),
  receiptTitleNotice: document.getElementById("receiptTitleNotice"),
  receiptMarginRatio: document.getElementById("receiptMarginRatio"),
  generateReceiptsBtn: document.getElementById("generateReceiptsBtn"),
  copyReceiptsBtn: document.getElementById("copyReceiptsBtn"),
  printReceiptsBtn: document.getElementById("printReceiptsBtn"),
  receiptOutput: document.getElementById("receiptOutput"),
  exportLedgerBtn: document.getElementById("exportLedgerBtn"),
  copyLedgerBtn: document.getElementById("copyLedgerBtn"),
  ledgerTable: document.getElementById("ledgerTable"),
  saveRulesBtn: document.getElementById("saveRulesBtn"),
  fuxinPatternsInput: document.getElementById("fuxinPatternsInput"),
  yixiCustomersInput: document.getElementById("yixiCustomersInput"),
  yixiContactInput: document.getElementById("yixiContactInput"),
  rulesMessage: document.getElementById("rulesMessage"),
  storageStatus: document.getElementById("storageStatus"),
  authGate: document.getElementById("authGate"),
  authForm: document.getElementById("authForm"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authMessage: document.getElementById("authMessage"),
  signUpBtn: document.getElementById("signUpBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
};

init();

function init() {
  const workDateChanged = refreshWorkDateForNewSession(state);
  const sequencesNormalized = normalizeRecordSequences(state.records);
  const wasUninitialized = !state.initialized;
  els.workDate.value = state.workDate;
  els.contractCode.value = state.contractCode;
  els.futureCompany.value = state.futureCompany;
  els.quoteCompany.value = state.currentQuoteCompany || "";
  els.quoteProduct.value = state.currentProduct || "冷轧";
  els.buyBasisInput.value = state.buyBasis ?? -100;
  els.sellBasisInput.value = state.sellBasis ?? -450;
  els.quoteDemand.value = state.lastDemand || "";
  els.quoteInput.value = state.lastQuoteInput || "";
  if (els.dealInput) els.dealInput.value = state.lastDealInput || "";

  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view) switchView(button.dataset.view);
    });
  });

  els.workDate.addEventListener("change", () => updateWorkDateFromInput());
  els.contractCode.addEventListener("change", () => updateSetting("contractCode", els.contractCode.value.trim() || "SS2609"));
  els.futureCompany.addEventListener("change", () => updateSetting("futureCompany", els.futureCompany.value.trim()));
  if (els.seedTodayBtn) els.seedTodayBtn.addEventListener("click", seedToday);
  els.clearAllBtn.addEventListener("click", clearAll);
  els.extractQuotesBtn.addEventListener("click", extractCandidatesFromTextInput);
  els.sealSelectedBtn.addEventListener("click", sealSelectedCandidates);
  els.clearSealedBtn.addEventListener("click", clearSealedQuotes);
  if (els.clearOrderInputBtn) els.clearOrderInputBtn.addEventListener("click", clearOrderInput);
  els.checkOrderBtn.addEventListener("click", checkOrder);
  els.copyStandardBtn.addEventListener("click", () => copyText(els.standardOutput.textContent, els.orderMessage, "已复制期货公司格式。"));
  els.registerOrderBtn.addEventListener("click", registerCheckedOrder);
  if (els.parseDealsBtn) els.parseDealsBtn.addEventListener("click", registerDeals);
  els.generateReceiptsBtn.addEventListener("click", renderReceipts);
  els.copyReceiptsBtn.addEventListener("click", () => copyText(els.receiptOutput.textContent, null, "回单已复制。"));
  els.printReceiptsBtn.addEventListener("click", () => window.print());
  els.exportLedgerBtn.addEventListener("click", exportLedger);
  els.copyLedgerBtn.addEventListener("click", copyLedger);
  els.saveRulesBtn.addEventListener("click", saveInternalRules);
  els.receiptCustomer.addEventListener("change", () => {
    els.receiptTitle.dataset.autoTitle = "1";
    renderReceipts();
  });
  els.receiptTitle.addEventListener("input", () => {
    els.receiptTitle.dataset.autoTitle = "0";
    renderReceipts();
  });
  els.receiptMarginRatio.addEventListener("input", renderReceipts);

  if (!state.initialized) {
    state.initialized = true;
  }
  if (workDateChanged || wasUninitialized || sequencesNormalized) {
    saveState();
  }

  validateWorkDate(false);
  renderAll();
  initializeCloudSync();
}

function defaultState() {
  return {
    initialized: false,
    workDate: latestBusinessDate(),
    contractCode: "SS2609",
    futureCompany: "",
    quotes: [],
    candidates: [],
    currentQuoteCompany: "",
    currentProduct: "冷轧",
    buyBasis: -100,
    sellBasis: -450,
    lastDemand: "",
    activeReceiptRecordId: "",
    records: [],
    lastQuoteInput: "",
    lastDealInput: "",
    internalRules: { fuxinTitleCompanyPatterns: [], yixiAffiliateCustomers: [], yixiAffiliateContact: "" },
  };
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const loaded = { ...defaultState(), ...stored };
    if (loaded.futureCompany === "华泰") loaded.futureCompany = "";
    return loaded;
  } catch {
    return defaultState();
  }
}

function saveState() {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleCloudSave();
}

function scheduleCloudSave() {
  if (!cloudClient || !currentUser) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(persistStateToCloud, 350);
}

async function persistStateToCloud() {
  if (!cloudClient || !currentUser) return;
  try {
    const { error } = await cloudClient
      .from("workbench_states")
      .upsert({ owner_id: currentUser.id, state, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
    if (error) throw error;
    setStorageStatus(`云端已同步 · ${currentUser.email || "已登录"}`, "ok");
  } catch (error) {
    setStorageStatus(`云端保存失败，本机已保留：${error.message || "请检查网络"}`, "warn");
  }
}

async function initializeCloudSync() {
  if (!cloudClient) {
    setStorageStatus("云端连接配置缺失，仅本机保存", "warn");
    return;
  }
  els.authForm.addEventListener("submit", signInWithPassword);
  els.signUpBtn.addEventListener("click", signUpWithPassword);
  els.signOutBtn.addEventListener("click", signOut);
  const { data: { session } } = await cloudClient.auth.getSession();
  if (session?.user) {
    await activateCloudSession(session.user);
  } else {
    els.authGate.hidden = false;
    setStorageStatus("请登录后同步云端数据", "warn");
  }
}

async function signInWithPassword(event) {
  event.preventDefault();
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  const { data, error } = await cloudClient.auth.signInWithPassword({ email, password });
  if (error) {
    showMessage(els.authMessage, `登录失败：${error.message}`, "error");
    return;
  }
  showMessage(els.authMessage, "登录成功，正在同步云端数据。", "ok");
  await activateCloudSession(data.user);
}

async function signUpWithPassword() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || password.length < 8) {
    showMessage(els.authMessage, "请填写常用邮箱和至少 8 位密码。", "warn");
    return;
  }
  const { data, error } = await cloudClient.auth.signUp({ email, password });
  if (error) {
    showMessage(els.authMessage, `注册失败：${error.message}`, "error");
    return;
  }
  if (data.session?.user) {
    await activateCloudSession(data.session.user);
  } else {
    showMessage(els.authMessage, "注册成功。请到邮箱点击确认链接，再回来登录。", "ok");
  }
}

async function signOut() {
  if (!confirm("确认退出当前云端账号吗？本机缓存不会被删除。")) return;
  await cloudClient.auth.signOut();
  currentUser = null;
  clearInterval(cloudPollTimer);
  els.signOutBtn.hidden = true;
  els.authPassword.value = "";
  els.authGate.hidden = false;
  setStorageStatus("已退出，仅保留本机缓存", "warn");
}

async function activateCloudSession(user) {
  currentUser = user;
  els.authGate.hidden = true;
  els.signOutBtn.hidden = false;
  await loadStateFromCloud();
  setStorageStatus(`云端已连接 · ${user.email || "已登录"}`, "ok");
  clearInterval(cloudPollTimer);
  cloudPollTimer = setInterval(loadStateFromCloud, 30000);
  window.addEventListener("focus", loadStateFromCloud);
}

async function loadStateFromCloud() {
  if (!cloudClient || !currentUser) return;
  try {
    const { data, error } = await cloudClient
      .from("workbench_states")
      .select("state, updated_at")
      .eq("owner_id", currentUser.id)
      .maybeSingle();
    if (error) throw error;
    const serverState = data?.state;
    if (!serverState || !serverState.updatedAt) {
      if (hasBusinessData(state)) scheduleCloudSave();
      return;
    }
    if ((serverState.updatedAt || 0) <= (state.updatedAt || 0)) return;
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, { ...defaultState(), ...serverState });
    if (state.futureCompany === "华泰") state.futureCompany = "";
    const workDateChanged = refreshWorkDateForNewSession(state);
    const sequencesNormalized = normalizeRecordSequences(state.records);
    hydrateInputsFromState();
    renderAll();
    if (workDateChanged || sequencesNormalized) saveState();
    showMessage(els.dateMessage, "已加载云端保存的数据。", "ok");
  } catch (error) {
    setStorageStatus(`云端读取失败，本机缓存可继续使用：${error.message || "请检查网络"}`, "warn");
  }
}

function hydrateInputsFromState() {
  els.workDate.value = state.workDate;
  els.contractCode.value = state.contractCode;
  els.futureCompany.value = state.futureCompany;
  els.quoteCompany.value = state.currentQuoteCompany || "";
  els.quoteProduct.value = state.currentProduct || "冷轧";
  els.buyBasisInput.value = state.buyBasis ?? -100;
  els.sellBasisInput.value = state.sellBasis ?? -450;
  els.quoteDemand.value = state.lastDemand || "";
  els.quoteInput.value = state.lastQuoteInput || "";
  if (els.dealInput) els.dealInput.value = state.lastDealInput || "";
  const rules = state.internalRules || {};
  els.fuxinPatternsInput.value = (rules.fuxinTitleCompanyPatterns || []).join(", ");
  els.yixiCustomersInput.value = (rules.yixiAffiliateCustomers || []).join(", ");
  els.yixiContactInput.value = rules.yixiAffiliateContact || "";
}

function saveInternalRules() {
  state.internalRules = {
    fuxinTitleCompanyPatterns: splitRuleValues(els.fuxinPatternsInput.value),
    yixiAffiliateCustomers: splitRuleValues(els.yixiCustomersInput.value),
    yixiAffiliateContact: els.yixiContactInput.value.trim(),
  };
  saveState();
  showMessage(els.rulesMessage, "已保存到当前账号的云端规则。", "ok");
}

function splitRuleValues(value) {
  return String(value || "").split(/[，,、]/).map((item) => item.trim()).filter(Boolean);
}

function hasBusinessData(candidate) {
  return Boolean(candidate?.quotes?.length || candidate?.records?.length || candidate?.lastQuoteInput || candidate?.lastDealInput);
}

function setStorageStatus(text, type = "") {
  if (!els.storageStatus) return;
  els.storageStatus.textContent = text;
  const box = els.storageStatus.closest(".status-box");
  if (box) box.dataset.status = type;
}

function updateSetting(key, value) {
  state[key] = value;
  saveState();
  renderAll();
}

function updateWorkDateFromInput() {
  const selected = els.workDate.value;
  const validation = validateBusinessDate(selected);
  if (!validation.ok) {
    const next = nextBusinessDate(selected);
    state.workDate = next;
    els.workDate.value = next;
    saveState();
    showMessage(els.dateMessage, `${selected} 不是可用交易日：${validation.reason}。已调整到下一个工作日 ${next}。`, "warn");
    renderAll();
    return;
  }
  state.workDate = selected;
  saveState();
  showMessage(els.dateMessage, `${selected} 可以使用。`, "ok");
  renderAll();
}

function validateWorkDate(showOk) {
  const validation = validateBusinessDate(state.workDate);
  if (!validation.ok) {
    showMessage(els.dateMessage, `${state.workDate} 不是可用交易日：${validation.reason}。`, "warn");
  } else if (showOk) {
    showMessage(els.dateMessage, `${state.workDate} 可以使用。`, "ok");
  } else {
    els.dateMessage.textContent = "";
    els.dateMessage.className = "message top-message";
  }
}

function switchView(view) {
  document.querySelectorAll(".nav-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.querySelectorAll(".view").forEach((section) => section.classList.toggle("active", section.id === view));
}

function seedToday() {
  showMessage(els.quoteMessage, "公开版本不包含历史业务示例，请录入当天实际结构。", "warn");
}

function clearAll() {
  if (!confirm("确认清空本地数据？这只会清空本网页保存的数据。")) return;
  const fresh = defaultState();
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, fresh, { initialized: true });
  els.quoteCompany.value = "";
  els.quoteDemand.value = "";
  els.quoteInput.value = "";
  if (els.dealInput) els.dealInput.value = "";
  els.orderInput.value = "";
  els.standardOutput.textContent = "";
  setOrderRoute(null);
  saveState();
  renderAll();
}

function extractCandidatesFromTextInput() {
  const dateValidation = validateBusinessDate(state.workDate);
  if (!dateValidation.ok) {
    showMessage(els.quoteMessage, `业务日期不可用：${dateValidation.reason}。请先修改顶部业务日期。`, "error");
    return;
  }
  const futureCompany = els.quoteCompany.value.trim();
  if (!futureCompany) {
    showMessage(els.quoteMessage, "请先填写期货公司。", "error");
    return;
  }
  const text = els.quoteInput.value.trim();
  if (!text) {
    showMessage(els.quoteMessage, "请先粘贴要封存的结构。", "error");
    return;
  }
  const mismatch = findTradeDateMismatch(text);
  if (mismatch) {
    showMessage(els.quoteMessage, `日期不一致：顶部业务日期是 ${state.workDate}，内容里是 ${mismatch}。请先改一致。`, "error");
    return;
  }

  const product = els.quoteProduct.value;
  const buyBasis = Number(els.buyBasisInput.value);
  const sellBasis = Number(els.sellBasisInput.value);
  if (!Number.isFinite(buyBasis) || !Number.isFinite(sellBasis)) {
    showMessage(els.quoteMessage, "请填写累购和累沽华方报价。", "error");
    return;
  }

  state.currentQuoteCompany = futureCompany;
  state.currentProduct = product;
  state.buyBasis = buyBasis;
  state.sellBasis = sellBasis;
  state.lastDemand = els.quoteDemand.value.trim();
  state.lastQuoteInput = text;
  syncContractCodeFromQuoteText(text);

  const { rows, filtered } = extractCandidateRowsFromText(text);
  const basisCheck = validateHuafangBasis(rows, buyBasis, sellBasis);
  if (basisCheck.errors.length) {
    state.candidates = [];
    saveState();
    renderCandidates();
    showMessage(els.quoteMessage, `华方报价不一致，不能封存：${basisCheck.errors.join("；")}`, "error");
    return;
  }
  state.candidates = filtered;
  saveState();
  renderCandidates();
  if (!rows.length) {
    showMessage(els.quoteMessage, "没有识别到可用结构，请检查格式是否包含日期、交易日、到期日、类型、上下区间、现货毛基和赔付。", "error");
  } else if (!filtered.length) {
    showMessage(els.quoteMessage, `识别到 ${rows.length} 条结构，但没有符合当前需求筛选的候选。`, "warn");
  } else {
    showMessage(els.quoteMessage, `已从 ${futureCompany}${product === "热轧" ? "（热轧）" : ""} 提取 ${filtered.length} 条候选结构，勾选后可封存。`, "ok");
  }
}

function validateHuafangBasis(rows, buyBasis, sellBasis) {
  const errors = [];
  rows.forEach((quote) => {
    const implied = quote.type === "熔断累购" ? quote.basis - quote.lower : quote.basis - quote.upper;
    const expected = quote.type === "熔断累购" ? buyBasis : sellBasis;
    if (implied !== expected) {
      errors.push(`${displayQuoteDate(quote)} ${quote.type} ${formatBasis(quote.upper, quote)}/${formatBasis(quote.lower, quote)}，文本毛基${formatBasis(quote.basis, quote)}反算华方报价为${implied}，上方填写为${expected}`);
    }
  });
  return { errors };
}

function extractCandidateRowsFromText(text) {
  const normalRows = parseQuotes(text, {
    futureCompany: state.currentQuoteCompany || state.futureCompany,
    product: state.currentProduct || "冷轧",
    buyBasis: state.buyBasis,
    sellBasis: state.sellBasis,
  });
  const fallbackRows = parseTableTextQuoteRows(text, {
    futureCompany: state.currentQuoteCompany || state.futureCompany,
    product: state.currentProduct || "冷轧",
    buyBasis: state.buyBasis,
    sellBasis: state.sellBasis,
  });
  const rows = dedupeQuotes([...normalRows, ...fallbackRows]);
  const filtered = filterCandidatesByDemand(rows, state.lastDemand);
  return { rows, filtered };
}

function syncContractCodeFromQuoteText(text) {
  const month = detectQuoteMonth(text);
  if (!month) return;
  const current = state.contractCode || "SS2609";
  const next = contractCodeForMonth(month);
  if (next === current) return;
  state.contractCode = next;
  els.contractCode.value = next;
  showMessage(els.dateMessage, `已识别报价为 ${month} 合约，合约已自动调整为 ${next}。`, "ok");
}

function detectQuoteMonth(text) {
  const matches = [...String(text || "").matchAll(/(?:上区间|下区间|现货毛基)\s*(0?[1-9]|1[0-2])\s*[+-]\s*\d+/g)];
  const months = [...new Set(matches.map((match) => String(Number(match[1])).padStart(2, "0")))];
  return months.length === 1 ? months[0] : "";
}

function contractCodeForQuoteLine(line) {
  const month = detectQuoteMonth(line);
  return month ? contractCodeForMonth(month) : (state.contractCode || "SS2609");
}

function contractCodeForMonth(month) {
  const normalizedMonth = String(Number(month)).padStart(2, "0");
  const current = state.contractCode || "SS2609";
  return current.match(/\d{2}$/) ? current.replace(/\d{2}$/, normalizedMonth) : `SS26${normalizedMonth}`;
}

function sealSelectedCandidates() {
  const selectedIds = [...document.querySelectorAll("[data-candidate-id]:checked")].map((input) => input.dataset.candidateId);
  if (!selectedIds.length) {
    showMessage(els.quoteMessage, "请先勾选要封存的候选结构。", "warn");
    return;
  }
  let selected = state.candidates.filter((quote) => selectedIds.includes(quote.id));
  const basisCheck = validateHuafangBasis(selected, Number(els.buyBasisInput.value), Number(els.sellBasisInput.value));
  if (basisCheck.errors.length) {
    showMessage(els.quoteMessage, `华方报价不一致，不能封存：${basisCheck.errors.join("；")}`, "error");
    return;
  }
  if (!ensureTitlesForQuotes(selected, "请确认本次封存结构使用的合同抬头。")) return;
  selected = selected.map((quote) => ({
    ...quote,
    internalTitle: titleForQuote(quote),
  }));
  const selectedKeys = new Set(selected.map(quoteStructureKey));
  state.quotes = state.quotes.filter((quote) => !selectedKeys.has(quoteStructureKey(quote)));
  state.quotes = [...state.quotes, ...selected];
  state.candidates = state.candidates.filter((quote) => !selectedIds.includes(quote.id));
  saveState();
  renderAll();
  showMessage(els.quoteMessage, `已封存 ${selected.length} 条结构；如有同结构旧报价，已用本次华方报价替换。`, "ok");
}

function clearSealedQuotes() {
  if (!confirm("确认清空已封存挂单库？挂单记录不会被删除。")) return;
  state.quotes = [];
  saveState();
  renderAll();
  showMessage(els.quoteMessage, "已清空封存库。", "ok");
}

function clearOrderInput() {
  if (lastOrderCheck?.order && lastOrderCheck?.quote && !lastOrderCheck.registered) {
    const shouldRegister = confirm("当前挂单已核对但尚未登记。\n\n是否先登记这笔挂单？\n确定：登记后清空；取消：直接清空，不登记。");
    if (shouldRegister && !registerCheckedOrder({ silent: true })) return;
  }

  resetOrderInput();
  showMessage(els.orderMessage, "已清空挂单输入。", "ok");
}

function resetOrderInput() {
  els.orderInput.value = "";
  lastOrderCheck = null;
  els.standardOutput.textContent = "";
  els.orderParsed.innerHTML = "";
  setOrderRoute(null);
  showMessage(els.orderMessage, "", "");
  els.orderInput.focus();
}

function checkOrder() {
  let order = parseSingleOrder(els.orderInput.value);
  lastOrderCheck = null;
  els.standardOutput.textContent = "";
  setOrderRoute(null);
  renderDetails(els.orderParsed, order);

  const missing = requiredOrderBasics(order);
  if (missing.length) {
    showMessage(els.orderMessage, `信息不完整：${missing.join("、")}。`, "error");
    return;
  }
  if (order.date && order.date !== state.workDate) {
    showMessage(els.orderMessage, `挂单日期不一致：顶部业务日期是 ${state.workDate}，挂单里是 ${order.date}。`, "error");
    return;
  }

  const match = findBestQuoteForOrder(order);
  if (match.ambiguous?.length) {
    showMessage(els.orderMessage, `匹配到 ${match.ambiguous.length} 条封存结构，无法判断该挂哪一条：${describeQuoteChoices(match.ambiguous)}。请补充类型、交易日或到期日后再核对。`, "error");
    return;
  }
  const quote = match.quote;
  if (!quote) {
    const reason = explainMismatch(order);
    showMessage(els.orderMessage, `未匹配今天报单结构：${reason}`, "error");
    return;
  }
  if (!ensureTitleForQuote(quote, "这笔挂单匹配到封存结构，请确认该期货公司的合同抬头。")) {
    showMessage(els.orderMessage, "已取消：必须先确认合同抬头，才能继续挂单。", "warn");
    return;
  }
  order = completeOrderFromQuote(order, quote);
  const dualTitleQuote = isDualInternalTitle(titleForQuote(quote));
  if (dualTitleQuote && !order.requestedTitle) {
    const confirmedTitle = promptActualOrderTitle("这条封存报价可使用江苏华方或无锡复新抬头，但客户挂单没有注明抬头。请确认本次实际挂单抬头。");
    if (!confirmedTitle) {
      showMessage(els.orderMessage, "已取消：双抬头结构必须确认本次实际使用的合同抬头，才能继续挂单。", "warn");
      return;
    }
    order.internalTitle = confirmedTitle;
  }
  const yixiAffiliate = isYixiAffiliateOrder(order);
  if (yixiAffiliate) {
    order.internalTitle = "无锡复新";
    order.titleOverrideReason = "艺玺体系";
  }
  const directDeliveryRemark = inferDirectDeliveryRemark(order, quote);
  if (directDeliveryRemark) order.remark = directDeliveryRemark;
  saveState();
  renderDetails(els.orderParsed, order);

  const output = standardOrderText(order);
  els.standardOutput.textContent = output;
  setOrderRoute(quote, order);
  const basisMismatch = quote.basis !== order.basis;
  const qtySpecial = !isStandardDailyQty(order.dailyQty);
  lastOrderCheck = { order, quote, basisMismatch, qtySpecial, directDeliveryRemark, registered: false };
  if (basisMismatch || qtySpecial || yixiAffiliate || dualTitleQuote || order.requestedTitle) {
    const diff = order.basis - quote.basis;
    const messages = [];
    if (yixiAffiliate) {
      messages.push(`已识别为体系客户特别规则：本单不使用封存结构的默认抬头，必须挂到【${quote.futureCompany || "未填期货公司"}复新群】，合同抬头固定为【无锡复新】`);
    }
    if (basisMismatch) {
      if (directDeliveryRemark) {
        messages.push(`已识别为${directDeliveryRemark}：客户现货毛基比常规结构高${diff}，登记和回单将自动备注${directDeliveryRemark}`);
      } else {
        messages.push(`现货毛基不一致：封存库为 ${formatBasis(quote.basis, quote)}，客户挂单为 ${formatBasis(order.basis, order)}，差额 ${diff > 0 ? "+" : ""}${diff}`);
      }
    }
    if (qtySpecial) {
      messages.push(`每日量 ${order.dailyQty} 吨不是 11 吨的倍数，系统将按客户原始数量 ${order.dailyQty} 吨发期货公司并登记`);
    }
    if (dualTitleQuote) {
      messages.push(order.requestedTitle
        ? `该期货公司为双抬头可做，已按客户注明的【${order.requestedTitle}】抬头匹配；请再次核对后再挂`
        : `该期货公司为双抬头可做，本次已确认使用【${order.internalTitle}】抬头；请再次核对后再挂`);
    } else if (order.requestedTitle) {
      messages.push(`已按客户注明的【${order.requestedTitle}】抬头匹配`);
    }
    showMessage(
      els.orderMessage,
      `结构匹配，请挂到【${quote.futureCompany || "未填期货公司"}】，合同抬头【${order.internalTitle || titleForQuote(quote)}】；但需要确认：${messages.join("；")}。`,
      "warn"
    );
  } else {
    showMessage(els.orderMessage, `结构匹配，请挂到【${quote.futureCompany || "未填期货公司"}】，合同抬头【${order.internalTitle || titleForQuote(quote)}】。`, "ok");
  }
}

function registerCheckedOrder(options = {}) {
  const { silent = false } = options;
  if (!lastOrderCheck?.order || !lastOrderCheck?.quote) {
    if (!silent) showMessage(els.orderMessage, "请先核对挂单，匹配后再登记。", "warn");
    return false;
  }
  if (lastOrderCheck.registered) {
    if (!silent) showMessage(els.orderMessage, "这笔挂单已经登记，不会重复写入。", "warn");
    return true;
  }
  if (lastOrderCheck.basisMismatch && !lastOrderCheck.directDeliveryRemark) {
    const ok = confirm("现货毛基与封存库不一致，是否确认登记？");
    if (!ok) {
      if (!silent) showMessage(els.orderMessage, "已取消登记，请核对毛基后再处理。", "warn");
      return false;
    }
  }
  if (lastOrderCheck.qtySpecial) {
    const ok = confirm(`每日量 ${lastOrderCheck.order.dailyQty} 吨不是 11 吨倍数，是否确认按该数量继续登记并发期货公司？`);
    if (!ok) {
      if (!silent) showMessage(els.orderMessage, "已取消登记，请核对每日量后再处理。", "warn");
      return false;
    }
  }
  const record = buildRecord(lastOrderCheck.order, lastOrderCheck.quote, nextSequence(), "在挂");
  state.records.push(record);
  normalizeRecordSequences(state.records, record.date);
  lastOrderCheck.registered = true;
  saveState();
  renderAll();
  if (!silent) showMessage(els.orderMessage, `已登记挂单：${record.customer || "未填客户"}，期货公司【${record.futureCompany || "未填"}】，合同抬头【${internalTitleForRecord(record)}】，状态为在挂。`, "ok");
  return true;
}

function registerDeals() {
  const text = els.dealInput.value.trim();
  const deals = parseDeals(text);
  if (!deals.length) {
    showMessage(els.dealMessage, "没有识别到挂单信息。", "error");
    return;
  }

  const errors = [];
  const records = [];
  deals.forEach((deal, index) => {
    const missing = requiredDealMissing(deal);
    const quote = findMatchingQuote(deal);
    if (missing.length) {
      errors.push(`第 ${index + 1} 笔缺少：${missing.join("、")}`);
      return;
    }
    if (deal.date && deal.date !== state.workDate) {
      errors.push(`第 ${index + 1} 笔日期不一致：顶部 ${state.workDate}，挂单 ${deal.date}`);
      return;
    }
    if (!quote) {
      errors.push(`第 ${index + 1} 笔 ${deal.customer || ""} 未匹配今天封存库`);
      return;
    }
    records.push({ deal, quote });
  });

  if (errors.length) {
    showMessage(els.dealMessage, errors.join("；"), "error");
    return;
  }
  const matchedQuotes = records.map((item) => item.quote);
  if (!ensureTitlesForQuotes(matchedQuotes, "批量挂单匹配到封存结构，请确认各期货公司的合同抬头。")) {
    showMessage(els.dealMessage, "已取消：必须先确认合同抬头，才能登记挂单。", "warn");
    return;
  }

  state.lastDealInput = text;
  const start = nextSequence();
  records.forEach((item, index) => {
    state.records.push(buildRecord(item.deal, item.quote, start + index, "在挂"));
  });
  normalizeRecordSequences(state.records, state.workDate);
  saveState();
  renderAll();
  showMessage(els.dealMessage, `已核对并登记 ${records.length} 笔挂单，状态为在挂。`, "ok");
}

function parseQuotes(text, options = {}) {
  const lines = text.split(/\r?\n/).map((line) => cleanLine(line)).filter(Boolean);
  const quotes = [];
  let currentDate = state.workDate;
  let days = null;
  let dueDate = "";
  let type = "";
  let multiplier = "二倍";

  lines.forEach((line) => {
    const date = parseChineseDate(line);
    if (date) currentDate = date;

    const meta = line.match(/([一二两三四五六七八九十\d]+倍).*?(\d+)\s*个?交易日.*?(\d{1,2})[.\-/月](\d{1,2})\s*到期/);
    if (meta) {
      multiplier = normalizeMultiplier(meta[1]);
      days = Number(meta[2]);
      dueDate = toIsoDate(Number(meta[3]), Number(meta[4]));
    }

    if (line.includes("熔断累购")) type = "熔断累购";
    if (line.includes("熔断累沽")) type = "熔断累沽";

    if (line.includes("上区间") && line.includes("下区间") && line.includes("敲出赔付")) {
      const upper = readSignedValue(line, "上区间");
      const lower = readSignedValue(line, "下区间");
      const basis = readSignedValue(line, "现货毛基");
      const payoff = readPlainNumber(line, "敲出赔付");
      const quoteContract = contractCodeForQuoteLine(line);
      if (type && days && dueDate && upper !== null && lower !== null && basis !== null && payoff !== null) {
        quotes.push({
          id: crypto.randomUUID(),
          date: currentDate,
          futureCompany: options.futureCompany || state.futureCompany,
          product: options.product || "冷轧",
          contract: quoteContract,
          multiplier,
          type,
          days,
          dueDate,
          upper,
          lower,
          basis,
          payoff,
          huafangBasis: options[type === "熔断累购" ? "buyBasis" : "sellBasis"] ?? basis - (type === "熔断累购" ? lower : upper),
        });
      }
    }
  });

  return quotes;
}

function parseTableTextQuoteRows(text, options) {
  const rows = [];
  const normalized = normalizeTableText(text);
  const lines = normalized.split("\n").map(cleanLine).filter(Boolean);
  const defaultDue = findMostLikelyDueDate(normalized);

  lines.forEach((line) => {
    const type = inferTableRowType(line);
    if (!type) return;

    const dueMatch = line.match(/(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    const dueDate = dueMatch
      ? `${dueMatch[1]}-${String(dueMatch[2]).padStart(2, "0")}-${String(dueMatch[3]).padStart(2, "0")}`
      : defaultDue;
    if (!dueDate) return;

    const rowText = dueMatch ? line.slice(0, line.indexOf(dueMatch[0])) : line;
    const nums = (rowText.match(/[+-]?\d+/g) || []).map(Number);
    const candidate = findTableQuoteNumbers(nums, type);
    if (!candidate) return;

    const { lower, upper, payoff, days } = candidate;
    const huafangBasis = type === "熔断累购" ? options.buyBasis : options.sellBasis;
    const basis = type === "熔断累购" ? lower + huafangBasis : upper + huafangBasis;
    rows.push({
      id: crypto.randomUUID(),
      date: state.workDate,
      futureCompany: options.futureCompany,
      product: options.product,
      contract: state.contractCode,
      multiplier: "二倍",
      type,
      days,
      dueDate,
      upper,
      lower,
      basis,
      payoff,
      huafangBasis,
      source: "image",
    });
  });
  return dedupeQuotes(rows);
}

function normalizeTableText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[|｜]/g, " ")
    .replace(/[，,;；:：]/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/[Oo]/g, "0")
    .replace(/票购|累胸|景购|暴购|票胸/g, "累购")
    .replace(/票沽|景沽|累估|票估|景估/g, "累沽")
    .replace(/购/g, "累购")
    .replace(/沽/g, "累沽")
    .replace(/累累/g, "累")
    .replace(/[ \t]+/g, " ");
}

function inferTableRowType(line) {
  if (/累购/.test(line)) return "熔断累购";
  if (/累沽/.test(line)) return "熔断累沽";
  return "";
}

function findMostLikelyDueDate(text) {
  const match = text.match(/(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
  return match ? `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}` : "";
}

function findTableQuoteNumbers(nums, type) {
  for (let i = 0; i <= nums.length - 4; i++) {
    const lower = nums[i];
    const upper = nums[i + 1];
    const payoff = nums[i + 2];
    const tail = nums.slice(i + 3, i + 8);
    const days = tail.find((num) => num >= 20 && num <= 80);
    if (!days) continue;
    if (![0, 50, 100, 150, 200].includes(payoff)) continue;
    if (lower >= 0 || upper <= 0) continue;
    if (Math.abs(lower) > 1000 || upper > 1000) continue;
    if (type === "熔断累购" && ![150, 300].includes(upper)) continue;
    if (type === "熔断累沽" && ![-150, -300].includes(lower)) continue;
    return { lower, upper, payoff, days };
  }
  return null;
}

function filterCandidatesByDemand(rows, demand) {
  const text = cleanLine(demand || "");
  if (!text) return rows;
  const wantsBuy = text.includes("累购");
  const wantsSell = text.includes("累沽");
  const daysMatch = text.match(/(\d+)\s*天|(\d+)\s*个?交易日/);
  const dateMatch = text.match(/(\d{1,2})[.\-/月](\d{1,2})\s*到期/);
  const upperMatch = text.match(/上区间\s*([0-9/、,，\s]+)/);
  const lowerMatch = text.match(/下区间\s*([0-9/、,，\s]+)/);
  const upperValues = upperMatch ? readDemandValues(upperMatch[1]) : [];
  const lowerValues = lowerMatch ? readDemandValues(lowerMatch[1]).map((value) => -Math.abs(value)) : [];
  const days = daysMatch ? Number(daysMatch[1] || daysMatch[2]) : null;
  const dueDate = dateMatch ? toIsoDate(Number(dateMatch[1]), Number(dateMatch[2])) : "";

  return rows.filter((row) => {
    if (wantsBuy && !wantsSell && row.type !== "熔断累购") return false;
    if (wantsSell && !wantsBuy && row.type !== "熔断累沽") return false;
    if (days && row.days !== days) return false;
    if (dueDate && row.dueDate !== dueDate) return false;
    if (upperValues.length && !upperValues.includes(row.upper)) return false;
    if (lowerValues.length && !lowerValues.includes(row.lower)) return false;
    return true;
  });
}

function readDemandValues(text) {
  return (text.match(/\d+/g) || []).map(Number);
}

function dedupeQuotes(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = quoteKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function quoteKey(quote) {
  return [
    quote.date,
    quote.futureCompany,
    titleForQuote(quote),
    quote.product || "冷轧",
    quote.contract,
    quote.type,
    quote.days,
    quote.dueDate,
    quote.upper,
    quote.lower,
    quote.basis,
    quote.payoff,
    quote.huafangBasis,
  ].join("|");
}

function quoteStructureKey(quote) {
  return [
    quote.date,
    quote.futureCompany,
    titleForQuote(quote),
    quote.product || "冷轧",
    quote.contract,
    quote.type,
    quote.days,
    quote.dueDate,
    quote.upper,
    quote.lower,
    quote.basis,
    quote.payoff,
  ].join("|");
}

function parseSingleOrder(text) {
  const compact = cleanLine(text.replace(/\r?\n/g, " "));
  const lines = text.split(/\r?\n/).map((line) => cleanLine(line)).filter(Boolean);
  const firstLine = lines.find((line) => parseChineseDate(line) && /%/.test(line)) || lines[0] || "";
  const date = parseChineseDate(compact) || state.workDate;
  const requestedTitle = parseRequestedInternalTitle(firstLine);
  const ratioMatch = compact.match(/(\d+(?:\.\d+)?)\s*%/);
  const customer = parseCustomer(firstLine);
  const meta = compact.match(/([一二两三四五六七八九十\d]+倍).*?(\d+)\s*个?交易日.*?(\d{1,2})[.\-/月](\d{1,2})\s*到期/);
  const type = compact.includes("熔断累沽") ? "熔断累沽" : compact.includes("熔断累购") ? "熔断累购" : "";
  const marketEntry = isMarketEntry(compact);
  const basisMonth = detectQuoteMonth(compact);
  const product = compact.includes("热轧") ? "热轧" : "冷轧";

  return {
    sourceText: text,
    date,
    requestedTitle,
    contract: basisMonth ? contractCodeForMonth(basisMonth) : "",
    basisMonth,
    customer,
    product,
    marginRatio: ratioMatch ? Number(ratioMatch[1]) / 100 : null,
    multiplier: meta ? normalizeMultiplier(meta[1]) : "",
    days: meta ? Number(meta[2]) : null,
    dueDate: meta ? toIsoDate(Number(meta[3]), Number(meta[4])) : "",
    type,
    upper: readSignedValue(compact, "上区间"),
    lower: readSignedValue(compact, "下区间"),
    basis: readSignedValue(compact, "现货毛基"),
    payoff: readPlainNumber(compact, "敲出赔付"),
    entryPrice: marketEntry ? "市价" : readEntryPrice(compact),
    marketEntry,
    dailyQty: readDailyQty(compact),
    remark: (compact.includes("响水明细") || compact.includes("响水直发")) ? "响水明细" : (compact.includes("直发") ? "直发" : ""),
  };
}

function parseRequestedInternalTitle(firstLine) {
  const text = cleanLine(firstLine || "");
  if (/(?:无锡)?复新\s*抬头|复兴\s*抬头/.test(text)) return "无锡复新";
  if (/(?:江苏)?华方\s*抬头/.test(text)) return "江苏华方";
  return "";
}

function parseDeals(text) {
  return splitDealBlocks(text).map(parseSingleOrder).filter((deal) => deal.type || deal.entryPrice || deal.customer);
}

function splitDealBlocks(text) {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) return [];
  const parts = normalized.split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return parts;

  const blocks = [];
  let current = [];
  normalized.split("\n").forEach((line) => {
    if (/^\s*\d{1,2}[.\-/月]\d{1,2}\s*日?.*%/.test(line) && current.length) {
      blocks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  });
  if (current.length) blocks.push(current.join("\n"));
  return blocks;
}

function parseCustomer(line) {
  let value = cleanLine(line)
    .replace(/\d{1,2}[.\-/月]\d{1,2}\s*日?/, "")
    .replace(/\d+(?:\.\d+)?\s*%/, "")
    .trim();
  if (/上区间|下区间|现货毛基|敲出赔付|每天|挂\s*\d{4,6}|挂单价|入场价/.test(value)) return "";
  value = value.replace(/[@＠].*$/, "").trim();
  return value;
}

function findMatchingQuote(order) {
  const matches = (includeBasis) => state.quotes.filter((quote) =>
    productMatchesOrder(quote, order) &&
    (!order.contract || quote.contract === order.contract) &&
    (!order.type || quote.type === order.type) &&
    (!order.days || quote.days === order.days) &&
    (!order.dueDate || quote.dueDate === order.dueDate) &&
    (order.upper === null || quote.upper === order.upper) &&
    (order.lower === null || quote.lower === order.lower) &&
    (order.payoff === null || quote.payoff === order.payoff) &&
    quoteMatchesRequestedTitle(quote, order.requestedTitle) &&
    (!includeBasis || order.basis === null || quote.basis === order.basis)
  );
  const exact = matches(true);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return resolveTitleAmbiguity(exact);
  const structural = matches(false);
  if (structural.length === 1) return structural[0];
  if (structural.length > 1) return resolveTitleAmbiguity(structural);
  return null;
}

function findStructuralQuote(order) {
  return state.quotes.find((quote) =>
    productMatchesOrder(quote, order) &&
    quote.type === order.type &&
    quote.days === order.days &&
    quote.dueDate === order.dueDate &&
    quote.upper === order.upper &&
    quote.lower === order.lower &&
    quote.payoff === order.payoff
  );
}

function findBestQuoteForOrder(order) {
  const exact = quoteCandidates(order, true);
  if (exact.length === 1) return { quote: exact[0] };
  if (exact.length > 1) {
    const resolved = resolveTitleAmbiguity(exact);
    return resolved ? { quote: resolved } : { ambiguous: exact };
  }

  const structural = quoteCandidates(order, false);
  if (structural.length === 1) return { quote: structural[0] };
  if (structural.length > 1) {
    const resolved = resolveTitleAmbiguity(structural);
    return resolved ? { quote: resolved } : { ambiguous: structural };
  }

  return { quote: null };
}

function quoteCandidates(order, includeBasis) {
  return state.quotes.filter((quote) => {
    if (!productMatchesOrder(quote, order)) return false;
    if (order.contract && quote.contract !== order.contract) return false;
    if (order.type && quote.type !== order.type) return false;
    if (order.days && quote.days !== order.days) return false;
    if (order.dueDate && quote.dueDate !== order.dueDate) return false;
    if (order.upper !== null && quote.upper !== order.upper) return false;
    if (order.lower !== null && quote.lower !== order.lower) return false;
    if (order.payoff !== null && quote.payoff !== order.payoff) return false;
    if (!quoteMatchesRequestedTitle(quote, order.requestedTitle)) return false;
    if (includeBasis && order.basis !== null && quote.basis !== order.basis) return false;
    return true;
  });
}

function completeOrderFromQuote(order, quote) {
  return {
    ...order,
    contract: quote.contract || order.contract || state.contractCode,
    basisMonth: contractMonthFromCode(quote.contract) || order.basisMonth,
    internalTitle: order.requestedTitle || titleForQuote(quote),
    product: quote.product || order.product || "冷轧",
    multiplier: order.multiplier || quote.multiplier || "二倍",
    days: order.days || quote.days,
    dueDate: order.dueDate || quote.dueDate,
    type: order.type || quote.type,
    upper: order.upper ?? quote.upper,
    lower: order.lower ?? quote.lower,
    basis: order.basis ?? quote.basis,
    payoff: order.payoff ?? quote.payoff,
  };
}

function inferDirectDeliveryRemark(order, quote) {
  if (order.remark === "响水明细" || order.remark === "响水直发") return "响水明细";
  if (order.remark === "直发") return "直发";
  const customerBasis = Number(order.basis);
  const normalBasis = Number(quote?.basis);
  if (!Number.isFinite(customerBasis) || !Number.isFinite(normalBasis)) return "";
  const difference = customerBasis - normalBasis;
  if (Math.abs(difference - 50) < 0.001) return "响水明细";
  if (Math.abs(difference - 30) < 0.001) return "直发";
  return "";
}

function productMatchesOrder(quote, order) {
  return !order.product || (quote.product || "冷轧") === order.product;
}

function describeQuoteChoices(quotes) {
  return quotes.slice(0, 5).map((quote) =>
    `${quote.futureCompany || "未填公司"} ${titleForQuote(quote)} ${quote.contract || ""} ${quote.type} ${quote.days}天 ${formatBasis(quote.upper, quote)}/${formatBasis(quote.lower, quote)} 毛基${formatBasis(quote.basis, quote)} 赔${quote.payoff}`
  ).join("；");
}

function explainMismatch(order) {
  const sameProduct = state.quotes.filter((quote) => productMatchesOrder(quote, order));
  if (!sameProduct.length) return order.product ? "品种不在今天封存库里" : "结构不在今天封存库里";
  const sameType = order.type ? sameProduct.filter((quote) => quote.type === order.type) : sameProduct;
  if (!sameType.length) return "类型不在今天结构里";
  const sameTerm = sameType.filter((quote) =>
    (!order.days || quote.days === order.days) &&
    (!order.dueDate || quote.dueDate === order.dueDate)
  );
  if (!sameTerm.length) return "交易日或到期日不一致";
  const sameRange = sameTerm.filter((quote) =>
    (order.upper === null || quote.upper === order.upper) &&
    (order.lower === null || quote.lower === order.lower)
  );
  if (!sameRange.length) return "上区间或下区间不一致";
  const sameBasis = sameRange.filter((quote) => quote.basis === order.basis);
  if (!sameBasis.length) return "现货毛基不一致";
  return "敲出赔付不一致";
}

function buildRecord(deal, quote, sequence, status = "在挂") {
  const quoteSource = quote || findMatchingQuote(deal);
  const futureCompany = quoteSource?.futureCompany || state.futureCompany;
  const internalTitle = normalizeInternalTitle(deal.internalTitle)
    || (isYixiAffiliateOrder(deal) ? "无锡复新" : "")
    || normalizeInternalTitle(quoteSource?.internalTitle)
    || internalTitleForCompany(futureCompany);
  const contract = quoteSource?.contract || state.contractCode;
  const product = quoteSource?.product || deal.product || "冷轧";
  const makeQty = calculateMakeQty(deal.dailyQty);
  const entryPrice = deal.marketEntry ? "" : deal.entryPrice;
  const entryNumber = Number(entryPrice);
  const hasEntryPrice = Number.isFinite(entryNumber) && entryNumber > 0;
  const meltPrice = hasEntryPrice ? (deal.type === "熔断累购" ? entryNumber + deal.upper : entryNumber + deal.lower) : "";
  const section = deal.type === "熔断累购" ? `上区间${deal.upper}` : `下区间${deal.lower}`;
  const huafangBasis = deal.basis - (deal.type === "熔断累购" ? deal.lower : deal.upper);
  const directDeliveryRemark = deal.remark || inferDirectDeliveryRemark(deal, quoteSource);

  return {
    id: crypto.randomUUID(),
    date: deal.date || state.workDate,
    futureCompany,
    internalTitle,
    titleOverrideReason: deal.titleOverrideReason || (isYixiAffiliateOrder(deal) ? "艺玺体系" : ""),
    product,
    sequence,
    customer: deal.customer || "",
    type: deal.type,
    marginReceived: "",
    contract,
    section,
    entryPrice,
    marketEntry: !!deal.marketEntry,
    payoff: deal.payoff,
    dailyQty: deal.dailyQty,
    days: deal.days,
    status,
    upper: deal.upper,
    lower: deal.lower,
    customerBasis: deal.basis,
    spotBasis: deal.basis,
    huafangBasis,
    makeQty,
    meltPrice,
    dueDate: deal.dueDate,
    marginRatio: deal.marginRatio ?? 0.1,
    receiptTitle: "",
    remark: withInternalTitleRemark(directDeliveryRemark, internalTitle),
    closePrice: deal.closePrice || "",
    knockoutStatus: "正常",
  };
}

function nextSequence() {
  const sameDateRecords = state.records.filter((record) => record.date === state.workDate);
  const max = sameDateRecords.reduce((value, record) => Math.max(value, Number(record.sequence) || 0), 0);
  return max + 1;
}

function normalizeRecordSequences(records = state.records, targetDate = "") {
  if (!Array.isArray(records)) return false;
  const groups = new Map();
  records.forEach((record) => {
    if (targetDate && record.date !== targetDate) return;
    const date = record.date || "";
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(record);
  });
  let changed = false;
  groups.forEach((items) => {
    items.forEach((record, index) => {
      const sequence = index + 1;
      if (Number(record.sequence) !== sequence) {
        record.sequence = sequence;
        changed = true;
      }
    });
  });
  return changed;
}

function setOrderRoute(quote, order = null) {
  if (!els.orderRoute) return;
  if (!quote) {
    els.orderRoute.hidden = true;
    els.orderRoute.textContent = "";
    return;
  }
  const company = quote.futureCompany || "未填期货公司";
  const yixiAffiliate = isYixiAffiliateOrder(order);
  const quoteTitle = titleForQuote(quote);
  const title = yixiAffiliate ? "无锡复新" : (order?.internalTitle || quoteTitle);
  els.orderRoute.hidden = false;
  els.orderRoute.innerHTML = yixiAffiliate
    ? `艺玺体系特别规则：请挂到 <strong>${escapeHtml(`${company}复新群`)}</strong>，合同抬头固定为 <strong>无锡复新</strong>`
    : isDualInternalTitle(quoteTitle)
      ? `请挂到：<strong>${escapeHtml(company)}</strong>。本结构为<strong>华方和复新均可</strong>，本次合同抬头：<strong>${escapeHtml(title)}</strong>${order?.requestedTitle ? "（已按客户注明抬头匹配）" : "（已人工确认）"}`
      : `请挂到：<strong>${escapeHtml(company)}</strong>，合同抬头：<strong>${escapeHtml(title)}</strong>`;
}

function setReceiptTitleNotice(record) {
  if (!els.receiptTitleNotice) return;
  if (!record) {
    els.receiptTitleNotice.hidden = true;
    els.receiptTitleNotice.textContent = "";
    return;
  }
  const title = internalTitleForRecord(record);
  els.receiptTitleNotice.hidden = false;
  els.receiptTitleNotice.className = `title-notice ${title === "无锡复新" ? "fuxin" : ""}`.trim();
  els.receiptTitleNotice.innerHTML = title === "无锡复新"
    ? `重要提醒：这笔挂单期货公司是 <strong>${escapeHtml(record.futureCompany || "")}</strong>，回单我司抬头必须是 <strong>无锡复新</strong>。`
    : `本单我司抬头：<strong>江苏华方</strong>。`;
}

function internalTitleForRecord(record) {
  return normalizeInternalTitle(record.internalTitle) || internalTitleForCompany(record.futureCompany);
}

function internalTitleForCompany(company) {
  const text = String(company || "");
  const patterns = state.internalRules?.fuxinTitleCompanyPatterns || [];
  return patterns.some((pattern) => text.includes(pattern)) ? "无锡复新" : "江苏华方";
}

function titleForQuote(quote) {
  return normalizeInternalTitle(quote?.internalTitle) || internalTitleForCompany(quote?.futureCompany);
}

function isDualInternalTitle(value) {
  return normalizeInternalTitle(value) === DUAL_INTERNAL_TITLE;
}

function quoteMatchesRequestedTitle(quote, requestedTitle) {
  if (!requestedTitle) return true;
  const quoteTitle = titleForQuote(quote);
  return isDualInternalTitle(quoteTitle) || quoteTitle === requestedTitle;
}

function isYixiAffiliateOrder(order) {
  const customer = String(order?.customer || "").replace(/\s+/g, "");
  const sourceText = String(order?.sourceText || "").replace(/\s+/g, "");
  const rules = state.internalRules || {};
  return (rules.yixiAffiliateCustomers || []).some((name) => customer.includes(name) || sourceText.includes(name))
    || (rules.yixiAffiliateContact && sourceText.includes(rules.yixiAffiliateContact));
}

function displayQuoteTitle(quote) {
  return !normalizeInternalTitle(quote?.internalTitle) ? "待确认" : titleForQuote(quote);
}

function ensureTitleForQuote(quote, message) {
  return ensureTitlesForQuotes(quote ? [quote] : [], message);
}

function ensureTitlesForQuotes(quotes, message) {
  const unconfirmed = quotes.filter((quote) => quote && !normalizeInternalTitle(quote.internalTitle));
  if (!unconfirmed.length) return true;
  const groups = new Map();
  unconfirmed.forEach((quote) => {
    const company = String(quote.futureCompany || "未填期货公司").trim() || "未填期货公司";
    if (!groups.has(company)) groups.set(company, []);
    groups.get(company).push(quote);
  });
  const selectedTitles = new Map();
  for (const [company] of groups) {
    const title = promptInternalTitle(`${message}\n\n期货公司：【${company}】`);
    if (!title) return false;
    selectedTitles.set(company, title);
  }
  groups.forEach((items, company) => {
    items.forEach((quote) => {
      quote.internalTitle = selectedTitles.get(company);
    });
  });
  return true;
}

function promptInternalTitle(message) {
  for (let i = 0; i < 3; i += 1) {
    const choice = prompt(`${message}\n\n请选择合同抬头：\n1 或 华方 = 江苏华方\n2 或 复新/复兴 = 无锡复新\n3 或 双抬头/都可 = 华方和复新均可`, "");
    if (choice === null) return "";
    const text = choice.trim();
    if (text === "3" || text.includes("双抬头") || text.includes("都可") || text.includes("均可") || text.includes("华方和复新")) return DUAL_INTERNAL_TITLE;
    if (text === "1" || text.includes("华方") || text.includes("江苏华方")) return "江苏华方";
    if (text === "2" || text.includes("复新") || text.includes("复兴") || text.includes("无锡复新")) return "无锡复新";
    alert("请输入 1/华方、2/复新，或 3/双抬头。");
  }
  return "";
}

function promptActualOrderTitle(message) {
  for (let i = 0; i < 3; i += 1) {
    const choice = prompt(`${message}\n\n请输入：1 或 华方 = 江苏华方；2 或 复新/复兴 = 无锡复新`, "");
    if (choice === null) return "";
    const text = choice.trim();
    if (text === "1" || text.includes("华方") || text.includes("江苏华方")) return "江苏华方";
    if (text === "2" || text.includes("复新") || text.includes("复兴") || text.includes("无锡复新")) return "无锡复新";
    alert("本次实际挂单必须选择华方或复新，请输入 1/华方 或 2/复新。");
  }
  return "";
}

function resolveTitleAmbiguity(quotes) {
  if (!quotes.length) return null;
  const companies = [...new Set(quotes.map((quote) => String(quote.futureCompany || "")))];
  if (companies.length !== 1) return null;
  const titles = [...new Set(quotes.map((quote) => titleForQuote(quote)))];
  if (titles.length <= 1) return null;
  const company = companies[0] || "未填期货公司";
  const title = promptInternalTitle(`匹配到多条相同【${company}】结构，但合同抬头不同，请确认本次挂单使用哪个抬头。`);
  if (!title) return null;
  return quotes.find((quote) => titleForQuote(quote) === title) || null;
}

function normalizeInternalTitle(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.includes("双抬头") || text.includes("都可") || text.includes("均可") || text.includes("华方和复新")) return DUAL_INTERNAL_TITLE;
  if (text === "复新" || text.includes("无锡复新")) return "无锡复新";
  if (text === "华方" || text.includes("江苏华方")) return "江苏华方";
  return text;
}

function withInternalTitleRemark(remark, internalTitle) {
  const clean = String(remark || "").trim();
  return clean
    .replaceAll("复新抬头", "")
    .replaceAll("无锡复新合同抬头", "")
    .replace(/^[；;、，,\s]+|[；;、，,\s]+$/g, "");
}

function standardOrderText(order) {
  const makeQty = calculateMakeQty(order.dailyQty);
  const entryText = order.marketEntry ? "市价" : order.entryPrice;
  return `${order.type}：
上区间 ${formatBasis(order.upper, order)}，下区间 ${formatBasis(order.lower, order)}，敲出赔付${order.payoff}
挂${entryText} 每天${makeQty}吨`;
}

function requiredOrderMissing(order) {
  const fields = [];
  if (!order.type) fields.push("类型");
  if (!order.days) fields.push("交易日");
  if (!order.dueDate) fields.push("到期日");
  if (order.lower === null) fields.push("下区间");
  if (order.basis === null) fields.push("现货毛基");
  if (order.payoff === null) fields.push("敲出赔付");
  if (!order.entryPrice && !order.marketEntry) fields.push("挂单价");
  if (!order.dailyQty) fields.push("每日量");
  return fields;
}

function requiredOrderBasics(order) {
  const fields = [];
  if (order.lower === null) fields.push("下区间");
  if (order.basis === null) fields.push("现货毛基");
  if (order.payoff === null) fields.push("敲出赔付");
  if (!order.entryPrice && !order.marketEntry) fields.push("挂单价");
  if (!order.dailyQty) fields.push("每日量");
  return fields;
}

function requiredDealMissing(deal) {
  return requiredOrderMissing(deal);
}

function renderAll() {
  renderCandidates();
  renderQuotes();
  renderOrderRegister();
  renderClosePriceControls();
  renderLedger();
  renderReceiptCustomers();
  renderReceipts();
}

function renderOrderRegister() {
  const headers = ["序号", "客户", "保证金是否已到", "抬头", "类型", "合约", "入场价", "每日量", "交易日", "状态", "上区间", "下区间", "现货毛基", "做单量", "熔断价格", "熔断状态", "备注", "操作"];
  if (!state.records.length) {
    els.orderRegisterTable.innerHTML = "";
    return;
  }
  const body = state.records.map((record) => `
    <tr data-record-id="${escapeAttr(record.id)}" class="${record.knockoutStatus === "熔断" ? "knockout-row" : ""}">
      <td>${record.sequence}</td>
      <td><input class="mini-input text" data-field="customer" type="text" value="${escapeAttr(record.customer || "")}" placeholder="客户名称" /></td>
      <td><input class="mini-input text" data-field="marginReceived" type="text" value="${escapeAttr(record.marginReceived || "")}" placeholder="例如：已到/未到" /></td>
      <td><span class="tag ${internalTitleForRecord(record) === "无锡复新" ? "warn" : "ok"}">${escapeHtml(internalTitleForRecord(record))}</span></td>
      <td>${escapeHtml(record.type)}</td>
      <td>${escapeHtml(record.contract)}</td>
      <td><input class="mini-input price" data-field="entryPrice" type="number" value="${escapeAttr(record.entryPrice)}" placeholder="${record.marketEntry && !record.entryPrice ? "市价待填" : ""}" /></td>
      <td>${record.dailyQty}</td>
      <td>${record.days}</td>
      <td>
        <select class="mini-select" data-field="status">
          <option value="在挂"${record.status === "在挂" ? " selected" : ""}>在挂</option>
          <option value="成交"${record.status === "成交" ? " selected" : ""}>成交</option>
        </select>
      </td>
      <td>${formatBasis(record.upper, record)}</td>
      <td>${formatBasis(record.lower, record)}</td>
      <td>${formatRecordSpotPrice(record)}</td>
      <td>${record.makeQty}</td>
      <td>${record.meltPrice || ""}</td>
      <td><span class="tag ${record.knockoutStatus === "熔断" ? "danger" : "ok"}">${escapeHtml(record.knockoutStatus || "正常")}</span></td>
      <td><input class="mini-input text" data-field="remark" type="text" value="${escapeAttr(record.remark || "")}" placeholder="备注" /></td>
      <td>
        <div class="row-actions">
          <button class="tiny-button danger" data-action="delete-record">删除</button>
        </div>
      </td>
    </tr>
  `).join("");
  els.orderRegisterTable.innerHTML = `<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${body}</tbody>`;
  els.orderRegisterTable.querySelectorAll("[data-field]").forEach((input) => {
    const recordId = input.closest("tr").dataset.recordId;
    const update = () => updateEditableRecord(recordId, input.dataset.field, input.value);
    input.addEventListener("input", update);
    input.addEventListener("change", () => {
      update();
      renderAll();
    });
  });
  els.orderRegisterTable.querySelectorAll("[data-action='delete-record']").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(button.closest("tr").dataset.recordId));
  });
}

function renderClosePriceControls() {
  if (!els.closePriceControls) return;
  const completedToday = state.records.filter((record) => record.date === state.workDate && record.status === "成交");
  const contracts = [...new Set(completedToday.map((record) => record.contract).filter(Boolean))];
  if (!contracts.length) {
    els.closePriceControls.innerHTML = `<span class="muted-inline">成交后填写合约收盘价</span>`;
    return;
  }
  els.closePriceControls.innerHTML = contracts.map((contract) => {
    const values = [...new Set(completedToday
      .filter((record) => record.contract === contract)
      .map((record) => record.closePrice)
      .filter((value) => value !== "" && value !== null && value !== undefined)
      .map(String))];
    const value = values.length === 1 ? values[0] : "";
    return `<label class="close-price-field">
      <span>${escapeHtml(contract)}收盘价</span>
      <input data-contract-close="${escapeAttr(contract)}" type="number" value="${escapeAttr(value)}" placeholder="收盘价" />
    </label>`;
  }).join("");
  els.closePriceControls.querySelectorAll("[data-contract-close]").forEach((input) => {
    input.addEventListener("change", () => applyContractClosePrice(input.dataset.contractClose, input.value));
  });
}

function applyContractClosePrice(contract, rawValue) {
  const closePrice = rawValue === "" ? "" : Number(rawValue);
  if (closePrice !== "" && (!Number.isFinite(closePrice) || closePrice <= 0)) {
    showMessage(els.dealMessage, "收盘价不正确，请重新填写。", "error");
    return;
  }
  let count = 0;
  state.records.forEach((record) => {
    if (record.date === state.workDate && record.status === "成交" && record.contract === contract) {
      record.closePrice = closePrice;
      record.knockoutStatus = calculateKnockoutStatus(record);
      count += 1;
    }
  });
  saveState();
  renderAll();
  showMessage(els.dealMessage, `已更新 ${contract} 收盘价，共 ${count} 笔成交挂单。`, "ok");
}

function renderCandidates() {
  const rows = state.candidates.map((quote) => ({
    选择: `<input type="checkbox" data-candidate-id="${escapeAttr(quote.id)}" checked />`,
    日期: displayQuoteDate(quote),
    期货公司: quote.futureCompany,
    合同抬头: displayQuoteTitle(quote),
    品种: quote.product || "冷轧",
    类型: quote.type,
    合约: quote.contract,
    交易日: quote.days,
    到期日: quote.dueDate,
    上区间: formatBasis(quote.upper, quote),
    下区间: formatBasis(quote.lower, quote),
    现货毛基: formatBasis(quote.basis, quote),
    敲出赔付: quote.payoff,
  }));
  renderTable(els.candidateTable, rows, null, { rawColumns: ["选择"] });
}

function renderQuotes() {
  const rows = state.quotes.map((quote, index) => ({
    序号: index + 1,
    日期: displayQuoteDate(quote),
    期货公司: quote.futureCompany,
    合同抬头: displayQuoteTitle(quote),
    品种: quote.product || "冷轧",
    类型: quote.type,
    合约: quote.contract,
    交易日: quote.days,
    到期日: quote.dueDate,
    上区间: formatBasis(quote.upper, quote),
    下区间: formatBasis(quote.lower, quote),
    现货毛基: formatBasis(quote.basis, quote),
    敲出赔付: quote.payoff,
    超交毛基: quote.huafangBasis,
    操作: `<button class="tiny-button danger" data-delete-quote="${escapeAttr(quote.id)}">删除</button>`,
  }));
  renderTable(els.quoteTable, rows, null, { rawColumns: ["操作"] });
  els.quoteTable.querySelectorAll("[data-delete-quote]").forEach((button) => {
    button.addEventListener("click", () => deleteSealedQuote(button.dataset.deleteQuote));
  });
}

function deleteSealedQuote(quoteId) {
  const quote = state.quotes.find((item) => item.id === quoteId);
  if (!quote) return;
  const ok = confirm(`确认删除这条封存结构吗？\n期货公司：${quote.futureCompany || "未填"}\n类型：${quote.type}\n上区间：${formatBasis(quote.upper, quote)}\n下区间：${formatBasis(quote.lower, quote)}\n现货毛基：${formatBasis(quote.basis, quote)}\n敲出赔付：${quote.payoff}`);
  if (!ok) return;
  state.quotes = state.quotes.filter((item) => item.id !== quoteId);
  saveState();
  renderAll();
  showMessage(els.quoteMessage, "已删除该条封存结构。", "ok");
}

function renderLedger() {
  const rows = state.records.map((record) => ledgerRow(record));
  renderTable(els.ledgerTable, rows, ledgerHeaders, {
    rowClass: (row) => row.熔断状态 === "熔断" ? "knockout-row" : "",
  });
}

function renderReceiptCustomers() {
  const current = els.receiptCustomer.value;
  const completed = state.records.filter((record) => record.status === "成交");
  els.receiptCustomer.innerHTML = completed.length
    ? completed.map((record) => `<option value="${escapeAttr(record.id)}">${escapeHtml(`${record.sequence} - ${internalTitleForRecord(record)} - ${record.customer || "未填客户"} - ${record.entryPrice || "市价待填"}`)}</option>`).join("")
    : `<option value="">暂无成交挂单</option>`;
  const preferred = completed.some((record) => record.id === state.activeReceiptRecordId)
    ? state.activeReceiptRecordId
    : current;
  els.receiptCustomer.value = completed.some((record) => record.id === preferred) ? preferred : completed[0]?.id || "";
  const selectedRecord = completed.find((record) => record.id === els.receiptCustomer.value);
  if (selectedRecord?.customer && (els.receiptTitle.dataset.autoTitle !== "0" || !els.receiptTitle.value.trim())) {
    els.receiptTitle.value = selectedRecord.customer;
    els.receiptTitle.dataset.autoTitle = "1";
  }
}

function updateEditableRecord(recordId, field, rawValue) {
  const record = state.records.find((item) => item.id === recordId);
  if (!record) return;

  if (field === "entryPrice") {
    const entryPrice = rawValue === "" ? "" : Number(rawValue);
    record.entryPrice = Number.isFinite(entryPrice) && entryPrice > 0 ? entryPrice : "";
    if (record.entryPrice !== "") record.marketEntry = false;
    record.meltPrice = record.entryPrice === ""
      ? ""
      : (record.type === "熔断累购" ? record.entryPrice + record.upper : record.entryPrice + record.lower);
  } else if (field === "customer") {
    record.customer = String(rawValue || "").trim();
  } else if (field === "marginReceived") {
    record.marginReceived = String(rawValue || "").trim();
  } else if (field === "remark") {
    record.remark = withInternalTitleRemark(String(rawValue || "").trim(), internalTitleForRecord(record));
  } else if (field === "status") {
    record.status = rawValue === "成交" ? "成交" : "在挂";
  }

  record.internalTitle = internalTitleForRecord(record);
  record.knockoutStatus = calculateKnockoutStatus(record);
  if (record.status === "成交") {
    state.activeReceiptRecordId = record.id;
  }
  saveState();
}

function deleteRecord(recordId) {
  const record = state.records.find((item) => item.id === recordId);
  if (!record) return;
  const ok = confirm(`确认删除这笔挂单吗？\n序号：${record.sequence}\n客户：${record.customer || "未填客户"}\n入场价：${record.entryPrice}`);
  if (!ok) return;
  state.records = state.records.filter((item) => item.id !== recordId);
  normalizeRecordSequences(state.records, record.date);
  if (state.activeReceiptRecordId === recordId) {
    state.activeReceiptRecordId = "";
  }
  saveState();
  renderAll();
  showMessage(els.dealMessage, "已删除该笔挂单。", "ok");
}

function calculateKnockoutStatus(record) {
  if (record.closePrice === "" || record.closePrice === null || record.closePrice === undefined) return "正常";
  const closePrice = Number(record.closePrice);
  const entryPrice = Number(record.entryPrice);
  if (!Number.isFinite(closePrice)) return "正常";
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return "正常";
  const upperPrice = entryPrice + record.upper;
  const lowerPrice = entryPrice + record.lower;
  if (record.type === "熔断累购" && closePrice >= upperPrice) return "熔断";
  if (record.type === "熔断累沽" && closePrice <= lowerPrice) return "熔断";
  return "正常";
}

function isStandardDailyQty(dailyQty) {
  return Number.isFinite(Number(dailyQty)) && Number.isInteger(Number(dailyQty) / 11);
}

function calculateMakeQty(dailyQty) {
  const qty = Number(dailyQty);
  if (!Number.isFinite(qty)) return "";
  return isStandardDailyQty(qty) ? (qty / 11) * 10 : qty;
}

function renderReceipts() {
  const selected = els.receiptCustomer.value;
  state.activeReceiptRecordId = selected;
  const record = state.records.find((item) => item.id === selected && item.status === "成交");
  if (!record) {
    setReceiptTitleNotice(null);
    els.receiptOutput.textContent = "暂无可制作回单的成交挂单。";
    return;
  }
  setReceiptTitleNotice(record);
  if (!Number.isFinite(Number(record.entryPrice)) || Number(record.entryPrice) <= 0) {
    els.receiptOutput.textContent = "这笔是市价挂单，请先在挂单登记里补充实际成交价，再制作回单。";
    return;
  }
  if (record.customer && (els.receiptTitle.dataset.autoTitle !== "0" || !els.receiptTitle.value.trim())) {
    els.receiptTitle.value = record.customer;
    els.receiptTitle.dataset.autoTitle = "1";
  }
  const title = els.receiptTitle.value.trim() || record.customer;
  const ratioText = els.receiptMarginRatio.value.trim();
  if (!title || !ratioText) {
    els.receiptOutput.textContent = "请选择成交挂单，并填写保证金比例。";
    return;
  }
  const ratio = Number(ratioText) / 100;
  if (!Number.isFinite(ratio) || ratio < 0) {
    els.receiptOutput.textContent = "保证金比例不正确。";
    return;
  }
  record.receiptTitle = title;
  record.marginRatio = ratio;
  record.internalTitle = internalTitleForRecord(record);
  record.remark = withInternalTitleRemark(record.remark || "", record.internalTitle);
  saveState();
  els.receiptOutput.textContent = receiptText(record);
}

function receiptText(record) {
  const deliveryPrice = record.entryPrice + record.spotBasis;
  const upperPrice = record.entryPrice + record.upper;
  const lowerPrice = record.entryPrice + record.lower;
  const marginRaw = deliveryPrice * record.days * record.dailyQty * record.marginRatio;
  const margin = Math.round(marginRaw / 10000) * 10000;
  const contractType = record.type === "熔断累购" ? "熔断累购采购" : "熔断累沽销售";
  const internalTitle = internalTitleForRecord(record);
  const remark = withInternalTitleRemark(record.remark || "", internalTitle);
  const remarkLine = remark ? `\n备注：${remark}` : "";
  const productLine = record.product === "热轧" ? "\n品种：热轧" : "";
  return `我司抬头：${internalTitle}
客户名称：${record.receiptTitle || record.customer}${productLine}
交易日期：${record.date}
到期日期：${record.dueDate}
标的合约：${record.contract}
合同类型：${contractType}
入场价格：${formatMoney(record.entryPrice)}
上界价格：${formatMoney(upperPrice)}
下界价格：${formatMoney(lowerPrice)}
敲出赔付：${record.payoff}元/吨
交货价格：${formatMoney(deliveryPrice)}元/吨
每日观察量：${record.dailyQty}吨
起始观察日期：${record.date}
观察次数：${record.days}
保证金：${formatMoney(margin)}元${remarkLine}`;
}

function ledgerRow(record) {
  const entryPrice = Number(record.entryPrice);
  const spotPrice = Number.isFinite(entryPrice) && entryPrice > 0 ? entryPrice + record.customerBasis : "";
  return {
    日期: record.date,
    期货公司: record.futureCompany,
    合同抬头: internalTitleForRecord(record),
    序号: record.sequence,
    客户: record.customer,
    类型: record.type,
    "保证金是否已到": record.marginReceived || "",
    合约: record.contract,
    区间: record.section,
    入场价: record.entryPrice || (record.marketEntry ? "市价待成交" : ""),
    "赔付（元/吨）": record.payoff,
    "每日量（吨）": record.dailyQty,
    "交易日（个）": record.days,
    挂单状态: record.status,
    上区间: record.upper,
    下区间: record.lower,
    客户毛基: record.customerBasis,
    现货毛基: spotPrice,
    超交毛基: record.huafangBasis,
    "做单量（吨）": record.makeQty,
    熔断价格: record.meltPrice || "",
    收盘价: record.closePrice || "",
    熔断状态: record.knockoutStatus || calculateKnockoutStatus(record),
    备注: record.remark || "",
  };
}

function renderTable(table, rows, forcedHeaders = null, options = {}) {
  const headers = forcedHeaders || Object.keys(rows[0] || {});
  const rawColumns = options.rawColumns || [];
  const rowClass = options.rowClass || (() => "");
  if (!headers.length) {
    table.innerHTML = "";
    return;
  }
  const head = `<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`;
  const body = `<tbody>${rows.map((row) => `<tr class="${escapeAttr(rowClass(row))}">${headers.map((header) => `<td${rawColumns.includes(header) ? ' class="check-cell"' : ""}>${rawColumns.includes(header) ? row[header] : formatCell(row[header])}</td>`).join("")}</tr>`).join("")}</tbody>`;
  table.innerHTML = head + body;
}

function renderDetails(node, order) {
  const items = {
    客户: order.customer || "未识别",
    客户注明抬头: order.requestedTitle || "未注明",
    品种: order.product || "未识别",
    保证金比例: order.marginRatio === null ? "未识别" : `${order.marginRatio * 100}%`,
    类型: order.type || "未识别",
    交易日: order.days || "未识别",
    到期日: order.dueDate || "未识别",
    合约: order.contract || "未识别",
    上区间: order.upper === null ? "未识别" : formatBasis(order.upper, order),
    下区间: order.lower === null ? "未识别" : formatBasis(order.lower, order),
    现货毛基: order.basis === null ? "未识别" : formatBasis(order.basis, order),
    敲出赔付: order.payoff ?? "未识别",
    挂单价: order.marketEntry ? "市价" : (order.entryPrice || "未识别"),
    每日量: order.dailyQty ? `${order.dailyQty}吨` : "未识别",
  };
  node.innerHTML = Object.entries(items).map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("");
}

function exportLedger() {
  const rows = state.records.map((record) => ledgerRow(record));
  const html = `<!doctype html><html><head><meta charset="UTF-8"><style>.knockout{background:#fff1f0;color:#7a1d14;}</style></head><body><table border="1"><thead><tr>${ledgerHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr class="${row.熔断状态 === "熔断" ? "knockout" : ""}">${ledgerHeaders.map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  downloadBlob(blob, `${shortDate(state.workDate)}挂单登记.xls`);
}

function copyLedger() {
  const lines = [ledgerHeaders.join("\t")];
  state.records.forEach((record) => {
    const row = ledgerRow(record);
    lines.push(ledgerHeaders.map((header) => row[header] ?? "").join("\t"));
  });
  copyText(lines.join("\n"), null, "登记表已复制。");
}

function formatRecordSpotPrice(record) {
  const entryPrice = Number(record.entryPrice);
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return "";
  return formatMoney(entryPrice + record.customerBasis);
}

function readSignedValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}\\s*(?:0?[1-9]|1[0-2])\\s*([+-])\\s*(\\d+)`));
  if (!match) return null;
  const value = Number(match[2]);
  return match[1] === "-" ? -value : value;
}

function readPlainNumber(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}\\s*(\\d+)`));
  return match ? Number(match[1]) : null;
}

function readEntryPrice(text) {
  const normalized = cleanLine(text);
  const labeled = normalized.match(/(?:挂单价|入场价)\s*[:：]?\s*(\d{4,6})/);
  if (labeled) return Number(labeled[1]);
  const direct = normalized.match(/挂\s*(\d{4,6})/);
  if (direct) return Number(direct[1]);
  const reverse = normalized.match(/(\d{4,6})\s*挂/);
  if (reverse) return Number(reverse[1]);
  const nearQty = normalized.match(/(?:^|[，,\s])(\d{4,6})(?:\s*(?:入场|价))?\s*[，,\s]+(?:每天\s*)?\d+(?:\.\d+)?\s*(?:吨|t|T)/);
  return nearQty ? Number(nearQty[1]) : null;
}

function isMarketEntry(text) {
  return /挂\s*(?:市价|现价)|(?:市价|现价)\s*成交?/.test(cleanLine(text));
}

function readDailyQty(text) {
  const normalized = cleanLine(text).replace(/[Ｔｔ]/g, "t");
  const daily = normalized.match(/每天\s*(\d+(?:\.\d+)?)\s*(?:吨|t|T)/);
  if (daily) return Number(daily[1]);
  const anyQty = normalized.match(/(?:^|[，,\s])(\d+(?:\.\d+)?)\s*(?:吨|t|T)/);
  return anyQty ? Number(anyQty[1]) : null;
}

function parseChineseDate(text) {
  const match = String(text || "").match(/^\s*(\d{1,2})[.\-/月](\d{1,2})\s*(?:日|夜盘|$)/);
  if (!match) return "";
  return toIsoDate(Number(match[1]), Number(match[2]));
}

function findTradeDateMismatch(text) {
  const matches = [...String(text || "").matchAll(/(?:^|\s)(\d{1,2})[.\-/月](\d{1,2})\s*日/g)];
  const dates = [...new Set(matches.map((match) => toIsoDate(Number(match[1]), Number(match[2]))))];
  return dates.find((date) => date !== state.workDate) || "";
}

function toIsoDate(month, day) {
  const year = Number((state.workDate || latestBusinessDate()).slice(0, 4));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function refreshWorkDateForNewSession(targetState) {
  const latest = latestBusinessDate();
  const current = targetState.workDate;
  if (!current || current < latest || !validateBusinessDate(current).ok) {
    targetState.workDate = latest;
    return true;
  }
  return false;
}

function latestBusinessDate(referenceDate = new Date()) {
  const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  for (let i = 0; i < 370; i += 1) {
    const iso = formatYmdDate(date);
    if (validateBusinessDate(iso).ok) return iso;
    date.setDate(date.getDate() - 1);
  }
  return formatYmdDate(referenceDate);
}

function validateBusinessDate(dateText) {
  if (!dateText) return { ok: false, reason: "日期为空" };
  if (HOLIDAYS_2026.has(dateText)) return { ok: false, reason: "法定节假日/调休放假日" };
  if (ADJUSTED_WORKDAYS_2026.has(dateText)) return { ok: true, reason: "" };
  const date = parseYmdDate(dateText);
  if (Number.isNaN(date.getTime())) return { ok: false, reason: "日期格式不正确" };
  const day = date.getDay();
  if (day === 0 || day === 6) return { ok: false, reason: "周末" };
  return { ok: true, reason: "" };
}

function nextBusinessDate(dateText) {
  const date = parseYmdDate(dateText);
  if (Number.isNaN(date.getTime())) return state.workDate;
  for (let i = 0; i < 20; i++) {
    const iso = formatYmdDate(date);
    if (validateBusinessDate(iso).ok) return iso;
    date.setDate(date.getDate() + 1);
  }
  return dateText;
}

function parseYmdDate(dateText) {
  const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date("invalid");
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatYmdDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeMultiplier(value) {
  if (!value) return "二倍";
  return value.replace("两", "二");
}

function cleanLine(value) {
  return String(value || "").replace(/\u2005|\u2006|\u2009|\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function formatBasis(value, source = null) {
  if (value === null || value === undefined || value === "") return "";
  const month = currentContractMonth(source);
  return value >= 0 ? `${month}+${value}` : `${month}${value}`;
}

function currentContractMonth(source = null) {
  if (source?.basisMonth) return String(Number(source.basisMonth)).padStart(2, "0");
  const match = String(source?.contract || state.contractCode || "").match(/(\d{2})$/);
  if (!match) return "09";
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? match[1] : "09";
}

function contractMonthFromCode(contract) {
  const match = String(contract || "").match(/(\d{2})$/);
  if (!match) return "";
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? match[1] : "";
}

function displayQuoteDate(quote) {
  const match = String(quote.date || "").match(/\d{4}-(\d{2})-(\d{2})/);
  const date = match ? `${Number(match[1])}.${Number(match[2])}` : quote.date;
  return (quote.product || "冷轧") === "热轧" ? `${date}（热轧）` : date;
}

function formatMoney(value) {
  return Number(value).toLocaleString("zh-CN");
}

function formatCell(value) {
  if (value === null || value === undefined || value === "") return `<span class="cell-muted">-</span>`;
  return escapeHtml(value);
}

function showMessage(node, text, type = "") {
  if (!node) {
    alert(text);
    return;
  }
  node.textContent = text;
  node.className = `message ${type}`.trim();
}

function copyText(text, messageNode, successText) {
  if (!text) {
    if (messageNode) showMessage(messageNode, "没有可复制的内容。", "warn");
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    if (messageNode) showMessage(messageNode, successText, "ok");
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function shortDate(date) {
  const [, month, day] = date.match(/(\d{4})-(\d{2})-(\d{2})/) || [];
  return month && day ? `${Number(month)}.${Number(day)}` : "今日";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
