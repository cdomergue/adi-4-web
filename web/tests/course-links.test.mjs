import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseOriginalLink, findOriginalDefinition } from '../public/features/courses/links.js';
import { showOriginalMedia } from '../public/features/courses/encyclopedia.js';

const catalog = JSON.parse(await readFile(new URL('../public/game/catalog.json', import.meta.url)));

test('original media types, mixed case and multiline dictionary links are decoded', () => {
  assert.deepEqual(parseOriginalLink('ASANG 3'), { id: 'ASANG', type: 3 });
  assert.deepEqual(parseOriginalLink('#emm:fourmis 6'), { id: 'FOURMIS', type: 6 });
  assert.deepEqual(parseOriginalLink('for \r\n7'), { id: 'FOR', type: 7 });
  assert.deepEqual(parseOriginalLink('SINSPEXP'), { id: 'SINSPEXP', type: null });
  assert.match(findOriginalDefinition(catalog.dictionary, 'lumiere'), /./);
  assert.equal(findOriginalDefinition(catalog.dictionary, 'DOES_NOT_EXIST'), null);
});

test('every dictionary link outside the unused original sample page has a definition', () => {
  let count = 0;
  for (const [pageKey, page] of Object.entries(catalog.pages)) {
    if (pageKey.endsWith('/COURS.HTM')) continue;
    for (const [, raw] of page.html.matchAll(/data-media="([^"]*)"/g)) {
      const { id, type } = parseOriginalLink(raw);
      if (type === 7) {
        assert.notEqual(findOriginalDefinition(catalog.dictionary, id), null, `${pageKey}: ${raw}`);
        count++;
      }
    }
  }
  assert.equal(count, 1190);
});

test('a course image link opens the requested edition and missing entries do not switch editions', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      'Adi410Sci65/SINSPEXP': {
        title: 'Cage thoracique',
        image: '/cage.jpg',
        caption: 'Inspiration et expiration.',
      },
      'Adi410Sci43/ONLY43': { title: 'Autre édition', image: '/other.jpg' },
    }),
  });
  try {
    await showOriginalMedia(
      'SINSPEXP 2',
      'Adi410Sci65',
      (...args) => calls.push(args),
      () => assert.fail('Not a text page'),
    );
    assert.equal(calls[0][0], 'Cage thoracique');
    assert.match(calls[0][1], /src="\/cage.jpg"/);
    await showOriginalMedia(
      'ONLY43 1',
      'Adi410Sci65',
      (...args) => calls.push(args),
      () => {},
    );
    assert.match(calls[1][1], /pas encore été identifié/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
