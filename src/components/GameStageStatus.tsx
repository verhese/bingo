import { BINGO_PATTERNS } from '@/lib/bingoPatterns';
import { getGameModeStages } from '@/lib/gameModes';
import type { GameState } from '@/types/game';

interface GameStageStatusProps {
  readonly state: GameState | null | undefined;
}

export function GameStageStatus({ state }: GameStageStatusProps) {
  if (!state || state.variant !== '75-ball') return null;

  const stages = getGameModeStages(state.mode);
  const activeStageIndex = Math.max(0, Math.min(state.stageIndex, stages.length - 1));
  const activeStage = stages[activeStageIndex];

  return (
    <section className="game-stage-status" aria-live="polite" aria-atomic="true">
      {state.status === 'complete' ? (
        <strong>Game complete</strong>
      ) : activeStage ? (
        <strong>Stage {activeStageIndex + 1}/{stages.length}: {BINGO_PATTERNS[activeStage].name}</strong>
      ) : null}
      {state.completedStages.length > 0 && (
        <span>Completed: {state.completedStages.map((stage) => BINGO_PATTERNS[stage].name).join(', ')}</span>
      )}
    </section>
  );
}
