export async function renderGames(main,info){
  document.title='Les jeux · ADI 4';main.innerHTML='<section><a class="back-link" href="#room">← La chambre</a><h1>Les jeux</h1><p role="status">Ouverture de la ludothèque…</p></section>';
  const root=main.firstElementChild;
  try{
    const response=await fetch('/game/games/catalog.json');if(!response.ok)throw new Error('catalog');const games=await response.json();if(!root.isConnected)return;
    root.querySelector('[role=status]').textContent='Les jeux originaux retrouvés sur les disques. Leur recréation est en cours.';
    for(const [label,available] of [['Disponibles',true],['À venir',false]]){
      const entries=games.filter(game=>Boolean(game.route)===available).sort((a,b)=>a.title.localeCompare(b.title,'fr'));
      if(!entries.length)continue;
      const group=document.createElement('section');group.className='games-group';group.setAttribute('aria-label',label);
      const heading=document.createElement('h2');heading.textContent=`${label} (${entries.length})`;group.append(heading);
      const grid=document.createElement('div');grid.className='simulation-grid';group.append(grid);root.append(group);
      for(const game of entries){
      const button=document.createElement('button');button.className='simulation-card encyclopedia-card';
      if(game.image){const img=document.createElement('img');img.src=game.image;img.alt='';img.loading='lazy';button.append(img);}
      const title=document.createElement('h3');title.textContent=game.title;button.append(title);
      const status=document.createElement('p');status.textContent=game.route?'Jouer →':'Recréation en cours';button.append(status);
      button.onclick=()=>game.route?location.hash=game.route:info(game.title,'<p>Ce jeu a été retrouvé sur les disques. Ses règles et ses ressources sont en cours d’analyse pour le recréer dans le navigateur.</p>');grid.append(button);
      }
    }
  }catch{if(root.isConnected)root.querySelector('[role=status]').textContent='La ludothèque est indisponible.';}
}
