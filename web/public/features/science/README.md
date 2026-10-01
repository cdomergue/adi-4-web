# Station Sciences : décors et médias

Les huit décors possèdent les rectangles des fichiers `NIV3.INI` à `NIV6.INI`.
Le navigateur réunit les destinations des deux disques : une expérience reste
accessible même lorsque son niveau d’origine diffère du niveau sélectionné.
Les [scènes](scenes.js) associent ces rectangles aux expériences et documents.

## Films et documents

L’arrivée à la station lit `INTRO.VMD`. Le retour à la chambre depuis le bouton
Retour de la station lit `SHIP6.VMD`. Les lecteurs disposent de commandes de
lecture et de passage lorsque le navigateur refuse la lecture automatique.

Les neuf [documents des laboratoires](../../game/science-media/documents.json)
utilisent `FPEDAGO.NOMVMD`, le décor `MENU03.BRC` et l’origine `(72, 45)` de
`AE_FOURM::LanceAnim`. Les volcans, la fossilisation, la température, les
frottements, la sécurité électrique, l’infarctus, le petit déjeuner, les insectes
et la reproduction sexuée se consultent depuis leurs objets dans les laboratoires.
Ils sont aussi recherchables dans l’encyclopédie. Le livre ouvre le cours et
l’ancre `FPEDAGO.REFHTML` associés. Le bouton des exercices n’a pas encore de
moteur web.

Le [lecteur cinéma](cinema-player.js) suit `SL_SIMUL::PlayDirectAnim` pour les
objets `PERSOOB=-1` :

| Expérience | Objets | Origine | Cadre | Films |
| --- | --- | --- | --- | --- |
| Fourmilière | 5, 6, 7 | 121, 112 | `07ZOOM.BRC` | 41 |
| Dinosaures | 5 | 142, 48 | Moniteur du décor | 27 |
| Éclipse | 11, 12 | 171, 114 | `13ZOOM.BRC` | 7 |

Ces films sont temporaires et opaques. Leur fin, leur fermeture ou une navigation
restaure les commandes et le décor. Les boucles sonores sont suspendues pendant
le cinéma. Les vidéos H.264 conservent le nombre d’images et la cadence du VMD ;
le son provient de sa piste PCM. Le remplissage nécessaire aux dimensions paires
est masqué, sans supprimer les pixels originaux.

## Ambiances et Adi

[scene-media.js](scene-media.js) possède les canaux de boucle, voix et effets.
Les huit boucles sont `VUEXLOOP`, `VUINLOOP`, `GEOLOOP`, `CHIMLOOP`, `PHYLOOP`,
`SANTLOOP`, `ELELOOP` et `VIELOOP`. Les séquences aléatoires proviennent de
`AE_ANIM::BankAlea` ; les animations ont leur position native, des images espacées
de 80 ms et leur son VMW associé. Le choix exclut la séquence précédente.

[narration.js](narration.js) sélectionne les interventions de `AE_ADI::AdiGestion`
selon le niveau et le nombre de visites. Les 68 clips utilisent les poses
`ADIPOSA`, `ADIPOSD` et `ADIPOSZ`, les positions et les offsets de visage du script.
Les apparitions et disparitions emploient 17 paliers espacés de 20 ms.
La clé `adi4-science-visits-v1` mémorise les compteurs de visite ; une nouvelle
navigation interne ne répète pas la présentation dans la même session.
« Écouter Adi » permet sa relecture. Refuser le stockage conserve les compteurs
en mémoire pour la session.

[simulation-audio.js](simulation-audio.js) associe les boucles de `SIMULS.AMBVMD`
et les ambiances d’état de `TOBJAMB` à chaque expérience. Les présentations
`WLC{niveau}N{partie}`, la voix des objectifs et les réussites `EVL{cas}1` sont
lues sur un canal distinct. Les encouragements `ASOL1` à `ASOL3` suivent la progression du parcours ou
la proximité de la meilleure solution, avec le repli `__ASOL` du script.
L’animation transparente `BRAVO` utilise ses 41 images à 50 images/s.
Les voix des observations restent attachées aux séquences de l’expérience. Un réglage ou une sortie interrompt une présentation.

Les [catalogues de médias](../../game/science-media/) indiquent les sources,
leurs SHA-256, les cadences et les positions. Les exports ne nécessitent pas
l’installation du jeu pour fonctionner. Les fichiers sont vérifiés par le
[manifeste](../../../asset-manifest.json) lors du build.

## Vérification et limites

Les tests parcourent les 27 combinaisons lieu/heure/appât de Dinosaures et leur
relecture, les sept gros plans de l’éclipse, les neuf destinations vidéo,
les variantes d’Adi et les changements d’ambiance. L’inventaire des deux éditions
de l’encyclopédie compte 484 entrées chacune, dont 37 films distincts : leurs
nombres d’images correspondent aux VMD et chacun possède une piste audio.
Les références manquantes des pages `COURS.HTM` (`FGG`, `JGH`, `DSFDS`, `FGDFG`)
sont présentes telles quelles dans ce gabarit original ; aucun média correspondant
n’est identifié dans les tables des deux disques.

- `SANT3.VMD`, cité par la banque aléatoire du centre de santé, est absent des
  ressources des deux disques. Le sélecteur l’exclut.
- L’animation de « Tolérance greffe » reste absente des ressources disponibles ;
  le résultat textuel de l’immunologie reste consultable.
- Les panneaux de paramètres et d’aide des 14 expériences sont adaptés au web.
  Les mouvements d’attente propres aux personnages des simulations, les
  annonces de choix de solution `SOL` et les messages d’interdiction
  sonores ne sont pas tous raccordés.
- Le mélange des couleurs, les arrondis de cadence du WebP animé, les transitions
  interrompues et le volume relatif des trois canaux nécessitent une comparaison
  audiovisuelle prolongée avec Windows. Les tests de règles et de fichiers
  n’établissent pas une identité audiovisuelle complète.
- La navigation générale vers la chambre interrompt directement les médias ;
  le film de départ appartient au bouton Retour de la station.
