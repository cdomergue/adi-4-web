/* Browser shell for the bundled Gob document interpreter. */
const canvas = document.querySelector('#canvas');
const status = document.querySelector('#status');
const start = document.querySelector('#start');
const feedback = document.querySelector('#feedback');
const sound = document.querySelector('#sound');
const id = new URLSearchParams(location.search).get('document');
let spec,
  ready = false,
  started = false;
const messages = [];
function report(text) {
  messages.push(String(text));
  if (messages.length > 40) messages.shift();
  document.querySelector('#log').textContent = messages.join('\n');
}
function fail(message) {
  status.textContent = message;
  document.querySelector('#loading').hidden = false;
  document.querySelector('#progress').hidden = true;
  document.querySelector('#diagnostics').hidden = false;
  start.disabled = true;
}
async function response(url) {
  const result = await fetch(url);
  if (!result.ok) throw new Error(`Ressource indisponible : ${url}`);
  return result;
}
const assets = (async () => {
  const { nativeDocuments, documentFiles } = await import('../features/documents/native-config.js');
  if (!Object.hasOwn(nativeDocuments, id)) throw new Error('Document inconnu.');
  spec = nativeDocuments[id];
  document.title = spec.title;
  canvas.setAttribute('aria-label', spec.title + ', document interactif');
  const base = '/game/documents/native/';
  const manifest = await (await response(base + 'manifest.json')).json();
  const files = documentFiles(id, manifest);
  let loaded = 0;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  return Promise.all(
    files.map(async (file) => {
      const bytes = new Uint8Array(await (await response(base + file.name)).arrayBuffer());
      if (bytes.length !== file.size) throw new Error(`Fichier incomplet : ${file.name}`);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
        '',
      );
      if (hash !== file.sha256) throw new Error(`Fichier altéré : ${file.name}`);
      loaded += bytes.length;
      document.querySelector('#progress').value = loaded / total;
      return { name: file.name, bytes };
    }),
  );
})();
assets.catch((error) => fail(error.message));

// Gob polls button state between script instructions. Preserve short clicks
// until it has had a chance to see the pressed state, including in scaled iframes.
let pressedAt = 0;
window.addEventListener(
  'mousedown',
  (event) => {
    if (event.target === canvas) pressedAt = performance.now();
  },
  true,
);
window.addEventListener(
  'mouseup',
  (event) => {
    if (!event.isTrusted || event.target !== canvas) return;
    const delay = Math.max(0, 150 - (performance.now() - pressedAt));
    if (!delay) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    const options = {
      button: event.button,
      buttons: 0,
      clientX: event.clientX,
      clientY: event.clientY,
      bubbles: true,
    };
    setTimeout(() => canvas.dispatchEvent(new MouseEvent('mouseup', options)), delay);
  },
  true,
);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

var Module = {
  canvas,
  noInitialRun: true,
  locateFile: (name) => '/vendor/documents/' + name,
  print: report,
  printErr: report,
  onAbort: () => fail('Le document s’est interrompu. Recharge la page pour réessayer.'),
  onExit: () => {
    if (started) parent.postMessage({ type: 'adi-document-exit' }, location.origin);
  },
  onRuntimeInitialized: async () => {
    try {
      const files = await assets;
      const fs = Module.FS;
      fs.mkdirTree('/adi');
      fs.mkdirTree('/saves');
      fs.mkdirTree('/support');
      for (const file of files) fs.writeFile('/adi/' + file.name, file.bytes);
      fs.writeFile(
        '/support/translations.dat',
        new Uint8Array(await (await response('/vendor/wgob3/translations.dat')).arrayBuffer()),
      );
      fs.writeFile(
        '/adi.ini',
        `[scummvm]\ngui_theme=builtin\ngui_language=fr\nconfirm_exit=false\nenable_unsupported_game_warning=false\ngui_return_to_launcher_at_exit=false\nextrapath=/support\nthemepath=/support\nsavepath=/saves\ngfx_mode=normal\nscale_factor=1\nfiltering=false\naspect_ratio=false\n\n[adi]\nengineid=gob\ngameid=adi4\npath=/adi\nlanguage=fr\nplatform=windows\nadi_document=${spec.program}.TOT\n`,
      );
      ready = true;
      status.textContent = spec.title;
      start.disabled = false;
    } catch (error) {
      fail(error.message);
    }
  },
};
start.onclick = () => {
  if (!ready || started) return;
  started = true;
  start.disabled = true;
  document.querySelector('#loading').hidden = true;
  for (const key of ['toolbar', 'escape', 'restart']) document.getElementById(key).disabled = false;
  canvas.focus();
  try {
    Module.callMain(['--config=/adi.ini', 'adi']);
    Module._adi_document_sound(sound.checked ? 1 : 0);
  } catch (error) {
    if (error !== 'unwind') fail(`Démarrage impossible : ${error.message || error}`);
  }
};
sound.onchange = () => {
  if (started && Module._adi_document_sound) Module._adi_document_sound(sound.checked ? 1 : 0);
};
document.querySelector('#toolbar').onclick = () => {
  canvas.focus();
  Module._adi_document_toolbar();
};
document.querySelector('#escape').onclick = () => {
  canvas.focus();
  const options = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true };
  canvas.dispatchEvent(new KeyboardEvent('keydown', options));
  setTimeout(() => canvas.dispatchEvent(new KeyboardEvent('keyup', options)), 150);
};
document.querySelector('#restart').onclick = () => location.reload();
document.querySelector('#fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('#stage').requestFullscreen();
    canvas.focus();
  } catch {
    feedback.textContent = 'Le plein écran n’est pas disponible dans ce navigateur.';
  }
};
const script = document.createElement('script');
script.src = '/vendor/documents/scummvm.js';
script.onerror = () => fail('Le moteur du document est indisponible.');
document.body.append(script);
