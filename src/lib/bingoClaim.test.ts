import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verifyBingoNumbers } from '@/lib/bingoClaim';
import {
  BINGO_PATTERNS,
  FREE_SPACE_POSITION,
  getBingoPatternNumberCounts,
  type BingoPattern,
} from '@/lib/bingoPatterns';

describe('Bingo pattern validation', () => {
  it('defines the built-in 5x5 card positions', () => {
    assert.deepEqual(BINGO_PATTERNS['top-row'].positionSets, [[1, 2, 3, 4, 5]]);
    assert.deepEqual(BINGO_PATTERNS['bottom-row'].positionSets, [[21, 22, 23, 24, 25]]);
    assert.deepEqual(BINGO_PATTERNS['left-column'].positionSets, [[1, 6, 11, 16, 21]]);
    assert.deepEqual(BINGO_PATTERNS['right-column'].positionSets, [[5, 10, 15, 20, 25]]);
    assert.deepEqual(BINGO_PATTERNS['sint-andreas-cross'].positionSets, [[1, 5, 7, 9, 13, 17, 19, 21, 25]]);
    assert.deepEqual(BINGO_PATTERNS['full-card'].positionSets, [Array.from({ length: 25 }, (_, index) => index + 1)]);
    assert.deepEqual(BINGO_PATTERNS['single-row'].positionSets[2], [11, 12, 13, 14, 15]);
    assert.deepEqual(BINGO_PATTERNS['single-column'].positionSets[2], [3, 8, 13, 18, 23]);
  });

  it('validates every built-in pattern using its required drawn-number count', () => {
    for (const pattern of Object.keys(BINGO_PATTERNS) as BingoPattern[]) {
      for (const count of getBingoPatternNumberCounts(pattern)) {
        const claimedNumbers = Array.from({ length: count }, (_, index) => index + 1);
        const result = verifyBingoNumbers(claimedNumbers, claimedNumbers, '75-ball', pattern);

        assert.deepEqual(result.requiredNumberCounts, getBingoPatternNumberCounts(pattern), pattern);
        assert.equal(result.isVerified, true, `${pattern} with ${count} values`);
      }
    }
  });

  it('treats the free center as satisfied without requiring an extra value', () => {
    assert.equal(FREE_SPACE_POSITION, 13);
    assert.deepEqual(getBingoPatternNumberCounts('sint-andreas-cross'), [8]);
    assert.deepEqual(getBingoPatternNumberCounts('full-card'), [24]);
    const fullCardNumbers = BINGO_PATTERNS['full-card'].positionSets[0].filter(
      (position) => position !== FREE_SPACE_POSITION,
    );

    assert.equal(
      verifyBingoNumbers(fullCardNumbers, fullCardNumbers, '75-ball', 'full-card').isVerified,
      true,
    );
  });

  it('rejects claims with the wrong number of values', () => {
    for (const pattern of Object.keys(BINGO_PATTERNS) as BingoPattern[]) {
      const claimedNumbers = Array.from(
        { length: Math.max(...getBingoPatternNumberCounts(pattern)) + 1 },
        (_, index) => index + 1,
      );

      assert.equal(verifyBingoNumbers(claimedNumbers, claimedNumbers, '75-ball', pattern).isVerified, false, pattern);
    }
  });

  it('accepts a four-number middle row and keeps five-number rows compatible', () => {
    assert.equal(verifyBingoNumbers([7, 8, 9, 10], [7, 8, 9, 10], '75-ball').isVerified, true);
    assert.equal(verifyBingoNumbers([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], '75-ball').isVerified, true);
  });

  it('accepts four-number center columns and five-number columns', () => {
    assert.deepEqual(getBingoPatternNumberCounts('single-column'), [4, 5]);
    assert.equal(
      verifyBingoNumbers([7, 8, 9, 10], [7, 8, 9, 10], '75-ball', 'single-column').isVerified,
      true,
    );
    assert.equal(
      verifyBingoNumbers([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], '75-ball', 'single-column').isVerified,
      true,
    );
  });

  it('rejects duplicate, invalid, and undrawn values', () => {
    assert.equal(verifyBingoNumbers([1, 2, 3, 4, 4], [1, 2, 3, 4], '75-ball').isVerified, false);
    assert.equal(verifyBingoNumbers([0, 2, 3, 4, 5], [0, 2, 3, 4, 5], '75-ball').isVerified, false);
    assert.deepEqual(
      verifyBingoNumbers([1, 2, 3, 4, 5], [1, 2, 3, 4], '75-ball').missingNumbers,
      [5],
    );
    assert.equal(verifyBingoNumbers([1, 2, 3, 4, 5], [1, 2, 3, 4], '75-ball').isVerified, false);
  });

  it('keeps existing five-number claims compatible by default', () => {
    assert.equal(verifyBingoNumbers([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], '75-ball').isVerified, true);
  });
});