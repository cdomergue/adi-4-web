export function renderWelcome(main) {
  document.title = 'Chez Adi · ADI 4';
  main.innerHTML = `<section class="welcome welcome-with-intro">
    <div class="welcome-copy">
      <p class="eyebrow">BIENVENUE À LA MAISON</p>
      <h1>De retour<br>chez <span>Adi.</span></h1>
      <p class="intro">« Eh oh, salut petit terrien ! »<br>Un vieil ami. Tout un monde à redécouvrir.</p>
      <a class="button primary" href="#room">Entrer dans la chambre <span>↗</span></a>
    </div>
    <figure class="welcome-film">
      <video controls playsinline preload="none" poster="/game/welcome/poster.webp" aria-label="L’introduction originale d’Adi 4 : arrivée du vaisseau et salut d’Adi">
        <source src="/game/welcome/intro.mp4" type="video/mp4">
        <track kind="captions" src="/game/welcome/intro.fr.vtt" srclang="fr" label="Français">
        Ton navigateur ne peut pas lire cette vidéo. Tu peux entrer directement dans la chambre.
      </video>
      <figcaption>
        <button type="button" class="button" data-intro-play>Lancer l’introduction avec le son</button>
        <p class="quiet" role="status" data-intro-status>Le vaisseau d’Adi · Introduction originale</p>
      </figcaption>
    </figure>
  </section>
  <section class="destinations" aria-label="Les lieux d’Adi">
    <a class="destination room-card" href="#room"><img src="/game/room.webp" alt="Le télescope et le bureau de la chambre"><div><p class="eyebrow">01 / LE POINT DE DÉPART</p><h2>La chambre d’Adi <span>↗</span></h2><p>Le bureau, les objets, les petits rituels…<br>Retrouve Adi et sa caisse de jeux.</p><span class="tag">Entrer dans la chambre</span></div></a>
    <a class="destination science-card" href="#scene/station"><img src="/game/space.webp" alt="Planètes et fusée dans l’illustration originale"><div><p class="eyebrow">02 / LE GOÛT DE COMPRENDRE</p><h2>La station Sciences <span>↗</span></h2><p>Le vivant, la matière, les phénomènes.<br>Ouvre les cours de ton niveau.</p><span class="tag">Explorer la station</span></div></a>
  </section>`;

  const video = main.querySelector('video');
  const play = main.querySelector('[data-intro-play]');
  const status = main.querySelector('[data-intro-status]');
  play.addEventListener('click', async () => {
    if (!video.paused) {
      video.pause();
      return;
    }
    if (video.ended) video.currentTime = 0;
    // A direct user gesture allows audible playback without an autoplay exception.
    video.muted = false;
    try {
      await video.play();
    } catch {
      status.textContent = 'Utilise le bouton de lecture de la vidéo pour lancer l’introduction.';
    }
  });
  video.addEventListener('play', () => {
    play.textContent = 'Mettre en pause';
    status.textContent = 'Introduction en cours';
  });
  video.addEventListener('pause', () => {
    play.textContent = 'Reprendre l’introduction';
    status.textContent = 'Introduction en pause';
  });
  video.addEventListener('ended', () => {
    play.textContent = 'Revoir l’introduction';
    status.textContent = 'Bienvenue chez Adi ! Entre dans la chambre quand tu veux.';
  });
  video.addEventListener('error', () => {
    status.textContent = 'La vidéo n’a pas pu être chargée. Tu peux entrer directement dans la chambre.';
  });
}
