# 📚 dg-ai-notes

[简体中文](README.md) | [English](README.en.md)

> Donggua's AI study notes · Currently focused on an in-depth [Pi-Agent](https://pi.dev) SDK tutorial

---

## 🤔 What is Pi-Agent, and why learn it?

[**Pi-Agent**](https://github.com/earendil-works/pi) is an open-source Agent SDK from [@earendil-works](https://github.com/earendil-works), designed as a **production-grade runtime foundation for AI agents**.

It is not a toy framework, but an Agent engineering reference implementation that is **genuinely ready for production**. You can find counterparts in Pi for the internal architectures of similar products such as Claude Code, Cursor, and Cline. Understanding Pi means understanding how a complete Agent SDK should be designed.

**Core capabilities**:

- 🔄 **Agent Loop** — Model call loops, stopping conditions, and error safeguards for building reliable LLM execution loops
- 🛠️ **Tool system** — A five-stage pipeline (definition, registration, interception, execution, and cleanup) that gives an LLM controlled ways to act
- 💬 **Message system** — Seven flexible internal representations translated into three standard external Message types, balancing flexibility and compatibility
- 📡 **Event-driven architecture** — Synchronization barriers plus publish-subscribe messaging, allowing extensions and hosts to coordinate like a nervous system
- 🗂️ **Session management** — A Session Tree that makes conversations storable, resumable, and forkable
- 🧩 **Extension mechanism** — Factory functions, throwing stubs, and an event bus that let Pi be adapted into any form

**Who should learn it**:

- Developers who want to build their own Agent with the pi-agent SDK
- Engineers who want to understand how production-grade Agents work internally
- Curious developers who want to understand Harness design instead of only knowing how to use Claude Code

---

## 📖 This tutorial: an Agent SDK explained in 10 chapters

These 10 chapters systematically break down the source-code design and implementation of Pi-Agent. Each chapter answers questions at three levels: **what it is** (concepts), **how it works** (source analysis), and **why it works this way** (design trade-offs).

```
ch01 Overview       →  ch02 Three layers  →  ch03 Agent Loop  →  ch04 Model calls  →  ch05 Tool system
                                                                                                  ↓
ch06 Message system →  ch07 Event-driven  →  ch08 Context engineering  →  ch09 Context compression  →  ch10 Session management
```

Every chapter is available in both **TypeScript** (the language used by the original Pi project) and **Python** (for readers who are familiar only with Python).

---

## 📚 Three ways to read

| Format | Entry point | Best for |
|------|------|----------|
| 🌐 **Online web edition** (recommended) | https://dg-ai-notes.pages.dev | Immersive desktop reading with a three-column layout, synchronized illustrations, and theme switching |
| 📥 **Downloadable Markdown edition** | [pi-agent/docs/](./pi-agent/docs/) | Reading locally with AI tools such as Claude or Cursor while comparing the notes with the source code |
| 📕 **PDF edition** | [v1.0 Release](../../releases/tag/v1.0) | Offline reading, printing, and long-term archiving |

> TypeScript path: [pi-agent/docs/typescript/](./pi-agent/docs/typescript/)
> Python path: [pi-agent/docs/python/](./pi-agent/docs/python/)

---

## 🧪 Supplement: Agent Loop Notebook

[notebooks/agent-loop.ipynb](./pi-agent/notebooks/agent-loop.ipynb) is an executable laboratory for Chapter 3's Agent Loop. You can run it step by step, change parameters, and observe the loop state.

> ⚠️ The main tutorial is designed for reading. The accompanying hands-on code for lessons L00–L31 is not currently public. The Notebook is provided only as a supplementary laboratory for the Agent Loop chapter.

---

## 🗺️ Content map

See the [Pi-Agent tutorial README](./pi-agent/README.md) for details.

---

## 🤝 Contributing

Found a typo or content error? You are welcome to:

- Open an [Issue](../../issues) (the "Content Correction" template is recommended)
- Submit a PR directly

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

---

## 📜 License

- **Code**: [MIT](./LICENSE)
- **Documentation**: [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/) (derivative works must use the same license, protecting the tutorial from being scraped and repackaged by commercial sites)

---

## 👋 About the author

Hi, I am **Donggua**, a blogger who enjoys breaking down AI engineering.

If you find this material helpful, feel free to visit my social accounts and chat about engineering practices for AI, Agents, and LLMs.

<table>
  <tr>
    <td width="50%" align="center">
      <img src="./assets/donghua-douyin-qr.png" alt="Donggua's Douyin QR code" width="220" />
      <br /><sub><b>Douyin · Donggua</b></sub>
      <br /><sub>AI technology explainers · Source-code analysis</sub>
    </td>
    <td width="50%" align="center">
      <img src="./assets/donghua-bilibili-qr.jpg" alt="Donggua's Bilibili QR code" width="220" />
      <br /><sub><b>Bilibili · Donggua</b></sub>
      <br /><sub>Long-form video tutorials · Live coding</sub>
    </td>
  </tr>
</table>


---

## 🙏 Acknowledgments

- The official [Pi-Agent](https://github.com/earendil-works/pi) team — these notes would not exist without their open-source work
- The authors of every open-source project cited
