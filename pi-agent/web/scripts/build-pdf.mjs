// scripts/build-pdf.mjs
// pi-agent-book PDF 导出脚本
//
// 用法：
//   node scripts/build-pdf.mjs --variant=ts        # 仅 TS 版
//   node scripts/build-pdf.mjs --variant=python    # 仅 Python 版
//   node scripts/build-pdf.mjs --variant=ts --keep-tmp  # 保留中间产物（调试）
//
// 退出码：
//   0  成功
//   1  参数错误 / 前置依赖未满足
//   2  astro preview 启动失败
//   3  Playwright 启动 / 渲染失败
//   4  pdf-lib 合并失败

import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOK_ROOT = path.resolve(__dirname, '..');

// ============================================================
// 章节配置
// ============================================================
const CHAPTERS = [
  { slug: 'ch01-overview',            title: '第1章：概览' },
  { slug: 'ch02-three-layer-arch',    title: '第2章：三层架构' },
  { slug: 'ch03-agent-loop',          title: '第3章：Agent Loop' },
  { slug: 'ch04-model-call',          title: '第4章：模型调用' },
  { slug: 'ch05-tools',               title: '第5章：工具' },
  { slug: 'ch06-messages',            title: '第6章：消息' },
  { slug: 'ch07-event-driven',        title: '第7章：事件驱动' },
  { slug: 'ch08-context-engineering', title: '第8章：上下文工程' },
  { slug: 'ch09-compaction',          title: '第9章：上下文压缩' },
  { slug: 'ch10-session',             title: '第10章：会话管理' },
];

// ============================================================
// 参数解析
// ============================================================
function parseArgs(argv) {
  const args = { variant: null, keepTmp: false };
  for (const a of argv.slice(2)) {
    if (a === '--keep-tmp') {
      args.keepTmp = true;
    } else if (a.startsWith('--variant=')) {
      args.variant = a.slice('--variant='.length);
    }
  }
  return args;
}

function validateVariant(v) {
  if (!v) {
    console.error('✗ 缺少必填参数 --variant');
    console.error('  用法: node scripts/build-pdf.mjs --variant=<ts|python>');
    console.error('  示例: node scripts/build-pdf.mjs --variant=ts');
    process.exit(1);
  }
  if (v !== 'ts' && v !== 'python') {
    console.error(`✗ 非法 variant: ${v}`);
    console.error('  合法取值: ts | python');
    process.exit(1);
  }
}

// ============================================================
// astro preview 服务管理
// ============================================================
async function probePort(port) {
  try {
    const res = await fetch(`http://localhost:${port}/`);
    return res.ok || res.status === 404;  // 404 也算服务在跑
  } catch {
    return false;
  }
}

async function ensureServer() {
  // 先看 4321 是否已在跑 astro（任何 astro 站点都行，能返回 HTML 即可）
  for (const port of [4321, 4322, 4323, 4324]) {
    if (await probePort(port)) {
      // 进一步验证是 pi-agent-book：检查首页含 Pi Agent Book
      try {
        const res = await fetch(`http://localhost:${port}/`);
        const text = await res.text();
        if (text.includes('Pi Agent') || text.includes('pi-agent')) {
          console.log(`✓ 复用已有 astro 服务: http://localhost:${port}`);
          return { baseUrl: `http://localhost:${port}`, child: null };
        }
      } catch {
        // 端口被占但不是 HTTP，继续找
      }
    }
  }

  // 自启 astro preview
  console.log('→ 启动 astro preview...');
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['astro', 'preview'],
    { cwd: BOOK_ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: false },
  );

  // 等待服务 ready（最长 15s）
  for (let tries = 0; tries < 30; tries++) {
    await new Promise(r => setTimeout(r, 500));
    if (await probePort(4321)) {
      console.log(`✓ astro preview ready: http://localhost:4321`);
      return { baseUrl: 'http://localhost:4321', child };
    }
  }

  child.kill();
  console.error('✗ astro preview 启动超时（15s）');
  process.exit(2);
}

// ============================================================
// Playwright 渲染单页 PDF
// ============================================================
async function renderPdf(browser, url, outPath, expectedSvg = 0) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // SVG 注入等待（DiagramLightbox.astro 维护 __diagramInlineCount__）
    if (expectedSvg > 0) {
      await page.waitForFunction(
        (n) => (window.__diagramInlineCount__ || 0) >= n,
        expectedSvg,
        { timeout: 8000 },
      ).catch(() => {
        console.warn(`  [warn] ${url}: SVG 注入超时（期望 ${expectedSvg}），强制打印`);
      });
    }

    // 给字体 / 主题切换一个 tick 的稳定时间
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
    });
    await new Promise(r => setTimeout(r, 300));

    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },  // print.css 的 @page 已设 25mm
    });
  } finally {
    await page.close();
  }
}

// ============================================================
// 用 frontmatter.diagrams 推断每章 SVG 期望计数
// ============================================================
function inferExpectedSvgCount(slug, variant) {
  // 直接 grep mdx frontmatter 的 diagrams 数组长度
  const isPython = variant === 'python';
  const mdxName = isPython ? `${slug}.python.mdx` : `${slug}.mdx`;
  const mdxPath = path.join(BOOK_ROOT, 'src/content/modules', mdxName);
  if (!fs.existsSync(mdxPath)) return 0;
  const content = fs.readFileSync(mdxPath, 'utf8');
  const m = content.match(/diagrams:\s*\n((?:\s+-[\s\S]*?)(?=\n[a-zA-Z]|\n---|\n*$))/);
  if (!m) return 0;
  return (m[1].match(/^\s+-\s/gm) || []).length;
}

// ============================================================
// 合并 + 加 outline 书签
// ============================================================
async function mergeWithOutline(parts, outPath) {
  // parts: [{ file, title }]
  const merged = await PDFDocument.create();

  // 元数据
  const variantTag = outPath.includes('-python') ? 'Python' : 'TypeScript';
  merged.setTitle(`Pi-Agent 源码精读 - ${variantTag} 版`);
  merged.setAuthor('pi-agent-book');
  merged.setCreator('pi-agent-book build-pdf.mjs');
  merged.setCreationDate(new Date());

  const pageOffsets = [];  // 每段在合并后的起始页码
  let cumulative = 0;

  for (const part of parts) {
    const bytes = fs.readFileSync(part.file);
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
    pageOffsets.push({ title: part.title, start: cumulative, count: pages.length });
    cumulative += pages.length;
  }

  // outline 书签（用 pdf-lib 低级 API 手写 Outlines 字典）
  try {
    const { PDFName, PDFNumber, PDFString, PDFArray, PDFNull } = await import('pdf-lib');
    const context = merged.context;

    // 先注册所有 outline 节点（拿到 indirect ref）
    const outlineRefs = pageOffsets.map(() => context.register(context.obj({})));

    // 填充每个节点
    pageOffsets.forEach((po, i) => {
      const node = context.lookup(outlineRefs[i]);
      node.set(PDFName.of('Title'), PDFString.of(po.title));
      node.set(PDFName.of('Parent'), null);  // 占位，回填见下
      if (i > 0) node.set(PDFName.of('Prev'), outlineRefs[i - 1]);
      if (i < outlineRefs.length - 1) node.set(PDFName.of('Next'), outlineRefs[i + 1]);
      node.set(PDFName.of('Dest'), PDFArray.withContext(context, [
        merged.getPage(po.start).ref,
        PDFName.of('Fit'),
      ]));
    });

    // Outlines 根
    const tree = context.obj({
      Type: PDFName.of('Outlines'),
      First: outlineRefs[0],
      Last: outlineRefs[outlineRefs.length - 1],
      Count: PDFNumber.of(outlineRefs.length),
    });
    const treeRef = context.register(tree);

    // 回填 Parent
    pageOffsets.forEach((_po, i) => {
      const node = context.lookup(outlineRefs[i]);
      node.set(PDFName.of('Parent'), treeRef);
    });

    merged.catalog.set(PDFName.of('Outlines'), treeRef);
    console.log(`  [outline] ${outlineRefs.length} 个书签已注入`);
  } catch (err) {
    console.warn(`  [warn] outline 注入失败（不影响 PDF 内容）: ${err.message}`);
  }

  const out = await merged.save();
  fs.writeFileSync(outPath, out);
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  const args = parseArgs(process.argv);
  validateVariant(args.variant);
  const variant = args.variant;

  console.log(`\n========================================`);
  console.log(`  PDF 导出：${variant === 'python' ? 'Python' : 'TypeScript'} 版`);
  console.log(`========================================\n`);

  // 1. 确保 dist/ 存在
  if (!fs.existsSync(path.join(BOOK_ROOT, 'dist/index.html'))) {
    console.error('✗ dist/ 未构建，请先 `npm run build`');
    process.exit(1);
  }

  // 2. 启 astro preview
  const { baseUrl, child } = await ensureServer();

  // 3. 准备输出目录
  const tmpDir = path.join(BOOK_ROOT, 'dist-pdf', `tmp-${variant}`);
  const finalDir = path.join(BOOK_ROOT, 'dist-pdf');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(finalDir, { recursive: true });

  let browser;
  try {
    // 4. 启动 Chromium
    console.log('→ 启动 Chromium...');
    browser = await chromium.launch({ headless: true });
    console.log('✓ Chromium ready\n');

    // 5. 渲染封面（首页）
    const coverPdf = path.join(tmpDir, 'cover.pdf');
    console.log(`→ [1/12] 封面 ${baseUrl}/`);
    await renderPdf(browser, `${baseUrl}/`, coverPdf, 0);

    // 6. 渲染目录页
    const tocPdf = path.join(tmpDir, 'toc.pdf');
    console.log(`→ [2/12] 目录 ${baseUrl}/print-toc/${variant}`);
    await renderPdf(browser, `${baseUrl}/print-toc/${variant}`, tocPdf, 0);

    // 7. 渲染 10 章
    const chapterPdfs = [];
    const isPython = variant === 'python';
    for (let i = 0; i < CHAPTERS.length; i++) {
      const ch = CHAPTERS[i];
      const url = isPython
        ? `${baseUrl}/modules/${ch.slug}/python`
        : `${baseUrl}/modules/${ch.slug}`;
      const outFile = path.join(tmpDir, `ch${String(i + 1).padStart(2, '0')}.pdf`);
      const expectedSvg = inferExpectedSvgCount(ch.slug, variant);
      console.log(`→ [${i + 3}/12] ${ch.title}  (${expectedSvg} SVG)  ${url}`);
      await renderPdf(browser, url, outFile, expectedSvg);
      chapterPdfs.push({ file: outFile, title: ch.title });
    }

    // 8. 合并 + 书签
    const finalPath = path.join(finalDir, `pi-agent-book-${variant}.pdf`);
    console.log(`\n→ 合并 + outline...`);
    const parts = [
      { file: coverPdf, title: '封面' },
      { file: tocPdf,  title: '目录' },
      ...chapterPdfs,
    ];
    await mergeWithOutline(parts, finalPath);

    const sizeKB = Math.round(fs.statSync(finalPath).size / 1024);
    console.log(`\n✓ 输出：${path.relative(process.cwd(), finalPath)}  (${sizeKB} KB)\n`);

  } catch (err) {
    console.error('\n✗ 渲染失败:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(3);
  } finally {
    if (browser) await browser.close();
    if (child) {
      console.log('→ 关闭 astro preview');
      child.kill();
    }
    // 清理 tmp（除非 --keep-tmp）
    if (!args.keepTmp) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    } else {
      console.log(`→ 保留 tmp: ${tmpDir}`);
    }
  }
}

main().catch(err => {
  console.error('✗ 未捕获错误:', err);
  process.exit(1);
});
