export const nativeDocuments = {
  s08: { title: 'Le développement d’un pays', program: 'S08', archive: 'SIMULC' },
};

export function documentFiles(id, manifest) {
  const spec = Object.hasOwn(nativeDocuments, id) ? nativeDocuments[id] : null;
  if (!spec) throw new Error('Document inconnu.');
  const names = [
    'INTRO.STK',
    'AE63F421.CD1',
    'CURSOR32.DLL',
    `${spec.archive}.STK`,
    `${spec.archive}.ITK`,
  ];
  return names.map((name) => {
    const file = manifest.files.find((entry) => entry.name === name);
    if (
      !file ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    ) {
      throw new Error(`Ressource invalide : ${name}`);
    }
    return file;
  });
}
