// Golden Monitor - Core Module
// Shared state, utilities, navigation, modals, insight rendering

// Global error handler for debugging

window.onerror = function(msg, src, line, col, err) {
  console.error('[GLOBAL ERROR]', msg, 'at', src, ':' + line + ':' + col, err);
  return false;
};
window.addEventListener('unhandledrejection', function(e) {
  console.error('[UNHANDLED REJECTION]', e.reason);
});
const state = {
  range: "12m",
  timeframe: "1d",
  layout: "split",
  klineTableView: "all",
  activeTab: "dashboard",
  activeWorkspace: "market",
  workspaceLastTab: {
    market: "dashboard",
    ai: "insight-policy",
    system: "wecom",
  },
  deployView: "settings",
  zoom: { start: 72, end: 100 },
  zoomIntl: { start: 72, end: 100 },
  zoomDomestic: { start: 72, end: 100 },
  chartInteraction: {
    active: false,
    pendingRepaint: false,
  },
  latestMap: {},
  rules: [],
  autoRefreshSec: 5,
  intl: { bars: [], indicators: null },
  domestic: { bars: [], indicators: null },
  intlDailyBars: [],
  domesticDailyBars: [],
  yfinance: {
    ticker: "AAPL",
    period: "6mo",
    interval: "1d",
    prepost: false,
    payload: null,
  },
  insightEvents: [],
  selectedInsightEventId: null,
  currentInsightDetail: null,
  currentDashboardInsightDetail: null,
  currentUser: "",
  currentIsAdmin: false,
  users: [],
  overlayEvents: [],
  selectedOverlayEventId: null,
  backtest: null,
  backtestCompare: null,
  backtestCompareSort: { key: "net_return_pct", order: "desc", label: "净收益优先" },
  insightTriggerBusy: false,
  insightTriggerCooldownUntil: 0,
  insightTriggerCooldownTimer: null,
  latestTriggeredInsightEventId: null,
  insightAssistantMessages: [
    {
      role: "assistant",
      content: "可以直接问行情、策略或风险。",
    },
  ],
  insightAssistantBusy: false,
  insightAssistantHistoryLoaded: false,
  insightAssistantHistoryLoading: false,
  insightAssistantContext: {
    source: "default",
    eventId: null,
    symbols: ["XAUUSD", "AUCN", "USDCNY"],
    summary: "",
    note: "",
  },
  insightProgressWatcher: {
    eventId: null,
    timer: null,
    inFlight: false,
    errorCount: 0,
  },
  wecomLastTest: null,
  wecomConfigured: false,
  modal: {
    currentFormId: "",
    currentTrigger: null,
    actionResolver: null,
    subworkspaceHost: null,
    subworkspaceContent: null,
    subworkspaceNextSibling: null,
    subworkspaceTrigger: null,
  },
};

const TAB_IDS = ["dashboard", "rules", "lab", "yfinance", "wecom", "insight-policy", "insight-ai", "insight-chat", "deploy"];
const WORKSPACE_IDS = ["market", "ai", "system"];
const WORKSPACE_TAB_MAP = {
  market: ["dashboard", "rules", "lab", "yfinance"],
  ai: ["insight-policy", "insight-ai", "insight-chat"],
  system: ["wecom", "deploy"],
};
const WORKSPACE_LABEL = {
  market: "监控中心",
  ai: "AI中心",
  system: "系统中心",
};
const DEPLOY_VIEW_IDS = ["settings", "accounts", "observability"];

const SYMBOL_LABEL = {
  XAUUSD: "国际现货金",
  AUCN: "国内积存金",
  USDCNY: "美元兑人民币",
};

const SOURCE_LABEL = {
  "coingecko_pax-gold": "CoinGecko（PAXG 现货代理）",
  "coingecko_tether-gold": "CoinGecko（XAUT 现货代理）",
  gold_api_xau: "Gold-API（国际现货金）",
  gold_api_xau_history_proxy: "Gold-API 历史代理",
  yahoo_gc_futures: "Yahoo（COMEX黄金期货）",
  stooq_xauusd: "Stooq（国际金价）",
  jdjygold_zheshang_aucn: "浙商积存金（京东金融）",
  jdjygold_minsheng_aucn: "民生积存金（京东金融）",
  domestic_reference_primary: "国内积存金合成（兜底）",
  domestic_reference_backup: "国内积存金合成（备）",
  open_er_usdcny: "Open Exchange Rates（低频兜底）",
  yahoo_usdcny: "Yahoo 汇率（分钟级）",
};

const BIAS_LABEL = {
  bullish: "多头",
  bearish: "空头",
  neutral: "震荡",
};

const CONDITION_LABEL = {
  gte: "≥",
  lte: "≤",
};

const FRESHNESS_LABEL = {
  live: "实时更新",
  delayed: "非实时更新",
  cached: "缓存兜底",
};

const SOURCE_UPDATE_INPUT_MAP = {
  gold_api_xau: "cfg-exp-gold-api",
  "coingecko_pax-gold": "cfg-exp-coingecko",
  "coingecko_tether-gold": "cfg-exp-coingecko-tether",
  yahoo_gc_futures: "cfg-exp-yahoo-gc",
  stooq_xauusd: "cfg-exp-stooq",
  jdjygold_zheshang_aucn: "cfg-exp-jd-zheshang",
  jdjygold_minsheng_aucn: "cfg-exp-jd-minsheng",
  domestic_reference_primary: "cfg-exp-domestic",
  domestic_reference_backup: "cfg-exp-domestic-backup",
  yahoo_usdcny: "cfg-exp-yahoo-fx",
  open_er_usdcny: "cfg-exp-open-er",
};

const el = {
  workspaceLinks: Array.from(document.querySelectorAll("[data-workspace-link]")),
  range: document.getElementById("range-select"),
  timeframe: document.getElementById("timeframe-select"),
  layout: document.getElementById("layout-select"),
  klineTableView: document.getElementById("kline-table-view"),
  lastUpdated: document.getElementById("last-updated"),
  splitWrapper: document.getElementById("split-wrapper"),
  dualWrapper: document.getElementById("dual-wrapper"),
  splitBoxIntl: document.getElementById("split-box-intl"),
  splitBoxDomestic: document.getElementById("split-box-domestic"),
  chartIntlTimeRange: document.getElementById("chart-intl-time-range"),
  chartDomTimeRange: document.getElementById("chart-dom-time-range"),
  chartDualTimeRange: document.getElementById("chart-dual-time-range"),
  changeIntl: document.getElementById("change-intl"),
  changeDomestic: document.getElementById("change-domestic"),
  klineTableIntlWrap: document.getElementById("kline-table-intl-wrap"),
  klineTableDomWrap: document.getElementById("kline-table-dom-wrap"),
  klineTableIntlBody: document.getElementById("kline-table-intl-body"),
  klineTableDomBody: document.getElementById("kline-table-dom-body"),
  yfinanceForm: document.getElementById("yfinance-form"),
  yfinanceTicker: document.getElementById("yfinance-ticker"),
  yfinancePeriod: document.getElementById("yfinance-period"),
  yfinanceInterval: document.getElementById("yfinance-interval"),
  yfinancePrepost: document.getElementById("yfinance-prepost"),
  yfinanceLoad: document.getElementById("yfinance-load"),
  yfinanceTip: document.getElementById("yfinance-tip"),
  yfinancePrice: document.getElementById("yfinance-price"),
  yfinanceAsOf: document.getElementById("yfinance-asof"),
  yfinanceChangePct: document.getElementById("yfinance-change-pct"),
  yfinanceChangeAbs: document.getElementById("yfinance-change-abs"),
  yfinanceDayRange: document.getElementById("yfinance-day-range"),
  yfinanceCurrency: document.getElementById("yfinance-currency"),
  yfinanceVolume: document.getElementById("yfinance-volume"),
  yfinanceExchange: document.getElementById("yfinance-exchange"),
  yfinanceChartTitle: document.getElementById("yfinance-chart-title"),
  yfinanceChartMeta: document.getElementById("yfinance-chart-meta"),
  yfinanceBarsBody: document.getElementById("yfinance-bars-body"),
  yfinanceNewsList: document.getElementById("yfinance-news-list"),
  yfinanceChart: document.getElementById("chart-yfinance"),
  tabLinks: Array.from(document.querySelectorAll("[data-tab-link]")),
  tabPanels: Array.from(document.querySelectorAll("[data-tab-panel]")),
  deployViewLinks: Array.from(document.querySelectorAll("[data-deploy-view-link]")),
  deployViewPanels: Array.from(document.querySelectorAll("[data-deploy-view-panel]")),
  workspaceGuide: document.getElementById("workspace-guide"),
  workspaceGuideTitle: document.getElementById("workspace-guide-title"),
  workspaceGuideDesc: document.getElementById("workspace-guide-desc"),
  workspaceGuideSteps: document.getElementById("workspace-guide-steps"),
  workspaceGuideActions: document.getElementById("workspace-guide-actions"),
  workspaceResponsibility: document.getElementById("workspace-responsibility"),
  workspaceRespTitle: document.getElementById("workspace-responsibility-title"),
  workspaceRespBreadcrumb: document.getElementById("workspace-responsibility-breadcrumb"),
  workspaceRespContainer: document.getElementById("workspace-responsibility-container"),
  workspaceRespMustDo: document.getElementById("workspace-responsibility-mustdo"),
  workspaceRespMustNot: document.getElementById("workspace-responsibility-mustnot"),
  workspaceRespPermission: document.getElementById("workspace-responsibility-permission"),
  workspaceRespExit: document.getElementById("workspace-responsibility-exit"),
  insightRunnerPanel: document.getElementById("insight-runner-panel"),
  insightRunnerText: document.getElementById("insight-runner-text"),
  insightRunnerOpenDashboard: document.getElementById("insight-runner-open-dashboard"),
  insightRunnerOpenEvents: document.getElementById("insight-runner-open-events"),
  insightRunnerDismiss: document.getElementById("insight-runner-dismiss"),
  ruleForm: document.getElementById("rule-form"),
  ruleList: document.getElementById("rule-list"),
  alertList: document.getElementById("alert-list"),
  sourceList: document.getElementById("source-list"),
  wecomSettingsForm: document.getElementById("wecom-settings-form"),
  deploySettingsForm: document.getElementById("deploy-settings-form"),
  insightPolicyForm: document.getElementById("insight-policy-form"),
  insightProviderForm: document.getElementById("insight-provider-form"),
  wecomSettingsTip: document.getElementById("wecom-settings-tip"),
  wecomGuideSteps: document.getElementById("wecom-guide-steps"),
  wecomGuideStatus: document.getElementById("wecom-guide-status"),
  deploySettingsTip: document.getElementById("deploy-settings-tip"),
  insightPolicyTip: document.getElementById("insight-policy-tip"),
  insightProviderTip: document.getElementById("insight-provider-tip"),
  notifyPreview: document.getElementById("notify-preview"),
  insightPolicyPreview: document.getElementById("insight-policy-preview"),
  cfgWebhook: document.getElementById("cfg-webhook"),
  cfgInterval: document.getElementById("cfg-interval"),
  cfgPremium: document.getElementById("cfg-premium"),
  cfgConsole: document.getElementById("cfg-console"),
  cfgTitlePrefix: document.getElementById("cfg-title-prefix"),
  cfgNotifyStyle: document.getElementById("cfg-notify-style"),
  cfgNotifyTrigger: document.getElementById("cfg-notify-trigger"),
  cfgNotifyRecover: document.getElementById("cfg-notify-recover"),
  cfgNotifySource: document.getElementById("cfg-notify-source"),
  cfgNotifyHeartbeat: document.getElementById("cfg-notify-heartbeat"),
  cfgExpGoldApi: document.getElementById("cfg-exp-gold-api"),
  cfgExpCoingecko: document.getElementById("cfg-exp-coingecko"),
  cfgExpCoingeckoTether: document.getElementById("cfg-exp-coingecko-tether"),
  cfgExpYahooGc: document.getElementById("cfg-exp-yahoo-gc"),
  cfgExpStooq: document.getElementById("cfg-exp-stooq"),
  cfgExpJdZheshang: document.getElementById("cfg-exp-jd-zheshang"),
  cfgExpJdMinsheng: document.getElementById("cfg-exp-jd-minsheng"),
  cfgExpDomestic: document.getElementById("cfg-exp-domestic"),
  cfgExpDomesticBackup: document.getElementById("cfg-exp-domestic-backup"),
  cfgExpYahooFx: document.getElementById("cfg-exp-yahoo-fx"),
  cfgExpOpenEr: document.getElementById("cfg-exp-open-er"),
  cfgAuthUser: document.getElementById("cfg-auth-user"),
  cfgAuthPass: document.getElementById("cfg-auth-pass"),
  cfgDeployHost: document.getElementById("cfg-deploy-host"),
  cfgDeployPort: document.getElementById("cfg-deploy-port"),
  cfgDeployTimezone: document.getElementById("cfg-deploy-timezone"),
  cfgSessionTtl: document.getElementById("cfg-session-ttl"),
  cfgSessionSecret: document.getElementById("cfg-session-secret"),
  cfgAuthMaxFailures: document.getElementById("cfg-auth-max-failures"),
  cfgAuthWindow: document.getElementById("cfg-auth-window"),
  cfgAuthBan: document.getElementById("cfg-auth-ban"),
  cfgSmtpHost: document.getElementById("cfg-smtp-host"),
  cfgSmtpPort: document.getElementById("cfg-smtp-port"),
  cfgSmtpUser: document.getElementById("cfg-smtp-user"),
  cfgSmtpPass: document.getElementById("cfg-smtp-pass"),
  cfgSmtpFrom: document.getElementById("cfg-smtp-from"),
  cfgSmtpUseTls: document.getElementById("cfg-smtp-use-tls"),
  cfgSmtpUseSsl: document.getElementById("cfg-smtp-use-ssl"),
  cfgBootstrapCodeTtl: document.getElementById("cfg-bootstrap-code-ttl"),
  cfgBootstrapCodeResend: document.getElementById("cfg-bootstrap-code-resend"),
  deployRuntimeInfo: document.getElementById("deploy-runtime-info"),
  inviteCreateForm: document.getElementById("invite-create-form"),
  inviteMaxUses: document.getElementById("invite-max-uses"),
  inviteExpireDays: document.getElementById("invite-expire-days"),
  inviteCreateTip: document.getElementById("invite-create-tip"),
  inviteCodeOutput: document.getElementById("invite-code-output"),
  userManageForm: document.getElementById("user-manage-form"),
  userManageTip: document.getElementById("user-manage-tip"),
  userManageSummary: document.getElementById("user-manage-summary"),
  userList: document.getElementById("user-list"),
  refreshUserList: document.getElementById("refresh-user-list"),
  userCreateForm: document.getElementById("user-create-form"),
  userCreateUsername: document.getElementById("user-create-username"),
  userCreateEmail: document.getElementById("user-create-email"),
  userCreatePassword: document.getElementById("user-create-password"),
  userCreateIsAdmin: document.getElementById("user-create-is-admin"),
  userCreateEnabled: document.getElementById("user-create-enabled"),
  userCreateTip: document.getElementById("user-create-tip"),
  changePasswordForm: document.getElementById("change-password-form"),
  currentPassword: document.getElementById("current-password"),
  newPassword: document.getElementById("new-password"),
  confirmNewPassword: document.getElementById("confirm-new-password"),
  changePasswordTip: document.getElementById("change-password-tip"),
  refreshLoginAudit: document.getElementById("refresh-login-audit"),
  loginAuditForm: document.getElementById("login-audit-form"),
  loginAuditTip: document.getElementById("login-audit-tip"),
  loginAuditSummary: document.getElementById("login-audit-summary"),
  loginAuditList: document.getElementById("login-audit-list"),
  insightEnabled: document.getElementById("insight-enabled"),
  insightPolicyMode: document.getElementById("insight-policy-mode"),
  insightMinAuthoritative: document.getElementById("insight-min-authoritative"),
  insightWhitelist: document.getElementById("insight-whitelist"),
  insightCustomStrategies: document.getElementById("insight-custom-strategies"),
  insightTriggerProfile: document.getElementById("insight-trigger-profile"),
  insightFastWindowMinutes: document.getElementById("insight-fast-window-minutes"),
  insightFastThresholdPct: document.getElementById("insight-fast-threshold-pct"),
  insightShortWindowMinutes: document.getElementById("insight-short-window-minutes"),
  insightShortThresholdPct: document.getElementById("insight-short-threshold-pct"),
  insightPeriodicSummarySec: document.getElementById("insight-periodic-summary-sec"),
  insightCooldownFastSec: document.getElementById("insight-cooldown-fast-sec"),
  insightCooldownShortSec: document.getElementById("insight-cooldown-short-sec"),
  insightCooldownPeriodicSec: document.getElementById("insight-cooldown-periodic-sec"),
  insightUpPct: document.getElementById("insight-up-pct"),
  insightDownPct: document.getElementById("insight-down-pct"),
  insightWindowMinutes: document.getElementById("insight-window-minutes"),
  insightCooldownSec: document.getElementById("insight-cooldown-sec"),
  insightSymbols: document.getElementById("insight-symbols"),
  insightRssEnabled: document.getElementById("insight-rss-enabled"),
  insightNewsApiEnabled: document.getElementById("insight-news-api-enabled"),
  insightNewsApiBaseUrl: document.getElementById("insight-news-api-base-url"),
  insightNewsApiKey: document.getElementById("insight-news-api-key"),
  insightNewsApiQueryParam: document.getElementById("insight-news-api-query-param"),
  insightAiEnabled: document.getElementById("insight-ai-enabled"),
  insightAiBaseUrl: document.getElementById("insight-ai-base-url"),
  insightAiModelSelect: document.getElementById("insight-ai-model-select"),
  insightDetectModelsBtn: document.getElementById("insight-detect-models"),
  insightTestAiBtn: document.getElementById("insight-test-ai"),
  insightAiActionStatus: document.getElementById("insight-ai-action-status"),
  insightAiModel: document.getElementById("insight-ai-model"),
  insightAiApiKey: document.getElementById("insight-ai-api-key"),
  insightAssistantLog: document.getElementById("insight-assistant-log"),
  insightAssistantForm: document.getElementById("insight-assistant-form"),
  insightAssistantInput: document.getElementById("insight-assistant-input"),
  insightAssistantSend: document.getElementById("insight-assistant-send"),
  insightAssistantClear: document.getElementById("insight-assistant-clear"),
  insightAssistantTip: document.getElementById("insight-assistant-tip"),
  insightAssistantContextBadge: document.getElementById("insight-assistant-context-badge"),
  insightAssistantContextSummary: document.getElementById("insight-assistant-context-summary"),
  insightAssistantContextTags: document.getElementById("insight-assistant-context-tags"),
  insightAssistantUseEvent: document.getElementById("insight-assistant-use-event"),
  insightAssistantClearContext: document.getElementById("insight-assistant-clear-context"),
  insightAssistantTurnCount: document.getElementById("insight-assistant-turn-count"),
  insightAssistantTurns: document.getElementById("insight-assistant-turns"),
  insightAssistantFollowups: document.getElementById("insight-assistant-followups"),
  insightNotifyEnabled: document.getElementById("insight-notify-enabled"),
  insightStrategyList: document.getElementById("insight-strategy-list"),
  insightEventList: document.getElementById("insight-event-list"),
  insightEventDetail: document.getElementById("insight-event-detail"),
  insightRefreshBtn: document.getElementById("insight-refresh-btn"),
  insightSimulateBtn: document.getElementById("insight-simulate-btn"),
  insightManualTriggerBtn: document.getElementById("insight-manual-trigger-btn"),
  btnTestNotify: document.getElementById("btn-test-notify"),
  btnRefreshNow: document.getElementById("btn-refresh-now"),
  btnInsightTrigger: document.getElementById("btn-insight-trigger"),
  refreshStatus: document.getElementById("refresh-status"),
  ruleFillAbove: document.getElementById("rule-fill-above"),
  ruleFillBelow: document.getElementById("rule-fill-below"),
  ruleTip: document.getElementById("rule-form-tip"),
  ruleLogic: document.getElementById("rule-logic"),
  ruleFreshnessStatus: document.getElementById("rule-freshness-status"),
  ruleMaxAge: document.getElementById("rule-max-age"),
  btnZoomIn: document.getElementById("btn-zoom-in"),
  btnZoomOut: document.getElementById("btn-zoom-out"),
  btnZoomReset: document.getElementById("btn-zoom-reset"),
  btnLogout: document.getElementById("btn-logout"),
  dashboardInsightTip: document.getElementById("dashboard-insight-tip"),
  dashboardInsightDetail: document.getElementById("dashboard-insight-detail"),
  backtestForm: document.getElementById("backtest-form"),
  backtestRuleId: document.getElementById("backtest-rule-id"),
  backtestRange: document.getElementById("backtest-range"),
  backtestTip: document.getElementById("backtest-tip"),
  backtestSummary: document.getElementById("backtest-summary"),
  backtestTradesBody: document.getElementById("backtest-trades-body"),
  backtestEquityChart: document.getElementById("backtest-equity-chart"),
  backtestCompareForm: document.getElementById("backtest-compare-form"),
  backtestCompareRange: document.getElementById("backtest-compare-range"),
  backtestCompareRuleIds: document.getElementById("backtest-compare-rule-ids"),
  backtestCompareTip: document.getElementById("backtest-compare-tip"),
  backtestCompareBody: document.getElementById("backtest-compare-body"),
  backtestCompareSortStatus: document.getElementById("backtest-compare-sort-status"),
  backtestSortButtons: Array.from(document.querySelectorAll("[data-backtest-sort-key]")),
  workspaceModalRoot: document.getElementById("workspace-modal-root"),
  workspaceModal: document.getElementById("workspace-modal"),
  workspaceModalTitle: document.getElementById("workspace-modal-title"),
  workspaceModalDesc: document.getElementById("workspace-modal-desc"),
  workspaceModalBody: document.getElementById("workspace-modal-body"),
  workspaceModalMain: document.getElementById("workspace-modal-main"),
  workspaceModalOutline: document.getElementById("workspace-modal-outline"),
  workspaceModalClose: document.getElementById("workspace-modal-close"),
  workspaceModalSubmit: document.getElementById("workspace-modal-submit"),
  subworkspaceModalRoot: document.getElementById("subworkspace-modal-root"),
  subworkspaceModal: document.getElementById("subworkspace-modal"),
  subworkspaceModalTitle: document.getElementById("subworkspace-modal-title"),
  subworkspaceModalDesc: document.getElementById("subworkspace-modal-desc"),
  subworkspaceModalBody: document.getElementById("subworkspace-modal-body"),
  subworkspaceModalClose: document.getElementById("subworkspace-modal-close"),
  actionModalRoot: document.getElementById("action-modal-root"),
  actionModalTitle: document.getElementById("action-modal-title"),
  actionModalText: document.getElementById("action-modal-text"),
  actionModalInputWrap: document.getElementById("action-modal-input-wrap"),
  actionModalInputLabel: document.getElementById("action-modal-input-label"),
  actionModalInput: document.getElementById("action-modal-input"),
  actionModalTip: document.getElementById("action-modal-tip"),
  actionModalCancel: document.getElementById("action-modal-cancel"),
  actionModalConfirm: document.getElementById("action-modal-confirm"),
  insightChatModalRoot: document.getElementById("insight-chat-modal-root"),
  insightChatModalTitle: document.getElementById("insight-chat-modal-title"),
  insightChatModalBody: document.getElementById("insight-chat-modal-body"),
  insightChatModalClose: document.getElementById("insight-chat-modal-close"),
};

var chartIntl = null, chartDomestic = null, chartDual = null;
var refreshTimer = null;
var refreshInFlight = false;
var authRedirecting = false;
const formModalRegistry = new Map();
var formModalStash = null;
var workspaceOutlineObserver = null;
const workspaceOutlineButtonMap = new Map();
const focusPulseTimers = new WeakMap();

function syncModalBodyLock() {
  const workspaceOpen = Boolean(el.workspaceModalRoot && !el.workspaceModalRoot.classList.contains("hidden"));
  const subworkspaceOpen = Boolean(el.subworkspaceModalRoot && !el.subworkspaceModalRoot.classList.contains("hidden"));
  const actionOpen = Boolean(el.actionModalRoot && !el.actionModalRoot.classList.contains("hidden"));
  const insightChatOpen = Boolean(el.insightChatModalRoot && !el.insightChatModalRoot.classList.contains("hidden"));
  document.body.classList.toggle("modal-open", workspaceOpen || subworkspaceOpen || actionOpen || insightChatOpen);
}

function destroyWorkspaceOutlineObserver() {
  if (workspaceOutlineObserver) {
    workspaceOutlineObserver.disconnect();
    workspaceOutlineObserver = null;
  }
  workspaceOutlineButtonMap.clear();
}

function setActiveWorkspaceOutlineItem(sectionId) {
  if (!el.workspaceModalOutline) return;
  const targetId = String(sectionId || "");
  const items = Array.from(el.workspaceModalOutline.querySelectorAll(".workspace-outline-item"));
  items.forEach((item) => {
    const match = String(item.dataset.sectionId || "") === targetId;
    item.classList.toggle("active", match);
  });
}

function setupWorkspaceOutlineObserver(sections) {
  if (workspaceOutlineObserver) {
    workspaceOutlineObserver.disconnect();
    workspaceOutlineObserver = null;
  }
  if (!el.workspaceModalMain || !Array.isArray(sections) || sections.length === 0) return;
  if (typeof IntersectionObserver !== "function") return;
  workspaceOutlineObserver = new IntersectionObserver(
    (entries) => {
      let bestEntry = null;
      entries.forEach((entry) => {
        const target = entry.target;
        if (!(target instanceof HTMLElement)) return;
        if (!entry.isIntersecting) return;
        if (!workspaceOutlineButtonMap.has(target.id)) return;
        if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
          bestEntry = entry;
        }
      });
      if (bestEntry?.target instanceof HTMLElement) {
        setActiveWorkspaceOutlineItem(bestEntry.target.id);
      }
    },
    {
      root: el.workspaceModalMain,
      rootMargin: "-6% 0px -58% 0px",
      threshold: [0.15, 0.35, 0.6, 0.85],
    },
  );
  sections.forEach((section) => {
    if (!(section instanceof HTMLElement) || !section.id) return;
    workspaceOutlineObserver?.observe(section);
  });
}

function buildWorkspaceOutline(form) {
  if (!el.workspaceModalOutline) return;
  destroyWorkspaceOutlineObserver();
  el.workspaceModalOutline.innerHTML = "";
  const sections = Array.from(form.children).filter((node) => {
    if (!(node instanceof HTMLElement)) return false;
    return node.matches(".modal-section, details.modal-accordion");
  });
  const wrap = el.workspaceModalOutline.closest(".workspace-modal-outline-wrap");
  if (sections.length === 0) {
    wrap?.classList.add("hidden");
    return;
  }
  wrap?.classList.remove("hidden");
  sections.forEach((section, index) => {
    const titleNode = section.matches(".modal-section")
      ? section.querySelector(":scope > .modal-section-head h4")
      : section.querySelector(":scope > summary span");
    const descNode = section.matches(".modal-section")
      ? section.querySelector(":scope > .modal-section-head p")
      : section.querySelector(":scope > summary small");
    const title = String(titleNode?.textContent || "").trim() || `分组 ${index + 1}`;
    const desc = String(descNode?.textContent || "").trim();
    const anchorId = section.id || `${form.id}-section-${index + 1}`;
    section.id = anchorId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-outline-item";
    button.dataset.sectionId = anchorId;
    const titleEl = document.createElement("strong");
    titleEl.textContent = `${index + 1}. ${title}`;
    button.appendChild(titleEl);
    if (desc) {
      const descEl = document.createElement("small");
      descEl.textContent = desc;
      button.appendChild(descEl);
    }
    const isSubmodalSection = section.matches("[data-ui-submodal='true']");
    button.addEventListener("click", () => {
      setActiveWorkspaceOutlineItem(anchorId);
      if (isSubmodalSection) {
        openSubworkspaceModal(section, button);
        return;
      }
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    if (index === 0) {
      button.classList.add("active");
    }
    workspaceOutlineButtonMap.set(anchorId, button);
    el.workspaceModalOutline.appendChild(button);
  });
  setupWorkspaceOutlineObserver(sections);
}

function findSubworkspaceContent(host) {
  if (!(host instanceof HTMLElement)) return null;
  const customSelector = String(host.dataset.submodalContent || "").trim();
  if (customSelector) {
    const customNode = host.querySelector(customSelector);
    if (customNode instanceof HTMLElement) return customNode;
  }
  if (host.tagName === "DETAILS") {
    return (
      Array.from(host.children).find((child) => {
        if (!(child instanceof HTMLElement)) return false;
        if (child.tagName === "SUMMARY") return false;
        if (child.classList.contains("modal-subwindow-row")) return false;
        return true;
      }) || null
    );
  }
  return (
    Array.from(host.children).find((child) => {
      if (!(child instanceof HTMLElement)) return false;
      if (child.classList.contains("modal-section-head")) return false;
      if (child.classList.contains("modal-subwindow-row")) return false;
      if (child.classList.contains("modal-footer")) return false;
      return true;
    }) || null
  );
}

function getSubworkspaceHeader(host) {
  if (!(host instanceof HTMLElement)) return null;
  if (host.tagName === "DETAILS") {
    const summary = host.querySelector(":scope > summary");
    return summary instanceof HTMLElement ? summary : null;
  }
  const head = host.querySelector(":scope > .modal-section-head");
  return head instanceof HTMLElement ? head : null;
}

function closeSubworkspaceModal({ restoreFocus = true } = {}) {
  const host = state.modal.subworkspaceHost;
  const content = state.modal.subworkspaceContent;
  const nextSibling = state.modal.subworkspaceNextSibling;
  if (host instanceof HTMLElement) {
    host.classList.remove("submodal-open");
    if (content instanceof HTMLElement && content.parentElement === el.subworkspaceModalBody) {
      if (nextSibling instanceof Node && nextSibling.parentNode === host) {
        host.insertBefore(content, nextSibling);
      } else {
        host.appendChild(content);
      }
    }
  }
  state.modal.subworkspaceHost = null;
  state.modal.subworkspaceContent = null;
  state.modal.subworkspaceNextSibling = null;
  if (el.subworkspaceModalRoot) {
    el.subworkspaceModalRoot.classList.add("hidden");
    el.subworkspaceModalRoot.setAttribute("aria-hidden", "true");
  }
  if (el.workspaceModalRoot) {
    el.workspaceModalRoot.classList.remove("subworkspace-active");
  }
  if (el.subworkspaceModalBody) {
    el.subworkspaceModalBody.innerHTML = "";
  }
  syncModalBodyLock();
  if (restoreFocus && state.modal.subworkspaceTrigger instanceof HTMLElement) {
    state.modal.subworkspaceTrigger.focus();
  }
  state.modal.subworkspaceTrigger = null;
}

function openSubworkspaceModal(host, triggerNode = null) {
  if (!el.subworkspaceModalRoot || !el.subworkspaceModalBody) return;
  if (!(host instanceof HTMLElement)) return;
  const content = findSubworkspaceContent(host);
  if (!(content instanceof HTMLElement)) return;
  if (state.modal.subworkspaceHost) {
    closeSubworkspaceModal({ restoreFocus: false });
  }
  const head = getSubworkspaceHeader(host);
  const headTitle = head?.querySelector("span, h4")?.textContent || head?.textContent || "";
  const title = String(host.dataset.submodalTitle || headTitle || "高级分组编辑").trim();
  const desc = String(host.dataset.submodalDesc || "在此集中编辑复杂参数，完成后返回主弹窗保存。").trim();
  if (el.subworkspaceModalTitle) {
    el.subworkspaceModalTitle.textContent = title;
  }
  if (el.subworkspaceModalDesc) {
    el.subworkspaceModalDesc.textContent = desc;
  }
  host.classList.add("submodal-open");
  state.modal.subworkspaceHost = host;
  state.modal.subworkspaceContent = content;
  state.modal.subworkspaceNextSibling = content.nextSibling;
  state.modal.subworkspaceTrigger = triggerNode instanceof HTMLElement ? triggerNode : null;
  el.subworkspaceModalBody.innerHTML = "";
  el.subworkspaceModalBody.appendChild(content);
  el.subworkspaceModalRoot.classList.remove("hidden");
  el.subworkspaceModalRoot.setAttribute("aria-hidden", "false");
  if (el.workspaceModalRoot) {
    el.workspaceModalRoot.classList.add("subworkspace-active");
  }
  syncModalBodyLock();
  const focusNode = el.subworkspaceModalBody.querySelector("input, select, textarea, button");
  if (focusNode instanceof HTMLElement) {
    focusNode.focus({ preventScroll: true });
  }
}

function enhanceSubworkspaceHosts(form) {
  const hosts = Array.from(form.querySelectorAll("[data-ui-submodal='true']"));
  hosts.forEach((host) => {
    if (!(host instanceof HTMLElement)) return;
    if (!host.matches("details.modal-accordion, .modal-section")) return;
    host.classList.add("submodal-ready");
    const head = getSubworkspaceHeader(host);
    if (!(head instanceof HTMLElement)) return;
    if (host.tagName === "DETAILS") {
      host.open = false;
    }
    const staleRow = host.querySelector(":scope > .modal-subwindow-row");
    if (staleRow instanceof HTMLElement) {
      staleRow.remove();
    }
    if (head.dataset.submodalBound !== "1") {
      head.dataset.submodalBound = "1";
      head.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("button, a, input, select, textarea, label")) return;
        event.preventDefault();
        openSubworkspaceModal(host, head);
      });
    }
  });
}

function closeWorkspaceModal({ restoreFocus = true } = {}) {
  if (state.modal.subworkspaceHost) {
    closeSubworkspaceModal({ restoreFocus: false });
  }
  const currentId = String(state.modal.currentFormId || "");
  const config = formModalRegistry.get(currentId);
  if (!currentId || !config || !formModalStash) return;
  formModalStash.appendChild(config.form);
  if (config.tip && config.tipParent) {
    if (config.tipNextSibling && config.tipNextSibling.parentNode === config.tipParent) {
      config.tipParent.insertBefore(config.tip, config.tipNextSibling);
    } else {
      config.tipParent.appendChild(config.tip);
    }
  }
  state.modal.currentFormId = "";
  destroyWorkspaceOutlineObserver();
  if (el.workspaceModalMain) {
    el.workspaceModalMain.innerHTML = "";
  }
  if (el.workspaceModalOutline) {
    el.workspaceModalOutline.innerHTML = "";
    const wrap = el.workspaceModalOutline.closest(".workspace-modal-outline-wrap");
    wrap?.classList.add("hidden");
  }
  if (el.workspaceModalRoot) {
    el.workspaceModalRoot.classList.remove("open");
    el.workspaceModalRoot.classList.add("hidden");
    el.workspaceModalRoot.setAttribute("aria-hidden", "true");
  }
  syncWorkspaceModalFooterActions(null);
  syncModalBodyLock();
  if (restoreFocus && state.modal.currentTrigger instanceof HTMLElement) {
    state.modal.currentTrigger.focus();
  }
  state.modal.currentTrigger = null;
}

function closeWorkspaceModalForForm(formId) {
  if (String(state.modal.currentFormId || "") !== String(formId || "")) return;
  closeWorkspaceModal();
}

function getWorkspacePrimarySubmitControl(form) {
  if (!(form instanceof HTMLFormElement)) return null;
  const preferred = form.querySelector("[data-modal-primary-submit='true'], [data-modal-primary-submit='1']");
  if (preferred instanceof HTMLButtonElement || preferred instanceof HTMLInputElement) {
    return preferred;
  }
  const submitter = form.querySelector("button[type='submit'], input[type='submit']");
  if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
    return submitter;
  }
  return null;
}

function syncWorkspaceModalFooterActions(form) {
  if (!el.workspaceModalSubmit) return;
  const submitter = getWorkspacePrimarySubmitControl(form);
  if (!submitter) {
    el.workspaceModalSubmit.classList.add("hidden");
    el.workspaceModalSubmit.disabled = true;
    el.workspaceModalSubmit.textContent = "完成并保存";
    return;
  }
  const customLabel = form instanceof HTMLFormElement ? String(form.dataset.modalSubmitLabel || "").trim() : "";
  const fallbackLabel =
    submitter instanceof HTMLInputElement ? String(submitter.value || "").trim() : String(submitter.textContent || "").trim();
  el.workspaceModalSubmit.textContent = customLabel || fallbackLabel || "完成并保存";
  el.workspaceModalSubmit.disabled = Boolean(submitter.disabled);
  el.workspaceModalSubmit.classList.remove("hidden");
}

function openWorkspaceModal(formId, triggerNode = null) {
  const config = formModalRegistry.get(String(formId || ""));
  if (!config || !el.workspaceModalMain || !el.workspaceModalRoot || !el.workspaceModal) return false;
  // Page-mode forms stay inline; don't open them in a modal
  if (config.form && String(config.form.dataset.uiModalMode || "").toLowerCase() === "page") {
    return false;
  }
  if (state.modal.currentFormId) {
    closeWorkspaceModal({ restoreFocus: false });
  }
  state.modal.currentFormId = String(formId);
  state.modal.currentTrigger = triggerNode instanceof HTMLElement ? triggerNode : null;
  if (el.workspaceModalTitle) {
    el.workspaceModalTitle.textContent = config.title || "编辑";
  }
  if (el.workspaceModalDesc) {
    el.workspaceModalDesc.textContent = config.desc || "完成配置后保存。";
  }
  el.workspaceModal.classList.remove("modal-size-wide", "modal-size-xl");
  if (config.size === "wide") {
    el.workspaceModal.classList.add("modal-size-wide");
  } else if (config.size === "xl") {
    el.workspaceModal.classList.add("modal-size-xl");
  }
  enhanceSubworkspaceHosts(config.form);
  buildWorkspaceOutline(config.form);
  el.workspaceModalMain.innerHTML = "";
  el.workspaceModalMain.appendChild(config.form);
  if (config.tip && config.tip.parentElement !== el.workspaceModalMain) {
    el.workspaceModalMain.appendChild(config.tip);
  }
  syncWorkspaceModalFooterActions(config.form);
  el.workspaceModalRoot.classList.remove("hidden");
  el.workspaceModalRoot.setAttribute("aria-hidden", "false");
  syncModalBodyLock();
  requestAnimationFrame(() => {
    el.workspaceModalRoot.classList.add("open");
  });
  const focusNode = el.workspaceModalMain.querySelector("input, select, textarea, button");
  if (focusNode instanceof HTMLElement) {
    focusNode.focus({ preventScroll: true });
  }
  return true;
}

function focusInlineForm(formId, focusId = "") {
  const form = document.getElementById(String(formId || "").trim());
  if (!(form instanceof HTMLFormElement)) return false;

  const panel = form.closest("[data-tab-panel]");
  if (panel instanceof HTMLElement) {
    const tab = String(panel.dataset.tabPanel || "").trim();
    if (TAB_IDS.includes(tab) && state.activeTab !== tab) {
      setActiveTab(tab);
    }
  }

  const deployPanel = form.closest("[data-deploy-view-panel]");
  if (deployPanel instanceof HTMLElement) {
    const view = String(deployPanel.dataset.deployViewPanel || "").trim();
    if (view) setDeployView(view, { writeHash: state.activeTab === "deploy" });
  }

  const lastPulseTimer = focusPulseTimers.get(form);
  if (Number.isFinite(lastPulseTimer)) {
    window.clearTimeout(lastPulseTimer);
  }
  form.classList.remove("form-focus-pulse");
  void form.offsetWidth;
  form.classList.add("form-focus-pulse");
  const pulseTimer = window.setTimeout(() => {
    form.classList.remove("form-focus-pulse");
    focusPulseTimers.delete(form);
  }, 1300);
  focusPulseTimers.set(form, pulseTimer);

  let focusNode = null;
  const preferredId = String(focusId || "").trim();
  if (preferredId) {
    const preferred = document.getElementById(preferredId);
    if (preferred instanceof HTMLElement) focusNode = preferred;
  }
  if (!(focusNode instanceof HTMLElement)) {
    focusNode = form.querySelector("input, select, textarea, button");
  }
  if (focusNode instanceof HTMLElement) {
    focusNode.focus({ preventScroll: true });
    focusNode.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return true;
}

function createPanelActionButton(form, label) {
  const panel = form.closest(".rules-panel");
  if (!panel) return null;
  const targetId = String(form.dataset.modalTriggerTarget || "").trim();
  let row = null;
  if (targetId) {
    const target = document.getElementById(targetId);
    if (target instanceof HTMLElement) {
      row = target;
    }
  }
  if (!row) {
    row = panel.querySelector(".panel-action-row[data-modal-action-row='1']");
    if (!row) {
      row = document.createElement("div");
      row.className = "panel-action-row";
      row.setAttribute("data-modal-action-row", "1");
      const head = panel.querySelector(".chart-head");
      if (head && head.nextSibling) {
        panel.insertBefore(row, head.nextSibling);
      } else if (head) {
        head.insertAdjacentElement("afterend", row);
      } else {
        panel.prepend(row);
      }
    }
  }

  const existed = row.querySelector(`button[data-modal-trigger-for="${form.id}"]`);
  if (existed instanceof HTMLButtonElement) {
    return existed;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary-btn panel-action-btn";
  button.setAttribute("data-open-form-modal", form.id);
  button.setAttribute("data-modal-trigger-for", form.id);
  button.textContent = label;
  row.appendChild(button);
  return button;
}

function initWorkspaceFormModals() {
  if (!el.workspaceModalRoot || !el.workspaceModalMain || !el.workspaceModalClose) return;
  const forms = Array.from(document.querySelectorAll("form[data-ui-modal='true']")).filter((node) => node instanceof HTMLFormElement);
  // Separate page-mode forms (stay inline) from modal-mode forms (moved to stash)
  const pageForms = forms.filter((f) => String(f.dataset.uiModalMode || "").toLowerCase() === "page");
  const modalForms = forms.filter((f) => String(f.dataset.uiModalMode || "").toLowerCase() !== "page");

  // Register page-mode forms so they can be found by formModalRegistry
  pageForms.forEach((form) => {
    if (!(form instanceof HTMLFormElement) || !form.id) return;
    const title = String(form.dataset.modalTitle || "").trim() || "编辑";
    const desc = String(form.dataset.modalDesc || "").trim() || "完成配置后保存。";
    const tipId = String(form.dataset.modalTipId || "").trim();
    const tip = tipId ? document.getElementById(tipId) : null;
    formModalRegistry.set(form.id, {
      form,
      tip: tip instanceof HTMLElement ? tip : null,
      tipParent: tip instanceof HTMLElement ? tip.parentElement : null,
      tipNextSibling: tip instanceof HTMLElement ? tip.nextSibling : null,
      title,
      desc,
      size: String(form.dataset.modalSize || "").trim().toLowerCase(),
      trigger: null,
    });
    // Enhance submodal sections within page-mode forms so they become clickable
    enhanceSubworkspaceHosts(form);
  });

  if (modalForms.length === 0) return;

  formModalStash = document.createElement("div");
  formModalStash.className = "hidden";
  formModalStash.id = "workspace-modal-stash";
  document.body.appendChild(formModalStash);

  modalForms.forEach((form) => {
    if (!(form instanceof HTMLFormElement) || !form.id) return;
    const title = String(form.dataset.modalTitle || "").trim() || "编辑";
    const desc = String(form.dataset.modalDesc || "").trim() || "完成配置后保存。";
    const triggerLabel = String(form.dataset.modalTriggerLabel || "").trim() || "打开编辑器";
    const hideTrigger = String(form.dataset.modalHideTrigger || "").trim().toLowerCase() === "true";
    const size = String(form.dataset.modalSize || "").trim().toLowerCase();
    const tipId = String(form.dataset.modalTipId || "").trim();
    const tip = tipId ? document.getElementById(tipId) : null;
    const tipParent = tip instanceof HTMLElement ? tip.parentElement : null;
    const tipNextSibling = tip instanceof HTMLElement ? tip.nextSibling : null;
    const trigger = hideTrigger ? null : createPanelActionButton(form, triggerLabel);
    formModalRegistry.set(form.id, {
      form,
      tip: tip instanceof HTMLElement ? tip : null,
      tipParent,
      tipNextSibling,
      title,
      desc,
      size,
      trigger,
    });
    formModalStash.appendChild(form);
  });

  document.addEventListener("click", (e) => {
    const element = e.target instanceof Element ? e.target : null;
    if (!element) return;
    const opener = element.closest("[data-open-form-modal]");
    if (opener instanceof HTMLElement) {
      const formId = String(opener.getAttribute("data-open-form-modal") || "").trim();
      if (formId) {
        const opened = openWorkspaceModal(formId, opener);
        if (!opened) {
          focusInlineForm(formId);
        }
      }
      return;
    }
    if (element.closest("[data-workspace-modal-close]")) {
      closeWorkspaceModal();
    }
  });

  if (el.workspaceModalClose) el.workspaceModalClose.addEventListener("click", () => closeWorkspaceModal());
  if (el.workspaceModalSubmit) {
    el.workspaceModalSubmit.addEventListener("click", () => {
      const currentId = String(state.modal.currentFormId || "");
      const config = formModalRegistry.get(currentId);
      const form = config?.form;
      if (!(form instanceof HTMLFormElement)) return;
      const submitter = getWorkspacePrimarySubmitControl(form);
      if (!submitter) {
        closeWorkspaceModal();
        return;
      }
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit(submitter);
      } else if (submitter instanceof HTMLElement) {
        submitter.click();
      }
    });
  }
  if (el.subworkspaceModalClose) {
    el.subworkspaceModalClose.addEventListener("click", () => closeSubworkspaceModal());
  }
  if (el.subworkspaceModalRoot) {
    el.subworkspaceModalRoot.addEventListener("click", (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element) return;
      if (element.closest("[data-subworkspace-modal-close]")) {
        closeSubworkspaceModal();
      }
    });
  }
}

function closeActionModal(result, { restoreFocus = true } = {}) {
  const resolver = state.modal.actionResolver;
  state.modal.actionResolver = null;
  if (el.actionModalRoot) {
    el.actionModalRoot.classList.add("hidden");
    el.actionModalRoot.setAttribute("aria-hidden", "true");
  }
  syncModalBodyLock();
  if (restoreFocus && state.modal.currentTrigger instanceof HTMLElement) {
    state.modal.currentTrigger.focus();
  }
  state.modal.currentTrigger = null;
  if (typeof resolver === "function") {
    resolver(result);
  }
}

function openActionModal({
  title = "确认操作",
  text = "请确认是否继续。",
  confirmText = "确认",
  cancelText = "取消",
  danger = false,
  input = null,
} = {}) {
  if (!el.actionModalRoot || !el.actionModalTitle || !el.actionModalText || !el.actionModalConfirm || !el.actionModalCancel) {
    if (input && input.enabled) {
      const entered = window.prompt(text, input.initialValue || "");
      if (entered === null) return Promise.resolve({ confirmed: false, value: "" });
      return Promise.resolve({ confirmed: true, value: String(entered) });
    }
    return Promise.resolve({ confirmed: window.confirm(text), value: "" });
  }

  if (state.modal.actionResolver) {
    closeActionModal({ confirmed: false, value: "" }, { restoreFocus: false });
  }

  el.actionModalTitle.textContent = title;
  el.actionModalText.textContent = text;
  el.actionModalConfirm.textContent = confirmText;
  el.actionModalCancel.textContent = cancelText;
  el.actionModalConfirm.classList.toggle("danger-btn", Boolean(danger));
  if (el.actionModalTip) {
    el.actionModalTip.textContent = "";
    el.actionModalTip.style.color = "";
  }

  const hasInput = Boolean(input && input.enabled);
  if (el.actionModalInputWrap) {
    el.actionModalInputWrap.classList.toggle("hidden", !hasInput);
  }
  if (el.actionModalInput && hasInput) {
    el.actionModalInput.type = String(input.type || "text");
    el.actionModalInput.maxLength = Number(input.maxLength || 256);
    el.actionModalInput.placeholder = String(input.placeholder || "");
    el.actionModalInput.value = String(input.initialValue || "");
  }
  if (el.actionModalInputLabel) {
    el.actionModalInputLabel.textContent = hasInput ? String(input.label || "输入内容") : "";
  }

  el.actionModalRoot.classList.remove("hidden");
  el.actionModalRoot.setAttribute("aria-hidden", "false");
  syncModalBodyLock();
  state.modal.currentTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  return new Promise((resolve) => {
    state.modal.actionResolver = resolve;
    const validator = hasInput && typeof input.validate === "function" ? input.validate : null;

    const onCancel = () => closeActionModal({ confirmed: false, value: "" });
    const onConfirm = () => {
      const value = hasInput && el.actionModalInput ? String(el.actionModalInput.value || "") : "";
      if (validator) {
        const msg = String(validator(value) || "").trim();
        if (msg) {
          if (el.actionModalTip) {
            el.actionModalTip.textContent = msg;
            el.actionModalTip.style.color = "#d12f3f";
          }
          return;
        }
      }
      closeActionModal({ confirmed: true, value });
    };

    const onBackdrop = (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element) return;
      if (element.closest("[data-action-modal-close]")) {
        onCancel();
      }
    };

    const cleanup = () => {
      el.actionModalCancel?.removeEventListener("click", onCancel);
      el.actionModalConfirm?.removeEventListener("click", onConfirm);
      el.actionModalRoot?.removeEventListener("click", onBackdrop);
      if (state.modal.actionResolver !== resolve) return;
      state.modal.actionResolver = null;
    };

    const wrappedResolve = (result) => {
      cleanup();
      resolve(result);
    };
    state.modal.actionResolver = wrappedResolve;

    el.actionModalCancel?.addEventListener("click", onCancel);
    el.actionModalConfirm?.addEventListener("click", onConfirm);
    el.actionModalRoot?.addEventListener("click", onBackdrop);

    if (hasInput && el.actionModalInput) {
      el.actionModalInput.focus({ preventScroll: true });
      el.actionModalInput.select();
    } else {
      el.actionModalConfirm.focus({ preventScroll: true });
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (state.modal.actionResolver) {
    closeActionModal({ confirmed: false, value: "" });
    return;
  }
  if (state.modal.subworkspaceHost) {
    closeSubworkspaceModal();
    return;
  }
  if (state.modal.currentFormId) {
    closeWorkspaceModal();
  }
});

function fmtNumber(num, digits = 4) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return "--";
  return Number(num).toFixed(digits);
}

function toNumberLoose(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const text = String(value).trim().replace(/,/g, "");
  if (!text) return NaN;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function roundTo(num, digits = 2) {
  const value = toNumberLoose(num);
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function asBiasClass(bias) {
  if (bias === "bullish") return "bullish";
  if (bias === "bearish") return "bearish";
  return "neutral";
}

function lineColor(name) {
  if (name === "ma5") return "#a07d35";
  if (name === "ma20") return "#7a5a8a";
  if (name === "ma60") return "#3a7a9a";
  return "#9097a3";
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function normalizeZoom(start, end) {
  let s = Number(start);
  let e = Number(end);
  if (!Number.isFinite(s) || !Number.isFinite(e)) {
    return { start: 72, end: 100 };
  }
  s = clamp(s, 0, 100);
  e = clamp(e, 0, 100);
  if (e <= s) {
    return { start: 72, end: 100 };
  }
  if (e - s < 2) {
    const center = (s + e) / 2;
    s = clamp(center - 1, 0, 99);
    e = clamp(center + 1, 1, 100);
  }
  return { start: s, end: e };
}





function labelSymbol(symbol) {
  return SYMBOL_LABEL[symbol] || symbol;
}

function labelSource(sourceName) {
  if (!sourceName) return "未命名数据源";
  const normalized = String(sourceName).replace(" (cached_fallback)", "");
  const fallbackTag = String(sourceName).includes("cached_fallback") ? "（缓存兜底）" : "";
  if (SOURCE_LABEL[normalized]) return `${SOURCE_LABEL[normalized]}${fallbackTag}`;
  if (SOURCE_LABEL[sourceName]) return SOURCE_LABEL[sourceName];
  return normalized
    .split(":")
    .map((section) =>
      section
        .split("+")
        .map((part) => SOURCE_LABEL[part] || part)
        .join(" + "),
    )
    .join("：")
    .concat(fallbackTag);
}

function setRefreshStatus(text, isError = false) {
  if (!el.refreshStatus) return;
  el.refreshStatus.textContent = text;
  el.refreshStatus.style.color = isError ? "#d12f3f" : "";
}

function setRuleTip(text, isError = false) {
  if (!el.ruleTip) return;
  el.ruleTip.textContent = text;
  el.ruleTip.style.color = isError ? "#d12f3f" : "";
}

function setWecomTip(text, isError = false) {
  if (!el.wecomSettingsTip) return;
  el.wecomSettingsTip.textContent = text;
  el.wecomSettingsTip.style.color = isError ? "#d12f3f" : "";
}
































































async function fetchJson(url, options = undefined) {
  const requestOptions = options && typeof options === "object" ? { ...options } : {};
  const timeoutMsRaw = Number(requestOptions.timeoutMs);
  const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? Math.round(timeoutMsRaw) : 0;
  delete requestOptions.timeoutMs;

  const hasAbortController = typeof AbortController !== "undefined";
  const hasAbortSignal = typeof AbortSignal !== "undefined";
  const controller = hasAbortController ? new AbortController() : null;
  const existingSignal = requestOptions.signal;
  const hasExternalSignal = hasAbortSignal && existingSignal instanceof AbortSignal;
  const canInjectSignal = controller && !hasExternalSignal;
  if (canInjectSignal) {
    requestOptions.signal = controller.signal;
  }

  let timeoutTimer = null;
  if (canInjectSignal && timeoutMs > 0) {
    timeoutTimer = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  let res;
  try {
    if (!requestOptions.credentials) requestOptions.credentials = "include";
    res = await fetch(url, requestOptions);
  } catch (err) {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
    }
    const aborted = err && typeof err === "object" && String(err.name || "") === "AbortError";
    if (aborted && timeoutMs > 0) {
      throw new Error(`HTTP timeout for ${url} after ${timeoutMs}ms`);
    }
    throw err;
  }
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
  }
  if (!res.ok) {
    let detail = "";
    let payload = null;
    try {
      payload = await res.json();
      detail = String(payload?.error || payload?.message || "").trim();
    } catch (_err) {
      detail = "";
    }
    if (res.status === 401) {
      setRefreshStatus("未通过认证，请重新登录后刷新。", true);
      if (!authRedirecting) {
        authRedirecting = true;
        window.location.replace("/login?reason=expired");
      }
    }
    if (detail) {
      throw new Error(`HTTP ${res.status} for ${url}: ${detail}`);
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

function normalizeDeployView(view) {
  const next = String(view || "").trim().toLowerCase();
  return DEPLOY_VIEW_IDS.includes(next) ? next : "settings";
}

function normalizeWorkspace(workspace) {
  const next = String(workspace || "").trim().toLowerCase();
  return WORKSPACE_IDS.includes(next) ? next : "market";
}

function workspaceForTab(tab) {
  const target = String(tab || "").trim().toLowerCase();
  for (const workspace of WORKSPACE_IDS) {
    const tabs = WORKSPACE_TAB_MAP[workspace] || [];
    if (tabs.includes(target)) return workspace;
  }
  return "market";
}

function preferredTabForWorkspace(workspace) {
  const normalized = normalizeWorkspace(workspace);
  const tabs = WORKSPACE_TAB_MAP[normalized] || WORKSPACE_TAB_MAP.market;
  const remembered = String(state.workspaceLastTab?.[normalized] || "");
  if (tabs.includes(remembered)) return remembered;
  return tabs[0] || "dashboard";
}

function setActiveWorkspace(workspace, { autoSelect = true, writeHash = true } = {}) {
  const next = normalizeWorkspace(workspace);
  state.activeWorkspace = next;

  for (const button of el.workspaceLinks || []) {
    const active = String(button.dataset.workspaceLink || "") === next;
    button.classList.toggle("active", active);
  }

  for (const link of el.tabLinks || []) {
    const tabId = String(link.dataset.tabLink || "").trim();
    const owner = normalizeWorkspace(link.dataset.workspace || workspaceForTab(tabId));
    const visible = owner === next;
    link.classList.toggle("workspace-hidden", !visible);
  }

  const tabs = WORKSPACE_TAB_MAP[next] || [];
  if (tabs.includes(state.activeTab)) {
    state.workspaceLastTab[next] = state.activeTab;
    return;
  }
  if (autoSelect) {
    const preferred = preferredTabForWorkspace(next);
    setActiveTab(preferred, { writeHash });
  }
}

function parseHashRoute() {
  const rawHash = String(window.location.hash || "").replace(/^#/, "").trim();
  if (!rawHash) {
    return { tab: "dashboard", deployView: normalizeDeployView(state.deployView) };
  }
  const [rawTab = "", rawQuery = ""] = rawHash.split("?");
  const normalizedTab = rawTab.toLowerCase() === "insight" ? "insight-policy" : rawTab.toLowerCase();
  if (!TAB_IDS.includes(normalizedTab)) {
    return { tab: "dashboard", deployView: normalizeDeployView(state.deployView) };
  }
  if (normalizedTab !== "deploy") {
    return { tab: normalizedTab, deployView: normalizeDeployView(state.deployView) };
  }
  const params = new URLSearchParams(rawQuery || "");
  return { tab: "deploy", deployView: normalizeDeployView(params.get("view")) };
}

function formatHashRoute(tab, deployView = state.deployView) {
  const nextTab = TAB_IDS.includes(tab) ? tab : "dashboard";
  if (nextTab === "deploy") {
    return `#deploy?view=${normalizeDeployView(deployView)}`;
  }
  return `#${nextTab}`;
}

function bindDashboardJumpNav() {
  const links = Array.from(document.querySelectorAll("[data-dashboard-jump]"));
  if (links.length === 0) return;

  for (const link of links) {
    if (!(link instanceof HTMLElement)) continue;
    link.addEventListener("click", () => {
      const targetId = String(link.dataset.dashboardJump || "").trim();
      if (!targetId) return;
      const scrollToTarget = () => {
        const target = document.getElementById(targetId);
        if (!(target instanceof HTMLElement)) return;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      };

      if (state.activeTab !== "dashboard") {
        setActiveTab("dashboard");
        requestAnimationFrame(() => requestAnimationFrame(scrollToTarget));
      } else {
        scrollToTarget();
      }
    });
  }
}






function setDeployView(view, { writeHash = true } = {}) {
  const next = normalizeDeployView(view);
  state.deployView = next;
  for (const button of el.deployViewLinks || []) {
    const active = String(button.dataset.deployViewLink || "") === next;
    button.classList.toggle("active", active);
  }
  for (const panel of el.deployViewPanels || []) {
    const visible = String(panel.dataset.deployViewPanel || "") === next;
    panel.classList.toggle("hidden", !visible);
  }
  if (writeHash && state.activeTab === "deploy") {
    const nextHash = formatHashRoute("deploy", next);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }
  renderWorkspaceGuide(state.activeTab);
  renderWorkspaceResponsibility(state.activeTab);
}

function getDeployGuideConfig() {
  const view = String(state.deployView || "settings");
  if (view === "accounts") {
    return {
      title: "部署配置 · 账号与权限",
      desc: "管理邀请码、用户和密码。",
      steps: [
        { title: "1. 邀请码", detail: "生成邀请码发给新成员完成注册。" },
        { title: "2. 用户权限", detail: "在用户管理中启停账号、设管理员、重置密码。" },
        { title: "3. 个人安全", detail: "定期修改当前账号密码，降低泄露风险。" },
      ],
      actions: [
        { label: "生成邀请码", action: "open-form", formId: "invite-create-form", focusId: "invite-max-uses", primary: true },
        { label: "用户管理", action: "open-form", formId: "user-manage-form", focusId: "user-list", primary: true },
        { label: "修改我的密码", action: "open-form", formId: "change-password-form", focusId: "current-password", primary: false },
      ],
    };
  }
  if (view === "observability") {
    return {
      title: "部署配置 · 状态与审计",
      desc: "查看数据源状态和登录审计。",
      steps: [
        { title: "1. 数据源状态", detail: "确认主备源是否为实时更新、非实时更新或缓存兜底。" },
        { title: "2. 登录审计", detail: "查看近期登录成功/失败与来源信息。" },
        { title: "3. 问题修复", detail: "发现异常后切回设置中心调整参数。" },
      ],
      actions: [
        { label: "打开登录审计", action: "open-form", formId: "login-audit-form", focusId: "refresh-login-audit", primary: true },
        { label: "切到设置中心", action: "deploy-view", view: "settings", primary: false },
      ],
    };
  }
  return {
    title: "部署配置 · 设置中心",
    desc: "维护运行参数、认证与 SMTP。",
    steps: [
      { title: "1. 编辑部署配置", detail: "统一修改轮询、认证、会话与SMTP参数。" },
      { title: "2. 保存并验证", detail: "保存后在状态与审计中核对效果。" },
      { title: "3. 账号权限", detail: "如需新成员登录，切到账号与权限发邀请码。" },
    ],
    actions: [
      { label: "编辑部署配置", action: "open-form", formId: "deploy-settings-form", focusId: "cfg-interval", primary: true },
      { label: "切到账号与权限", action: "deploy-view", view: "accounts", primary: false },
      { label: "切到状态与审计", action: "deploy-view", view: "observability", primary: false },
    ],
  };
}

function getWorkspaceGuideConfig(tab) {
  const next = TAB_IDS.includes(tab) ? tab : "dashboard";
  if (next === "rules") {
    return {
      title: "规则与告警",
      desc: "新建规则并查看告警记录。",
      steps: [
        { title: "1. 新建规则", detail: "设置标的、阈值和组合逻辑。" },
        { title: "2. 调整过滤", detail: "按需启用冷却、防抖、趋势和新鲜度过滤。" },
        { title: "3. 看告警", detail: "在“最近告警事件”确认触发与恢复是否符合预期。" },
      ],
      actions: [
        { label: "新建规则", action: "open-form", formId: "rule-form", focusId: "rule-symbol", primary: true },
        { label: "去策略实验室", action: "tab", tab: "lab", primary: false },
      ],
    };
  }
  if (next === "lab") {
    return {
      title: "策略实验室",
      desc: "回测单规则或分组对比。",
      steps: [
        { title: "1. 单规则回测", detail: "选规则+区间运行回放，查看资金曲线。" },
        { title: "2. 分组对比", detail: "多选规则统一回放，比较收益与回撤。" },
        { title: "3. 核对明细", detail: "在逐笔明细里检查触发价与前瞻收益。" },
      ],
      actions: [
        { label: "运行单规则回测", action: "open-form", formId: "backtest-form", focusId: "backtest-rule-id", primary: true },
        { label: "规则分组对比", action: "open-form", formId: "backtest-compare-form", focusId: "backtest-compare-rule-ids", primary: true },
      ],
    };
  }
  if (next === "yfinance") {
    return {
      title: "YFinance 看板",
      desc: "输入代码后查看行情、图表和新闻。",
      steps: [
        { title: "1. 输入代码", detail: "支持股票、指数、期货代码，例如 AAPL、^GSPC、GC=F。" },
        { title: "2. 选择周期粒度", detail: "周期决定回看长度，粒度决定 K 线密度。" },
        { title: "3. 读取结果", detail: "优先看最新价/涨跌，再核对图表和新闻线索。" },
      ],
      actions: [
        { label: "加载行情", action: "click", targetId: "yfinance-load", primary: true },
        { label: "回到总览看板", action: "tab", tab: "dashboard", primary: false },
      ],
    };
  }
  if (next === "wecom") {
    return {
      title: "通知配置",
      desc: "编辑配置并测试推送。",
      steps: [
        { title: "1. 编辑配置", detail: "填写Webhook、样式与通知开关。" },
        { title: "2. 发送测试", detail: "保存后立即做一次测试推送。" },
        { title: "3. 预览核对", detail: "在消息预览中检查标题与字段格式。" },
      ],
      actions: [
        { label: "编辑微信配置", action: "open-form", formId: "wecom-settings-form", focusId: "cfg-webhook", primary: true },
        { label: "发送测试推送", action: "open-form", formId: "wecom-settings-form", focusId: "btn-test-notify", primary: true },
        { label: "去AI策略页", action: "tab", tab: "insight-policy", primary: false },
      ],
    };
  }
  if (next === "insight-policy") {
    return {
      title: "AI策略配置",
      desc: "维护策略并查看事件详情。",
      steps: [
        { title: "1. 编辑AI策略", detail: "配置阈值、信源模式和策略模板。" },
        { title: "2. 立即AI分析", detail: "按当前监控标的触发一次归因任务。" },
        { title: "3. 看事件详情", detail: "核对结论、证据层级和相关性标签。" },
      ],
      actions: [
        { label: "编辑AI策略", action: "open-form", formId: "insight-policy-form", focusId: "insight-enabled", primary: true },
        { label: "立即AI分析", action: "click", targetId: "insight-manual-trigger-btn", primary: true },
        { label: "去AI对话页", action: "tab", tab: "insight-chat", primary: false },
      ],
    };
  }
  if (next === "insight-ai") {
    return {
      title: "AI服务配置",
      desc: "维护 AI 连接并做连通性测试。",
      steps: [
        { title: "1. 编辑调用配置", detail: "填写AI Base URL、模型和API Key。" },
        { title: "2. 检测与测试", detail: "先检测模型，再测试AI Key可用性。" },
        { title: "3. 去AI对话页", detail: "在独立对话页直接验证“带行情上下文”的问答效果。" },
      ],
      actions: [
        { label: "编辑AI调用", action: "open-form", formId: "insight-provider-form", focusId: "insight-ai-base-url", primary: true },
        { label: "打开模型检测", action: "open-form", formId: "insight-provider-form", focusId: "insight-detect-models", primary: true },
        { label: "去AI对话页", action: "tab", tab: "insight-chat", primary: false },
      ],
    };
  }
  if (next === "insight-chat") {
    return {
      title: "AI助手",
      desc: "基于当前上下文发起多轮对话。",
      steps: [
        { title: "1. 打开对话页", detail: "直接提问黄金走势、新闻影响或策略判断。" },
        { title: "2. 快捷键发送", detail: "Enter 换行，⌘+Enter（或 Ctrl+Enter）发送。" },
        { title: "3. 看上下文", detail: "回复后可查看本次使用的上下文。" },
      ],
      actions: [
        { label: "开始新对话", action: "click", targetId: "insight-assistant-clear", primary: true },
        { label: "去AI调用配置", action: "tab", tab: "insight-ai", primary: false },
        { label: "去AI策略页", action: "tab", tab: "insight-policy", primary: false },
      ],
    };
  }
  if (next === "deploy") {
    return getDeployGuideConfig();
  }
  return {
    title: "总览看板",
    desc: "刷新行情、触发分析并查看事件详情。",
    steps: [
      { title: "1. 看行情", detail: "切历史区间、图表布局并核对K线时间范围。" },
      { title: "2. 触发AI分析", detail: "点击开始AI分析，不必等自动阈值触发。" },
      { title: "3. 看联动事件", detail: "点击图中AI标记，右下角查看详细解释链路。" },
    ],
    actions: [
      { label: "立即刷新行情", action: "click", targetId: "btn-refresh-now", primary: false },
      { label: "开始AI分析", action: "click", targetId: "btn-insight-trigger", primary: true },
      { label: "去规则告警", action: "tab", tab: "rules", primary: false },
    ],
  };
}

function getWorkspaceResponsibilityConfig(tab) {
  const next = TAB_IDS.includes(tab) ? tab : "dashboard";
  if (next === "rules") {
    return {
      module: "策略中心",
      page: "RuleManagementPage",
      container: "Full Page",
      permission: "权限：规则查看/编辑",
      exit: "退出：可跳转策略实验室或返回监控看板",
      mustDo: ["维护阈值与组合条件", "启停规则并核对触发/恢复记录", "保证规则参数可追踪"],
      mustNot: ["不直接承担回测对比流程", "不在此页修改AI网关配置", "不承载系统级部署配置"],
    };
  }
  if (next === "lab") {
    return {
      module: "策略中心",
      page: "StrategyLabPage",
      container: "Full Page",
      permission: "权限：策略实验与结果查看",
      exit: "退出：回规则页调整后可再次回测",
      mustDo: ["执行单规则回测", "执行分组对比并排序", "查看逐笔明细与资金曲线"],
      mustNot: ["不直接改告警规则定义", "不配置AI新闻与模型", "不管理账号权限"],
    };
  }
  if (next === "yfinance") {
    return {
      module: "监控中心",
      page: "YFinanceBoardPage",
      container: "Full Page",
      permission: "权限：行情查看",
      exit: "退出：可返回总览看板或策略实验室",
      mustDo: ["按代码读取 Yahoo Finance 数据", "展示价格概览 + 图表 + 新闻", "错误时给出可读提示"],
      mustNot: ["不覆盖现有金价采集链路", "不在本页修改系统配置", "不在本页管理用户权限"],
    };
  }
  if (next === "wecom") {
    return {
      module: "通知中心",
      page: "WeComSettingsPage",
      container: "Modal + Full Page",
      permission: "权限：通知通道配置",
      exit: "退出：保存后可在本页测试推送",
      mustDo: ["维护Webhook与通知开关", "发送测试消息校验通道", "预览消息样式"],
      mustNot: ["不承担策略触发逻辑", "不处理用户权限管理", "不承载复杂多步骤业务流程"],
    };
  }
  if (next === "insight-policy") {
    return {
      module: "AI归因中心",
      page: "InsightPolicyPage",
      container: "Full Page",
      permission: "权限：AI策略配置与事件查看",
      exit: "退出：可跳转AI调用/AI对话页或返回看板联动",
      mustDo: ["维护AI触发策略与信源白名单", "手动触发分析并查看事件详情", "核对证据分层与结论"],
      mustNot: ["不在本页修改基础部署参数", "不承载账号权限操作", "不在弹窗里塞完整策略流程"],
    };
  }
  if (next === "insight-ai") {
    return {
      module: "AI归因中心",
      page: "InsightProviderPage",
      container: "Full Page",
      permission: "权限：AI网关配置",
      exit: "退出：测试通过后前往AI对话页验证，再回AI策略页执行",
      mustDo: ["维护AI Base URL/模型/API Key", "执行模型检测与Key测试", "输出可读错误提示"],
      mustNot: ["不承担策略阈值配置", "不承担回测分析", "不承担系统账号管理"],
    };
  }
  if (next === "insight-chat") {
    return {
      module: "AI归因中心",
      page: "InsightChatPage",
      container: "Full Page",
      permission: "权限：AI对话与分析解释",
      exit: "退出：可返回AI策略页触发事件，或去AI调用页调整网关",
      mustDo: ["提问并验证模型响应", "确认回复使用系统采集行情上下文", "查看回复提示中的上下文摘要"],
      mustNot: ["不在本页编辑网关密钥", "不在本页改触发阈值", "不承担部署与账号管理"],
    };
  }
  if (next === "deploy") {
    const view = String(state.deployView || "settings");
    if (view === "accounts") {
      return {
        module: "系统中心",
        page: "UserPermissionPage",
        container: "Modal + Full Page",
        permission: "权限：管理员",
        exit: "退出：可返回设置中心/状态审计",
        mustDo: ["管理邀请码与用户状态", "执行管理员授权与密码重置", "保证最少管理员可用"],
        mustNot: ["不承载行情分析流程", "不承载AI策略逻辑", "不在此页调图表布局"],
      };
    }
    if (view === "observability") {
      return {
        module: "系统中心",
        page: "ObservabilityPage",
        container: "Full Page",
        permission: "权限：管理员",
        exit: "退出：发现异常后返回设置中心修复",
        mustDo: ["查看数据源状态与健康", "查看登录审计记录", "输出故障定位线索"],
        mustNot: ["不承载部署参数编辑流程", "不承担业务规则修改", "不执行批量用户创建流程"],
      };
    }
    return {
      module: "系统中心",
      page: "DeploySettingsPage",
      container: "Full Page",
      permission: "权限：管理员",
      exit: "退出：保存后可转状态审计核验",
      mustDo: ["维护部署/认证/SMTP参数", "保存并提示重启要求", "保证配置项可回滚"],
      mustNot: ["不承担用户日常监控操作", "不承载策略回测流程", "不把复杂配置流程放入确认弹窗"],
    };
  }
  return {
    module: "监控中心",
    page: "MarketDashboardPage",
    container: "Full Page",
    permission: "权限：行情查看",
    exit: "退出：可跳规则告警、AI策略、系统配置",
    mustDo: ["展示实时行情与K线联动", "提供手动AI分析入口并展示反馈", "支持事件标记点击查看归因"],
    mustNot: ["不直接承担规则编辑流程", "不承载复杂部署参数编辑", "不在此页执行账号权限改动"],
  };
}

function renderResponsibilityList(target, items) {
  if (!(target instanceof HTMLElement)) return;
  const list = Array.isArray(items) ? items : [];
  target.innerHTML = list.map((item) => `<li>${escapeHtml(String(item || ""))}</li>`).join("");
}

function renderWorkspaceResponsibility(tab = state.activeTab) {
  if (
    !el.workspaceRespTitle ||
    !el.workspaceRespBreadcrumb ||
    !el.workspaceRespContainer ||
    !el.workspaceRespMustDo ||
    !el.workspaceRespMustNot ||
    !el.workspaceRespPermission ||
    !el.workspaceRespExit
  ) {
    return;
  }
  const cfg = getWorkspaceResponsibilityConfig(tab);
  el.workspaceRespTitle.textContent = cfg.page;
  el.workspaceRespBreadcrumb.textContent = `${cfg.module} / ${cfg.page}`;
  el.workspaceRespContainer.textContent = cfg.container;
  el.workspaceRespPermission.textContent = cfg.permission;
  el.workspaceRespExit.textContent = cfg.exit;
  renderResponsibilityList(el.workspaceRespMustDo, cfg.mustDo);
  renderResponsibilityList(el.workspaceRespMustNot, cfg.mustNot);
}

function executeGuideAction(action) {
  if (!action || typeof action !== "object") return;
  const type = String(action.action || "").trim();
  if (type === "open-form") {
    const formId = String(action.formId || "").trim();
    if (!formId) return;
    const focusId = String(action.focusId || "").trim();
    const opened = openWorkspaceModal(formId, null);
    if (!opened) {
      focusInlineForm(formId, focusId);
      return;
    }
    if (focusId) {
      requestAnimationFrame(() => {
        const focusNode = document.getElementById(focusId);
        if (!(focusNode instanceof HTMLElement)) return;
        if (typeof focusNode.focus === "function") {
          focusNode.focus({ preventScroll: true });
        }
        if (typeof focusNode.scrollIntoView === "function") {
          focusNode.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }
    return;
  }
  if (type === "click") {
    const targetId = String(action.targetId || "").trim();
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (target instanceof HTMLElement) {
      target.click();
    }
    return;
  }
  if (type === "tab") {
    const targetTab = String(action.tab || "").trim();
    if (!TAB_IDS.includes(targetTab)) return;
    setActiveTab(targetTab);
    return;
  }
  if (type === "deploy-view") {
    const view = String(action.view || "").trim();
    setActiveTab("deploy");
    setDeployView(view);
  }
}

function renderWorkspaceGuide(tab = state.activeTab) {
  if (!el.workspaceGuideTitle || !el.workspaceGuideDesc || !el.workspaceGuideSteps || !el.workspaceGuideActions) return;
  const config = getWorkspaceGuideConfig(tab);
  el.workspaceGuideTitle.textContent = String(config.title || "当前页面");
  el.workspaceGuideDesc.textContent = String(config.desc || "");

  const steps = Array.isArray(config.steps) ? config.steps : [];
  el.workspaceGuideSteps.innerHTML = steps
    .map((item) => {
      const title = escapeHtml(String(item?.title || ""));
      const detail = escapeHtml(String(item?.detail || ""));
      return `<article class="workspace-guide-step"><strong>${title}</strong><p>${detail}</p></article>`;
    })
    .join("");

  el.workspaceGuideActions.innerHTML = "";
  const actions = Array.isArray(config.actions) ? config.actions : [];
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(action?.label || "执行");
    if (!action?.primary) {
      button.className = "secondary-btn";
    }
    button.addEventListener("click", () => executeGuideAction(action));
    el.workspaceGuideActions.appendChild(button);
  }
}

function setActiveTab(tab, { writeHash = true } = {}) {
  const next = TAB_IDS.includes(tab) ? tab : "dashboard";
  state.activeTab = next;
  const workspace = workspaceForTab(next);
  state.workspaceLastTab[workspace] = next;
  setActiveWorkspace(workspace, { autoSelect: false, writeHash: false });
  el.tabLinks.forEach((node) => {
    const isActive = String(node.dataset.tabLink) === next;
    node.classList.toggle("active", isActive);
  });
  el.tabPanels.forEach((node) => {
    const match = String(node.dataset.tabPanel) === next;
    node.classList.toggle("hidden", !match);
  });
  if (writeHash) {
    const nextHash = formatHashRoute(next, state.deployView);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }
  if (next === "dashboard") {
    (GM.repaintDashboardCharts ? GM.repaintDashboardCharts() : null);
    (GM.repaintAuxCharts ? GM.repaintAuxCharts() : null);
  } else if (next === "lab") {
    (GM.repaintAuxCharts ? GM.repaintAuxCharts() : null);
  } else if (next === "yfinance") {
    (GM.repaintAuxCharts ? GM.repaintAuxCharts() : null);
    void (GM.refreshYFinance ? GM.refreshYFinance({ silent: true }) : Promise.resolve());
  } else if (next === "deploy") {
    setDeployView(state.deployView || "settings", { writeHash: false });
  } else if (next === "insight-chat") {
    void loadInsightAssistantHistory({ silent: true });
  }
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
  });
  renderWorkspaceGuide(next);
  renderWorkspaceResponsibility(next);
}

function initTabRouting() {
  const firstRoute = parseHashRoute();
  const canonicalHash = formatHashRoute(firstRoute.tab, firstRoute.deployView);
  if (window.location.hash !== canonicalHash) {
    history.replaceState(null, "", canonicalHash);
  }
  setActiveTab(firstRoute.tab, { writeHash: false });
  if (firstRoute.tab === "deploy") {
    setDeployView(firstRoute.deployView, { writeHash: false });
  }
  window.addEventListener("hashchange", () => {
    const route = parseHashRoute();
    setActiveTab(route.tab, { writeHash: false });
    if (route.tab === "deploy") {
      setDeployView(route.deployView, { writeHash: false });
    }
  });
}


function formatAge(ageSec) {
  const age = Number(ageSec);
  if (!Number.isFinite(age) || age < 0) return "--";
  return `${Math.round(age)}s`;
}

function formatLocalTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function freshnessText(status) {
  return FRESHNESS_LABEL[String(status || "").toLowerCase()] || "非实时更新";
}

function freshnessClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "live") return "live";
  if (normalized === "cached") return "cached";
  return "delayed";
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHref(url) {
  const text = String(url || "").trim();
  if (/^https?:\/\//i.test(text)) return text;
  return "#";
}

function normalizeRuleClauses(rule) {
  const clauses = Array.isArray(rule?.clauses) ? rule.clauses : [];
  if (clauses.length > 0) return clauses;
  const fallback = [{ type: "price", condition: rule?.condition, threshold: rule?.threshold }];
  const indicator = String(rule?.indicator_filter || "any").toLowerCase();
  const indicatorMap = {
    bullish_only: "bullish",
    bearish_only: "bearish",
    neutral_only: "neutral",
  };
  if (indicatorMap[indicator]) {
    fallback.push({ type: "indicator_bias", bias: indicatorMap[indicator] });
  }
  return fallback;
}

function axisTimeKey(value, timeframe = "1d") {
  const text = String(value || "");
  if (!text) return "";
  const tf = String(timeframe || "1d").toLowerCase();
  if (tf === "1d") return text.slice(0, 10);
  return text.slice(0, 16).replace("T", " ");
}

function closeByTimeKeyMap(bars, timeframe = "1d") {
  const map = new Map();
  for (const row of bars || []) {
    map.set(axisTimeKey(row?.ts, timeframe), Number(row?.close));
  }
  return map;
}

function eventsForSymbol(symbol) {
  const target = String(symbol || "").toUpperCase();
  return (state.overlayEvents || []).filter((item) => String(item?.symbol || "").toUpperCase() === target);
}

function axisIntervalBySize(size, desiredLabels = 8) {
  if (!Number.isFinite(size) || size <= 0) return 0;
  return Math.max(0, Math.ceil(size / desiredLabels) - 1);
}

function roundedSeries(series, digits = 2) {
  return (series || []).map((item) => (item === null || item === undefined ? null : roundTo(item, digits)));
}

function buildCandlesPayload(bars) {
  const x = [];
  const candle = [];
  const timeframe = String(state.timeframe || "1d").toLowerCase();
  for (const row of bars || []) {
    x.push(axisTimeKey(row?.ts, timeframe));
    candle.push([roundTo(row?.open, 2), roundTo(row?.close, 2), roundTo(row?.low, 2), roundTo(row?.high, 2)]);
  }
  return { x, candle };
}

function sanitizeBars(rows, timeframe = "1d") {
  const source = Array.isArray(rows) ? rows : [];
  const normalized = source
    .map((row) => {
      if (!row || !row.ts) return null;
      const open = toNumberLoose(row.open);
      const high = toNumberLoose(row.high);
      const low = toNumberLoose(row.low);
      const close = toNumberLoose(row.close);
      if (
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close) ||
        open <= 0 ||
        high <= 0 ||
        low <= 0 ||
        close <= 0
      ) {
        return null;
      }
      return { ...row, open, high, low, close };
    })
    .filter(Boolean);
  normalized.sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
  const byBucket = new Map();
  const tf = String(timeframe || "1d").toLowerCase();
  for (const row of normalized) {
    const key = axisTimeKey(row.ts, tf);
    if (!key) continue;
    byBucket.set(key, row);
  }
  return Array.from(byBucket.values());
}

function ensureBarsFromLatest(bars, latestPrice, symbol, timeframe = "1d") {
  const cleaned = Array.isArray(bars) ? bars : [];
  if (cleaned.length > 0) return cleaned;
  const fallbackPrice = toNumberLoose(latestPrice);
  if (!Number.isFinite(fallbackPrice) || fallbackPrice <= 0) return [];
  const now = new Date();
  const ts = now.toISOString().replace(/\.\d{3}Z$/, "+00:00");
  return [
    {
      symbol: String(symbol || ""),
      market: "",
      timeframe: String(timeframe || "1d").toLowerCase(),
      ts,
      open: fallbackPrice,
      high: fallbackPrice,
      low: fallbackPrice,
      close: fallbackPrice,
      volume: null,
      source: "latest_fallback",
    },
  ];
}

function renderInsightDetailEmptyFallback(text = "选择事件后查看详情。", targetEl = null) {
  const fallbackTarget =
    targetEl instanceof HTMLElement
      ? targetEl
      : (el.dashboardInsightDetail instanceof HTMLElement ? el.dashboardInsightDetail : null) ||
        (el.insightEventDetail instanceof HTMLElement ? el.insightEventDetail : null);
  if (!fallbackTarget) return;
  fallbackTarget.textContent = String(text || "").trim();
}












function renderRuleClauseText(rule) {
  const parts = normalizeRuleClauses(rule).map((clause) => {
    const type = String(clause?.type || "").toLowerCase();
    if (type === "price") {
      const condition = CONDITION_LABEL[String(clause?.condition || "").toLowerCase()] || String(clause?.condition || "--");
      return `价格 ${condition} ${fmtNumber(clause?.threshold, 2)}`;
    }
    if (type === "indicator_bias") {
      return `趋势 = ${BIAS_LABEL[String(clause?.bias || "").toLowerCase()] || clause?.bias || "--"}`;
    }
    if (type === "freshness") {
      const status = String(clause?.status || "");
      const statusText = status ? freshnessText(status) : "任意新鲜度";
      const ageText = Number.isFinite(Number(clause?.max_age_sec)) ? ` 且年龄≤${Math.round(Number(clause.max_age_sec))}s` : "";
      return `新鲜度 = ${statusText}${ageText}`;
    }
    return "未知条件";
  });
  const logic = String(rule?.logic_operator || "and").toLowerCase() === "or" ? " OR " : " AND ";
  return parts.join(logic);
}

function scheduleAutoRefresh(sec) {
  const next = Math.max(5, Number(sec) || 5);
  if (state.autoRefreshSec === next && refreshTimer) {
    return;
  }
  state.autoRefreshSec = next;
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  refreshTimer = setInterval(() => {
    refreshAll({ includeSettings: false });
  }, next * 1000);
  setRefreshStatus(`自动 ${next}s 刷新`);
}










function alignEventTimeKey(value, timeframe = "1d") {
  const tf = String(timeframe || "1d").toLowerCase();
  if (tf === "1d") return axisTimeKey(value, "1d");
  const raw = String(value || "");
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return axisTimeKey(value, tf);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const hh = String(dt.getUTCHours()).padStart(2, "0");
  if (tf === "1h") return `${yyyy}-${mm}-${dd} ${hh}:00`;
  return `${yyyy}-${mm}-${dd} ${hh}:${String(dt.getUTCMinutes()).padStart(2, "0")}`;
}















































































async function refreshAll({ includeSettings = true } = {}) {
  if (refreshInFlight) return;
  refreshInFlight = true;
  setRefreshStatus("刷新中…");
  const _safe = async (fn) => { try { await fn(); } catch (e) { console.warn("[refreshAll] partial fail:", e?.message || e); } };
  try {
    const activeIsYFinance = state.activeTab === "yfinance";
    if (includeSettings) {
      const tasks = [_safe(GM.refreshMarket || (async () => {})), _safe(GM.refreshRulesAndAlerts || (async () => {})), _safe(GM.refreshSettings || (async () => {})), _safe(GM.refreshInsightSettings || (async () => {})), _safe(GM.refreshInsightEvents || (async () => {}))];
      if (activeIsYFinance) {
        tasks.push(_safe(() => GM.refreshYFinance ? GM.refreshYFinance({ silent: true }) : Promise.resolve()));
      }
      await Promise.all(tasks);
      await _safe(GM.refreshUsers || (async () => {}));
      await _safe(GM.refreshLoginAudit || (async () => {}));
    } else {
      const tasks = [_safe(GM.refreshMarket || (async () => {})), _safe(GM.refreshRulesAndAlerts || (async () => {})), _safe(GM.refreshInsightEvents || (async () => {}))];
      if (activeIsYFinance) {
        tasks.push(_safe(() => GM.refreshYFinance ? GM.refreshYFinance({ silent: true }) : Promise.resolve()));
      }
      await Promise.all(tasks);
      await _safe(GM.refreshUsers || (async () => {}));
      await _safe(GM.refreshLoginAudit || (async () => {}));
    }
    setRefreshStatus(`最后刷新 ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error(err);
    el.lastUpdated.textContent = `刷新失败 ${new Date().toLocaleTimeString()}`;
    setRefreshStatus("刷新失败，请稍后重试。", true);
  } finally {
    refreshInFlight = false;
  }
}




window.GM = {
  state,
  el,
  fetchJson,
  escapeHtml,
  safeHref,
  fmtNumber,
  toNumberLoose,
  roundTo,
  clamp,
  labelSymbol,
  labelSource,
  formatLocalTime,
  formatAge,
  freshnessText,
  freshnessClass,
  priceMap: null,
  asBiasClass,
  lineColor,
  normalizeZoom,
  setActiveTab,
  setActiveWorkspace,
  setDeployView,
  setRefreshStatus,
  setRuleTip,
  setWecomTip,
  setDeployTip: null,
  setInviteTip: null,
  setUserManageTip: null,
  setUserCreateTip: null,
  setUserManageSummary: null,
  setChangePasswordTip: null,
  setLoginAuditTip: null,
  setLoginAuditSummary: null,
  setInsightTip: null,
  setInsightProviderTip: null,
  setInsightAssistantTip: null,
  setDashboardInsightTip: null,
  setBacktestTip: null,
  setBacktestCompareTip: null,
  setActiveTab,
  setActiveWorkspace,
  setDeployView,
  openWorkspaceModal,
  closeWorkspaceModal,
  closeWorkspaceModalForForm,
  focusInlineForm,
  openActionModal,
  closeActionModal,
  renderWorkspaceGuide,
  renderWorkspaceResponsibility,
  scheduleAutoRefresh,
  TAB_IDS,
  WORKSPACE_IDS,
  WORKSPACE_TAB_MAP,
  DEPLOY_VIEW_IDS,
  SYMBOL_LABEL,
  SOURCE_LABEL,
  BIAS_LABEL,
  CONDITION_LABEL,
  FRESHNESS_LABEL,
  SOURCE_UPDATE_INPUT_MAP,
  initWorkspaceFormModals,
  bindDashboardJumpNav,
  initTabRouting,
  dashboardVisible: null,
  insightStatusLabel: null,
  insightStageLabel: null,
  insightTriggerTypeLabel: null,
  isInsightDoneStatus: null,
  isInsightLiveStatus: null,
  trimInsightStreamText: null,
  normalizeInsightProgressPayload: null,
  mergeInsightDetailWithProgress: null,
  renderInsightProgressCard: null,
  renderInsightDetailEmpty: renderInsightDetailEmptyFallback,
  renderInsightEventDetail: null,
  renderInsightEvents: null,
  renderInsightChatModalContent: null,
  openInsightChatModal: null,
  closeInsightChatModal: null,
  isInsightChatModalOpen: null,
  loadInsightEventDetail: null,
  loadDashboardEventDetail: null,
  openInsightChatByEventId: null,
  openInsightEventDetailFromList: null,
  syncInsightEventProgressWatcher: null,
  stopInsightEventProgressWatcher: null,
  startInsightEventProgressWatcher: null,
  normalizeInsightAiError: null,
  buildInsightAiRuntimeBody: null,
  cleanInsightRichText: null,
  normalizeTextArray: null,
  collectInsightEvidence: null,
  renderInsightListBlock: null,
  renderInsightDiagnosticsBlock: null,
  deriveInsightFailureInfo: null,
  renderInsightAssistantContextCard: null,
  renderInsightAssistantFollowups: null,
  renderInsightAssistantLog: null,
  renderInsightAssistantTurns: null,
  setInsightAssistantBusy: null,
  setInsightAssistantContext: null,
  resetInsightAssistantContext: null,
  normalizeInsightAssistantContext: null,
  buildInsightAssistantContextPayload: null,
  insightAssistantContextBadgeText: null,
  defaultInsightAssistantContext: null,
  normalizeInsightAssistantMessages: null,
  createInsightAssistantRequestId: null,
  updateInsightAssistantMessageByRequestId: null,
  appendInsightAssistantMessageByRequestId: null,
  parseSseFrameData: null,
  buildInsightNewsReferenceBlock: null,
  streamInsightAssistantRequest: null,
  normalizeInsightAssistantDisplayText: null,
  renderInsightAssistantInlineMarkdown: null,
  renderInsightAssistantMarkdown: null,
  formatInsightAssistantTime: null,
  buildInsightAssistantTurns: null,
  scrollInsightAssistantToMessage: null,
  buildInsightAssistantFollowups: null,
  loadInsightAssistantHistory: null,
  sendInsightAssistantMessage: null,
  clearInsightAssistantConversation: null,
  buildInsightAssistantEventSummary: null,
  pickInsightAssistantContextEvent: null,
  applyInsightAssistantEventContext: null,
  pinInsightAssistantContextByEventId: null,
  insightTriggerButtons: null,
  insightTriggerCooldownRemainingSec: null,
  clearInsightTriggerCooldownTimer: null,
  syncInsightTriggerButtons: null,
  startInsightTriggerCooldown: null,
  setInsightRunnerPanel: null,
  hideInsightRunnerPanel: null,
  setGlobalInsightFeedback: null,
  updateBacktestCompareSortUi: null,
  axisTimeKey,
  alignEventTimeKey,
  closeByTimeKeyMap,
  eventsForSymbol,
  eventScatterSeries: null,
  axisIntervalBySize,
  roundedSeries,
  buildCandlesPayload,
  sanitizeBars,
  ensureBarsFromLatest,
  sleep: null,
  refreshAll,
  refreshMarket: null,
  refreshRulesAndAlerts: null,
  refreshYFinance: null,
  renderActiveCharts: null,
  repaintDashboardCharts: null,
  setLayout: null,
  setKlineTableView: null,
  chartIntl,
  chartDomestic: null,
  chartDual: null,
  chartYFinance: null,
  chartBacktestEquity: null,
  renderBacktestResult: null,
  renderBacktestCompareResult: null,
  updateCards: null,
  fillRuleByCurrentPrice: null,
  zoomBy: null,
  setZoomRange: null,
  readChartZoom: null,
  applyZoomToChart: null,
  renderRules: null,
  renderAlerts: null,
  renderSourceStatus: null,
  renderBacktestRuleOptions: null,
  renderBacktestCompareRuleOptions: null,
  renderInsightSettings: null,
  renderInsightStrategyList: null,
  renderDetectedModels: null,
  renderSettings: null,
  renderUsers: null,
  renderLoginAudit: null,
  renderWecomGuide: null,
  renderNotifyPreview: null,
  renderSourceExpectedInputs: null,
  readSourceExpectedInputs: null,
  resolveWecomTestHint: null,
  normalizeWecomWebhookHint: null,
  refreshInsightSettings: null,
  refreshInsightEvents: null,
  refreshSettings: null,
  refreshUsers: null,
  refreshLoginAudit: null,
  refreshInFlight,
};
