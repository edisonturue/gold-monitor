(function() {
// Golden Monitor - AI Module
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
var renderNotifyPreview = GM.renderNotifyPreview, renderWecomGuide = GM.renderWecomGuide;
var normalizeWecomWebhookHint = GM.normalizeWecomWebhookHint;
var renderSettings = GM.renderSettings, renderUsers = GM.renderUsers, renderLoginAudit = GM.renderLoginAudit;
var renderSourceExpectedInputs = GM.renderSourceExpectedInputs, readSourceExpectedInputs = GM.readSourceExpectedInputs;
var refreshSettings = GM.refreshSettings, refreshUsers = GM.refreshUsers, refreshLoginAudit = GM.refreshLoginAudit;
var updateBacktestCompareSortUi = GM.updateBacktestCompareSortUi;
var axisTimeKey = GM.axisTimeKey, alignEventTimeKey = GM.alignEventTimeKey;
var closeByTimeKeyMap = GM.closeByTimeKeyMap, eventsForSymbol = GM.eventsForSymbol;
var eventScatterSeries = GM.eventScatterSeries, axisIntervalBySize = GM.axisIntervalBySize;
var roundedSeries = GM.roundedSeries, buildCandlesPayload = GM.buildCandlesPayload;
var sanitizeBars = GM.sanitizeBars, ensureBarsFromLatest = GM.ensureBarsFromLatest;

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
  return "你好，我已连接到当前 AI 配置。你可以直接问我黄金、策略或风险判断问题。";
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
    summary: "自动携带行情快照、最近事件与新闻证据。",
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
    el.insightAssistantTurns.innerHTML = '<p class="meta">发送第一条消息后，将在这里显示会话节点。</p>';
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
function renderInsightDetailEmpty(text = "点击左侧事件查看归因详情...", targetEl = null) {
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
      <h4>⚙ 请求诊断</h4>
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

function renderCleanPrimaryCause(result) {
  if (!result || typeof result !== "object") return "";
  var raw = result.primary_cause || (Array.isArray(result.primary_causes_ranked) ? result.primary_causes_ranked[0] : "") || "";
  if (raw.indexOf("AI分析失败") >= 0 || raw.indexOf("failed:") >= 0 || raw.indexOf("FAILED") >= 0 || raw.indexOf("连接失败") >= 0) {
    return "AI 分析服务异常：" + String(result.diagnostics?.kind || "unknown") + "，查看请求诊断了解详情。";
  }
  return raw;
}

function renderInsightEventDetail(detail, targetEl = null) {
  const target = targetEl || el.insightEventDetail;
  if (!target) return;
  if (!detail) {
    renderInsightDetailEmpty("点击左侧事件查看归因详情...", target);
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
  var summary = summaryRaw;
  if (summary.indexOf("AI分析失败") >= 0 || summary.indexOf("failed:") >= 0 || summary.indexOf("FAILED") >= 0) {
    summary = summary.split("AI分析失败")[0].trim();
    if (!summary || summary.indexOf("current") >= 0 || summary.indexOf("conclusion") >= 0 || summary.length < 8) {
      summary = "AI分析服务异常，查看下方诊断信息了解详情。";
    }
    if (summary.endsWith("，") || summary.endsWith(":") || summary.endsWith("：") || summary.endsWith("当前结论")) {
      summary = summary.replace(/[，：:]*$/, "").replace(/当前结论$/, "").trim();
    }
  }
  summary = cleanInsightRichText(summary, { maxChars: 1200, compact: false }) || "暂无分析结论";
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
            <h4>⚠ AI分析失败原因</h4>
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
      <h4>📋 结论摘要</h4>
      <p>${escapeHtml(summary)}</p>
      <p class="meta">${escapeHtml(confidenceReason)}</p>
    </section>
    <div class="insight-detail-grid">
      ${renderInsightListBlock("🎯 主因", [renderCleanPrimaryCause(result)], "暂无主因")}
      ${renderInsightListBlock("📎 次因", result.secondary_causes || result.primary_causes_ranked, "暂无次因")}
      ${renderInsightListBlock("🔄 反证", result.counter_evidence || result.risks_and_counter_evidence, "暂无反证")}
      ${renderInsightListBlock("🔭 未来24h观察", result.what_to_watch_next_24h, "暂无观察点")}
    </div>
    <section class="insight-evidence-list">
      <h4>📰 关联新闻证据</h4>
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

GM.triggerInsightSummaryNow = triggerInsightSummaryNow;
GM.submitInsightAssistantComposer = submitInsightAssistantComposer;
GM.bindInsightChatOpen = bindInsightChatOpen;
GM.resolveWecomTestHint = resolveWecomTestHint;
GM.summarizeInsightTriggerSkipped = summarizeInsightTriggerSkipped;
GM.waitForInsightEventsDone = waitForInsightEventsDone; GM.sleep = sleep;
GM.refreshInsightSettings = refreshInsightSettings;
GM.refreshInsightEvents = refreshInsightEvents;
GM.loadInsightAssistantHistory = loadInsightAssistantHistory;
GM.resetInsightAssistantContext = resetInsightAssistantContext;
GM.syncInsightTriggerButtons = syncInsightTriggerButtons;
GM.insightTriggerCooldownRemainingSec = insightTriggerCooldownRemainingSec;
GM.startInsightTriggerCooldown = startInsightTriggerCooldown;
GM.clearInsightTriggerCooldownTimer = clearInsightTriggerCooldownTimer;
GM.setGlobalInsightFeedback = setGlobalInsightFeedback;
GM.setInsightRunnerPanel = setInsightRunnerPanel;
GM.hideInsightRunnerPanel = hideInsightRunnerPanel;
GM.setInsightAssistantBusy = setInsightAssistantBusy;
GM.setInsightAssistantContext = setInsightAssistantContext;
GM.renderInsightAssistantContextCard = renderInsightAssistantContextCard;
GM.renderInsightAssistantFollowups = renderInsightAssistantFollowups;
GM.renderInsightAssistantLog = renderInsightAssistantLog;
GM.renderInsightAssistantTurns = renderInsightAssistantTurns;
// --- Missing exports (functions defined here but needed by init.js via GM) ---
GM.setInsightTip = setInsightTip;
GM.setInsightProviderTip = setInsightProviderTip;
GM.setInsightAssistantTip = setInsightAssistantTip;
GM.setDashboardInsightTip = setDashboardInsightTip;
GM.insightStatusLabel = insightStatusLabel;
GM.insightStageLabel = insightStageLabel;
GM.insightTriggerTypeLabel = insightTriggerTypeLabel;
GM.isInsightDoneStatus = isInsightDoneStatus;
GM.isInsightLiveStatus = isInsightLiveStatus;
GM.trimInsightStreamText = trimInsightStreamText;
GM.normalizeInsightProgressPayload = normalizeInsightProgressPayload;
GM.mergeInsightDetailWithProgress = mergeInsightDetailWithProgress;
GM.renderInsightProgressCard = renderInsightProgressCard;
GM.renderInsightDetailEmpty = renderInsightDetailEmpty;
GM.renderInsightEventDetail = renderInsightEventDetail;
GM.renderInsightEvents = renderInsightEvents;
GM.renderInsightChatModalContent = renderInsightChatModalContent;
GM.openInsightChatModal = openInsightChatModal;
GM.closeInsightChatModal = closeInsightChatModal;
GM.isInsightChatModalOpen = isInsightChatModalOpen;
GM.loadInsightEventDetail = loadInsightEventDetail;
GM.loadDashboardEventDetail = loadDashboardEventDetail;
GM.openInsightChatByEventId = openInsightChatByEventId;
GM.openInsightEventDetailFromList = openInsightEventDetailFromList;
GM.syncInsightEventProgressWatcher = syncInsightEventProgressWatcher;
GM.stopInsightEventProgressWatcher = stopInsightEventProgressWatcher;
GM.startInsightEventProgressWatcher = startInsightEventProgressWatcher;
GM.normalizeInsightAiError = normalizeInsightAiError;
GM.buildInsightAiRuntimeBody = buildInsightAiRuntimeBody;
GM.cleanInsightRichText = cleanInsightRichText;
GM.normalizeTextArray = normalizeTextArray;
GM.collectInsightEvidence = collectInsightEvidence;
GM.renderInsightListBlock = renderInsightListBlock;
GM.renderInsightDiagnosticsBlock = renderInsightDiagnosticsBlock;
GM.deriveInsightFailureInfo = deriveInsightFailureInfo;
GM.normalizeInsightAssistantContext = normalizeInsightAssistantContext;
GM.buildInsightAssistantContextPayload = buildInsightAssistantContextPayload;
GM.insightAssistantContextBadgeText = insightAssistantContextBadgeText;
GM.defaultInsightAssistantContext = defaultInsightAssistantContext;
GM.normalizeInsightAssistantMessages = normalizeInsightAssistantMessages;
GM.createInsightAssistantRequestId = createInsightAssistantRequestId;
GM.updateInsightAssistantMessageByRequestId = updateInsightAssistantMessageByRequestId;
GM.appendInsightAssistantMessageByRequestId = appendInsightAssistantMessageByRequestId;
GM.parseSseFrameData = parseSseFrameData;
GM.buildInsightNewsReferenceBlock = buildInsightNewsReferenceBlock;
GM.streamInsightAssistantRequest = streamInsightAssistantRequest;
GM.normalizeInsightAssistantDisplayText = normalizeInsightAssistantDisplayText;
GM.renderInsightAssistantInlineMarkdown = renderInsightAssistantInlineMarkdown;
GM.renderInsightAssistantMarkdown = renderInsightAssistantMarkdown;
GM.formatInsightAssistantTime = formatInsightAssistantTime;
GM.buildInsightAssistantTurns = buildInsightAssistantTurns;
GM.scrollInsightAssistantToMessage = scrollInsightAssistantToMessage;
GM.buildInsightAssistantFollowups = buildInsightAssistantFollowups;
GM.sendInsightAssistantMessage = sendInsightAssistantMessage;
GM.clearInsightAssistantConversation = clearInsightAssistantConversation;
GM.buildInsightAssistantEventSummary = buildInsightAssistantEventSummary;
GM.pickInsightAssistantContextEvent = pickInsightAssistantContextEvent;
GM.applyInsightAssistantEventContext = applyInsightAssistantEventContext;
GM.pinInsightAssistantContextByEventId = pinInsightAssistantContextByEventId;
GM.insightTriggerButtons = insightTriggerButtons;
GM.setInsightAiActionStatus = setInsightAiActionStatus;
GM.resetInsightAiActionStatus = resetInsightAiActionStatus;
// AI page event handlers (from core.js)
})();
