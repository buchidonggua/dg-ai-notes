/**
 * 第 7 章 · 示例 07a：流式输出与 SSE 桥接 —— 完整版服务端（单接口）
 *
 * 把 DataAgent（第 5、6 章攒下来的）搬进浏览器：
 *   POST /chat → 发消息，响应本身就是 SSE 流，把 Pi 事件翻译后推给浏览器
 *
 * 为什么是「单接口」（而不是 POST 发 + GET 收两条路）？
 *   发消息和收流在同一个请求里，天然一一对应、天然支持并发，
 *   不用再拿 sessionId 把两条连接串起来——真实项目更常用这种做法。
 *
 * 复用主线工具 query_data（shared/lib/tools/query-data.ts），不重复定义。
 *
 * 运行：
 *   cd pi_sdk_learn/code
 *   npx tsx L07-streaming/07a-sse-server.ts
 *   然后浏览器打开 http://localhost:3000
 */
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { queryDataTool } from "../shared/lib/tools/query-data.ts";

// ── ESM 里没有 __dirname，这么取 ──────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════
// 1. 装一个 DataAgent（人设 + query_data 工具）
// ═══════════════════════════════════════════════════════════
const loader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  systemPromptOverride: () =>
    "你是企业数据分析助手。回答必须基于 query_data 工具查到的真实销售数据，" +
    "不要编造数字。用中文，结论先行，必要时给出明细。",
  extensionFactories: [
    (pi: any) => {
      pi.registerTool(queryDataTool); // ★ 复用主线工具
    },
  ],
});
await loader.reload();

const modelRuntime = await ModelRuntime.create();
const model = (await modelRuntime.getAvailable())[0];
if (!model) throw new Error("没有可用模型，请检查 ~/.pi/agent/models.json");

const { session } = await createAgentSession({
  model,
  modelRuntime,
  resourceLoader: loader,
  sessionManager: SessionManager.inMemory(),
});

// ═══════════════════════════════════════════════════════════
// 2. SSE 工具：拼消息格式 + 翻译 Pi 事件
// ═══════════════════════════════════════════════════════════

/**
 * 把一条消息格式化成 SSE 规范字符串（结尾两个换行是命根子）。
 * 这里不用 SSE 的 event 字段，而是把 type 塞进 data 的 JSON——
 * 配合前端 fetch + getReader 统一 JSON.parse 解析，更省事。
 */
function sse(type: string, data: unknown): string {
  return `data: ${JSON.stringify({ type, data })}\n\n`;
}

/**
 * Pi 事件 → SSE 字符串（null = 前端不关心，跳过）
 * 每个分支对应文档第三节那张事件翻译表的一行。
 * 注意：终局信号 done 不在这里发——单接口下用 prompt() 的 finally 更直接可靠（见下方 /chat）。
 */
function translateEvent(event: any): string | null {
  switch (event.type) {
    // ── 文本 / 思考：打字机的两路 ──
    case "message_update": {
      const ae = event.assistantMessageEvent;
      if (ae?.type === "text_delta") return sse("text", { delta: ae.delta });
      if (ae?.type === "thinking_delta") return sse("thinking", { delta: ae.delta });
      return null;
    }
    // ── 工具：开跑时出卡片 ──
    case "tool_execution_start":
      return sse("tool_start", {
        id: event.toolCallId,
        name: event.toolName,
        args: event.args,
      });
    // ── 工具：跑完填结果 ──
    case "tool_execution_end":
      return sse("tool_end", {
        id: event.toolCallId,
        name: event.toolName,
        result: String(event.result?.content?.[0]?.text ?? "").slice(0, 500), // 截断防撑爆
        isError: event.isError ?? false,
      });
    // agent_settled 不在这里处理——done 由 /chat 的 finally 统一发（见下）
    default:
      return null; // agent_start / agent_end / agent_settled / turn_* / message_start/end 前端不关心
  }
}

// ═══════════════════════════════════════════════════════════
// 3. Express 服务器
// ═══════════════════════════════════════════════════════════
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public"))); // 托管前端页面

// 单用户防并发：单个 AgentSession 不支持同时跑两轮 prompt
let busy = false;

/**
 * POST /chat —— 发消息，响应本身就是 SSE 流
 * Body: { message: string }
 *
 * 一个请求里干完三件事：发消息触发 Agent、订阅事件推到这个响应、跑完收尾。
 * 发消息和收流是同一条连接，天然一一对应。
 */
app.post("/chat", async (req, res) => {
  const { message } = req.body ?? {};
  if (!message) return res.status(400).json({ error: "message 必填" });
  if (busy) return res.status(429).json({ error: "Agent 正忙，稍等" });

  busy = true;

  // ① SSE 必备三个头（第一个是身份证号）
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // 禁用 nginx 缓冲，生产部署才用得上
  });
  res.flushHeaders?.(); // 立即把头发出去，前端能尽早开始读流

  // ② 在本请求内订阅 Agent 事件：每来一个事件，翻译后推到「这个响应」
  const off = session.subscribe((event) => {
    const payload = translateEvent(event);
    if (payload) {
      try {
        res.write(payload);
      } catch {
        // res 已坏（客户端走了），忽略
      }
    }
  });

  // ③ 客户端断开（关页面、点「停止」中断 fetch）→ 中断 Agent + 清理订阅
  let settled = false;
  res.on("close", () => {
    off();
    if (!settled) {
      try {
        session.abort(); // ★ 中断当前这轮 prompt
      } catch {
        /* noop */
      }
    }
  });

  try {
    await session.prompt(message); // 触发 Agent 干活，事件从上面 subscribe 推出去
  } catch (err: any) {
    try {
      res.write(sse("error", { message: err?.message ?? "Agent 出错" }));
    } catch {
      /* res 已坏 */
    }
  } finally {
    settled = true;
    off();
    try {
      res.write(sse("done", {})); // ★ 终局信号：一轮彻底跑完（或出错）后发一次，前端收到恢复输入框
    } catch {
      /* res 已坏 */
    }
    res.end();
    busy = false;
  }
});

// ── 启动 ──────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n════════ DataAgent Web ════════`);
  console.log(`  打开浏览器：http://localhost:${PORT}`);
  console.log(`  模型：${model.name}`);
  console.log(`  试试问：华东地区笔记本卖了多少？\n`);
});

// 优雅退出
process.on("SIGINT", () => {
  console.log("\n[Server] 正在关闭...");
  session.dispose();
  process.exit(0);
});
