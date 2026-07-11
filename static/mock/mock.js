// Golden Monitor — Static Demo Mock Layer
// This file intercepts all /api/* calls and returns realistic mock data.
// Load BEFORE core.js / market.js / ai.js / system.js / init.js

(function () {
  "use strict";

  var GM_DEMO = {};

  // ---------- Seeded PRNG (mulberry32) ----------
  var _seed = 42;
  function next() {
    _seed |= 0;
    _seed = (_seed + 0x6d2b79f5) | 0;
    var t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function reseed(s) { _seed = s | 0; }
  function randInt(min, max) { return Math.floor(next() * (max - min + 1)) + min; }
  function randFloat(min, max) { return next() * (max - min) + min; }
  function pick(arr) { return arr[Math.floor(next() * arr.length)]; }

  // ---------- Time helpers ----------
  function isoNow() { return new Date().toISOString(); }
  function isoAgo(sec) { return new Date(Date.now() - sec * 1000).toISOString(); }
  function isoDaysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }

  // ========== DATA GENERATORS ==========

  // --- Gold prices ---
  // XAUUSD base ~2375, USDCNY ~7.24
  // AUCN = XAUUSD * USDCNY / 31.1034768 + premium
  var XAUUSD_BASE = 2375.5;
  var USDCNY_BASE = 7.2420;
  var PREMIUM = 0;

  function genLatestPrices() {
    var intlPrice = XAUUSD_BASE + randFloat(-15, 15);
    var usdcny = USDCNY_BASE + randFloat(-0.02, 0.02);
    var domPrice = intlPrice * usdcny / 31.1034768 + PREMIUM;
    var now = Date.now();

    var yesterday = new Date(now - 86400000);
    var intlClose = XAUUSD_BASE + randFloat(-8, 8);
    var domClose = intlClose * usdcny / 31.1034768 + PREMIUM;

    var intlChange = ((intlPrice - intlClose) / intlClose * 100);
    // Generate a realistic old close for "昨日收盘" (yesterday's close used as baseline)
    var intlPrevClose = intlPrice - randFloat(-6, 6);
    var domPrevClose = domPrice - randFloat(-3, 3);

    return [
      {
        symbol: "XAUUSD",
        market: "international",
        price: Math.round(intlPrice * 100) / 100,
        currency: "USD",
        unit: "盎司",
        timestamp: isoAgo(randInt(0, 300)),
        source: "gold_api_xau",
        change: Math.round((intlPrice - intlPrevClose) / intlPrevClose * 10000) / 100,
        change_pct: Math.round((intlPrice - intlPrevClose) / intlPrevClose * 10000) / 100,
        prev_close: Math.round(intlPrevClose * 100) / 100,
        high: Math.round((intlPrice + randFloat(2, 8)) * 100) / 100,
        low: Math.round((intlPrice - randFloat(2, 8)) * 100) / 100,
      },
      {
        symbol: "AUCN",
        market: "domestic",
        price: Math.round(domPrice * 100) / 100,
        currency: "CNY",
        unit: "克",
        timestamp: isoAgo(randInt(0, 300)),
        source: "gold_api_xau",
        change: Math.round((domPrice - domPrevClose) / domPrevClose * 10000) / 100,
        change_pct: Math.round((domPrice - domPrevClose) / domPrevClose * 10000) / 100,
        prev_close: Math.round(domPrevClose * 100) / 100,
        high: Math.round((domPrice + randFloat(1, 4)) * 100) / 100,
        low: Math.round((domPrice - randFloat(1, 4)) * 100) / 100,
      },
      {
        symbol: "USDCNY",
        market: "fx",
        price: Math.round(usdcny * 10000) / 10000,
        currency: "CNY",
        unit: "USD",
        timestamp: isoAgo(randInt(0, 300)),
        source: "gold_api_xau",
      },
    ];
  }

  function genSpread() {
    return {
      spread_cny: Math.round(randFloat(3, 12) * 100) / 100,
      spread_pct: Math.round(randFloat(0.3, 1.5) * 100) / 100,
    };
  }

  function genForecast() {
    var biases = ["bullish", "bearish", "neutral"];
    var reasons = [
      "MACD 金叉信号",
      "RSI 处于中性偏强区间",
      "MA5 > MA20 多头排列",
      "美元指数走弱",
      "地缘政治不确定性",
      "央行购金趋势持续",
      "短期超买，回调压力",
      "MA20 < MA60 空头排列",
    ];
    return {
      XAUUSD: { bias: pick(biases), confidence: Math.round(randFloat(55, 88)), reasons: [pick(reasons), pick(reasons)] },
      AUCN: { bias: pick(biases), confidence: Math.round(randFloat(50, 85)), reasons: [pick(reasons)] },
    };
  }

  function genSources() {
    var names = [
      { source_name: "gold_api_xau", symbol: "XAUUSD" },
      { source_name: "gold_api_xau_history_proxy", symbol: "XAUUSD" },
      { source_name: "gold_api_xau", symbol: "AUCN" },
    ];
    return names.map(function (n) {
      return {
        source_name: n.source_name,
        symbol: n.symbol,
        status: pick(["up", "up", "up", "up", "degraded", "up"]),
        last_success_at: isoAgo(randInt(0, 120)),
        last_error: null,
        updated_at: isoAgo(randInt(0, 60)),
      };
    });
  }

  // --- K-line bars ---
  function genBars(count, basePrice, volatility) {
    if (count === undefined) count = 365;
    if (basePrice === undefined) basePrice = XAUUSD_BASE;
    if (volatility === undefined) volatility = 12;
    var bars = [];
    var price = basePrice;
    for (var i = count; i >= 0; i--) {
      price += randFloat(-volatility, volatility);
      price = Math.max(price, basePrice * 0.85);
      price = Math.min(price, basePrice * 1.15);
      var open = price - randFloat(-2, 2);
      var high = Math.max(open, price) + randFloat(0, 4);
      var low = Math.min(open, price) - randFloat(0, 4);
      var close = price;
      var d = new Date();
      d.setDate(d.getDate() - i);
      bars.push({
        timestamp: d.toISOString().slice(0, 10) + "T00:00:00",
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume: randInt(1000, 50000),
      });
    }
    return bars;
  }

  var _intlBars = null;
  var _domBars = null;

  function getIntlBars() {
    if (!_intlBars) _intlBars = genBars(365, XAUUSD_BASE, 14);
    return _intlBars;
  }
  function getDomBars() {
    if (!_domBars) _domBars = genBars(365, XAUUSD_BASE * USDCNY_BASE / 31.1034768, 6);
    return _domBars;
  }

  // --- Rules ---
  function genRules() {
    return [
      { id: 1, symbol: "XAUUSD", condition: "gt", threshold: 2400, cooldown_sec: 1800, debounce_count: 2, enabled: true, indicator_filter: null, logic_operator: "and", clauses: [{ type: "price", condition: "gt", threshold: 2400 }], state: { consecutive_hits: 0, status: "idle" } },
      { id: 2, symbol: "XAUUSD", condition: "lt", threshold: 2350, cooldown_sec: 3600, debounce_count: 1, enabled: true, indicator_filter: null, logic_operator: "and", clauses: [{ type: "price", condition: "lt", threshold: 2350 }], state: { consecutive_hits: 2, status: "triggered" } },
      { id: 3, symbol: "AUCN", condition: "gt", threshold: 560, cooldown_sec: 900, debounce_count: 1, enabled: true, indicator_filter: null, logic_operator: "and", clauses: [{ type: "price", condition: "gt", threshold: 560 }], state: { consecutive_hits: 0, status: "idle" } },
      { id: 4, symbol: "XAUUSD", condition: "range", threshold: 2340, cooldown_sec: 7200, debounce_count: 3, enabled: false, indicator_filter: null, logic_operator: "and", clauses: [{ type: "price", condition: "lt", threshold: 2340 }, { type: "indicator", condition: "gt", threshold: 30, bias: "rsi14" }], state: { consecutive_hits: 1, status: "cooldown" } },
      { id: 5, symbol: "AUCN", condition: "pct", threshold: 1.5, cooldown_sec: 3600, debounce_count: 1, enabled: true, indicator_filter: null, logic_operator: "or", clauses: [{ type: "price", condition: "pct", threshold: 1.5, direction: "up" }, { type: "price", condition: "pct", threshold: 1.0, direction: "down" }], state: { consecutive_hits: 0, status: "idle" } },
      { id: 6, symbol: "XAUUSD", condition: "gt", threshold: 2420, cooldown_sec: 600, debounce_count: 2, enabled: true, indicator_filter: null, logic_operator: "and", clauses: [{ type: "price", condition: "gt", threshold: 2420 }, { type: "freshness", max_age_sec: 30 }], state: { consecutive_hits: 0, status: "idle" } },
    ];
  }

  // --- Alert events ---
  function genAlertEvents() {
    var events = [];
    var statuses = ["triggered", "recovered", "triggered", "recovered", "recovered"];
    for (var i = 1; i <= 15; i++) {
      var isIntl = i % 2 === 1;
      var symbol = isIntl ? "XAUUSD" : "AUCN";
      var price = isIntl ? randFloat(2340, 2430) : randFloat(548, 572);
      events.push({
        id: i,
        rule_id: randInt(1, 4),
        status: pick(statuses),
        hit_price: Math.round(price * 100) / 100,
        hit_time: isoDaysAgo(randInt(0, 30)),
        message_id: "msg_" + i,
        payload: null,
      });
    }
    return events;
  }

  // --- Settings ---
  function genSettings() {
    return {
      poll_interval_sec: 5,
      domestic_premium_cny_per_g: 0,
      enable_console_notifications: true,
      wecom_webhook_configured: false,
      wecom_webhook_masked: "未配置",
      notify_on_trigger: true,
      notify_on_recover: true,
      notify_on_source: true,
      notify_on_heartbeat: false,
      notify_style: "detailed",
      notify_title_prefix: "",
      source_expected_update_sec_map: { gold_api_xau: 10 },
      basic_auth_user: "demo",
      basic_auth_pass_masked: "已加密保存",
      session_secret_configured: true,
      session_secret_masked: "***",
      auth_max_failures: 10,
      auth_window_sec: 300,
      auth_ban_sec: 120,
      auth_enabled: true,
      session_ttl_sec: 43200,
      smtp_host: "",
      smtp_port: 587,
      smtp_user: "",
      smtp_pass_masked: "",
      smtp_from: "",
      smtp_use_tls: true,
      smtp_use_ssl: false,
      smtp_configured: false,
      bootstrap_email_verification_enabled: false,
      bootstrap_code_ttl_sec: 600,
      bootstrap_code_resend_sec: 60,
      registration_email_verification_enabled: false,
      user_count: 2,
      authenticated_user: "demo",
      is_admin: true,
      deploy_host: "0.0.0.0",
      deploy_port: 8080,
      deploy_timezone: "Asia/Shanghai",
      deploy_db_path: "/data/gold_monitor.db",
      restart_required_fields: ["deploy_host", "deploy_port", "deploy_timezone"],
    };
  }

  // --- Users ---
  function genUsers() {
    return {
      operator: "demo",
      users: [
        { username: "demo", email: "demo@example.com", role: "admin", enabled: true, created_at: isoDaysAgo(60), last_login_at: isoAgo(600) },
        { username: "viewer", email: "viewer@example.com", role: "viewer", enabled: true, created_at: isoDaysAgo(30), last_login_at: isoAgo(3600) },
      ],
      enabled_admin_count: 1,
    };
  }

  // --- Login audit ---
  function genLoginAudit() {
    var events = [];
    var results = ["success", "success", "success", "failure", "success", "success"];
    var ips = ["192.168.1.100", "10.0.0.5", "203.0.113.42", "198.51.100.7"];
    for (var i = 1; i <= 20; i++) {
      events.push({
        id: i,
        username: pick(["demo", "viewer", "", "demo"]),
        result: pick(results),
        ip: pick(ips),
        reason: "",
        created_at: isoDaysAgo(randInt(0, 14)),
      });
    }
    return { operator: "demo", events: events };
  }

  // --- Insight settings ---
  function genInsightSettings() {
    return {
      engine: { type: "openai", model: "gpt-4o", base_url: "", api_key_masked: "***" },
      news: { mode: "whitelist_preferred", whitelist_domains: ["cctv.com", "reuters.com", "bloomberg.com"], min_authoritative_articles: 2 },
      trigger: { price_change_pct: 0.5, window_minutes: 30, max_age_sec: 600 },
      strategy: {
        enabled: true,
        direction_cooldown_min: 30,
        max_concurrent: 2,
        auto_trigger: true,
      },
    };
  }

  // --- Insight events ---
  function genInsightEvents() {
    var events = [];
    var directions = ["up", "down"];
    var statuses = ["done", "done", "done", "done", "failed", "done"];
    var summaries = [
      "金价受美联储降息预期推动上涨，美元指数走弱构成支撑",
      "地缘政治风险升温，避险资金流入推高金价",
      "央行购金数据超预期，实物需求强劲",
      "技术面 MACD 金叉 + RSI 突破 60 中性位",
      "非农数据超预期，美元走强施压金价",
      "通胀数据公布前市场观望，金价窄幅震荡",
    ];
    for (var i = 1; i <= 25; i++) {
      var isIntl = i % 2 === 1;
      events.push({
        id: i,
        symbol: isIntl ? "XAUUSD" : "AUCN",
        direction: pick(directions),
        change_pct: Math.round(randFloat(0.3, 2.5) * 100) / 100,
        window_minutes: 30,
        triggered_at: isoDaysAgo(randInt(0, 14)),
        status: pick(statuses),
        authoritative_count: randInt(2, 5),
        supplemental_count: randInt(0, 3),
        confidence: pick(["high", "medium", "high", "medium", "low"]),
        confidence_reason: pick(["多源一致", "单源报告", "新闻覆盖充分", "信源不足"]),
        summary: pick(summaries),
        error: null,
        result: {
          summary: pick(summaries),
          evidence: [
            {
              title: "美联储纪要：可能提前降息",
              url: "https://reuters.com/article/fed-minutes",
              domain: "reuters.com",
              authoritative: true,
              snippet: "美联储会议纪要显示多数官员倾向于年内降息",
              relevance: "direct",
            },
            {
              title: "央行黄金储备连续五个月增加",
              url: "https://cctv.com/gold-reserve",
              domain: "cctv.com",
              authoritative: true,
              snippet: "中国人民银行5月增持黄金储备15吨",
              relevance: "supporting",
            },
            {
              title: "美元指数跌至三个月低点",
              url: "https://bloomberg.com/dollar-index",
              domain: "bloomberg.com",
              authoritative: true,
              snippet: "DXY指数跌破104关口",
              relevance: "supporting",
            },
          ],
          conclusion_reached: true,
          confidence: "high",
          confidence_reason: "多源一致，权威信源覆盖充分",
        },
      });
    }
    return events;
  }

  function genInsightEventDetail(eventId) {
    var events = genInsightEvents();
    for (var i = 0; i < events.length; i++) {
      if (events[i].id === eventId) return events[i];
    }
    return genInsightEvents()[0];
  }

  // --- Chat history ---
  function genChatHistory() {
    var msgs = [];
    var qs = [
      "今天金价为什么涨了？",
      "最近央行购金数据如何？",
      "美联储会议对金价影响？",
      "技术面怎么看当前走势？",
    ];
    var as = [
      "今日金价上涨主要受三方面因素推动：1) 美元指数下跌0.3%至103.8，2) 地缘政治紧张局势加剧，3) 市场对美联储降息预期升温。综合来看，短期偏多。",
      "根据最新数据，中国人民银行5月末黄金储备报7,280万盎司，环比增加15万盎司，连续五个月增持。全球央行购金趋势持续，对金价构成长期支撑。",
      "美联储6月会议纪要显示，多数官员认为通胀正朝2%目标迈进，年内降息的概率上升。市场定价9月降息概率约65%。利好金价。",
      "日线级别：MA5 > MA20 > MA60 多头排列，RSI 62 处于中性偏强区间，MACD 金叉运行良好。短线支撑位2360，压力位2400。趋势偏多。",
    ];
    for (var i = 0; i < 8; i++) {
      var idx = i % qs.length;
      msgs.push({
        id: 100 + i * 2,
        role: "user",
        content: qs[idx],
        created_at: isoDaysAgo(randInt(0, 7)),
      });
      msgs.push({
        id: 101 + i * 2,
        role: "assistant",
        content: as[idx],
        created_at: isoDaysAgo(randInt(0, 7)),
      });
    }
    return { ok: true, username: "demo", limit: 80, messages: msgs, count: msgs.length };
  }

  // --- Detected models ---
  function genDetectedModels() {
    return {
      ok: true,
      provider: "openai",
      models: [
        { id: "gpt-4o", name: "GPT-4o", owned_by: "openai" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", owned_by: "openai" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo", owned_by: "openai" },
      ],
    };
  }

  // --- Backtest result ---
  function genBacktestResult() {
    var equityLine = [];
    var baseLine = [];
    var e = 10000;
    var b = 10000;
    for (var i = 0; i < 365; i++) {
      e += randFloat(-80, 120);
      b += randFloat(-30, 40);
      equityLine.push({ date: isoDaysAgo(364 - i), value: Math.round(e * 100) / 100 });
      baseLine.push({ date: isoDaysAgo(364 - i), value: Math.round(b * 100) / 100 });
    }
    return {
      rule_id: 1,
      symbol: "XAUUSD",
      timeframe: "1d",
      range: "12m",
      total_triggers: randInt(8, 20),
      total_recoveries: randInt(5, 15),
      equity_curve: equityLine,
      baseline_curve: baseLine,
      total_return_pct: Math.round(randFloat(5, 25) * 100) / 100,
      baseline_return_pct: Math.round(randFloat(-5, 12) * 100) / 100,
      max_drawdown: Math.round(randFloat(3, 12) * 100) / 100,
      win_rate: Math.round(randFloat(45, 75)),
      profit_factor: Math.round(randFloat(1.2, 2.5) * 100) / 100,
      trades: [],
    };
  }

  // --- Backtest comparison ---
  function genBacktestCompare() {
    var results = [];
    for (var r = 1; r <= 4; r++) {
      results.push({
        rule_id: r,
        symbol: r % 2 === 1 ? "XAUUSD" : "AUCN",
        total_triggers: randInt(5, 22),
        total_recoveries: randInt(3, 16),
        total_return_pct: Math.round(randFloat(-3, 28) * 100) / 100,
        baseline_return_pct: Math.round(randFloat(-5, 12) * 100) / 100,
        max_drawdown: Math.round(randFloat(2, 15) * 100) / 100,
        win_rate: Math.round(randFloat(40, 80)),
        profit_factor: Math.round(randFloat(0.8, 3.0) * 100) / 100,
      });
    }
    return { comparison: results };
  }

  // --- YFinance overview ---
  function genYFinanceOverview() {
    return {
      ticker: "AAPL",
      period: "6mo",
      interval: "1d",
      current_price: randFloat(185, 210),
      change_pct: Math.round(randFloat(-2, 3) * 100) / 100,
      high_52w: randFloat(215, 230),
      low_52w: randFloat(155, 175),
      volume: randInt(40000000, 80000000),
      market_cap: randFloat(2800, 3200),
      pe_ratio: Math.round(randFloat(28, 35) * 100) / 100,
      dividend_yield: Math.round(randFloat(0.4, 0.7) * 100) / 100,
      history: (function () {
        var h = [];
        var p = randFloat(185, 195);
        for (var i = 180; i >= 0; i--) {
          p += randFloat(-3, 3);
          var d = new Date();
          d.setDate(d.getDate() - i);
          h.push({ date: d.toISOString().slice(0, 10), close: Math.round(p * 100) / 100, volume: randInt(35000000, 85000000) });
        }
        return h;
      })(),
    };
  }

  // --- Chart config ---
  function genChartConfig() {
    return {
      default_range: "12m",
      default_timeframe: "1d",
      default_indicators: ["MA5", "MA20", "MA60", "RSI14", "MACD"],
      layout_modes: ["split", "all", "intl", "domestic", "dual-axis"],
      symbols: ["XAUUSD", "AUCN"],
    };
  }

  // --- Indicators ---
  function genIndicators() {
    var bars = getIntlBars();
    var closes = bars.map(function (b) { return b.close; });
    var len = closes.length;
    function ma(n, idx) {
      if (idx < n - 1) return null;
      var sum = 0;
      for (var i = 0; i < n; i++) sum += closes[idx - i];
      return Math.round(sum / n * 100) / 100;
    }
    function rsi14(idx) {
      if (idx < 14) return null;
      var gains = 0, losses = 0;
      for (var i = idx - 13; i <= idx; i++) {
        var diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
      }
      if (losses === 0) return 100;
      var rs = (gains / 14) / (losses / 14);
      return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
    }
    function macd(idx) {
      if (idx < 26) return null;
      function ema(n, idx) {
        if (idx < n - 1) return null;
        var k = 2 / (n + 1);
        var val = closes[idx - n + 1];
        for (var i = idx - n + 2; i <= idx; i++) val = closes[i] * k + val * (1 - k);
        return val;
      }
      var ema12 = ema(12, idx);
      var ema26 = ema(26, idx);
      if (ema12 === null || ema26 === null) return null;
      return { macd: ema12 - ema26, signal: null, hist: null };
    }
    var indicators = [];
    for (var i = 0; i < len; i++) {
      var m5 = ma(5, i);
      var m20 = ma(20, i);
      var m60 = ma(60, i);
      var rsi = rsi14(i);
      var md = macd(i);
      var trend = "neutral";
      if (m5 !== null && m20 !== null && m60 !== null) {
        if (m5 > m20 && m20 > m60) trend = "bullish";
        else if (m5 < m20 && m20 < m60) trend = "bearish";
      }
      indicators.push({
        symbol: "XAUUSD",
        timeframe: "1d",
        timestamp: bars[i].timestamp,
        ma5: m5, ma20: m20, ma60: m60,
        rsi14: rsi,
        macd: md ? md.macd : null,
        signal: md ? md.signal : null,
        hist: md ? md.hist : null,
        trend_label: trend,
      });
    }
    return { symbol: "XAUUSD", timeframe: "1d", range: "12m", indicators: indicators };
  }

  // ========== ROUTE HANDLER ==========

  var handlers = {};

  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  function register(method, pathPattern, handler) {
    var key = method + ":" + pathPattern;
    handlers[key] = handler;
  }

  // Build matcher: path can have :param segments
  function matchRoute(method, urlPath) {
    var segments = urlPath.split("/").filter(Boolean);
    for (var key in handlers) {
      var parts = key.split(":");
      var hMethod = parts[0];
      if (hMethod !== method) continue;
      var hPattern = parts.slice(1).join(":");
      var patSegs = hPattern.split("/").filter(Boolean);
      if (patSegs.length !== segments.length) continue;
      var match = true;
      var params = {};
      for (var i = 0; i < patSegs.length; i++) {
        if (patSegs[i].startsWith(":")) {
          params[patSegs[i].slice(1)] = segments[i];
        } else if (patSegs[i] !== segments[i]) {
          match = false;
          break;
        }
      }
      if (match) return { handler: handlers[key], params: params };
    }
    return null;
  }

  // ---------- Register all routes ----------

  // Auth (bypass — return pre-authenticated)
  register("GET", "/api/auth/bootstrap/status", function () {
    return jsonResponse({ bootstrap_required: false, email_verification_enabled: false, smtp_configured: false, code_ttl_sec: 600, resend_interval_sec: 60 });
  });
  register("GET", "/api/auth/status", function () {
    return jsonResponse({ bootstrap_required: false, auth_enabled: true, authenticated: true, authenticated_user: "demo", is_admin: true, email_verification_enabled: false });
  });
  register("GET", "/api/health", function () {
    return jsonResponse({ ok: true, service: "gold-monitor", time: isoNow(), collector_running: true });
  });

  // Prices
  register("GET", "/api/prices/latest", function () {
    reseed(Math.floor(Date.now() / 10000));
    return jsonResponse({
      items: genLatestPrices(),
      spread: genSpread(),
      forecast: genForecast(),
      sources: genSources(),
    });
  });

  // K-line
  register("GET", "/api/kline", function (p) {
    var symbol = (p && p.symbol) || "XAUUSD";
    var bars = symbol === "XAUUSD" ? getIntlBars() : getDomBars();
    return jsonResponse({ symbol: symbol, timeframe: "1d", range: "12m", bars: bars });
  });

  // Indicators
  register("GET", "/api/indicators", function () {
    return jsonResponse(genIndicators());
  });

  // Forecast signal
  register("GET", "/api/forecast/signal", function () {
    var signal = genForecast().XAUUSD;
    return jsonResponse({ symbol: "XAUUSD", timeframe: "1d", bias: signal.bias, confidence: signal.confidence, reasons: signal.reasons });
  });

  // Rules
  register("GET", "/api/rules", function () { return jsonResponse(genRules()); });

  // Alerts
  register("GET", "/api/alerts", function () { return jsonResponse(genAlertEvents()); });

  // Chart config
  register("GET", "/api/chart/config", function () { return jsonResponse(genChartConfig()); });

  // YFinance
  register("GET", "/api/yfinance/overview", function () { return jsonResponse(genYFinanceOverview()); });

  // Settings
  register("GET", "/api/settings", function () { return jsonResponse(genSettings()); });

  // Admin
  register("GET", "/api/admin/login_audit", function () { return jsonResponse(genLoginAudit()); });
  register("GET", "/api/admin/users", function () { return jsonResponse(genUsers()); });

  // Insight
  register("GET", "/api/insight/settings", function () { return jsonResponse(genInsightSettings()); });
  register("GET", "/api/insight/events", function () { return jsonResponse(genInsightEvents()); });
  register("GET", "/api/insight/events/:id", function (p) {
    return jsonResponse(genInsightEventDetail(parseInt(p.id, 10)));
  });
  register("GET", "/api/insight/events/:id/progress", function (p) {
    return jsonResponse({ event_id: parseInt(p.id, 10), stage: "fetching_news", progress_pct: 85, message: "" });
  });
  register("GET", "/api/insight/chat/history", function () { return jsonResponse(genChatHistory()); });

  // POST routes — most return ok
  register("POST", "/api/auth/change_password", function () { return jsonResponse({ ok: true }); });
  register("POST", "/api/auth/logout", function () { return jsonResponse({ ok: true }); });
  register("POST", "/api/collect/once", function () { return jsonResponse({ ok: true }); });
  register("POST", "/api/settings", function () { return jsonResponse({ ok: true }); });
  register("POST", "/api/rules", function () { return jsonResponse({ ok: true }); });
  register("POST", "/api/settings/test_notify", function () { return jsonResponse({ ok: true }); });
  register("POST", "/api/insight/settings", function () { return jsonResponse({ ok: true }); });
  register("POST", "/api/insight/trigger", function () { return jsonResponse({ ok: true }); });
  register("POST", "/api/insight/chat/history/clear", function () { return jsonResponse({ ok: true }); });
  register("POST", "/api/admin/users", function () { return jsonResponse({ ok: true }); });
  register("POST", "/api/auth/invite/create", function () { return jsonResponse({ ok: true, invite_code: "DEMO123" }); });

  register("POST", "/api/backtest/run", function () { return jsonResponse(genBacktestResult()); });
  register("POST", "/api/backtest/compare", function () { return jsonResponse(genBacktestCompare()); });
  register("POST", "/api/insight/models/discover", function () { return jsonResponse(genDetectedModels()); });
  register("POST", "/api/insight/test_ai", function () { return jsonResponse({ ok: true, result: "AI连接测试成功" }); });
  register("POST", "/api/insight/simulate", function () { return jsonResponse({ ok: true, triggered: true, reason: "价格涨幅 0.8% 超过阈值 0.5%" }); });

  // Insight chat
  register("POST", "/api/insight/chat", function () {
    var replies = [
      "根据当前数据，金价短期走势偏多。MACD 金叉运行良好，RSI 62 处于中性偏强区间，MA5 > MA20 多头排列。支撑位 2360，阻力位 2400。",
      "美联储会议纪要显示通胀正朝2%目标迈进，市场对9月降息的预期约65%。地缘政治不确定性也为金价提供支撑。",
      "央行购金数据：中国人民银行5月末黄金储备7,280万盎司，环比增15万盎司，连续五个月增持。全球央行购金趋势持续。",
    ];
    return jsonResponse({ ok: true, reply: pick(replies), sources: [] });
  });

  register("POST", "/api/insight/chat/stream", function () {
    var text = "根据数据综合分析，当前金价走强主要受以下因素推动：\n\n1. 美元指数走弱至103.8，对金价构成直接支撑\n2. 地缘政治不确定性推动避险资金流入\n3. 技术面多头排列，MACD金叉信号持续\n\n短期来看，上涨动能仍然存在，但需关注2400整数关口的阻力。";
    var encoder = new TextEncoder();
    var stream = new ReadableStream({
      start: function (controller) {
        var i = 0;
        function push() {
          if (i >= text.length) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
          var chunk = text.slice(i, i + 5);
          controller.enqueue(encoder.encode("data: " + JSON.stringify({ type: "delta", content: chunk }) + "\n\n"));
          i += 5;
          setTimeout(push, 30);
        }
        push();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  });

  // PATCH
  register("PATCH", "/api/settings", function () { return jsonResponse({ ok: true }); });
  register("PATCH", "/api/insight/settings", function () { return jsonResponse({ ok: true }); });
  register("PATCH", "/api/admin/users/:id", function () { return jsonResponse({ ok: true }); });

  // DELETE
  register("DELETE", "/api/rules/:id", function () { return jsonResponse({ ok: true }); });

  // Catch-all for unknown routes
  function unknownRoute(method, path) {
    console.warn("[Mock] Unhandled " + method + " " + path + " — returning 200 ok");
    return jsonResponse({ ok: true });
  }

  // ========== PATCH window.fetch ==========

  var originalFetch = window.fetch;

  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input.url || "");
    var method = (init && init.method) || "GET";

    // Only intercept /api/ paths
    var parsed = url.indexOf("/api/") === 0 || url.indexOf("//") < 0 && url.indexOf("/api/") === 0;
    if (!parsed && url.indexOf("/api/") >= 0) {
      // Full URL — extract path
      try {
        var u = new URL(url);
        if (u.pathname.indexOf("/api/") === 0) {
          parsed = true;
          url = u.pathname + u.search;
        }
      } catch (e) { /* ignore */ }
    }
    if (!parsed || url.indexOf("/api/") !== 0) {
      return originalFetch.call(window, input, init);
    }

    // Strip query string for routing
    var pathOnly = url.split("?")[0];
    var searchParams = {};
    if (url.indexOf("?") >= 0) {
      var qs = url.split("?")[1];
      qs.split("&").forEach(function (pair) {
        var kv = pair.split("=");
        searchParams[decodeURIComponent(kv[0])] = kv.length > 1 ? decodeURIComponent(kv[1]) : "";
      });
    }

    var match = matchRoute(method, pathOnly);
    if (match) {
      var params = match.params || {};
      // Add query params
      Object.keys(searchParams).forEach(function (k) { params[k] = searchParams[k]; });
      // Add body if POST/PUT/PATCH
      var bodyPromise = Promise.resolve(undefined);
      if (init && init.body && typeof init.body === "string") {
        try { bodyPromise = Promise.resolve(JSON.parse(init.body)); } catch (e) { bodyPromise = Promise.resolve({}); }
      }
      return bodyPromise.then(function () {
        console.log("[Mock] " + method + " " + url + " → mock data");
        return match.handler(params);
      });
    }

    console.log("[Mock] " + method + " " + url + " → unmocked, returning ok");
    return Promise.resolve(unknownRoute(method, url));
  };

  // ========== DEMO flag ==========
  window.__DEMO_MODE__ = true;
  window.GM_DEMO = GM_DEMO;

  console.log("[Mock] Static demo mock layer loaded — all /api/* calls are intercepted.");
})();
