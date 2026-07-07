(function() {
// Golden Monitor - Market Module
var GM = window.GM, state = GM.state, el = GM.el;
var escapeHtml = GM.escapeHtml, fmtNumber = GM.fmtNumber, toNumberLoose = GM.toNumberLoose;
var roundTo = GM.roundTo, clamp = GM.clamp, labelSymbol = GM.labelSymbol;
var labelSource = GM.labelSource, formatLocalTime = GM.formatLocalTime, formatAge = GM.formatAge;
var freshnessText = GM.freshnessText, freshnessClass = GM.freshnessClass;
var asBiasClass = GM.asBiasClass, lineColor = GM.lineColor, safeHref = GM.safeHref;
var fetchJson = GM.fetchJson, setRefreshStatus = GM.setRefreshStatus, setRuleTip = GM.setRuleTip;
var setWecomTip = GM.setWecomTip, setDeployTip = GM.setDeployTip, setInviteTip = GM.setInviteTip;
var setUserManageTip = GM.setUserManageTip, setUserCreateTip = GM.setUserCreateTip;
var setUserManageSummary = GM.setUserManageSummary, setChangePasswordTip = GM.setChangePasswordTip;
var setLoginAuditTip = GM.setLoginAuditTip, setLoginAuditSummary = GM.setLoginAuditSummary;
var setInsightTip = GM.setInsightTip, setInsightProviderTip = GM.setInsightProviderTip;
var setInsightAssistantTip = GM.setInsightAssistantTip, setDashboardInsightTip = GM.setDashboardInsightTip;
var setActiveTab = GM.setActiveTab, setActiveWorkspace = GM.setActiveWorkspace;
var setDeployView = GM.setDeployView, openWorkspaceModal = GM.openWorkspaceModal;
var closeWorkspaceModal = GM.closeWorkspaceModal, closeWorkspaceModalForForm = GM.closeWorkspaceModalForForm;
var focusInlineForm = GM.focusInlineForm, openActionModal = GM.openActionModal;
var closeActionModal = GM.closeActionModal, renderWorkspaceGuide = GM.renderWorkspaceGuide;
var renderWorkspaceResponsibility = GM.renderWorkspaceResponsibility;
var scheduleAutoRefresh = GM.scheduleAutoRefresh, normalizeZoom = GM.normalizeZoom;
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
var renderWecomGuide = GM.renderWecomGuide;
var normalizeWecomWebhookHint = GM.normalizeWecomWebhookHint;
var renderSettings = GM.renderSettings, renderUsers = GM.renderUsers, renderLoginAudit = GM.renderLoginAudit;
var renderSourceExpectedInputs = GM.renderSourceExpectedInputs, readSourceExpectedInputs = GM.readSourceExpectedInputs;
var renderInsightSettings = GM.renderInsightSettings, renderInsightStrategyList = GM.renderInsightStrategyList;
var renderDetectedModels = GM.renderDetectedModels;
var refreshInsightSettings = GM.refreshInsightSettings, refreshInsightEvents = GM.refreshInsightEvents;
var refreshSettings = GM.refreshSettings, refreshUsers = GM.refreshUsers, refreshLoginAudit = GM.refreshLoginAudit;
var resolveWecomTestHint = GM.resolveWecomTestHint;
var alignEventTimeKey = GM.alignEventTimeKey;

// ECharts initialization
var chartIntl = null, chartDomestic = null, chartDual = null;
var chartYFinance = null;
var chartBacktestEquity = null;
var chartRetryTimer = null;
function renderDashboardOverlayEvent(eventId) {
  var numericId = Number(eventId);
  if (!Number.isFinite(numericId)) return null;
  selectDashboardEvent(numericId, { repaint: false });

  ensureDashboardCharts();

  var ev = (state.overlayEvents || []).find(function(e) { return Number(e.id) === numericId; });
  if (!ev) return null;

  var symbol = String(ev.symbol || "XAUUSD").toUpperCase();
  var timeframe = String(state.timeframe || "1d").toLowerCase();
  var eventKey = alignEventTimeKey(ev.triggered_at, timeframe);

  var bars = symbol === "AUCN" ? state.domestic.bars : state.intl.bars;
  var payload = buildCandlesPayload(bars || []);
  var xData = payload.x;
  if (!xData || xData.length === 0) return null;

  var idx = xData.indexOf(eventKey);
  if (idx < 0) {
    var dateOnly = eventKey.slice(0, 10);
    for (var i = 0; i < xData.length; i++) {
      if (xData[i].slice(0, 10) === dateOnly) { idx = i; break; }
    }
  }
  if (idx < 0) return null;

  var total = xData.length;
  var showCount = Math.min(40, Math.max(10, Math.ceil(total * 0.15)));
  var windowRatio = Math.min(0.50, Math.max(0.10, showCount / total));
  var centerRatio = (idx + 0.5) / total;
  var halfWindow = windowRatio / 2;
  var zoomStart = Math.max(0, (centerRatio - halfWindow) * 100);
  var zoomEnd = Math.min(100, (centerRatio + halfWindow) * 100);
  setZoomRange(zoomStart, zoomEnd);
  renderActiveCharts({ force: true });
  return { event: ev, symbol, timeKey: String(xData[idx]) };
}
var chartRepaintFrame = 0;
var auxChartRepaintFrame = 0;
var syncSplitZoom = false;

/* event marker floating animation state */
var eventFloatPhase = 0;
var eventFloatTimer = null;
var FLOAT_BASE_OFFSET = -10;
var FLOAT_OFFSET = [0, FLOAT_BASE_OFFSET];
var EVENT_MARKER_COLOR = "#60a5fa";
var FLOAT_STYLE = { color: EVENT_MARKER_COLOR };

function syncChartRefs() {
  GM.chartIntl = chartIntl;
  GM.chartDomestic = chartDomestic;
  GM.chartDual = chartDual;
  GM.chartYFinance = chartYFinance;
  GM.chartBacktestEquity = chartBacktestEquity;
}

function readChartHostMetrics(node) {
  if (!(node instanceof HTMLElement)) return null;
  var rect = node.getBoundingClientRect();
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    display: window.getComputedStyle(node).display,
    visibility: window.getComputedStyle(node).visibility,
  };
}
function chartHostReady(node) {
  var metrics = readChartHostMetrics(node);
  return Boolean(metrics && metrics.width > 32 && metrics.height > 48 && metrics.display !== "none" && metrics.visibility !== "hidden");
}
function ensureChartInstance(node, currentChart, label) {
  if (!(node instanceof HTMLElement)) return currentChart;
  if (currentChart && !currentChart.isDisposed && typeof currentChart.resize === "function") return currentChart;
  if (!chartHostReady(node) || typeof echarts === "undefined") return currentChart;
  try {
    var instance = echarts.getInstanceByDom(node) || echarts.init(node);
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
  syncChartRefs();
  bindDashboardChartEvents();
}
function ensureAuxCharts() {
  chartYFinance = ensureChartInstance(el.yfinanceChart, chartYFinance, "chart-yfinance");
  chartBacktestEquity = ensureChartInstance(el.backtestEquityChart, chartBacktestEquity, "chart-backtest-equity");
  syncChartRefs();
}
function scheduleChartRetry(reason) {
  if (chartRetryTimer) return;
  chartRetryTimer = window.setTimeout(function() {
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

ensureDashboardCharts();
ensureAuxCharts();

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
function dashboardVisible() {
  return state.activeTab === "dashboard";
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
function findChartEventAtPixel(chart, px, py) {
  if (!chart || typeof chart.getOption !== "function" || typeof chart.convertToPixel !== "function") return null;
  var option = chart.getOption();
  var series = option && option.series ? option.series : [];
  var nearest = null;
  series.forEach(function(item) {
    if (!item || item.type !== "scatter" || String(item.name || "").indexOf("AI事件") < 0) return;
    var offset = Array.isArray(item.symbolOffset) ? item.symbolOffset : [0, 0];
    var offsetX = Number(offset[0]) || 0;
    var offsetY = Number(offset[1]) || 0;
    var data = item.data || [];
    data.forEach(function(point) {
      if (!point || !point.value || point.eventId === undefined || point.eventId === null) return;
      var pixel = null;
      try {
        pixel = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: Number(item.yAxisIndex || 0) }, point.value);
      } catch (error) {
        pixel = null;
      }
      if (!pixel || pixel.length < 2) return;
      var dx = Number(pixel[0]) + offsetX - px;
      var dy = Number(pixel[1]) + offsetY - py;
      var distance = Math.sqrt(dx * dx + dy * dy);
      if (!Number.isFinite(distance) || distance > 16) return;
      if (!nearest || distance < nearest.distance) {
        nearest = { eventId: Number(point.eventId), distance };
      }
    });
  });
  if (!nearest) return null;
  var ev = (state.overlayEvents || []).find(function(item) { return Number(item.id) === nearest.eventId; });
  if (!ev) return null;
  var timeframe = String(state.timeframe || "1d").toLowerCase();
  return {
    event: ev,
    eventId: nearest.eventId,
    timeKey: alignEventTimeKey(ev.triggered_at, timeframe),
    symbol: String(ev.symbol || "XAUUSD").toUpperCase(),
    direction: String(ev.direction || "").toLowerCase(),
    chart: chart,
  };
}
function openDashboardEventPopup(hit) {
  if (!hit || !Number.isFinite(Number(hit.eventId))) return false;
  selectDashboardEvent(Number(hit.eventId));
  window.setTimeout(function() {
    showEventFloatingPopup(hit.timeKey, hit.symbol, hit.direction, hit.eventId, hit.chart);
  }, 0);
  return true;
}
function bindDashboardChartEvent(chart, kind) {
  if (!chart || chart.__gmDashboardBound === kind) return;
  chart.__gmDashboardBound = kind;
  chart.on("click", function(params) { handleDashboardChartClick(params, chart, kind); });
  if (chart.getZr && !chart.__gmZrClickBound) {
    chart.__gmZrClickBound = true;
    chart.getZr().on('click', function(zrEvent) {
      if (!zrEvent) return;
      var px = zrEvent.offsetX != null ? zrEvent.offsetX : (zrEvent.clientX || 0);
      var py = zrEvent.offsetY != null ? zrEvent.offsetY : (zrEvent.clientY || 0);
      if (px < 0 || py < 0) return;
      var hit = findChartEventAtPixel(chart, px, py);
      if (!hit) return;
      if (window.console) console.log('[chart] zr click -> popup:', hit.timeKey, hit.symbol, hit.direction, hit.eventId);
      openDashboardEventPopup(hit);
    });
  }
  chart.on("datazoom", () => handleDashboardChartZoom(kind));
}
function handleDashboardChartClick(params, chart, kind) {
  var directEventId = Number(params?.data?.eventId);
  if (Number.isFinite(directEventId)) {
    var directEvent = (state.overlayEvents || []).find(function(ev) { return Number(ev.id) === directEventId; });
    if (directEvent) {
      var directTimeframe = String(state.timeframe || '1d').toLowerCase();
      openDashboardEventPopup({
        event: directEvent,
        eventId: directEventId,
        timeKey: alignEventTimeKey(directEvent.triggered_at, directTimeframe),
        symbol: String(directEvent.symbol || 'XAUUSD').toUpperCase(),
        direction: String(directEvent.direction || '').toLowerCase(),
        chart: chart,
      });
      return;
    }
  }
  /* use axis position (name) to find events — works even when click hits candlestick, not scatter */
  var axisName = String(params.name || params.axisValue || '');
  if (!axisName && params.value && Array.isArray(params.value)) axisName = String(params.value[0]);
  if (!axisName) {
    if (window.console) console.log('[chart] click ignored — no axis name');
    return;
  }
  var timeKey = axisName;
  var seriesName = String(params.seriesName || '');
  var timeframe = String(state.timeframe || '1d').toLowerCase();
  /* determine symbol from series name */
  var symbol = '';
  if (seriesName.indexOf('AUCN') > -1) symbol = 'AUCN';
  else if (seriesName.indexOf('XAUUSD') > -1 || seriesName.indexOf('\u56fd\u9645') > -1 || seriesName.indexOf('AI') > -1) symbol = 'XAUUSD';
  /* find events at this time position */
  var matchedEvents = (state.overlayEvents || []).filter(function(ev) {
    if (symbol && String(ev.symbol || '').toUpperCase() !== symbol) return false;
    var evKey = alignEventTimeKey(ev.triggered_at, timeframe);
    return evKey === timeKey;
  });
  if (matchedEvents.length === 0) {
    if (window.console) console.log('[chart] click ignored — no events at', timeKey);
    return;
  }
  /* determine direction from clicked scatter point, or from first matched event */
  var eventId = params?.data?.eventId;
  var clickedEv = null;
  if (eventId) clickedEv = matchedEvents.find(function(e) { return Number(e.id) === Number(eventId); });
  var dir = clickedEv ? String(clickedEv.direction || '').toLowerCase() : String(matchedEvents[0].direction || '').toLowerCase();
  symbol = symbol || String(matchedEvents[0].symbol || 'XAUUSD').toUpperCase();
  var selectedEventId = clickedEv ? Number(clickedEv.id) : Number(matchedEvents[0].id);
  if (Number.isFinite(selectedEventId)) {
    openDashboardEventPopup({
      event: clickedEv || matchedEvents[0],
      eventId: selectedEventId,
      timeKey: timeKey,
      symbol: symbol,
      direction: dir,
      chart: chart,
    });
    return;
  }
  if (window.console) console.log('[chart] click -> popup:', timeKey, symbol, dir, matchedEvents.length, 'events', selectedEventId);
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
  chartRepaintFrame = requestAnimationFrame(function() {
    chartRepaintFrame = requestAnimationFrame(function() {
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
  auxChartRepaintFrame = requestAnimationFrame(function() {
    auxChartRepaintFrame = requestAnimationFrame(function() {
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
function priceMap(items) {
  const map = {};
  for (const item of items || []) {
    map[item.symbol] = item;
  }
  return map;
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
function findCandlestickParam(params) {
  if (!Array.isArray(params)) return null;
  return params.find(function(item) { return item && item.seriesType === "candlestick"; }) || null;
}
function readCandleValues(param, bars) {
  var idx = Number(param?.dataIndex);
  var raw = Array.isArray(param?.data) ? param.data : Array.isArray(param?.value) ? param.value : null;
  var values = raw && raw.length >= 4 ? raw : null;
  var bar = Number.isFinite(idx) && bars && idx >= 0 && idx < bars.length ? bars[idx] : null;
  var open = values ? Number(values[0]) : Number(bar?.open);
  var close = values ? Number(values[1]) : Number(bar?.close);
  var low = values ? Number(values[2]) : Number(bar?.low);
  var high = values ? Number(values[3]) : Number(bar?.high);
  return { idx, open, close, low, high };
}
function previousCloseAt(bars, idx) {
  for (var j = Number(idx) - 1; j >= 0; j--) {
    var bar = bars && bars[j];
    if (!bar) continue;
    var prevClose = Number(bar.close);
    if (Number.isFinite(prevClose) && prevClose > 0) return prevClose;
  }
  return null;
}
function renderTooltipRow(label, valueHtml) {
  return '<div style="display:flex;justify-content:space-between;gap:18px;color:#94a3b8">' +
    '<span>' + label + '</span>' +
    '<span style="font-weight:700;color:#dbe7f3">' + valueHtml + '</span>' +
  '</div>';
}
function renderKlineTooltip(params, bars, extraRows) {
  try {
    if (!params || !params.length) return "";
    var candleParam = findCandlestickParam(params);
    var firstParam = candleParam || params[0];
    var ts = String(firstParam?.axisValue || firstParam?.name || "");
    if (!candleParam) {
      return ts ? '<div style="font-size:12px;color:#dbe7f3">' + escapeHtml(ts) + '</div>' : "";
    }
    var candle = readCandleValues(candleParam, bars);
    var fmt = function(value) { return Number.isFinite(value) ? fmtNumber(value, 2) : "--"; };
    var lines = [
      '<div style="font-weight:700;margin-bottom:6px;color:#f8fafc">' + escapeHtml(ts) + '</div>',
      renderTooltipRow("开盘", fmt(candle.open)),
      renderTooltipRow("收盘", fmt(candle.close)),
      renderTooltipRow("高点", fmt(candle.high)),
      renderTooltipRow("低点", fmt(candle.low)),
    ];
    var prevClose = previousCloseAt(bars, candle.idx);
    var barClose = Number.isFinite(candle.idx) && bars && bars[candle.idx] ? Number(bars[candle.idx].close) : NaN;
    if (Number.isFinite(prevClose) && prevClose > 0 && Number.isFinite(barClose)) {
      var pct = (barClose - prevClose) / prevClose * 100;
      var color = pct >= 0 ? "#f87171" : "#34d399";
      var sign = pct >= 0 ? "+" : "";
      var absPct = Math.abs(pct);
      var pctText = absPct > 0 && absPct < 0.01 ? sign + "<0.01" : sign + fmtNumber(absPct, 2);
      lines.push(
        '<div style="border-top:1px solid rgba(148,163,184,0.24);margin-top:7px;padding-top:7px;color:#94a3b8">' +
          '<span>涨跌幅 </span><span style="color:' + color + ';font-weight:700">' + pctText + '%</span>' +
        '</div>'
      );
    }
    if (Array.isArray(extraRows) && extraRows.length) lines = lines.concat(extraRows);
    return '<div style="font-size:12px;line-height:1.8;min-width:142px">' + lines.join('') + '</div>';
  } catch (error) {
    return "";
  }
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
    map.set(axisTimeKey(row.ts, timeframe), Number(row.close));
  }
  return map;
}
function eventsForSymbol(symbol) {
  return (state.overlayEvents || []).filter((item) => String(item.symbol || "").toUpperCase() === symbol);
}
function eventStatusLabel(status) {
  const value = String(status || "").toLowerCase();
  const map = { completed: "已完成", failed: "失败", running: "分析中", queued: "待处理", insufficient: "证据不足" };
  return map[value] || value || "--";
}
function eventStatusColor(status) {
  const value = String(status || "").toLowerCase();
  if (value === "failed") return "#d12f3f";
  if (value === "completed") return "#2d8a55";
  return "#d4a843";
}
function selectDashboardEvent(eventId, options = {}) {
  const numericId = Number(eventId);
  if (!Number.isFinite(numericId)) return false;
  state.selectedOverlayEventId = numericId;
  const loadDetail = typeof GM.loadDashboardEventDetail === "function" ? GM.loadDashboardEventDetail : loadDashboardEventDetail;
  if (typeof loadDetail === "function") loadDetail(numericId, { silent: Boolean(options.silent) });
  renderDashboardEventTimeline();
  if (options.repaint !== false) renderActiveCharts({ force: true });
  return true;
}
function highByTimeKeyMap(bars, timeframe) {
  const map = new Map();
  for (const row of bars || []) {
    map.set(axisTimeKey(row?.ts, timeframe), Number(row?.high));
  }
  return map;
}
function renderEventPopupContent(ev) {
  var result = ev && ev.result && typeof ev.result === "object" ? ev.result : {};
  var summary = cleanInsightRichText(
    result.summary_short || ev.summary || result.summary || "",
    { maxChars: 420, compact: false }
  );
  var reason = cleanInsightRichText(
    result.narrative_confidence_reason || ev.confidence_reason || result.confidence_reason || "",
    { maxChars: 260, compact: true }
  );
  var error = cleanInsightRichText(ev.error || "", { maxChars: 220, compact: true });
  var evidence = collectInsightEvidence(ev).slice(0, 2);
  var evidenceHtml = evidence.length > 0
    ? '<div class="ev-popup-evidence">' +
        '<div class="ev-popup-section-title">证据</div>' +
        evidence.map(function(item) {
          var title = cleanInsightRichText(item && item.title ? item.title : "未命名新闻", { maxChars: 90, compact: true }) || "未命名新闻";
          var outlet = cleanInsightRichText(item && item.outlet ? item.outlet : "未知媒体", { maxChars: 40, compact: true }) || "未知媒体";
          var url = safeHref(item && item.url);
          var titleHtml = url
            ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(title) + '</a>'
            : '<span>' + escapeHtml(title) + '</span>';
          return '<div class="ev-popup-evidence-item">' +
            titleHtml +
            '<span class="ev-popup-evidence-meta">' + escapeHtml(outlet) + '</span>' +
          '</div>';
        }).join('') +
      '</div>'
    : '';
  if (!summary && error) {
    summary = "分析失败：" + error;
  }
  if (!summary) {
    var status = String(ev.status || "").toLowerCase();
    summary = status === "queued" || status === "running"
      ? "分析内容生成中。"
      : "暂无分析结论。";
  }
  return '<div class="ev-popup-content">' +
    '<div class="ev-popup-section-title">事件内容</div>' +
    '<p class="ev-popup-summary">' + escapeHtml(summary) + '</p>' +
    (reason ? '<p class="ev-popup-reason"><span>理由</span>' + escapeHtml(reason) + '</p>' : '') +
    evidenceHtml +
  '</div>';
}
function eventScatterSeries(symbol, bars, yAxisIndex = 0) {
  const timeframe = String(state.timeframe || "1d").toLowerCase();
  const selectedId = Number(state.selectedOverlayEventId);
  const closeMap = closeByTimeKeyMap(bars, timeframe);
  const highMap = highByTimeKeyMap(bars, timeframe);
  const data = eventsForSymbol(symbol)
    .map((event) => {
      const timeKey = alignEventTimeKey(event.triggered_at, timeframe);
      const close = closeMap.get(timeKey) ?? closeMap.get(axisTimeKey(event.triggered_at, "1d"));
      const high = highMap.get(timeKey) ?? closeMap.get(axisTimeKey(event.triggered_at, "1d"));
      if (!Number.isFinite(close)) return null;
      var yPos = Number.isFinite(high) ? high : close;
      const eventId = Number(event.id);
      const status = String(event.status || "").toLowerCase();
      const isSelected = Number.isFinite(selectedId) && eventId === selectedId;
      const statusColor = eventStatusColor(status);
      return {
        value: [timeKey, yPos],
        eventId: event.id,
        statusLabel: status,
        yAxisIndex,
        itemStyle: {
          color: EVENT_MARKER_COLOR,
          borderColor: isSelected ? "#ffffff" : EVENT_MARKER_COLOR,
          borderWidth: isSelected ? 2 : 0,
        },
        label: {
          show: isSelected,
          formatter: "#" + eventId + " " + eventStatusLabel(status),
          position: "top",
          distance: 8,
          color: "#f8fafc",
          fontSize: 11,
          fontWeight: 700,
          backgroundColor: "rgba(15,23,42,0.82)",
          borderColor: statusColor,
          borderWidth: 1,
          borderRadius: 4,
          padding: [3, 6],
        },
      };
    })
    .filter(Boolean);
  return {
    name: `${symbol}-AI事件`,
    type: "scatter",
    yAxisIndex,
    data,
    symbol: "triangle",
    symbolSize: 11,
    symbolRotate: 180,
    symbolOffset: FLOAT_OFFSET,
    itemStyle: Object.assign({}, FLOAT_STYLE),
    animationDurationUpdate: 1000,
    tooltip: {
      formatter: (params) => {
        const source = params?.data || {};
        const sid = source.eventId || "--";
        const sstatus = source.statusLabel || "";
        const sstatusMap = {completed:"已完成",failed:"失败",running:"分析中",queued:"待处理",insufficient:"证据不足"};
        const stxt = sstatusMap[sstatus] || "";
        return '<div style="font-size:11px;line-height:1.5">' +
          '<b>#' + sid + '</b>' +
          (stxt ? ' <span style="opacity:0.55">' + stxt + '</span>' : '') +
          '</div>';
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
      smooth: false,
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
      backgroundColor: "rgba(15, 23, 42, 0.94)",
      borderColor: "rgba(148, 163, 184, 0.28)",
      borderWidth: 1,
      textStyle: { color: "#dbe7f3", fontSize: 12 },
      extraCssText: "box-shadow:0 14px 38px rgba(0,0,0,0.34);border-radius:10px;padding:10px 12px;",
      formatter: function(params) { return renderKlineTooltip(params, bars); },
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
  var dom = typeof chart.getDom === "function" ? chart.getDom() : null;
  if (!chartHostReady(dom)) {
    scheduleChartRetry("chart host not ready");
    return;
  }
  chart.resize();
  chart.setOption(option, { notMerge: false, replaceMerge: ["series"] });
}
function renderSplitCharts() {
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
      backgroundColor: "rgba(15, 23, 42, 0.94)",
      borderColor: "rgba(148, 163, 184, 0.28)",
      borderWidth: 1,
      textStyle: { color: "#dbe7f3", fontSize: 12 },
      extraCssText: "box-shadow:0 14px 38px rgba(0,0,0,0.34);border-radius:10px;padding:10px 12px;",
      formatter: function(params) {
        var extraRows = [];
        (params || []).forEach(function(p) {
          if (p && p.seriesName === "国内积存金") {
            var v = Array.isArray(p.value) ? Number(p.value[p.value.length - 1]) : Number(p.value);
            if (Number.isFinite(v)) extraRows.push(renderTooltipRow("国内积存金", fmtNumber(v, 2)));
          }
        });
        return renderKlineTooltip(params, intlBars, extraRows);
      },
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
        lineStyle: { width: 1.2, color: "#4a7ab8" },
      },
      {
        name: "MA5",
        type: "line",
        data: roundedSeries(state.intl.indicators?.series?.ma5, 2),
        yAxisIndex: 0,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 2, color: lineColor("ma5") },
      },
      {
        name: "MA20",
        type: "line",
        data: roundedSeries(state.intl.indicators?.series?.ma20, 2),
        yAxisIndex: 0,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 2, color: lineColor("ma20") },
      },
      {
        name: "MA60",
        type: "line",
        data: roundedSeries(state.intl.indicators?.series?.ma60, 2),
        yAxisIndex: 0,
        smooth: false,
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
  renderDashboardEventTimeline();
  if (state.overlayEvents.length === 0) {
    renderInsightDetailEmpty("当前区间没有可联动的 AI 事件。", el.dashboardInsightDetail);
    setDashboardInsightTip("当前区间暂无 AI 事件。");
  } else if (state.selectedOverlayEventId) {
    const loadDetail = typeof GM.loadDashboardEventDetail === "function" ? GM.loadDashboardEventDetail : loadDashboardEventDetail;
    if (typeof loadDetail === "function") {
      await loadDetail(state.selectedOverlayEventId, { silent: true });
    }
  } else {
    const loadDetail = typeof GM.loadDashboardEventDetail === "function" ? GM.loadDashboardEventDetail : loadDashboardEventDetail;
    if (typeof loadDetail === "function") {
      await loadDetail(state.overlayEvents[0].id, { silent: true });
    }
  }
  startEventMarkerAnimation();
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

GM.refreshMarket = refreshMarket; GM.refreshRulesAndAlerts = refreshRulesAndAlerts;
GM.refreshYFinance = refreshYFinance; GM.repaintDashboardCharts = repaintDashboardCharts;


/* ======================================================================= */
/* Event floating popup — shown when clicking an event triangle on chart */
/* ======================================================================= */
function showEventFloatingPopup(timeKey, symbol, clickedDir, focusedEventId) {
  hideEventFloatingPopup();
  var allEvents = (state.overlayEvents || []).filter(function(ev) {
    if (String(ev.symbol || '').toUpperCase() !== symbol) return false;
    var evKey = alignEventTimeKey(ev.triggered_at, String(state.timeframe || '1d'));
    return evKey === timeKey;
  });
  var numericFocusId = Number(focusedEventId);
  var events = Number.isFinite(numericFocusId)
    ? allEvents.filter(function(ev) { return Number(ev.id) === numericFocusId; })
    : [];
  if (events.length === 0) events = allEvents.filter(function(ev) {
    var evDir = String(ev.direction || '').toLowerCase();
    if (clickedDir === 'up' && evDir !== 'up') return false;
    if (clickedDir === 'down' && evDir !== 'down') return false;
    return true;
  });
  if (events.length === 0) {
    events = allEvents;
  }
  if (events.length === 0) return;
  var chartEl = (symbol === 'AUCN' ? chartDomestic : chartIntl) || chartDual;
  if (!chartEl || typeof chartEl.getDom !== 'function') return;
  var container = chartEl.getDom();
  if (!container) return;
  var rect = container.getBoundingClientRect();
  var itemsHtml = events.map(function(ev) {
    var id = Number(ev.id);
    var dir = String(ev.direction || '').toLowerCase();
    var dirLabel = dir === 'up' ? '涨' : '跌';
    var chg = Number(ev.change_pct || 0);
    var chgStr = (chg >= 0 ? '+' : '') + fmtNumber(chg, 2) + '%';
    var chgColor = dir === 'up' ? '#f87171' : '#34d399';
    var rawStatus = String(ev.status || '').toLowerCase();
    var statusMap = {completed:'已完成',failed:'失败',running:'分析中',queued:'待处理',insufficient:'证据不足'};
    var stxt = statusMap[rawStatus] || rawStatus || '--';
    var statusCls = rawStatus === 'failed' ? 'badge-failed' : rawStatus === 'completed' ? 'badge-success' : 'badge-pending';
    return '<div class="ev-popup-item" data-eid="' + id + '">' +
      '<div class="ev-popup-item-head">' +
        '<span class="ev-popup-id">#' + id + '</span>' +
        '<span class="overlay-badge ' + statusCls + '">' + stxt + '</span>' +
        '<span class="ev-popup-dir" style="color:' + chgColor + '">' + dirLabel + ' ' + chgStr + '</span>' +
      '</div>' +
      '<div class="ev-popup-item-ts">' + formatLocalTime(ev.triggered_at) + '</div>' +
      renderEventPopupContent(ev) +
    '</div>';
  }).join('');
  var overlay = document.getElementById('event-floating-popup-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'event-floating-popup-overlay';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) hideEventFloatingPopup();
    });
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'block';
  var popup = document.getElementById('event-floating-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'event-floating-popup';
    document.body.appendChild(popup);
  }
  var dirLabel = clickedDir === 'up' ? '涨' : '跌';
  var popupSubtitle = Number.isFinite(numericFocusId) ? '已定位事件' : '当日' + dirLabel + '市相关 AI 事件';
  popup.innerHTML =
    '<div class="ev-popup-header">' +
      '<div class="ev-popup-header-left">' +
        '<span class="ev-popup-title">' + timeKey + ' ' + labelSymbol(symbol) + '</span>' +
        '<span class="ev-popup-subtitle">' + popupSubtitle + '</span>' +
      '</div>' +
      '<button type="button" class="ev-popup-close" title="关闭">&times;</button>' +
    '</div>' +
    '<div class="ev-popup-body">' + itemsHtml + '</div>';
  popup.style.display = 'block';
  var popupRect = popup.getBoundingClientRect();
  var left = Math.max(10, Math.min(rect.left + rect.width - popupRect.width - 10, window.innerWidth - popupRect.width - 10));
  var top = Math.max(rect.top + 50, Math.min(rect.top + rect.height - popupRect.height - 10, window.innerHeight - popupRect.height - 10));
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.querySelector('.ev-popup-close').addEventListener('click', hideEventFloatingPopup);
  /* item click loads detail */
  Array.from(popup.querySelectorAll('.ev-popup-item')).forEach(function(item) {
    item.addEventListener('click', function() {
      var eid = Number(this.dataset.eid);
      if (Number.isFinite(eid)) {
        selectDashboardEvent(eid);
      }
    });
  });
  /* keyboard escape closes */
  var escHandler = function(ke) { if (ke.key === 'Escape') { hideEventFloatingPopup(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
}
function hideEventFloatingPopup() {
  var popup = document.getElementById('event-floating-popup');
  if (popup) { popup.style.display = 'none'; popup.innerHTML = ''; }
  var overlay = document.getElementById('event-floating-popup-overlay');
  if (overlay) overlay.style.display = 'none';
}


/* ======================================================================= */
/* Event Timeline — show all overlay events as compact cards */
/* ======================================================================= */
function renderDashboardEventTimeline() {
  var host = document.getElementById("dashboard-overlay-container");
  if (!host) return;
  var events = state.overlayEvents || [];
  if (events.length === 0) {
    host.innerHTML = "";
    return;
  }
  var selectedId = Number(state.selectedOverlayEventId);
  host.innerHTML = events.map(function(ev) {
    var id = Number(ev.id);
    var isSelected = Number.isFinite(selectedId) && id === selectedId;
    var symbol = ev.symbol || "XAUUSD";
    var dir = String(ev.direction || "").toLowerCase();
    var dirLabel = dir === "up" ? "涨" : "跌";
    var chg = Number(ev.change_pct || 0);
    var chgStr = (chg >= 0 ? "+" : "") + fmtNumber(chg, 2) + "%";
    var chgColor = chg >= 0 ? "#c96060" : "#2d8a55";
    var ts = formatLocalTime(ev.triggered_at);
    var rawStatus = String(ev.status || "").toLowerCase();
    var statusLabel = rawStatus === "completed" ? "已完成" : rawStatus === "failed" ? "失败" : rawStatus === "running" ? "分析中" : rawStatus === "queued" ? "待处理" : rawStatus === "insufficient" ? "证据不足" : rawStatus || "--";
    var statusCls = rawStatus === "failed" ? "badge-failed" : rawStatus === "completed" ? "badge-success" : "badge-pending";
    var pinDotCls = rawStatus === "failed" ? "ev-pin-failed" : rawStatus === "completed" ? "ev-pin-success" : "ev-pin-pending";
    var locateSvg = '<svg class="ev-locate-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="7"/></svg>';
    return '<div class="ev-timeline-item' + (isSelected ? " ev-timeline-active" : "") + '" data-event-id="' + id + '">' +
      '<div class="ev-timeline-pin"><span class="ev-pin-dot ' + pinDotCls + '"></span></div>' +
      '<div class="ev-timeline-body">' +
        '<div class="ev-timeline-head">' +
          '<span class="ev-timeline-id">#' + id + '</span>' +
          '<span class="overlay-badge ' + statusCls + '">' + escapeHtml(statusLabel) + '</span>' +
          '<span class="ev-timeline-symbol">' + escapeHtml(labelSymbol(symbol)) + '</span>' +
          '<span class="ev-timeline-dir" style="color:' + chgColor + ';font-weight:600">' + dirLabel + ' ' + chgStr + '</span>' +
          '<button type="button" class="ev-locate-btn" title="定位到图表" data-locate-id="' + id + '">' + locateSvg + '</button>' +
        '</div>' +
        '<div class="ev-timeline-ts">' + escapeHtml(ts) + '</div>' +
      '</div>' +
    '</div>';
  }).join("");
  /* bind card click — load detail + highlight timeline */
  Array.from(host.querySelectorAll(".ev-timeline-item")).forEach(function(item) {
    item.addEventListener("click", function(e) {
      if (e.target.closest(".ev-locate-btn")) return;
      var eid = Number(this.dataset.eventId);
      if (Number.isFinite(eid)) {
        selectDashboardEvent(eid);
      }
    });
  });
  /* bind locate button — zoom chart + show detail */
  Array.from(host.querySelectorAll(".ev-locate-btn")).forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var eid = Number(this.dataset.locateId);
      if (Number.isFinite(eid)) handleTimelineEventClick(eid);
    });
  });
}

function handleTimelineEventClick(eventId) {
  var located = renderDashboardOverlayEvent(eventId);
  /* update timeline highlight */
  renderDashboardEventTimeline();
  if (located) {
    var dir = String(located.event.direction || "").toLowerCase();
    window.setTimeout(function() {
      showEventFloatingPopup(located.timeKey, located.symbol, dir, eventId);
    }, 80);
  }
  var detailBody = document.getElementById("dashboard-insight-detail");
  if (detailBody) detailBody.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ======================================================================= */
/* Event marker floating + fade animation */
/* ======================================================================= */
function startEventMarkerAnimation() {
  if (eventFloatTimer) return;
  eventFloatTimer = setInterval(function() {
    eventFloatPhase += Math.PI / 10; // ~0.314, one sine cycle per second at 50ms tick
    var floatOffset = FLOAT_BASE_OFFSET + Math.sin(eventFloatPhase) * 3;
    var floatOpacity = 0.6 + Math.sin(eventFloatPhase) * 0.3; // 0.3~0.9 range, synced with float cycle
    var updatedOffset = [0, floatOffset];
    [chartIntl, chartDomestic, chartDual].forEach(function(ch) {
      if (!ch || typeof ch.setOption !== "function") return;
      try {
        var opt = ch.getOption();
        var series = opt.series || [];
        var changed = false;
        series.forEach(function(s) {
          if (s.type === "scatter" && s.name && s.name.indexOf("AI事件") > -1) {
            s.symbolOffset = updatedOffset;
            if (!s.itemStyle) s.itemStyle = {};
            s.itemStyle.opacity = floatOpacity;
            changed = true;
          }
        });
        if (changed) {
          ch.setOption({ series: series }, { replaceMerge: ["series"], animationDurationUpdate: 0 });
        }
      } catch(e) { /* animation tick error */ }
    });
  }, 50);
}

function stopEventMarkerAnimation() {
  if (eventFloatTimer) {
    clearInterval(eventFloatTimer);
    eventFloatTimer = null;
  }
  eventFloatPhase = 0;
  FLOAT_OFFSET[1] = FLOAT_BASE_OFFSET;
  FLOAT_STYLE.opacity = undefined;
}

GM.repaintAuxCharts = repaintAuxCharts;
GM.renderActiveCharts = renderActiveCharts; GM.setLayout = setLayout;
GM.setKlineTableView = setKlineTableView; GM.bindChartEventClicks = bindChartEventClicks;
syncChartRefs();
GM.renderBacktestResult = renderBacktestResult; GM.renderBacktestCompareResult = renderBacktestCompareResult;
GM.updateCards = updateCards; GM.renderRules = renderRules; GM.renderAlerts = renderAlerts;
GM.renderSourceStatus = renderSourceStatus; GM.renderBacktestRuleOptions = renderBacktestRuleOptions;
GM.renderBacktestCompareRuleOptions = renderBacktestCompareRuleOptions;
GM.readBacktestCompareRuleIds = readBacktestCompareRuleIds;
// --- Missing exports (functions defined here but needed by init.js via GM) ---
GM.applyZoomToChart = applyZoomToChart;
GM.readChartZoom = readChartZoom;
GM.setZoomRange = setZoomRange;
GM.zoomBy = zoomBy;
GM.dashboardVisible = dashboardVisible;
GM.fillRuleByCurrentPrice = fillRuleByCurrentPrice;
GM.priceMap = priceMap;
GM.setDeployTip = setDeployTip;
GM.setInviteTip = setInviteTip;
GM.setUserManageTip = setUserManageTip;
GM.setUserCreateTip = setUserCreateTip;
GM.setUserManageSummary = setUserManageSummary;
GM.setChangePasswordTip = setChangePasswordTip;
GM.setLoginAuditTip = setLoginAuditTip;
GM.setLoginAuditSummary = setLoginAuditSummary;
GM.setBacktestTip = setBacktestTip;
GM.setBacktestCompareTip = setBacktestCompareTip;
GM.renderDetectedModels = renderDetectedModels;
GM.renderInsightSettings = renderInsightSettings;
GM.renderInsightStrategyList = renderInsightStrategyList;
GM.updateBacktestCompareSortUi = updateBacktestCompareSortUi;
})();
