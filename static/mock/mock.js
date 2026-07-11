// Golden Monitor — Static Demo Mock Layer
// Intercepts all /api/* calls and returns realistic mock data tuned to the frontend's exact expectations.
(function () {
  "use strict";

  // Seeded PRNG (mulberry32)
  var _SEED = 42;
  function _next() {
    _SEED |= 0;
    _SEED = (_SEED + 0x6d2b79f5) | 0;
    var t = Math.imul(_SEED ^ (_SEED >>> 15), 1 | _SEED);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function reseed(s) { _SEED = s | 0; }
  function randInt(min, max) { return Math.floor(_next() * (max - min + 1)) + min; }
  function randFloat(min, max) { return _next() * (max - min) + min; }
  function pick(arr) { return arr[Math.floor(_next() * arr.length)]; }

  // Time helpers
  function isoAgo(sec) { return new Date(Date.now() - sec * 1000).toISOString(); }
  function isoDaysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }

  // Base prices
  var _XAUUSD_BASE = 2375.5;
  var _USDCNY_BASE = 7.2420;

  // ============ K-line bar generation ============
  function genBars(count, basePrice, volatility) {
    if (count === void 0) count = 365;
    if (basePrice === void 0) basePrice = _XAUUSD_BASE;
    if (volatility === void 0) volatility = 14;
    var bars = [];
    var price = basePrice;
    for (var i = count; i >= 0; i--) {
      price += randFloat(-volatility, volatility);
      price = Math.max(price, basePrice * 0.82);
      price = Math.min(price, basePrice * 1.18);
      var open = price - randFloat(-2, 2);
      var high = Math.max(open, price) + randFloat(0, 5);
      var low = Math.min(open, price) - randFloat(0, 5);
      var close = price;
      var d = new Date();
      d.setDate(d.getDate() - i);
      bars.push({
        ts: d.toISOString(),
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume: randInt(1000, 50000),
        symbol: basePrice > 500 ? "XAUUSD" : "AUCN",
        market: basePrice > 500 ? "international" : "domestic",
        timeframe: "1d",
        source: "gold_api_xau",
      });
    }
    return bars;
  }

  var _intlBars = null;
  var _domBars = null;
  var _intlCloses = null;
  var _domCloses = null;

  function getIntlBars() {
    if (!_intlBars) { _intlBars = genBars(365, _XAUUSD_BASE, 14); }
    return _intlBars;
  }
  function getDomBars() {
    if (!_domBars) {
      var domBase = _XAUUSD_BASE * _USDCNY_BASE / 31.1034768;
      _domBars = genBars(365, domBase, 6);
      _domBars.forEach(function (b) { b.symbol = "AUCN"; b.market = "domestic"; });
    }
    return _domBars;
  }
  function getCloses(bars) {
    return bars.map(function (b) { return b.close; });
  }

  // ============ MA / RSI / MACD computation ============
  function computeMA(data, n) {
    var result = [];
    for (var i = 0; i < data.length; i++) {
      if (i < n - 1) { result.push(null); }
      else {
        var sum = 0;
        for (var j = 0; j < n; j++) sum += data[i - j];
        result.push(Math.round(sum / n * 100) / 100);
      }
    }
    return result;
  }
  function computeRSI(data, n) {
    var result = [];
    for (var i = 0; i < data.length; i++) {
      if (i < n) { result.push(null); continue; }
      var gains = 0, losses = 0;
      for (var j = i - n + 1; j <= i; j++) {
        var diff = data[j] - data[j - 1];
        if (diff > 0) gains += diff; else losses -= diff;
      }
      if (losses === 0) { result.push(100); continue; }
      var rs = (gains / n) / (losses / n);
      result.push(Math.round((100 - 100 / (1 + rs)) * 100) / 100);
    }
    return result;
  }
  function computeMACD(data) {
    function ema(data, n) {
      var result = [];
      for (var i = 0; i < data.length; i++) {
        if (i < n - 1) { result.push(null); continue; }
        var k = 2 / (n + 1);
        var val = data[i - n + 1];
        for (var j = i - n + 2; j <= i; j++) val = data[j] * k + val * (1 - k);
        result.push(Math.round(val * 100) / 100);
      }
      return result;
    }
    var ema12 = ema(data, 12);
    var ema26 = ema(data, 26);
    var macd = [], signal = [], hist = [];
    for (var i = 0; i < data.length; i++) {
      if (ema12[i] === null || ema26[i] === null) {
        macd.push(null); signal.push(null); hist.push(null);
      } else {
        var m = Math.round((ema12[i] - ema26[i]) * 100) / 100;
        macd.push(m);
        if (i < 8) { signal.push(null); hist.push(null); }
        else {
          var sig = Math.round(macd.slice(i - 8, i + 1).reduce(function (a, b) { return a + b; }, 0) / 9 * 100) / 100;
          signal.push(sig);
          hist.push(Math.round((m - sig) * 100) / 100);
        }
      }
    }
    return { macd: macd, signal: signal, hist: hist };
  }

  function genIndicatorPayload(bars) {
    var symbol = bars.length > 0 ? bars[0].symbol : "XAUUSD";
    var closes = bars.map(function (b) { return b.close; });
    var ma5 = computeMA(closes, 5);
    var ma20 = computeMA(closes, 20);
    var ma60 = computeMA(closes, 60);
    var rsi14 = computeRSI(closes, 14);
    var macdResult = computeMACD(closes);
    return {
      symbol: symbol,
      timeframe: "1d",
      series: {
        ma5: ma5,
        ma20: ma20,
        ma60: ma60,
        rsi14: rsi14,
        macd: macdResult.macd,
        signal: macdResult.signal,
        hist: macdResult.hist,
      },
      latest: {
        timestamp: bars[bars.length - 1].ts,
        ma5: ma5[ma5.length - 1],
        ma20: ma20[ma20.length - 1],
        ma60: ma60[ma60.length - 1],
        rsi14: rsi14[rsi14.length - 1],
        macd: macdResult.macd[macdResult.macd.length - 1],
        signal: macdResult.signal[macdResult.signal.length - 1],
        hist: macdResult.hist[macdResult.hist.length - 1],
        trend_label: ma5[ma5.length - 1] > ma20[ma20.length - 1] ? "bullish" : "bearish",
        confidence: 72,
        reasons: ["MA多头排列", "RSI中性偏强"],
      },
    };
  }

  // ============ Prices / Latest ============
  function genLatestPrices() {
    var intlPrice = _XAUUSD_BASE + randFloat(-15, 15);
    var usdcny = _USDCNY_BASE + randFloat(-0.02, 0.02);
    var domPrice = intlPrice * usdcny / 31.1034768;
    var intlPrevClose = intlPrice - randFloat(-6, 6);
    var domPrevClose = domPrice - randFloat(-3, 3);
    return [
      {
        symbol: "XAUUSD", market: "international", price: Math.round(intlPrice * 100) / 100,
        currency: "USD", unit: "盎司", timestamp: isoAgo(randInt(2, 20)),
        source: "gold_api_xau", prev_close: Math.round(intlPrevClose * 100) / 100,
        change: Math.round((intlPrice - intlPrevClose) * 100) / 100,
        change_pct: Math.round((intlPrice - intlPrevClose) / intlPrevClose * 10000) / 100,
        high: Math.round((intlPrice + randFloat(2, 8)) * 100) / 100,
        low: Math.round((intlPrice - randFloat(2, 8)) * 100) / 100,
        age_sec: randInt(2, 20),
        freshness_status: "live",
        last_changed_at: isoAgo(randInt(2, 20)),
        expected_update_sec: 10,
      },
      {
        symbol: "AUCN", market: "domestic", price: Math.round(domPrice * 100) / 100,
        currency: "CNY", unit: "克", timestamp: isoAgo(randInt(2, 20)),
        source: "gold_api_xau", prev_close: Math.round(domPrevClose * 100) / 100,
        change: Math.round((domPrice - domPrevClose) * 100) / 100,
        change_pct: Math.round((domPrice - domPrevClose) / domPrevClose * 10000) / 100,
        high: Math.round((domPrice + randFloat(1, 4)) * 100) / 100,
        low: Math.round((domPrice - randFloat(1, 4)) * 100) / 100,
        age_sec: randInt(2, 20),
        freshness_status: "live",
        last_changed_at: isoAgo(randInt(2, 20)),
        expected_update_sec: 10,
      },
      {
        symbol: "USDCNY", market: "fx", price: Math.round(usdcny * 10000) / 10000,
        currency: "CNY", unit: "USD", timestamp: isoAgo(randInt(2, 20)),
        source: "gold_api_xau",
      },
    ];
  }

  function genSpread() {
    return { spread_cny: Math.round(randFloat(3, 12) * 100) / 100, spread_pct: Math.round(randFloat(0.3, 1.5) * 100) / 100 };
  }

  function genForecast() {
    var reasons = ["MACD 金叉信号", "RSI 处于中性偏强区间", "MA5 > MA20 多头排列", "美元指数走弱", "地缘政治不确定性", "央行购金趋势持续", "短期超买回调压力", "MA20 < MA60 空头排列"];
    var biases = ["bullish", "bearish", "neutral"];
    return {
      XAUUSD: { bias: pick(biases), confidence: randInt(55, 88), reasons: [pick(reasons), pick(reasons)] },
      AUCN: { bias: pick(biases), confidence: randInt(50, 85), reasons: [pick(reasons)] },
    };
  }

  function genSources() {
    return [
      { source_name: "gold_api_xau", symbol: "XAUUSD", status: "up", last_success_at: isoAgo(5), last_error: null, updated_at: isoAgo(3) },
      { source_name: "gold_api_xau_history_proxy", symbol: "XAUUSD", status: "up", last_success_at: isoAgo(10), last_error: null, updated_at: isoAgo(10) },
      { source_name: "gold_api_xau", symbol: "AUCN", status: "up", last_success_at: isoAgo(5), last_error: null, updated_at: isoAgo(3) },
    ];
  }

  // ============ Rules ============
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

  // ============ Alert events ============
  function genAlertEvents() {
    var events = [];
    var statuses = ["triggered", "recovered", "triggered", "recovered", "recovered"];
    for (var i = 1; i <= 15; i++) {
      var isIntl = i % 2 === 1;
      events.push({
        id: i, rule_id: randInt(1, 4), status: pick(statuses),
        hit_price: Math.round(randFloat(isIntl ? 2340 : 548, isIntl ? 2430 : 572) * 100) / 100,
        hit_time: isoDaysAgo(randInt(0, 30)), message_id: "msg_" + i, payload: null,
      });
    }
    return events;
  }

  // ============ Settings ============
  function genSettings() {
    return {
      poll_interval_sec: 5, domestic_premium_cny_per_g: 0, enable_console_notifications: true,
      wecom_webhook_configured: false, wecom_webhook_masked: "未配置",
      notify_on_trigger: true, notify_on_recover: true, notify_on_source: true, notify_on_heartbeat: false,
      notify_style: "detailed", notify_title_prefix: "",
      source_expected_update_sec_map: { gold_api_xau: 10 },
      basic_auth_user: "demo", basic_auth_pass_masked: "已加密保存",
      session_secret_configured: true, session_secret_masked: "***",
      auth_max_failures: 10, auth_window_sec: 300, auth_ban_sec: 120,
      auth_enabled: true, session_ttl_sec: 43200,
      smtp_host: "", smtp_port: 587, smtp_user: "", smtp_pass_masked: "", smtp_from: "",
      smtp_use_tls: true, smtp_use_ssl: false, smtp_configured: false,
      bootstrap_email_verification_enabled: false, bootstrap_code_ttl_sec: 600, bootstrap_code_resend_sec: 60,
      registration_email_verification_enabled: false,
      user_count: 2, authenticated_user: "demo", is_admin: true,
      deploy_host: "0.0.0.0", deploy_port: 8080, deploy_timezone: "Asia/Shanghai", deploy_db_path: "/data/gold_monitor.db",
      restart_required_fields: ["deploy_host", "deploy_port", "deploy_timezone"],
    };
  }

  // ============ Users ============
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

  // ============ Login audit ============
  function genLoginAudit() {
    var events = [];
    var results = ["success", "success", "success", "failure", "success", "success"];
    var ips = ["192.168.1.100", "10.0.0.5", "203.0.113.42", "198.51.100.7"];
    for (var i = 1; i <= 20; i++) {
      events.push({ id: i, username: pick(["demo", "viewer", "", "demo"]), result: pick(results), ip: pick(ips), reason: "", created_at: isoDaysAgo(randInt(0, 14)) });
    }
    return { operator: "demo", events: events };
  }

  // ============ Insight settings ============
  function genInsightSettings() {
    return {
      engine: { type: "openai", model: "gpt-4o", base_url: "", api_key_masked: "***" },
      news: { mode: "whitelist_preferred", whitelist_domains: ["cctv.com", "reuters.com", "bloomberg.com"], min_authoritative_articles: 2 },
      trigger: { price_change_pct: 0.5, window_minutes: 30, max_age_sec: 600 },
      strategy: { enabled: true, direction_cooldown_min: 30, max_concurrent: 2, auto_trigger: true },
    };
  }

  // ============ Insight events ============
  function genInsightEvents() {
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
    var events = [];
    for (var i = 1; i <= 25; i++) {
      var evidence = [
        { title: "美联储纪要：可能提前降息", url: "https://reuters.com/article/fed-minutes", domain: "reuters.com", authoritative: true, snippet: "美联储会议纪要显示多数官员倾向于年内降息", relevance: "direct" },
        { title: "央行黄金储备连续五个月增加", url: "https://cctv.com/gold-reserve", domain: "cctv.com", authoritative: true, snippet: "中国人民银行5月增持黄金储备15吨", relevance: "supporting" },
      ];
      events.push({
        id: i, symbol: i % 2 === 1 ? "XAUUSD" : "AUCN", direction: pick(directions),
        change_pct: Math.round(randFloat(0.3, 2.5) * 100) / 100, window_minutes: 30,
        triggered_at: isoDaysAgo(randInt(0, 14)), status: pick(statuses),
        authoritative_count: 2, supplemental_count: 1,
        confidence: pick(["high", "medium", "high", "medium", "low"]),
        confidence_reason: pick(["多源一致", "单源报告", "新闻覆盖充分", "信源不足"]),
        summary: pick(summaries), error: null,
        result: { summary: pick(summaries), evidence: evidence, conclusion_reached: true, confidence: "high", confidence_reason: "多源一致，权威信源覆盖充分" },
        evidence: evidence, _has_result: true,
      });
    }
    return events;
  }

  function genInsightEventDetail(id) {
    var events = genInsightEvents();
    for (var i = 0; i < events.length; i++) { if (events[i].id === id) return events[i]; }
    return events[0];
  }

  // ============ Chat history ============
  function genChatHistory() {
    var msgs = [];
    var qs = ["今天金价为什么涨了？", "最近央行购金数据如何？", "美联储会议对金价影响？", "技术面怎么看当前走势？"];
    var as = [
      "今日金价上涨主要受三方面因素推动：1) 美元指数下跌0.3%至103.8，2) 地缘政治紧张局势加剧，3) 市场对美联储降息预期升温。综合来看，短期偏多。",
      "根据最新数据，中国人民银行5月末黄金储备报7,280万盎司，环比增加15万盎司，连续五个月增持。全球央行购金趋势持续，对金价构成长期支撑。",
      "美联储6月会议纪要显示，多数官员认为通胀正朝2%目标迈进，年内降息的概率上升。市场定价9月降息概率约65%。利好金价。",
      "日线级别：MA5 > MA20 > MA60 多头排列，RSI 62 处于中性偏强区间，MACD 金叉运行良好。短线支撑位2360，压力位2400。趋势偏多。",
    ];
    for (var i = 0; i < 8; i++) {
      var idx = i % qs.length;
      msgs.push({ id: 100 + i * 2, role: "user", content: qs[idx], created_at: isoDaysAgo(randInt(0, 7)) });
      msgs.push({ id: 101 + i * 2, role: "assistant", content: as[idx], created_at: isoDaysAgo(randInt(0, 7)) });
    }
    return { ok: true, username: "demo", limit: 80, messages: msgs, count: msgs.length };
  }

  // ============ Detected models ============
  function genDetectedModels() {
    return { ok: true, provider: "openai", models: [{ id: "gpt-4o", name: "GPT-4o", owned_by: "openai" }, { id: "gpt-4o-mini", name: "GPT-4o Mini", owned_by: "openai" }, { id: "gpt-4-turbo", name: "GPT-4 Turbo", owned_by: "openai" }] };
  }

  // ============ Backtest ============
  function genBacktestResult() {
    var equityLine = [], baseLine = [], e = 10000, b = 10000;
    for (var i = 0; i < 365; i++) {
      e += randFloat(-80, 120); b += randFloat(-30, 40);
      equityLine.push({ date: isoDaysAgo(364 - i), value: Math.round(e * 100) / 100 });
      baseLine.push({ date: isoDaysAgo(364 - i), value: Math.round(b * 100) / 100 });
    }
    return {
      rule_id: 1, symbol: "XAUUSD", timeframe: "1d", range: "12m",
      total_triggers: randInt(8, 20), total_recoveries: randInt(5, 15),
      equity_curve: equityLine, baseline_curve: baseLine,
      total_return_pct: Math.round(randFloat(5, 25) * 100) / 100,
      baseline_return_pct: Math.round(randFloat(-5, 12) * 100) / 100,
      max_drawdown: Math.round(randFloat(3, 12) * 100) / 100,
      win_rate: randInt(45, 75), profit_factor: Math.round(randFloat(1.2, 2.5) * 100) / 100, trades: [],
    };
  }

  function genBacktestCompare() {
    var results = [];
    for (var r = 1; r <= 4; r++) {
      results.push({
        rule_id: r, symbol: r % 2 === 1 ? "XAUUSD" : "AUCN",
        total_triggers: randInt(5, 22), total_recoveries: randInt(3, 16),
        total_return_pct: Math.round(randFloat(-3, 28) * 100) / 100,
        baseline_return_pct: Math.round(randFloat(-5, 12) * 100) / 100,
        max_drawdown: Math.round(randFloat(2, 15) * 100) / 100,
        win_rate: randInt(40, 80), profit_factor: Math.round(randFloat(0.8, 3.0) * 100) / 100,
      });
    }
    return { comparison: results };
  }

  // ============ YFinance ============
  function genYFinance() {
    var h = [];
    var p = randFloat(185, 195);
    for (var i = 180; i >= 0; i--) {
      p += randFloat(-3, 3);
      var d = new Date(); d.setDate(d.getDate() - i);
      h.push({ date: d.toISOString().slice(0, 10), close: Math.round(p * 100) / 100, volume: randInt(35000000, 85000000) });
    }
    return { ticker: "AAPL", period: "6mo", interval: "1d", current_price: randFloat(185, 210), change_pct: Math.round(randFloat(-2, 3) * 100) / 100, high_52w: randFloat(215, 230), low_52w: randFloat(155, 175), volume: randInt(40000000, 80000000), market_cap: randFloat(2800, 3200), pe_ratio: Math.round(randFloat(28, 35) * 100) / 100, dividend_yield: Math.round(randFloat(0.4, 0.7) * 100) / 100, history: h };
  }

  // ============ Chart config ============
  function genChartConfig() {
    return { default_range: "12m", default_timeframe: "1d", default_indicators: ["MA5", "MA20", "MA60", "RSI14", "MACD"], layout_modes: ["split", "all", "intl", "domestic", "dual-axis"], symbols: ["XAUUSD", "AUCN"] };
  }

  // ============ Route handler ============
  var handlers = {};
  function register(method, pathPattern, handler) { handlers[method + ":" + pathPattern] = handler; }

  function matchRoute(method, urlPath) {
    var segments = urlPath.split("/").filter(Boolean);
    for (var key in handlers) {
      var parts = key.split(":");
      if (parts[0] !== method) continue;
      var patSegs = parts.slice(1).join(":").split("/").filter(Boolean);
      if (patSegs.length !== segments.length) continue;
      var match = true, params = {};
      for (var i = 0; i < patSegs.length; i++) {
        if (patSegs[i].startsWith(":")) { params[patSegs[i].slice(1)] = segments[i]; }
        else if (patSegs[i] !== segments[i]) { match = false; break; }
      }
      if (match) return { handler: handlers[key], params: params };
    }
    return null;
  }

  function json(data, status) { return new Response(JSON.stringify(data), { status: status || 200, headers: { "Content-Type": "application/json" } }); }

  // ---- Auth (always pre-authenticated) ----
  register("GET", "/api/auth/bootstrap/status", function () { return json({ bootstrap_required: false, email_verification_enabled: false, smtp_configured: false, code_ttl_sec: 600, resend_interval_sec: 60 }); });
  register("GET", "/api/auth/status", function () { return json({ bootstrap_required: false, auth_enabled: true, authenticated: true, authenticated_user: "demo", is_admin: true, email_verification_enabled: false }); });
  register("GET", "/api/health", function () { return json({ ok: true, service: "gold-monitor", time: new Date().toISOString(), collector_running: true }); });

  // ---- Prices ----
  register("GET", "/api/prices/latest", function () {
    reseed(Math.floor(Date.now() / 8000));
    return json({ items: genLatestPrices(), spread: genSpread(), forecast: genForecast(), sources: genSources() });
  });

  // ---- K-line ----
  register("GET", "/api/kline", function (p) {
    var symbol = (p && p.symbol) || "XAUUSD";
    var bars = symbol === "XAUUSD" ? getIntlBars() : getDomBars();
    return json({ symbol: symbol, timeframe: "1d", range: "12m", bars: bars });
  });

  // ---- Indicators (exact format expected by frontend) ----
  register("GET", "/api/indicators", function (p) {
    var symbol = (p && p.symbol) || "XAUUSD";
    var bars = symbol === "XAUUSD" ? getIntlBars() : getDomBars();
    return json(genIndicatorPayload(bars));
  });

  // ---- Forecast ----
  register("GET", "/api/forecast/signal", function () {
    var f = genForecast().XAUUSD;
    return json({ symbol: "XAUUSD", timeframe: "1d", bias: f.bias, confidence: f.confidence, reasons: f.reasons });
  });

  // ---- Rules / Alerts ----
  register("GET", "/api/rules", function () { return json(genRules()); });
  register("GET", "/api/alerts", function () { return json(genAlertEvents()); });

  // ---- Chart config ----
  register("GET", "/api/chart/config", function () { return json(genChartConfig()); });

  // ---- YFinance ----
  register("GET", "/api/yfinance/overview", function () { return json(genYFinance()); });

  // ---- Settings ----
  register("GET", "/api/settings", function () { return json(genSettings()); });

  // ---- Admin ----
  register("GET", "/api/admin/login_audit", function () { return json(genLoginAudit()); });
  register("GET", "/api/admin/users", function () { return json(genUsers()); });

  // ---- Insight ----
  register("GET", "/api/insight/settings", function () { return json(genInsightSettings()); });
  register("GET", "/api/insight/events", function () { return json(genInsightEvents()); });
  register("GET", "/api/insight/events/:id", function (p) { return json(genInsightEventDetail(parseInt(p.id, 10))); });
  register("GET", "/api/insight/events/:id/progress", function (p) { return json({ event_id: parseInt(p.id, 10), stage: "fetching_news", progress_pct: 85, message: "" }); });
  register("GET", "/api/insight/chat/history", function () { return json(genChatHistory()); });

  // ---- POST ----
  register("POST", "/api/auth/change_password", function () { return json({ ok: true }); });
  register("POST", "/api/auth/logout", function () { return json({ ok: true }); });
  register("POST", "/api/collect/once", function () { return json({ ok: true }); });
  register("POST", "/api/settings", function () { return json({ ok: true }); });
  register("POST", "/api/rules", function () { return json({ ok: true }); });
  register("POST", "/api/settings/test_notify", function () { return json({ ok: true }); });
  register("POST", "/api/insight/settings", function () { return json({ ok: true }); });
  register("POST", "/api/insight/trigger", function () { return json({ ok: true }); });
  register("POST", "/api/insight/chat/history/clear", function () { return json({ ok: true }); });
  register("POST", "/api/admin/users", function () { return json({ ok: true }); });
  register("POST", "/api/auth/invite/create", function () { return json({ ok: true, invite_code: "DEMO123" }); });
  register("POST", "/api/backtest/run", function () { return json(genBacktestResult()); });
  register("POST", "/api/backtest/compare", function () { return json(genBacktestCompare()); });
  register("POST", "/api/insight/models/discover", function () { return json(genDetectedModels()); });
  register("POST", "/api/insight/test_ai", function () { return json({ ok: true, result: "AI连接测试成功" }); });
  register("POST", "/api/insight/simulate", function () { return json({ ok: true, triggered: true, reason: "价格涨幅 0.8% 超过阈值 0.5%" }); });

  // ---- Chat ----
  register("POST", "/api/insight/chat", function () {
    var replies = [
      "根据当前数据，金价短期走势偏多。MACD 金叉运行良好，RSI 62 处于中性偏强区间，MA5 > MA20 多头排列。支撑位 2360，阻力位 2400。",
      "美联储会议纪要显示通胀正朝2%目标迈进，市场对9月降息的预期约65%。地缘政治不确定性也为金价提供支撑。",
      "央行购金数据：中国人民银行5月末黄金储备7,280万盎司，环比增15万盎司，连续五个月增持。全球央行购金趋势持续。",
    ];
    return json({ ok: true, reply: pick(replies), sources: [] });
  });

  register("POST", "/api/insight/chat/stream", function () {
    var text = "根据数据综合分析，当前金价走强主要受以下因素推动：\n\n1. 美元指数走弱至103.8，对金价构成直接支撑\n2. 地缘政治不确定性推动避险资金流入\n3. 技术面多头排列，MACD金叉信号持续\n\n短期来看，上涨动能仍然存在，但需关注2400整数关口的阻力。";
    var encoder = new TextEncoder();
    return new Response(new ReadableStream({
      start: function (ctrl) {
        var i = 0;
        function push() {
          if (i >= text.length) { ctrl.enqueue(encoder.encode("data: [DONE]\n\n")); ctrl.close(); return; }
          var chunk = text.slice(i, i + 5);
          ctrl.enqueue(encoder.encode("data: " + JSON.stringify({ type: "delta", content: chunk }) + "\n\n"));
          i += 5;
          setTimeout(push, 30);
        }
        push();
      },
    }), { status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  });

  // ---- PATCH / DELETE ----
  register("PATCH", "/api/settings", function () { return json({ ok: true }); });
  register("PATCH", "/api/insight/settings", function () { return json({ ok: true }); });
  register("PATCH", "/api/admin/users/:id", function () { return json({ ok: true }); });
  register("DELETE", "/api/rules/:id", function () { return json({ ok: true }); });

  // ============ Patch fetch ============
  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input.url || "");
    var method = (init && init.method) || "GET";

    // Check if this is an /api/ path
    var pathOnly = url;
    if (url.indexOf("/api/") >= 0) {
      try { var u = new URL(url); pathOnly = u.pathname + u.search; }
      catch (e) { /* relative URL */ }
    }
    if (pathOnly.indexOf("/api/") !== 0) return originalFetch.call(window, input, init);

    pathOnly = pathOnly.split("?")[0];
    var searchParams = {};
    var qidx = (typeof url === "string" ? url : pathOnly).indexOf("?");
    if (qidx >= 0) {
      var qs = (typeof url === "string" ? url : pathOnly).slice(qidx + 1);
      qs.split("&").forEach(function (pair) {
        var kv = pair.split("=");
        searchParams[decodeURIComponent(kv[0])] = kv.length > 1 ? decodeURIComponent(kv[1]) : "";
      });
    }

    var match = matchRoute(method, pathOnly);
    if (match) {
      var params = match.params || {};
      Object.keys(searchParams).forEach(function (k) { params[k] = searchParams[k]; });
      return Promise.resolve(match.handler(params));
    }

    console.warn("[Mock] Unhandled " + method + " " + url + " — returning 200 ok");
    return Promise.resolve(json({ ok: true }));
  };

  // Mark demo mode
  window.__DEMO_MODE__ = true;
  console.log("[Mock] Static demo mock layer loaded");
})();
