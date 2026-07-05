// public/js/diagram-linker.js
// S2 双向联动运行时（Phase 4-B MVP）
//
// 职责：
//   1. 监听 DiagramLightbox 的 `diagram:inline` 事件 → 给 SVG 内 [data-anchor] 节点绑 click
//   2. 点击 SVG 节点 → 滚动到对应 #id 锚点 + 高亮紧邻的 <pre> 1.5s
//   3. IntersectionObserver 监听 span.s2-anchor → 进入视口时给对应 SVG 节点加 .s2-active
//
// 锚点约定：
//   SVG 节点：<rect data-anchor="s2-ch05-step1" ...>
//   mdx 内  ：<span id="s2-ch05-step1" class="s2-anchor" /> 紧贴目标代码块之前
//
// 页面切换兼容：监听 astro:page-load 重新观察代码块锚点（View Transitions）

(function () {
  'use strict';

  let observer = null;

  // SVG 内联完成后 DiagramLightbox dispatch 此事件（不带 detail）
  // 每次 fire 都扫一遍文档内所有 inline SVG 的 [data-anchor]，幂等绑定
  document.addEventListener('diagram:inline', () => {
    document.querySelectorAll('svg.diagram-inline-svg').forEach(bindSvgClicks);
  });

  // Astro View Transitions 页面切换后重新观察
  document.addEventListener('astro:page-load', () => {
    observeCodeBlocks();
    // page-load 后 DiagramLightbox 会重新跑 inlineSvgDiagrams，触发 diagram:inline
  });

  // 初始 DOMContentLoaded（无 View Transitions 的首次进入）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeCodeBlocks);
  } else {
    observeCodeBlocks();
  }

  // ---- click：SVG 节点 → 滚动到代码块 ----
  function bindSvgClicks(svg) {
    const nodes = svg.querySelectorAll('[data-anchor]');
    nodes.forEach((node) => {
      if (node.__s2Bound) return;
      node.__s2Bound = true;
      node.style.cursor = 'pointer';
      node.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = node.dataset.anchor;
        const target = document.getElementById(id);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // 找 span 之后最近的代码块容器（.code-block div 或 <pre>）里的 pre
        let next = target.nextElementSibling;
        while (next) {
          if (next.tagName === 'PRE' || next.classList?.contains('code-block')) break;
          next = next.nextElementSibling;
        }
        const pre = next && (next.tagName === 'PRE' ? next : next.querySelector('pre'));
        if (pre) {
          pre.classList.add('s2-highlight');
          window.setTimeout(() => pre.classList.remove('s2-highlight'), 1500);
        }
      });
    });
  }

  // ---- observe：代码块进入视口 → SVG 节点发光 ----
  // 注意：span.s2-anchor 高度为 0，IntersectionObserver 看不到它。
  // 改为观察 span 的下一个兄弟（通常是 <pre> 代码块），用 span.id 关联 SVG 节点。
  function observeCodeBlocks() {
    if (observer) observer.disconnect();
    const spans = document.querySelectorAll('span.s2-anchor');
    if (!spans.length) return;
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // 找到代码块对应的 span id（pre 上挂着 data-s2-for 记录）
          const id = entry.target.dataset.s2For;
          if (!id) return;
          const svgNode = document.querySelector('[data-anchor="' + CSS.escape(id) + '"]');
          if (!svgNode) return;
          svgNode.classList.toggle('s2-active', entry.isIntersecting);
        });
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: 0 }
    );
    spans.forEach((span) => {
      // 找 span 之后最近的代码块容器（CodeBlock 组件渲染为 .code-block div）
      let next = span.nextElementSibling;
      while (next) {
        if (next.tagName === 'PRE' || next.classList?.contains('code-block')) break;
        next = next.nextElementSibling;
      }
      if (!next) return;
      next.dataset.s2For = span.id;
      observer.observe(next);
    });
  }
})();
