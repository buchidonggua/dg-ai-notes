// src/components/islands/shared/MessageCard.tsx
// Shared message snapshot viewer — shows JSON dump of message state.
// Reused by S1 AgentLoopSimulator, S3 PartialMessageTimeline.

interface Props {
  title: string;
  data: object;
}

export default function MessageCard({ title, data }: Props) {
  return (
    <div className="message-card" role="region" aria-label={title}>
      <div className="message-card-title">{title}</div>
      <pre><code>{JSON.stringify(data, null, 2)}</code></pre>
    </div>
  );
}
