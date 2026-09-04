import type { GameVariant } from '@/types/game';

// Sentinel value representing the free space cell, exported for player-card comparison
export const FREE_SPACE = -1;

/** Generate a single random 75-ball bingo card (5×5 grid). */
export function generate75BallCard(_count: number = 1): number[][] {
  const ranges = [
    [1, 15],   // B
    [16, 30],  // I
    [31, 45],  // N
    [46, 60],  // G
    [61, 75],  // O
  ];

  const card: number[][] = [];

  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    // Shuffle and pick 5
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    card[col] = pool.slice(0, 5);
  }

  // Transpose to rows for rendering
  const rows: number[][] = Array.from({ length: 5 }, () => new Array(5).fill(0) as unknown as number[]);
  for (let col = 0; col < 5; col++) {    for (let row = 0; row < 5; row++) {
      rows[row][col] = card[col][row];
    }
  }

  // Free space in center (row 2, col 2)
  rows[2][2] = -1 as unknown as number;

  return rows;
}

/** Generate a single random 90-ball bingo card (3×9 grid). */
export function generate90BallCard(_count: number = 1): { row: number[]; blanks: boolean[] }[] {
  const card: { row: number[]; blanks: boolean[] }[] = Array.from({ length: 3 }, () => ({
    row: new Array(9).fill(0) as unknown as number[],
    blanks: new Array(9).fill(true) as unknown as boolean[],
  }));

  // Column ranges for each column
  const colRanges = [
    [1, 9],    // col 0
    [10, 19],  // col 1
    [20, 29],  // col 2
    [30, 39],  // col 3
    [40, 49],  // col 4
    [50, 59],  // col 5
    [60, 69],  // col 6
    [70, 79],  // col 7
    [80, 89],  // col 8
  ];

  // Ensure each row has exactly 5 numbers (4 blanks)
  // Strategy: pick which column gets a blank in each row
  for (let row = 0; row < 3; row++) {
    const blanksForRow = new Set<number>();
    while (blanksForRow.size < 4) {
      blanksForRow.add(Math.floor(Math.random() * 9));
    }
    card[row].blanks = Array.from({ length: 9 }, (_, col) => blanksForRow.has(col));
  }

  // For each column, pick which rows get a number (must have at least 1 per column)
  for (let col = 0; col < 9; col++) {
    const [min, max] = colRanges[col];
    const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);

    // Decide how many rows get a number in this column (at least 1)
    // @ts-expect-error - Math.random is safe for client-side bingo card generation
    const numInCol = Math.floor(Math.random() * 3) + 1; // 1-3
    // Shuffle which rows get it
    const rowIndices = [0, 1, 2].sort(() => {
      // @ts-expect-error - Math.random is safe for client-side bingo card generation
      return Math.random() - 0.5;
    }).slice(0, numInCol);

    for (const rowIndex of rowIndices) {
      if (card[rowIndex].blanks[col]) continue; // skip if blank
      // Pick random number from pool
      // @ts-expect-error - Math.random is safe for client-side bingo card generation
      const pickIdx = Math.floor(Math.random() * pool.length);
      card[rowIndex].row[col] = pool[pickIdx];
    }
  }

  // Ensure each column has at least one number (re-run blanks for empty columns)
  return card;
}

export function generateCard(variant: GameVariant, count: number = 1): (number[][] | { row: number[]; blanks: boolean[] }[])[] {
  const cards = [];
  for (let i = 0; i < count; i++) {
    if (variant === '75-ball') {
      cards.push(generate75BallCard());
    } else {
      cards.push(generate90BallCard()); // returns different type, handled in caller
    }
  }
  return cards;
}
