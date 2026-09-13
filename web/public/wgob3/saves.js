// Portable backup validation, independent of the Emscripten filesystem.
export function decodeBackup(text, target = 'wgob3') {
  if (!/^wgob[123]$/.test(target)) throw new Error('Jeu inconnu.');
  if (text.length > 12 * 1024 * 1024) throw new Error('Sauvegarde trop volumineuse.');
  const backup = JSON.parse(text);
  if (backup.format !== `adi4-${target}-saves-v1` || !Array.isArray(backup.files) || backup.files.length > 200) {
    throw new Error(`Ce fichier n’est pas une sauvegarde ${target.toUpperCase()}.`);
  }
  const names = new Set();
  return backup.files.map(file => {
    if (!file || typeof file.name !== 'string' || !new RegExp(`^${target}\\.[a-z0-9_-]{1,30}$`, 'i').test(file.name) || names.has(file.name)) {
      throw new Error('Nom de sauvegarde invalide ou présent deux fois.');
    }
    names.add(file.name);
    if (typeof file.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) {
      throw new Error('Données de sauvegarde invalides.');
    }
    return {name: file.name, bytes: Uint8Array.from(atob(file.data), char => char.charCodeAt(0))};
  });
}

export function encodeBackup(files, target = 'wgob3') {
  if (!/^wgob[123]$/.test(target)) throw new Error('Jeu inconnu.');
  return JSON.stringify({format: `adi4-${target}-saves-v1`, files: files.map(({name, bytes}) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return {name, data: btoa(binary)};
  })}, null, 2);
}
