import {startRoomIdle} from './room-idle.js';
const actions=[
  ['internet','Internet','BARINTER','Les classes virtuelles et les services Internet d’époque ne sont pas disponibles dans cette version locale.'],
  ['science','Les matières','BARAPPLI','Ouvre l’application Sciences et sa station spatiale.'],
  ['games','Les jeux','BARJEUX','Ouvre les jeux de la chambre d’Adi.'],
  ['tools','Les outils','BAROUTIL','Les outils de la chambre restent à reconstruire.'],
  ['documents','Les documents','BARDOCS','Les documents de la chambre restent à reconstruire.'],
  ['animations','Les animations','BARANIM','Repère les objets animés de la chambre.'],
  ['help','Aide','BARAIDE','Active ou désactive les explications des boutons.'],
  ['exit','Sortir','BARPORTE','Reviens à l’accueil.'],
];
// Rectangles are provisionally traced on IMAGE.EXT #1. Close-up indices come
// from IMAGE.TOT's v20f switch (default variant); VMD placement is native.
const objects=[
  {id:'bear',label:'L’ours',rect:[96,297,66,71],clip:'XOURSA',view:24},
  {id:'telescope',label:'Le télescope',rect:[503,188,82,118],clip:'XTELESKA',view:22},
  {id:'toys',label:'La caisse de jeux',rect:[393,302,108,68],route:'games'},
  {id:'radio',label:'La radio',rect:[76,232,50,35],route:'radio'},
  {id:'chest',label:'La malle',rect:[0,366,83,54],clip:'XMALLA',view:7},
  {id:'chair',label:'Le fauteuil',rect:[145,238,73,53],clip:'XFAUTA',view:11},
  {id:'planets',label:'Les planètes',rect:[139,82,140,82],clip:'XPLAND',view:13},
];
export async function renderRoom(main,info){
  document.title='La chambre d’Adi · ADI 4';
  main.innerHTML=`<section class="original-scene"><div class="scene-heading"><h1>La chambre d’Adi</h1><button class="button secondary" id="room-show-toolbar" aria-expanded="false">Afficher les boutons</button></div>
  <div class="scene-frame room-frame"><img src="/game/room/bedroom.webp" width="640" height="480" alt="La chambre originale d’Adi, avec son bureau, ses jouets et son télescope">
    <img class="room-layer room-actor" alt="Adi" hidden>
    <img class="room-layer room-animation" alt="" hidden>
    <div class="room-objects">${objects.map(o=>`<button class="room-object" data-room-object="${o.id}" aria-label="${o.label}" title="${o.label}" style="left:${o.rect[0]/6.4}%;top:${o.rect[1]/4.8}%;width:${o.rect[2]/6.4}%;height:${o.rect[3]/4.8}%"></button>`).join('')}<button class="room-object" data-room-object="adi" aria-label="Adi" title="Adi" style="left:40.15%;top:39.16%;width:16%;height:45.42%"></button></div>
    <div class="room-toolbar-edge" aria-hidden="true"></div>
    <nav class="room-toolbar" aria-label="Les activités de la chambre">${actions.map(([id,label,asset])=>`<button data-room-action="${id}" aria-label="${label}" title="${label}"><img src="/game/room/${asset}.webp" data-still="/game/room/${asset}.webp" data-motion="/game/room/${asset}-motion.webp" alt=""><span>${label}</span></button>`).join('')}</nav>
  </div><p id="room-hint" role="status">Descends la souris tout en bas de la chambre pour faire apparaître les huit boutons.</p>
  <div class="room-controls"><button class="button secondary" id="room-back" hidden>Revenir dans la chambre</button><button class="button secondary" id="room-detail" hidden>Voir de près</button><button class="button secondary" id="room-stop" hidden>Arrêter l’animation</button><label><input type="checkbox" id="room-outline"> Repérer les objets</label></div>
  <audio id="room-audio" preload="none"></audio>
  <nav class="scene-links"><a class="button secondary" href="#scene/station">Les matières →</a><a class="button secondary" href="#games">Les jeux →</a></nav>
  <p class="development-note">Décor, gros plans et animations d’origine. Les déplacements d’Adi et les enchaînements complets restent à reconstruire.</p></section>`;
  const root=main.firstElementChild,frame=root.querySelector('.room-frame'),hint=root.querySelector('#room-hint');let help=false;
  const base=frame.querySelector('img'),actor=root.querySelector('.room-actor'),animation=root.querySelector('.room-animation'),regions=root.querySelector('.room-objects');
  const audio=root.querySelector('audio'),back=root.querySelector('#room-back'),detail=root.querySelector('#room-detail'),stop=root.querySelector('#room-stop');
  let clips={},timer,serial=0,selected=null,idleActor,stopIdle=()=>{};
  const position=(image,clip)=>{image.style.left=`${clip.x/6.4}%`;image.style.top=`${clip.y/4.8}%`;image.style.width=`${clip.width/6.4}%`;image.style.height=`${clip.height/4.8}%`;};
  const idleBase='/game/room/activities/crate-adi.webp';
  const resumeIdle=()=>{stopIdle();if(idleActor&&!actor.hidden)stopIdle=startRoomIdle(actor,idleActor,idleBase);};
  const reset=()=>{serial++;clearTimeout(timer);stopIdle();actor.onload=null;actor.onerror=null;audio.pause();audio.removeAttribute('src');animation.hidden=true;stop.hidden=true;
    if(clips.ADIPZD12){position(actor,idleActor||clips.ADIPZD12);actor.src=idleActor?idleBase:'/game/room/ADIPZD12.webp';}resumeIdle();};
  const play=(name)=>{
    reset();const clip=clips[name];if(!clip){hint.textContent='Les animations ne sont pas encore disponibles.';return;}stopIdle();
    const target=name==='ADIPZD12'?actor:animation,token=serial;position(target,clip);
    target.onload=()=>{if(token!==serial||!root.isConnected)return;target.onload=null;target.hidden=false;stop.hidden=false;
      if(clip.audio){audio.src=`/game/room/${name}.wav`;audio.play().catch(()=>{hint.textContent='Le son n’a pas pu démarrer.';});}
      timer=setTimeout(()=>{if(root.isConnected)reset();},clip.duration);
    };
    target.onerror=()=>{if(token!==serial||!root.isConnected)return;reset();hint.textContent='Cette animation n’a pas pu être chargée.';};
    target.src=`/game/room/${name}-motion.webp?play=${serial}`;
  };
  stop.onclick=reset;
  root.querySelector('#room-outline').onchange=e=>frame.classList.toggle('room-outlines',e.target.checked);
  back.onclick=()=>{reset();base.src='/game/room/bedroom.webp';base.alt='La chambre originale d’Adi';actor.hidden=!clips.ADIPZD12;resumeIdle();regions.hidden=false;back.hidden=true;detail.hidden=!selected;hint.textContent='Choisis un objet ou une activité dans le menu du bas.';};
  detail.onclick=()=>{if(!selected)return;reset();stopIdle();base.src=`/game/room/image-${selected.view}.webp`;base.alt=selected.label+' — gros plan original';actor.hidden=true;regions.hidden=true;detail.hidden=true;back.hidden=false;hint.textContent=selected.label;};
  root.querySelectorAll('[data-room-object]').forEach(button=>button.onclick=()=>{
    const object=objects.find(o=>o.id===button.dataset.roomObject);
    if(help){hint.textContent=object?.route?`${object.label} : clique pour ouvrir son menu.`:object?`${object.label} : clique pour lancer une animation, puis « Voir de près » pour explorer son décor.`:'Clique sur Adi pour le voir s’animer.';return;}
    if(object?.route){reset();location.hash=object.route;return;}
    selected=object||null;detail.hidden=!selected;hint.textContent=object?object.label:'Adi';play(object?.clip||'ADIPZD12');
  });
  const toggle=root.querySelector('#room-show-toolbar');toggle.onclick=()=>{const open=frame.classList.toggle('toolbar-pinned');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Masquer les boutons':'Afficher les boutons';};
  root.querySelectorAll('[data-room-action]').forEach(button=>{
    const image=button.querySelector('img');
    button.onpointerenter=button.onfocus=()=>image.src=image.dataset.motion;
    button.onpointerleave=button.onblur=()=>image.src=image.dataset.still;
    button.onclick=()=>{
      const [id,label,,description]=actions.find(a=>a[0]===button.dataset.roomAction);
      if(id==='help'){help=!help;if(help)reset();button.setAttribute('aria-pressed',String(help));hint.textContent=help?'Mode explication : clique sur un bouton pour lire son rôle. Clique sur ? pour quitter ce mode.':'Aide désactivée. Choisis une activité.';return;}
      if(help){hint.textContent=description;return;}
      if(id==='science')location.hash='scene/station';
      else if(id==='games')location.hash='games';
      else if(id==='exit')location.hash='welcome';
      else if(id==='animations'){if(!back.hidden)back.click();frame.classList.add('room-outlines');root.querySelector('#room-outline').checked=true;hint.textContent='Clique sur un objet de la chambre pour découvrir son animation.';}
      else info(label,`<p>${description}</p>`);
    };
  });
  try{
    const [response,idleResponse]=await Promise.all([fetch('/game/room/clips.json'),fetch('/game/room/activities/catalog.json')]);if(!response.ok)throw new Error('Room assets unavailable');
    clips=await response.json();if(!root.isConnected)return;
    if(idleResponse.ok){const catalog=await idleResponse.json();const standing=catalog.artwork.crateActor;
      // Same standing VMD coordinates as the crate; remove its close-up offset.
      idleActor={...standing,x:standing.x+228,y:standing.y+6};}
    if(!root.isConnected)return;
    actor.hidden=false;reset();
  }catch{if(root.isConnected)hint.textContent='Le décor est disponible, mais les animations n’ont pas pu être chargées.';}
}
