import { createShell } from './application/shell.js';
import { createRouter } from './application/router.js';
import { createCourseLibrary } from './features/courses/library.js';

let library;
const { main, info, toast } = createShell(() => library?.storageWorks ?? true);
library = createCourseLibrary({ main, info, toast });
try {
  const response = await fetch('/game/catalog.json');
  if (!response.ok) throw new Error('Catalogue indisponible');
  const catalog = await response.json();
  library.load(catalog);
  const route = createRouter({ main, info, toast, catalog, library });
  window.addEventListener('hashchange', route);
  route();
} catch {
  main.innerHTML =
    '<section class="empty"><h1>Les livres n’ont pas pu être ouverts.</h1><p>Le catalogue local est indisponible. Vérifie que les ressources du jeu ont été préparées.</p><button class="button primary" id="retry">Réessayer</button></section>';
  main.querySelector('#retry').onclick = () => location.reload();
}
