import type { GameVariant } from '@/types/game';
import { VARIANTS } from '@/lib/variants';

export interface BingoClaimResult {
  claimedNumbers: number[];
  missingNumbers: number[];
  invalidNumbers: number[];
  isVerified: boolean;
}

export function verifyBingoNumbers(
  claimedNumbers: readonly number[],
  drawnNumbers: readonly number[],
  variant: GameVariant,
): BingoClaimResult {
  const maxNumber = VARIANTS[variant].maxNumber;
  const invalidNumbers = claimedNumbers.filter(
    (number, index) => !Number.isInteger(number) || number < 1 || number > maxNumber || claimedNumbers.indexOf(number) !== index,
  );
  const missingNumbers = claimedNumbers.filter((number) => !drawnNumbers.includes(number));
  const hasFiveUniqueNumbers = claimedNumbers.length === 5 && new Set(claimedNumbers).size === 5;

  return {
    claimedNumbers: [...claimedNumbers],
    missingNumbers,
    invalidNumbers,
    isVerified: hasFiveUniqueNumbers && invalidNumbers.length === 0 && missingNumbers.length === 0,
  };
}

export function verifyBingoClaim(
  claim: string,
  drawnNumbers: readonly number[],
  variant: GameVariant,
): BingoClaimResult {
  const values = claim.match(/\d+/g) ?? [];
  const claimedNumbers = values.map(Number);
  return verifyBingoNumbers(claimedNumbers, drawnNumbers, variant);
}