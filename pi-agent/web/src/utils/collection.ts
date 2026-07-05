// src/utils/collection.ts
import { getCollection, type CollectionEntry } from 'astro:content';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type ModuleEntry = CollectionEntry<'modules'>;

export interface ModuleStats {
  wordCount: number;
  codeLines: number;
  readMinutes: number;
}

export interface GroupedChapter {
  module: string;
  displayOrder: number;
  tsEntry?: ModuleEntry;
  pythonEntry?: ModuleEntry;
}

const CJK_RE = /[\u4e00-\u9fa5]/g;
const WORD_RE = /[a-zA-Z][a-zA-Z0-9_-]*/g;

/**
 * 从 entry.id 解析 mdx 源文件的绝对路径。
 * Astro content collection (type:'content') 的 entry.id 是相对 content 目录的路径，
 * 形如 'ch01-overview.md' 或 'ch01-overview.python.md'。
 */
function resolveEntryPath(entry: ModuleEntry): string {
  return path.resolve(process.cwd(), 'src/content/modules', entry.id);
}

/**
 * 统计 mdx 源文件的字数 / 代码行数 / 阅读时长。
 *
 * 口径：
 *   - 正文字数 = 中文字符数（按字计）+ 英文连续字母组数（按词计）
 *   - 代码行数 = 围栏代码块内非空行数（不计入正文字数）
 *   - 阅读时长 = ceil(正文字数 / 200)，最少 1 分钟（技术文档需停下来思考，按 200 字/分钟估算）
 */
export function getModuleStats(entry: ModuleEntry): ModuleStats {
  const raw = readFileSync(resolveEntryPath(entry), 'utf-8');

  // 剥离 frontmatter（--- 包裹的 YAML 头）
  const body = raw.replace(/^---[\s\S]*?---\s*\n/, '');

  // 提取所有围栏代码块（``` 围起），统计非空行数
  const codeMatches = [...body.matchAll(/```[^\n`]*\n([\s\S]*?)```/g)];
  const codeLines = codeMatches.reduce(
    (sum, m) => sum + m[1].split('\n').filter((l) => l.trim().length > 0).length,
    0,
  );

  // 正文 = 全文 - frontmatter - 代码块 - JSX 标签 - mdx 表达式
  const prose = body
    .replace(/```[\s\S]*?```/g, ' ') // 去代码块
    .replace(/<[^>]+\/?>/g, ' ') // 去 JSX 标签
    .replace(/\{[^}]*\}/g, ' '); // 去 mdx 表达式 { ... }

  const cjk = (prose.match(CJK_RE) || []).length;
  const en = (prose.match(WORD_RE) || []).length;
  const wordCount = cjk + en;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return { wordCount, codeLines, readMinutes };
}

export async function getAllModules(book?: string): Promise<ModuleEntry[]> {
  const all = await getCollection('modules');
  return all
    .filter(m => !book || m.data.book === book)
    .sort((a, b) => a.data.displayOrder - b.data.displayOrder);
}

export async function getPublishedModules(book?: string): Promise<ModuleEntry[]> {
  return (await getAllModules(book)).filter(m => m.data.status === 'published');
}

/**
 * 把扁平的 ModuleEntry 列表按 data.module（M01/M02/...）分组。
 * 每组包含 tsEntry 和/或 pythonEntry，displayOrder 取该 module 第一条的值。
 * 组按 displayOrder 升序排列。
 */
export function groupByChapter(entries: ModuleEntry[]): GroupedChapter[] {
  const map = new Map<string, GroupedChapter>();
  for (const entry of entries) {
    const key = entry.data.module;
    if (!map.has(key)) {
      map.set(key, {
        module: key,
        displayOrder: entry.data.displayOrder,
      });
    }
    const group = map.get(key)!;
    if (entry.data.variant === 'ts') {
      group.tsEntry = entry;
    } else if (entry.data.variant === 'python') {
      group.pythonEntry = entry;
    }
  }
  return [...map.values()].sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function getModuleBySlug(slug: string): Promise<ModuleEntry | undefined> {
  return (await getAllModules()).find(m => m.slug === slug);
}

export async function getAdjacentModules(currentOrder: number) {
  const all = await getPublishedModules();
  const prev = all.filter(m => m.data.displayOrder < currentOrder).pop();
  const next = all.filter(m => m.data.displayOrder > currentOrder).shift();
  return { prev, next };
}

export function getVariantUrl(entry: ModuleEntry): string {
  const base = `/modules/${entry.slug.replace(/\.python$/, '')}`;
  return entry.data.variant === 'python' ? `${base}/python` : base;
}

export function getCounterpartUrl(entry: ModuleEntry): string | null {
  if (!entry.data.counterpart) return null;
  // counterpart 字段值是 slug（含或不含 .python 后缀）
  const isPy = entry.data.variant === 'ts';
  const base = `/modules/${entry.data.counterpart.replace(/\.python$/, '')}`;
  return isPy ? `${base}/python` : base;
}
