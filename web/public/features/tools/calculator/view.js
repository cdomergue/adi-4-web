import { createCalculator } from './engine.js';
import { shell, position, assets } from '../shared.js';
const keys = [
  ['square', 'Carré', 42, 102], ['sqrt', 'Racine carrée', 42, 138], ['reciprocal', 'Inverse', 42, 172], ['(', 'Parenthèse ouvrante', 42, 205],
  ['sin', 'Sinus', 76, 102], ['cos', 'Cosinus', 76, 138], ['tan', 'Tangente', 76, 172], [')', 'Parenthèse fermante', 76, 205],
  ['asin', 'Arc sinus', 111, 102], ['acos', 'Arc cosinus', 111, 138], ['atan', 'Arc tangente', 111, 172], ['E', 'Exposant', 111, 205],
  ['7', '7', 149, 102], ['4', '4', 149, 138], ['1', '1', 149, 172], ['0', '0', 149, 205],
  ['8', '8', 185, 102], ['5', '5', 185, 138], ['2', '2', 185, 172], ['.', 'Virgule', 185, 205],
  ['9', '9', 221, 102], ['6', '6', 221, 138], ['3', '3', 221, 172], ['sign', 'Changer le signe', 221, 205],
  ['*', 'Multiplier', 260, 102], ['+', 'Additionner', 260, 138], ['=', 'Égal', 260, 172, 67], ['C', 'Effacer', 260, 205],
  ['/', 'Diviser', 296, 102], ['-', 'Soustraire', 296, 138], ['OFF', 'Éteindre la calculatrice', 296, 205],
];
export function renderCalculator(main) {
  const ui = shell(main, 'La calculatrice', `<div class="scene-frame tools-desk"><img src="/game/room/image-5.webp" alt="Le bureau d’Adi" width="640" height="480"><div class="adi-calculator" style="left:22%;top:17%;width:57.03125%;height:55.2083%"><img src="${assets}adi4_cal-1.webp" alt="" width="365" height="265"><div class="calculator-drag" title="Déplacer la calculatrice"></div><output class="calculator-display" aria-label="Résultat" aria-live="polite">0</output>${keys.map(([key, label, x, y, w = 31]) => `<button class="tool-hotspot" data-key="${key}" aria-label="${label}" title="${label}" style="${position([x, y, w, 25], 365, 265)}"></button>`).join('')}</div></div>`);
  const calculator = createCalculator(), panel = ui.root.querySelector('.adi-calculator');
  const press = key => {
    if (key === 'OFF') { location.hash = 'tools'; return; }
    ui.root.querySelector('output').textContent = calculator.press(key);
  };
  ui.root.querySelectorAll('[data-key]').forEach(b => b.onclick = () => press(b.dataset.key));
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.matches('input,textarea,select')) return;
    const key = ({ Enter: '=', Escape: 'C', Delete: 'C', ',': '.', e: 'E', c: 'C' })[e.key] || e.key;
    if (/^[0-9+*/().=-]$/.test(key) || ['C', 'E', 'Backspace'].includes(key)) { e.preventDefault(); press(key); }
  }, { signal: ui.signal });
  const handle = panel.querySelector('.calculator-drag');
  let drag;
  handle.onpointerdown = e => {
    const frame = panel.parentElement.getBoundingClientRect(), rect = panel.getBoundingClientRect();
    drag = { x: e.clientX - rect.left, y: e.clientY - rect.top, frame };
    handle.setPointerCapture(e.pointerId);
  };
  handle.onpointermove = e => {
    if (!drag) return;
    panel.style.left = Math.max(0, Math.min(640 - 365, (e.clientX - drag.x - drag.frame.left) / drag.frame.width * 640)) / 6.4 + '%';
    panel.style.top = Math.max(0, Math.min(480 - 265, (e.clientY - drag.y - drag.frame.top) / drag.frame.height * 480)) / 4.8 + '%';
  };
  handle.onpointerup = handle.onpointercancel = () => { drag = null; };
  ui.root.querySelector('[data-help]').onclick = () => ui.speak('CALCUL0');
  ui.speak('CALCUL0');
  ui.status('Utilise les touches ou le clavier. C efface le calcul ; OFF revient au bureau.');
}
