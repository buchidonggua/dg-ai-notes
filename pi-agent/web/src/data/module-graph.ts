// src/data/module-graph.ts
export interface ModuleNode {
  slug: string;
  module: string;  // "M01"
  title: string;
  summary: string;
  status: 'published' | 'draft' | 'planned';
  x: number;
  y: number;
}

export interface ModuleEdge {
  from: string;  // module id, e.g. "M02"
  to: string;
}

// 预定义坐标（1000×600 viewBox，3 行 × 4 列，边缘留出节点半径）
export const moduleNodes: ModuleNode[] = [
  { slug: 'ch01-overview',              module: 'M01', title: '开篇 · 框架总览',         summary: 'Pi 是什么、为什么学它',           status: 'published', x: 100, y: 100 },
  { slug: 'ch02-three-layer-arch',      module: 'M02', title: '三层架构 · 项目骨骼',     summary: 'pi-ai / agent-core / coding-agent', status: 'published', x: 350, y: 100 },
  { slug: 'ch03-agent-loop',            module: 'M03', title: 'Agent Loop · 引擎',       summary: '让模型转动起来的循环',            status: 'published', x: 600, y: 100 },
  { slug: 'ch04-model-call',            module: 'M04', title: '模型调用 · 驾驭多模型',   summary: '服务、协议与鉴权分别适配',           status: 'published', x: 850, y: 100 },
  { slug: 'ch05-tools',                 module: 'M05', title: '工具系统 · 五步管道',     summary: 'Agent 的手脚怎么被管住',          status: 'published', x: 100, y: 300 },
  { slug: 'ch06-messages',              module: 'M06', title: '消息系统 · 内富外严',     summary: 'Agent 的记忆组织与传递',          status: 'published', x: 350, y: 300 },
  { slug: 'ch07-event-driven',          module: 'M07', title: '事件驱动 · 神经系统',     summary: '同步屏障 + 发布订阅',             status: 'published', x: 600, y: 300 },
  { slug: 'ch08-context-engineering',   module: 'M08', title: '上下文工程 · 窗口无限',   summary: '输入与历史两端的防线',            status: 'published', x: 850, y: 300 },
  { slug: 'ch09-compaction',            module: 'M09', title: '上下文压缩 · 切割点',     summary: '把 50 轮对话压缩成摘要',          status: 'published', x: 100, y: 500 },
  { slug: 'ch10-session',               module: 'M10', title: '会话管理 · Session Tree', summary: '存储、恢复与分叉',                status: 'published', x: 350, y: 500 },
  { slug: 'ch11-extensions', module: 'M11', title: '扩展系统 · 注册与绑定', summary: '工具和事件如何接入运行时', status: 'published', x: 600, y: 500 },
  { slug: 'ch12-testing', module: 'M12', title: '测试模式 · Faux Provider', summary: '不用真实模型验证 Agent 行为', status: 'published', x: 850, y: 500 },
];

export const moduleEdges: ModuleEdge[] = [
  // Foundations chain
  { from: 'M01', to: 'M02' },
  { from: 'M02', to: 'M03' },
  // Loop depends on model, tools, messages
  { from: 'M03', to: 'M04' },
  { from: 'M03', to: 'M05' },
  { from: 'M03', to: 'M06' },
  // Sequential chain through advanced chapters
  { from: 'M06', to: 'M07' },
  { from: 'M07', to: 'M08' },
  { from: 'M08', to: 'M09' },
  { from: 'M09', to: 'M10' },
  { from: 'M10', to: 'M11' },
  { from: 'M11', to: 'M12' },
];
