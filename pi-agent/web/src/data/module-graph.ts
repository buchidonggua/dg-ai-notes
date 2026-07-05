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

// 预定义坐标（1200×800 viewBox，2 行网格：y=200/480，x 步进 220）
export const moduleNodes: ModuleNode[] = [
  // Row 1 (y=200): foundations
  { slug: 'ch01-overview',              module: 'M01', title: '开篇 · 框架总览',         summary: 'Pi 是什么、为什么学它',           status: 'published', x: 100, y: 200 },
  { slug: 'ch02-three-layer-arch',      module: 'M02', title: '三层架构 · 项目骨骼',     summary: 'pi-ai / agent-core / coding-agent', status: 'published', x: 320, y: 200 },
  { slug: 'ch03-agent-loop',            module: 'M03', title: 'Agent Loop · 引擎',       summary: '让模型转动起来的循环',            status: 'published', x: 540, y: 200 },
  { slug: 'ch04-model-call',            module: 'M04', title: '模型调用 · 驾驭多模型',   summary: '一行代码调 30+ 供应商',           status: 'published', x: 760, y: 200 },
  { slug: 'ch05-tools',                 module: 'M05', title: '工具系统 · 五步管道',     summary: 'Agent 的手脚怎么被管住',          status: 'published', x: 980, y: 200 },
  // Row 2 (y=480): advanced
  { slug: 'ch06-messages',              module: 'M06', title: '消息系统 · 内富外严',     summary: 'Agent 的记忆组织与传递',          status: 'published', x: 100, y: 480 },
  { slug: 'ch07-event-driven',          module: 'M07', title: '事件驱动 · 神经系统',     summary: '同步屏障 + 发布订阅',             status: 'published', x: 320, y: 480 },
  { slug: 'ch08-context-engineering',   module: 'M08', title: '上下文工程 · 窗口无限',   summary: '输入与历史两端的防线',            status: 'published', x: 540, y: 480 },
  { slug: 'ch09-compaction',            module: 'M09', title: '上下文压缩 · 切割点',     summary: '把 50 轮对话压缩成摘要',          status: 'published', x: 760, y: 480 },
  { slug: 'ch10-session',               module: 'M10', title: '会话管理 · Session Tree', summary: '存储、恢复与分叉',                status: 'published', x: 980, y: 480 },
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
];
