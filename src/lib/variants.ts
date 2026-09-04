import type { GameVariant, VariantConfig } from '@/types/game';

export const VARIANTS: Record<GameVariant, VariantConfig> = {
  '90-ball': { name: '90-ball', maxNumber: 90, cardsPerGame: 50 },
  '75-ball': { name: '75-ball', maxNumber: 75, cardsPerGame: 50 },
  speedy: { name: 'speedy', maxNumber: 30, cardsPerGame: 50, drawIntervalMs: 8000 },
};

export function getVariant(name: GameVariant): VariantConfig | undefined {
  return VARIANTS[name];
}
