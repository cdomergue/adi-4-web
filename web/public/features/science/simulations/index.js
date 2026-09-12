import dairy from './dairy.js';
import greenhouse from './greenhouse.js';
import lightning from './lightning.js';
import genetics from './genetics.js';
import packaging from './packaging.js';
import erosion from './erosion.js';
import anthill from './anthill.js';
import trout from './trout.js';
import health from './health.js';
import dinosaurs from './dinosaurs.js';
import atmosphere from './atmosphere.js';
import eclipse from './eclipse.js';
import reproduction from './reproduction.js';
import immunity from './immunity.js';

export const experiments = Object.fromEntries([
  dairy, greenhouse, lightning, genetics, packaging, erosion, anthill,
  trout, health, dinosaurs, atmosphere, eclipse, reproduction, immunity,
].map((experiment) => [experiment.id, experiment]));
