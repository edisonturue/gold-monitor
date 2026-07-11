(function() {
// Golden Monitor - System Module
var GM = window.GM, state = GM.state, el = GM.el;
var escapeHtml = GM.escapeHtml, fmtNumber = GM.fmtNumber, toNumberLoose = GM.toNumberLoose;
var roundTo = GM.roundTo, clamp = GM.clamp, labelSymbol = GM.labelSymbol;
var labelSource = GM.labelSource, formatLocalTime = GM.formatLocalTime, formatAge = GM.formatAge;
var freshnessText = GM.freshnessText, freshnessClass = GM.freshnessClass, priceMap = GM.priceMap;
var asBiasClass = GM.asBiasClass, lineColor = GM.lineColor, safeHref = GM.safeHref;
var fetchJson = GM.fetchJson, setRefreshStatus = GM.setRefreshStatus, setRuleTip = GM.setRuleTip;
var setWecomTip = GM.setWecomTip;
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
var renderNotifyPreview = GM.renderNotifyPreview;
var renderInsightSettings = GM.renderInsightSettings, renderInsightStrategyList = GM.renderInsightStrategyList;
var renderDetectedModels = GM.renderDetectedModels;
var refreshInsightSettings = GM.refreshInsightSettings, refreshInsightEvents = GM.refreshInsightEvents;
var updateBacktestCompareSortUi = GM.updateBacktestCompareSortUi;
var resolveWecomTestHint = GM.resolveWecomTestHint;
var axisTimeKey = GM.axisTimeKey, alignEventTimeKey = GM.alignEventTimeKey;
var closeByTimeKeyMap = GM.closeByTimeKeyMap, eventsForSymbol = GM.eventsForSymbol;
var eventScatterSeries = GM.eventScatterSeries, axisIntervalBySize = GM.axisIntervalBySize;
var roundedSeries = GM.roundedSeries, buildCandlesPayload = GM.buildCandlesPayload;
var sanitizeBars = GM.sanitizeBars, ensureBarsFromLatest = GM.ensureBarsFromLatest;

function normalizeWecomWebhookHint(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return { ok: false, summary: "未填写 Webhook", detail: "请先在企业微信群机器人里复制 Webhook 地址。" };
  }
  if (!/^https?:\/\//i.test(text)) {
    return { ok: false, summary: "Webhook 格式错误", detail: "Webhook 必须以 http:// 或 https:// 开头。" };
  }
  if (text.includes("qyapi.weixin.qq.com") && !/\/cgi-bin\/webhook\/send/i.test(text)) {
    return { ok: false, summary: "Webhook 路径异常", detail: "企业微信机器人地址应包含 /cgi-bin/webhook/send?key=..." };
  }
  if (text.includes("qyapi.weixin.qq.com") && !/[?&]key=/i.test(text)) {
    return { ok: false, summary: "Webhook 缺少 key", detail: "请确认链接中带有 ?key=xxxx 参数。" };
  }
  return { ok: true, summary: "Webhook 格式通过", detail: "可点击“测试微信推送”验证是否真正能到群里。" };
}
function renderWecomGuide(settings = null) {
  if (!el.wecomGuideSteps || !el.wecomGuideStatus) return;
  const cfg = settings && typeof settings === "object" ? settings : {};
  const configured = Boolean(cfg.wecom_webhook_configured);
  const masked = String(cfg.wecom_webhook_masked || "").trim();
  const triggerEnabled = Boolean(cfg.notify_on_trigger);
  const hint = normalizeWecomWebhookHint(String(el.cfgWebhook?.value || ""));
  const pendingWebhookInput = String(el.cfgWebhook?.value || "").trim();
  const effectiveConfigured = configured || Boolean(pendingWebhookInput);
  const webhookDisplay = configured ? (masked || "已配置") : "未配置";
  const lastTest = state.wecomLastTest && typeof state.wecomLastTest === "object" ? state.wecomLastTest : null;
  const lastTestText = lastTest
    ? `最近测试：${lastTest.ok ? "成功" : "失败"} · ${lastTest.message || "--"}`
    : "最近测试：未执行";

  const steps = [
    {
      done: effectiveConfigured,
      title: "1. 配置机器人 Webhook",
      detail: configured ? `当前后端已配置：${webhookDisplay}` : hint.detail,
    },
    {
      done: triggerEnabled,
      title: "2. 选择要推送的事件",
      detail: `阈值触发通知当前为：${triggerEnabled ? "开启" : "关闭"}`,
    },
    {
      done: Boolean(lastTest?.ok),
      title: "3. 发送测试消息验证",
      detail: lastTestText,
    },
  ];

  el.wecomGuideSteps.innerHTML = steps
    .map((item) => {
      const status = item.done ? "已完成" : "待完成";
      return `
        <li class="wecom-guide-item">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p class="meta">${escapeHtml(item.detail)}</p>
          </div>
          <span class="tag ${item.done ? "ok" : ""}">${escapeHtml(status)}</span>
        </li>
      `;
    })
    .join("");

  const statusLines = [];
  statusLines.push("通道类型：仅支持企业微信群机器人（不支持个人微信）");
  statusLines.push(`通道状态：${configured ? "已配置" : "未配置"}`);
  statusLines.push(`输入校验：${hint.summary}`);
  if (lastTest) {
    statusLines.push(`测试结果：${lastTest.message || "--"}`);
  } else {
    statusLines.push("测试结果：尚未测试");
  }
  el.wecomGuideStatus.textContent = statusLines.join("；");
  el.wecomGuideStatus.style.color = lastTest && !lastTest.ok ? "#d12f3f" : "";
}
function setDeployTip(text, isError = false) {
  if (!el.deploySettingsTip) return;
  el.deploySettingsTip.textContent = text;
  el.deploySettingsTip.style.color = isError ? "#d12f3f" : "";
}
function setInviteTip(text, isError = false) {
  if (!el.inviteCreateTip) return;
  el.inviteCreateTip.textContent = text;
  el.inviteCreateTip.style.color = isError ? "#d12f3f" : "";
}
function setUserManageTip(text, isError = false) {
  if (!el.userManageTip) return;
  el.userManageTip.textContent = text;
  el.userManageTip.style.color = isError ? "#d12f3f" : "";
}
function setUserCreateTip(text, isError = false) {
  if (!el.userCreateTip) return;
  el.userCreateTip.textContent = text;
  el.userCreateTip.style.color = isError ? "#d12f3f" : "";
}
function setUserManageSummary(text) {
  if (!el.userManageSummary) return;
  el.userManageSummary.textContent = text;
}
function setChangePasswordTip(text, isError = false) {
  if (!el.changePasswordTip) return;
  el.changePasswordTip.textContent = text;
  el.changePasswordTip.style.color = isError ? "#d12f3f" : "";
}
function setLoginAuditTip(text, isError = false) {
  if (!el.loginAuditTip) return;
  el.loginAuditTip.textContent = text;
  el.loginAuditTip.style.color = isError ? "#d12f3f" : "";
}
function setLoginAuditSummary(text) {
  if (!el.loginAuditSummary) return;
  el.loginAuditSummary.textContent = text;
}
function renderUsers(payload) {
  if (!el.userList) return;
  const users = Array.isArray(payload?.users) ? payload.users : [];
  const operator = String(payload?.operator || state.currentUser || "");
  state.users = users;

  if (!state.currentIsAdmin) {
    el.userList.innerHTML = `<div class="rule-item"><span>仅管理员可查看用户管理</span><span class="tag">当前账号无权限</span></div>`;
    setUserManageTip("当前账号不是管理员。");
    setUserManageSummary("当前账号不是管理员，无法执行用户管理操作。");
    return;
  }

  if (users.length === 0) {
    el.userList.innerHTML = `<div class="rule-item"><span>暂无用户</span><span class="tag">可先通过邀请码注册</span></div>`;
    setUserManageTip("当前没有可管理的用户。");
    setUserManageSummary("当前可管理用户 0 个。");
    return;
  }

  el.userList.innerHTML = users
    .map((user) => {
      const isSelf = String(user.username || "") === operator;
      const safeUsername = escapeHtml(user.username || "--");
      const adminText = user.is_admin ? "管理员" : "普通用户";
      const safeEmail = user.email ? escapeHtml(user.email) : "";
      const statusBtnClass = user.enabled ? "mini-btn secondary-btn user-status-btn enabled" : "mini-btn secondary-btn user-status-btn disabled";
      const selfBadge = isSelf ? '<span class="status-badge user-self-badge">当前账号</span>' : "";
      return `
      <div class="rule-item user-item">
        <div class="user-item-main">
          <strong class="user-item-name">${safeUsername}</strong>
          <span class="user-item-email">${safeEmail || "未设置邮箱"}</span>
        </div>
        <div class="user-item-state">
          <span class="status-badge user-role-badge">${escapeHtml(adminText)}</span>
          ${selfBadge}
        </div>
        <div class="rule-item-actions user-item-actions">
          <button
            type="button"
            class="${statusBtnClass}"
            data-action="toggle-user"
            data-id="${user.id}"
            aria-label="${user.enabled ? "停用用户" : "启用用户"} ${safeUsername}"
            ${isSelf ? "disabled" : ""}
          >
            ${user.enabled ? "已启用" : "已停用"}
          </button>
          <button
            type="button"
            class="mini-btn secondary-btn"
            data-action="toggle-admin"
            data-id="${user.id}"
            aria-label="${user.is_admin ? "取消管理员权限" : "授予管理员权限"} ${safeUsername}"
            ${isSelf ? "disabled" : ""}
          >
            ${user.is_admin ? "取消管理员" : "设为管理员"}
          </button>
          <button
            type="button"
            class="mini-btn secondary-btn"
            data-action="reset-user-pass"
            data-id="${user.id}"
            aria-label="重置用户密码 ${safeUsername}"
          >
            重置密码
          </button>
          <button
            type="button"
            class="mini-btn danger-btn"
            data-action="delete-user"
            data-id="${user.id}"
            aria-label="删除用户 ${safeUsername}"
            ${isSelf ? "disabled" : ""}
          >
            删除
          </button>
        </div>
      </div>
      `;
    })
    .join("");
  setUserManageTip(`共 ${users.length} 个用户，当前登录：${operator || "--"}。`);
  const enabledCount = users.filter((item) => Boolean(item.enabled)).length;
  const adminCount = users.filter((item) => Boolean(item.is_admin)).length;
  setUserManageSummary(`总用户 ${users.length} · 启用 ${enabledCount} · 管理员 ${adminCount}。`);
}
function renderLoginAudit(payload) {
  if (!el.loginAuditList) return;
  if (!state.currentIsAdmin) {
    el.loginAuditList.innerHTML = `<div class="rule-item"><span>仅管理员可查看登录审计</span><span class="tag">当前账号无权限</span></div>`;
    setLoginAuditTip("当前账号不是管理员。");
    setLoginAuditSummary("当前账号不是管理员，无法读取登录审计。");
    return;
  }
  const events = Array.isArray(payload?.events) ? payload.events : [];
  if (events.length === 0) {
    el.loginAuditList.innerHTML = `<div class="rule-item"><span>暂无登录记录</span><span class="tag">等待用户登录行为</span></div>`;
    setLoginAuditTip("暂无登录审计记录。");
    setLoginAuditSummary("最近审计记录 0 条。");
    return;
  }
  el.loginAuditList.innerHTML = events
    .map((event) => {
      const success = Boolean(event.success);
      const statusText = success ? "成功" : "失败";
      const statusClass = success ? "up" : "down";
      const reason = escapeHtml(event.reason || "--");
      const username = escapeHtml(event.username || "未知账号");
      const ip = escapeHtml(event.ip || "--");
      const userAgent = escapeHtml(String(event.user_agent || "").slice(0, 90) || "--");
      return `
      <div class="rule-item">
        <span>${username} · ${escapeHtml(formatLocalTime(event.created_at))}</span>
        <span class="status-badge ${statusClass}">${statusText}</span>
        <span class="tag">IP: ${ip} · 原因: ${reason} · UA: ${userAgent}</span>
      </div>
      `;
    })
    .join("");
  setLoginAuditTip(`最近 ${events.length} 条登录审计记录。`);
  const successCount = events.filter((event) => Boolean(event.success)).length;
  const failedCount = events.length - successCount;
  setLoginAuditSummary(`最近 ${events.length} 条 · 成功 ${successCount} · 失败 ${failedCount}。`);
}
function renderSourceExpectedInputs(sourceExpectedMap) {
  const payload = sourceExpectedMap || {};
  Object.entries(SOURCE_UPDATE_INPUT_MAP).forEach(([sourceName, inputId]) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    const value = Number(payload[sourceName]);
    if (Number.isFinite(value) && value >= 5) {
      input.value = String(Math.round(value));
      return;
    }
    input.value = "";
  });
}
function readSourceExpectedInputs() {
  const output = {};
  for (const [sourceName, inputId] of Object.entries(SOURCE_UPDATE_INPUT_MAP)) {
    const input = document.getElementById(inputId);
    if (!input) continue;
    const raw = String(input.value || "").trim();
    if (!raw) continue;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 5) {
      throw new Error(`${labelSource(sourceName)} 更新周期必须是大于等于 5 的数字`);
    }
    output[sourceName] = Math.round(num);
  }
  return output;
}
function renderSettings(settings) {
  if (!settings) return;
  if (!el.cfgInterval) return; // Skip on non-system pages

  el.cfgInterval.value = settings.poll_interval_sec ?? 5;
  el.cfgPremium.value = settings.domestic_premium_cny_per_g ?? 0;
  el.cfgConsole.value = settings.enable_console_notifications ? "true" : "false";
  el.cfgTitlePrefix.value = settings.notify_title_prefix || "";
  el.cfgNotifyStyle.value = settings.notify_style || "detailed";
  el.cfgNotifyTrigger.value = settings.notify_on_trigger ? "true" : "false";
  el.cfgNotifyRecover.value = settings.notify_on_recover ? "true" : "false";
  el.cfgNotifySource.value = settings.notify_on_source ? "true" : "false";
  el.cfgNotifyHeartbeat.value = settings.notify_on_heartbeat ? "true" : "false";
  el.cfgDeployHost.value = settings.deploy_host || "";
  el.cfgDeployPort.value = settings.deploy_port ?? 8080;
  el.cfgDeployTimezone.value = settings.deploy_timezone || "Asia/Shanghai";
  el.cfgAuthUser.value = settings.basic_auth_user || "";
  el.cfgSessionTtl.value = settings.session_ttl_sec ?? 43200;
  el.cfgAuthMaxFailures.value = settings.auth_max_failures ?? 10;
  el.cfgAuthWindow.value = settings.auth_window_sec ?? 300;
  el.cfgAuthBan.value = settings.auth_ban_sec ?? 120;
  el.cfgSmtpHost.value = settings.smtp_host || "";
  el.cfgSmtpPort.value = settings.smtp_port ?? 587;
  el.cfgSmtpUser.value = settings.smtp_user || "";
  el.cfgSmtpFrom.value = settings.smtp_from || "";
  el.cfgSmtpUseTls.value = settings.smtp_use_tls ? "true" : "false";
  el.cfgSmtpUseSsl.value = settings.smtp_use_ssl ? "true" : "false";
  el.cfgBootstrapCodeTtl.value = settings.bootstrap_code_ttl_sec ?? 600;
  el.cfgBootstrapCodeResend.value = settings.bootstrap_code_resend_sec ?? 60;
  renderSourceExpectedInputs(settings.source_expected_update_sec_map || {});

  el.cfgWebhook.value = "";
  el.cfgAuthPass.value = "";
  el.cfgSessionSecret.value = "";
  el.cfgSmtpPass.value = "";
  el.cfgAuthPass.placeholder = settings.basic_auth_pass_masked
    ? `当前：${settings.basic_auth_pass_masked}`
    : "BASIC_AUTH_PASS";
  el.cfgSmtpPass.placeholder = settings.smtp_pass_masked
    ? `当前：${settings.smtp_pass_masked}`
    : "SMTP_PASS";
  el.cfgSessionSecret.placeholder = settings.session_secret_configured
    ? `当前：${settings.session_secret_masked || "已隐藏"}`
    : "SESSION_SECRET";

  const webhookState = settings.wecom_webhook_configured
    ? `已配置（${settings.wecom_webhook_masked || "已隐藏"}）`
    : "未配置";
  state.wecomConfigured = Boolean(settings.wecom_webhook_configured);
  const styleText = settings.notify_style === "compact" ? "简洁" : "详细";
  setWecomTip(`Webhook：${webhookState}；消息样式：${styleText}`);
  renderWecomGuide(settings);

  const authState = settings.auth_enabled ? `已启用（${settings.basic_auth_user || "未命名账号"}）` : "未启用";
  const deployState = `${settings.deploy_host}:${settings.deploy_port} · ${settings.deploy_timezone}`;
  const smtpState = settings.bootstrap_email_verification_enabled ? "已启用" : "未启用";
  state.currentUser = String(settings.authenticated_user || "");
  state.currentIsAdmin = Boolean(settings.is_admin);
  const userCount = Number.isFinite(Number(settings.user_count)) ? Number(settings.user_count) : null;
  const sourceMap = settings.source_expected_update_sec_map || {};
  const liveRef = Number(sourceMap.gold_api_xau);
  const liveRefText = Number.isFinite(liveRef) ? `${Math.round(liveRef)}s` : "--";
  setDeployTip(
    `认证：${authState}；部署：${deployState}；邮箱验证：${smtpState}；用户数：${userCount ?? "--"}；轮询：${settings.poll_interval_sec}s；溢价：${fmtNumber(settings.domestic_premium_cny_per_g, 2)} 元/克；实时判定参考：Gold-API ${liveRefText}`,
  );
  if (el.deployRuntimeInfo) {
    el.deployRuntimeInfo.textContent = `运行环境：${settings.deploy_host}:${settings.deploy_port} · 时区：${settings.deploy_timezone} · 数据库：${settings.deploy_db_path}`;
  }
  if (settings.registration_email_verification_enabled) {
    setInviteTip("仅管理员可生成邀请码。生成后把邀请码发给要注册的用户。");
  } else {
    setInviteTip("当前 SMTP 未配置，无法发送注册验证码。请先在上方完成 SMTP 配置。", true);
  }
  if (!state.currentIsAdmin) {
    setInviteTip("当前账号不是管理员，无法生成邀请码。", true);
  }
  setChangePasswordTip("修改后下次登录请使用新密码。");
  if (el.btnLogout) {
    el.btnLogout.style.display = settings.auth_enabled ? "inline-flex" : "none";
  }
  scheduleAutoRefresh(settings.poll_interval_sec ?? 5);
  renderNotifyPreview();
}
async function refreshSettings() {
  const settings = await fetchJson("/api/settings");
  renderSettings(settings);
}
async function refreshUsers() {
  if (!state.currentIsAdmin) {
    renderUsers({ users: [], operator: state.currentUser || "" });
    return;
  }
  try {
    const payload = await fetchJson("/api/admin/users");
    renderUsers(payload);
  } catch (err) {
    console.error(err);
    setUserManageTip("加载用户列表失败。", true);
  }
}
async function refreshLoginAudit() {
  if (!state.currentIsAdmin) {
    renderLoginAudit({ events: [] });
    return;
  }
  try {
    const payload = await fetchJson("/api/admin/login_audit?limit=120");
    renderLoginAudit(payload);
  } catch (err) {
    console.error(err);
    setLoginAuditTip("加载登录审计失败。", true);
  }
}


GM.refreshSettings = refreshSettings;
GM.refreshUsers = refreshUsers;
GM.refreshLoginAudit = refreshLoginAudit;
GM.renderSettings = renderSettings;
GM.renderUsers = renderUsers;
GM.renderLoginAudit = renderLoginAudit;
GM.renderWecomGuide = renderWecomGuide;
GM.renderNotifyPreview = renderNotifyPreview;
GM.renderSourceExpectedInputs = renderSourceExpectedInputs;
GM.readSourceExpectedInputs = readSourceExpectedInputs;
GM.resolveWecomTestHint = resolveWecomTestHint;
GM.normalizeWecomWebhookHint = normalizeWecomWebhookHint;
// System page event handlers
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
    await refreshSettings();
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
    await refreshSettings();
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
      await refreshUsers();
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
        await refreshUsers();
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
        await refreshUsers();
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
        await refreshUsers();
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
    await refreshLoginAudit();
  });
}

if (el.refreshUserList) {
  el.refreshUserList.addEventListener("click", async () => {
    await refreshUsers();
  });
}

// System page initialization
refreshSettings().catch(err => console.error('[system] refreshSettings failed:', err));
refreshUsers().catch(err => console.error('[system] refreshUsers failed:', err));
refreshLoginAudit().catch(err => console.error('[system] refreshLoginAudit failed:', err));
})();
