import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateAllNumbers, getNextNumber } from './bingoNumbers';
import { DEFAULT_ROOM_ID, normalizeRoomId, normalizeRoomName } from './gameRoom';
import { FREE_SPACE, generate75BallCard, generate90BallCard } from './generateCard';
import { VARIANTS, getVariant } from './variants';

describe('room helpers', () => {
  it('normalizes room ids and falls back to the default room', () => {
    assert.equal(normalizeRoomId(' Friday-Night '), 'friday-night');
    for (const invalid of [null, undefined, '', '  ', '-bad', 'has space', 'a'.repeat(33)]) {
      assert.equal(normalizeRoomId(invalid), DEFAULT_ROOM_ID);
    }
  });

  it('normalizes room names', () => {
    assert.equal(normalizeRoomName('  Club   night '), 'Club night');
    assert.equal(normalizeRoomName(undefined), 'New room');
    assert.equal(normalizeRoomName('x'.repeat(60)).length, 40);
  });
});

describe('number helpers', () => {
  it('generates every number from 1 to the maximum', () => {
    assert.deepEqual(generateAllNumbers(5), [1, 2, 3, 4, 5]);
  });

  it('draws only undrawn numbers and returns null when exhausted', () => {
    const all = generateAllNumbers(10);
    const drawn: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const next = getNextNumber(all, drawn);
      assert.notEqual(next, null);
      assert.ok(!drawn.includes(next as number));
      drawn.push(next as number);
    }
    assert.equal(getNextNumber(all, drawn), null);
  });
});

describe('variants', () => {
  it('defines the supported variants', () => {
    assert.equal(VARIANTS['75-ball'].maxNumber, 75);
    assert.equal(VARIANTS['90-ball'].maxNumber, 90);
    assert.equal(getVariant('speedy')?.maxNumber, 30);
  });
});

describe('card generation', () => {
  it('builds a valid 75-ball card with a free centre', () => {
    const card = generate75BallCard();
    assert.equal(card.length, 5);
    assert.equal(card[2][2], FREE_SPACE);
    const numbers = card.flat().filter((value) => value !== FREE_SPACE);
    assert.equal(new Set(numbers).size, 24);
    card.forEach((row) => row.forEach((value, column) => {
      if (value === FREE_SPACE) return;
      assert.ok(value >= column * 15 + 1 && value <= column * 15 + 15, `${value} in column ${column}`);
    }));
  });

  it('builds a valid 90-ball card with five numbers per row', () => {
    const card = generate90BallCard();
    assert.equal(card.length, 3);
    card.forEach(({ row, blanks }) => {
      assert.equal(row.length, 9);
      assert.equal(blanks.filter((blank) => !blank).length, 5);
    });

    const ranges = [[1, 9], [10, 19], [20, 29], [30, 39], [40, 49], [50, 59], [60, 69], [70, 79], [80, 90]];
    ranges.forEach(([min, max], col) => {
      const numbers = card.filter(({ blanks }) => !blanks[col]).map(({ row }) => row[col]);
      assert.ok(numbers.length > 0, `column ${col} should contain at least one number`);
      assert.equal(new Set(numbers).size, numbers.length, `column ${col} should not repeat numbers`);
      numbers.forEach((value) => {
        assert.ok(value >= min && value <= max, `${value} in column ${col}`);
      });
    });
  });
});
