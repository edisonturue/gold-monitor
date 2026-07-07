(function() {
// Golden Monitor - Init Module
// Event listeners and page initialization - loaded last
var GM = window.GM, state = GM.state, el = GM.el;
var escapeHtml = GM.escapeHtml, fmtNumber = GM.fmtNumber, toNumberLoose = GM.toNumberLoose;
var roundTo = GM.roundTo, clamp = GM.clamp, labelSymbol = GM.labelSymbol;
var labelSource = GM.labelSource, formatLocalTime = GM.formatLocalTime, formatAge = GM.formatAge;
var freshnessText = GM.freshnessText, freshnessClass = GM.freshnessClass, priceMap = GM.priceMap;
var asBiasClass = GM.asBiasClass, lineColor = GM.lineColor, safeHref = GM.safeHref;
var fetchJson = GM.fetchJson, setRefreshStatus = GM.setRefreshStatus, setRuleTip = GM.setRuleTip;
var setWecomTip = GM.setWecomTip, setDeployTip = GM.setDeployTip, setInviteTip = GM.setInviteTip;
var setUserManageTip = GM.setUserManageTip, setUserCreateTip = GM.setUserCreateTip;
var setUserManageSummary = GM.setUserManageSummary, setChangePasswordTip = GM.setChangePasswordTip;
var setLoginAuditTip = GM.setLoginAuditTip, setLoginAuditSummary = GM.setLoginAuditSummary;
var setInsightTip = GM.setInsightTip, setInsightProviderTip = GM.setInsightProviderTip;
var setInsightAssistantTip = GM.setInsightAssistantTip, setDashboardInsightTip = GM.setDashboardInsightTip;
var setBacktestTip = GM.setBacktestTip, setBacktestCompareTip = GM.setBacktestCompareTip;
var setActiveTab = GM.setActiveTab, setActiveWorkspace = GM.setActiveWorkspace;
var setDeployView = GM.setDeployView, openWorkspaceModal = GM.openWorkspaceModal;
var closeWorkspaceModal = GM.closeWorkspaceModal, closeWorkspaceModalForForm = GM.closeWorkspaceModalForForm;
var focusInlineForm = GM.focusInlineForm, openActionModal = GM.openActionModal;
var closeActionModal = GM.closeActionModal, renderWorkspaceGuide = GM.renderWorkspaceGuide;
var renderWorkspaceResponsibility = GM.renderWorkspaceResponsibility;
var scheduleAutoRefresh = GM.scheduleAutoRefresh, normalizeZoom = GM.normalizeZoom;
var readChartZoom = GM.readChartZoom, applyZoomToChart = GM.applyZoomToChart;
var setZoomRange = GM.setZoomRange, zoomBy = GM.zoomBy, dashboardVisible = GM.dashboardVisible;
var insightStatusLabel = GM.insightStatusLabel, insightStageLabel = GM.insightStageLabel;
var insightTriggerTypeLabel = GM.insightTriggerTypeLabel, isInsightDoneStatus = GM.isInsightDoneStatus;
var isInsightLiveStatus = GM.isInsightLiveStatus, trimInsightStreamText = GM.trimInsightStreamText;
var normalizeInsightProgressPayload = GM.normalizeInsightProgressPayload;
var mergeInsightDetailWithProgress = GM.mergeInsightDetailWithProgress;
var renderInsightProgressCard = GM.renderInsightProgressCard;
var renderInsightDetailEmpty = GM.renderInsightDetailEmpty;
var renderInsightEventDetail = GM.renderInsightEventDetail;
var renderInsightEvents = GM.renderInsightEvents;
var renderInsightChatModalContent = GM.renderInsightChatModalContent;
var openInsightChatModal = GM.openInsightChatModal, closeInsightChatModal = GM.closeInsightChatModal;
var isInsightChatModalOpen = GM.isInsightChatModalOpen;
var loadInsightEventDetail = GM.loadInsightEventDetail, loadDashboardEventDetail = GM.loadDashboardEventDetail;
var openInsightChatByEventId = GM.openInsightChatByEventId;
var openInsightEventDetailFromList = GM.openInsightEventDetailFromList;
var syncInsightEventProgressWatcher = GM.syncInsightEventProgressWatcher;
var stopInsightEventProgressWatcher = GM.stopInsightEventProgressWatcher;
var startInsightEventProgressWatcher = GM.startInsightEventProgressWatcher;
var normalizeInsightAiError = GM.normalizeInsightAiError, buildInsightAiRuntimeBody = GM.buildInsightAiRuntimeBody;
var cleanInsightRichText = GM.cleanInsightRichText, normalizeTextArray = GM.normalizeTextArray;
var collectInsightEvidence = GM.collectInsightEvidence, renderInsightListBlock = GM.renderInsightListBlock;
var renderInsightDiagnosticsBlock = GM.renderInsightDiagnosticsBlock, deriveInsightFailureInfo = GM.deriveInsightFailureInfo;
var renderNotifyPreview = GM.renderNotifyPreview, renderWecomGuide = GM.renderWecomGuide;
var normalizeWecomWebhookHint = GM.normalizeWecomWebhookHint;
var renderSettings = GM.renderSettings, renderUsers = GM.renderUsers, renderLoginAudit = GM.renderLoginAudit;
var renderSourceExpectedInputs = GM.renderSourceExpectedInputs, readSourceExpectedInputs = GM.readSourceExpectedInputs;
var renderInsightSettings = GM.renderInsightSettings, renderInsightStrategyList = GM.renderInsightStrategyList;
var renderDetectedModels = GM.renderDetectedModels;
var refreshInsightSettings = GM.refreshInsightSettings, refreshInsightEvents = GM.refreshInsightEvents;
var refreshSettings = GM.refreshSettings, refreshUsers = GM.refreshUsers, refreshLoginAudit = GM.refreshLoginAudit;
var updateBacktestCompareSortUi = GM.updateBacktestCompareSortUi;
var readBacktestCompareRuleIds = GM.readBacktestCompareRuleIds;
var resolveWecomTestHint = GM.resolveWecomTestHint;
var axisTimeKey = GM.axisTimeKey, alignEventTimeKey = GM.alignEventTimeKey;
var closeByTimeKeyMap = GM.closeByTimeKeyMap, eventsForSymbol = GM.eventsForSymbol;
var eventScatterSeries = GM.eventScatterSeries, axisIntervalBySize = GM.axisIntervalBySize;
var roundedSeries = GM.roundedSeries, buildCandlesPayload = GM.buildCandlesPayload;
var sanitizeBars = GM.sanitizeBars, ensureBarsFromLatest = GM.ensureBarsFromLatest;

var refreshMarket = GM.refreshMarket, refreshRulesAndAlerts = GM.refreshRulesAndAlerts;
var refreshYFinance = GM.refreshYFinance, repaintDashboardCharts = GM.repaintDashboardCharts;
var renderActiveCharts = GM.renderActiveCharts, setLayout = GM.setLayout;
var setKlineTableView = GM.setKlineTableView, bindChartEventClicks = GM.bindChartEventClicks;
var chartIntl = GM.chartIntl, chartDomestic = GM.chartDomestic, chartDual = GM.chartDual;
var chartYFinance = GM.chartYFinance, chartBacktestEquity = GM.chartBacktestEquity;
var renderRules = GM.renderRules, renderAlerts = GM.renderAlerts;
var renderBacktestResult = GM.renderBacktestResult, renderBacktestCompareResult = GM.renderBacktestCompareResult;
var updateCards = GM.updateCards, triggerInsightSummaryNow = GM.triggerInsightSummaryNow;
var submitInsightAssistantComposer = GM.submitInsightAssistantComposer;
var bindInsightChatOpen = GM.bindInsightChatOpen;
var summarizeInsightTriggerSkipped = GM.summarizeInsightTriggerSkipped;
var waitForInsightEventsDone = GM.waitForInsightEventsDone, sleep = GM.sleep;
var renderInsightAssistantContextCard = GM.renderInsightAssistantContextCard;
var renderInsightAssistantFollowups = GM.renderInsightAssistantFollowups;
var renderInsightAssistantLog = GM.renderInsightAssistantLog;
var setInsightAssistantBusy = GM.setInsightAssistantBusy;
var setInsightAssistantContext = GM.setInsightAssistantContext;
var resetInsightAssistantContext = GM.resetInsightAssistantContext;
var loadInsightAssistantHistory = GM.loadInsightAssistantHistory;
var setInsightAssistantTip = GM.setInsightAssistantTip;
var syncInsightTriggerButtons = GM.syncInsightTriggerButtons;
var insightTriggerCooldownRemainingSec = GM.insightTriggerCooldownRemainingSec;
var startInsightTriggerCooldown = GM.startInsightTriggerCooldown;
var clearInsightTriggerCooldownTimer = GM.clearInsightTriggerCooldownTimer;
var setGlobalInsightFeedback = GM.setGlobalInsightFeedback;
var setInsightRunnerPanel = GM.setInsightRunnerPanel;
var hideInsightRunnerPanel = GM.hideInsightRunnerPanel;
var renderInsightDetailEmpty = GM.renderInsightDetailEmpty;
var renderInsightEvents = GM.renderInsightEvents;
var renderInsightSettings = GM.renderInsightSettings;
var loadInsightEventDetail = GM.loadInsightEventDetail;
var loadDashboardEventDetail = GM.loadDashboardEventDetail;
var openInsightChatByEventId = GM.openInsightChatByEventId;
var openInsightEventDetailFromList = GM.openInsightEventDetailFromList;
var syncInsightEventProgressWatcher = GM.syncInsightEventProgressWatcher;

if (el.range) {
el.range.addEventListener("change", async (e) => {
  state.range = e.target.value;
  await (GM.refreshMarket || (async ()=>{}))();
});
}

if (el.timeframe) {
  el.timeframe.addEventListener("change", async (e) => {
    const next = String(e.target?.value || "1d").toLowerCase();
    state.timeframe = next === "1h" ? "1h" : "1d";
    await (GM.refreshMarket || (async ()=>{}))();
  });
}

if (el.layout) {
el.layout.addEventListener("change", (e) => {
  (GM.setLayout || function(){}) (e.target.value);
});
}

if (el.klineTableView) {
  el.klineTableView.addEventListener("change", (e) => {
    const next = String(e.target?.value || "all");
    (GM.setKlineTableView || function(){})(next);
  });
}

if (el.yfinanceForm) {
  el.yfinanceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (el.yfinanceLoad) el.yfinanceLoad.disabled = true;
    try {
      await (GM.refreshYFinance || (async ()=>{}))({ silent: false });
    } finally {
      if (el.yfinanceLoad) el.yfinanceLoad.disabled = false;
    }
  });
}

if (el.ruleForm) {
el.ruleForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const symbol = document.getElementById("rule-symbol").value;
  const condition = document.getElementById("rule-condition").value;
  const threshold = Number(document.getElementById("rule-threshold").value);
  const cooldown = Number(document.getElementById("rule-cooldown").value || 900);
  const debounce = Number(document.getElementById("rule-debounce").value || 2);
  const logicOperator = String(el.ruleLogic?.value || "and").toLowerCase();
  const indicatorFilter = document.getElementById("rule-indicator-filter").value;
  const freshnessStatus = String(el.ruleFreshnessStatus?.value || "any").toLowerCase();
  const maxAgeRaw = String(el.ruleMaxAge?.value || "").trim();

  if (!Number.isFinite(threshold) || threshold <= 0) {
    setRuleTip("阈值必须是大于 0 的数字。", true);
    return;
  }
  if (!Number.isFinite(cooldown) || cooldown < 1) {
    setRuleTip("冷却秒数必须大于等于 1。", true);
    return;
  }
  if (!Number.isFinite(debounce) || debounce < 1) {
    setRuleTip("防抖次数必须大于等于 1。", true);
    return;
  }
  if (!["and", "or"].includes(logicOperator)) {
    setRuleTip("组合逻辑仅支持 and/or。", true);
    return;
  }

  let maxAgeSec = null;
  if (maxAgeRaw) {
    const parsed = Number(maxAgeRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setRuleTip("最大数据年龄必须是大于等于 0 的数字。", true);
      return;
    }
    maxAgeSec = Math.round(parsed);
  }

  const clauses = [{ type: "price", condition, threshold }];
  const indicatorMap = {
    bullish_only: "bullish",
    bearish_only: "bearish",
    neutral_only: "neutral",
  };
  if (indicatorMap[indicatorFilter]) {
    clauses.push({ type: "indicator_bias", bias: indicatorMap[indicatorFilter] });
  }
  if (freshnessStatus !== "any" || maxAgeSec !== null) {
    const freshnessClause = { type: "freshness" };
    if (freshnessStatus !== "any") freshnessClause.status = freshnessStatus;
    if (maxAgeSec !== null) freshnessClause.max_age_sec = maxAgeSec;
    clauses.push(freshnessClause);
  }

  const payload = {
    symbol,
    condition,
    threshold,
    cooldown_sec: cooldown,
    debounce_count: debounce,
    indicator_filter: indicatorFilter,
    logic_operator: logicOperator,
    clauses,
    enabled: true,
  };

  try {
    await fetchJson("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    document.getElementById("rule-threshold").value = "";
    setRuleTip("规则已创建。");
    closeWorkspaceModalForForm("rule-form");
    await (GM.refreshRulesAndAlerts || (async ()=>{}))();
  } catch (err) {
    console.error(err);
    setRuleTip("规则创建失败，请稍后重试。", true);
  }
});
}

if (el.backtestForm) {
  el.backtestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ruleId = Number(el.backtestRuleId?.value || 0);
    const range = String(el.backtestRange?.value || "12m");
    if (!Number.isFinite(ruleId) || ruleId <= 0) {
      setBacktestTip("请先选择一个规则。", true);
      return;
    }
    setBacktestTip("回测运行中...");
    try {
      const payload = await fetchJson("/api/backtest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_id: ruleId, range }),
      });
      (GM.renderBacktestResult || function(){})(payload);
      setBacktestTip("回测完成。");
      closeWorkspaceModalForForm("backtest-form");
    } catch (err) {
      console.error(err);
      setBacktestTip("回测失败，请检查规则或重试。", true);
    }
  });
}

if (el.backtestCompareForm) {
  el.backtestCompareForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const range = String(el.backtestCompareRange?.value || "12m");
    const ruleIds = readBacktestCompareRuleIds();
    const body = { range };
    if (ruleIds.length > 0) {
      body.rule_ids = ruleIds;
    }
    setBacktestCompareTip("对比运行中...");
    try {
      const payload = await fetchJson("/api/backtest/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      (GM.renderBacktestCompareResult || function(){})(payload);
      if (ruleIds.length > 0) {
        setBacktestCompareTip(`规则对比完成，共 ${ruleIds.length} 组。`);
      } else {
        setBacktestCompareTip("规则对比完成（全部启用规则）。");
      }
      closeWorkspaceModalForForm("backtest-compare-form");
    } catch (err) {
      console.error(err);
      setBacktestCompareTip("规则对比失败，请稍后重试。", true);
    }
  });
}

for (const button of el.backtestSortButtons || []) {
  button.addEventListener("click", () => {
    const key = String(button.dataset.backtestSortKey || "").trim();
    const order = String(button.dataset.backtestSortOrder || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc";
    const label = String(button.textContent || "").trim() || "自定义排序";
    if (!key) return;
    state.backtestCompareSort = { key, order, label };
    updateBacktestCompareSortUi();
    if (state.backtestCompare && Array.isArray(state.backtestCompare.rows)) {
      (GM.renderBacktestCompareResult || function(){})(state.backtestCompare);
    }
  });
}

if (el.wecomSettingsForm) {
el.wecomSettingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    notify_title_prefix: (el.cfgTitlePrefix.value || "").trim(),
    notify_style: el.cfgNotifyStyle.value,
    notify_on_trigger: el.cfgNotifyTrigger.value === "true",
    notify_on_recover: el.cfgNotifyRecover.value === "true",
    notify_on_source: el.cfgNotifySource.value === "true",
    notify_on_heartbeat: el.cfgNotifyHeartbeat.value === "true",
  };

  const webhook = (el.cfgWebhook.value || "").trim();
  if (webhook) {
    body.wecom_webhook_url = webhook;
  }

  try {
    await fetchJson("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    el.cfgWebhook.value = "";
    state.wecomLastTest = null;
    await (GM.refreshSettings || (async ()=>{}))();
    setWecomTip("微信配置已保存。");
    closeWorkspaceModalForForm("wecom-settings-form");
  } catch (err) {
    console.error(err);
    setWecomTip("微信配置保存失败，请稍后重试。", true);
    renderWecomGuide();
  }
});
}

if (el.deploySettingsForm) {
el.deploySettingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  let sourceExpectedUpdateSecMap = {};
  try {
    sourceExpectedUpdateSecMap = readSourceExpectedInputs();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "更新周期配置不合法";
    setDeployTip(msg, true);
    return;
  }

  const sessionTtl = Number(el.cfgSessionTtl.value || 43200);
  const authMaxFailures = Number(el.cfgAuthMaxFailures.value || 10);
  const authWindowSec = Number(el.cfgAuthWindow.value || 300);
  const authBanSec = Number(el.cfgAuthBan.value || 600);
  const deployHost = (el.cfgDeployHost.value || "").trim();
  const deployPort = Number(el.cfgDeployPort.value || 8080);
  const deployTimezone = (el.cfgDeployTimezone.value || "").trim();
  const smtpHost = (el.cfgSmtpHost.value || "").trim();
  const smtpPort = Number(el.cfgSmtpPort.value || 587);
  const smtpUser = (el.cfgSmtpUser.value || "").trim();
  const smtpFrom = (el.cfgSmtpFrom.value || "").trim();
  const bootstrapCodeTtl = Number(el.cfgBootstrapCodeTtl.value || 600);
  const bootstrapCodeResend = Number(el.cfgBootstrapCodeResend.value || 60);

  if (!deployHost) {
    setDeployTip("部署监听地址不能为空。", true);
    return;
  }
  if (!Number.isFinite(deployPort) || deployPort < 1 || deployPort > 65535) {
    setDeployTip("部署端口必须是 1 到 65535 之间的数字。", true);
    return;
  }
  if (!deployTimezone) {
    setDeployTip("时区不能为空（例如 Asia/Shanghai）。", true);
    return;
  }
  if (!Number.isFinite(sessionTtl) || sessionTtl < 300) {
    setDeployTip("会话时长必须是大于等于 300 的数字。", true);
    return;
  }
  if (!Number.isFinite(authMaxFailures) || authMaxFailures < 2) {
    setDeployTip("失败次数阈值必须是大于等于 2 的数字。", true);
    return;
  }
  if (!Number.isFinite(authWindowSec) || authWindowSec < 30) {
    setDeployTip("失败统计窗口必须是大于等于 30 的数字。", true);
    return;
  }
  if (!Number.isFinite(authBanSec) || authBanSec < 10) {
    setDeployTip("封禁时长必须是大于等于 10 的数字。", true);
    return;
  }
  if (!Number.isFinite(bootstrapCodeTtl) || bootstrapCodeTtl < 120) {
    setDeployTip("验证码有效期必须是大于等于 120 的数字。", true);
    return;
  }
  if (!Number.isFinite(bootstrapCodeResend) || bootstrapCodeResend < 15) {
    setDeployTip("验证码重发间隔必须是大于等于 15 的数字。", true);
    return;
  }
  if (smtpHost || smtpUser || smtpFrom) {
    if (!smtpHost) {
      setDeployTip("启用邮箱验证时，SMTP 主机不能为空。", true);
      return;
    }
    if (!Number.isFinite(smtpPort) || smtpPort < 1) {
      setDeployTip("SMTP 端口必须是大于等于 1 的数字。", true);
      return;
    }
    if (!smtpUser) {
      setDeployTip("启用邮箱验证时，SMTP 用户名不能为空。", true);
      return;
    }
    if (!smtpFrom) {
      setDeployTip("启用邮箱验证时，发件邮箱不能为空。", true);
      return;
    }
  }

  const body = {
    poll_interval_sec: Number(el.cfgInterval.value || 5),
    domestic_premium_cny_per_g: Number(el.cfgPremium.value || 0),
    enable_console_notifications: el.cfgConsole.value === "true",
    deploy_host: deployHost,
    deploy_port: Math.round(deployPort),
    deploy_timezone: deployTimezone,
    basic_auth_user: (el.cfgAuthUser.value || "").trim(),
    session_ttl_sec: Math.round(sessionTtl),
    auth_max_failures: Math.round(authMaxFailures),
    auth_window_sec: Math.round(authWindowSec),
    auth_ban_sec: Math.round(authBanSec),
    smtp_host: smtpHost,
    smtp_port: Math.round(Number.isFinite(smtpPort) ? smtpPort : 587),
    smtp_user: smtpUser,
    smtp_from: smtpFrom,
    smtp_use_tls: el.cfgSmtpUseTls.value === "true",
    smtp_use_ssl: el.cfgSmtpUseSsl.value === "true",
    bootstrap_code_ttl_sec: Math.round(bootstrapCodeTtl),
    bootstrap_code_resend_sec: Math.round(bootstrapCodeResend),
    source_expected_update_sec_map: sourceExpectedUpdateSecMap,
  };

  const password = (el.cfgAuthPass.value || "").trim();
  if (password) {
    body.basic_auth_pass = password;
  }
  const sessionSecret = (el.cfgSessionSecret.value || "").trim();
  if (sessionSecret) {
    body.session_secret = sessionSecret;
  }
  const smtpPass = (el.cfgSmtpPass.value || "").trim();
  if (smtpPass) {
    body.smtp_pass = smtpPass;
  }

  try {
    const saved = await fetchJson("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await (GM.refreshSettings || (async ()=>{}))();
    const notice = saved?.restart_required ? saved?.restart_notice || "部署参数已保存，需重启服务后生效。" : "部署配置已保存并立即生效。";
    setDeployTip(notice);
    closeWorkspaceModalForForm("deploy-settings-form");
  } catch (err) {
    console.error(err);
    setDeployTip("部署配置保存失败，请稍后重试。", true);
  }
});
}

if (el.inviteCreateForm) {
  el.inviteCreateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const maxUses = Number(el.inviteMaxUses?.value || 1);
    const expireDays = Number(el.inviteExpireDays?.value || 7);
    if (!Number.isFinite(maxUses) || maxUses < 1) {
      setInviteTip("可使用次数必须是大于等于 1 的数字。", true);
      return;
    }
    if (!Number.isFinite(expireDays) || expireDays < 1) {
      setInviteTip("有效天数必须是大于等于 1 的数字。", true);
      return;
    }
    setInviteTip("正在生成邀请码...");
    try {
      const res = await fetch("/api/auth/invite/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_uses: Math.round(maxUses),
          expires_in_days: Math.round(expireDays),
        }),
      });
      let payload = {};
      try {
        payload = await res.json();
      } catch (_err) {}
      if (!res.ok) {
        const text = payload?.error || "邀请码生成失败";
        setInviteTip(String(text), true);
        return;
      }
      const inviteCode = String(payload?.invite_code || "");
      const expiresAt = payload?.expires_at ? formatLocalTime(payload.expires_at) : "--";
      if (el.inviteCodeOutput) {
        el.inviteCodeOutput.textContent = [
          `邀请码：${inviteCode}`,
          `可使用次数：${payload?.max_uses ?? Math.round(maxUses)}`,
          `过期时间：${expiresAt}`,
          "",
          "使用方式：把上面的邀请码发给用户，用户访问 /register 完成邮箱验证注册。",
        ].join("\\n");
      }
      setInviteTip("邀请码已生成，请复制并发送给目标用户。");
      closeWorkspaceModalForForm("invite-create-form");
    } catch (err) {
      console.error(err);
      setInviteTip("网络异常，邀请码生成失败。", true);
    }
  });
}

if (el.userCreateForm) {
  el.userCreateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = String(el.userCreateUsername?.value || "").trim();
    const email = String(el.userCreateEmail?.value || "").trim();
    const newPassword = String(el.userCreatePassword?.value || "");
    const isAdmin = String(el.userCreateIsAdmin?.value || "false") === "true";
    const enabled = String(el.userCreateEnabled?.value || "true") === "true";

    if (!username) {
      setUserCreateTip("用户名不能为空。", true);
      return;
    }
    if (username.length > 64) {
      setUserCreateTip("用户名长度不能超过 64。", true);
      return;
    }
    if (!newPassword.trim()) {
      setUserCreateTip("初始密码不能为空。", true);
      return;
    }
    if (newPassword.length > 128) {
      setUserCreateTip("初始密码长度不能超过 128。", true);
      return;
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setUserCreateTip("邮箱格式不正确。", true);
      return;
    }

    try {
      await fetchJson("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          new_password: newPassword,
          is_admin: isAdmin,
          enabled,
        }),
      });
      if (el.userCreateUsername) el.userCreateUsername.value = "";
      if (el.userCreateEmail) el.userCreateEmail.value = "";
      if (el.userCreatePassword) el.userCreatePassword.value = "";
      if (el.userCreateIsAdmin) el.userCreateIsAdmin.value = "false";
      if (el.userCreateEnabled) el.userCreateEnabled.value = "true";
      setUserCreateTip(`用户 ${username} 已创建。`);
      closeWorkspaceModalForForm("user-create-form");
      setUserManageTip(`用户 ${username} 已创建。`);
      await (GM.refreshUsers || (async ()=>{}))();
    } catch (err) {
      console.error(err);
      setUserCreateTip("新增用户失败，请检查用户名/邮箱是否重复。", true);
    }
  });
}

if (el.userList) {
  el.userList.addEventListener("click", async (e) => {
    const element = e.target instanceof Element ? e.target : null;
    const target = element ? element.closest("button[data-action]") : null;
    if (!target) return;
    const userId = Number(target.dataset.id);
    if (!Number.isFinite(userId)) return;
    const action = String(target.dataset.action || "");
    const user = (state.users || []).find((item) => Number(item.id) === userId);
    if (!user) return;

    if (action === "toggle-user") {
      if (!state.currentIsAdmin) {
        setUserManageTip("当前账号无权限。", true);
        return;
      }
      const nextEnabled = !Boolean(user.enabled);
      try {
        await fetchJson(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: nextEnabled }),
        });
        setUserManageTip(`用户 ${user.username} 已${nextEnabled ? "启用" : "停用"}。`);
        await (GM.refreshUsers || (async ()=>{}))();
      } catch (err) {
        console.error(err);
        const detail = err instanceof Error ? err.message.split(": ").slice(1).join(": ").trim() : "";
        setUserManageTip(detail || "更新用户状态失败。", true);
      }
      return;
    }

    if (action === "toggle-admin") {
      if (!state.currentIsAdmin) {
        setUserManageTip("当前账号无权限。", true);
        return;
      }
      const nextIsAdmin = !Boolean(user.is_admin);
      const result = await openActionModal({
        title: nextIsAdmin ? "授予管理员权限" : "取消管理员权限",
        text: nextIsAdmin
          ? `确认将 ${user.username} 设为管理员吗？`
          : `确认取消 ${user.username} 的管理员权限吗？`,
        confirmText: nextIsAdmin ? "确认授予" : "确认取消",
        danger: !nextIsAdmin,
      });
      if (!result.confirmed) return;
      try {
        await fetchJson(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_admin: nextIsAdmin }),
        });
        setUserManageTip(`用户 ${user.username} 已${nextIsAdmin ? "设为管理员" : "取消管理员权限"}。`);
        await (GM.refreshUsers || (async ()=>{}))();
      } catch (err) {
        console.error(err);
        const detail = err instanceof Error ? err.message.split(": ").slice(1).join(": ").trim() : "";
        setUserManageTip(detail || "更新管理员权限失败。", true);
      }
      return;
    }

    if (action === "reset-user-pass") {
      if (!state.currentIsAdmin) {
        setUserManageTip("当前账号无权限。", true);
        return;
      }
      const result = await openActionModal({
        title: "重置用户密码",
        text: `请输入 ${user.username} 的新密码（最长128位）。`,
        confirmText: "重置密码",
        input: {
          enabled: true,
          type: "password",
          maxLength: 128,
          label: "新密码",
          placeholder: "请输入新密码",
          validate: (value) => {
            const next = String(value || "");
            if (!next.trim()) return "新密码不能为空。";
            if (next.length > 128) return "新密码长度不能超过128。";
            return "";
          },
        },
      });
      if (!result.confirmed) return;
      const newPassword = String(result.value || "");
      try {
        await fetchJson(`/api/admin/users/${userId}/reset_password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_password: newPassword }),
        });
        setUserManageTip(`用户 ${user.username} 密码已重置。`);
      } catch (err) {
        console.error(err);
        setUserManageTip("重置密码失败。", true);
      }
      return;
    }

    if (action === "delete-user") {
      if (!state.currentIsAdmin) {
        setUserManageTip("当前账号无权限。", true);
        return;
      }
      const result = await openActionModal({
        title: "删除用户",
        text: `确认删除用户 ${user.username} 吗？删除后不可恢复。`,
        confirmText: "确认删除",
        danger: true,
      });
      if (!result.confirmed) return;
      try {
        await fetchJson(`/api/admin/users/${userId}`, {
          method: "DELETE",
        });
        setUserManageTip(`用户 ${user.username} 已删除。`);
        await (GM.refreshUsers || (async ()=>{}))();
      } catch (err) {
        console.error(err);
        setUserManageTip("删除用户失败。", true);
      }
    }
  });
}

if (el.changePasswordForm) {
  el.changePasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPassword = String(el.currentPassword?.value || "");
    const newPassword = String(el.newPassword?.value || "");
    const confirmNewPassword = String(el.confirmNewPassword?.value || "");
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setChangePasswordTip("请填写完整的密码信息。", true);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePasswordTip("两次输入的新密码不一致。", true);
      return;
    }
    if (newPassword.length > 128) {
      setChangePasswordTip("新密码长度不能超过 128。", true);
      return;
    }
    setChangePasswordTip("正在修改密码...");
    try {
      await fetchJson("/api/auth/change_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (el.currentPassword) el.currentPassword.value = "";
      if (el.newPassword) el.newPassword.value = "";
      if (el.confirmNewPassword) el.confirmNewPassword.value = "";
      setChangePasswordTip("密码已修改成功。");
      closeWorkspaceModalForForm("change-password-form");
    } catch (err) {
      console.error(err);
      setChangePasswordTip("修改密码失败，请检查当前密码。", true);
    }
  });
}

if (el.refreshLoginAudit) {
  el.refreshLoginAudit.addEventListener("click", async () => {
    await (GM.refreshLoginAudit || (async ()=>{}))();
  });
}

if (el.refreshUserList) {
  el.refreshUserList.addEventListener("click", async () => {
    await (GM.refreshUsers || (async ()=>{}))();
  });
}

for (const button of el.workspaceLinks || []) {
  button.addEventListener("click", (e) => {
    const workspace = String(button.dataset.workspaceLink || "").trim().toLowerCase();
    if (button.tagName === "A" && button.href) {
      return;
    }
    e.preventDefault();
    setActiveWorkspace(workspace, { autoSelect: true, writeHash: true });
  });
}

for (const button of el.deployViewLinks || []) {
  button.addEventListener("click", () => {
    const next = String(button.dataset.deployViewLink || "").trim();
    setDeployView(next || "settings");
  });
}

if (el.insightPolicyForm) {
  el.insightPolicyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const whitelist = String(el.insightWhitelist.value || "")
      .split(/\n|,/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (whitelist.length === 0) {
      setInsightTip("白名单域名不能为空。", true);
      return;
    }

    const minAuthoritative = Number(el.insightMinAuthoritative.value || 5);
    const triggerProfile = String(el.insightTriggerProfile?.value || "balanced").toLowerCase();
    const baseUpPct = Number(el.insightUpPct?.value || 2);
    const baseDownPct = Number(el.insightDownPct?.value || 2);
    const fastWindowMinutes = Number(el.insightFastWindowMinutes?.value || 30);
    const fastThresholdPct = Number(el.insightFastThresholdPct?.value || 0.6);
    const shortWindowMinutes = Number(el.insightShortWindowMinutes?.value || 120);
    const shortThresholdPct = Number(el.insightShortThresholdPct?.value || 1.0);
    const periodicSummarySec = Number(el.insightPeriodicSummarySec?.value || 7200);
    const cooldownFastSec = Number(el.insightCooldownFastSec?.value || 1800);
    const cooldownShortSec = Number(el.insightCooldownShortSec?.value || 3600);
    const cooldownPeriodicSec = Number(el.insightCooldownPeriodicSec?.value || 7200);
    const windowMinutes = Number(el.insightWindowMinutes?.value || 1440);
    const cooldownSec = Number(el.insightCooldownSec?.value || 3600);
    if (!Number.isFinite(minAuthoritative) || minAuthoritative < 1) {
      setInsightTip("最小权威新闻条数必须是大于等于1的数字。", true);
      return;
    }
    if (!["balanced", "conservative", "sensitive"].includes(triggerProfile)) {
      setInsightTip("触发档位必须是 balanced/conservative/sensitive。", true);
      return;
    }
    if (!Number.isFinite(baseUpPct) || baseUpPct < 0.1) {
      setInsightTip("基础上涨阈值必须大于等于0.1%。", true);
      return;
    }
    if (!Number.isFinite(baseDownPct) || baseDownPct < 0.1) {
      setInsightTip("基础下跌阈值必须大于等于0.1%。", true);
      return;
    }
    if (!Number.isFinite(windowMinutes) || windowMinutes < 5) {
      setInsightTip("窗口分钟数必须是大于等于5的数字。", true);
      return;
    }
    if (!Number.isFinite(cooldownSec) || cooldownSec < 60) {
      setInsightTip("冷却秒数必须是大于等于60的数字。", true);
      return;
    }
    if (!Number.isFinite(fastWindowMinutes) || fastWindowMinutes < 5) {
      setInsightTip("急速窗口必须大于等于5分钟。", true);
      return;
    }
    if (!Number.isFinite(shortWindowMinutes) || shortWindowMinutes < 5) {
      setInsightTip("短时窗口必须大于等于5分钟。", true);
      return;
    }
    if (!Number.isFinite(fastThresholdPct) || fastThresholdPct < 0.1) {
      setInsightTip("急速阈值必须大于等于0.1%。", true);
      return;
    }
    if (!Number.isFinite(shortThresholdPct) || shortThresholdPct < 0.1) {
      setInsightTip("短时阈值必须大于等于0.1%。", true);
      return;
    }
    if (!Number.isFinite(periodicSummarySec) || periodicSummarySec < 300) {
      setInsightTip("周期触发秒数必须大于等于300。", true);
      return;
    }
    if (!Number.isFinite(cooldownFastSec) || cooldownFastSec < 30) {
      setInsightTip("急速冷却必须大于等于30秒。", true);
      return;
    }
    if (!Number.isFinite(cooldownShortSec) || cooldownShortSec < 30) {
      setInsightTip("短时冷却必须大于等于30秒。", true);
      return;
    }
    if (!Number.isFinite(cooldownPeriodicSec) || cooldownPeriodicSec < 30) {
      setInsightTip("周期冷却必须大于等于30秒。", true);
      return;
    }

    const symbols = String(el.insightSymbols.value || "")
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    if (symbols.length === 0) {
      setInsightTip("监控标的不能为空。", true);
      return;
    }

    const strategyKeys = selectedInsightStrategies();
    if (strategyKeys.length === 0) {
      setInsightTip("请至少勾选一个策略模板。", true);
      return;
    }
    const customStrategyLines = String(el.insightCustomStrategies?.value || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (customStrategyLines.length > 20) {
      setInsightTip("自定义策略最多 20 条。", true);
      return;
    }
    if (customStrategyLines.some((item) => item.length > 240)) {
      setInsightTip("每条自定义策略最多 240 个字符。", true);
      return;
    }

    const body = {
      insight_enabled: el.insightEnabled.value === "true",
      source_policy_mode: el.insightPolicyMode.value,
      source_whitelist_domains: whitelist,
      min_authoritative_articles: Math.round(minAuthoritative),
      strategy_keys: strategyKeys,
      custom_strategy_lines: customStrategyLines,
      insight_symbols: symbols,
      trigger_profile: triggerProfile,
      up_pct: Number(baseUpPct),
      down_pct: Number(baseDownPct),
      fast_move_window_minutes: Math.round(fastWindowMinutes),
      fast_move_threshold_pct: Number(fastThresholdPct),
      short_move_window_minutes: Math.round(shortWindowMinutes),
      short_move_threshold_pct: Number(shortThresholdPct),
      periodic_summary_sec: Math.round(periodicSummarySec),
      cooldown_fast_sec: Math.round(cooldownFastSec),
      cooldown_short_sec: Math.round(cooldownShortSec),
      cooldown_periodic_sec: Math.round(cooldownPeriodicSec),
      window_minutes: Math.round(windowMinutes),
      cooldown_sec: Math.round(cooldownSec),
      rss_enabled: el.insightRssEnabled.value === "true",
      insight_notify_enabled: el.insightNotifyEnabled.value === "true",
    };

    try {
      const payload = await fetchJson("/api/insight/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      renderInsightSettings(payload);
      setInsightTip("AI策略配置已保存。");
      closeWorkspaceModalForForm("insight-policy-form");
    } catch (err) {
      console.error(err);
      setInsightTip("AI策略配置保存失败，请稍后重试。", true);
    }
  });
}

if (el.insightProviderForm) {
  el.insightProviderForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      news_api_enabled: el.insightNewsApiEnabled.value === "true",
      news_api_base_url: (el.insightNewsApiBaseUrl.value || "").trim(),
      news_api_query_param: (el.insightNewsApiQueryParam.value || "").trim() || "q",
      ai_enabled: el.insightAiEnabled.value === "true",
      ai_base_url: (el.insightAiBaseUrl.value || "").trim(),
      ai_model: (el.insightAiModel.value || "").trim() || "gpt-4o-mini",
    };

    const newsApiKey = (el.insightNewsApiKey.value || "").trim();
    if (newsApiKey) {
      body.news_api_key = newsApiKey;
    }
    const aiKey = (el.insightAiApiKey.value || "").trim();
    if (aiKey) {
      body.ai_api_key = aiKey;
    }

    try {
      const payload = await fetchJson("/api/insight/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      renderInsightSettings(payload);
      const savedModel = String(payload?.ai_model || body.ai_model || "").trim();
      setInsightProviderTip(savedModel ? `AI调用配置已保存（模型：${savedModel}）。` : "AI调用配置已保存。");
      closeWorkspaceModalForForm("insight-provider-form");
    } catch (err) {
      console.error(err);
      setInsightProviderTip("AI调用配置保存失败，请稍后重试。", true);
    }
  });
}

if (el.insightAiModelSelect) {
  el.insightAiModelSelect.addEventListener("change", (e) => {
    const next = String(e.target?.value || "").trim();
    if (next) {
      el.insightAiModel.value = next;
    }
  });
}

if (el.insightDetectModelsBtn) {
  el.insightDetectModelsBtn.addEventListener("click", async () => {
    try {
      el.insightDetectModelsBtn.disabled = true;
      setInsightProviderTip("正在检测可用模型...");
      const runtime = buildInsightAiRuntimeBody();
      setInsightAiActionStatus("loading", "正在检测模型列表，请稍候…", runtime.aiBaseUrl ? [{ label: "Base URL", value: runtime.aiBaseUrl }] : []);

      const payload = await fetchJson("/api/insight/models/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runtime.body),
      });
      const models = Array.isArray(payload?.models) ? payload.models : [];
      const currentModel = String(el.insightAiModel.value || payload?.current_model || "").trim();
      renderDetectedModels(models, currentModel);
      if (!el.insightAiModel.value && models.length > 0) {
        el.insightAiModel.value = String(models[0]);
      }
      const endpoint = String(payload?.endpoint || "").trim();
      const attempted = Array.isArray(payload?.attempted_endpoints) ? payload.attempted_endpoints.map((item) => String(item || "").trim()).filter(Boolean) : [];
      const endpointText = endpoint ? `；已使用接口：${endpoint}` : "";
      const attemptedText = attempted.length > 1 ? `；尝试顺序：${attempted.join(" -> ")}` : "";
      setInsightProviderTip(`模型检测完成：共 ${models.length} 个可选模型${endpointText}${attemptedText}`);
      const detailRows = [
        { label: "可用模型数", value: String(models.length) },
      ];
      if (endpoint) {
        detailRows.push({ label: "生效接口", value: endpoint });
      }
      if (attempted.length > 0) {
        detailRows.push({ label: "尝试顺序", value: attempted.join(" -> ") });
      }
      setInsightAiActionStatus("success", `模型检测完成，发现 ${models.length} 个可选模型。`, detailRows);
    } catch (err) {
      console.error(err);
      const raw = err instanceof Error ? err.message : "模型检测失败，请检查 Base URL 和 API Key。";
      const parsed = normalizeInsightAiError(raw);
      let message = `模型检测失败：${parsed.summary}`;
      if (parsed.hints.length > 0) {
        message += ` 建议：${parsed.hints[0]}`;
      }
      setInsightProviderTip(message, true);
      const details = [];
      if (parsed.hints.length > 0) {
        details.push({ label: "建议", value: parsed.hints.join("；") });
      }
      if (parsed.raw) {
        details.push({ label: "原始报错", value: parsed.raw });
      }
      setInsightAiActionStatus("error", `模型检测失败：${parsed.summary}`, details);
    } finally {
      el.insightDetectModelsBtn.disabled = false;
    }
  });
}

if (el.insightTestAiBtn) {
  el.insightTestAiBtn.addEventListener("click", async () => {
    try {
      el.insightTestAiBtn.disabled = true;
      setInsightProviderTip("正在测试 AI Key 可用性...");
      const runtime = buildInsightAiRuntimeBody({ includeModel: true });
      const loadingRows = [];
      if (runtime.aiModel) {
        loadingRows.push({ label: "测试模型", value: runtime.aiModel });
      }
      if (runtime.aiBaseUrl) {
        loadingRows.push({ label: "Base URL", value: runtime.aiBaseUrl });
      }
      setInsightAiActionStatus("loading", "正在测试 AI Key，可在本窗口直接查看结果。", loadingRows);
      const payload = await fetchJson("/api/insight/test_ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runtime.body),
      });
      const model = String(payload?.model || runtime.aiModel || "--");
      const latency = Number(payload?.latency_ms);
      const latencyText = Number.isFinite(latency) ? `${Math.round(latency)}ms` : "--";
      const summary = String(payload?.summary_preview || "").trim();
      const summaryText = summary ? `；返回摘要：${summary}` : "";
      setInsightProviderTip(`AI测试成功：模型 ${model}，延迟 ${latencyText}${summaryText}`);
      const endpoint = String(payload?.endpoint || "").trim();
      const confidence = Number(payload?.confidence);
      const detailRows = [
        { label: "模型", value: model },
        { label: "延迟", value: latencyText },
      ];
      if (endpoint) {
        detailRows.push({ label: "接口", value: endpoint });
      }
      if (Number.isFinite(confidence)) {
        detailRows.push({ label: "置信度", value: `${Math.round(confidence * 100)}%` });
      }
      setInsightAiActionStatus("success", summary ? `测试通过：${summary}` : "测试通过：模型已返回有效响应。", detailRows);
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : "AI测试失败，请检查 Base URL / API Key / 模型名。";
      const parsed = normalizeInsightAiError(detail);
      let tipText = `AI测试失败：${parsed.summary}`;
      if (parsed.hints.length > 0) {
        tipText += ` 建议：${parsed.hints[0]}`;
      }
      setInsightProviderTip(tipText, true);
      const detailRows = [];
      if (parsed.hints.length > 0) {
        detailRows.push({ label: "建议", value: parsed.hints.join("；") });
      }
      if (parsed.raw) {
        detailRows.push({ label: "原始报错", value: parsed.raw });
      }
      setInsightAiActionStatus("error", `AI测试失败：${parsed.summary}`, detailRows);
    } finally {
      el.insightTestAiBtn.disabled = false;
    }
  });
}


if (el.insightAssistantForm) {
  el.insightAssistantForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await (GM.submitInsightAssistantComposer || (async ()=>{}))();
  });
}

if (el.insightAssistantInput) {
  el.insightAssistantInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    if (event.isComposing) return;
    if (!(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    await (GM.submitInsightAssistantComposer || (async ()=>{}))();
  });
}

if (el.insightAssistantClear) {
  el.insightAssistantClear.addEventListener("click", async () => {
    await clearInsightAssistantConversation();
  });
}

if (el.insightAssistantUseEvent) {
  el.insightAssistantUseEvent.addEventListener("click", async () => {
    const candidate = pickInsightAssistantContextEvent();
    const eventId = Number(candidate?.id);
    if (!Number.isFinite(eventId)) {
      setInsightAssistantTip("当前没有可引用的 AI 事件，请先在事件列表选择一条。", true);
      return;
    }
    await pinInsightAssistantContextByEventId(eventId, { switchTab: false, prefill: true });
  });
}

if (el.insightAssistantClearContext) {
  el.insightAssistantClearContext.addEventListener("click", () => {
    resetInsightAssistantContext({ announce: true });
  });
}

if (el.insightRefreshBtn) {
  el.insightRefreshBtn.addEventListener("click", async () => {
    try {
      await (GM.refreshInsightEvents || (async ()=>{}))();
      setInsightTip("AI归因事件已刷新。");
    } catch (err) {
      console.error(err);
      setInsightTip("刷新AI归因事件失败。", true);
    }
  });
}

if (el.insightSimulateBtn) {
  el.insightSimulateBtn.addEventListener("click", async () => {
    try {
      el.insightSimulateBtn.disabled = true;
      setInsightTip("正在创建模拟事件并触发AI归因…");
      const payload = await fetchJson("/api/insight/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await (GM.refreshInsightEvents || (async ()=>{}))();
      const eventId = Number(payload?.event_id);
      if (Number.isFinite(eventId)) {
        await loadInsightEventDetail(eventId, { silent: true });
        setInsightTip(`模拟事件已创建（#${eventId}），请等待分析完成后刷新查看结果。`);
      } else {
        setInsightTip("模拟事件已触发。");
      }
    } catch (err) {
      console.error(err);
      setInsightTip("模拟触发失败，请稍后重试。", true);
    } finally {
      el.insightSimulateBtn.disabled = false;
    }
  });
}

if (el.insightEventList) {
  el.insightEventList.addEventListener("click", async (e) => {
    const element = e.target instanceof Element ? e.target : null;
    if (!element) return;
    const actionBtn = element.closest("button[data-action]");
    if (actionBtn instanceof HTMLElement) {
      const eventId = Number(actionBtn.dataset.id);
      if (!Number.isFinite(eventId)) return;
      const action = String(actionBtn.dataset.action || "").trim();
      if (action === "chat") {
        setInsightTip(`正在打开事件 #${eventId} 对话窗口...`);
        await openInsightChatByEventId(eventId, { triggerNode: actionBtn });
        return;
      }
      await openInsightEventDetailFromList(eventId, { openChat: false, triggerNode: actionBtn });
      return;
    }
    const row = element.closest(".insight-event-item");
    if (!(row instanceof HTMLElement)) return;
    if (element.closest("button, a, input, select, textarea")) return;
    const eventId = Number(row.dataset.eventId || row.getAttribute("data-event-id") || "");
    if (!Number.isFinite(eventId)) return;
    await openInsightEventDetailFromList(eventId, { openChat: false, triggerNode: row });
  });
  if (el.insightEventList) {
  el.insightEventList.addEventListener("keydown", async (e) => {
    const target = e.target instanceof HTMLElement ? e.target.closest(".insight-event-item") : null;
    if (!(target instanceof HTMLElement)) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    const eventId = Number(target.dataset.eventId || target.getAttribute("data-event-id") || "");
    if (!Number.isFinite(eventId)) return;
    await openInsightEventDetailFromList(eventId, { openChat: false, triggerNode: target });
  });
  }
}


bindInsightChatOpen(el.insightEventDetail, () => state.currentInsightDetail);
bindInsightChatOpen(el.dashboardInsightDetail, () => state.currentDashboardInsightDetail);

if (el.insightChatModalClose) {
  el.insightChatModalClose.addEventListener("click", () => closeInsightChatModal());
}

if (el.insightChatModalRoot) {
  el.insightChatModalRoot.addEventListener("click", (event) => {
    const element = event.target instanceof Element ? event.target : null;
    if (!element) return;
    if (element.closest("[data-insight-chat-close]")) {
      closeInsightChatModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (el.insightChatModalRoot && !el.insightChatModalRoot.classList.contains("hidden")) {
    closeInsightChatModal();
  }
});


if (el.btnTestNotify) {
el.btnTestNotify.addEventListener("click", async () => {
  try {
    const payload = await fetchJson("/api/settings/test_notify", {
      method: "POST",
    });
    const provider = payload?.provider_response && typeof payload.provider_response === "object" ? payload.provider_response : null;
    const errcode = provider && Number.isFinite(Number(provider.errcode)) ? Number(provider.errcode) : null;
    const errmsg = provider ? String(provider.errmsg || "").trim() : "";
    if (errcode === 0) {
      const hint = resolveWecomTestHint(0, errmsg);
      const message = `测试推送已被企业微信受理（errcode=0${errmsg ? `, errmsg=${errmsg}` : ""}）。${hint}`;
      setWecomTip(message);
      state.wecomLastTest = { ok: true, message };
      renderWecomGuide();
      return;
    }
    if (Number.isFinite(errcode)) {
      const hint = resolveWecomTestHint(errcode, errmsg);
      const message = `企业微信返回异常（errcode=${errcode}${errmsg ? `, errmsg=${errmsg}` : ""}）。${hint}`;
      setWecomTip(message, true);
      state.wecomLastTest = { ok: false, message };
      renderWecomGuide();
      return;
    }
    if (payload?.provider_response_text) {
      const hint = resolveWecomTestHint(-1, String(payload.provider_response_text || ""));
      const message = `测试推送返回非标准响应：${payload.provider_response_text}。${hint}`;
      setWecomTip(message, true);
      state.wecomLastTest = { ok: false, message };
      renderWecomGuide();
      return;
    }
    const message = "已发送测试通知，请检查企业微信机器人。";
    setWecomTip(message);
    state.wecomLastTest = { ok: true, message };
    renderWecomGuide();
  } catch (err) {
    console.error(err);
    const detail = err instanceof Error ? err.message : "请检查 Webhook 配置。";
    const hint = resolveWecomTestHint(-1, detail);
    const message = `测试推送失败：${detail}。${hint}`;
    setWecomTip(message, true);
    state.wecomLastTest = { ok: false, message };
    renderWecomGuide();
  }
});
}

if (el.wecomSettingsForm) {
el.wecomSettingsForm.addEventListener("input", () => {
  renderNotifyPreview();
  renderWecomGuide();
});
}
if (el.wecomSettingsForm) {
el.wecomSettingsForm.addEventListener("change", () => {
  renderNotifyPreview();
  renderWecomGuide();
});
}

if (el.btnRefreshNow) {
el.btnRefreshNow.addEventListener("click", async () => {
  try {
    el.btnRefreshNow.disabled = true;
    setRefreshStatus("正在刷新行情…");
    await fetchJson("/api/collect/once", { method: "POST" });
    await refreshAll({ includeSettings: false });
    setRefreshStatus(`手动刷新完成 ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error(err);
    setRefreshStatus("手动刷新失败。", true);
  } finally {
    el.btnRefreshNow.disabled = false;
  }
});
}





if (el.btnInsightTrigger) {
  el.btnInsightTrigger.addEventListener("click", triggerInsightSummaryNow);
}

if (el.insightManualTriggerBtn) {
  el.insightManualTriggerBtn.addEventListener("click", triggerInsightSummaryNow);
}

if (el.insightRunnerDismiss) {
  el.insightRunnerDismiss.addEventListener("click", () => {
    hideInsightRunnerPanel();
  });
}

if (el.insightRunnerOpenDashboard) {
  el.insightRunnerOpenDashboard.addEventListener("click", async () => {
    setActiveTab("dashboard");
    const eventId = Number(state.latestTriggeredInsightEventId);
    if (Number.isFinite(eventId)) {
      await loadDashboardEventDetail(eventId, { silent: true });
    }
  });
}

if (el.insightRunnerOpenEvents) {
  el.insightRunnerOpenEvents.addEventListener("click", async () => {
    setActiveTab("insight-policy");
    const eventId = Number(state.latestTriggeredInsightEventId);
    if (Number.isFinite(eventId)) {
      await loadInsightEventDetail(eventId, { silent: true });
    }
  });
}

if (el.ruleFillAbove) {
el.ruleFillAbove.addEventListener("click", () => fillRuleByCurrentPrice(1.01));
}
if (el.ruleFillBelow) {
el.ruleFillBelow.addEventListener("click", () => fillRuleByCurrentPrice(0.99));
}

if (el.ruleList) {
el.ruleList.addEventListener("click", async (e) => {
  const element = e.target instanceof Element ? e.target : null;
  const target = element ? element.closest("button[data-action]") : null;
  if (!target) return;
  const ruleId = Number(target.dataset.id);
  if (!Number.isFinite(ruleId)) return;
  const action = target.dataset.action;
  if (action === "toggle") {
    const current = state.rules.find((rule) => Number(rule.id) === ruleId);
    if (!current) return;
    await fetchJson(`/api/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !current.enabled }),
    });
    setRuleTip(`规则 #${ruleId} 已${current.enabled ? "停用" : "启用"}。`);
    await (GM.refreshRulesAndAlerts || (async ()=>{}))();
    return;
  }
  if (action === "delete") {
    const result = await openActionModal({
      title: "删除规则",
      text: `确认删除规则 #${ruleId} 吗？删除后不可恢复。`,
      confirmText: "确认删除",
      danger: true,
    });
    if (!result.confirmed) return;
    await fetchJson(`/api/rules/${ruleId}`, {
      method: "DELETE",
    });
    setRuleTip(`规则 #${ruleId} 已删除。`);
    await (GM.refreshRulesAndAlerts || (async ()=>{}))();
  }
});
}

if (el.btnZoomIn) {
el.btnZoomIn.addEventListener("click", () => zoomBy(0.8));
}
if (el.btnZoomOut) {
el.btnZoomOut.addEventListener("click", () => zoomBy(1.25));
}
if (el.btnZoomReset) {
el.btnZoomReset.addEventListener("click", () => setZoomRange(72, 100));
}

// Logout handler is in sidebar.js (initSidebarToggle). Removed duplicate here.

bindChartEventClicks();
initWorkspaceFormModals();
bindDashboardJumpNav();
setDeployView("settings");
{ const _ws = window.__PAGE === "ai" ? "ai" : window.__PAGE === "system" ? "system" : "market"; setActiveWorkspace(_ws, { autoSelect: false, writeHash: false }); }

window.addEventListener("resize", () => {
  if (GM.chartIntl) GM.chartIntl.resize();
  if (GM.chartDomestic) GM.chartDomestic.resize();
  if (GM.chartDual) GM.chartDual.resize();
  if (GM.chartYFinance) GM.chartYFinance.resize();
  if (GM.chartBacktestEquity) GM.chartBacktestEquity.resize();
  if (typeof GM.repaintAuxCharts === "function") {
    GM.repaintAuxCharts();
  }
});

window.addEventListener("gm:sidebar-state", () => {
  if (GM.chartIntl) GM.chartIntl.resize();
  if (GM.chartDomestic) GM.chartDomestic.resize();
  if (GM.chartDual) GM.chartDual.resize();
  if (GM.chartYFinance) GM.chartYFinance.resize();
  if (GM.chartBacktestEquity) GM.chartBacktestEquity.resize();
  if (typeof GM.repaintDashboardCharts === "function") {
    GM.repaintDashboardCharts();
  }
  if (typeof GM.repaintAuxCharts === "function") {
    GM.repaintAuxCharts();
  }
});

initTabRouting();
if (el.timeframe) {
  state.timeframe = String(el.timeframe.value || "1d").toLowerCase() === "1h" ? "1h" : "1d";
}
(GM.setLayout || function(){})("split");
(GM.setKlineTableView || function(){})("all");
if (el.yfinanceTicker) {
  state.yfinance.ticker = String(el.yfinanceTicker.value || state.yfinance.ticker).trim().toUpperCase() || "AAPL";
}
if (el.yfinancePeriod) {
  state.yfinance.period = String(el.yfinancePeriod.value || state.yfinance.period).trim().toLowerCase() || "6mo";
}
if (el.yfinanceInterval) {
  state.yfinance.interval = String(el.yfinanceInterval.value || state.yfinance.interval).trim().toLowerCase() || "1d";
}
if (el.yfinancePrepost) {
  state.yfinance.prepost = String(el.yfinancePrepost.value || "false").trim().toLowerCase() === "true";
}
setRuleTip("可用现价 ±1% 快速填值。");
renderInsightDetailEmpty("选择图表事件后查看详情。", el.dashboardInsightDetail);
syncInsightTriggerButtons();
setInsightAssistantBusy(false);
resetInsightAssistantContext({ announce: false });
renderInsightAssistantLog();
setInsightAssistantTip("正在加载历史对话...");
void loadInsightAssistantHistory({ silent: false, force: true });
updateBacktestCompareSortUi();
refreshAll({ includeSettings: true }).then(() => {
}).catch(err => void 0);

})();
