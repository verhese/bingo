export function generateAllNumbers(maxNumber: number): number[] {
  return Array.from({ length: maxNumber }, (_, i) => i + 1);
}

export function getNextNumber(
  allNumbers: number[],
  drawnNumbers: number[],
): number | null {
  const remaining = allNumbers.filter((n) => !drawnNumbers.includes(n));
  if (remaining.length === 0) return null;
  const index = Math.floor(Math.random() * remaining.length);
  return remaining[index];
}
