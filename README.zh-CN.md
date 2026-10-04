# Playlogue

[English](README.md) | [简体中文](README.zh-CN.md)

Playlogue 是游戏 UX 访谈原型。参与者逐题回答，研究员将候选发现回查到实际提问和原始回答片段。仓库中的示例与测试均使用虚构回答和合成数据。

本源码快照包含 v19 玩法反馈提纲及分析加载 spinner。提纲覆盖地图设计、玩家感知的干员平衡、枪械改装与购买经济，共三个主问题；每个主题最多一个即时追问，全场最多两个追问。已保存提纲保留原版本。追问依据回答决定，并非必定出现。

界面支持文字回答、明确确认语音转写、会话恢复、已保存分析及引用检查。候选发现仍需人工审核。合成测试不能证明真实麦克风、扬声器或连续语音验收通过；另行开发的 provider span-normalization 候选未纳入。本次公开源码不会部署服务或启用真实 provider 调用。

## 启动虚构示例

使用 Node.js 24 或更新版本，测试 harness 使用 Node 内置 SQLite。

```sh
npm ci
npm start
```

打开终端打印的 loopback 地址。此命令提供虚构前端示例，不启用 provider，也不收集真人研究数据。

## 构建与测试

```sh
npm run check
npm run build
npm run typecheck
npm run test:synthetic
```

构建生成 Worker 与合成 API harness，无需私人部署配置。`npm run preview:worker` 在 loopback 启动 Worker，使用全新合成 SQLite 数据库，关闭真实调用和可信身份。API 前端通过 `?adapter=api` 明确选择。生成目录 `work/`、`dist/` 与运行时数据库不会提交。

本次发布包含 schema 源码、迁移和 mock 测试；不包含浏览器 QA 脚本、真实调用验证脚本、私人部署配置、内部证据、诊断导出、参与者记录、音频或日志。部分测试保留历史 `live` 命名，但使用注入的 mock transport 与合成 fixture，不能验证真实账单或研究效果。

## 运行时配置

在自己的服务端运行时设置 bindings 和 secrets，不得提交凭证值或参与者 capability。变量名包括 `DB`、`APP_ORIGIN`、`AUTH_MODE`、`SITE_ACCESS_MODE`、`RESEARCHER_USER_ID` 和 `OPENAI_API_KEY`。服务端保留文字/语音 readiness、授权、同意、额度、保留期与预算门禁。本地 mock/demo 无需真实 API key；如需 `.openai/hosting.json`，必须自行私下创建，该路径保持忽略。

这是工程原型；模型解释属于待审假设，不代表具有代表性的玩家结论或已验证的设计建议。应用删除与 provider 保留有不同边界。本源码快照不附公开演示地址，也不擅自添加新的开源许可证授权。
