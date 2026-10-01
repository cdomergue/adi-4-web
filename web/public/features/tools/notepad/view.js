import { shell, assets, hotspot, position, dialog, escape, download, printContent } from '../shared.js';
import { STORAGE_KEY, INKS, PAPERS, newDocument, parseLibrary, exportRtf, importRtf, validateDocument } from './engine.js';
let memory = { documents: [], draft: null }, storageUnavailable = false;
export function renderNotepad(main, documentId = null) {
  let library;
  try { const stored = localStorage.getItem(STORAGE_KEY); library = !storageUnavailable && stored ? parseLibrary(stored) : memory; } catch { library = memory; }
  let doc = structuredClone(library.documents.find(d => d.id === documentId) || library.draft || newDocument()), page = 0, collection = 'Mes textes';
  const ui = shell(main, 'Le bloc-notes', `<div class="scene-frame notepad-frame"><img src="${assets}adi4_b2-2.webp" alt="Le bloc-notes original" width="640" height="480"><img class="tool-layer notepad-paper" src="${assets}adi4_b2-37.webp" style="${position([17, 0, 373, 359])}" alt=""><input class="notepad-title" aria-label="Titre du texte" maxlength="80"><textarea class="notepad-text" aria-label="Texte du chapitre" maxlength="50000" spellcheck="true"></textarea><span class="notepad-page"></span><div class="notepad-library"><label class="sr-only" for="notepad-collection">Collection</label><select id="notepad-collection"><option>Mes textes</option><option>Mes préférés</option><option>Mes messages</option></select><div class="notepad-list"></div></div><span class="notepad-caption">Mes textes</span><div class="notepad-pens">${INKS.map((ink, i) => `<button aria-label="Stylo ${['noir', 'bleu', 'vert', 'rouge'][i]}" title="Stylo ${['noir', 'bleu', 'vert', 'rouge'][i]}" data-ink="${ink}" style="--ink:${ink}"></button>`).join('')}</div><div class="notepad-papers">${PAPERS.map((paper, i) => `<button data-paper="${paper}" aria-label="Fond ${['bleu', 'mauve', 'beige', 'blanc'][i]}" title="Fond ${['bleu', 'mauve', 'beige', 'blanc'][i]}"></button>`).join('')}</div>${hotspot('previous', 'Chapitre précédent', [100, 404, 55, 34])}${hotspot('next', 'Chapitre suivant', [296, 404, 55, 34])}<button class="notepad-action" data-collection="Mes textes" style="${position([434, 288, 85, 76])}"><img src="${assets}note-new.webp" alt="">Mes textes</button><button class="notepad-action" data-collection="Mes préférés" style="${position([524, 326, 103, 90])}"><img src="${assets}note-save.webp" alt="">Mes préférés</button><span class="notepad-arrows" aria-hidden="true">◀ <span>Chapitre</span> ▶</span></div>`, '<button class="button secondary" data-new>Nouveau texte</button><button class="button primary" data-save>Sauver</button><button class="button secondary" data-export>Exporter en RTF</button><label class="button secondary">Importer un texte<input type="file" data-import accept=".rtf,.txt,.json" hidden></label><button class="button secondary" data-print>Imprimer</button><button class="button secondary" data-password>Mot de passe</button><label><input type="checkbox" data-memo> Mémo dans la chambre</label>');
  const title = ui.root.querySelector('.notepad-title'), editor = ui.root.querySelector('textarea');
  let persistent = true, locked = Boolean(doc.password);
  const store = () => {
    if (locked) return;
    library.draft = structuredClone(doc); memory = library;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(library)); persistent = true; storageUnavailable = false; }
    catch { persistent = false; storageUnavailable = true; ui.status('La sauvegarde locale est indisponible. Exporte ton texte pour le conserver.'); }
  };
  const capture = () => { if (locked) return; doc.title = title.value || 'Sans titre'; doc.pages[page].text = editor.value; };
  function show() {
    title.value = doc.title; editor.value = doc.pages[page].text; editor.style.color = doc.pages[page].ink;
    ui.root.querySelector('.notepad-page').textContent = `${page + 1} / ${doc.pages.length}`;
    ui.root.querySelector('.notepad-paper').src = assets + 'adi4_b2-' + ({ blue: 33, purple: 35, beige: 37, white: 39 })[doc.paper] + '.webp';
    ui.root.querySelector('[data-memo]').checked = doc.memo;
    ui.root.querySelectorAll('[data-ink]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ink === doc.pages[page].ink)));
    ui.root.querySelectorAll('[data-paper]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.paper === doc.paper)));
  }
  function list() {
    const target = ui.root.querySelector('.notepad-list');
    if (collection !== 'Mes textes') {
      target.innerHTML = `<p>${collection === 'Mes préférés' ? 'Tu n’as pas encore de préférés.' : 'Tu n’as pas de messages.'}</p>`; return;
    }
    target.innerHTML = library.documents.length ? library.documents.map((d, i) => `<div><button data-open="${i}" title="Ouvrir">${d.password ? '🔒 ' : ''}${escape(d.title)}</button><button data-delete="${i}" aria-label="Effacer ${escape(d.title)}">×</button></div>`).join('') : '<p>Écris ton premier texte, puis clique sur Sauver.</p>';
    target.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => {
      const selected = library.documents[+b.dataset.open];
      if (!await unlock(selected) || !ui.alive) return;
      capture(); store(); doc = structuredClone(selected); page = 0; show(); store();
    });
    target.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
      const selected = library.documents[+b.dataset.delete];
      if (!await unlock(selected) || !ui.alive) return;
      const d = dialog(ui.root, 'Effacer ce texte ?', `<p>${escape(selected.title)}</p><button class="button primary" data-yes>Oui</button> <button class="button secondary" data-no>Non</button>`);
      d.querySelector('[data-no]').onclick = () => d.close();
      d.querySelector('[data-yes]').onclick = () => { library.documents = library.documents.filter(v => v.id !== selected.id); store(); list(); d.close(); };
    });
  }
  async function hash(value) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buffer), n => n.toString(16).padStart(2, '0')).join('');
  }
  function passwordPrompt(heading, action) {
    const d = dialog(ui.root, heading, '<form data-password-form><label>Mot de passe<input type="password" maxlength="80" autocomplete="off" autofocus></label><p role="status"></p><button class="button primary">Valider</button></form>');
    d.querySelector('[data-password-form]').onsubmit = async e => { e.preventDefault(); await action(d.querySelector('input').value, d); };
    return d;
  }
  async function unlock(selected) {
    if (!selected.password) return true;
    return new Promise(resolve => {
      const d = passwordPrompt('Ce texte est protégé', async (value, modal) => {
        if (await hash(value) !== selected.password) { modal.querySelector('[role="status"]').textContent = 'Ce mot de passe ne convient pas.'; return; }
        resolve(true); modal.close();
      });
      d.addEventListener('close', () => resolve(false), { once: true });
    });
  }
  title.oninput = editor.oninput = () => { capture(); store(); };
  ui.root.querySelectorAll('[data-ink]').forEach(b => b.onclick = () => { capture(); doc.pages[page].ink = b.dataset.ink; show(); store(); editor.focus(); });
  ui.root.querySelectorAll('[data-paper]').forEach(b => b.onclick = () => { capture(); doc.paper = b.dataset.paper; show(); store(); });
  ui.root.querySelector('[data-tool="previous"]').onclick = () => { capture(); if (page > 0) page--; show(); store(); };
  ui.root.querySelector('[data-tool="next"]').onclick = () => {
    capture(); if (page === doc.pages.length - 1 && page < 19) doc.pages.push({ text: '', ink: doc.pages[page].ink });
    if (page < doc.pages.length - 1) page++; show(); store();
  };
  const save = () => {
    capture(); const i = library.documents.findIndex(d => d.id === doc.id);
    if (i < 0 && library.documents.length >= 100) { ui.status('Le bloc-notes est plein. Exporte ou efface un texte.'); return false; }
    if (i < 0) library.documents.push(structuredClone(doc)); else library.documents[i] = structuredClone(doc);
    store(); list(); if (persistent) ui.status(`« ${doc.title} » est sauvegardé dans ce navigateur.`);
    return true;
  };
  ui.root.querySelector('[data-save]').onclick = save;
  ui.root.querySelector('[data-new]').onclick = () => {
    capture();
    if (doc.pages.some(p => p.text) && !save()) return;
    doc = newDocument(crypto.randomUUID()); page = 0; show(); store();
  };
  ui.root.querySelectorAll('[data-collection]').forEach(b => b.onclick = () => {
    collection = b.dataset.collection; ui.root.querySelector('select').value = collection;
    ui.root.querySelector('.notepad-caption').textContent = collection; list();
  });
  ui.root.querySelector('select').onchange = e => { collection = e.target.value; ui.root.querySelector('.notepad-caption').textContent = collection; list(); };
  ui.root.querySelector('[data-memo]').onchange = e => { doc.memo = e.target.checked; save(); };
  ui.root.querySelector('[data-password]').onclick = () => passwordPrompt('Choisis ton mot de passe (vide pour le retirer)', async (value, d) => {
    doc.password = value ? await hash(value) : ''; save(); d.close();
  });
  ui.root.querySelector('[data-export]').onclick = () => { capture(); download(new Blob([exportRtf(doc)], { type: 'application/rtf' }), doc.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 60) + '.rtf'); };
  ui.root.querySelector('[data-import]').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Le fichier dépasse 2 Mo.');
      const text = await file.text(); if (!ui.alive) return;
      let imported = newDocument(crypto.randomUUID()); imported.title = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
      if (file.name.toLowerCase().endsWith('.json')) { imported = validateDocument(JSON.parse(text)); if (!imported) throw new Error('Ce document est invalide.'); imported.id = crypto.randomUUID(); }
      else if (text.startsWith('{\\rtf')) imported.pages = importRtf(text);
      else { if (text.length > 50000) throw new Error('Le texte dépasse 50 000 caractères.'); imported.pages[0].text = text; }
      capture(); if (doc.pages.some(p => p.text) && !save()) return; doc = imported; page = 0; show(); save();
    } catch (error) { ui.status(error.message || 'Ce fichier ne peut pas être ouvert.'); }
    finally { e.target.value = ''; }
  };
  ui.root.querySelector('[data-print]').onclick = () => {
    capture(); const container = document.createElement('div');
    const heading = document.createElement('h1'); heading.textContent = doc.title; container.append(heading);
    doc.pages.forEach(p => { const section = document.createElement('section'); section.style.cssText = `white-space:pre-wrap;color:${p.ink};break-after:page`; section.textContent = p.text; container.append(section); });
    printContent(ui.root, container);
  };
  ui.root.querySelector('[data-help]').onclick = () => ui.speak('BLOCIN0');
  window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } }, { signal: ui.signal });
  main.addEventListener('sceneleave', () => { capture(); store(); }, { once: true });
  if (locked) {
    const frame = ui.root.querySelector('.notepad-frame'), controls = ui.root.querySelector('.tool-controls');
    frame.inert = true; controls.inert = true;
    unlock(doc).then(ok => {
      if (!ui.alive) return;
      if (!ok) doc = newDocument(crypto.randomUUID());
      locked = false; frame.inert = false; controls.inert = false; show(); list();
    });
  } else { show(); list(); }
  ui.status('Écris sur la page. Sauver conserve le texte dans « Mes textes ».');
  ui.speak('BLOCIN0');
}
