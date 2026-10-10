export interface BingoPatternDefinition {
  name: string;
  positionSets: readonly (readonly number[])[];
}

export const FREE_SPACE_POSITION = 13;

const FULL_CARD_POSITIONS = Array.from({ length: 25 }, (_, index) => index + 1);

export const BINGO_PATTERNS = {
  'single-row': {
    name: 'Single Row',
    positionSets: [
      [1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
      [11, 12, 13, 14, 15],
      [16, 17, 18, 19, 20],
      [21, 22, 23, 24, 25],
    ],
  },
  'single-column': {
    name: 'Single Column',
    positionSets: [
      [1, 6, 11, 16, 21],
      [2, 7, 12, 17, 22],
      [3, 8, 13, 18, 23],
      [4, 9, 14, 19, 24],
      [5, 10, 15, 20, 25],
    ],
  },
  'top-row': {
    name: 'Top Row',
    positionSets: [[1, 2, 3, 4, 5]],
  },
  'bottom-row': {
    name: 'Bottom Row',
    positionSets: [[21, 22, 23, 24, 25]],
  },
  'left-column': {
    name: 'Left Column',
    positionSets: [[1, 6, 11, 16, 21]],
  },
  'right-column': {
    name: 'Right Column',
    positionSets: [[5, 10, 15, 20, 25]],
  },
  'sint-andreas-cross': {
    name: 'Sint-Andreas Cross',
    positionSets: [[1, 5, 7, 9, 13, 17, 19, 21, 25]],
  },
  'full-card': {
    name: 'Full Card',
    positionSets: [FULL_CARD_POSITIONS],
  },
} satisfies Record<string, BingoPatternDefinition>;

export type BingoPattern = keyof typeof BINGO_PATTERNS;

export function getBingoPatternNumberCounts(pattern: BingoPattern): number[] {
  return Array.from(new Set(BINGO_PATTERNS[pattern].positionSets.map(
    (positions) => positions.filter((position) => position !== FREE_SPACE_POSITION).length,
  ))).sort((first, second) => first - second);
}