// 回归测试：确保合并 PDF 的中文书签能被 PDF 阅读器解析。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFArray, PDFDocument, PDFDict, PDFHexString, PDFName } from 'pdf-lib';
import { mergeWithOutline } from './build-pdf.mjs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-agent-pdf-outline-'));
const sourcePath = path.join(tempDir, 'source.pdf');
const outputPath = path.join(tempDir, 'merged.pdf');
const expectedTitle = '第1章：概览';

try {
  const source = await PDFDocument.create();
  source.addPage([595, 842]);
  fs.writeFileSync(sourcePath, await source.save());

  await mergeWithOutline([{ file: sourcePath, title: expectedTitle }], outputPath);

  const merged = await PDFDocument.load(fs.readFileSync(outputPath));
  const outlines = merged.catalog.lookup(PDFName.of('Outlines'), PDFDict);
  assert.ok(outlines, 'PDF 应包含可解析的 Outlines 根节点');
  const first = outlines.lookup(PDFName.of('First'), PDFDict);
  assert.ok(first, 'Outlines 应包含第一个书签节点');
  const title = first.lookup(PDFName.of('Title'), PDFHexString);
  assert.equal(title.decodeText(), expectedTitle, '中文书签标题应保持原文');
  const destination = first.lookup(PDFName.of('Dest'), PDFArray);
  assert.equal(destination.size(), 2, '书签应包含目标页引用和显示模式');
  assert.equal(
    destination.get(0).toString(),
    merged.getPage(0).ref.toString(),
    '书签目标页应指向合并 PDF 的对应页面',
  );
  console.log('[test:pdf-outline] 中文书签解析通过 ✅');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
