import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCalculator, formatNumber } from '../public/features/tools/calculator/engine.js';
import { createPaper, draw, WIDTH, copySelection, pasteSelection, selectionRect } from '../public/features/tools/paint/engine.js';
import { newDocument, exportRtf, importRtf, parseLibrary, validateDocument } from '../public/features/tools/notepad/engine.js';
const calculate = keys => { const c = createCalculator(); keys.forEach(k => c.press(k)); return c.display; };
test('calculator evaluates immediately and restores pending operations around parentheses', () => {
  assert.equal(calculate(['2', '+', '3', '*', '4', '=']), '20');
  assert.equal(calculate(['2', '+', '(', '3', '*', '4', ')', '=']), '14');
  assert.equal(calculate(['2', '*', '(', '3', '+', '(', '4', '*', '5', ')', ')', '=']), '46');
  assert.equal(calculate(['8', '+', '-', '2', '=']), '6');
  assert.equal(calculate(['2', '+', '9', 'sqrt', '=']), '5');
});
test('calculator decimal, exponent, unary functions and errors are bounded and recoverable', () => {
  assert.equal(calculate(['sign', '3', '=']), '-3');
  assert.equal(calculate(['2', '+', 'sign', '3', '=']), '-1');
  assert.equal(calculate(['2', 'E', 'sign', '3', '=']), '0.002');
  assert.equal(calculate(['.', '5', '+', '.', '2', '=']), '0.7');
  assert.equal(calculate(['9', 'sign', 'sqrt']), 'Erreur');
  assert.equal(calculate(['1', '/', '0', '=']), 'Erreur');
  assert.equal(calculate(['1', '/', '0', '=', 'C', '2', 'square']), '4');
  assert.equal(calculate(['1', 'sin']), '0.8414709848');
  assert.equal(calculate(['1', 'sign', 'asin']), 'Erreur');
  assert.equal(formatNumber(Infinity), 'Erreur');
  assert.equal(calculate(Array(30).fill('9')).length, 10);
  const c = createCalculator(); Array(15).fill('(').forEach(k => c.press(k)); assert.equal(c.depth, 10);
});
const pixel = (data, x, y) => Array.from(data.slice((y * WIDTH + x) * 4, (y * WIDTH + x) * 4 + 4));
test('palette raster uses native dimensions and mirrors strokes on both axes', () => {
  const data = createPaper();
  draw(data, { tool: 'line', from: [10, 10], to: [15, 10], color: '#102030', symmetric: true });
  for (const [x, y] of [[10, 10], [15, 10], [464, 10], [459, 329]]) assert.deepEqual(pixel(data, x, y), [16, 32, 48, 255]);
  assert.deepEqual(pixel(data, 10, 11), [252, 252, 252, 255]);
});
test('palette shapes, reversed selections and clipped pasting preserve surrounding pixels', () => {
  const data = createPaper();
  draw(data, { tool: 'filledRectangle', from: [2, 2], to: [4, 4], color: '#ff0000' });
  const rect = selectionRect([4, 4], [2, 2]); assert.deepEqual(rect, [2, 2, 3, 3]);
  const clip = copySelection(data, rect); pasteSelection(data, clip, 474, 339);
  assert.deepEqual(pixel(data, 474, 339), [255, 0, 0, 255]);
  assert.deepEqual(pixel(data, 473, 339), [252, 252, 252, 255]);
  draw(data, { tool: 'circle', from: [20, 20], to: [25, 20], color: '#0000ff' });
  assert.deepEqual(pixel(data, 25, 20), [0, 0, 255, 255]);
  assert.deepEqual(pixel(data, 20, 20), [252, 252, 252, 255]);
});
test('bloc-notes RTF round-trips accents, escaped control characters, chapters and pen colors', () => {
  const doc = newDocument('test'); doc.pages = [{ text: 'Énergie {eau} \\ terre\nÀ bientôt !\t🌍', ink: '#000080' }, { text: 'Deuxième chapitre', ink: '#800000' }];
  assert.deepEqual(importRtf(exportRtf(doc)), doc.pages);
  assert.deepEqual(importRtf("{\\rtf1 {\\fonttbl{\\f0 Times;}}Bonjour {\\*\\danger ignore}{\\pict secret}\\par Monde}"), [{ text: 'Bonjour \nMonde', ink: '#000000' }]);
  assert.throws(() => importRtf('not rtf'));
});
test('bloc-notes rejects malformed saves and never imports HTML as markup', () => {
  assert.deepEqual(parseLibrary('{bad'), { documents: [], draft: null });
  assert.equal(validateDocument({ title: 'bad', pages: [null] }), null);
  const doc = newDocument('html'); doc.pages[0].text = '<script>alert(1)</script>';
  assert.equal(validateDocument(doc).pages[0].text, doc.pages[0].text);
  doc.paper = 'url(evil)'; doc.pages[0].ink = 'url(evil)';
  assert.equal(validateDocument(doc).paper, 'beige'); assert.equal(validateDocument(doc).pages[0].ink, '#000000');
});
test('all original tool galleries and help resources have complete local files', async () => {
  const dir = new URL('../public/game/tools/', import.meta.url);
  const catalog = JSON.parse(await readFile(new URL('catalog.json', dir), 'utf8'));
  assert.equal(catalog.backgrounds.length, 22); assert.equal(catalog.stickers.length, 520);
  assert.equal(catalog.colors.flat().length, 48);
  for (const item of [...catalog.backgrounds, ...catalog.stickers]) assert.ok((await readFile(new URL(item.file, dir))).length > 20, item.file);
  for (const file of Object.values(catalog.voices)) assert.ok((await readFile(new URL(file, dir))).length > 20, file);
});
