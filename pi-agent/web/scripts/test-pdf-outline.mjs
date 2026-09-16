// 回归测试：确保合并 PDF 的中文书签能被 PDF 阅读器解析。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PDFArray,
  PDFDocument,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFString,
} from 'pdf-lib';
import { mergeWithOutline } from './build-pdf.mjs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-agent-pdf-outline-'));
const tocSourcePath = path.join(tempDir, 'toc-source.pdf');
const chapterSourcePath = path.join(tempDir, 'chapter-source.pdf');
const outputPath = path.join(tempDir, 'merged.pdf');
const expectedTitle = '第1章：概览';

try {
  const tocSource = await PDFDocument.create();
  const tocPage = tocSource.addPage([595, 842]);
  const link = tocSource.context.register(tocSource.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [0, 0, 200, 40],
    Border: [0, 0, 0],
    A: {
      S: 'URI',
      URI: PDFString.of('http://localhost:4321/modules/ch01-overview'),
    },
  }));
  tocPage.node.set(PDFName.of('Annots'), tocSource.context.obj([link]));
  fs.writeFileSync(tocSourcePath, await tocSource.save());

  const chapterSource = await PDFDocument.create();
  chapterSource.addPage([595, 842]);
  fs.writeFileSync(chapterSourcePath, await chapterSource.save());

  await mergeWithOutline([
    {
      file: tocSourcePath,
      title: '目录',
      internalLinks: { '/modules/ch01-overview': expectedTitle },
    },
    { file: chapterSourcePath, title: expectedTitle },
  ], outputPath);

  const merged = await PDFDocument.load(fs.readFileSync(outputPath));
  const outlines = merged.catalog.lookup(PDFName.of('Outlines'), PDFDict);
  assert.ok(outlines, 'PDF 应包含可解析的 Outlines 根节点');
  const first = outlines.lookup(PDFName.of('First'), PDFDict);
  assert.ok(first, 'Outlines 应包含第一个书签节点');
  const firstTitle = first.lookup(PDFName.of('Title'), PDFHexString);
  assert.equal(firstTitle.decodeText(), '目录', '第一个书签应是目录');
  const chapter = first.lookup(PDFName.of('Next'), PDFDict);
  assert.ok(chapter, 'Outlines 应包含章节书签节点');
  const title = chapter.lookup(PDFName.of('Title'), PDFHexString);
  assert.equal(title.decodeText(), expectedTitle, '中文书签标题应保持原文');
  const destination = chapter.lookup(PDFName.of('Dest'), PDFArray);
  assert.equal(destination.size(), 2, '书签应包含目标页引用和显示模式');
  assert.equal(
    destination.get(0).toString(),
    merged.getPage(1).ref.toString(),
    '书签目标页应指向合并 PDF 的对应页面',
  );

  const tocAnnots = merged.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray);
  assert.ok(tocAnnots, '目录页应包含章节链接');
  const tocLink = merged.context.lookup(tocAnnots.get(0), PDFDict);
  assert.equal(tocLink.get(PDFName.of('A')), undefined, '目录章节不应保留 localhost 外链');
  const tocDestination = tocLink.lookup(PDFName.of('Dest'), PDFArray);
  assert.equal(tocDestination.size(), 2, '目录章节应包含内部目标页引用');
  assert.equal(
    tocDestination.get(0).toString(),
    merged.getPage(1).ref.toString(),
    '目录章节应指向对应章节页',
  );
  console.log('[test:pdf-outline] 中文书签解析通过 ✅');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
