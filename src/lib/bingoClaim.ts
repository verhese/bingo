import type { GameVariant } from '@/types/game';
import { VARIANTS } from '@/lib/variants';
import { getBingoPatternNumberCounts, type BingoPattern } from '@/lib/bingoPatterns';

export interface BingoClaimResult {
  claimedNumbers: number[];
  missingNumbers: number[];
  invalidNumbers: number[];
  requiredNumberCounts: number[];
  isVerified: boolean;
}

export function verifyBingoNumbers(
  claimedNumbers: readonly number[],
  drawnNumbers: readonly number[],
  variant: GameVariant,
  pattern: BingoPattern = 'single-row',
): BingoClaimResult {
  const maxNumber = VARIANTS[variant].maxNumber;
  const requiredNumberCounts = getBingoPatternNumberCounts(pattern);
  const invalidNumbers = claimedNumbers.filter(
    (number, index) => !Number.isInteger(number) || number < 1 || number > maxNumber || claimedNumbers.indexOf(number) !== index,
  );
  const missingNumbers = claimedNumbers.filter((number) => !drawnNumbers.includes(number));
  const hasRequiredUniqueNumbers = requiredNumberCounts.includes(claimedNumbers.length)
    && new Set(claimedNumbers).size === claimedNumbers.length;

  return {
    claimedNumbers: [...claimedNumbers],
    missingNumbers,
    invalidNumbers,
    requiredNumberCounts,
    isVerified: hasRequiredUniqueNumbers && invalidNumbers.length === 0 && missingNumbers.length === 0,
  };
}

export function verifyBingoClaim(
  claim: string,
  drawnNumbers: readonly number[],
  variant: GameVariant,
  pattern: BingoPattern = 'single-row',
): BingoClaimResult {
  const values = claim.match(/\d+/g) ?? [];
  const claimedNumbers = values.map(Number);
  return verifyBingoNumbers(claimedNumbers, drawnNumbers, variant, pattern);
}