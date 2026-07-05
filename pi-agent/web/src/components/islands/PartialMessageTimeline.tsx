// src/components/islands/PartialMessageTimeline.tsx
// S3 — partial message replacement visualizer.
// Shows how streaming deltas (text_delta, toolcall_delta) progressively
// mutate context.messages[-1] in place until message_stop finalizes it.
import { useState, useEffect } from 'react';
import EventTimeline, { type TimelineEvent } from './shared/EventTimeline';
import PlayControls from './shared/PlayControls';
import MessageCard from './shared/MessageCard';

export interface Tick {
  event: TimelineEvent;
  partialMessage: object;
}

const TICKS: Tick[] = [
  {
    event: { id: 'start', label: 'message_start', type: 'message' },
    partialMessage: { role: 'assistant', content: '', partial: true },
  },
  {
    event: { id: 'text-1', label: 'text_delta ×3', type: 'tool' },
    partialMessage: { role: 'assistant', content: '好的，我先', partial: true },
  },
  {
    event: { id: 'tool-delta', label: 'toolcall_delta', type: 'tool' },
    partialMessage: {
      role: 'assistant',
      content: '好的，我先读文件',
      toolCalls: [{ name: 'read_file', args: { path: 'agent-loop.ts' }, partial: true }],
      partial: true,
    },
  },
  {
    event: { id: 'done', label: 'message_stop', type: 'milestone' },
    partialMessage: {
      role: 'assistant',
      content: '好的，我先读文件',
      toolCalls: [{ name: 'read_file', args: { path: 'agent-loop.ts' } }],
      stopReason: 'tool_use',
    },
  },
];

export default function PartialMessageTimeline() {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setIdx((i) => {
        if (i >= TICKS.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [playing, idx]);

  return (
    <div className="loop-simulator" role="region" aria-label="partial message 替换演示">
      <h3 className="sim-title">🎬 partial message 原地替换</h3>
      <p className="sim-description">
        拖动游标或点击播放，观察 <code>context.messages[-1]</code> 如何被流式事件逐步填充。
      </p>
      <EventTimeline
        events={TICKS.map((t) => t.event)}
        currentIdx={idx}
        onSelect={setIdx}
      />
      <PlayControls
        isPlaying={playing}
        onPlay={() => setPlaying((p) => !p)}
        onStep={() => setIdx((i) => Math.min(TICKS.length - 1, i + 1))}
        onReset={() => {
          setPlaying(false);
          setIdx(0);
        }}
      />
      <div className="sim-messages" style={{ marginTop: 'var(--space-4)' }}>
        <MessageCard title="context.messages[-1]" data={TICKS[idx].partialMessage} />
      </div>
    </div>
  );
}
