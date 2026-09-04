interface BoardProps {
  readonly maxNumber: number;
  readonly drawnNumbers: readonly number[];
}

export function Board({ maxNumber, drawnNumbers }: BoardProps) {
  return (
    <div className="bingo-board" aria-label="Called bingo numbers">
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
  );
}
