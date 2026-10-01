export const STORAGE_KEY = 'adi4-tools-notepad-v1';
export const INKS = ['#000000', '#000080', '#008000', '#800000'];
export const PAPERS = ['blue', 'purple', 'beige', 'white'];
export function newDocument(id = String(Date.now())) {
  return { id, title: 'Sans titre', pages: [{ text: '', ink: INKS[0] }], paper: 'beige', password: '', memo: false };
}
export function validateDocument(value) {
  if (!value || typeof value !== 'object' || typeof value.title !== 'string' || !Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 20) return null;
  if (value.pages.some(p => !p || typeof p.text !== 'string' || p.text.length > 50000)) return null;
  return { id: typeof value.id === 'string' ? value.id.slice(0, 80) : 'import', title: value.title.slice(0, 80),
    pages: value.pages.map(p => ({ text: p.text, ink: INKS.includes(p.ink) ? p.ink : INKS[0] })),
    paper: PAPERS.includes(value.paper) ? value.paper : 'beige',
    password: /^[0-9a-f]{64}$/.test(value.password) ? value.password : '', memo: value.memo === true };
}
export function parseLibrary(text) {
  try {
    const value = JSON.parse(text);
    return { documents: (Array.isArray(value?.documents) ? value.documents.slice(0, 100) : []).map(validateDocument).filter(Boolean),
      draft: validateDocument(value?.draft) };
  } catch { return { documents: [], draft: null }; }
}
export function exportRtf(doc) {
  const encode = s => s.replace(/[\\{}\n\t\u0080-\uffff]/g, c => {
    if (c === '\n') return '\\par\n';
    if (c === '\t') return '\\tab ';
    if ('\\{}'.includes(c)) return '\\' + c;
    const n = c.charCodeAt(0); return '\\u' + (n > 32767 ? n - 65536 : n) + '?';
  });
  return '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}{\\colortbl;\\red0\\green0\\blue0;\\red0\\green0\\blue128;\\red0\\green128\\blue0;\\red128\\green0\\blue0;}\\fs24\n' + doc.pages.map(p => '\\cf' + (INKS.indexOf(p.ink) + 1) + ' ' + encode(p.text)).join('\\page\n') + '}';
}
// A bounded text reader: RTF destinations (pictures, objects, fonts) are skipped;
// imported material never becomes HTML or an executable object.
export function importRtf(text) {
  if (text.length > 2_000_000 || !text.startsWith('{\\rtf')) throw new Error('Fichier RTF invalide');
  const pages = [{ text: '', ink: INKS[0] }], stack = [];
  let state = { skip: false, uc: 1 }, fallback = 0;
  const append = s => {
    if (state.skip) return;
    if (fallback) { fallback--; return; }
    const page = pages.at(-1); if (page.text.length + s.length > 50000) throw new Error('Chapitre trop long'); page.text += s;
  };
  for (let i = 0; i < text.length;) {
    const c = text[i++];
    if (c === '{') { stack.push({ ...state }); if (stack.length > 100) throw new Error('RTF trop imbriqué'); }
    else if (c === '}') state = stack.pop() || { skip: false, uc: 1 };
    else if (c === '\\') {
      const next = text[i];
      if (['\\', '{', '}'].includes(next)) { append(next); i++; }
      else if (next === '*') { state.skip = true; i++; }
      else if (next === "'") {
        const code = text.slice(i + 1, i + 3);
        if (/^[\da-f]{2}$/i.test(code)) append(new TextDecoder('windows-1252').decode(new Uint8Array([parseInt(code, 16)])));
        i += 3;
      } else {
        const match = /^([a-z]+)(-?\d+)? ?/.exec(text.slice(i));
        if (!match) { if (next === '~') append('\u00a0'); i++; continue; }
        i += match[0].length; const word = match[1], n = Number(match[2]);
        if (['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header', 'footer', 'fldinst'].includes(word)) state.skip = true;
        else if (!state.skip) {
          if (word === 'u') { fallback = 0; append(String.fromCharCode((n + 65536) % 65536)); fallback = state.uc; }
          else if (word === 'uc') state.uc = Math.max(0, Math.min(10, n));
          else if (word === 'par' || word === 'line') append('\n');
          else if (word === 'tab') append('\t');
          else if (word === 'page') { if (pages.length === 20) throw new Error('20 chapitres maximum'); pages.push({ text: '', ink: pages.at(-1).ink }); }
          else if (word === 'cf' && INKS[n - 1]) pages.at(-1).ink = INKS[n - 1];
        }
      }
    } else if (c !== '\r' && c !== '\n') append(c);
  }
  return pages;
}
