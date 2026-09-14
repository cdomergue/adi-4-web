import { nativeDocuments } from './native-config.js';

export function renderNativeDocument(main, id) {
  const spec = nativeDocuments[id];
  document.title = `${spec.title} · ADI 4`;
  main.innerHTML = `<section class="documents native-document"><div class="scene-heading"><h1>${spec.title}</h1><a class="button secondary" href="#documents">← Les documents</a></div>
    <iframe class="native-document-frame" src="/documents/player.html?document=${id}" title="${spec.title} — document interactif" allow="autoplay; fullscreen" allowfullscreen></iframe>
    <p>${id === 'atlas' ? 'Pour zoomer, active la loupe puis clique sur le globe ou la carte. Les boutons flottants ouvrent les cartes, les calques et les légendes. Survole les bords pour te déplacer.' : 'Clique directement sur les éléments du décor. Survole le bas de l’écran pour accéder aux modes, aux cas et à l’aide.'}</p>
    <details><summary>À propos de ce document</summary><p>Ce document utilise les scripts, les illustrations et les sons de l’édition française ADI 4.21. Le moteur Gob de ScummVM les interprète dans le navigateur.</p>
    <p><a href="/vendor/wgob3/COPYING">Licence du moteur</a> · <a href="/vendor/documents/README.md">Sources et compilation</a></p></details></section>`;
  const frame = main.querySelector('iframe');
  const onMessage = (event) => {
    if (
      event.source === frame.contentWindow &&
      event.origin === location.origin &&
      event.data?.type === 'adi-document-exit'
    )
      location.hash = 'documents';
  };
  window.addEventListener('message', onMessage);
  main.addEventListener(
    'sceneleave',
    () => {
      window.removeEventListener('message', onMessage);
      frame.remove();
    },
    { once: true },
  );
}
