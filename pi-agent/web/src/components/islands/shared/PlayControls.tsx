// src/components/islands/shared/PlayControls.tsx
// Shared play/pause/step/reset control cluster.
// Reused by S1 AgentLoopSimulator, S3 PartialMessageTimeline.

interface Props {
  isPlaying: boolean;
  onPlay: () => void;
  onStep: () => void;
  onReset: () => void;
}

export default function PlayControls({ isPlaying, onPlay, onStep, onReset }: Props) {
  return (
    <div className="play-controls" role="group" aria-label="播放控制">
      <button
        onClick={onPlay}
        aria-label={isPlaying ? '暂停' : '播放'}
        className="pc-btn pc-play"
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button
        onClick={onStep}
        aria-label="单步前进"
        className="pc-btn pc-step"
      >
        ⏭
      </button>
      <button
        onClick={onReset}
        aria-label="重置"
        className="pc-btn pc-reset"
      >
        ↺
      </button>
    </div>
  );
}
