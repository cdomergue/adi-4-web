import assert from 'node:assert/strict';
import test from 'node:test';
import {
  measureBitmapText,
  normalizeBitmapText,
  wrapBitmapText,
} from '../public/features/documents/bitmap-text.js';

const font = {
  height: 9,
  characters: {
    A: { x: 0, y: 0, width: 5, height: 9, advance: 5 },
    B: { x: 5, y: 0, width: 5, height: 9, advance: 4 },
    "'": { x: 10, y: 0, width: 2, height: 9, advance: 2 },
    o: { x: 12, y: 0, width: 4, height: 9, advance: 4 },
    e: { x: 16, y: 0, width: 4, height: 9, advance: 4 },
    ' ': { x: 20, y: 0, width: 2, height: 9, advance: 2 },
    '?': { x: 22, y: 0, width: 5, height: 9, advance: 5 },
  },
};

test('bitmap text normalizes original-font substitutions and measures advances', () => {
  assert.equal(normalizeBitmapText('A’B œ', font), "A'B oe");
  const measured = measureBitmapText('AB?', font);
  assert.equal(measured.width, 14);
  assert.deepEqual(
    measured.glyphs.map(({ character }) => character),
    ['A', 'B', '?'],
  );
});

test('bitmap text wraps at words, retains overlong words, and honors hard lines', () => {
  const lines = wrapBitmapText('AA B AAAAA\nB', font, { width: 12, align: 'center' });
  assert.deepEqual(
    lines.map(({ text, width }) => [text, width]),
    [
      ['AA', 10],
      ['B', 4],
      ['AAAAA', 25],
      ['B', 4],
    ],
  );
  assert.equal(lines[0].x, 1);
  assert.equal(lines[1].x, 4);
  assert.equal(lines[2].x, 0);
});

test('bitmap text falls back to the original question-mark glyph for unsupported characters', () => {
  const measured = measureBitmapText('A€B', font);
  assert.equal(measured.width, 14);
  assert.deepEqual(
    measured.glyphs.map(({ glyph }) => glyph.advance),
    [5, 5, 4],
  );
});
