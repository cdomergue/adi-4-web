/* Local shell around the unmodified ScummVM Gob engine. */
const canvas = document.querySelector('#canvas');
const status = document.querySelector('#status');
const saveStatus = document.querySelector('#save-status');
const start = document.querySelector('#start');
const savePath = '/wgob3-saves';
let started = false;
let persistent = false;
let syncing = false;
let fsReady = false;
let lastPointer = {x: 320, y: 240};

function fail(message) {
  status.textContent = message;
  document.querySelector('#loading').hidden = false;
  start.disabled = true;
}

async function getFile(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Ressource indisponible : ${url}`);
  return response;
}

const assets = (async () => {
  const manifest = await (await getFile('/game/wgob3/manifest.json')).json();
  if (manifest.game !== 'gob3' || manifest.language !== 'fr') throw new Error('Édition du jeu incorrecte.');
  return Promise.all(manifest.files.map(async file => {
    if (!/^[A-Z0-9]+\.(STK|ITK|MID)$/.test(file.name)) throw new Error('Nom de ressource incorrect.');
    const bytes = new Uint8Array(await (await getFile(`/game/wgob3/${file.name}`)).arrayBuffer());
    if (bytes.length !== file.size) throw new Error(`Fichier incomplet : ${file.name}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== file.sha256) throw new Error(`Fichier altéré : ${file.name}`);
    return {name: file.name, bytes};
  }));
})();
assets.catch(error => fail(error.message));

function sync(populate = false) {
  return new Promise((resolve, reject) => Module.FS.syncfs(populate, error => error ? reject(error) : resolve()));
}

async function flush() {
  if (!persistent || syncing) return;
  syncing = true;
  try { await sync(); }
  catch { saveStatus.textContent = 'Écriture locale impossible. Exporte tes sauvegardes pour les conserver.'; }
  finally { syncing = false; }
}

// Emscripten reads this global when the generated script loads.
var Module = {
  canvas,
  noInitialRun: true,
  locateFile: name => `/vendor/wgob3/${name}`,
  print: text => console.info('[WGOB3]', text),
  printErr: text => console.warn('[WGOB3]', text),
  onAbort: () => fail('Le jeu s’est interrompu. Recharge la page pour réessayer.'),
  onRuntimeInitialized: async () => {
    try {
      const files = await assets;
      const fs = Module.FS;
      fs.mkdirTree('/wgob3');
      fs.mkdirTree('/wgob3-support');
      fs.mkdirTree(savePath);
      for (const file of files) fs.writeFile(`/wgob3/${file.name}`, file.bytes);
      fs.writeFile('/wgob3-support/translations.dat', new Uint8Array(await (await getFile('/vendor/wgob3/translations.dat')).arrayBuffer()));
      try {
        fs.mount(Module.IDBFS, {autoPersist: true}, savePath);
        await sync(true);
        persistent = true;
      } catch {
        // In private/blocked storage, saves still work in memory and can be exported.
        try { fs.unmount(savePath); } catch { /* Mount may not have succeeded. */ }
      }
      fs.writeFile('/wgob3.ini', `[scummvm]\nconfirm_exit=false\ngui_theme=builtin\ngui_language=en\nextrapath=/wgob3-support\ngfx_mode=2x\nfiltering=false\naspect_ratio=true\nsavepath=${savePath}\n\n[wgob3]\nengineid=gob\ngameid=gob3\npath=/wgob3\nlanguage=fr\nplatform=windows\nmusic_driver=adlib\n`);
      fsReady = true;
      saveStatus.textContent = persistent ? 'Sauvegardes conservées dans ce navigateur. Utilise le menu du jeu pour sauvegarder.' : 'Stockage local indisponible : exporte tes sauvegardes avant de quitter.';
      document.querySelector('#export').disabled = false;
      document.querySelector('#import').disabled = false;
      status.textContent = 'L’aventure est prête.';
      start.disabled = false;
    } catch (error) { fail(error.message); }
  }
};

start.onclick = () => {
  if (!fsReady || started) return;
  started = true;
  document.querySelector('#loading').hidden = true;
  document.querySelector('#menu').disabled = false;
  document.querySelector('#skip').disabled = false;
  document.querySelector('#right-click').disabled = false;
  // Restore before launching so the engine never reads a half-replaced save set.
  document.querySelector('#import').disabled = true;
  canvas.focus();
  try { Module.callMain(['--config=/wgob3.ini', 'wgob3']); }
  catch (error) { if (error !== 'unwind') fail(`Démarrage impossible : ${error.message || error}`); }
};

canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointermove', event => { lastPointer = {x: event.clientX, y: event.clientY}; });
document.querySelector('#menu').onclick = () => {
  canvas.focus();
  const rect = canvas.getBoundingClientRect();
  lastPointer = {x: rect.left + rect.width / 2, y: rect.top + 1};
  canvas.dispatchEvent(new MouseEvent('mousemove', {clientX: lastPointer.x, clientY: lastPointer.y, bubbles: true}));
};
document.querySelector('#skip').onclick = () => {
  canvas.focus();
  for (const type of ['keydown', 'keyup']) canvas.dispatchEvent(new KeyboardEvent(type, {key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true}));
};
document.querySelector('#right-click').onclick = () => {
  canvas.focus();
  // Gob polls the current button state; down+up in one tick would be lost.
  const position = {...lastPointer};
  canvas.dispatchEvent(new MouseEvent('mousedown', {button: 2, buttons: 2, clientX: position.x, clientY: position.y, bubbles: true}));
  setTimeout(() => canvas.dispatchEvent(new MouseEvent('mouseup', {button: 2, buttons: 0, clientX: position.x, clientY: position.y, bubbles: true})), 120);
};
document.querySelector('#fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('#stage').requestFullscreen();
    canvas.focus();
  } catch { saveStatus.textContent = 'Le plein écran n’est pas disponible dans ce navigateur.'; }
};
document.querySelector('#export').onclick = async () => {
  if (!fsReady) return;
  await flush();
  const {encodeBackup} = await import('./saves.js');
  const names = Module.FS.readdir(savePath).filter(name => /^wgob3\.[a-z0-9_-]{1,30}$/i.test(name));
  if (!names.length) { saveStatus.textContent = 'Aucune sauvegarde : enregistre d’abord ta partie depuis le menu du jeu.'; return; }
  const files = names.map(name => ({name, bytes: Module.FS.readFile(`${savePath}/${name}`)}));
  const url = URL.createObjectURL(new Blob([encodeBackup(files)], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url; link.download = 'wgob3-sauvegardes.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  saveStatus.textContent = `${files.length} fichier(s) de sauvegarde exporté(s).`;
};
document.querySelector('#import').onchange = async event => {
  const file = event.target.files[0];
  if (!file || started || !fsReady) return;
  try {
    if (file.size > 12 * 1024 * 1024) throw new Error('Sauvegarde trop volumineuse.');
    const {decodeBackup} = await import('./saves.js');
    const files = decodeBackup(await file.text());
    // Validate the entire backup before touching any saved file.
    for (const entry of files) Module.FS.writeFile(`${savePath}/${entry.name}`, entry.bytes);
    await flush();
    saveStatus.textContent = `${files.length} fichier(s) importé(s). Lance le jeu puis charge ta partie.`;
  } catch (error) { saveStatus.textContent = `Import impossible : ${error.message}`; }
  finally { event.target.value = ''; }
};
setInterval(flush, 3000);
document.addEventListener('visibilitychange', () => { if (document.hidden) void flush(); });
const runtimeScript = document.createElement('script');
runtimeScript.src = '/vendor/wgob3/scummvm.js';
runtimeScript.onerror = () => fail('Le moteur du jeu est absent. La compilation WGOB3 doit être préparée.');
document.body.append(runtimeScript);
