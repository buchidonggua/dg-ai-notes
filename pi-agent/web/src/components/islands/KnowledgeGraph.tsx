// src/components/islands/KnowledgeGraph.tsx
// S5 — Interactive knowledge graph showing M01-M12 module dependencies.
// Reads static data from module-graph.ts; hydrates lazily via client:visible.
import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { moduleNodes, moduleEdges, type ModuleNode } from '../../data/module-graph';

const NODE_R = 28;
const W = 1000;
const H = 600;

/** Edge lookup: which edges touch a given module id. */
function edgesTouching(moduleId: string) {
  return moduleEdges.filter((e) => e.from === moduleId || e.to === moduleId);
}

/** Returns true if the edge is related to the hovered node. */
function isEdgeHighlighted(edge: { from: string; to: string }, moduleId: string | null) {
  if (!moduleId) return false;
  return edge.from === moduleId || edge.to === moduleId;
}

/** Returns true if a node is a neighbour of the given module id (via edges). */
function isNodeNeighbour(nodeModule: string, moduleId: string | null) {
  if (!moduleId) return false;
  return moduleEdges.some(
    (e) =>
      (e.from === moduleId && e.to === nodeModule) ||
      (e.to === moduleId && e.from === nodeModule),
  );
}

export default function KnowledgeGraph() {
  const [hovered, setHovered] = useState<ModuleNode | null>(null);
  const [focused, setFocused] = useState<ModuleNode | null>(null);
  const [readModules, setReadModules] = useState<Set<string>>(new Set());
  const [reducedMotion, setReducedMotion] = useState(false);
  const nodeRefs = useRef<Map<string, SVGGElement>>(new Map());

  // Load "read" status from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('pi-agent-book:read') || '[]');
      setReadModules(new Set(stored));
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // Respect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // The "active" node is either focused (keyboard) or hovered (mouse).
  const active = focused ?? hovered;

  const statusFill = (n: ModuleNode): string => {
    if (active && (active.module === n.module || isNodeNeighbour(n.module, active.module))) {
      return 'var(--accent-soft)';
    }
    if (readModules.has(n.slug)) return 'var(--accent)';
    if (n.status === 'published') return 'var(--paper-raised)';
    if (n.status === 'draft') return 'var(--paper-sunken)';
    return 'var(--paper-sunken)';
  };

  const statusStroke = (n: ModuleNode): string => {
    if (active?.module === n.module) return 'var(--accent)';
    if (readModules.has(n.slug)) return 'var(--accent)';
    if (n.status === 'published') return 'var(--rule-strong)';
    return 'var(--rule)';
  };

  const nodeOpacity = (n: ModuleNode): number => {
    if (!active) return 1;
    if (active.module === n.module) return 1;
    if (isNodeNeighbour(n.module, active.module)) return 0.8;
    return 0.35;
  };

  const edgeOpacity = (edge: { from: string; to: string }): number => {
    if (!active) return 0.6;
    return isEdgeHighlighted(edge, active.module) ? 1 : 0.15;
  };

  const edgeStroke = (edge: { from: string; to: string }): string => {
    if (active && isEdgeHighlighted(edge, active.module)) return 'var(--accent)';
    return 'var(--rule-strong)';
  };

  // Keyboard: Arrow keys move between nodes along edges.
  const handleKeyDown = (e: React.KeyboardEvent, node: ModuleNode) => {
    const neighbours = moduleEdges
      .filter((edge) => edge.from === node.module || edge.to === node.module)
      .map((edge) => (edge.from === node.module ? edge.to : edge.from));
    const neighbourNodes = moduleNodes.filter((n) => neighbours.includes(n.module));

    // Defensive guard: if neighbourNodes is empty (isolated node), bail out.
    if (neighbourNodes.length === 0) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateTo(node);
      }
      return;
    }

    // Determine the effective focus source: the current focused node
    // if it is among the neighbours, otherwise fall back to the node
    // that triggered this keydown (avoids -1 findIndex edge cases).
    const effectiveFocus =
      focused && neighbourNodes.some((n) => n.module === focused.module) ? focused : node;

    let target: ModuleNode | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      // Next neighbour in array order
      const currentIdx = neighbourNodes.findIndex((n) => n.module === effectiveFocus.module);
      target = neighbourNodes[(currentIdx + 1) % neighbourNodes.length] ?? neighbourNodes[0];
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      const currentIdx = neighbourNodes.findIndex((n) => n.module === effectiveFocus.module);
      target =
        neighbourNodes[(currentIdx - 1 + neighbourNodes.length) % neighbourNodes.length] ??
        neighbourNodes[0];
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigateTo(node);
      return;
    } else if (e.key === 'Tab') {
      // Let default Tab proceed; clear focus when leaving.
      return;
    }

    if (target) {
      e.preventDefault();
      setFocused(target);
      const el = nodeRefs.current.get(target.module);
      el?.focus();
    }
  };

  const navigateTo = (node: ModuleNode) => {
    if (node.status === 'published') {
      window.location.href = `/modules/${node.slug}`;
    }
  };

  const transitionStyle = reducedMotion
    ? 'none'
    : 'opacity var(--dur-base) var(--ease), fill var(--dur-fast) var(--ease), stroke var(--dur-fast) var(--ease)';

  return (
    <div className="kg-container">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="kg-svg"
        role="application"
        aria-label="Pi Agent 模块依赖图：M01 至 M12 共 12 个模块，箭头表示依赖方向。使用 Tab 键在节点间移动，方向键切换相邻节点，回车进入模块。"
        aria-describedby="kg-sr-list"
      >
        <defs>
          <marker
            id="kg-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--rule-strong)" />
          </marker>
          <marker
            id="kg-arrow-active"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
          </marker>
        </defs>

        {/* Edges */}
        {moduleEdges.map((e, i) => {
          const from = moduleNodes.find((n) => n.module === e.from)!;
          const to = moduleNodes.find((n) => n.module === e.to)!;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const ux = dx / dist;
          const uy = dy / dist;
          const highlighted = active ? isEdgeHighlighted(e, active.module) : false;
          return (
            <line
              key={`edge-${i}`}
              x1={from.x + ux * NODE_R}
              y1={from.y + uy * NODE_R}
              x2={to.x - ux * NODE_R}
              y2={to.y - uy * NODE_R}
              stroke={edgeStroke(e)}
              strokeWidth={highlighted ? '2.5' : '1.5'}
              strokeOpacity={edgeOpacity(e)}
              markerEnd={highlighted ? 'url(#kg-arrow-active)' : 'url(#kg-arrow)'}
              style={{ transition: transitionStyle }}
            />
          );
        })}

        {/* Nodes */}
        {moduleNodes.map((n) => (
          <g
            key={n.slug}
            ref={(el) => {
              if (el) {
                nodeRefs.current.set(n.module, el);
              } else {
                nodeRefs.current.delete(n.module);
              }
            }}
            transform={`translate(${n.x}, ${n.y})`}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setFocused(n)}
            onClick={() => navigateTo(n)}
            onKeyDown={(e) => handleKeyDown(e, n)}
            tabIndex={0}
            role="link"
            aria-label={`${n.module}：${n.title}。状态：${n.status === 'published' ? '已发布，可点击进入' : '草稿'}`}
            style={
              {
                cursor: n.status === 'published' ? 'pointer' : 'default',
                opacity: nodeOpacity(n),
                transition: transitionStyle,
                outline: 'none',
              } as CSSProperties
            }
          >
            <circle
              r={NODE_R}
              fill={statusFill(n)}
              stroke={statusStroke(n)}
              strokeWidth={active?.module === n.module ? '3' : '2'}
            />
            <text
              textAnchor="middle"
              dy="0.35em"
              fontFamily="var(--font-mono)"
              fontSize="13"
              fill={readModules.has(n.slug) ? 'var(--paper)' : 'var(--ink-strong)'}
              pointerEvents="none"
            >
              {n.module}
            </text>
          </g>
        ))}
      </svg>

      {/* Tooltip / detail card */}
      {(hovered ?? focused) && (
        <div className="kg-tooltip" role="status">
          <div className="kg-tooltip-module">{(hovered ?? focused)!.module}</div>
          <div className="kg-tooltip-title">{(hovered ?? focused)!.title}</div>
          <div className="kg-tooltip-summary">{(hovered ?? focused)!.summary}</div>
          <div className="kg-tooltip-status">{(hovered ?? focused)!.status}</div>
        </div>
      )}

      {/* Screen-reader fallback: full list */}
      <ul id="kg-sr-list" className="kg-sr-only">
        {moduleNodes.map((n) => (
          <li key={n.slug}>
            {n.module}：{n.title} — {n.summary}（{n.status}）
          </li>
        ))}
      </ul>

      {/* Inline styles — kept here so the Island is self-contained. */}
      <style>{`
        .kg-container {
          position: relative;
          max-width: 1000px;
          margin: 0 auto;
        }
        .kg-svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .kg-svg:focus-within {
          outline: var(--outline-w) solid var(--accent);
          outline-offset: var(--hl-outline-offset);
          border-radius: var(--radius-md);
        }
        .kg-tooltip {
          position: absolute;
          top: 20px;
          left: 20px;
          background: var(--paper-raised);
          border: var(--border-w) solid var(--rule);
          border-radius: var(--radius-md);
          padding: var(--space-4);
          box-shadow: var(--shadow-2);
          max-width: 280px;
          pointer-events: none;
          z-index: 10;
        }
        .kg-tooltip-module {
          font-family: var(--font-mono);
          color: var(--accent);
          font-size: var(--fs-xs);
        }
        .kg-tooltip-title {
          font-size: var(--fs-h3);
          color: var(--ink-strong);
          margin: var(--space-1) 0;
        }
        .kg-tooltip-summary {
          font-size: var(--fs-small);
          color: var(--muted);
        }
        .kg-tooltip-status {
          font-size: var(--fs-xs);
          color: var(--soft);
          margin-top: var(--space-2);
          text-transform: uppercase;
        }
        .kg-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .kg-svg * {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
