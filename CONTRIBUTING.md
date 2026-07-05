# 贡献指南

感谢你对本教程的兴趣！这是一个个人维护的学习笔记仓库，欢迎一起完善。

## 🐛 发现内容错误？

教程类项目最容易出现的就是 typo、过时信息、代码引用对不上。如果你发现了：

1. **小修小补**（typo、链接修复、措辞优化）：直接发 PR，标题用 `docs: 修复 xxx`
2. **不确定的修改**（内容理解差异、不同看法）：建议先提 Issue 讨论

## 📝 Issue 模板

仓库提供了 3 种 Issue 模板：

- **内容勘误**（最常用）：报告 typo、错误链接、内容问题
- **Bug 报告**：web 电子书的功能性问题（页面崩溃、样式错乱等）
- **功能建议**：新增章节、改进交互等

## 🔧 本地开发（针对 web 电子书）

如果你想改进在线电子书：

```bash
git clone https://github.com/buchidonggua/dg-ai-notes.git
cd dg-ai-notes/pi-agent/web
npm install
npm run dev      # http://localhost:4321
```

技术栈：Astro 5 + React 19 + MDX。详见 [pi-agent/web/README.md](./pi-agent/web/README.md)。

## 📜 License

提交的内容默认遵循：

- 代码：[MIT](./LICENSE)
- 文档：[CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)

提交 PR 即视为同意以上 License。

## 💬 联系

优先通过 Issue / PR 沟通，我会尽快回复。
