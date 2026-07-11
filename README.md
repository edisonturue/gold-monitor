[![](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C_Demo-gold?style=for-the-badge)](https://edisonturue.github.io/gold-monitor/)

# Gold Monitor

[**在线体验 Demo**](https://edisonturue.github.io/gold-monitor/) — 无需部署，浏览器直接打开，展示完整前端交互界面。

免费优先的金价监控工具，支持：

- 国际/国内金价实时采集（默认 5 秒轮询）
- 阈值规则 + 组合条件（AND/OR） + 冷却防抖
- 企业微信机器人通知
- K线图表（MA5/MA20/MA60、RSI、MACD、趋势信号）
- 策略实验室（历史回测、规则分组对比）
- AI 异动归因（涨跌自动触发新闻分析 + 结论）
- 图形化管理后台（规则/通知/用户/部署配置）
- 登录认证（表单登录 + HttpOnly Cookie + 审计日志）
- 数据源多级备援 + 缓存兜底
- 暗色金融风 UI（跟随系统自动切换）

## 界面预览

![行情总览与监控中心](assets/screenshots/market-dashboard.png)

![金价 K 线图表区](assets/screenshots/market-charts.png)

## 快速启动

```bash
./start
```

首次使用访问 `http://localhost:8080/setup` 初始化管理员账号，登录后即可使用。

## 目录结构

- `main.py` — 启动入口
- `app/collector.py` — 采集 + 失效切换 + 回填 + 心跳
- `app/rules.py` — 规则引擎
- `app/analysis.py` — K线、指标、趋势信号
- `app/server.py` — HTTP API + 静态页面
- `static/` — 前端页面与图表
- `data/` — SQLite 数据库

## 环境变量

主要变量（完整列表见 `.env.example`）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | 服务端口 |
| `POLL_INTERVAL_SEC` | `5` | 轮询间隔 |
| `SESSION_SECRET` | — | 会话签名密钥（部署必填） |
| `BASIC_AUTH_USER/PASS` | — | 基础登录认证 |
| `SMTP_HOST/PORT/USER/PASS/FROM` | — | 邮箱验证码服务 |
| `WECOM_WEBHOOK_URL` | — | 企业微信机器人 webhook |
| `DB_PATH` | `data/gold_monitor.db` | 数据库路径 |

## 常见问题

- **外网可以访问吗？** 部署到公网服务器后通过域名访问。
- **手机能看吗？** 可以，H5 响应式页面。
- **刷新后价格不变？** 免费公开源非逐笔 tick；页面会显示缓存/年龄状态。
- **如何开启邮箱验证码？** 配置 SMTP 变量后，`/setup` 页面自动切换为邮箱验证流程。
- **如何开启 AI 归因？** 在 AI 研判标签页配置 OpenAI 兼容接口 + 涨跌阈值。
