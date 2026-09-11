import {calculateSimulation,checkChallenge,supportedCalculations} from './simulation-engine.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const sectors={farm:['1','2','7','8'],life:['4','14'],health:['9','15'],geology:['6','11'],chemistry:['5','12'],physics:['3','13']};
const sectorNames={farm:'Élevage et culture',life:'Le Dôme de la vie',health:'La santé',geology:'La géologie',chemistry:'La chimie',physics:'La physique'};
async function get(url){const r=await fetch(url);if(!r.ok)throw new Error('Ressources indisponibles');return r.json();}
export async function renderSimulations(main) {
  document.title='Les simulations · ADI 4';main.innerHTML='<section id="sim-library"><h1>Les simulations Sciences</h1><p role="status">Chargement…</p></section>';
  const root=main.firstElementChild;
  try {
    const [catalog,assets]=await Promise.all([get('/game/station/catalog.json'),get('/game/station/assets.json')]);if(!root.isConnected)return;
    root.innerHTML=`<a class="back-link" href="#scene/station">← La station</a><h1>Les simulations Sciences</h1><p>Explore les laboratoires de la station et retrouve leurs expériences.</p>${Object.entries(sectors).map(([sector,ids])=>`<section><h2><a href="#scene/${sector}">${sectorNames[sector]}</a></h2><div class="simulation-grid">${catalog.filter(sim=>ids.includes(sim.id)).map(sim=>`<a class="simulation-card" href="${sim.id==='2'?'#scene/greenhouse':`#simulation/${sim.id}`}">${assets[sim.background]?`<img src="${assets[sim.background].url}" alt="" loading="lazy" width="640" height="480">`:''}<h3>${esc(sim.title)}</h3></a>`).join('')}</div></section>`).join('')}<p class="development-note">Les 14 expériences utilisent les calculs du jeu original. Leurs séquences et animations restent en cours de vérification.</p>`;
  }catch(e){if(root.isConnected)root.innerHTML='<p>Les simulations ne sont pas disponibles.</p><a href="#scene/station">Retour à la station</a>';}
}
export async function renderSimulation(main,id) {
  document.title='Expérience Sciences · ADI 4';main.innerHTML='<section id="simulation"><p role="status">Ouverture de l’expérience…</p></section>';const root=main.firstElementChild;
  let data,assets;
  try{[data,assets]=await Promise.all([get(`/game/station/sim-${id}.json`),get('/game/station/assets.json')]);}
  catch(e){if(root.isConnected)root.innerHTML='<p>Cette expérience est introuvable.</p><a href="#simulations">Toutes les expériences</a>';return;}
  if(!root.isConnected)return;
  document.title=`${data.title} · ADI 4`;
  const sector=Object.keys(sectors).find(s=>sectors[s].includes(id))||'station';
  const controls=data.objects.filter(o=>o.type!==1&&o.options.length);
  let selected={};const initial=()=>{
    const c=currentCase();selected=Object.fromEntries(data.objects.filter(o=>o.options.length).map(o=>[o.id,c.initial[o.id]||o.options[0].id]));
  };
  root.innerHTML=`<div class="scene-heading"><a class="back-link" href="#scene/${sector}">← ${sectorNames[sector]||'La station'}</a><h1>${esc(data.title)}</h1><a class="back-link" href="#simulations">Toutes les expériences →</a></div>
    <div class="greenhouse-toolbar"><label>Situation <select id="sim-case">${data.cases.map(c=>`<option value="${c.id}">${esc(c.id==='0'?'Exploration libre':c.label)}</option>`).join('')}</select></label><label><input type="checkbox" id="sim-sound"> Voix d’Adi</label><button class="button secondary" id="sim-reset">Recommencer</button></div>
    <div class="scene-frame simulation-frame" aria-label="${esc(data.title)}"><div class="simulation-layers"></div>${controls.filter(o=>o.box&&o.box.every(n=>n>=0)).map(o=>`<button class="scene-hotspot" data-object="${o.id}" aria-label="Régler ${esc(o.label)}" style="${position(o.box)}"><span>${esc(o.label)}</span></button>`).join('')}</div>
    <form class="greenhouse-controls">${controls.map(o=>`<label>${esc(o.label)}<select data-input="${o.id}" aria-label="${esc(o.label)}">${o.options.map(s=>`<option value="${s.id}">${esc(s.label||`Position ${s.id}`)}</option>`).join('')}</select></label>`).join('')}<button class="button primary" type="submit">Vérifier mes réglages</button></form>
    <p id="sim-status" role="status">Choisis une situation et règle les commandes.</p><div id="sim-observations" class="simulation-observations"></div>
    <details><summary>Les conseils d’Adi</summary><div id="sim-hints"></div></details>
    <audio preload="none"></audio><p id="sim-audio-status" role="status"></p>
    <p class="development-note">${supportedCalculations.has(id)?'Calculs traduits des scripts originaux. Les animations disponibles sont rejouées lors des changements ; la fidélité des séquences reste en cours de vérification.':'Décor, réglages et conseils retrouvés. Le calcul des résultats de cette expérience reste à intégrer.'}</p>`;
  const currentCase=()=>data.cases.find(c=>c.id===root.querySelector('#sim-case').value);
  const audio=root.querySelector('audio');
  function update(){
    const result=calculateSimulation(data,selected);Object.assign(selected,result.states);const layers=root.querySelector('.simulation-layers');
    const keep=new Set();
    const background=assets[data.background];
    const add=(asset,key,isBackground=false)=>{
      if(!asset)return;keep.add(key);let img=layers.querySelector(`[data-layer="${key}"]`);const existed=Boolean(img);
      if(!img){img=document.createElement('img');img.dataset.layer=key;img.alt='';layers.append(img);}
      if(img.dataset.asset!==asset.url){img.src=existed&&asset.motion?asset.motion:asset.url;img.dataset.asset=asset.url;}
      img.style.cssText=isBackground?'position:absolute;inset:0;width:100%;height:100%':`position:absolute;${position([asset.x,asset.y,asset.width,asset.height])}`;
      layers.append(img);
    };
    add(background,'background',true);
    for(const o of [...data.objects].sort((a,b)=>a.plan-b.plan)){
      if(o.type===1&&!result.resolved.includes(o.id))continue;
      const s=o.options.find(s=>s.id===result.states[o.id]);add(assets[s?.visual],o.id);
    }
    layers.querySelectorAll('[data-layer]').forEach(img=>{if(!keep.has(img.dataset.layer))img.remove();});
    root.querySelectorAll('[data-input]').forEach(select=>select.value=selected[select.dataset.input]);
    root.querySelector('#sim-observations').innerHTML=data.objects.filter(o=>o.type===1&&result.resolved.includes(o.id)).map(o=>{
      const state=o.options.find(s=>s.id===result.states[o.id]);return state?.label?`<p><strong>${esc(o.label)}</strong> : ${esc(state.label)}</p>`:'';
    }).join('');
    root.querySelector('#sim-hints').innerHTML=controls.map(o=>o.hints[currentCase().id]||o.hints['0']).filter(Boolean).map(t=>`<p>${esc(t)}</p>`).join('')||'<p>Aucun conseil textuel retrouvé pour cette situation.</p>';
    return result;
  }
  root.querySelectorAll('[data-input]').forEach(select=>select.onchange=()=>{
    selected[select.dataset.input]=Number(select.value);update();root.querySelector('#sim-status').textContent='Réglages modifiés.';
    audio.pause();root.querySelector('#sim-audio-status').textContent='';
    const option=controls.find(o=>o.id===select.dataset.input).options.find(o=>o.id===Number(select.value));
    if(root.querySelector('#sim-sound').checked&&option.audio){audio.src=option.audio;audio.play().catch(()=>{if(root.isConnected)root.querySelector('#sim-audio-status').textContent='La voix n’a pas pu être lue.';});}
  });
  root.querySelector('#sim-sound').onchange=()=>audio.pause();
  root.querySelectorAll('[data-object]').forEach(button=>button.onclick=()=>{const select=root.querySelector(`[data-input="${button.dataset.object}"]`);select.focus();select.scrollIntoView({block:'center',behavior:'smooth'});});
  root.querySelector('#sim-case').onchange=()=>{audio.pause();initial();update();root.querySelector('#sim-status').textContent='Nouvelle situation : règle les commandes.';};
  root.querySelector('#sim-reset').onclick=()=>{audio.pause();initial();update();root.querySelector('#sim-status').textContent='Réglages remis au départ.';};
  root.querySelector('form').onsubmit=e=>{e.preventDefault();const result=update();const c=currentCase();const known={};for(const key of result.resolved)known[key]=result.states[key];
    const solutions=c.solutions.map(s=>Object.fromEntries(Object.entries(s).filter(([key])=>controls.some(o=>o.id===key))));
    root.querySelector('#sim-status').textContent=c.id==='0'?'Tu es en exploration libre. Choisis un défi pour vérifier une solution.':checkChallenge(solutions,known)?'Bravo ! Tes réglages correspondent à une solution originale.':'Cette combinaison ne valide pas le défi. Consulte les conseils et essaie d’autres réglages.';
  };
  initial();update();
}
function position([x,y,w,h]){return `left:${x/6.4}%;top:${y/4.8}%;width:${w/6.4}%;height:${h/4.8}%`;}
