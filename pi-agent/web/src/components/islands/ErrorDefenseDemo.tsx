// src/components/islands/ErrorDefenseDemo.tsx
// S4 — three-layer error defense demo.
// Click a button to trigger a hypothetical error, see which layer (L1/L2/L3)
// catches it, how the error is encoded into a message, and whether the loop
// continues or exits.
import { useState } from 'react';
import EventTimeline, { type TimelineEvent } from './shared/EventTimeline';

type ErrorType = 'llm' | 'tool' | 'convert';

export interface Scenario {
  type: ErrorType;
  label: string;
  defense: 'L1' | 'L2' | 'L3';
  defenseDesc: string;
  encoding: string;
  loopContinues: boolean;
  events: TimelineEvent[];
}

const SCENARIOS: Scenario[] = [
  {
    type: 'llm',
    label: '触发 LLM 异常',
    defense: 'L1',
    defenseDesc: 'StreamFn 契约：LLM 抛错被捕获',
    encoding: 'AssistantMessage { stopReason: "error", error: ... }',
    loopContinues: false,
    events: [
      { id: 'stream-call', label: 'streamAssistant', type: 'tool' },
      { id: 'llm-throw', label: 'LLM throw', type: 'error' },
      { id: 'l1-catch', label: 'L1 编码 stopReason=error', type: 'milestone' },
      { id: 'loop-exit', label: 'Loop 退出', type: 'message' },
    ],
  },
  {
    type: 'tool',
    label: '触发工具抛错',
    defense: 'L2',
    defenseDesc: '工具错误编码：try/except 包裹工具执行',
    encoding: 'ToolResultMessage { isError: true, content: <error> }',
    loopContinues: true,
    events: [
      { id: 'tool-call', label: 'executeTool', type: 'tool' },
      { id: 'tool-throw', label: 'tool throw', type: 'error' },
      { id: 'l2-catch', label: 'L2 编码 isError=true', type: 'milestone' },
      { id: 'loop-continue', label: 'Loop 继续', type: 'message' },
    ],
  },
  {
    type: 'convert',
    label: '触发 convertToLlm 抛错',
    defense: 'L3',
    defenseDesc: 'Agent 兜底：转换层异常被视为致命',
    encoding: 'emit error 事件，session 终止',
    loopContinues: false,
    events: [
      { id: 'convert-call', label: 'convertToLlm', type: 'tool' },
      { id: 'convert-throw', label: 'convert throw', type: 'error' },
      { id: 'l3-catch', label: 'L3 兜底', type: 'milestone' },
      { id: 'session-abort', label: 'session 终止', type: 'message' },
    ],
  },
];

export default function ErrorDefenseDemo() {
  const [active, setActive] = useState<ErrorType | null>(null);
  const scenario = SCENARIOS.find((s) => s.type === active);

  return (
    <div className="loop-simulator" role="region" aria-label="三层错误防线演示">
      <h3 className="sim-title">🛡️ 三层错误防线</h3>
      <p className="sim-description">点击按钮触发不同类型的错误，看哪一层防线兜底。</p>
      <div className="error-buttons" role="group" aria-label="错误场景选择">
        {SCENARIOS.map((s) => (
          <button
            key={s.type}
            className={`err-btn ${active === s.type ? 'is-active' : ''}`}
            onClick={() => setActive(s.type)}
            aria-pressed={active === s.type}
          >
            {s.label}
          </button>
        ))}
      </div>
      {scenario && (
        <div className="error-result">
          <EventTimeline
            events={scenario.events}
            currentIdx={scenario.events.length - 1}
          />
          <table className="defense-table">
            <tbody>
              <tr><th scope="row">激活防线</th><td>{scenario.defense}</td></tr>
              <tr><th scope="row">防线说明</th><td>{scenario.defenseDesc}</td></tr>
              <tr><th scope="row">错误编码</th><td><code>{scenario.encoding}</code></td></tr>
              <tr>
                <th scope="row">Loop 是否继续</th>
                <td>{scenario.loopContinues ? '✓ 继续' : '✗ 退出'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
