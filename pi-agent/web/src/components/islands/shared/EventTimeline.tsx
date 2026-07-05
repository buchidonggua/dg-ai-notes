// src/components/islands/shared/EventTimeline.tsx
// Shared timeline primitive — renders a horizontal list of events.
// Reused by S1 AgentLoopSimulator, S3 PartialMessageTimeline, S4 ErrorDefenseDemo.

export interface TimelineEvent {
  id: string;
  label: string;
  type: 'message' | 'tool' | 'error' | 'milestone';
}

interface Props {
  events: TimelineEvent[];
  currentIdx: number;
  onSelect?: (idx: number) => void;
}

export default function EventTimeline({ events, currentIdx, onSelect }: Props) {
  return (
    <div className="event-timeline" role="list" aria-label="事件时间轴">
      {events.map((ev, i) => (
        <button
          key={ev.id}
          className={`event-tick ${i === currentIdx ? 'is-current' : ''} type-${ev.type}`}
          onClick={() => onSelect?.(i)}
          aria-label={`事件 ${i + 1}: ${ev.label}`}
          aria-current={i === currentIdx ? 'step' : undefined}
          role="listitem"
        >
          <span className="event-dot" aria-hidden="true" />
          <span className="event-label">{ev.label}</span>
        </button>
      ))}
    </div>
  );
}
