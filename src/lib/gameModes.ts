import { BINGO_PATTERNS, type BingoPattern } from '@/lib/bingoPatterns';

export interface GameMode {
  id: string;
  name: string;
  patterns: BingoPattern[];
}

export const BUILT_IN_GAME_MODES: readonly GameMode[] = [
  { id: 'single-row', name: 'Single Row', patterns: ['single-row'] },
  {
    id: 'standard',
    name: 'Standard',
    patterns: ['top-row', 'bottom-row', 'sint-andreas-cross', 'full-card'],
  },
];

export function isBingoPattern(value: unknown): value is BingoPattern {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BINGO_PATTERNS, value);
}

export function createCustomGameMode(
  name: unknown,
  patterns: unknown,
  existingModes: readonly GameMode[],
): { mode: GameMode } | { error: string } {
  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 40) {
    return { error: 'Enter a game mode name from 1 to 40 characters.' };
  }
  if (
    !Array.isArray(patterns)
    || patterns.length === 0
    || patterns.some((pattern) => !isBingoPattern(pattern))
    || new Set(patterns).size !== patterns.length
  ) {
    return { error: 'Select one or more unique available patterns.' };
  }

  const normalizedName = name.trim();
  if (existingModes.some((mode) => mode.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
    return { error: 'A game mode with that name already exists.' };
  }

  const slug = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mode';
  const baseId = `custom-${slug}`;
  let id = baseId;
  let suffix = 2;
  while (existingModes.some((mode) => mode.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return { mode: { id, name: normalizedName, patterns: [...patterns] } };
}

export function getGameMode(
  id: string,
  customModes: readonly GameMode[],
): GameMode {
  return BUILT_IN_GAME_MODES.find((mode) => mode.id === id)
    ?? customModes.find((mode) => mode.id === id)
    ?? BUILT_IN_GAME_MODES[0];
}
