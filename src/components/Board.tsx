interface BoardProps {
  readonly maxNumber: number;
  readonly drawnNumbers: readonly number[];
  readonly verifiedBingo?: readonly number[] | null;
}

export function Board({ maxNumber, drawnNumbers, verifiedBingo }: BoardProps) {
  return (
    <section className="bingo-board-section" aria-label="Called bingo numbers">
      {verifiedBingo && (
        <div className="bingo-announcement" role="alert">
          <strong>BINGO!</strong>
          <span>Verified winning line: {verifiedBingo.join(', ')}</span>
        </div>
      )}
      <div className="bingo-board">
        {Array.from({ length: maxNumber }, (_, i) => i + 1).map((n) => {
          const drawn = drawnNumbers.includes(n);
          return (
            <span
              key={n}
              className={`bingo-board-cell${drawn ? ' is-drawn' : ''}`}
            >
              {n}
            </span>
          );
        })}
      </div>
    </section>
  );
}
