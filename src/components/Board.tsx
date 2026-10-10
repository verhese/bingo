interface BoardProps {
  readonly maxNumber: number;
  readonly drawnNumbers: readonly number[];
  readonly undoneNumbers?: readonly number[];
  readonly verifiedBingo?: readonly number[] | null;
  readonly stageStatus?: React.ReactNode;
}

export function Board({ maxNumber, drawnNumbers, undoneNumbers = [], verifiedBingo, stageStatus }: BoardProps) {
  const layoutClass = maxNumber === 90
    ? 'bingo-board--90'
    : maxNumber === 75
      ? 'bingo-board--75'
      : 'bingo-board--speedy';

  return (
    <section className="bingo-board-section" aria-label="Called bingo numbers">
      <div className="bingo-board-header">
        {verifiedBingo ? (
          <div className="bingo-announcement" role="alert">
            <strong>BINGO!</strong>
            <span>{verifiedBingo.join(', ')}</span>
          </div>
        ) : stageStatus}
      </div>
      <ol className={`bingo-board ${layoutClass}`} aria-label="Number board">
        {Array.from({ length: maxNumber }, (_, i) => i + 1).map((n) => {
          const drawn = drawnNumbers.includes(n);
          const undone = undoneNumbers.includes(n);
          return (
            <li
              key={n}
              className={`bingo-board-cell${drawn ? ' is-drawn' : ''}${undone ? ' is-undone' : ''}`}
              aria-label={`Number ${n}, ${undone ? 'call undone' : drawn ? 'called' : 'not called'}`}
            >
              {n}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
