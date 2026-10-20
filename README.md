# ProofCV · 把经历写得更有分量

一个可开源、可运行的 AI 简历工作台。它把 **事实笔记 → 简历草稿 → 人工审核 → 实时编辑 → 多格式导出** 串成完整流程。AI 建议始终先展示，只有点击“应用建议”才会写入简历。

🔗 [在线体验编辑与导出](https://wheatcore.github.io/proofcv/) · [源码仓库](https://github.com/wheatcore/proofcv)

> 在线静态演示不附带任何公共 AI 密钥。AI 生成与润色需要按下方步骤在本机配置自己的 API Key。这样不会将密钥放入网页源码或 GitHub 仓库。

## 功能

- **AI 生成**：根据原始经历笔记生成摘要、技能、工作经历与项目要点；不修改联系方式和教育经历。
- **逐条润色**：选择某条工作或项目要点，对比原文与建议后再决定是否应用。
- **结构化编辑**：基本信息、经历、项目、技能、教育经历；右侧实时 A4 预览。
- **自定义模块**：在顶部点击「＋ 添加模块」创建与基本信息、工作经历同级的编辑标签；可独立填写荣誉、证书、开源贡献等内容。在「模块管理」中修改标题、调整顺序、显示或隐藏；预览、PDF、Markdown 与 JSON 保持一致。
- **岗位关键词提示**：分析岗位描述中出现的关键词，并提示简历中已出现与未出现的词；这不是 ATS 通过率预测。
- **本地自动保存**：编辑内容存于当前浏览器的 localStorage。服务端不保存简历。
- **导出与备份**：使用浏览器打印为 PDF，下载 Markdown 或 JSON；JSON 可再次导入。
- **无需前端构建**：Node 22 原生 HTTP、浏览器原生 JS，无运行时依赖。

## 本机运行

需要 Node.js 22 或更高版本。克隆仓库后，在项目目录运行：

```bash
npm start
```

浏览器打开 `http://127.0.0.1:4173`。此时编辑、预览、关键词提示和导出都可使用。

要启用 AI，在启动服务前设置环境变量：

**PowerShell**

```powershell
$env:OPENAI_API_KEY="你的 API Key"
$env:OPENAI_MODEL="gpt-4.1-mini"
npm start
```

**macOS / Linux**

```bash
OPENAI_API_KEY="你的 API Key" OPENAI_MODEL="gpt-4.1-mini" npm start
```

可选环境变量：`PORT`（默认 `4173`）、`OPENAI_BASE_URL`（默认 `https://api.openai.com/v1`）。兼容服务需要支持 `/chat/completions`、`response_format: json_object` 和 `store: false`。当前实现依据 [OpenAI Chat Completions API 文档](https://platform.openai.com/docs/api-reference/chat/create)。

启动后进入「✳ AI 工作台」，输入不少于 20 字的真实经历笔记并点击生成。工作或项目要点右侧的 ✳ 按钮可以单独润色。AI 调用可能产生所选服务的费用。

## 导出 PDF

点击右上角「导出简历 → 打印 / 保存 PDF」，在浏览器打印窗口中选择「另存为 PDF」。打印样式以 A4 排版，隐藏编辑器和操作按钮。Markdown 与 JSON 可直接下载。

## 自定义简历模块

点击顶部「＋ 添加模块」，填写名称后，新模块会立刻成为与「基本信息」「工作经历」同级的标签，并自动打开独立编辑页面。每个自定义模块可添加多条记录，每条有标题、说明、时间和详情。

进入「模块管理」可使用 ↑ / ↓ 调整预览和导出的模块顺序，直接改标题，或切换显示状态。隐藏模块只影响预览和导出，编辑标签与原数据仍保留。删除自定义模块会同时删除其中记录，请先导出 JSON 备份。旧版 JSON 导入后会自动补上默认模块设置。

## 数据和隐私

- `OPENAI_API_KEY` 只在本地 Node 服务的环境变量中读取；不要提交 `.env`。仓库通过 `.gitignore` 排除密钥文件。
- 简历在浏览器本地保存。清除浏览器站点数据会删除它，请定期导出 JSON 备份。共享电脑上使用后请清除站点数据。
- 点击 AI 生成或润色会把对应的事实笔记或要点发送给你配置的 AI 服务。页面会提醒这一点。
- AI 可能写出不实或夸大的内容。发布或投递前请核对公司、时间、技术、数字与成果。
- 本地服务默认只监听 `127.0.0.1`；不要直接将带密钥的开发服务暴露在公网。

## 项目结构

```text
dist/               静态网页、编辑器、预览与导出
  app.js            UI 交互和人工审核流程
  resume.js         简历模型、Markdown 导出与关键词分析
server.mjs          同源静态服务与 AI API 代理
tests/              模型与服务端测试
.github/workflows/  CI 和 GitHub Pages 发布
```

AI 请求路径为 `POST /api/ai`，支持 `kind: "generate"` 和 `kind: "polish"`；`GET /api/status` 只返回是否配置 AI。服务端会限制请求大小、校验输入和模型返回内容，且不记录简历正文。

## 开发和测试

```bash
npm test
npm run check
```

测试使用本地模拟 AI 服务，不会调用真实模型或消耗额度。

## 开源与贡献

MIT License。欢迎提交 Issue 或 PR，尤其是无障碍、更多导出格式和更完善的事实核对体验。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。
