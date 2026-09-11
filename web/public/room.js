const actions=[
  ['internet','Internet','BARINTER','Les classes virtuelles et les services Internet d’époque ne sont pas disponibles dans cette version locale.'],
  ['science','Les matières','BARAPPLI','Ouvre l’application Sciences et sa station spatiale.'],
  ['games','Les jeux','BARJEUX','Ouvre les jeux de la chambre d’Adi.'],
  ['tools','Les outils','BAROUTIL','Les outils de la chambre restent à reconstruire.'],
  ['documents','Les documents','BARDOCS','Les documents de la chambre restent à reconstruire.'],
  ['animations','Les animations','BARANIM','Les surprises et animations de la chambre restent à reconstruire.'],
  ['help','Aide','BARAIDE','Active ou désactive les explications des boutons.'],
  ['exit','Sortir','BARPORTE','Reviens à l’accueil.'],
];
export function renderRoom(main,info){
  document.title='La chambre d’Adi · ADI 4';
  main.innerHTML=`<section class="original-scene"><div class="scene-heading"><h1>La chambre d’Adi</h1><button class="button secondary" id="room-show-toolbar" aria-expanded="false">Afficher les boutons</button></div>
  <div class="scene-frame room-frame"><img src="/game/room/bedroom.webp" width="640" height="480" alt="La chambre originale d’Adi, avec son bureau, ses jouets et son télescope">
    <div class="room-toolbar-edge" aria-hidden="true"></div>
    <nav class="room-toolbar" aria-label="Les activités de la chambre">${actions.map(([id,label,asset])=>`<button data-room-action="${id}" aria-label="${label}" title="${label}"><img src="/game/room/${asset}.webp" data-still="/game/room/${asset}.webp" data-motion="/game/room/${asset}-motion.webp" alt=""><span>${label}</span></button>`).join('')}</nav>
  </div><p id="room-hint" role="status">Descends la souris tout en bas de la chambre pour faire apparaître les huit boutons.</p>
  <nav class="scene-links"><a class="button secondary" href="#scene/station">Les matières →</a><a class="button secondary" href="#games">Les jeux →</a></nav>
  <p class="development-note">Chambre en reconstruction : vue de référence du jeu original, Adi encore immobile. La barre reprend les boutons animés extraits du jeu.</p></section>`;
  const root=main.firstElementChild,frame=root.querySelector('.room-frame'),hint=root.querySelector('#room-hint');let help=false;
  const toggle=root.querySelector('#room-show-toolbar');toggle.onclick=()=>{const open=frame.classList.toggle('toolbar-pinned');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Masquer les boutons':'Afficher les boutons';};
  root.querySelectorAll('[data-room-action]').forEach(button=>{
    const image=button.querySelector('img');
    button.onpointerenter=button.onfocus=()=>image.src=image.dataset.motion;
    button.onpointerleave=button.onblur=()=>image.src=image.dataset.still;
    button.onclick=()=>{
      const [id,label,,description]=actions.find(a=>a[0]===button.dataset.roomAction);
      if(id==='help'){help=!help;button.setAttribute('aria-pressed',String(help));hint.textContent=help?'Mode explication : clique sur un bouton pour lire son rôle. Clique sur ? pour quitter ce mode.':'Aide désactivée. Choisis une activité.';return;}
      if(help){hint.textContent=description;return;}
      if(id==='science')location.hash='scene/station';
      else if(id==='games')location.hash='games';
      else if(id==='exit')location.hash='welcome';
      else info(label,`<p>${description}</p>`);
    };
  });
}
