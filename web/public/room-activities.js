import {startRoomIdle} from './room-idle.js';
const assets='/game/room/activities/';
const place=box=>`left:${box.x/6.4}%;top:${box.y/4.8}%;width:${box.width/6.4}%;height:${box.height/4.8}%`;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function crateEntries(original,games,filter='all'){
  const known=new Map(games.map(game=>[game.id,game])),seen=new Set(),result=[];
  for(const item of original){
    if(seen.has(item.id))continue;
    seen.add(item.id);result.push({...item,route:known.get(item.id)?.route});
  }
  for(const game of games)if(!seen.has(game.id))result.push(game);
  return result.filter(game=>filter==='all'||Boolean(game.route)===(filter==='available'));
}

export async function renderRoomActivity(main,kind,info){
  const radio=kind==='radio';
  document.title=`${radio?'La radio':'La caisse de jeux'} · ADI 4`;
  main.innerHTML=`<section class="original-scene room-activity"><div class="scene-heading"><h1>${radio?'La radio d’Adi':'La caisse de jeux'}</h1><a class="button secondary" href="#room">← La chambre</a></div><p role="status">Ouverture…</p></section>`;
  const root=main.firstElementChild;
  try{
    const responses=await Promise.all([fetch(assets+'catalog.json'),...(radio?[]:[fetch('/game/games/catalog.json')])]);
    if(responses.some(response=>!response.ok))throw new Error('Missing room activities');
    const [catalog,games]=await Promise.all(responses.map(response=>response.json()));
    if(!root.isConnected)return;
    const key=radio?'radio':'crate',panel=catalog.artwork[key],actor=catalog.artwork[key+'Actor'];
    const heading=root.querySelector('.scene-heading');root.replaceChildren(heading);
    const controls=document.createElement('div');controls.className='room-controls';
    controls.innerHTML=radio?'<button class="button secondary" id="radio-categories" hidden>← Musiques et ambiances</button>':
      '<label>Afficher <select id="crate-filter" aria-label="Afficher les jeux"><option value="available">Disponibles</option><option value="upcoming">À venir</option><option value="all">Tous, dans l’ordre original</option></select></label>';
    root.append(controls);
    const frame=document.createElement('div');frame.className=`scene-frame activity-frame ${key}-activity`;
    frame.innerHTML=`<img src="/game/room/image-${radio?9:26}.webp" width="640" height="480" alt="${radio?'Le poste de radio original':'La caisse de jeux originale'}">
      <img class="activity-layer activity-actor" src="${assets}${key}-adi.webp" style="${place(actor)}" alt="Adi">
      <img class="activity-layer activity-panel" src="${assets}${key}-panel.webp" style="${place(panel)}" alt="">
      <h2 class="activity-title">${radio?'Le juke-box':'Les jeux'}</h2>
      <div class="activity-items" aria-label="${radio?'Choisir une musique ou une ambiance':'Choisir un jeu'}"></div>
      <button class="activity-arrow activity-up" aria-label="Page précédente" title="Page précédente"></button>
      <input class="activity-scroll" type="range" min="0" max="0" value="0" step="1" aria-label="Page du menu">
      <button class="activity-arrow activity-down" aria-label="Page suivante" title="Page suivante"></button>
      <div class="room-toolbar-edge" aria-hidden="true"></div><nav class="room-toolbar" aria-label="Navigation de la chambre">
      ${[['#welcome','Accueil','BARINTER'],['#scene/station','Sciences','BARAPPLI'],['#games','Les jeux','BARJEUX']].map(([url,label,icon])=>`<a href="${url}" aria-label="${label}" title="${label}"><img src="/game/room/${icon}.webp" alt=""></a>`).join('')}
      ${[['Les outils','BAROUTIL'],['Les documents','BARDOCS'],['Les animations','BARANIM']].map(([label,icon])=>`<button disabled aria-label="${label}" title="${label}"><img src="/game/room/${icon}.webp" alt=""></button>`).join('')}
      <button id="activity-help" aria-label="Aide" aria-pressed="false" title="Aide"><img src="/game/room/BARAIDE.webp" alt=""></button><a href="#room" aria-label="Revenir dans la chambre" title="Revenir dans la chambre"><img src="/game/room/BARPORTE.webp" alt=""></a></nav>`;
    root.append(frame);
    const status=document.createElement('p');status.className='activity-status';status.setAttribute('role','status');root.append(status);
    const pageLabel=document.createElement('p');pageLabel.className='quiet';root.append(pageLabel);
    const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.hidden=true;audio.setAttribute('aria-label','Lecture de la radio');root.append(audio);
    const stop=document.createElement('button');stop.className='button secondary radio-stop';stop.textContent='Arrêter la radio';stop.hidden=true;root.append(stop);
    let mode='categories',page=0,filter='available',help=false,current=null,playSerial=0;
    const grid=frame.querySelector('.activity-items'),title=frame.querySelector('.activity-title');
    const up=frame.querySelector('.activity-up'),down=frame.querySelector('.activity-down'),scroll=frame.querySelector('.activity-scroll');
    const categories=[{id:'music',title:'Les musiques',image:assets+'music.webp'},{id:'ambience',title:'Les ambiances',image:assets+'ambience.webp'}];
    const entries=()=>radio?(mode==='categories'?categories:catalog[mode]):crateEntries(catalog.games,games,filter);
    const stopAudio=()=>{playSerial++;audio.pause();audio.removeAttribute('src');audio.load();audio.hidden=true;stop.hidden=true;current=null;grid.querySelectorAll('[aria-pressed]').forEach(button=>button.setAttribute('aria-pressed','false'));};
    stop.onclick=()=>{stopAudio();status.textContent='Radio arrêtée.';};
    audio.onended=()=>{status.textContent=`${current?.title||'Morceau'} : lecture terminée.`;};
    audio.onerror=()=>{if(audio.hasAttribute('src'))status.textContent='Ce morceau n’a pas pu être chargé. Tu peux réessayer ou en choisir un autre.';};
    const select=async item=>{
      if(help){status.textContent=radio?'Clique sur une vignette pour écouter, puis utilise les commandes sous la radio. Les flèches font défiler les choix.':item.route?`${item.title} : clique pour jouer.`:`${item.title} : ce jeu reste à recréer.`;return;}
      if(!radio){if(item.route)location.hash=item.route;else info(item.title,'<p>Ce jeu original est identifié. Sa recréation web reste à réaliser.</p>');return;}
      if(mode==='categories'){mode=item.id;page=0;draw();return;}
      stopAudio();if(!item.audio){status.textContent='Aucune ambiance.';return;}
      current=item;const serial=playSerial;audio.src=item.audio;audio.hidden=false;stop.hidden=false;
      status.textContent=`Lecture : ${item.title}`;
      grid.querySelectorAll('[data-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.choice===item.id)));
      try{await audio.play();}catch{if(serial===playSerial&&root.isConnected)status.textContent='Clique sur Lecture sous la radio pour démarrer le son.';}
    };
    function draw(){
      const items=entries(),pages=Math.max(1,Math.ceil(items.length/6));page=Math.min(Math.max(0,page),pages-1);
      grid.replaceChildren();grid.classList.toggle('category-items',radio&&mode==='categories');
      title.textContent=radio?(mode==='categories'?'Le juke-box':mode==='music'?'Les musiques':'Les ambiances'):'Les jeux';
      if(radio)controls.querySelector('#radio-categories').hidden=mode==='categories';
      for(const item of items.slice(page*6,page*6+6)){
        const button=document.createElement('button');button.className='activity-choice';button.dataset.choice=item.id;
        button.setAttribute('aria-label',item.title+(!radio&&!item.route?' — à venir':''));button.title=item.title;
        if(radio&&mode!=='categories')button.setAttribute('aria-pressed',String(current?.id===item.id));
        button.innerHTML=`${item.image?`<img src="${escape(item.image)}" alt="">`:`<span class="activity-missing">${escape(item.title)}</span>`}<span class="activity-tooltip">${escape(item.title)}${!radio&&!item.route?' · À venir':''}</span>`;
        button.onclick=()=>select(item);grid.append(button);
      }
      up.disabled=page===0;down.disabled=page===pages-1;scroll.max=String(pages-1);scroll.value=String(page);scroll.disabled=pages===1;
      pageLabel.textContent=`${items.length} ${radio?(mode==='categories'?'catégories':mode==='music'?'musiques':'ambiances'):'jeux'} · Page ${page+1} sur ${pages}`;
      if(!current)status.textContent=radio?'Choisis une vignette pour écouter la radio.':'Choisis une vignette pour jouer. Les flèches à droite font défiler les jeux.';
    }
    up.onclick=()=>{page--;draw();};down.onclick=()=>{page++;draw();};scroll.oninput=()=>{page=Number(scroll.value);draw();};
    frame.querySelector('#activity-help').onclick=e=>{help=!help;e.currentTarget.setAttribute('aria-pressed',String(help));status.textContent=help?'Aide activée : clique sur une vignette pour lire son rôle. Clique sur ? pour quitter l’aide.':'Aide désactivée.';};
    if(radio)controls.querySelector('#radio-categories').onclick=()=>{mode='categories';page=0;draw();};
    else controls.querySelector('#crate-filter').onchange=e=>{filter=e.target.value;page=0;draw();};
    draw();
    startRoomIdle(frame.querySelector('.activity-actor'),actor,assets+key+'-adi.webp');
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const artwork=frame.querySelector('.activity-panel');
      frame.classList.add('activity-opening');
      const finish=()=>{if(root.isConnected){frame.classList.remove('activity-opening');artwork.src=assets+key+'-panel.webp';}};
      artwork.onload=()=>{artwork.onload=null;setTimeout(finish,41*83);};
      artwork.onerror=()=>{artwork.onload=null;artwork.onerror=null;finish();};
      artwork.src=assets+key+'-opening.webp';
    }
  }catch{if(root.isConnected)root.innerHTML='<p role="status">Ce menu n’a pas pu être chargé. <a href="#room">Revenir dans la chambre</a></p>';}
}
