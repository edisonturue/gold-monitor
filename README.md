# Gold Monitor

免费优先的金价监控工具，支持：

- 国际/国内金价实时采集（默认 5 秒轮询）
- 阈值规则（上穿/下穿、冷却、防抖、恢复通知）
- 组合规则（AND/OR 单层条件组，支持价格阈值 + 指标偏向 + 数据新鲜度）
- 企业微信机器人通知
- 近 12 个月历史数据与日 K
- MA5/MA20/MA60 + RSI + MACD + 趋势信号
- Apple 风白色前端（跟随系统暗色自动切换）
- 图形化设置中心（微信推送、轮询间隔、国内溢价）
- 图形化配置“实时/延迟”判定周期（按数据源）
- 图形化配置部署与安全参数（登录账号、会话时长、登录限流）
- 手动“立即刷新”与动态自动刷新（跟随设置）
- 基础登录保护（Basic Auth）
- 登录页会话认证（表单登录 + HttpOnly Cookie）
- 首次管理员初始化支持邮箱验证码（SMTP 对接真实邮箱服务）
- 支持“管理员邀请码 + 邮箱验证码”的普通用户注册流程
- 支持“管理员邮箱验证码找回密码”（忘记密码可自助重置）
- 管理员可视化用户管理（查看用户、启停账号、重置密码）
- 支持当前用户自助修改密码
- 支持登录审计（记录登录成功/失败、IP、时间、原因）
- 管理员密码改为哈希存储（PBKDF2-SHA256），避免明文落库
- 数据源多级备援 + 缓存兜底标记（源异常时尽量不断流）
- 卡片状态徽标（实时更新/延迟更新/缓存兜底）+ 数据年龄/最后变化时间
- AI 异动归因（涨跌阈值触发后自动收集新闻并输出“结论 + 证据”）
- 权威信源策略（央视/CNN/WSJ 等白名单优先，支持不足补充或仅白名单）
- AI研判标签页（策略可视化配置、证据分层统计、事件详情追溯）
- 策略实验室（历史回测：触发/恢复统计、1D/5D前瞻收益、最大不利波动、策略/基准双曲线、规则分组对比与一键排序、逐笔明细）
- K线 AI 事件叠加（图上点击事件标记直达归因详情）

## 界面预览

![行情总览与监控中心](assets/screenshots/market-dashboard.png)

![金价 K 线图表区](assets/screenshots/market-charts.png)

## 说明

- 当前 `AUCN` 是“国内参考价”：由 `XAUUSD * USD/CNY / 31.1034768 + premium` 计算。
- 浙商积存金已预留二期插件：`app/sources/zs_plugin.py`。

## 快速启动

```bash
./start
```

启动后，浏览器访问 `http://localhost:8080`。

首次使用会自动跳转到 `http://localhost:8080/setup` 初始化页面，创建管理员账号后即可登录。

说明：
- `./start` 为一键启动命令（会自动在首次运行时从 `.env.example` 生成 `.env`）。
- 如需指定解释器：`PYTHON_BIN=python3 ./start`

## 环境变量

复制 `.env.example` 自定义：

- `PORT`：服务端口（默认 `8080`）
- `POLL_INTERVAL_SEC`：轮询间隔（默认 `5`，最小 `5`）
- `STALE_FALLBACK_MAX_AGE_SEC`：源异常时允许使用缓存行情的最大秒数（默认 `7200`）
- `FX_STALE_THRESHOLD_SEC`：汇率标的（USDCNY）过期判定阈值秒数（默认 `108000`）
- `SESSION_TTL_SEC`：登录会话有效期秒数（默认 `43200`）
- `SESSION_SECRET`：会话签名密钥（建议部署时必填，避免使用默认派生密钥）
- `AUTH_MAX_FAILURES`：登录窗口内最多失败次数（默认 `10`）
- `AUTH_WINDOW_SEC`：登录失败计数窗口秒数（默认 `300`）
- `AUTH_BAN_SEC`：触发封禁后的封禁秒数（默认 `120`）
- `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM`：SMTP 邮件服务配置（用于初始化邮箱验证码）
- `SMTP_USE_TLS/SMTP_USE_SSL`：SMTP 连接方式
- `BOOTSTRAP_CODE_TTL_SEC`：初始化邮箱验证码有效期（默认 `600`）
- `BOOTSTRAP_CODE_RESEND_SEC`：验证码重发最小间隔（默认 `60`）
- `WECOM_WEBHOOK_URL`：企业微信机器人 webhook（为空则仅控制台输出）
- `DOMESTIC_PREMIUM_CNY_PER_G`：国内参考价附加溢价（默认 `0`）
- `INITIAL_BACKFILL_DAYS`：启动回填天数（默认 `365`）
- `DB_PATH`：数据库路径（云部署建议 `/data/gold_monitor.db`）
- `NOTIFY_ON_TRIGGER/NOTIFY_ON_RECOVER/NOTIFY_ON_SOURCE/NOTIFY_ON_HEARTBEAT`：通知事件开关
- `NOTIFY_STYLE`：`detailed` 或 `compact`
- `NOTIFY_TITLE_PREFIX`：通知标题前缀
- `BASIC_AUTH_USER/BASIC_AUTH_PASS`：基础登录认证

## API

- `GET /api/prices/latest`
  - `items[]` 字段：
    - `stale`：是否超时（兼容旧逻辑）
    - `age_sec`：距最新报价秒数
    - `last_changed_at`：最近一次“有效价格变化”时间
    - `freshness_status`：`live` / `delayed` / `cached`
    - `expected_update_sec`：该数据源理论更新周期（秒）
- `GET /api/health`
- `GET /api/auth/status`
- `GET /api/auth/bootstrap/status`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/bootstrap/send_code`
- `POST /api/auth/bootstrap/init`
- `POST /api/auth/invite/create`（管理员生成邀请码）
- `POST /api/auth/register/send_code`（用户注册发送邮箱验证码）
- `POST /api/auth/register`（用户完成注册）
- `POST /api/auth/password_reset/send_code`（找回密码发送邮箱验证码）
  - 若 SMTP 未配置且在本机访问，会返回 `local_dev` 验证码兜底（仅本地可见）
- `POST /api/auth/password_reset/confirm`（校验验证码并重置密码）
  - 也支持 `recovery_secret`（`SESSION_SECRET`）直连重置，适用于未配置 SMTP 的自部署场景
- `GET /api/admin/users`（管理员查看用户列表）
- `PATCH /api/admin/users/{id}`（管理员启停用户）
- `POST /api/admin/users/{id}/reset_password`（管理员重置用户密码）
- `POST /api/auth/change_password`（当前登录用户修改自己的密码）
- `GET /api/admin/login_audit`（管理员查看登录审计）
- `POST /api/collect/once`
- `GET /api/kline?symbol=XAUUSD&timeframe=1d&range=12m`
- `GET /api/indicators?symbol=AUCN&timeframe=1d&range=12m`
- `GET /api/forecast/signal?symbol=XAUUSD&timeframe=1d`
- `GET /api/rules`
- `POST /api/rules`
  - 新增可选字段：`logic_operator`（`and`/`or`）、`clauses[]`
  - 兼容旧字段：`condition/threshold/indicator_filter`（自动映射为单条件组）
- `PATCH /api/rules/{id}`
  - 支持更新：`logic_operator`、`clauses[]`
- `DELETE /api/rules/{id}`
- `GET /api/alerts`
- `POST /api/backtest/run`
  - 入参：`rule_id` 或 `draft_rule`，可选 `symbol`、`range(1m/3m/6m/12m)`
  - 返回：`summary` + `trades` + `equity_curve` + `benchmark_curve`
  - `summary` 新增：`benchmark_return_pct`、`benchmark_max_drawdown_pct`、`alpha_return_pct`
- `POST /api/backtest/compare`
  - 入参：`range(1m/3m/6m/12m)`，可选 `rule_ids[]`（不传时对比全部启用规则）
  - 返回：`rows[]`（按规则分组的统计对比，包括策略/基准收益、alpha、回撤）
- `GET /api/chart/config`
- `GET /api/settings`
- `PATCH /api/settings`
  - 可同时修改部署安全相关字段：`basic_auth_user`、`basic_auth_pass`、`session_secret`、`session_ttl_sec`、`auth_max_failures`、`auth_window_sec`、`auth_ban_sec`
  - 可修改部署参数（重启生效）：`deploy_host`、`deploy_port`、`deploy_timezone`
- `POST /api/settings/test_notify`
- `GET /api/insight/settings`
- `PATCH /api/insight/settings`
- `POST /api/insight/models/discover`（根据 AI Base URL + API Key 自动检测模型列表）
  - 权威信源策略字段：
    - `source_policy_mode`: `whitelist_preferred` / `whitelist_only`
    - `source_whitelist_domains`: 白名单域名数组
    - `min_authoritative_articles`: 最小权威新闻条数
- `GET /api/insight/events?limit=20&symbol=XAUUSD&direction=up&start=...&end=...`
  - 也支持 `range=1m|3m|6m|12m`（在未传 `start/end` 时生效）
- `GET /api/insight/events/{id}`
- `POST /api/insight/simulate`（一键模拟触发 AI 归因，用于验收流程）
  - 返回增强字段：
    - `evidence[]`: `title/url/outlet/published_at/source_tier`
    - `authoritative_count`、`supplemental_count`
    - `confidence_reason`

## 新增规则示例

```bash
curl -X POST http://127.0.0.1:8080/api/rules \
  -H 'Content-Type: application/json' \
  -d '{
    "symbol": "AUCN",
    "condition": "lte",
    "threshold": 570,
    "cooldown_sec": 900,
    "debounce_count": 2,
    "indicator_filter": "any",
    "enabled": true
  }'
```

## 常见问题

- 电脑要一直开着吗？
  - 本地运行时需要。部署到服务器后不需要本地电脑开机。
- 外网/不同局域网可以访问吗？
  - 可以。部署到公网服务器后通过域名访问；建议开启 `BASIC_AUTH_USER/BASIC_AUTH_PASS`。
- 刷新频率能多快？
  - 当前设计基线是 5 秒（后端采集 + 前端刷新），并支持“立即刷新”按钮主动触发一次采集。
- 为什么刷新后价格有时不变？
  - 免费公开源并非逐笔 tick；系统会显示“实时更新/延迟更新/缓存兜底”状态与“最后变化时间”，用于解释“已刷新但上游未变”的情况。
- 手机能看吗？
  - 可以，H5 响应式页面，手机浏览器可查看和操作规则/设置。
- 登录选项在哪里？
  - 系统启动后会先访问 `http://localhost:8080/setup` 初始化管理员。初始化完成后才允许登录。
- 普通用户怎么注册？
  - 管理员登录后在“部署配置 -> 邀请码注册管理”生成邀请码。
  - 用户访问 `http://localhost:8080/register`，输入邀请码 + 邮箱，先收验证码，再完成注册。
- 忘记管理员密码怎么办？
  - 访问 `http://localhost:8080/forgot-password`，输入管理员邮箱并接收验证码，校验后可重置登录密码。
  - 若未配置 SMTP，可在找回页填写初始化时保存的恢复密钥（`SESSION_SECRET`）重置。
- 管理员如何管理用户？
  - 登录后进入“部署配置 -> 用户管理”，可执行启用/停用、重置密码。
- 我自己怎么改密码？
  - 登录后进入“部署配置 -> 账号安全”，填写当前密码和新密码即可。
- 登录审计在哪里看？
  - 登录后进入“部署配置 -> 登录审计”，管理员可查看登录成功/失败记录。
- 邮箱验证码怎么启用？
  - 配置 `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM` 后，`http://localhost:8080/setup` 会自动切换为“邮箱验证码注册”流程：先发送验证码，再完成管理员创建。
- `SMTP_PASS` 是什么？
  - 通常不是邮箱登录密码，而是邮箱服务提供商生成的“授权码/应用专用密码”（例如 QQ 邮箱、163 邮箱、Gmail 都有类似机制）。
- AI异动归因怎么启用？
  - 登录后进入“AI研判”标签页，设置涨跌阈值、窗口、白名单策略，再配置 OpenAI 兼容接口（`Base URL + Model + API Key`）。
  - 若启用“企业微信自动推送”，触发后会推送摘要；详细证据可在“AI归因事件记录”里查看。

## 目录结构

- `main.py`：启动入口
- `app/collector.py`：采集 + 失效切换 + 回填 + 心跳
- `app/rules.py`：规则引擎
- `app/analysis.py`：K 线、指标、趋势信号
- `app/server.py`：HTTP API + 静态页面
- `static/`：前端页面与图表
