/*!
 * diagram-linker.js — S2 图与代码联动
 * -------------------------------------------------------------
 * 功能：
 *   1. 点击 SVG 内带 [data-anchor="<nodeId>"] 的元素 → 平滑滚动到对应代码块，
 *      并给代码块加 .is-highlighted（3s 后自动移除）。
 *   2. 代码块进入视口中段时（IntersectionObserver，rootMargin -40%/-40%）→
 *      SVG 内对应的 [data-anchor] 元素加 .is-active，其余 .is-active 移除。
 *
 * 数据源：页面里 <script type="application/json" id="diagram-anchors"> 内联的 JSON，
 *        形如 { diagramId: { nodeId: "codeBlockId", ... }, ... }。
 *        该 JSON 由 ModuleLayout.astro 从 entry.data.diagrams[].anchors 序列化注入。
 *
 * 依赖：Vanilla JS，无外部库。Astro 视图转换时会触发 astro:page-load 重新绑定。
 * 兼容：现代浏览器（Chromium/Firefox/Safari/Edge 最近 2 年版本）。
 */
(function () {
  'use strict';

  function setupLinker() {
    // 1. 读取页面内联的 anchors 配置
    var anchorsEl = document.getElementById('diagram-anchors');
    if (!anchorsEl) return;

    var anchorsText = anchorsEl.textContent || '{}';
    var anchors;
    try {
      anchors = JSON.parse(anchorsText);
    } catch (err) {
      // 配置损坏，静默退出（开发期可 console.warn）
      if (window.console && console.warn) {
        console.warn('[diagram-linker] diagram-anchors JSON parse failed:', err);
      }
      return;
    }

    // 2. 为每个 diagram 绑定联动
    Object.keys(anchors || {}).forEach(function (diagramId) {
      var mapping = anchors[diagramId] || {};
      var diagram = document.querySelector('[data-diagram-id="' + cssEscape(diagramId) + '"]');
      if (!diagram) return;

      var nodeIds = Object.keys(mapping);
      var codeIds = nodeIds.map(function (nid) { return mapping[nid]; });

      // 检查 SVG 是否已内联（必须能查到 [data-anchor] 才有意义绑定）
      // 若未内联，跳过本次绑定（不设 linkerBound），等 diagram:inline 事件后重试
      var hasAnchorNodes = false;
      nodeIds.forEach(function (nodeId) {
        if (diagram.querySelector('[data-anchor="' + cssEscape(nodeId) + '"]')) {
          hasAnchorNodes = true;
        }
      });
      if (!hasAnchorNodes) return;

      // —— 正向：点击 SVG 元素 → 滚动到代码块 ——
      nodeIds.forEach(function (nodeId) {
        var codeId = mapping[nodeId];
        var svgEls = diagram.querySelectorAll('[data-anchor="' + cssEscape(nodeId) + '"]');
        Array.prototype.forEach.call(svgEls, function (el) {
          el.style.cursor = 'pointer';
          el.addEventListener('click', function () {
            var target = document.getElementById(codeId);
            if (!target) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('is-highlighted');
            window.setTimeout(function () {
              target.classList.remove('is-highlighted');
            }, 3000);
          });
        });
      });

      // —— 反向：代码块进入视口中段 → 对应 SVG 元素加 .is-active ——
      //    rootMargin -40%/-40% 让"触发线"位于视口纵向中段（40% 处）。
      if (typeof IntersectionObserver === 'undefined') return;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var codeId = e.target.id;
          // 反查 nodeId
          var nodeId = null;
          for (var i = 0; i < nodeIds.length; i++) {
            if (mapping[nodeIds[i]] === codeId) { nodeId = nodeIds[i]; break; }
          }
          if (!nodeId) return;
          // 清除同图内其它 .is-active
          var prevActive = diagram.querySelectorAll('.is-active');
          Array.prototype.forEach.call(prevActive, function (n) {
            n.classList.remove('is-active');
          });
          // 高亮当前
          var current = diagram.querySelectorAll('[data-anchor="' + cssEscape(nodeId) + '"]');
          Array.prototype.forEach.call(current, function (n) {
            n.classList.add('is-active');
          });
        });
      }, { rootMargin: '-40% 0px -40% 0px' });

      codeIds.forEach(function (codeId) {
        var el = document.getElementById(codeId);
        if (el) observer.observe(el);
      });

      // 标记此 diagram 已绑定（供 setupLinkerSafe 去重）
      diagram.dataset.linkerBound = '1';
    });
  }

  // —— 工具：CSS.escape polyfill（应对 id 中可能出现的特殊字符）——
  function cssEscape(s) {
    if (typeof window.CSS !== 'undefined' && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(s);
    }
    // 简易回退：仅处理双引号和反斜杠
    return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  // 初始绑定 + Astro 视图转换后重新绑定 + SVG 内联完成后重新绑定
  // 注意：setupLinker 每次执行都会新增事件监听器，为避免重复绑定，
  //       我们用 dataset 标记已经绑定过的 diagram，跳过它。
  function setupLinkerSafe() {
    var diagrams = document.querySelectorAll('[data-diagram-id]');
    var anyUnbound = false;
    for (var i = 0; i < diagrams.length; i++) {
      if (!diagrams[i].dataset.linkerBound) { anyUnbound = true; break; }
    }
    if (!anyUnbound) return;
    setupLinker();
  }

  setupLinkerSafe();
  document.addEventListener('astro:page-load', setupLinkerSafe);
  // SVG 内联完成后（Diagram.astro 的 inlineSvgDiagrams dispatch 此事件）重新绑定
  document.addEventListener('diagram:inline', setupLinkerSafe);
})();
