// Global error handler for debugging

// Visible debug panel
(function() {
  const panel = document.createElement('div');
  panel.id = 'gm-debug-panel';
  panel.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#111;color:#0f0;font:12px monospace;padding:8px;max-height:200px;overflow:auto;display:block;';
  document.body.appendChild(panel);
  window._gmDebug = function(msg) {
    const line = document.createElement('div');
    line.textContent = new Date().toLocaleTimeString() + ' ' + msg;
    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
    console.log('[GM]', msg);
  };
  window._gmDebug('app.js loaded, echarts available: ' + (typeof echarts !== 'undefined'));
  window._gmDebug('chart-intl element: ' + !!document.getElementById('chart-intl'));
  window._gmDebug('chart-domestic element: ' + !!document.getElementById('chart-domestic'));
})();
window.onerror = function(msg, src, line, col, err) {
  console.error('[GLOBAL ERROR]', msg, 'at', src, ':' + line + ':' + col, err);
  return false;
};
window.addEventListener('unhandledrejection', function(e) {
  console.error('[UNHANDLED REJECTION]', e.reason);
});
// [debug] app.js loaded at " + new Date().toISOString() + "
console.log('[debug] app.js executing');
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

let chartIntl = null, chartDomestic = null, chartDual = null;
try {
  const chartIntlEl = document.getElementById("chart-intl");
  chartIntl = chartIntlEl ? echarts.init(chartIntlEl) : null;
  const chartDomesticEl = document.getElementById("chart-domestic");
  chartDomestic = chartDomesticEl ? echarts.init(chartDomesticEl) : null;
  const chartDualEl = document.getElementById("chart-dual");
  chartDual = chartDualEl ? echarts.init(chartDualEl) : null;
  console.log('[chart] init OK, chartIntl:', !!chartIntl, 'chartDomestic:', !!chartDomestic, 'chartDual:', !!chartDual);
} catch (e) {
  console.error('[chart] init FAILED:', e.message);
}
let chartYFinance = null;
let chartBacktestEquity = null;
let chartRetryTimer = null;
let chartRepaintFrame = 0;
let auxChartRepaintFrame = 0;
if (chartIntl) bindChartInteractionLock(chartIntl);
if (chartDomestic) bindChartInteractionLock(chartDomestic);
if (chartDual) bindChartInteractionLock(chartDual);
let refreshTimer = null;
let refreshInFlight = false;
let syncSplitZoom = false;
let authRedirecting = false;
const formModalRegistry = new Map();
let formModalStash = null;
let workspaceOutlineObserver = null;
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
  if (forms.length === 0) return;

  formModalStash = document.createElement("div");
  formModalStash.className = "hidden";
  formModalStash.id = "workspace-modal-stash";
  document.body.appendChild(formModalStash);

  forms.forEach((form) => {
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
  if (name === "ma5") return "#f6c343";
  if (name === "ma20") return "#d65cff";
  if (name === "ma60") return "#37c8ff";
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

function readChartZoom(chart) {
  if (!chart || typeof chart.getOption !== "function") return null;
  const option = chart.getOption();
  const first = option?.dataZoom?.[0];
  if (!first) return null;
  if (!Number.isFinite(first.start) || !Number.isFinite(first.end)) return null;
  return normalizeZoom(first.start, first.end);
}

function applyZoomToChart(chart, start, end) {
  if (!chart || typeof chart.dispatchAction !== "function") return;
  chart.dispatchAction({ type: "dataZoom", dataZoomIndex: 0, start, end });
  chart.dispatchAction({ type: "dataZoom", dataZoomIndex: 1, start, end });
}

function setZoomRange(start, end) {
  const next = normalizeZoom(start, end);
  state.zoom = next;
  if (state.layout === "dual-axis") {
    applyZoomToChart(chartDual, next.start, next.end);
    return;
  }
  if (state.layout === "all") {
    applyZoomToChart(chartIntl, next.start, next.end);
    applyZoomToChart(chartDomestic, next.start, next.end);
    applyZoomToChart(chartDual, next.start, next.end);
    return;
  }
  applyZoomToChart(chartIntl, next.start, next.end);
  applyZoomToChart(chartDomestic, next.start, next.end);
}

function zoomBy(factor) {
  const width = clamp((state.zoom.end - state.zoom.start) * factor, 4, 100);
  const center = (state.zoom.start + state.zoom.end) / 2;
  let nextStart = center - width / 2;
  let nextEnd = center + width / 2;
  if (nextStart < 0) {
    nextEnd -= nextStart;
    nextStart = 0;
  }
  if (nextEnd > 100) {
    nextStart -= nextEnd - 100;
    nextEnd = 100;
  }
  setZoomRange(nextStart, nextEnd);
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

function setInsightTip(text, isError = false) {
  if (!el.insightPolicyTip) return;
  el.insightPolicyTip.textContent = text;
  el.insightPolicyTip.style.color = isError ? "#d12f3f" : "";
}

function setInsightProviderTip(text, isError = false) {
  if (!el.insightProviderTip) return;
  el.insightProviderTip.textContent = text;
  el.insightProviderTip.style.color = isError ? "#d12f3f" : "";
}

function insightAssistantWelcomeMessage() {
  return "可以直接问行情、策略或风险。";
}

function setInsightAssistantTip(text, isError = false) {
  if (!el.insightAssistantTip) return;
  el.insightAssistantTip.textContent = text;
  el.insightAssistantTip.style.color = isError ? "#d12f3f" : "";
}

function defaultInsightAssistantContext() {
  return {
    source: "default",
    eventId: null,
    symbols: ["XAUUSD", "AUCN", "USDCNY"],
    summary: "行情 / 事件 / 新闻",
    note: "",
  };
}

function normalizeContextSymbols(symbols) {
  const rows = Array.isArray(symbols) ? symbols : [];
  const seen = new Set();
  const output = [];
  for (const item of rows) {
    const symbol = String(item || "")
      .trim()
      .toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    output.push(symbol);
  }
  if (output.length === 0) {
    return ["XAUUSD", "AUCN", "USDCNY"];
  }
  return output.slice(0, 6);
}

function normalizeInsightAssistantContext(rawContext) {
  const defaults = defaultInsightAssistantContext();
  const source = rawContext && typeof rawContext === "object" ? rawContext : {};
  const eventIdRaw = Number(source.eventId ?? source.event_id);
  const eventId = Number.isFinite(eventIdRaw) && eventIdRaw > 0 ? Math.round(eventIdRaw) : null;
  const normalized = {
    source: String(source.source || (eventId ? "event" : defaults.source)).trim().toLowerCase() || defaults.source,
    eventId,
    symbols: normalizeContextSymbols(source.symbols || defaults.symbols),
    summary: String(source.summary || defaults.summary).trim() || defaults.summary,
    note: String(source.note || "").trim().slice(0, 220),
  };
  if (normalized.source !== "event" || !normalized.eventId) {
    normalized.eventId = null;
    if (normalized.source === "event") {
      normalized.source = "default";
    }
  }
  return normalized;
}

function buildInsightAssistantContextPayload() {
  const context = normalizeInsightAssistantContext(state.insightAssistantContext);
  const payload = {};
  if (Number.isFinite(Number(context.eventId))) {
    payload.context_event_id = Number(context.eventId);
  }
  if (Array.isArray(context.symbols) && context.symbols.length > 0) {
    payload.context_symbols = context.symbols.slice(0, 6);
  }
  if (context.note) {
    payload.context_note = context.note.slice(0, 180);
  }
  return payload;
}

function insightAssistantContextBadgeText(context = state.insightAssistantContext) {
  const normalized = normalizeInsightAssistantContext(context);
  if (normalized.source === "event" && normalized.eventId) {
    return `事件 #${normalized.eventId}`;
  }
  if (normalized.source === "manual") {
    return "自定义上下文";
  }
  return "默认上下文";
}

function renderInsightAssistantContextCard() {
  const context = normalizeInsightAssistantContext(state.insightAssistantContext);
  state.insightAssistantContext = context;
  if (el.insightAssistantContextBadge) {
    el.insightAssistantContextBadge.textContent = insightAssistantContextBadgeText(context);
  }
  if (el.insightAssistantContextSummary) {
    el.insightAssistantContextSummary.textContent = context.summary || defaultInsightAssistantContext().summary;
  }
  if (el.insightAssistantContextTags) {
    const tags = [];
    if (context.eventId) {
      tags.push(`<span class="tag">事件#${escapeHtml(String(context.eventId))}</span>`);
    }
    for (const symbol of context.symbols || []) {
      tags.push(`<span class="tag">${escapeHtml(symbol)}</span>`);
    }
    if (context.note) {
      tags.push(`<span class="tag">${escapeHtml(context.note)}</span>`);
    }
    el.insightAssistantContextTags.innerHTML = tags.join("");
  }
}

function setInsightAssistantContext(nextContext, { announce = false } = {}) {
  state.insightAssistantContext = normalizeInsightAssistantContext(nextContext);
  renderInsightAssistantContextCard();
  renderInsightAssistantFollowups();
  if (announce) {
    setInsightAssistantTip(`已更新追问上下文：${insightAssistantContextBadgeText(state.insightAssistantContext)}。`);
  }
}

function resetInsightAssistantContext({ announce = false } = {}) {
  setInsightAssistantContext(defaultInsightAssistantContext(), { announce });
}

function normalizeInsightAssistantMessages(messages) {
  const source = Array.isArray(messages) ? messages : [];
  const rows = source
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = String(item.role || "").trim().toLowerCase();
      if (!["assistant", "user"].includes(role)) return null;
      const content = String(item.content || "").trim();
      if (!content) return null;
      const requestId = String(item.requestId || "").trim();
      const createdAt = String(item.created_at || item.createdAt || "").trim();
      const contextEventIdRaw = Number(item.context_event_id ?? item.contextEventId);
      const contextEventId = Number.isFinite(contextEventIdRaw) && contextEventIdRaw > 0 ? Math.round(contextEventIdRaw) : null;
      const contextSource = String(item.context_source || item.contextSource || "").trim().toLowerCase();
      const contextSummary = String(item.context_summary || item.contextSummary || "").trim();
      return {
        role,
        content: content.slice(0, 6000),
        pending: Boolean(item.pending),
        requestId,
        createdAt: createdAt || new Date().toISOString(),
        contextEventId,
        contextSource: contextSource || "",
        contextSummary: contextSummary || "",
      };
    })
    .filter(Boolean);
  if (rows.length === 0) {
    rows.push({
      role: "assistant",
      content: insightAssistantWelcomeMessage(),
      pending: false,
      requestId: "",
      createdAt: new Date().toISOString(),
      contextEventId: null,
      contextSource: "default",
      contextSummary: "",
    });
  }
  return rows.slice(-30);
}

function createInsightAssistantRequestId() {
  return `chat_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function updateInsightAssistantMessageByRequestId(requestId, content, pending = false, meta = null) {
  const targetId = String(requestId || "").trim();
  const text = String(content || "").trim() || "模型未返回内容。";
  if (!targetId) return;
  const metadata = meta && typeof meta === "object" ? meta : {};
  state.insightAssistantMessages = normalizeInsightAssistantMessages(state.insightAssistantMessages);
  const index = state.insightAssistantMessages.findIndex((item) => String(item.requestId || "") === targetId);
  if (index >= 0) {
    state.insightAssistantMessages[index] = {
      ...state.insightAssistantMessages[index],
      content: text.slice(0, 6000),
      pending: Boolean(pending),
      requestId: targetId,
      contextEventId:
        Number.isFinite(Number(metadata.contextEventId)) && Number(metadata.contextEventId) > 0
          ? Math.round(Number(metadata.contextEventId))
          : state.insightAssistantMessages[index].contextEventId || null,
      contextSource: String(metadata.contextSource || state.insightAssistantMessages[index].contextSource || "").slice(0, 24),
      contextSummary: String(metadata.contextSummary || state.insightAssistantMessages[index].contextSummary || "").slice(0, 220),
    };
    return;
  }
  state.insightAssistantMessages.push({
    role: "assistant",
    content: text.slice(0, 6000),
    pending: Boolean(pending),
    requestId: targetId,
    createdAt: new Date().toISOString(),
    contextEventId:
      Number.isFinite(Number(metadata.contextEventId)) && Number(metadata.contextEventId) > 0
        ? Math.round(Number(metadata.contextEventId))
        : null,
    contextSource: String(metadata.contextSource || "").slice(0, 24),
    contextSummary: String(metadata.contextSummary || "").slice(0, 220),
  });
}

function appendInsightAssistantMessageByRequestId(requestId, delta, meta = null) {
  const targetId = String(requestId || "").trim();
  const piece = String(delta || "");
  if (!targetId || !piece) return;
  const metadata = meta && typeof meta === "object" ? meta : {};
  state.insightAssistantMessages = normalizeInsightAssistantMessages(state.insightAssistantMessages);
  const index = state.insightAssistantMessages.findIndex((item) => String(item.requestId || "") === targetId);
  if (index >= 0) {
    const previous = String(state.insightAssistantMessages[index]?.content || "");
    const base = previous.startsWith("正在思考中") ? "" : previous;
    const merged = `${base}${piece}`.slice(0, 6000);
    state.insightAssistantMessages[index] = {
      ...state.insightAssistantMessages[index],
      content: merged || "模型正在生成...",
      pending: true,
      requestId: targetId,
      contextEventId:
        Number.isFinite(Number(metadata.contextEventId)) && Number(metadata.contextEventId) > 0
          ? Math.round(Number(metadata.contextEventId))
          : state.insightAssistantMessages[index].contextEventId || null,
      contextSource: String(metadata.contextSource || state.insightAssistantMessages[index].contextSource || "").slice(0, 24),
      contextSummary: String(metadata.contextSummary || state.insightAssistantMessages[index].contextSummary || "").slice(0, 220),
    };
    return;
  }
  state.insightAssistantMessages.push({
    role: "assistant",
    content: piece.slice(0, 6000),
    pending: true,
    requestId: targetId,
    createdAt: new Date().toISOString(),
    contextEventId:
      Number.isFinite(Number(metadata.contextEventId)) && Number(metadata.contextEventId) > 0
        ? Math.round(Number(metadata.contextEventId))
        : null,
    contextSource: String(metadata.contextSource || "").slice(0, 24),
    contextSummary: String(metadata.contextSummary || "").slice(0, 220),
  });
}

function parseSseFrameData(frameText) {
  const text = String(frameText || "");
  if (!text.trim()) return "";
  const lines = text.split(/\r?\n/);
  const payloadLines = [];
  lines.forEach((line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed || trimmed.startsWith(":")) return;
    if (trimmed.startsWith("data:")) {
      payloadLines.push(trimmed.slice(5).trim());
    }
  });
  return payloadLines.join("\n").trim();
}

function buildInsightNewsReferenceBlock(contextUsed) {
  const newsRows = Array.isArray(contextUsed?.news) ? contextUsed.news : [];
  if (!newsRows.length) return "";
  const lines = [];
  newsRows.slice(0, 3).forEach((item, idx) => {
    const id = String(item?.id || `N${idx + 1}`).trim() || `N${idx + 1}`;
    const outlet = String(item?.outlet || "--").trim();
    const title = String(item?.title || "").trim();
    const publishedAt = String(item?.published_at || "--").trim();
    const url = String(item?.url || "").trim();
    const titleText = title || "（无标题）";
    const meta = [outlet, publishedAt, titleText].filter(Boolean).join(" | ");
    const row = [`- [${id}] ${meta}`];
    if (url) {
      row.push(`  原文：${url}`);
    }
    lines.push(row.join("\n"));
  });
  if (!lines.length) return "";
  return `\n\n### 参考新闻\n${lines.join("\n")}`;
}

async function streamInsightAssistantRequest(requestBody, onEvent) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutMs = 65000;
  const timer = controller
    ? window.setTimeout(() => {
        try {
          controller.abort();
        } catch (_err) {
          // ignore
        }
      }, timeoutMs)
    : null;
  try {
    const res = await fetch("/api/insight/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller?.signal,
    });
    if (!res.ok) {
      let detail = "";
      try {
        const payload = await res.json();
        detail = String(payload?.error || payload?.message || "").trim();
      } catch (_err) {
        detail = "";
      }
      if (detail) {
        throw new Error(`HTTP ${res.status} for /api/insight/chat/stream: ${detail}`);
      }
      throw new Error(`HTTP ${res.status} for /api/insight/chat/stream`);
    }
    if (!res.body || typeof res.body.getReader !== "function") {
      throw new Error("stream response body unavailable");
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let doneSignal = false;
    const emit = (flushTail = false) => {
      const blocks = buffer.split(/\r?\n\r?\n/);
      if (!flushTail) {
        buffer = blocks.pop() || "";
      } else {
        buffer = "";
      }
      blocks.forEach((block) => {
        const dataText = parseSseFrameData(block);
        if (!dataText) return;
        if (dataText === "[DONE]") {
          doneSignal = true;
          return;
        }
        let payload = null;
        try {
          payload = JSON.parse(dataText);
        } catch (_err) {
          payload = { type: "text", content: dataText };
        }
        if (typeof onEvent === "function") {
          onEvent(payload);
        }
      });
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      emit(false);
      if (doneSignal) {
        try {
          await reader.cancel();
        } catch (_err) {
          // ignore
        }
        break;
      }
    }
    if (!doneSignal) {
      buffer += decoder.decode();
      emit(true);
    }
    return { doneSignal };
  } catch (err) {
    const aborted = err && typeof err === "object" && String(err.name || "") === "AbortError";
    if (aborted) {
      throw new Error(`HTTP timeout for /api/insight/chat/stream after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function setInsightAssistantBusy(busy) {
  state.insightAssistantBusy = Boolean(busy);
  if (el.insightAssistantSend) {
    el.insightAssistantSend.disabled = state.insightAssistantBusy;
    el.insightAssistantSend.textContent = state.insightAssistantBusy ? "发送中..." : "发送";
  }
  if (el.insightAssistantInput) {
    el.insightAssistantInput.disabled = state.insightAssistantBusy;
  }
  if (el.insightAssistantClear) {
    el.insightAssistantClear.disabled = state.insightAssistantBusy;
  }
}

function normalizeInsightAssistantDisplayText(raw, maxChars = 3600) {
  let text = String(raw || "");
  text = text.replace(/\r\n?/g, "\n").trim();
  text = text.replace(/\n{4,}/g, "\n\n\n");
  const limit = Math.max(320, Number(maxChars) || 3600);
  if (text.length > limit) {
    text = `${text.slice(0, limit)}…`;
  }
  return text;
}

function renderInsightAssistantInlineMarkdown(rawText) {
  let text = escapeHtml(String(rawText || ""));
  text = text.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_\n]+?)__/g, "<strong>$1</strong>");
  text = text.replace(
    /(https?:\/\/[^\s<]+)/gi,
    (url) => `<a href="${escapeHtml(safeHref(url))}" target="_blank" rel="noopener noreferrer">${url}</a>`
  );
  return text;
}

function renderInsightAssistantMarkdown(rawText) {
  const text = normalizeInsightAssistantDisplayText(rawText, 3600);
  if (!text) return "<p>--</p>";
  const lines = text.split("\n");
  const blocks = [];
  let paragraphLines = [];
  let listBlock = null;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    const paragraph = paragraphLines.join("\n").trim();
    if (paragraph) {
      blocks.push(`<p>${renderInsightAssistantInlineMarkdown(paragraph).replace(/\n/g, "<br>")}</p>`);
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listBlock || !Array.isArray(listBlock.items) || !listBlock.items.length) {
      listBlock = null;
      return;
    }
    const items = listBlock.items
      .map((item) => `<li>${renderInsightAssistantInlineMarkdown(item).replace(/\n/g, "<br>")}</li>`)
      .join("");
    blocks.push(`<${listBlock.type}>${items}</${listBlock.type}>`);
    listBlock = null;
  };

  lines.forEach((rawLine) => {
    const line = String(rawLine || "").replace(/\t/g, "  ");
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length <= 2 ? 3 : 4;
      blocks.push(`<h${level}>${renderInsightAssistantInlineMarkdown(headingMatch[2])}</h${level}>`);
      return;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      const type = unorderedMatch ? "ul" : "ol";
      const itemText = unorderedMatch ? unorderedMatch[1] : orderedMatch[1];
      if (!listBlock || listBlock.type !== type) {
        flushList();
        listBlock = { type, items: [] };
      }
      listBlock.items.push(itemText);
      return;
    }

    if (listBlock && /^\s{2,}\S+/.test(line)) {
      const lastIndex = listBlock.items.length - 1;
      if (lastIndex >= 0) {
        listBlock.items[lastIndex] = `${listBlock.items[lastIndex]}\n${trimmed}`;
      }
      return;
    }

    flushList();
    paragraphLines.push(trimmed);
  });

  flushParagraph();
  flushList();
  return blocks.join("") || "<p>--</p>";
}

function formatInsightAssistantTime(value) {
  const text = String(value || "").trim();
  if (!text) return "--";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildInsightAssistantTurns(messages) {
  const rows = Array.isArray(messages) ? messages : [];
  const turns = [];
  let currentTurn = null;
  rows.forEach((item, idx) => {
    const role = String(item?.role || "").toLowerCase();
    if (role === "user") {
      currentTurn = {
        id: turns.length + 1,
        userIndex: idx,
        assistantIndex: null,
        question: String(item.content || ""),
        answer: "",
        createdAt: String(item.createdAt || ""),
      };
      turns.push(currentTurn);
      return;
    }
    if (role === "assistant" && currentTurn) {
      currentTurn.assistantIndex = idx;
      currentTurn.answer = String(item.content || "");
      if (!currentTurn.createdAt) {
        currentTurn.createdAt = String(item.createdAt || "");
      }
    }
  });
  return turns.slice(-12);
}

function scrollInsightAssistantToMessage(index) {
  if (!el.insightAssistantLog) return;
  const target = el.insightAssistantLog.querySelector(`[data-msg-index="${index}"]`);
  if (!(target instanceof HTMLElement)) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("active");
  window.setTimeout(() => target.classList.remove("active"), 950);
}

function renderInsightAssistantTurns() {
  if (!el.insightAssistantTurns || !el.insightAssistantTurnCount) return;
  const turns = buildInsightAssistantTurns(state.insightAssistantMessages);
  el.insightAssistantTurnCount.textContent = `${turns.length} 轮`;
  if (turns.length === 0) {
    el.insightAssistantTurns.innerHTML = '<p class="meta">发送后显示会话。</p>';
    return;
  }
  el.insightAssistantTurns.innerHTML = turns
    .map((turn) => {
      const preview = normalizeInsightAssistantDisplayText(turn.question, 70) || "继续追问";
      const answerReady = turn.answer ? "已回复" : "待回复";
      return `
        <button type="button" class="insight-assistant-turn-item" data-turn-index="${turn.userIndex}">
          <strong>第 ${turn.id} 轮 · ${escapeHtml(answerReady)}</strong>
          <small>${escapeHtml(preview)}</small>
          <small>${escapeHtml(formatInsightAssistantTime(turn.createdAt))}</small>
        </button>
      `;
    })
    .join("");
  for (const button of Array.from(el.insightAssistantTurns.querySelectorAll(".insight-assistant-turn-item"))) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.turnIndex || "");
      if (!Number.isFinite(index)) return;
      scrollInsightAssistantToMessage(index);
      for (const node of Array.from(el.insightAssistantTurns.querySelectorAll(".insight-assistant-turn-item"))) {
        node.classList.toggle("active", node === button);
      }
    });
  }
}

function buildInsightAssistantFollowups() {
  const context = normalizeInsightAssistantContext(state.insightAssistantContext);
  if (context.eventId) {
    return [
      `基于事件 #${context.eventId}，用 3 点给出可执行观察清单。`,
      `如果我继续追问事件 #${context.eventId}，最需要先确认哪些反证？`,
      `把事件 #${context.eventId} 的结论改写成“交易前检查表”。`,
    ];
  }
  const primarySymbol = context.symbols?.[0] || "XAUUSD";
  return [
    `结合当前 ${primarySymbol} 行情，给我一版 24 小时监控重点。`,
    "请反过来挑战你上一条结论，列出最可能失效的前提。",
    "把当前分析转成团队播报格式：结论、证据、风险、下一步。",
  ];
}

function renderInsightAssistantFollowups() {
  if (!el.insightAssistantFollowups) return;
  const suggestions = buildInsightAssistantFollowups();
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    el.insightAssistantFollowups.innerHTML = '<p class="meta">暂无快捷追问建议。</p>';
    return;
  }
  el.insightAssistantFollowups.innerHTML = suggestions
    .map(
      (item, idx) =>
        `<button type="button" class="secondary-btn" data-followup-index="${idx}">${escapeHtml(item)}</button>`,
    )
    .join("");
  for (const button of Array.from(el.insightAssistantFollowups.querySelectorAll("button[data-followup-index]"))) {
    button.addEventListener("click", async () => {
      const index = Number(button.getAttribute("data-followup-index") || "");
      const text = Number.isFinite(index) ? String(suggestions[index] || "").trim() : "";
      if (!text) return;
      if (el.insightAssistantInput) {
        el.insightAssistantInput.value = text;
        el.insightAssistantInput.focus({ preventScroll: true });
      }
      await submitInsightAssistantComposer();
    });
  }
}

function renderInsightAssistantLog() {
  if (!el.insightAssistantLog) return;
  state.insightAssistantMessages = normalizeInsightAssistantMessages(state.insightAssistantMessages);
  el.insightAssistantLog.innerHTML = state.insightAssistantMessages
    .map((item, index) => {
      const role = item.role === "user" ? "你" : "AI";
      const roleClass = item.role === "user" ? "user" : "assistant";
      const content = normalizeInsightAssistantDisplayText(item.content, 3600) || "--";
      const isRichAssistant = item.role === "assistant" && !item.pending;
      const bubbleClass = isRichAssistant ? "bubble is-rich" : "bubble is-plain";
      const contextBadgeText =
        item.contextSource === "event" && Number.isFinite(Number(item.contextEventId))
          ? `事件 #${Math.round(Number(item.contextEventId))}`
          : String(item.contextSummary || "").trim();
      const contextBadge = contextBadgeText ? `<span class="context-badge">${escapeHtml(contextBadgeText)}</span>` : "";
      const bubbleContent = isRichAssistant
        ? renderInsightAssistantMarkdown(content)
        : `<p>${escapeHtml(content).replace(/\n/g, "<br>")}</p>`;
      const pendingBadge = item.pending ? `<span class="insight-assistant-pending">正在生成...</span>` : "";
      const roleMeta = formatInsightAssistantTime(item.createdAt);
      const sourceFlag = item.contextSource === "event" ? ' data-source-context="event"' : "";
      return `
        <article class="insight-assistant-item ${roleClass}" data-msg-index="${index}">
          <div class="role">${escapeHtml(role)} ${pendingBadge} · ${escapeHtml(roleMeta)}</div>
          <div class="${bubbleClass}"${sourceFlag}>${contextBadge}${bubbleContent}</div>
        </article>
      `;
    })
    .join("");
  el.insightAssistantLog.scrollTop = el.insightAssistantLog.scrollHeight;
  renderInsightAssistantTurns();
  renderInsightAssistantFollowups();
}

async function loadInsightAssistantHistory({ silent = false, force = false } = {}) {
  if (state.insightAssistantHistoryLoading) return;
  if (!force && state.insightAssistantHistoryLoaded) return;
  state.insightAssistantHistoryLoading = true;
  try {
    const payload = await fetchJson("/api/insight/chat/history?limit=80", { timeoutMs: 12000 });
    const rows = Array.isArray(payload?.messages) ? payload.messages : [];
    state.insightAssistantMessages = normalizeInsightAssistantMessages(rows);
    state.insightAssistantHistoryLoaded = true;
    renderInsightAssistantLog();
    renderInsightAssistantContextCard();
    if (!silent) {
      if (rows.length > 0) {
        setInsightAssistantTip(`已加载 ${rows.length} 条历史对话，可继续追问。`);
      } else {
        setInsightAssistantTip("暂无历史对话，当前会话将自动保存。");
      }
    }
  } catch (err) {
    console.error(err);
    if (!silent) {
      setInsightAssistantTip("历史对话加载失败，本次仍可正常提问。", true);
    }
  } finally {
    state.insightAssistantHistoryLoading = false;
  }
}

async function sendInsightAssistantMessage(text) {
  const question = String(text || "").trim();
  if (!question) {
    setInsightAssistantTip("请输入你想咨询的问题。", true);
    return false;
  }
  if (state.insightAssistantBusy) {
    setInsightAssistantTip("AI 正在回复，请稍候。", true);
    return false;
  }
  const context = normalizeInsightAssistantContext(state.insightAssistantContext);
  const messageMeta = {
    contextEventId: context.eventId,
    contextSource: context.source,
    contextSummary: context.summary,
  };
  state.insightAssistantMessages = normalizeInsightAssistantMessages(state.insightAssistantMessages);
  state.insightAssistantMessages.push({
    role: "user",
    content: question,
    pending: false,
    createdAt: new Date().toISOString(),
    contextEventId: context.eventId,
    contextSource: context.source,
    contextSummary: context.summary,
  });
  const requestId = createInsightAssistantRequestId();
  state.insightAssistantMessages.push({
    role: "assistant",
    content: "正在思考中，请稍候...",
    pending: true,
    requestId,
    createdAt: new Date().toISOString(),
    contextEventId: context.eventId,
    contextSource: context.source,
    contextSummary: context.summary,
  });
  renderInsightAssistantLog();
  setInsightAssistantBusy(true);
  setInsightAssistantTip(`AI 正在生成回复（${insightAssistantContextBadgeText(context)}）。`);

  let settled = false;
  const finish = ({ content, tipText, isError = false, contextSummary = "" }) => {
    if (settled) return;
    settled = true;
    const mergedContextSummary = String(contextSummary || context.summary || "").trim();
    updateInsightAssistantMessageByRequestId(requestId, content, false, {
      ...messageMeta,
      contextSummary: mergedContextSummary,
    });
    if (mergedContextSummary) {
      setInsightAssistantContext(
        {
          ...context,
          summary: mergedContextSummary,
        },
        { announce: false },
      );
    }
    setInsightAssistantBusy(false);
    renderInsightAssistantLog();
    if (tipText) {
      setInsightAssistantTip(tipText, isError);
    }
  };
  const runtime = buildInsightAiRuntimeBody({ includeModel: true });
  const requestBody = {
    ...runtime.body,
    ...buildInsightAssistantContextPayload(),
    message: question,
    temperature: 0.35,
    max_tokens: 520,
  };
  const watchdog = window.setTimeout(() => {
    finish({
      content: "抱歉，本次对话超时。请检查网络、模型可用性或稍后重试。",
      tipText: "AI 对话超时（70秒未完成），可立即重试。",
      isError: true,
    });
  }, 70000);

  try {
    let streamDonePayload = null;
    let streamContextSummary = "";
    let streamModel = "";
    let streamReplyBuffer = "";
    const streamResult = await streamInsightAssistantRequest(requestBody, (eventPayload) => {
      const payload = eventPayload && typeof eventPayload === "object" ? eventPayload : {};
      const type = String(payload.type || "").trim().toLowerCase();
      if (type === "meta") {
        streamModel = String(payload.model || "").trim();
        streamContextSummary = String(payload.context_summary || "").trim();
        if (streamContextSummary) {
          setInsightAssistantTip(`AI 流式生成中（上下文：${streamContextSummary}）...`);
        }
        return;
      }
      if (type === "delta") {
        const delta = String(payload.delta || "");
        streamReplyBuffer += delta;
        appendInsightAssistantMessageByRequestId(requestId, delta, {
          ...messageMeta,
          contextSummary: streamContextSummary || context.summary,
        });
        renderInsightAssistantLog();
        return;
      }
      if (type === "degraded") {
        const degradedMsg = String(payload.message || "流式不可用，已降级普通请求。").trim();
        setInsightAssistantTip(degradedMsg);
        return;
      }
      if (type === "error") {
        throw new Error(String(payload.error || "stream failed"));
      }
      if (type === "done") {
        streamDonePayload = payload;
      }
    });
    const bufferedReply = String(streamReplyBuffer || "").trim();
    if (!streamDonePayload) {
      if (bufferedReply) {
        streamDonePayload = {
          reply: bufferedReply,
          model: streamModel,
          context_summary: streamContextSummary,
          degraded_mode: false,
        };
      } else if (streamResult?.doneSignal) {
        throw new Error("stream ended without content");
      } else {
        throw new Error("stream response incomplete");
      }
    }
    const reply =
      String(streamDonePayload?.reply || "").trim() || bufferedReply || "模型已返回响应，但内容为空。";
    const newsBlock = buildInsightNewsReferenceBlock(streamDonePayload?.context_used || null);
    const finalReply = `${reply}${newsBlock}`.trim();
    const model = String(streamDonePayload?.model || streamModel || "").trim();
    const contextSummary = String(streamDonePayload?.context_summary || streamContextSummary || "").trim();
    const degradedMode = Boolean(streamDonePayload?.degraded_mode);
    const tipSegments = [];
    if (model) {
      tipSegments.push(`模型：${model}`);
    }
    if (contextSummary) {
      tipSegments.push(`已用上下文：${contextSummary}`);
    }
    if (degradedMode) {
      tipSegments.push("流式已降级");
    }
    finish({
      content: finalReply,
      tipText: tipSegments.length > 0 ? `回复完成（${tipSegments.join("；")}）。` : "回复完成。",
      isError: false,
      contextSummary,
    });
  } catch (streamErr) {
    try {
      const payload = await fetchJson("/api/insight/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeoutMs: 28000,
        body: JSON.stringify(requestBody),
      });
      const reply = String(payload?.reply || "").trim() || "模型已返回响应，但内容为空。";
      const newsBlock = buildInsightNewsReferenceBlock(payload?.context_used || null);
      const finalReply = `${reply}${newsBlock}`.trim();
      const model = String(payload?.model || "").trim();
      const contextSummary = String(payload?.context_summary || "").trim();
      const tipSegments = ["流式失败已自动降级"];
      if (model) {
        tipSegments.push(`模型：${model}`);
      }
      if (contextSummary) {
        tipSegments.push(`已用上下文：${contextSummary}`);
      }
      finish({
        content: finalReply,
        tipText: `回复完成（${tipSegments.join("；")}）。`,
        isError: false,
        contextSummary,
      });
    } catch (err) {
      const parsed = normalizeInsightAiError(err instanceof Error ? err.message : String(err || ""));
      const streamMessage = streamErr instanceof Error ? streamErr.message : String(streamErr || "");
      const hint = parsed.hints?.[0] ? ` 建议：${parsed.hints[0]}` : "";
      const streamHint = streamMessage ? ` 流式错误：${streamMessage}` : "";
      finish({
        content: `抱歉，本次对话失败：${parsed.summary}`,
        tipText: `AI 对话失败：${parsed.summary}${hint}${streamHint}`,
        isError: true,
      });
    }
  } finally {
    clearTimeout(watchdog);
  }
  return true;
}

async function clearInsightAssistantConversation() {
  if (state.insightAssistantBusy) return;
  try {
    await fetchJson("/api/insight/chat/history/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      timeoutMs: 10000,
    });
  } catch (err) {
    console.error(err);
    setInsightAssistantTip("清空历史失败，请稍后重试。", true);
    return;
  }
  state.insightAssistantMessages = [
    {
      role: "assistant",
      content: insightAssistantWelcomeMessage(),
      pending: false,
      createdAt: new Date().toISOString(),
      contextSource: "default",
      contextSummary: "",
      contextEventId: null,
    },
  ];
  state.insightAssistantHistoryLoaded = true;
  resetInsightAssistantContext({ announce: false });
  renderInsightAssistantLog();
  setInsightAssistantTip("会话与历史已清空，可开始新的提问。");
}

function buildInsightAssistantEventSummary(detail) {
  if (!detail || typeof detail !== "object") {
    return "追问上下文来自当前选中事件。";
  }
  const eventId = Number(detail.id);
  const symbol = labelSymbol(String(detail.symbol || "XAUUSD"));
  const direction = String(detail.direction || "").toLowerCase() === "down" ? "下跌" : "上涨";
  const changePct = fmtNumber(detail.change_pct, 2);
  const windowMinutes = Number(detail.window_minutes);
  const triggerType = insightTriggerTypeLabel(detail.trigger_type);
  const summary = cleanInsightRichText(detail.summary || detail.result?.summary_short || "", { maxChars: 120, compact: true });
  const parts = [
    Number.isFinite(eventId) ? `事件 #${eventId}` : "当前事件",
    `${symbol}${direction}${changePct}%`,
    Number.isFinite(windowMinutes) ? `${Math.round(windowMinutes)}分钟窗口` : "",
    triggerType ? `触发:${triggerType}` : "",
    summary || "",
  ].filter(Boolean);
  return parts.join("；");
}

function pickInsightAssistantContextEvent() {
  if (state.currentInsightDetail && Number.isFinite(Number(state.currentInsightDetail.id))) {
    return state.currentInsightDetail;
  }
  if (state.currentDashboardInsightDetail && Number.isFinite(Number(state.currentDashboardInsightDetail.id))) {
    return state.currentDashboardInsightDetail;
  }
  const firstEvent = Array.isArray(state.insightEvents)
    ? state.insightEvents.find((item) => Number.isFinite(Number(item?.id)))
    : null;
  return firstEvent || null;
}

function applyInsightAssistantEventContext(detail, { switchTab = true, prefill = true } = {}) {
  if (!detail || typeof detail !== "object") return false;
  const eventId = Number(detail.id);
  if (!Number.isFinite(eventId) || eventId <= 0) return false;
  const symbol = String(detail.symbol || "XAUUSD").trim().toUpperCase() || "XAUUSD";
  const summary = buildInsightAssistantEventSummary(detail);
  setInsightAssistantContext(
    {
      source: "event",
      eventId,
      symbols: [symbol],
      summary,
      note: `围绕事件 #${eventId} 连续追问`,
    },
    { announce: true },
  );
  if (switchTab) {
    setActiveTab("insight-chat");
  }
  if (prefill && el.insightAssistantInput) {
    el.insightAssistantInput.value = `继续分析事件 #${eventId}：请给我“结论、证据、反证、下一步动作”四段结构。`;
    el.insightAssistantInput.focus({ preventScroll: true });
  }
  return true;
}

async function pinInsightAssistantContextByEventId(eventId, { switchTab = true, prefill = true } = {}) {
  const numericId = Number(eventId);
  if (!Number.isFinite(numericId) || numericId <= 0) return false;
  const localCandidates = [state.currentInsightDetail, state.currentDashboardInsightDetail].filter(
    (item) => Number(item?.id) === numericId,
  );
  const cached = localCandidates[0];
  if (cached && applyInsightAssistantEventContext(cached, { switchTab, prefill })) {
    return true;
  }
  try {
    const detail = await fetchJson(`/api/insight/events/${numericId}`, { timeoutMs: 12000 });
    return applyInsightAssistantEventContext(detail, { switchTab, prefill });
  } catch (err) {
    console.error(err);
    setInsightAssistantTip(`无法读取事件 #${numericId} 详情，请稍后重试。`, true);
    return false;
  }
}

function buildInsightAiRuntimeBody(options = {}) {
  const includeModel = Boolean(options.includeModel);
  const body = {};
  const aiBaseUrl = String(el.insightAiBaseUrl?.value || "").trim();
  const aiApiKey = String(el.insightAiApiKey?.value || "").trim();
  const aiModel = String(el.insightAiModel?.value || "").trim();
  if (aiBaseUrl) {
    body.ai_base_url = aiBaseUrl;
  }
  if (aiApiKey) {
    body.ai_api_key = aiApiKey;
  }
  if (includeModel && aiModel) {
    body.ai_model = aiModel;
  }
  return { body, aiBaseUrl, aiApiKey, aiModel };
}

function normalizeInsightAiError(rawDetail) {
  const raw = String(rawDetail || "").trim();
  if (!raw) {
    return {
      summary: "请求失败，未返回可识别错误信息。",
      hints: [],
    };
  }
  const hints = [];
  let summary = raw;
  const lower = raw.toLowerCase();
  if (raw.includes("413")) {
    summary = "请求体超出上游网关限制（413 Payload Too Large）。";
    hints.push("更换支持更大请求体的网关，或减少提示词长度。");
  } else if (raw.includes("401") || lower.includes("unauthorized")) {
    summary = "鉴权失败（401），AI Key 不可用或格式不正确。";
    hints.push("核对 API Key 是否完整、是否属于当前网关。");
  } else if (raw.includes("403") || lower.includes("forbidden") || lower.includes("error code: 1010")) {
    summary = "请求被上游网关拒绝（403 / 1010）。";
    hints.push("检查 key 权限、IP/地区限制、WAF 或模型白名单策略。");
  } else if (raw.includes("404") || raw.includes("405")) {
    summary = "接口路径不可用（404/405），Base URL 可能填写不正确。";
    hints.push("将 Base URL 调整为网关根路径（通常在 /v1 或其上一级）。");
  } else if (raw.includes("429") || lower.includes("rate")) {
    summary = "请求频率受限（429），触发了上游限流。";
    hints.push("稍后重试，或提升上游套餐/限流阈值。");
  } else if (lower.includes("timed out") || lower.includes("timeout")) {
    summary = "上游响应超时，请求未在时限内返回。";
    hints.push("检查网关连通性，或更换更稳定线路。");
  } else if (raw.includes("CERTIFICATE_VERIFY_FAILED") || lower.includes("ssl")) {
    summary = "HTTPS 证书校验失败。";
    hints.push("确认网关证书链完整且可被当前系统信任。");
  }
  return { summary, hints, raw };
}

function setInsightAiActionStatus(state = "idle", message = "", details = []) {
  if (!el.insightAiActionStatus) return;
  const badgeTextByState = {
    idle: "未测试",
    loading: "测试中",
    success: "成功",
    error: "失败",
  };
  const root = el.insightAiActionStatus;
  root.classList.remove("state-loading", "state-success", "state-error");
  if (state === "loading") root.classList.add("state-loading");
  if (state === "success") root.classList.add("state-success");
  if (state === "error") root.classList.add("state-error");

  const timestamp = new Date();
  const timeText = timestamp.toLocaleTimeString("zh-CN", { hour12: false });

  root.innerHTML = "";
  const head = document.createElement("div");
  head.className = "insight-ai-action-head";
  const badge = document.createElement("span");
  badge.className = "insight-ai-action-badge";
  badge.textContent = badgeTextByState[state] || badgeTextByState.idle;
  const timeEl = document.createElement("time");
  timeEl.className = "insight-ai-action-time";
  timeEl.dateTime = timestamp.toISOString();
  timeEl.textContent = timeText;
  head.appendChild(badge);
  head.appendChild(timeEl);
  root.appendChild(head);

  const msg = document.createElement("p");
  msg.className = "insight-ai-action-message";
  msg.textContent = String(message || "点击“测试 AI Key”后将在此显示结果。");
  root.appendChild(msg);

  const filteredDetails = Array.isArray(details)
    ? details
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          label: String(item.label || "").trim(),
          value: String(item.value ?? "").trim(),
        }))
        .filter((item) => item.label && item.value)
    : [];
  if (filteredDetails.length > 0) {
    const meta = document.createElement("dl");
    meta.className = "insight-ai-action-meta";
    for (const item of filteredDetails) {
      const wrap = document.createElement("div");
      wrap.className = "insight-ai-action-meta-item";
      const dt = document.createElement("dt");
      dt.textContent = item.label;
      const dd = document.createElement("dd");
      dd.textContent = item.value;
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      meta.appendChild(wrap);
    }
    root.appendChild(meta);
  }
}

function resetInsightAiActionStatus(payload = null) {
  const model = String(payload?.ai_model || el.insightAiModel?.value || "").trim();
  const baseUrl = String(payload?.ai_base_url || el.insightAiBaseUrl?.value || "").trim();
  const detailRows = [];
  if (model) {
    detailRows.push({ label: "当前模型", value: model });
  }
  if (baseUrl) {
    detailRows.push({ label: "Base URL", value: baseUrl });
  }
  setInsightAiActionStatus("idle", "点击“测试 AI Key”后将在当前窗口即时显示结果。", detailRows);
}

function setDashboardInsightTip(text, isError = false) {
  if (!el.dashboardInsightTip) return;
  el.dashboardInsightTip.textContent = text;
  el.dashboardInsightTip.style.color = isError ? "#d12f3f" : "";
}

function insightTriggerButtons() {
  return [el.btnInsightTrigger, el.insightManualTriggerBtn].filter(
    (button) => button instanceof HTMLButtonElement,
  );
}

function insightTriggerCooldownRemainingSec() {
  const remainMs = Math.max(0, Number(state.insightTriggerCooldownUntil || 0) - Date.now());
  return Math.ceil(remainMs / 1000);
}

function clearInsightTriggerCooldownTimer() {
  if (state.insightTriggerCooldownTimer) {
    clearInterval(state.insightTriggerCooldownTimer);
    state.insightTriggerCooldownTimer = null;
  }
}

function syncInsightTriggerButtons() {
  const remaining = insightTriggerCooldownRemainingSec();
  const busy = Boolean(state.insightTriggerBusy);
  for (const button of insightTriggerButtons()) {
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = String(button.textContent || "").trim() || "开始AI分析";
    }
    const baseLabel = String(button.dataset.defaultLabel || "开始AI分析");
    if (busy) {
      button.disabled = true;
      button.textContent = "AI分析进行中...";
      continue;
    }
    if (remaining > 0) {
      button.disabled = true;
      button.textContent = `冷却中 ${remaining}s`;
      continue;
    }
    button.disabled = false;
    button.textContent = baseLabel;
  }
}

function startInsightTriggerCooldown(seconds = 90) {
  const duration = Math.max(1, Number(seconds) || 90);
  state.insightTriggerCooldownUntil = Date.now() + duration * 1000;
  clearInsightTriggerCooldownTimer();
  syncInsightTriggerButtons();
  state.insightTriggerCooldownTimer = window.setInterval(() => {
    if (insightTriggerCooldownRemainingSec() <= 0) {
      state.insightTriggerCooldownUntil = 0;
      clearInsightTriggerCooldownTimer();
    }
    syncInsightTriggerButtons();
  }, 1000);
}

function setInsightRunnerPanel(status, text, { isError = false, eventId = null } = {}) {
  if (!el.insightRunnerPanel || !el.insightRunnerText) return;
  if (eventId !== null && Number.isFinite(Number(eventId))) {
    state.latestTriggeredInsightEventId = Number(eventId);
  }
  el.insightRunnerPanel.classList.remove("hidden", "state-running", "state-success", "state-error");
  if (status === "running") {
    el.insightRunnerPanel.classList.add("state-running");
  } else if (status === "success") {
    el.insightRunnerPanel.classList.add("state-success");
  } else if (status === "error") {
    el.insightRunnerPanel.classList.add("state-error");
  }
  el.insightRunnerText.textContent = text;
  el.insightRunnerText.style.color = isError ? "#d12f3f" : "";
}

function hideInsightRunnerPanel() {
  if (!el.insightRunnerPanel) return;
  el.insightRunnerPanel.classList.add("hidden");
}

function setGlobalInsightFeedback(text, { isError = false, panelState = "running", eventId = null } = {}) {
  setDashboardInsightTip(text, isError);
  setInsightTip(text, isError);
  setInsightRunnerPanel(panelState, text, { isError, eventId });
}

function setBacktestTip(text, isError = false) {
  if (!el.backtestTip) return;
  el.backtestTip.textContent = text;
  el.backtestTip.style.color = isError ? "#d12f3f" : "";
}

function setBacktestCompareTip(text, isError = false) {
  if (!el.backtestCompareTip) return;
  el.backtestCompareTip.textContent = text;
  el.backtestCompareTip.style.color = isError ? "#d12f3f" : "";
}

function updateBacktestCompareSortUi() {
  if (el.backtestCompareSortStatus) {
    el.backtestCompareSortStatus.textContent = `当前排序：${state.backtestCompareSort.label}`;
  }
  for (const button of el.backtestSortButtons || []) {
    const key = String(button.dataset.backtestSortKey || "");
    const order = String(button.dataset.backtestSortOrder || "");
    const active = key === state.backtestCompareSort.key && order === state.backtestCompareSort.order;
    button.classList.toggle("active", active);
  }
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

function dashboardVisible() {
  return state.activeTab === "dashboard";
}

function readChartHostMetrics(node) {
  if (!(node instanceof HTMLElement)) return null;
  const rect = node.getBoundingClientRect();
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    display: window.getComputedStyle(node).display,
    visibility: window.getComputedStyle(node).visibility,
  };
}

function chartHostReady(node) {
  const metrics = readChartHostMetrics(node);
  return Boolean(metrics && metrics.width > 32 && metrics.height > 48 && metrics.display !== "none" && metrics.visibility !== "hidden");
}

function ensureChartInstance(node, currentChart, label) {
  if (!(node instanceof HTMLElement)) return currentChart;
  if (currentChart && !currentChart.isDisposed && typeof currentChart.resize === "function") return currentChart;
  if (!chartHostReady(node) || typeof echarts === "undefined") return currentChart;
  try {
    const instance = echarts.getInstanceByDom(node) || echarts.init(node);
    bindChartInteractionLock(instance);
    return instance;
  } catch (error) {
    console.error("[chart] init FAILED:", label, error && error.message ? error.message : error);
    return currentChart;
  }
}

function ensureDashboardCharts() {
  chartIntl = ensureChartInstance(document.getElementById("chart-intl"), chartIntl, "chart-intl");
  chartDomestic = ensureChartInstance(document.getElementById("chart-domestic"), chartDomestic, "chart-domestic");
  chartDual = ensureChartInstance(document.getElementById("chart-dual"), chartDual, "chart-dual");
  bindDashboardChartEvents();
}

function ensureAuxCharts() {
  chartYFinance = ensureChartInstance(el.yfinanceChart, chartYFinance, "chart-yfinance");
  chartBacktestEquity = ensureChartInstance(el.backtestEquityChart, chartBacktestEquity, "chart-backtest-equity");
}

function scheduleChartRetry(reason) {
  if (chartRetryTimer) return;
  chartRetryTimer = window.setTimeout(() => {
    chartRetryTimer = null;
    ensureDashboardCharts();
    ensureAuxCharts();
    if (dashboardVisible()) {
      renderActiveCharts({ force: true });
    }
    if (state.yfinance && state.yfinance.payload) {
      renderYFinanceChart(state.yfinance.payload);
    }
    if (state.backtest) {
      renderBacktestEquityCurve(state.backtest);
    }
  }, 160);
  if (reason) {
    console.debug("[chart] deferred repaint:", reason);
  }
}

function setChartInteractionLock(active) {
  state.chartInteraction.active = Boolean(active);
  if (!state.chartInteraction.active && state.chartInteraction.pendingRepaint) {
    state.chartInteraction.pendingRepaint = false;
    renderActiveCharts({ force: true });
  }
}

function bindChartInteractionLock(chart) {
  if (!chart || chart.__gmInteractionBound || typeof chart.getZr !== "function") return;
  const zr = chart.getZr();
  if (!zr || typeof zr.on !== "function") return;
  zr.on("mousemove", () => setChartInteractionLock(true));
  zr.on("globalout", () => setChartInteractionLock(false));
  chart.__gmInteractionBound = true;
}

function bindDashboardChartEvents() {
  bindDashboardChartEvent(chartIntl, "intl");
  bindDashboardChartEvent(chartDomestic, "domestic");
  bindDashboardChartEvent(chartDual, "dual");
}

function bindDashboardChartEvent(chart, kind) {
  if (!chart || chart.__gmDashboardBound === kind) return;
  chart.__gmDashboardBound = kind;
  chart.on("click", handleDashboardChartClick);
  chart.on("datazoom", () => handleDashboardChartZoom(kind));
}

function handleDashboardChartClick(params) {
  const eventId = params?.data?.eventId;
  if (!eventId) return;
  loadDashboardEventDetail(eventId);
}

function handleDashboardChartZoom(kind) {
  const chart = kind === "intl" ? chartIntl : kind === "domestic" ? chartDomestic : chartDual;
  const zoom = readChartZoom(chart);
  if (!zoom) return;
  state.zoom = zoom;
  if (kind === "intl") {
    if (state.layout !== "dual-axis" && !syncSplitZoom) {
      syncSplitZoom = true;
      applyZoomToChart(chartDomestic, zoom.start, zoom.end);
      if (state.layout === "all") applyZoomToChart(chartDual, zoom.start, zoom.end);
      syncSplitZoom = false;
    }
    return;
  }
  if (kind === "domestic") {
    if (state.layout !== "dual-axis" && !syncSplitZoom) {
      syncSplitZoom = true;
      applyZoomToChart(chartIntl, zoom.start, zoom.end);
      if (state.layout === "all") applyZoomToChart(chartDual, zoom.start, zoom.end);
      syncSplitZoom = false;
    }
    return;
  }
  if (state.layout === "all" && !syncSplitZoom) {
    syncSplitZoom = true;
    applyZoomToChart(chartIntl, zoom.start, zoom.end);
    applyZoomToChart(chartDomestic, zoom.start, zoom.end);
    syncSplitZoom = false;
  }
}

function renderActiveCharts({ force = false } = {}) {
  console.log('[chart] renderActiveCharts called, dashboardVisible:', dashboardVisible(), 'layout:', state.layout, 'bars:', state.intl.bars?.length, state.domestic.bars?.length);
  if (!dashboardVisible()) return;
  ensureDashboardCharts();
  if (!force && state.chartInteraction.active) {
    state.chartInteraction.pendingRepaint = true;
    return;
  }
  if (!chartIntl && !chartDomestic && !chartDual) {
    scheduleChartRetry("charts not ready");
    return;
  }
  if (state.layout === "dual-axis") {
    renderDualChart();
  } else if (state.layout === "all") {
    renderSplitCharts();
    renderDualChart();
  } else {
    renderSplitCharts();
  }
  renderChartTimeRanges();
}

function repaintDashboardCharts() {
  if (chartRepaintFrame) {
    cancelAnimationFrame(chartRepaintFrame);
  }
  chartRepaintFrame = requestAnimationFrame(() => {
    chartRepaintFrame = requestAnimationFrame(() => {
      ensureDashboardCharts();
      renderActiveCharts({ force: true });
      chartRepaintFrame = 0;
    });
  });
}

function repaintAuxCharts() {
  if (auxChartRepaintFrame) {
    cancelAnimationFrame(auxChartRepaintFrame);
  }
  auxChartRepaintFrame = requestAnimationFrame(() => {
    auxChartRepaintFrame = requestAnimationFrame(() => {
      ensureAuxCharts();
      if (chartYFinance && typeof chartYFinance.resize === "function") {
        chartYFinance.resize();
      }
      if (chartBacktestEquity && typeof chartBacktestEquity.resize === "function") {
        chartBacktestEquity.resize();
      }
      if (state.yfinance && state.yfinance.payload) {
        renderYFinanceChart(state.yfinance.payload);
      }
      if (state.backtest) {
        renderBacktestEquityCurve(state.backtest);
      }
      auxChartRepaintFrame = 0;
    });
  });
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
      desc: "先生成邀请码或新增用户，再做权限和密码安全管理。",
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
      desc: "先看数据源健康，再查登录审计，最后回到设置中心修复配置。",
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
    title: "部署配置",
    desc: "编辑运行参数、认证与 SMTP。",
    steps: [
      { title: "1. 编辑部署配置", detail: "统一修改轮询、认证、会话与SMTP参数。" },
      { title: "2. 保存并验证", detail: "保存后先看提示，再到状态审计核验效果。" },
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
      desc: "先建规则，再看告警。",
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
      desc: "先跑单规则，再做对比。",
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
      desc: "输入代码后加载行情。",
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
      desc: "编辑配置并发送测试。",
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
      desc: "配置策略并查看事件。",
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
      desc: "配置连接并测试。",
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
      desc: "直接提问并查看上下文。",
      steps: [
        { title: "1. 打开对话页", detail: "直接提问黄金走势、新闻影响或策略判断。" },
        { title: "2. 快捷键发送", detail: "Enter 换行，⌘+Enter（或 Ctrl+Enter）发送。" },
        { title: "3. 看上下文提示", detail: "回复完成后会显示本次回答使用的数据上下文。" },
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
    desc: "刷新行情、触发 AI、查看事件。",
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
  el.workspaceRespTitle.textContent = `${cfg.page} · 责任卡`;
  el.workspaceRespBreadcrumb.textContent = `${cfg.module} / ${cfg.page}`;
  el.workspaceRespContainer.textContent = `容器：${cfg.container}`;
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
    repaintDashboardCharts();
    repaintAuxCharts();
  } else if (next === "lab") {
    repaintAuxCharts();
  } else if (next === "yfinance") {
    repaintAuxCharts();
    void refreshYFinance({ silent: true });
  } else if (next === "deploy") {
    setDeployView(state.deployView || "settings", { writeHash: false });
  } else if (next === "insight-chat") {
    void loadInsightAssistantHistory({ silent: true });
  }
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

function priceMap(items) {
  const map = {};
  for (const item of items || []) {
    map[item.symbol] = item;
  }
  return map;
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

function insightStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "queued") return "待处理";
  if (normalized === "running") return "分析中";
  if (normalized === "completed") return "已完成";
  if (normalized === "insufficient") return "证据不足";
  if (normalized === "failed") return "失败";
  return normalized || "--";
}

function insightStageLabel(stage) {
  const normalized = String(stage || "").toLowerCase();
  if (normalized === "queued") return "排队中";
  if (normalized === "running") return "线程接单";
  if (normalized === "collecting_news") return "抓取新闻";
  if (normalized === "news_ready") return "新闻筛选完成";
  if (normalized === "ai_request") return "请求模型";
  if (normalized === "ai_streaming") return "流式生成";
  if (normalized === "ai_parsed") return "整理结构化结果";
  if (normalized === "retry_wait") return "等待重试";
  if (normalized === "completed") return "已完成";
  if (normalized === "insufficient") return "证据不足";
  if (normalized === "failed") return "失败";
  return normalized || "--";
}

function insightTriggerTypeLabel(triggerType) {
  const normalized = String(triggerType || "").toLowerCase();
  if (normalized === "fast_move") return "急速触发";
  if (normalized === "short_move") return "短时触发";
  if (normalized === "periodic") return "周期触发";
  if (normalized === "manual") return "手动触发";
  return normalized || "未知触发";
}

function isInsightDoneStatus(status) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "completed" || normalized === "failed" || normalized === "insufficient";
}

function isInsightLiveStatus(status) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "queued" || normalized === "running";
}

function trimInsightStreamText(text, maxChars = 5200) {
  const raw = String(text || "");
  if (!raw) return "";
  const limit = Math.max(400, Number(maxChars) || 5200);
  if (raw.length <= limit) return raw;
  return `...（仅展示最近 ${limit} 字）\n${raw.slice(-limit)}`;
}

function normalizeInsightProgressPayload(progress, fallbackDetail = null) {
  const source = progress && typeof progress === "object" ? progress : null;
  const fallback = fallbackDetail && typeof fallbackDetail === "object" ? fallbackDetail : null;
  const status = String(source?.status || fallback?.status || "").trim().toLowerCase();
  if (!status) return null;
  const stage = String(source?.stage || status).trim().toLowerCase();
  const stageDetail = String(source?.stage_detail || "").trim();
  const done = Boolean(source?.done) || isInsightDoneStatus(status);
  const diagnostics =
    source?.diagnostics && typeof source.diagnostics === "object"
      ? source.diagnostics
      : fallback?.result?.diagnostics && typeof fallback.result.diagnostics === "object"
        ? fallback.result.diagnostics
        : {};
  return {
    event_id: Number(source?.event_id || fallback?.id || 0),
    status,
    stage,
    message: String(source?.message || "").trim(),
    stream_text: String(source?.stream_text || ""),
    error: String(source?.error || fallback?.error || "").trim(),
    done,
    updated_at: String(source?.updated_at || ""),
    summary: String(source?.summary || fallback?.summary || "").trim(),
    symbol: String(source?.symbol || fallback?.symbol || ""),
    direction: String(source?.direction || fallback?.direction || ""),
    triggered_at: String(source?.triggered_at || fallback?.triggered_at || ""),
    diagnostics,
    stage_detail: stageDetail,
    degraded_mode: Boolean(source?.degraded_mode),
  };
}

function mergeInsightDetailWithProgress(detail, progress) {
  const base = detail && typeof detail === "object" ? { ...detail } : {};
  const normalized = normalizeInsightProgressPayload(progress, base);
  if (!normalized) return base;
  const next = { ...base };
  if (!Number.isFinite(Number(next.id)) && Number.isFinite(Number(normalized.event_id))) {
    next.id = Number(normalized.event_id);
  }
  if (!next.symbol && normalized.symbol) next.symbol = normalized.symbol;
  if (!next.direction && normalized.direction) next.direction = normalized.direction;
  if (!next.triggered_at && normalized.triggered_at) next.triggered_at = normalized.triggered_at;
  if (!next.summary && normalized.summary) next.summary = normalized.summary;
  if (normalized.error && !next.error) next.error = normalized.error;
  next.status = normalized.status || next.status;
  next.progress = normalized;
  return next;
}

function renderInsightProgressCard(progress, { compact = false } = {}) {
  const normalized = normalizeInsightProgressPayload(progress);
  if (!normalized || !isInsightLiveStatus(normalized.status) || normalized.done) return "";
  const title = normalized.status === "queued" ? "任务排队中" : "实时分析中";
  const message = normalized.message || (normalized.status === "queued" ? "任务已进入队列，等待工作线程处理。" : "AI 正在生成分析内容。");
  const updatedAtText = normalized.updated_at ? formatLocalTime(normalized.updated_at) : "--";
  const stageText = normalized.stage_detail || insightStageLabel(normalized.stage);
  const degradedTag = normalized.degraded_mode ? " · 已降级普通请求" : "";
  const streamText = trimInsightStreamText(normalized.stream_text, compact ? 2600 : 5200);
  const streamHtml = streamText
    ? `<pre class="insight-progress-stream">${escapeHtml(streamText)}</pre>`
    : `<p class="meta insight-progress-placeholder">${
        normalized.status === "queued" ? "等待进入执行阶段后开始输出分析内容。" : "已进入执行阶段，等待模型返回首段文本。"
      }</p>`;
  return `
    <section class="insight-progress-card ${compact ? "compact" : ""}">
      <div class="insight-progress-head">
        <h4>${escapeHtml(title)}</h4>
        <span class="tag">${escapeHtml(insightStatusLabel(normalized.status))}</span>
      </div>
      <p>${escapeHtml(message)}</p>
      <p class="meta">阶段：${escapeHtml(stageText)}${escapeHtml(degradedTag)} · 更新时间：${escapeHtml(updatedAtText)}</p>
      ${streamHtml}
    </section>
  `;
}

function buildCardMetaHtml(item) {
  if (!item) return "暂无可用报价";
  const source = escapeHtml(labelSource(item.source));
  const freshness = escapeHtml(freshnessText(item.freshness_status));
  const freshnessCls = freshnessClass(item.freshness_status);
  const age = formatAge(item.age_sec);
  const changedAt = formatLocalTime(item.last_changed_at || item.ts);
  const expected = formatAge(item.expected_update_sec);
  const staleTag = item.stale ? " · 数据偏旧" : "";
  return `<span class="meta-top">${source}<span class="freshness-badge ${freshnessCls}">${freshness}</span>${escapeHtml(staleTag)}</span><span class="meta-line">数据年龄 ${escapeHtml(age)} · 理论更新 ${escapeHtml(expected)} · 最后变化 ${escapeHtml(changedAt)}</span>`;
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

function getLatestRulePrice(symbol) {
  const row = state.latestMap?.[symbol];
  if (!row) return null;
  const value = Number(row.price);
  return Number.isFinite(value) ? value : null;
}

function fillRuleByCurrentPrice(multiplier) {
  const symbol = document.getElementById("rule-symbol").value;
  const current = getLatestRulePrice(symbol);
  if (current === null) {
    setRuleTip("暂无最新价格，无法自动填充阈值。", true);
    return;
  }
  const next = current * multiplier;
  document.getElementById("rule-threshold").value = next.toFixed(2);
  setRuleTip(`已按现价 ${fmtNumber(current, 2)} 自动填入阈值 ${next.toFixed(2)}。`);
}

function renderNotifyPreview() {
  if (!el.notifyPreview) return;
  if (!el.cfgTitlePrefix) return; // Skip on non-system pages
  const prefix = (el.cfgTitlePrefix.value || "").trim();
  const style = el.cfgNotifyStyle.value || "detailed";
  const title = prefix ? `${prefix} · 金价阈值触发` : "金价阈值触发";

  const lines = [];
  if (style === "compact") {
    lines.push(`## ${prefix ? `${prefix} · 阈值触发` : "阈值触发"}`);
    lines.push("> 国际现货金 现价 `4521.20`，触发 `gte 4500`");
    lines.push("> 时间: `2026-03-26T13:00:00+08:00`");
  } else {
    lines.push(`## ${title}`);
    lines.push("> 规则ID: `12`");
    lines.push("> 标的: `国际现货金`");
    lines.push("> 条件: `gte 4500`");
    lines.push("> 现价: `4521.20 USD/oz`");
    lines.push("> 时间: `2026-03-26T13:00:00+08:00`");
    lines.push("> 来源: `gold_api_xau`");
  }
  lines.push("");
  lines.push(
    `事件开关：触发(${el.cfgNotifyTrigger.value === "true" ? "开" : "关"}) / 恢复(${el.cfgNotifyRecover.value === "true" ? "开" : "关"}) / 源状态(${el.cfgNotifySource.value === "true" ? "开" : "关"}) / 心跳(${el.cfgNotifyHeartbeat.value === "true" ? "开" : "关"})`,
  );

  el.notifyPreview.textContent = lines.join("\n");
}

function updateCards(payload) {
  const map = priceMap(payload.items || []);
  state.latestMap = map;
  const intl = map.XAUUSD;
  const domestic = map.AUCN;
  const fx = map.USDCNY;

  const dayChangeIntl = calcVsPreviousClose(state.intlDailyBars || state.intl.bars || [], intl?.price);
  const dayChangeDomestic = calcVsPreviousClose(state.domesticDailyBars || state.domestic.bars || [], domestic?.price);

  document.getElementById("price-intl").textContent = intl ? `${fmtNumber(intl.price, 2)} 美元/盎司` : "--";
  document.getElementById("meta-intl").innerHTML = buildCardMetaHtml(intl);
  if (el.changeIntl) {
    el.changeIntl.textContent = formatVsPreviousCloseText(dayChangeIntl, "美元/盎司");
    applyDayChangeClass(el.changeIntl, dayChangeIntl);
  }

  document.getElementById("price-domestic").textContent = domestic ? `${fmtNumber(domestic.price, 2)} 元/克` : "--";
  document.getElementById("meta-domestic").innerHTML = buildCardMetaHtml(domestic);
  if (el.changeDomestic) {
    el.changeDomestic.textContent = formatVsPreviousCloseText(dayChangeDomestic, "元/克");
    applyDayChangeClass(el.changeDomestic, dayChangeDomestic);
  }

  document.getElementById("price-fx").textContent = fx ? `${fmtNumber(fx.price, 4)}` : "--";
  document.getElementById("meta-fx").innerHTML = buildCardMetaHtml(fx);

  if (payload.spread && payload.spread.available) {
    const spread = payload.spread;
    const sign = spread.spread_cny_g >= 0 ? "+" : "";
    document.getElementById("price-spread").textContent = `${sign}${fmtNumber(spread.spread_cny_g, 2)} 元/克`;
    document.getElementById("meta-spread").textContent = `${fmtNumber(spread.spread_rate_pct, 2)}%（理论价 ${fmtNumber(spread.theoretical_domestic_cny_g, 2)} 元/克）`;
  } else {
    document.getElementById("price-spread").textContent = "--";
    document.getElementById("meta-spread").textContent = "国际金价或汇率缺失，暂不计算";
  }

  const intlSignal = payload.forecast?.XAUUSD;
  const domesticSignal = payload.forecast?.AUCN;

  const intlEl = document.getElementById("signal-intl-bias");
  intlEl.textContent = BIAS_LABEL[intlSignal?.bias] || "震荡";
  intlEl.className = `signal-bias ${asBiasClass(intlSignal?.bias)}`;
  document.getElementById("signal-intl-reason").textContent = (intlSignal?.reasons || []).join(" | ") || "--";

  const domEl = document.getElementById("signal-dom-bias");
  domEl.textContent = BIAS_LABEL[domesticSignal?.bias] || "震荡";
  domEl.className = `signal-bias ${asBiasClass(domesticSignal?.bias)}`;
  document.getElementById("signal-dom-reason").textContent = (domesticSignal?.reasons || []).join(" | ") || "--";

  renderSourceStatus(payload.sources || []);
  el.lastUpdated.textContent = `最后刷新 ${new Date().toLocaleTimeString()}`;
}

function applyDayChangeClass(node, change) {
  if (!(node instanceof HTMLElement)) return;
  node.classList.remove("day-change", "up", "down", "flat");
  node.classList.add("day-change");
  if (!change || !Number.isFinite(Number(change.pct))) {
    node.classList.add("flat");
    return;
  }
  const pct = Number(change.pct);
  if (pct > 0) {
    node.classList.add("up");
    return;
  }
  if (pct < 0) {
    node.classList.add("down");
    return;
  }
  node.classList.add("flat");
}

function calcVsPreviousClose(bars, latestPrice) {
  const rows = Array.isArray(bars) ? [...bars] : [];
  if (rows.length < 2) return null;
  rows.sort((a, b) => String(a?.ts || "").localeCompare(String(b?.ts || "")));
  const closeByDay = new Map();
  for (const row of rows) {
    const day = String(row?.ts || "").slice(0, 10);
    const close = Number(row?.close);
    if (!day || !Number.isFinite(close) || close <= 0) continue;
    closeByDay.set(day, close);
  }
  const days = Array.from(closeByDay.keys());
  if (days.length < 2) return null;
  const previousClose = Number(closeByDay.get(days[days.length - 2]));
  const latestCloseInDaily = Number(closeByDay.get(days[days.length - 1]));
  const current = Number.isFinite(Number(latestPrice)) ? Number(latestPrice) : latestCloseInDaily;
  if (!Number.isFinite(previousClose) || previousClose === 0 || !Number.isFinite(current)) return null;
  const amount = current - previousClose;
  const pct = (amount / previousClose) * 100;
  return { pct, amount, previousClose };
}

function formatVsPreviousCloseText(change, unitLabel) {
  if (!change || !Number.isFinite(change.pct)) return "较昨收：样本不足";
  const sign = change.pct >= 0 ? "+" : "-";
  const amountSign = change.amount >= 0 ? "+" : "";
  const absPct = Math.abs(Number(change.pct));
  const pctText = absPct > 0 && absPct < 0.01 ? `${sign}<0.01` : `${sign}${fmtNumber(absPct, 2)}`;
  return `较昨收：${pctText}%（${amountSign}${fmtNumber(change.amount, 2)} ${unitLabel}）`;
}

function buildCandlesPayload(bars) {
  const x = [];
  const candle = [];
  const timeframe = String(state.timeframe || "1d").toLowerCase();
  for (const row of bars || []) {
    x.push(axisTimeKey(row.ts, timeframe));
    candle.push([roundTo(row.open, 2), roundTo(row.close, 2), roundTo(row.low, 2), roundTo(row.high, 2)]);
  }
  return { x, candle };
}

function axisTimeKey(value, timeframe = "1d") {
  const text = String(value || "");
  if (!text) return "";
  const tf = String(timeframe || "1d").toLowerCase();
  if (tf === "1d") return text.slice(0, 10);
  return text.slice(0, 16).replace("T", " ");
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

function closeByTimeKeyMap(bars, timeframe = "1d") {
  const map = new Map();
  for (const row of bars || []) {
    map.set(axisTimeKey(row.ts, timeframe), Number(row.close));
  }
  return map;
}

function eventsForSymbol(symbol) {
  return (state.overlayEvents || []).filter((item) => String(item.symbol || "").toUpperCase() === symbol);
}

function eventScatterSeries(symbol, bars, yAxisIndex = 0) {
  const timeframe = String(state.timeframe || "1d").toLowerCase();
  const closeMap = closeByTimeKeyMap(bars, timeframe);
  const data = eventsForSymbol(symbol)
    .map((event) => {
      const timeKey = alignEventTimeKey(event.triggered_at, timeframe);
      const close = closeMap.get(timeKey) ?? closeMap.get(axisTimeKey(event.triggered_at, "1d"));
      if (!Number.isFinite(close)) return null;
      const direction = String(event.direction || "").toLowerCase();
      const label = direction === "up" ? "涨" : "跌";
      return {
        value: [timeKey, roundTo(close, 2)],
        symbolSize: 16,
        itemStyle: { color: direction === "up" ? "#ef232a" : "#14b143" },
        eventId: event.id,
        yAxisIndex,
        label: `${label}${Math.abs(Number(event.change_pct || 0)).toFixed(1)}%`,
      };
    })
    .filter(Boolean);
  return {
    name: `${symbol}-AI事件`,
    type: "scatter",
    yAxisIndex,
    data,
    tooltip: {
      formatter: (params) => {
        const source = params?.data || {};
        return `AI事件 #${source.eventId || "--"}<br/>${source.label || ""}`;
      },
    },
  };
}

function axisIntervalBySize(size, desiredLabels = 8) {
  if (!Number.isFinite(size) || size <= 0) return 0;
  return Math.max(0, Math.ceil(size / desiredLabels) - 1);
}

function roundedSeries(series, digits = 2) {
  return (series || []).map((item) => (item === null || item === undefined ? null : roundTo(item, digits)));
}

function chartOptionForSplit(title, bars, indicatorPayload) {
  const { x, candle } = buildCandlesPayload(bars);
  const axisInterval = axisIntervalBySize(x.length, 9);
  const symbol = String(indicatorPayload?.symbol || "");
  const candleStyle = {
    color: "#ef232a",
    color0: "#14b143",
    borderColor: "#ef232a",
    borderColor0: "#14b143",
  };
  const series = [
    {
      name: title,
      type: "candlestick",
      data: candle,
      barMinWidth: 5,
      barMaxWidth: 16,
      itemStyle: candleStyle,
    },
  ];

  const indicatorSeries = indicatorPayload?.series || {};
  ["ma5", "ma20", "ma60"].forEach((key) => {
    series.push({
      name: key.toUpperCase(),
      type: "line",
      data: roundedSeries(indicatorSeries[key], 2),
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2, color: lineColor(key) },
    });
  });
  if (symbol) {
    series.push(eventScatterSeries(symbol, bars, 0));
  }

  return {
    animation: false,
    animationDuration: 0,
    grid: { left: 46, right: 20, top: 44, bottom: 58 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      valueFormatter: (value) => (value === null || value === undefined ? "--" : fmtNumber(value, 2)),
    },
    legend: { top: 8, itemWidth: 12, itemHeight: 7, textStyle: { fontSize: 11 } },
    xAxis: {
      type: "category",
      data: x,
      axisLine: { lineStyle: { color: "#9da5b5" } },
      axisLabel: {
        hideOverlap: true,
        interval: axisInterval,
        formatter: (value) => {
          const text = String(value || "");
          if (String(state.timeframe || "1d").toLowerCase() === "1d") return text.slice(5);
          return text.slice(5, 16);
        },
      },
    },
    yAxis: { scale: true, axisLabel: { formatter: (value) => fmtNumber(value, 2) }, splitLine: { show: false } },
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: [0],
        start: state.zoom.start,
        end: state.zoom.end,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: true,
      },
      {
        type: "slider",
        xAxisIndex: [0],
        start: state.zoom.start,
        end: state.zoom.end,
        bottom: 10,
        height: 18,
      },
    ],
    series,
  };
}

function paintChart(chart, option) {
  if (!chart) { console.warn("[chart] paintChart: chart is null"); return; }
  if (!option || !option.series) { console.warn("[chart] paintChart: invalid option", option); return; }
  const dom = typeof chart.getDom === "function" ? chart.getDom() : null;
  if (!chartHostReady(dom)) {
    scheduleChartRetry("chart host not ready");
    return;
  }
  chart.resize();
  chart.setOption(option, { notMerge: false, replaceMerge: ["series"], lazyUpdate: true });
  console.log("[chart] paintChart success, series count:", option.series?.length);
}

function renderSplitCharts() {
  console.log("[chart] renderSplitCharts called, intl bars:", state.intl.bars?.length, "domestic bars:", state.domestic.bars?.length, "chartIntl:", !!chartIntl, "chartDomestic:", !!chartDomestic);
  paintChart(chartIntl, chartOptionForSplit("国际现货金", state.intl.bars, state.intl.indicators));
  paintChart(chartDomestic, chartOptionForSplit("国内积存金", state.domestic.bars, state.domestic.indicators));
}

function renderDualChart() {
  const intlBars = state.intl.bars || [];
  const domBars = state.domestic.bars || [];
  const intlPayload = buildCandlesPayload(intlBars);
  const axisInterval = axisIntervalBySize(intlPayload.x.length, 9);
  const timeframe = String(state.timeframe || "1d").toLowerCase();
  const domesticMap = new Map(domBars.map((row) => [axisTimeKey(row.ts, timeframe), row.close]));
  const domesticLine = intlPayload.x.map((day) => {
    const value = domesticMap.get(day);
    return value === null || value === undefined ? null : roundTo(value, 2);
  });

  const option = {
    animation: false,
    animationDuration: 0,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      valueFormatter: (value) => (value === null || value === undefined ? "--" : fmtNumber(value, 2)),
    },
    legend: { top: 8, data: ["国际现货金K线", "国内积存金", "MA5", "MA20", "MA60"], textStyle: { fontSize: 11 } },
    grid: { left: 50, right: 54, top: 46, bottom: 58 },
    xAxis: {
      type: "category",
      data: intlPayload.x,
      axisLabel: {
        hideOverlap: true,
        interval: axisInterval,
        formatter: (value) => {
          const text = String(value || "");
          if (String(state.timeframe || "1d").toLowerCase() === "1d") return text.slice(5);
          return text.slice(5, 16);
        },
      },
    },
    yAxis: [
      { type: "value", scale: true, name: "美元/盎司", axisLabel: { formatter: (value) => fmtNumber(value, 2) }, splitLine: { show: false } },
      { type: "value", scale: true, name: "元/克", axisLabel: { formatter: (value) => fmtNumber(value, 2) } },
    ],
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: [0],
        start: state.zoom.start,
        end: state.zoom.end,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: true,
      },
      {
        type: "slider",
        xAxisIndex: [0],
        start: state.zoom.start,
        end: state.zoom.end,
        bottom: 10,
        height: 18,
      },
    ],
    series: [
      {
        name: "国际现货金K线",
        type: "candlestick",
        data: intlPayload.candle,
        yAxisIndex: 0,
        barMinWidth: 5,
        barMaxWidth: 16,
        itemStyle: {
          color: "#ef232a",
          color0: "#14b143",
          borderColor: "#ef232a",
          borderColor0: "#14b143",
        },
      },
      {
        name: "国内积存金",
        type: "line",
        data: domesticLine,
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.8, color: "#2f86ff" },
      },
      {
        name: "MA5",
        type: "line",
        data: roundedSeries(state.intl.indicators?.series?.ma5, 2),
        yAxisIndex: 0,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: lineColor("ma5") },
      },
      {
        name: "MA20",
        type: "line",
        data: roundedSeries(state.intl.indicators?.series?.ma20, 2),
        yAxisIndex: 0,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: lineColor("ma20") },
      },
      {
        name: "MA60",
        type: "line",
        data: roundedSeries(state.intl.indicators?.series?.ma60, 2),
        yAxisIndex: 0,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: lineColor("ma60") },
      },
      eventScatterSeries("XAUUSD", intlBars, 0),
      eventScatterSeries("AUCN", domBars, 1),
    ],
  };

  paintChart(chartDual, option);
}

function formatChartTimeRange(bars) {
  const tf = String(state.timeframe || "1d").toLowerCase();
  const tfLabel = tf === "1h" ? "小时线" : "日线";
  if (!Array.isArray(bars) || bars.length === 0) return "时间范围：--";
  const first = bars[0];
  const last = bars[bars.length - 1];
  const firstText = formatLocalTime(first?.ts);
  const lastText = formatLocalTime(last?.ts);
  return `时间范围（${tfLabel}）：${firstText} → ${lastText}（共 ${bars.length} 条）`;
}

function renderChartTimeRanges() {
  if (el.chartIntlTimeRange) {
    el.chartIntlTimeRange.textContent = formatChartTimeRange(state.intl.bars || []);
  }
  if (el.chartDomTimeRange) {
    el.chartDomTimeRange.textContent = formatChartTimeRange(state.domestic.bars || []);
  }
  if (el.chartDualTimeRange) {
    const intlBars = state.intl.bars || [];
    const domBars = state.domestic.bars || [];
    const combined = intlBars.length >= domBars.length ? intlBars : domBars;
    el.chartDualTimeRange.textContent = formatChartTimeRange(combined);
  }
}

function renderKlineTableRows(rows, targetBody, symbolLabel) {
  if (!(targetBody instanceof HTMLElement)) return;
  const bars = Array.isArray(rows) ? rows.slice(-20).reverse() : [];
  if (bars.length === 0) {
    targetBody.innerHTML = `<tr><td colspan="5" class="meta">${escapeHtml(symbolLabel)}暂无K线数据</td></tr>`;
    return;
  }
  targetBody.innerHTML = bars
    .map((bar) => {
      const ts = formatLocalTime(bar.ts);
      return `<tr>
        <td>${escapeHtml(ts)}</td>
        <td>${escapeHtml(fmtNumber(bar.open, 2))}</td>
        <td>${escapeHtml(fmtNumber(bar.high, 2))}</td>
        <td>${escapeHtml(fmtNumber(bar.low, 2))}</td>
        <td>${escapeHtml(fmtNumber(bar.close, 2))}</td>
      </tr>`;
    })
    .join("");
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
      return {
        ...row,
        open,
        high,
        low,
        close,
      };
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

function setKlineTableView(view) {
  const next = new Set(["all", "intl", "domestic"]).has(String(view || "").toLowerCase())
    ? String(view).toLowerCase()
    : "all";
  state.klineTableView = next;
  const showIntl = next === "all" || next === "intl";
  const showDomestic = next === "all" || next === "domestic";
  el.klineTableIntlWrap?.classList.toggle("hidden-display", !showIntl);
  el.klineTableDomWrap?.classList.toggle("hidden-display", !showDomestic);
  if (el.klineTableView) {
    el.klineTableView.value = next;
  }
}

function renderKlineTables() {
  renderKlineTableRows(state.intl.bars || [], el.klineTableIntlBody, "国际现货金");
  renderKlineTableRows(state.domestic.bars || [], el.klineTableDomBody, "国内积存金");
  setKlineTableView(state.klineTableView || "all");
}

function setLayout(layout) {
  const allowed = new Set(["split", "all", "intl", "domestic", "dual-axis"]);
  const next = allowed.has(String(layout || "").toLowerCase()) ? String(layout).toLowerCase() : "split";
  state.layout = next;

  const splitVisible = next !== "dual-axis";
  const dualVisible = next === "dual-axis" || next === "all";
  const showIntlSplit = next === "split" || next === "all" || next === "intl";
  const showDomesticSplit = next === "split" || next === "all" || next === "domestic";

  el.splitWrapper?.classList.toggle("hidden", !splitVisible);
  el.dualWrapper?.classList.toggle("hidden", !dualVisible);
  el.splitBoxIntl?.classList.toggle("hidden-display", !showIntlSplit || !splitVisible);
  el.splitBoxDomestic?.classList.toggle("hidden-display", !showDomesticSplit || !splitVisible);
  if (el.layout) {
    el.layout.value = next;
  }
  repaintDashboardCharts();
}

function renderRules(rules) {
  state.rules = rules || [];
  renderBacktestRuleOptions();
  renderBacktestCompareRuleOptions();
  if (!el.ruleList) return;
  if (!rules || rules.length === 0) {
    el.ruleList.innerHTML = `<div class="rule-item"><span>暂无规则</span><span class="tag">可在上方创建</span></div>`;
    return;
  }

  el.ruleList.innerHTML = rules
    .map(
      (rule) => `
      <div class="rule-item">
        <span>#${rule.id} ${labelSymbol(rule.symbol)} · ${escapeHtml(renderRuleClauseText(rule))}</span>
        <div class="rule-item-actions">
          <button type="button" class="mini-btn secondary-btn" data-action="toggle" data-id="${rule.id}">${rule.enabled ? "停用" : "启用"}</button>
          <button type="button" class="mini-btn danger-btn" data-action="delete" data-id="${rule.id}">删除</button>
        </div>
        <span class="tag">逻辑 ${String(rule.logic_operator || "and").toUpperCase()} · 冷却 ${rule.cooldown_sec}s · 防抖 ${rule.debounce_count} 次 · ${rule.enabled ? "启用" : "停用"}</span>
      </div>
    `,
    )
    .join("");
}

function renderAlerts(events) {
  if (!el.alertList) return;
  if (!events || events.length === 0) {
    el.alertList.innerHTML = `<div class="rule-item"><span>暂无事件</span><span class="tag">等待规则触发</span></div>`;
    return;
  }

  el.alertList.innerHTML = events
    .slice(0, 12)
    .map(
      (event) => `
      <div class="rule-item">
        <span>#${event.rule_id} ${event.status === "triggered" ? "触发" : "恢复"} @ ${fmtNumber(event.hit_price, 2)}</span>
        <span class="tag">${event.hit_time}</span>
      </div>
    `,
    )
    .join("");
}

function renderSourceStatus(items) {
  if (!el.sourceList) return;
  if (!items || items.length === 0) {
    el.sourceList.innerHTML = `<div class="source-item"><div class="meta">暂无数据源状态</div></div>`;
    return;
  }

  const symbolOrder = { XAUUSD: 1, AUCN: 2, USDCNY: 3 };
  const normalized = [...items].sort((a, b) => {
    const sa = symbolOrder[a.symbol] || 99;
    const sb = symbolOrder[b.symbol] || 99;
    if (sa !== sb) return sa - sb;
    return String(a.source_name).localeCompare(String(b.source_name), "zh-Hans-CN");
  });

  el.sourceList.innerHTML = normalized
    .map((item) => {
      const status = String(item.status || "").toLowerCase();
      const statusClass = status === "up" ? "up" : "down";
      const statusText = status === "up" ? "在线" : "离线";
      const lastOk = item.last_success_at ? `最近成功：${item.last_success_at}` : "最近成功：暂无";
      const errorText = item.last_error ? String(item.last_error) : "";
      const errorShort = errorText.length > 170 ? `${errorText.slice(0, 167)}...` : errorText;
      return `
      <div class="source-item">
        <div class="source-head">
          <strong>${labelSymbol(item.symbol)} · ${labelSource(item.source_name)}</strong>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="meta">${lastOk}</div>
        ${errorShort ? `<div class="source-error">错误：${errorShort}</div>` : ""}
      </div>
      `;
    })
    .join("");
}

function renderBacktestRuleOptions() {
  if (!el.backtestRuleId) return;
  const selected = String(el.backtestRuleId.value || "");
  const options = ['<option value="">请选择要回测的规则</option>'];
  for (const rule of state.rules || []) {
    const text = `#${rule.id} ${labelSymbol(rule.symbol)} · ${renderRuleClauseText(rule)}`;
    options.push(`<option value="${rule.id}">${escapeHtml(text)}</option>`);
  }
  el.backtestRuleId.innerHTML = options.join("");
  if (selected && (state.rules || []).some((item) => String(item.id) === selected)) {
    el.backtestRuleId.value = selected;
  }
}

function renderBacktestCompareRuleOptions() {
  if (!el.backtestCompareRuleIds) return;
  const selected = new Set(Array.from(el.backtestCompareRuleIds.selectedOptions || []).map((item) => String(item.value)));
  const options = [];
  for (const rule of state.rules || []) {
    const text = `#${rule.id} ${labelSymbol(rule.symbol)} · ${renderRuleClauseText(rule)}`;
    options.push(`<option value="${rule.id}">${escapeHtml(text)}</option>`);
  }
  el.backtestCompareRuleIds.innerHTML = options.join("");
  const allOptions = Array.from(el.backtestCompareRuleIds.options || []);
  if (selected.size > 0) {
    allOptions.forEach((option) => {
      option.selected = selected.has(String(option.value));
    });
  } else {
    allOptions.forEach((option, idx) => {
      option.selected = idx < 3;
    });
  }
}

function readBacktestCompareRuleIds() {
  if (!el.backtestCompareRuleIds) return [];
  return Array.from(el.backtestCompareRuleIds.selectedOptions || [])
    .map((item) => Number(item.value))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function renderBacktestEquityCurve(payload) {
  ensureAuxCharts();
  if (!chartBacktestEquity) {
    scheduleChartRetry("backtest chart not ready");
    return;
  }
  const strategyRows = Array.isArray(payload?.equity_curve) ? payload.equity_curve : [];
  const benchmarkRows = Array.isArray(payload?.benchmark_curve) ? payload.benchmark_curve : [];
  const rows = strategyRows;
  if (rows.length === 0) {
    paintChart(chartBacktestEquity, {
      animationDuration: 180,
      grid: { left: 46, right: 18, top: 30, bottom: 38 },
      xAxis: { type: "category", data: [] },
      yAxis: { type: "value", scale: true },
      series: [],
      graphic: {
        type: "text",
        left: "center",
        top: "middle",
        style: { text: "暂无资金曲线", fill: "#6b7485", fontSize: 13 },
      },
    });
    return;
  }
  const x = rows.map((item) => String(item.ts || "").slice(0, 10));
  const strategySeries = rows.map((item) => roundTo(item.equity, 4));
  const benchmarkMap = new Map(benchmarkRows.map((item) => [String(item.ts || "").slice(0, 10), roundTo(item.equity, 4)]));
  const benchmarkSeries = x.map((day) => benchmarkMap.get(day) ?? null);
  paintChart(chartBacktestEquity, {
    animationDuration: 280,
    grid: { left: 50, right: 20, top: 28, bottom: 44 },
    legend: { top: 2, itemWidth: 12, itemHeight: 7, textStyle: { fontSize: 11 } },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) => (value === null || value === undefined ? "--" : fmtNumber(value, 2)),
    },
    xAxis: {
      type: "category",
      data: x,
      axisLabel: {
        hideOverlap: true,
        interval: axisIntervalBySize(x.length, 8),
        formatter: (value) => String(value).slice(5),
      },
    },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: { formatter: (value) => fmtNumber(value, 2) },
      splitLine: { show: false },
    },
    series: [
      {
        name: "策略曲线",
        type: "line",
        data: strategySeries,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: "#1f7aff" },
        areaStyle: {
          color: "rgba(31, 122, 255, 0.14)",
        },
      },
      {
        name: "买入持有基准",
        type: "line",
        data: benchmarkSeries,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.8, color: "#7b8ca8", type: "dashed" },
      },
    ],
  });
}

function renderBacktestCompareResult(payload) {
  state.backtestCompare = payload;
  const rows = Array.isArray(payload?.rows) ? [...payload.rows] : [];
  const sortKey = String(state.backtestCompareSort?.key || "net_return_pct");
  const sortOrder = String(state.backtestCompareSort?.order || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  rows.sort((a, b) => {
    const av = Number(a?.[sortKey]);
    const bv = Number(b?.[sortKey]);
    const aValid = Number.isFinite(av);
    const bValid = Number.isFinite(bv);
    if (aValid && bValid) {
      if (av === bv) return Number(a?.rule_id || 0) - Number(b?.rule_id || 0);
      return sortOrder === "asc" ? av - bv : bv - av;
    }
    if (aValid && !bValid) return -1;
    if (!aValid && bValid) return 1;
    return Number(a?.rule_id || 0) - Number(b?.rule_id || 0);
  });
  if (!el.backtestCompareBody) return;
  if (rows.length === 0) {
    el.backtestCompareBody.innerHTML = '<tr><td colspan="10" class="meta">暂无可对比规则</td></tr>';
    return;
  }
  el.backtestCompareBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>#${escapeHtml(String(row.rule_id || "--"))} · ${escapeHtml(labelSymbol(row.symbol))}</td>
        <td title="${escapeHtml(row.clause_expression || "--")}">${escapeHtml(row.clause_expression || "--")}</td>
        <td>${escapeHtml(`${row.triggered_count ?? 0}/${row.recovered_count ?? 0}`)}</td>
        <td>${escapeHtml(fmtNumber(row.forward_1d_avg_pct, 2))}</td>
        <td>${escapeHtml(fmtNumber(row.forward_5d_avg_pct, 2))}</td>
        <td>${escapeHtml(fmtNumber(row.net_return_pct, 2))}</td>
        <td>${escapeHtml(fmtNumber(row.benchmark_return_pct, 2))}</td>
        <td>${escapeHtml(fmtNumber(row.alpha_return_pct, 2))}</td>
        <td>${escapeHtml(fmtNumber(row.max_drawdown_pct, 2))}</td>
        <td>${escapeHtml(fmtNumber(row.max_adverse_pct, 2))}</td>
      </tr>
    `,
    )
    .join("");
}

function renderBacktestResult(payload) {
  state.backtest = payload;
  const summary = payload?.summary || {};
  const summaryCards = [
    {
      title: "触发与恢复",
      text: `触发 ${summary.triggered_count ?? 0} 次 / 恢复 ${summary.recovered_count ?? 0} 次`,
    },
    {
      title: "样本覆盖",
      text: `${summary.sample_bars ?? 0} 根日K（${summary.sample_start ? formatLocalTime(summary.sample_start) : "--"} ~ ${summary.sample_end ? formatLocalTime(summary.sample_end) : "--"}）`,
    },
    {
      title: "前瞻收益均值",
      text: `1D ${fmtNumber(summary.forward_1d_avg_pct, 2)}% · 5D ${fmtNumber(summary.forward_5d_avg_pct, 2)}%`,
    },
    {
      title: "最大不利波动",
      text: `${fmtNumber(summary.max_adverse_pct, 2)}%`,
    },
    {
      title: "策略收益与回撤",
      text: `净收益 ${fmtNumber(summary.net_return_pct, 2)}% · 最大回撤 ${fmtNumber(summary.max_drawdown_pct, 2)}%`,
    },
    {
      title: "相对基准",
      text: `基准 ${fmtNumber(summary.benchmark_return_pct, 2)}% · 超额 ${fmtNumber(summary.alpha_return_pct, 2)}%`,
    },
  ];
  if (el.backtestSummary) {
    el.backtestSummary.innerHTML = summaryCards
      .map(
        (item) => `
        <section class="insight-subcard">
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.text)}</p>
        </section>
      `,
      )
      .join("");
  }
  renderBacktestEquityCurve(payload);

  const trades = Array.isArray(payload?.trades) ? payload.trades : [];
  if (el.backtestTradesBody) {
    if (trades.length === 0) {
      el.backtestTradesBody.innerHTML = '<tr><td colspan="7" class="meta">暂无触发明细</td></tr>';
    } else {
      el.backtestTradesBody.innerHTML = trades
        .map(
          (trade) => `
          <tr>
            <td>${escapeHtml(formatLocalTime(trade.trigger_time))}</td>
            <td>${escapeHtml(trade.direction || "--")}</td>
            <td>${escapeHtml(fmtNumber(trade.trigger_price, 2))}</td>
            <td>${trade.recover_time ? escapeHtml(formatLocalTime(trade.recover_time)) : "未恢复"}</td>
            <td>${escapeHtml(fmtNumber(trade.forward_1d_pct, 2))}</td>
            <td>${escapeHtml(fmtNumber(trade.forward_5d_pct, 2))}</td>
            <td>${escapeHtml(fmtNumber(trade.max_adverse_pct, 2))}</td>
          </tr>
        `,
        )
        .join("");
    }
  }
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

function renderInsightStrategyList(payload) {
  if (!el.insightStrategyList) return;
  const selected = new Set(
    Array.isArray(payload?.strategy_keys) ? payload.strategy_keys.map((item) => String(item || "").trim()) : [],
  );
  const catalog = Array.isArray(payload?.strategy_catalog) ? payload.strategy_catalog : [];
  if (catalog.length === 0) {
    el.insightStrategyList.innerHTML = '<div class="insight-strategy-empty">暂无可用策略模板</div>';
    return;
  }
  el.insightStrategyList.innerHTML = catalog
    .map((item) => {
      const key = String(item?.key || "").trim();
      if (!key) return "";
      const label = String(item?.label || key);
      const description = String(item?.description || "");
      const checked = selected.has(key) ? "checked" : "";
      return `
        <label class="insight-strategy-item">
          <input type="checkbox" data-insight-strategy="${escapeHtml(key)}" ${checked} />
          <span>
            <strong>${escapeHtml(label)}</strong>
            <small>${escapeHtml(description)}</small>
          </span>
        </label>
      `;
    })
    .join("");
}

function selectedInsightStrategies() {
  const rows = Array.from(document.querySelectorAll("input[data-insight-strategy]"));
  return rows
    .filter((node) => node instanceof HTMLInputElement && node.checked)
    .map((node) => String(node.getAttribute("data-insight-strategy") || "").trim())
    .filter(Boolean);
}

function renderDetectedModels(models = [], currentModel = "") {
  if (!el.insightAiModelSelect) return;
  const normalizedCurrent = String(currentModel || "").trim();
  const uniqueModels = [];
  const seen = new Set();
  for (const item of models || []) {
    const name = String(item || "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    uniqueModels.push(name);
  }
  if (normalizedCurrent && !seen.has(normalizedCurrent)) {
    uniqueModels.unshift(normalizedCurrent);
  }

  const header = uniqueModels.length > 0 ? "检测到的模型（可选）" : "检测到的模型（暂无）";
  el.insightAiModelSelect.innerHTML = [
    `<option value="">${escapeHtml(header)}</option>`,
    ...uniqueModels.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`),
  ].join("");

  if (normalizedCurrent) {
    el.insightAiModelSelect.value = normalizedCurrent;
  } else {
    el.insightAiModelSelect.value = "";
  }
}

function renderInsightSettings(payload) {
  if (!payload) return;
  if (!el.insightEnabled) return; // Skip on non-AI pages
  el.insightEnabled.value = payload.insight_enabled ? "true" : "false";
  el.insightPolicyMode.value = payload.source_policy_mode || "whitelist_preferred";
  el.insightMinAuthoritative.value = payload.min_authoritative_articles ?? 5;
  el.insightWhitelist.value = (payload.source_whitelist_domains || []).join("\n");
  if (el.insightCustomStrategies) {
    el.insightCustomStrategies.value = (payload.custom_strategy_lines || []).join("\n");
  }
  if (el.insightTriggerProfile) el.insightTriggerProfile.value = payload.trigger_profile || "balanced";
  if (el.insightFastWindowMinutes) el.insightFastWindowMinutes.value = payload.fast_move_window_minutes ?? 30;
  if (el.insightFastThresholdPct) el.insightFastThresholdPct.value = payload.fast_move_threshold_pct ?? 0.6;
  if (el.insightShortWindowMinutes) el.insightShortWindowMinutes.value = payload.short_move_window_minutes ?? 120;
  if (el.insightShortThresholdPct) el.insightShortThresholdPct.value = payload.short_move_threshold_pct ?? 1.0;
  if (el.insightPeriodicSummarySec) el.insightPeriodicSummarySec.value = payload.periodic_summary_sec ?? 7200;
  if (el.insightCooldownFastSec) el.insightCooldownFastSec.value = payload.cooldown_fast_sec ?? 1800;
  if (el.insightCooldownShortSec) el.insightCooldownShortSec.value = payload.cooldown_short_sec ?? 3600;
  if (el.insightCooldownPeriodicSec) el.insightCooldownPeriodicSec.value = payload.cooldown_periodic_sec ?? 7200;
  if (el.insightUpPct) el.insightUpPct.value = payload.up_pct ?? 2;
  if (el.insightDownPct) el.insightDownPct.value = payload.down_pct ?? 2;
  if (el.insightWindowMinutes) el.insightWindowMinutes.value = payload.window_minutes ?? 1440;
  if (el.insightCooldownSec) el.insightCooldownSec.value = payload.cooldown_sec ?? 3600;
  el.insightSymbols.value = (payload.insight_symbols || []).join(",");
  el.insightRssEnabled.value = payload.rss_enabled ? "true" : "false";
  el.insightNewsApiEnabled.value = payload.news_api_enabled ? "true" : "false";
  el.insightNewsApiBaseUrl.value = payload.news_api_base_url || "";
  el.insightNewsApiKey.value = "";
  el.insightNewsApiQueryParam.value = payload.news_api_query_param || "q";
  el.insightAiEnabled.value = payload.ai_enabled ? "true" : "false";
  el.insightAiBaseUrl.value = payload.ai_base_url || "";
  el.insightAiModel.value = payload.ai_model || "gpt-4o-mini";
  renderDetectedModels(payload.discovered_models || [], payload.ai_model || "");
  el.insightAiApiKey.value = "";
  el.insightNotifyEnabled.value = payload.insight_notify_enabled ? "true" : "false";
  el.insightNewsApiKey.placeholder = payload.news_api_key_masked
    ? `当前：${payload.news_api_key_masked}`
    : "新闻API Key（留空不修改）";
  el.insightAiApiKey.placeholder = payload.ai_api_key_masked
    ? `当前：${payload.ai_api_key_masked}`
    : "AI API Key（留空不修改）";
  renderInsightStrategyList(payload);
  if (el.insightPolicyPreview) {
    el.insightPolicyPreview.textContent = payload.strategy_preview || "暂无策略预览";
  }
  setInsightTip("AI策略配置已加载。");
  setInsightProviderTip("AI调用配置已加载。");
  resetInsightAiActionStatus(payload);
}

function renderInsightDetailEmpty(text = "选择事件后查看详情。", targetEl = null) {
  const target = targetEl || el.insightEventDetail;
  if (!target) return;
  target.innerHTML = `<div class="insight-detail-empty">${escapeHtml(text)}</div>`;
}

function normalizeTextArray(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const output = [];
  for (const item of value) {
    const cleaned = cleanInsightRichText(item, { maxChars: 260, compact: true });
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    output.push(cleaned);
  }
  return output;
}

function cleanInsightRichText(raw, { maxChars = 960, compact = false } = {}) {
  let text = String(raw || "").trim();
  if (!text) return "";
  text = text.replace(/\r\n?/g, "\n");
  text = text.replace(/https?:\/\/[^\s)\]]+/gi, (url) => {
    try {
      const host = new URL(url).hostname || "链接";
      return `[${host} 链接]`;
    } catch (_err) {
      return "[链接]";
    }
  });
  text = text.replace(/\s*\|\s*/g, compact ? "；" : "\n");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();
  const limit = Math.max(120, Number(maxChars) || 960);
  if (text.length > limit) {
    text = `${text.slice(0, limit)}…`;
  }
  return text;
}

function collectInsightEvidence(detail) {
  const top = Array.isArray(detail?.evidence) ? detail.evidence : [];
  if (top.length > 0) return top;
  const resultEvidence = Array.isArray(detail?.result?.evidence) ? detail.result.evidence : [];
  return resultEvidence;
}

function renderInsightListBlock(title, items, emptyText) {
  const values = normalizeTextArray(items);
  if (values.length === 0) {
    return `
      <section class="insight-subcard">
        <h4>${escapeHtml(title)}</h4>
        <p class="meta">${escapeHtml(emptyText)}</p>
      </section>
    `;
  }
  return `
    <section class="insight-subcard">
      <h4>${escapeHtml(title)}</h4>
      <ul class="insight-bullet-list">
        ${values.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function normalizeInsightDiagnostics(detail) {
  const result = detail && typeof detail.result === "object" ? detail.result : {};
  const diagnostics = result && typeof result.diagnostics === "object" ? result.diagnostics : {};
  return diagnostics;
}

function deriveInsightFailureInfo(detail) {
  if (!detail || typeof detail !== "object") return null;
  const diagnostics = normalizeInsightDiagnostics(detail);
  const rawError = String(detail.error || diagnostics.message || detail.confidence_reason || detail.summary || "").trim();
  const status = String(detail.status || "").toLowerCase();
  const looksFailed = status === "failed" || rawError.includes("AI分析失败");
  if (!looksFailed || !rawError) return null;
  const normalized = normalizeInsightAiError(rawError);
  return {
    summary: String(normalized.summary || rawError),
    hints: Array.isArray(normalized.hints) ? normalized.hints : [],
    raw: String(normalized.raw || rawError),
    diagnostics,
  };
}

function renderInsightDiagnosticsBlock(detail, failureInfo = null) {
  const diagnostics = normalizeInsightDiagnostics(detail);
  const rows = [];
  if (diagnostics.endpoint) rows.push({ label: "请求地址", value: String(diagnostics.endpoint) });
  if (diagnostics.model) rows.push({ label: "模型", value: String(diagnostics.model) });
  if (diagnostics.kind) rows.push({ label: "错误分类", value: String(diagnostics.kind) });
  if (diagnostics.timeout_sec) rows.push({ label: "超时阈值", value: `${diagnostics.timeout_sec}s` });
  if (detail?.status) rows.push({ label: "状态", value: insightStatusLabel(detail.status) });
  if (failureInfo?.raw) rows.push({ label: "原始错误", value: String(failureInfo.raw) });
  if (rows.length === 0) return "";
  return `
    <section class="insight-diagnostics-card">
      <h4>请求诊断</h4>
      <dl class="insight-diagnostics-list">
        ${rows
          .map(
            (row) => `
              <div class="insight-diagnostics-item">
                <dt>${escapeHtml(row.label)}</dt>
                <dd>${escapeHtml(row.value)}</dd>
              </div>
            `,
          )
          .join("")}
      </dl>
    </section>
  `;
}

function buildInsightChatHtml(detail) {
  const progress = normalizeInsightProgressPayload(detail?.progress, detail);
  const liveMode = Boolean(progress && isInsightLiveStatus(progress.status) && !progress.done);
  const result = detail && typeof detail.result === "object" ? detail.result : {};
  const symbol = labelSymbol(detail.symbol || "XAUUSD");
  const directionText = detail.direction === "up" ? "上涨" : detail.direction === "down" ? "下跌" : "波动";
  const triggeredAt = formatLocalTime(detail.triggered_at);
  const summaryRaw = String(result.summary_short || detail.summary || result.summary || progress?.summary || "暂无分析结论");
  const summary = cleanInsightRichText(summaryRaw, { maxChars: 900, compact: false }) || "暂无分析结论";
  const confidenceScore = Number(detail.confidence_score ?? result.confidence_score);
  const confidenceLevel = String(detail.confidence_level || result.confidence_level || "--");
  const confidenceText = Number.isFinite(confidenceScore) ? `${Math.round(confidenceScore)}分（${confidenceLevel}）` : "--";
  const failureInfo = deriveInsightFailureInfo(detail);
  const evidence = collectInsightEvidence(detail);
  const primaryCause = cleanInsightRichText(result.primary_cause || "", { maxChars: 180, compact: true });
  const primaryCauses = normalizeTextArray(result.primary_causes_ranked);

  const primaryText = primaryCause || (primaryCauses.length > 0 ? primaryCauses.join("；") : "暂无主因排序");
  const hintText =
    failureInfo && Array.isArray(failureInfo.hints) && failureInfo.hints.length > 0
      ? `<ul>${failureInfo.hints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
  const evidenceText =
    evidence.length > 0
      ? evidence
          .slice(0, 6)
          .map((item, idx) => {
            const title = String(item?.title || `证据 ${idx + 1}`);
            const outlet = String(item?.outlet || "未知媒体");
            const url = safeHref(item?.url);
            return `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a> · ${escapeHtml(outlet)}</li>`;
          })
          .join("")
      : "<li>暂无证据链接</li>";

  const userPromptLine = (() => {
    const eventId = escapeHtml(String(detail.id || "--"));
    const directionLabel = directionText || "波动";
    const changeNumber = Number(detail.change_pct);
    const windowNumber = Number(detail.window_minutes);
    const hasChange = Number.isFinite(changeNumber);
    const hasWindow = Number.isFinite(windowNumber) && windowNumber > 0;
    const hasTriggeredAt = Boolean(detail.triggered_at) && triggeredAt !== "--";
    if (hasChange && hasWindow && hasTriggeredAt) {
      return `请解释事件 #${eventId}：${escapeHtml(symbol)} 在 ${escapeHtml(String(Math.round(windowNumber)))} 分钟内${escapeHtml(directionLabel)} ${escapeHtml(fmtNumber(changeNumber, 2))}%（${escapeHtml(
        triggeredAt,
      )}）。`;
    }
    const known = [];
    if (hasWindow) known.push(`窗口 ${Math.round(windowNumber)} 分钟`);
    if (hasChange) known.push(`涨跌幅 ${fmtNumber(changeNumber, 2)}%`);
    if (hasTriggeredAt) known.push(`触发时间 ${triggeredAt}`);
    const knownText = known.length > 0 ? known.join("；") : "等待后端返回窗口、涨跌幅与触发时间";
    return `事件 #${eventId} 参数加载中（${escapeHtml(knownText)}）。请先展示当前分析进度，参数补齐后再输出完整解释。`;
  })();
  const liveText = progress ? trimInsightStreamText(progress.stream_text, 3200) : "";
  const liveBubbleHtml =
    liveMode && progress
      ? `
          <p>${escapeHtml(progress.message || "AI 正在执行分析任务...")}</p>
          <p class="meta">状态：${escapeHtml(insightStatusLabel(progress.status))} · 阶段：${escapeHtml(progress.stage_detail || insightStageLabel(progress.stage))} · 更新时间：${escapeHtml(
            progress.updated_at ? formatLocalTime(progress.updated_at) : "--",
          )}</p>
          ${liveText ? `<pre class="insight-chat-live-text">${escapeHtml(liveText)}</pre>` : ""}
        `
      : `
          <p>${escapeHtml(summary)}</p>
          <p class="meta">置信度：${escapeHtml(confidenceText)}</p>
          <p class="meta">主因：${escapeHtml(primaryText)}</p>
          ${
            failureInfo
              ? `<div class="insight-chat-error">${escapeHtml(failureInfo.summary)}${hintText}</div>`
              : ""
          }
        `;

  return `
    <div class="insight-chat-stream">
      <article class="insight-chat-row user">
        <div class="insight-chat-role">你</div>
        <div class="insight-chat-bubble">
          ${userPromptLine}
        </div>
      </article>
      <article class="insight-chat-row assistant">
        <div class="insight-chat-role">AI</div>
        <div class="insight-chat-bubble">
          ${liveBubbleHtml}
        </div>
      </article>
      ${liveMode && progress ? renderInsightProgressCard(progress, { compact: true }) : ""}
      <section class="insight-chat-evidence">
        <h4>证据摘要</h4>
        <ul>${evidenceText}</ul>
      </section>
      ${renderInsightDiagnosticsBlock(detail, failureInfo)}
    </div>
  `;
}

function isInsightChatModalOpen() {
  return Boolean(el.insightChatModalRoot && !el.insightChatModalRoot.classList.contains("hidden"));
}

function renderInsightChatModalContent(detail, { updateTitle = true } = {}) {
  if (!detail || !el.insightChatModalBody || !el.insightChatModalTitle) return;
  if (updateTitle) {
    el.insightChatModalTitle.textContent = `AI 对话窗口 · 事件 #${detail.id || "--"}`;
  }
  el.insightChatModalBody.innerHTML = buildInsightChatHtml(detail);
}

function openInsightChatModal(detail, triggerNode = null) {
  if (!detail || !el.insightChatModalRoot || !el.insightChatModalBody || !el.insightChatModalTitle) return;
  renderInsightChatModalContent(detail, { updateTitle: true });
  el.insightChatModalRoot.classList.remove("hidden");
  el.insightChatModalRoot.setAttribute("aria-hidden", "false");
  syncModalBodyLock();
  const focusNode = el.insightChatModalBody.querySelector("button, a, input, select, textarea");
  if (focusNode instanceof HTMLElement) {
    focusNode.focus({ preventScroll: true });
  } else if (el.insightChatModalClose instanceof HTMLElement) {
    el.insightChatModalClose.focus({ preventScroll: true });
  }
  if (triggerNode instanceof HTMLElement) {
    state.modal.currentTrigger = triggerNode;
  }
}

function closeInsightChatModal({ restoreFocus = true } = {}) {
  if (!el.insightChatModalRoot || !el.insightChatModalBody) return;
  el.insightChatModalRoot.classList.add("hidden");
  el.insightChatModalRoot.setAttribute("aria-hidden", "true");
  el.insightChatModalBody.innerHTML = "";
  syncModalBodyLock();
  if (restoreFocus && state.modal.currentTrigger instanceof HTMLElement) {
    state.modal.currentTrigger.focus();
  }
  state.modal.currentTrigger = null;
}

function renderInsightEventDetail(detail, targetEl = null) {
  const target = targetEl || el.insightEventDetail;
  if (!target) return;
  if (!detail) {
    renderInsightDetailEmpty("选择事件后查看详情。", target);
    if (target === el.insightEventDetail) {
      state.currentInsightDetail = null;
    }
    return;
  }
  const result = detail.result && typeof detail.result === "object" ? detail.result : {};
  const progress = normalizeInsightProgressPayload(detail.progress, detail);
  const symbol = labelSymbol(detail.symbol || "XAUUSD");
  const directionText = detail.direction === "up" ? "上涨" : detail.direction === "down" ? "下跌" : "波动";
  const changeText = fmtNumber(detail.change_pct, 2);
  const statusText = insightStatusLabel(progress?.status || detail.status);
  const triggeredAt = formatLocalTime(detail.triggered_at);
  const summaryRaw = String(result.summary_short || detail.summary || result.summary || "暂无分析结论");
  const summary = cleanInsightRichText(summaryRaw, { maxChars: 1200, compact: false }) || "暂无分析结论";
  const confidenceRaw = detail.confidence_score ?? result.confidence_score;
  const confidence = Number(confidenceRaw);
  const confidenceLevel = String(detail.confidence_level || result.confidence_level || "--");
  const confidenceText = Number.isFinite(confidence) ? `${Math.round(confidence)}分` : "--";
  const confidenceReason = String(
    result.narrative_confidence_reason || detail.confidence_reason || result.confidence_reason || "暂无置信度说明",
  );
  const confidenceBreakdown =
    detail.confidence_breakdown && typeof detail.confidence_breakdown === "object"
      ? detail.confidence_breakdown
      : result.confidence_breakdown && typeof result.confidence_breakdown === "object"
        ? result.confidence_breakdown
        : {};
  const tier1 = Number(detail.authoritative_count || 0);
  const tier2 = Number(detail.supplemental_count || 0);
  const triggerTypeText = insightTriggerTypeLabel(detail.trigger_type || result.trigger_type);
  const triggerReason = String(detail.trigger_reason || result.trigger_reason || "").trim();
  const evidence = collectInsightEvidence(detail);
  const failureInfo = deriveInsightFailureInfo(detail);
  const progressHtml = renderInsightProgressCard(progress, { compact: false });

  const evidenceHtml =
    evidence.length === 0
      ? `<div class="insight-detail-empty small">暂无证据链接</div>`
      : evidence
          .map((item) => {
            const title = String(item?.title || "未命名新闻");
            const outlet = String(item?.outlet || "未知媒体");
            const publishedAt = item?.published_at ? formatLocalTime(item.published_at) : "--";
            const tier = String(item?.source_tier || "tier2_supplemental");
            const tierLabel = tier === "tier1_authoritative" ? "Tier1 权威" : "Tier2 补充";
            const tierClass = tier === "tier1_authoritative" ? "tier1" : "tier2";
            const url = safeHref(item?.url);
            const relevanceScore = Number(item?.relevance_score);
            const relevanceTags = Array.isArray(item?.relevance_tags) ? item.relevance_tags.map((tag) => String(tag || "").trim()).filter(Boolean) : [];
            const relevanceText = Number.isFinite(relevanceScore) ? ` · 相关性 ${Math.round(relevanceScore)}` : "";
            const tagsText = relevanceTags.length > 0 ? ` · ${relevanceTags.slice(0, 3).join(" / ")}` : "";
            return `
              <article class="insight-evidence-item">
                <div class="insight-evidence-head">
                  <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>
                  <span class="insight-tier ${tierClass}">${escapeHtml(tierLabel)}</span>
                </div>
                <p class="meta">${escapeHtml(outlet)} · ${escapeHtml(publishedAt)}${escapeHtml(relevanceText)}${escapeHtml(tagsText)}</p>
              </article>
            `;
          })
          .join("");
  const detailId = Number(detail.id);
  const chatActionHtml = Number.isFinite(detailId)
    ? `<div class="insight-detail-actions">
        <button type="button" class="secondary-btn mini-btn" data-action="open-insight-assistant" data-id="${escapeHtml(String(detailId))}">
          在AI助手继续追问
        </button>
        <button type="button" class="secondary-btn mini-btn" data-action="open-insight-chat" data-id="${escapeHtml(String(detailId))}">
          打开AI对话窗口
        </button>
      </div>`
    : "";

  target.innerHTML = `
    <div class="insight-detail-header">
      <div>
        <h3>${escapeHtml(symbol)} · ${escapeHtml(directionText)} ${escapeHtml(changeText)}%</h3>
        <p class="meta">触发时间：${escapeHtml(triggeredAt)} · 状态：${escapeHtml(statusText)} · 类型：${escapeHtml(triggerTypeText)}</p>
        ${triggerReason ? `<p class="meta">${escapeHtml(triggerReason)}</p>` : ""}
      </div>
      <div class="insight-confidence-box">
        <span class="meta">置信度</span>
        <strong>${escapeHtml(confidenceText)}</strong>
        <small class="meta">${escapeHtml(confidenceLevel)}</small>
      </div>
    </div>
    <div class="insight-metrics">
      <span class="tag">Tier1 ${Number.isFinite(tier1) ? tier1 : 0} 条</span>
      <span class="tag">Tier2 ${Number.isFinite(tier2) ? tier2 : 0} 条</span>
      <span class="tag">窗口 ${escapeHtml(String(detail.window_minutes || "--"))} 分钟</span>
    </div>
    ${
      confidenceBreakdown && Object.keys(confidenceBreakdown).length > 0
        ? `<div class="insight-metrics">
            <span class="tag">source ${escapeHtml(String(confidenceBreakdown.source_quality ?? "--"))}/40</span>
            <span class="tag">recency ${escapeHtml(String(confidenceBreakdown.recency ?? "--"))}/20</span>
            <span class="tag">relevance ${escapeHtml(String(confidenceBreakdown.relevance ?? "--"))}/20</span>
            <span class="tag">consistency ${escapeHtml(String(confidenceBreakdown.consistency ?? "--"))}/20</span>
          </div>`
        : ""
    }
    ${progressHtml}
    ${
      failureInfo
        ? `<section class="insight-error-card">
            <h4>AI分析失败原因</h4>
            <p>${escapeHtml(failureInfo.summary)}</p>
            ${
              Array.isArray(failureInfo.hints) && failureInfo.hints.length > 0
                ? `<ul class="insight-bullet-list">${failureInfo.hints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
                : ""
            }
          </section>`
        : ""
    }
    <section class="insight-summary-card">
      <h4>结论摘要</h4>
      <p>${escapeHtml(summary)}</p>
      <p class="meta">${escapeHtml(confidenceReason)}</p>
    </section>
    <div class="insight-detail-grid">
      ${renderInsightListBlock("主因", [result.primary_cause || (Array.isArray(result.primary_causes_ranked) ? result.primary_causes_ranked[0] : "")], "暂无主因")}
      ${renderInsightListBlock("次因", result.secondary_causes || result.primary_causes_ranked, "暂无次因")}
      ${renderInsightListBlock("反证", result.counter_evidence || result.risks_and_counter_evidence, "暂无反证")}
      ${renderInsightListBlock("未来24h观察", result.what_to_watch_next_24h, "暂无观察点")}
    </div>
    <section class="insight-evidence-list">
      <h4>证据清单</h4>
      ${evidenceHtml}
    </section>
    ${renderInsightDiagnosticsBlock(detail, failureInfo)}
    ${chatActionHtml}
  `;
  if (target === el.insightEventDetail) {
    state.currentInsightDetail = detail;
  } else if (target === el.dashboardInsightDetail) {
    state.currentDashboardInsightDetail = detail;
  }
}

function renderInsightEvents(events) {
  state.insightEvents = events || [];
  if (!el.insightEventList) return;
  if (!events || events.length === 0) {
    el.insightEventList.innerHTML = `<div class="rule-item"><span>暂无AI归因事件</span><span class="tag">等待触发</span></div>`;
    state.selectedInsightEventId = null;
    stopInsightEventProgressWatcher();
    renderInsightDetailEmpty("暂无可查看的归因事件。");
    return;
  }
  el.insightEventList.innerHTML = events
    .map(
      (event) => {
        const stage = String(event?.progress_stage || "").trim();
        const liveStage = stage && isInsightLiveStatus(event?.status) ? ` · ${insightStageLabel(stage)}` : "";
        const isLive = isInsightLiveStatus(event?.status);
        const triggerLabel = insightTriggerTypeLabel(event?.trigger_type);
        return `
      <div
        class="rule-item insight-event-item ${Number(event.id) === Number(state.selectedInsightEventId) ? "active" : ""}"
        data-event-id="${event.id}"
        role="button"
        aria-label="查看事件 #${event.id} 详情"
        tabindex="0"
      >
        <span>#${event.id} ${labelSymbol(event.symbol)} ${event.direction === "up" ? "上涨" : "下跌"} ${fmtNumber(event.change_pct, 2)}% · ${formatLocalTime(event.triggered_at)}</span>
        <div class="rule-item-actions">
          <button type="button" class="mini-btn secondary-btn" data-action="detail" data-id="${event.id}">查看详情</button>
          <button type="button" class="mini-btn secondary-btn" data-action="chat" data-id="${event.id}">${isLive ? "实时对话" : "打开对话"}</button>
        </div>
        <span class="tag">${escapeHtml(triggerLabel)} · ${insightStatusLabel(event.status)}${escapeHtml(liveStage)} · Tier1 ${event.authoritative_count || 0} / Tier2 ${event.supplemental_count || 0}</span>
      </div>
      `;
      },
    )
    .join("");
}

function stopInsightEventProgressWatcher() {
  const watcher = state.insightProgressWatcher || {};
  if (watcher.timer) {
    window.clearInterval(watcher.timer);
  }
  watcher.eventId = null;
  watcher.timer = null;
  watcher.inFlight = false;
  watcher.errorCount = 0;
}

function applyInsightProgressToEventList(progress) {
  const eventId = Number(progress?.event_id);
  if (!Number.isFinite(eventId)) return;
  const rows = Array.isArray(state.insightEvents) ? state.insightEvents : [];
  const index = rows.findIndex((item) => Number(item?.id) === eventId);
  if (index < 0) return;
  const prev = rows[index] || {};
  const next = {
    ...prev,
    status: String(progress?.status || prev.status || "").toLowerCase() || prev.status,
    progress_stage: String(progress?.stage || prev.progress_stage || ""),
    progress_message: String(progress?.message || prev.progress_message || ""),
  };
  if (progress?.summary && !next.summary) next.summary = String(progress.summary);
  if (progress?.error) next.error = String(progress.error);
  const changed =
    String(prev.status || "") !== String(next.status || "") ||
    String(prev.progress_stage || "") !== String(next.progress_stage || "") ||
    String(prev.progress_message || "") !== String(next.progress_message || "") ||
    String(prev.error || "") !== String(next.error || "") ||
    String(prev.summary || "") !== String(next.summary || "");
  if (!changed) return;
  const patched = rows.slice();
  patched[index] = next;
  renderInsightEvents(patched);
}

async function pollInsightEventProgress(eventId, { silent = true } = {}) {
  const numericId = Number(eventId);
  if (!Number.isFinite(numericId)) return;
  const watcher = state.insightProgressWatcher || {};
  if (watcher.inFlight || Number(watcher.eventId) !== numericId) return;
  watcher.inFlight = true;
  try {
    const payload = await fetchJson(`/api/insight/events/${numericId}/progress`);
    watcher.errorCount = 0;
    const progress = normalizeInsightProgressPayload(payload, state.currentInsightDetail);
    if (!progress) return;

    applyInsightProgressToEventList(progress);
    const listRow = (state.insightEvents || []).find((item) => Number(item?.id) === numericId) || null;
    const sourceDetail =
      Number(state.currentInsightDetail?.id) === numericId
        ? state.currentInsightDetail
        : listRow && typeof listRow === "object"
          ? listRow
          : { id: numericId };
    const mergedDetail = mergeInsightDetailWithProgress(sourceDetail, progress);

    if (Number(state.selectedInsightEventId) === numericId || Number(state.currentInsightDetail?.id) === numericId) {
      renderInsightEventDetail(mergedDetail);
    }
    if (Number(state.selectedOverlayEventId) === numericId && el.dashboardInsightDetail) {
      renderInsightEventDetail(mergedDetail, el.dashboardInsightDetail);
    }
    if (isInsightChatModalOpen() && Number(state.currentInsightDetail?.id) === numericId) {
      renderInsightChatModalContent(mergedDetail, { updateTitle: false });
    }

    if (progress.done) {
      stopInsightEventProgressWatcher();
      const finalDetail = await loadInsightEventDetail(numericId, { silent: true });
      if (finalDetail && isInsightChatModalOpen() && Number(state.currentInsightDetail?.id) === numericId) {
        renderInsightChatModalContent(finalDetail, { updateTitle: true });
      }
    }
  } catch (err) {
    watcher.errorCount = Number(watcher.errorCount || 0) + 1;
    if (watcher.errorCount >= 5) {
      stopInsightEventProgressWatcher();
    }
    if (!silent) {
      const normalized = normalizeInsightAiError(err instanceof Error ? err.message : String(err || ""));
      const retryHint = watcher.errorCount >= 5 ? "已停止实时轮询，请手动刷新。" : `将在后台继续重试（${watcher.errorCount}/5）。`;
      setInsightTip(`读取事件进度失败：${normalized.summary}；${retryHint}`, true);
    }
  } finally {
    watcher.inFlight = false;
  }
}

function startInsightEventProgressWatcher(eventId, { silent = true } = {}) {
  const numericId = Number(eventId);
  if (!Number.isFinite(numericId)) return;
  const watcher = state.insightProgressWatcher || {};
  if (Number(watcher.eventId) === numericId && watcher.timer) return;
  stopInsightEventProgressWatcher();
  watcher.eventId = numericId;
  watcher.inFlight = false;
  watcher.errorCount = 0;
  const runner = () => {
    if (Number((state.insightProgressWatcher || {}).eventId) !== numericId) return;
    void pollInsightEventProgress(numericId, { silent });
  };
  runner();
  watcher.timer = window.setInterval(runner, 1200);
}

function syncInsightEventProgressWatcher(detail, { silent = true } = {}) {
  const eventId = Number(detail?.id);
  if (!Number.isFinite(eventId)) {
    stopInsightEventProgressWatcher();
    return;
  }
  const progress = normalizeInsightProgressPayload(detail?.progress, detail);
  const status = String(progress?.status || detail?.status || "").toLowerCase();
  if (isInsightLiveStatus(status) && !(progress && progress.done)) {
    startInsightEventProgressWatcher(eventId, { silent });
    return;
  }
  if (Number((state.insightProgressWatcher || {}).eventId) === eventId) {
    stopInsightEventProgressWatcher();
  }
}

async function loadInsightEventDetail(eventId, { silent = false } = {}) {
  const numericId = Number(eventId);
  if (!Number.isFinite(numericId)) return null;
  try {
    const detail = await fetchJson(`/api/insight/events/${numericId}`);
    state.selectedInsightEventId = numericId;
    renderInsightEvents(state.insightEvents);
    renderInsightEventDetail(detail);
    syncInsightEventProgressWatcher(detail, { silent: true });
    return detail;
  } catch (err) {
    console.error(err);
    if (!silent) {
      const normalized = normalizeInsightAiError(err instanceof Error ? err.message : String(err || ""));
      setInsightTip(`读取事件详情失败：${normalized.summary}`, true);
    }
    return null;
  }
}

async function loadDashboardEventDetail(eventId, { silent = false } = {}) {
  const numericId = Number(eventId);
  if (!Number.isFinite(numericId)) return;
  try {
    const detail = await fetchJson(`/api/insight/events/${numericId}`);
    state.selectedOverlayEventId = numericId;
    renderInsightEventDetail(detail, el.dashboardInsightDetail);
    if (Number(state.selectedInsightEventId) === numericId || Number(state.currentInsightDetail?.id) === numericId) {
      syncInsightEventProgressWatcher(detail, { silent: true });
    }
    setDashboardInsightTip(`已定位 AI 事件 #${numericId}。`);
  } catch (err) {
    console.error(err);
    if (!silent) {
      setDashboardInsightTip("读取看板联动事件失败。", true);
    }
  }
}

function buildInsightChatBootstrapDetail(eventId) {
  const numericId = Number(eventId);
  const progress = {
    event_id: Number.isFinite(numericId) ? numericId : 0,
    status: "queued",
    stage: "queued",
    message: "正在读取事件详情与实时进度...",
    stream_text: "",
    done: false,
    updated_at: new Date().toISOString(),
    error: "",
    diagnostics: {},
  };
  return {
    id: Number.isFinite(numericId) ? numericId : "--",
    symbol: "XAUUSD",
    direction: "up",
    change_pct: 0,
    window_minutes: "--",
    triggered_at: "",
    status: "queued",
    summary: "正在读取分析内容，请稍候。",
    confidence: null,
    confidence_reason: "",
    authoritative_count: 0,
    supplemental_count: 0,
    evidence: [],
    result: {},
    progress,
  };
}

async function fetchInsightEventProgressSnapshot(eventId, { silent = true } = {}) {
  const numericId = Number(eventId);
  if (!Number.isFinite(numericId)) return null;
  try {
    return await fetchJson(`/api/insight/events/${numericId}/progress`);
  } catch (err) {
    if (!silent) {
      const normalized = normalizeInsightAiError(err instanceof Error ? err.message : String(err || ""));
      setInsightTip(`读取事件进度失败：${normalized.summary}`, true);
    }
    return null;
  }
}

async function openInsightChatByEventId(eventId, { triggerNode = null } = {}) {
  const numericId = Number(eventId);
  if (!Number.isFinite(numericId)) return null;
  const bootstrapDetail = buildInsightChatBootstrapDetail(numericId);
  openInsightChatModal(bootstrapDetail, triggerNode);
  startInsightEventProgressWatcher(numericId, { silent: true });

  const detail = await loadInsightEventDetail(numericId, { silent: true });
  if (detail) {
    renderInsightChatModalContent(detail, { updateTitle: true });
    syncInsightEventProgressWatcher(detail, { silent: true });
    return detail;
  }

  const progressPayload = await fetchInsightEventProgressSnapshot(numericId, { silent: true });
  if (progressPayload) {
    const merged = mergeInsightDetailWithProgress(bootstrapDetail, progressPayload);
    renderInsightEventDetail(merged);
    renderInsightChatModalContent(merged, { updateTitle: true });
    startInsightEventProgressWatcher(numericId, { silent: true });
    setInsightTip(`事件 #${numericId} 处于 ${insightStatusLabel(merged.status)}，已打开实时窗口。`);
    return merged;
  }

  const failed = {
    ...bootstrapDetail,
    status: "failed",
    summary: "无法读取该事件的详情或实时进度，请刷新事件列表后重试。",
    error: "event detail/progress unavailable",
    progress: {
      ...bootstrapDetail.progress,
      status: "failed",
      stage: "failed",
      done: true,
      message: "事件详情与进度接口均不可用。",
      error: "event detail/progress unavailable",
    },
  };
  renderInsightChatModalContent(failed, { updateTitle: true });
  setInsightTip(`事件 #${numericId} 详情读取失败，请刷新后重试。`, true);
  return null;
}

async function openInsightEventDetailFromList(eventId, { openChat = false, triggerNode = null } = {}) {
  const numericId = Number(eventId);
  if (!Number.isFinite(numericId)) return;
  setInsightTip(`正在加载事件 #${numericId} 详情...`);
  const detail = openChat
    ? await openInsightChatByEventId(numericId, { triggerNode })
    : await loadInsightEventDetail(numericId);
  if (!detail) return;
  const progress = normalizeInsightProgressPayload(detail.progress, detail);
  const failureInfo = deriveInsightFailureInfo(detail);
  if (failureInfo) {
    setInsightTip(`事件 #${numericId}：${failureInfo.summary}`, true);
  } else if (progress && isInsightLiveStatus(progress.status) && !progress.done) {
    setInsightTip(`事件 #${numericId} 正在${insightStatusLabel(progress.status)}，已开启实时更新。`);
  } else {
    setInsightTip(`事件 #${numericId} 详情已加载。`);
  }
  if (openChat) return;
}

function bindChartEventClicks() {
  bindDashboardChartEvents();
}

async function refreshRulesAndAlerts() {
  const [rules, alerts] = await Promise.all([fetchJson("/api/rules"), fetchJson("/api/alerts")]);
  renderRules(rules);
  renderAlerts(alerts);
}

async function refreshMarket() {
  const range = state.range;
  const timeframe = String(state.timeframe || "1d").toLowerCase();
  const safe = async (fn) => { try { return await fn(); } catch (e) { console.warn("refreshMarket partial fail:", e); return null; } };
  const [latest, intlKline, domKline, intlIndicators, domIndicators, events, intlDailyKline, domDailyKline] = await Promise.all([
    safe(() => fetchJson("/api/prices/latest")),
    safe(() => fetchJson(`/api/kline?symbol=XAUUSD&timeframe=${encodeURIComponent(timeframe)}&range=${range}`)),
    safe(() => fetchJson(`/api/kline?symbol=AUCN&timeframe=${encodeURIComponent(timeframe)}&range=${range}`)),
    safe(() => fetchJson(`/api/indicators?symbol=XAUUSD&timeframe=${encodeURIComponent(timeframe)}&range=${range}`)),
    safe(() => fetchJson(`/api/indicators?symbol=AUCN&timeframe=${encodeURIComponent(timeframe)}&range=${range}`)),
    safe(() => fetchJson(`/api/insight/events?limit=120&range=${range}`)),
    safe(() => fetchJson("/api/kline?symbol=XAUUSD&timeframe=1d&range=1m")),
    safe(() => fetchJson("/api/kline?symbol=AUCN&timeframe=1d&range=1m")),
  ]);

  state.intl.bars = sanitizeBars(intlKline?.bars || [], timeframe);
  state.domestic.bars = sanitizeBars(domKline?.bars || [], timeframe);
  state.intlDailyBars = sanitizeBars(Array.isArray(intlDailyKline?.bars) ? intlDailyKline.bars : [], "1d");
  state.domesticDailyBars = sanitizeBars(Array.isArray(domDailyKline?.bars) ? domDailyKline.bars : [], "1d");
  if (timeframe !== "1d") {
    if (state.intl.bars.length === 0 && state.intlDailyBars.length > 0) {
      state.intl.bars = state.intlDailyBars.slice();
    }
    if (state.domestic.bars.length === 0 && state.domesticDailyBars.length > 0) {
      state.domestic.bars = state.domesticDailyBars.slice();
    }
  }
  const latestMap = priceMap(latest?.items || []);
  state.intl.bars = ensureBarsFromLatest(state.intl.bars, latestMap?.XAUUSD?.price, "XAUUSD", timeframe);
  state.domestic.bars = ensureBarsFromLatest(state.domestic.bars, latestMap?.AUCN?.price, "AUCN", timeframe);
  state.intl.indicators = intlIndicators;
  state.domestic.indicators = domIndicators;
  state.overlayEvents = Array.isArray(events) ? events : [];

  if (latest) updateCards(latest);
  renderActiveCharts();
  renderKlineTables();
  if (state.overlayEvents.length === 0) {
    renderInsightDetailEmpty("当前区间没有可联动的 AI 事件。", el.dashboardInsightDetail);
    setDashboardInsightTip("当前区间暂无 AI 事件。");
  } else if (state.selectedOverlayEventId) {
    await loadDashboardEventDetail(state.selectedOverlayEventId, { silent: true });
  } else {
    await loadDashboardEventDetail(state.overlayEvents[0].id, { silent: true });
  }
}

function setYFinanceTip(text, isError = false) {
  if (!el.yfinanceTip) return;
  el.yfinanceTip.textContent = text;
  el.yfinanceTip.style.color = isError ? "#d12f3f" : "";
}

function yfinanceAxisTimeframe(interval) {
  const normalized = String(interval || "").toLowerCase();
  if (["1d", "5d", "1wk", "1mo", "3mo"].includes(normalized)) return "1d";
  return "1h";
}

function renderYFinanceChart(payload) {
  ensureAuxCharts();
  if (!chartYFinance) {
    scheduleChartRetry("yfinance chart not ready");
    return;
  }
  const bars = Array.isArray(payload?.bars) ? payload.bars : [];
  if (bars.length === 0) {
    chartYFinance.clear();
    return;
  }
  const timeframe = yfinanceAxisTimeframe(payload?.interval || "1d");
  const x = bars.map((row) => axisTimeKey(row.ts, timeframe));
  const candle = bars.map((row) => [roundTo(row.open, 4), roundTo(row.close, 4), roundTo(row.low, 4), roundTo(row.high, 4)]);
  const volume = bars.map((row) => roundTo(row.volume, 0));
  const axisInterval = axisIntervalBySize(x.length, 10);

  paintChart(chartYFinance, {
    animation: false,
    animationDuration: 0,
    legend: { top: 8, data: ["K线", "成交量"], textStyle: { fontSize: 11 } },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
    },
    grid: [
      { left: 56, right: 20, top: 44, height: "62%" },
      { left: 56, right: 20, top: "80%", height: "14%" },
    ],
    xAxis: [
      {
        type: "category",
        data: x,
        axisLine: { lineStyle: { color: "#9da5b5" } },
        axisLabel: {
          hideOverlap: true,
          interval: axisInterval,
          formatter: (value) => {
            const text = String(value || "");
            if (timeframe === "1d") return text.slice(5);
            return text.slice(5, 16);
          },
        },
      },
      {
        type: "category",
        gridIndex: 1,
        data: x,
        axisLine: { lineStyle: { color: "#9da5b5" } },
        axisLabel: { show: false },
      },
    ],
    yAxis: [
      {
        type: "value",
        scale: true,
        axisLabel: { formatter: (value) => fmtNumber(value, 2) },
        splitLine: { show: false },
      },
      {
        type: "value",
        gridIndex: 1,
        scale: true,
        axisLabel: { formatter: (value) => Math.round(Number(value || 0)).toLocaleString() },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], start: 72, end: 100 },
      { type: "slider", xAxisIndex: [0, 1], bottom: 8, height: 16, start: 72, end: 100 },
    ],
    series: [
      {
        name: "K线",
        type: "candlestick",
        data: candle,
        barMinWidth: 5,
        barMaxWidth: 16,
        itemStyle: {
          color: "#ef232a",
          color0: "#14b143",
          borderColor: "#ef232a",
          borderColor0: "#14b143",
        },
      },
      {
        name: "成交量",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        itemStyle: { color: "rgba(102, 112, 134, 0.45)" },
        data: volume,
      },
    ],
  });
}

function renderYFinanceBars(payload) {
  if (!(el.yfinanceBarsBody instanceof HTMLElement)) return;
  const bars = Array.isArray(payload?.bars) ? payload.bars.slice(-30).reverse() : [];
  if (bars.length === 0) {
    el.yfinanceBarsBody.innerHTML = '<tr><td colspan="6" class="meta">暂无历史数据</td></tr>';
    return;
  }
  el.yfinanceBarsBody.innerHTML = bars
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(formatLocalTime(row.ts))}</td>
        <td>${escapeHtml(fmtNumber(row.open, 4))}</td>
        <td>${escapeHtml(fmtNumber(row.high, 4))}</td>
        <td>${escapeHtml(fmtNumber(row.low, 4))}</td>
        <td>${escapeHtml(fmtNumber(row.close, 4))}</td>
        <td>${Number.isFinite(Number(row.volume)) ? Math.round(Number(row.volume)).toLocaleString() : "--"}</td>
      </tr>
    `,
    )
    .join("");
}

function renderYFinanceNews(payload) {
  if (!(el.yfinanceNewsList instanceof HTMLElement)) return;
  const rows = Array.isArray(payload?.news) ? payload.news.slice(0, 8) : [];
  if (rows.length === 0) {
    el.yfinanceNewsList.innerHTML = '<li class="meta">暂无可用新闻</li>';
    return;
  }
  el.yfinanceNewsList.innerHTML = rows
    .map((item) => {
      const title = escapeHtml(item?.title || "无标题");
      const url = safeHref(item?.url || "");
      const publisher = escapeHtml(item?.publisher || "Unknown");
      const publishedAt = item?.published_at ? escapeHtml(formatLocalTime(item.published_at)) : "--";
      return `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${title}</a><div class="meta">${publisher} · ${publishedAt}</div></li>`;
    })
    .join("");
}

function renderYFinanceSummary(payload) {
  const quote = payload?.quote || {};
  const price = toNumberLoose(quote?.price);
  const changePct = toNumberLoose(quote?.change_pct);
  const changeAbs = toNumberLoose(quote?.change);
  const low = toNumberLoose(quote?.low);
  const high = toNumberLoose(quote?.high);
  const volume = toNumberLoose(quote?.volume);
  const currency = String(quote?.currency || "").trim();
  const exchange = String(quote?.exchange || "").trim();
  const asOf = String(quote?.as_of || "").trim();
  const title = String(quote?.short_name || payload?.ticker || "").trim();

  if (el.yfinancePrice) {
    el.yfinancePrice.textContent = Number.isFinite(price) ? `${fmtNumber(price, 4)}${currency ? ` ${currency}` : ""}` : "--";
  }
  if (el.yfinanceAsOf) {
    el.yfinanceAsOf.textContent = asOf ? `更新时间：${formatLocalTime(asOf)}` : "更新时间：--";
  }
  if (el.yfinanceChangePct) {
    if (Number.isFinite(changePct)) {
      const sign = changePct > 0 ? "+" : "";
      el.yfinanceChangePct.textContent = `${sign}${fmtNumber(changePct, 2)}%`;
      el.yfinanceChangePct.style.color = changePct > 0 ? "#127a4b" : changePct < 0 ? "#d12f3f" : "";
    } else {
      el.yfinanceChangePct.textContent = "--";
      el.yfinanceChangePct.style.color = "";
    }
  }
  if (el.yfinanceChangeAbs) {
    if (Number.isFinite(changeAbs)) {
      const sign = changeAbs > 0 ? "+" : "";
      el.yfinanceChangeAbs.textContent = `${sign}${fmtNumber(changeAbs, 4)}`;
      el.yfinanceChangeAbs.style.color = changeAbs > 0 ? "#127a4b" : changeAbs < 0 ? "#d12f3f" : "";
    } else {
      el.yfinanceChangeAbs.textContent = "--";
      el.yfinanceChangeAbs.style.color = "";
    }
  }
  if (el.yfinanceDayRange) {
    el.yfinanceDayRange.textContent = Number.isFinite(low) && Number.isFinite(high) ? `${fmtNumber(low, 4)} ~ ${fmtNumber(high, 4)}` : "--";
  }
  if (el.yfinanceCurrency) {
    el.yfinanceCurrency.textContent = currency ? `货币：${currency}` : "货币：--";
  }
  if (el.yfinanceVolume) {
    el.yfinanceVolume.textContent = Number.isFinite(volume) ? Math.round(volume).toLocaleString() : "--";
  }
  if (el.yfinanceExchange) {
    el.yfinanceExchange.textContent = exchange ? `交易所：${exchange}` : "交易所：--";
  }
  if (el.yfinanceChartTitle) {
    el.yfinanceChartTitle.textContent = title ? `${title} 价格走势` : "价格走势";
  }
  if (el.yfinanceChartMeta) {
    el.yfinanceChartMeta.textContent = `Ticker: ${payload?.ticker || "--"} · period=${payload?.period || "--"} · interval=${payload?.interval || "--"} · bars=${
      Array.isArray(payload?.bars) ? payload.bars.length : 0
    }`;
  }
}

function renderYFinance(payload) {
  renderYFinanceSummary(payload);
  renderYFinanceChart(payload);
  renderYFinanceBars(payload);
  renderYFinanceNews(payload);
}

function currentYFinanceRequest() {
  const ticker = String(el.yfinanceTicker?.value || state.yfinance.ticker || "AAPL").trim().toUpperCase();
  const period = String(el.yfinancePeriod?.value || state.yfinance.period || "6mo").trim().toLowerCase();
  const interval = String(el.yfinanceInterval?.value || state.yfinance.interval || "1d").trim().toLowerCase();
  const prepost = String(el.yfinancePrepost?.value || (state.yfinance.prepost ? "true" : "false")).trim().toLowerCase() === "true";
  return { ticker, period, interval, prepost };
}

async function refreshYFinance({ silent = false } = {}) {
  if (!el.yfinanceTicker) return null;
  ensureAuxCharts();
  const request = currentYFinanceRequest();
  if (!request.ticker) {
    setYFinanceTip("Ticker 不能为空。", true);
    return null;
  }

  const params = new URLSearchParams({
    ticker: request.ticker,
    period: request.period,
    interval: request.interval,
    prepost: request.prepost ? "true" : "false",
  });
  if (!silent) setYFinanceTip(`正在加载 ${request.ticker}...`);
  try {
    const payload = await fetchJson(`/api/yfinance/overview?${params.toString()}`, { timeoutMs: 25000 });
    state.yfinance = { ...request, payload };
    renderYFinance(payload);
    if (!silent) {
      const provider = String(payload?.meta?.source || "yfinance");
      setYFinanceTip(`已加载 ${request.ticker}（${provider}）`);
    }
    return payload;
  } catch (err) {
    console.error(err);
    if (!silent) {
      const detail = err instanceof Error ? err.message : "加载失败";
      setYFinanceTip(`加载失败：${detail}`, true);
    }
    return null;
  }
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

async function refreshInsightSettings() {
  const payload = await fetchJson("/api/insight/settings");
  renderInsightSettings(payload);
}

async function refreshInsightEvents() {
  const events = await fetchJson("/api/insight/events?limit=20");
  renderInsightEvents(events);
  if (events && events.length > 0) {
    const hasSelected = events.some((item) => Number(item.id) === Number(state.selectedInsightEventId));
    const targetId = hasSelected ? state.selectedInsightEventId : Number(events[0].id);
    await loadInsightEventDetail(targetId, { silent: true });
  }
}

async function refreshAll({ includeSettings = true } = {}) {
  if (refreshInFlight) return;
  refreshInFlight = true;
  setRefreshStatus("刷新中…");
  const _safe = async (fn) => { try { await fn(); } catch (e) { console.warn("[refreshAll] partial fail:", e?.message || e); } };
  try {
    const activeIsYFinance = state.activeTab === "yfinance";
    if (includeSettings) {
      const tasks = [_safe(refreshMarket), _safe(refreshRulesAndAlerts), _safe(refreshSettings), _safe(refreshInsightSettings), _safe(refreshInsightEvents)];
      if (activeIsYFinance) {
        tasks.push(_safe(() => refreshYFinance({ silent: true })));
      }
      await Promise.all(tasks);
      await _safe(refreshUsers);
      await _safe(refreshLoginAudit);
    } else {
      const tasks = [_safe(refreshMarket), _safe(refreshRulesAndAlerts), _safe(refreshInsightEvents)];
      if (activeIsYFinance) {
        tasks.push(_safe(() => refreshYFinance({ silent: true })));
      }
      await Promise.all(tasks);
      await _safe(refreshUsers);
      await _safe(refreshLoginAudit);
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

if (el.range) {
el.range.addEventListener("change", async (e) => {
  state.range = e.target.value;
  await refreshMarket();
});
}

if (el.timeframe) {
  el.timeframe.addEventListener("change", async (e) => {
    const next = String(e.target?.value || "1d").toLowerCase();
    state.timeframe = next === "1h" ? "1h" : "1d";
    await refreshMarket();
  });
}

if (el.layout) {
el.layout.addEventListener("change", (e) => {
  setLayout(e.target.value);
});
}

if (el.klineTableView) {
  el.klineTableView.addEventListener("change", (e) => {
    const next = String(e.target?.value || "all");
    setKlineTableView(next);
  });
}

if (el.yfinanceForm) {
  el.yfinanceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (el.yfinanceLoad) el.yfinanceLoad.disabled = true;
    try {
      await refreshYFinance({ silent: false });
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
    await refreshRulesAndAlerts();
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
      renderBacktestResult(payload);
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
      renderBacktestCompareResult(payload);
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
      renderBacktestCompareResult(state.backtestCompare);
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

async function submitInsightAssistantComposer() {
  const text = String(el.insightAssistantInput?.value || "").trim();
  if (!text) {
    setInsightAssistantTip("请输入你想咨询的问题。", true);
    return;
  }
  if (state.insightAssistantBusy) {
    setInsightAssistantTip("AI 正在回复，请稍候。", true);
    return;
  }
  if (el.insightAssistantInput) {
    el.insightAssistantInput.value = "";
  }
  const accepted = await sendInsightAssistantMessage(text);
  if (!accepted && el.insightAssistantInput && !String(el.insightAssistantInput.value || "").trim()) {
    el.insightAssistantInput.value = text;
  }
}

if (el.insightAssistantForm) {
  el.insightAssistantForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitInsightAssistantComposer();
  });
}

if (el.insightAssistantInput) {
  el.insightAssistantInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    if (event.isComposing) return;
    if (!(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    await submitInsightAssistantComposer();
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
      await refreshInsightEvents();
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
      await refreshInsightEvents();
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

function bindInsightChatOpen(container, resolver) {
  if (!(container instanceof HTMLElement)) return;
  container.addEventListener("click", async (e) => {
    const element = e.target instanceof Element ? e.target : null;
    if (!element) return;
    const assistantTrigger = element.closest("button[data-action='open-insight-assistant']");
    if (assistantTrigger instanceof HTMLElement) {
      const directId = Number(assistantTrigger.dataset.id || "");
      if (Number.isFinite(directId)) {
        await pinInsightAssistantContextByEventId(directId, { switchTab: true, prefill: true });
        return;
      }
      const fallbackDetail = typeof resolver === "function" ? resolver() : null;
      const fallbackId = Number(fallbackDetail?.id);
      if (Number.isFinite(fallbackId)) {
        await pinInsightAssistantContextByEventId(fallbackId, { switchTab: true, prefill: true });
      }
      return;
    }
    const trigger = element.closest("button[data-action='open-insight-chat']");
    if (!(trigger instanceof HTMLElement)) return;
    const eventId = Number(trigger.dataset.id || "");
    if (Number.isFinite(eventId)) {
      await openInsightChatByEventId(eventId, { triggerNode: trigger });
      return;
    }
    const fallback = typeof resolver === "function" ? resolver() : null;
    const fallbackId = Number(fallback?.id);
    if (!Number.isFinite(fallbackId)) {
      setInsightTip("当前没有可打开的事件详情。", true);
      return;
    }
    await openInsightChatByEventId(fallbackId, { triggerNode: trigger });
  });
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

function resolveWecomTestHint(errcode, errmsg = "") {
  const code = Number(errcode);
  const message = String(errmsg || "").toLowerCase();
  if (code === 0) {
    return "接口受理成功，请去企业微信群确认是否收到消息。";
  }
  if (code === 93000 || message.includes("invalid webhook")) {
    return "Webhook 无效：请重新在企业微信群机器人里复制完整地址。";
  }
  if (code === 93004 || message.includes("ip not in whitelist")) {
    return "机器人开启了 IP 白名单：请把当前服务器出口 IP 加到白名单。";
  }
  if (code === 45009 || message.includes("freq out of limit")) {
    return "发送过于频繁：请等待 1 分钟后重试。";
  }
  if (message.includes("keyword") || message.includes("content not match")) {
    return "机器人安全策略包含关键词校验：请在群机器人设置里调整关键词规则。";
  }
  return "请检查：1) Webhook 是否来自企业微信群机器人；2) 机器人是否仍在群里；3) 网络能否访问 qyapi.weixin.qq.com。";
}

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

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function summarizeInsightTriggerSkipped(skipped) {
  if (!Array.isArray(skipped) || skipped.length === 0) {
    return "未创建新分析任务。";
  }
  const first = skipped[0] || {};
  const symbol = labelSymbol(String(first.symbol || "")) || "当前标的";
  const retryAfter = Number(first.retry_after_sec);
  const reason = String(first.reason || "").toLowerCase();
  if (reason.includes("cooldown") || reason.includes("queued") || reason.includes("running")) {
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return `${symbol} 分析任务处于冷却/执行阶段，请 ${Math.round(retryAfter)} 秒后再试。`;
    }
    return `${symbol} 分析任务仍在执行或冷却中，请稍后再试。`;
  }
  return `${symbol} 未创建任务：${String(first.reason || "条件不足")}`;
}

async function waitForInsightEventsDone(eventIds, { timeoutMs = 45000, intervalMs = 2000 } = {}) {
  const pendingIds = Array.from(new Set((eventIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id))));
  const started = Date.now();
  if (pendingIds.length === 0) {
    return { done: true, eventsById: new Map() };
  }
  while (Date.now() - started <= Math.max(2000, Number(timeoutMs) || 45000)) {
    let events = [];
    try {
      events = await fetchJson("/api/insight/events?limit=120");
    } catch (_err) {
      events = [];
    }
    const eventsById = new Map();
    for (const item of Array.isArray(events) ? events : []) {
      const id = Number(item?.id);
      if (!Number.isFinite(id)) continue;
      eventsById.set(id, item);
    }
    let allDone = true;
    for (const id of pendingIds) {
      const row = eventsById.get(id);
      const status = String(row?.status || "").toLowerCase();
      if (status !== "completed" && status !== "failed") {
        allDone = false;
        break;
      }
    }
    if (allDone) {
      return { done: true, eventsById };
    }
    await sleep(intervalMs);
  }
  return { done: false, eventsById: new Map() };
}

async function triggerInsightSummaryNow() {
  if (state.insightTriggerBusy) {
    setGlobalInsightFeedback("已有 AI 分析任务正在执行，请等待当前任务完成。", { panelState: "running" });
    return;
  }
  const remaining = insightTriggerCooldownRemainingSec();
  if (remaining > 0) {
    setGlobalInsightFeedback(`触发过于频繁，请 ${remaining} 秒后再试。`, { isError: true, panelState: "error" });
    return;
  }

  const confirm = await openActionModal({
    title: "确认开始 AI 分析",
    text: "将立即对当前监控标的发起 AI 归因。触发后会自动刷新结果，并进入冷却以防重复生成报告。",
    confirmText: "确认开始",
    cancelText: "取消",
  });
  if (!confirm?.confirmed) return;

  state.insightTriggerBusy = true;
  syncInsightTriggerButtons();
  try {
    setGlobalInsightFeedback("正在提交 AI 分析任务...", { panelState: "running" });
    const payload = await fetchJson("/api/insight/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manual_cooldown_sec: 90 }),
    });
    const created = Array.isArray(payload?.created) ? payload.created : [];
    const skipped = Array.isArray(payload?.skipped) ? payload.skipped : [];
    const firstEventId = Number(created?.[0]?.event_id);
    if (Number.isFinite(firstEventId)) {
      state.latestTriggeredInsightEventId = firstEventId;
    }
    if (created.length === 0) {
      const message = summarizeInsightTriggerSkipped(skipped);
      setGlobalInsightFeedback(message, { isError: true, panelState: "error" });
      const retryAfter = Number(skipped?.[0]?.retry_after_sec);
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        startInsightTriggerCooldown(retryAfter);
      }
      return;
    }

    const labels = created.map((item) => labelSymbol(String(item?.symbol || ""))).filter(Boolean);
    setGlobalInsightFeedback(`已创建 ${created.length} 条分析任务（${labels.join("、") || "当前标的"}），正在等待结果...`, {
      panelState: "running",
      eventId: Number.isFinite(firstEventId) ? firstEventId : null,
    });
    await refreshInsightEvents();
    if (Number.isFinite(firstEventId)) {
      await loadInsightEventDetail(firstEventId, { silent: true });
    }

    const createdIds = created.map((item) => Number(item?.event_id)).filter((id) => Number.isFinite(id));
    const waitResult = await waitForInsightEventsDone(createdIds, { timeoutMs: 45000, intervalMs: 2200 });

    await refreshInsightEvents();
    await refreshMarket();

    let focusId = Number.isFinite(firstEventId) ? firstEventId : null;
    for (const id of createdIds) {
      const row = waitResult.eventsById.get(id);
      if (String(row?.status || "").toLowerCase() === "completed") {
        focusId = id;
        break;
      }
    }
    if (Number.isFinite(focusId)) {
      await loadInsightEventDetail(focusId, { silent: true });
      await loadDashboardEventDetail(focusId, { silent: true });
    }

    if (waitResult.done) {
      const completedCount = createdIds.filter((id) => String(waitResult.eventsById.get(id)?.status || "").toLowerCase() === "completed").length;
      const message = `AI 分析已完成：${completedCount}/${created.length} 条完成，结果已自动刷新。`;
      setGlobalInsightFeedback(message, { panelState: completedCount > 0 ? "success" : "error", isError: completedCount === 0, eventId: focusId });
    } else {
      setGlobalInsightFeedback("任务已创建，仍在后台分析中。你可稍后点“在事件列表查看”查看最新结果。", {
        panelState: "running",
        eventId: focusId,
      });
    }
    startInsightTriggerCooldown(90);
  } catch (err) {
    console.error(err);
    setGlobalInsightFeedback("手动触发 AI 分析失败，请检查 AI 配置与网络连通性。", { isError: true, panelState: "error" });
  } finally {
    state.insightTriggerBusy = false;
    syncInsightTriggerButtons();
  }
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
    await refreshRulesAndAlerts();
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
    await refreshRulesAndAlerts();
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

if (el.btnLogout) {
  el.btnLogout.addEventListener("click", async () => {
    try {
      await fetchJson("/api/auth/logout", { method: "POST" });
    } catch (_err) {
      // Ignore errors and still force local redirect to login page.
    } finally {
      window.location.replace("/login");
    }
  });
}

ensureDashboardCharts();
ensureAuxCharts();
initWorkspaceFormModals();
bindDashboardJumpNav();
setDeployView("settings");
{ const _ws = window.__PAGE === "ai" ? "ai" : window.__PAGE === "system" ? "system" : "market"; setActiveWorkspace(_ws, { autoSelect: false, writeHash: false }); }

window.addEventListener("resize", () => {
  if (chartIntl) chartIntl.resize();
  if (chartDomestic) chartDomestic.resize();
  if (chartDual) chartDual.resize();
  if (chartYFinance) chartYFinance.resize();
  if (chartBacktestEquity) chartBacktestEquity.resize();
  repaintDashboardCharts();
  repaintAuxCharts();
});

window.addEventListener("gm:sidebar-state", () => {
  repaintDashboardCharts();
  repaintAuxCharts();
});

initTabRouting();
if (el.timeframe) {
  state.timeframe = String(el.timeframe.value || "1d").toLowerCase() === "1h" ? "1h" : "1d";
}
setLayout("split");
setKlineTableView("all");
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
console.log('[debug] calling refreshAll, activeTab:', state.activeTab, 'chartIntl:', !!chartIntl);
refreshAll({ includeSettings: true }).then(() => {
  console.log('[debug] refreshAll completed, intl bars:', state.intl.bars?.length, 'domestic bars:', state.domestic.bars?.length);
}).catch(err => console.error('[debug] refreshAll failed:', err));
