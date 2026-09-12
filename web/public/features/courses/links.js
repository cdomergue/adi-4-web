// Original #EMM links contain an identifier followed by a numeric link type.
// Type 7 refers to FDICO, not to the multimedia encyclopedia (Femm).
export function parseOriginalLink(value) {
  const raw = String(value ?? '')
    .trim()
    .replace(/^#EMM:/i, '');
  const match = /^(\S+)\s+(\d+)\s*$/.exec(raw);
  return { id: (match ? match[1] : raw).toUpperCase(), type: match ? Number(match[2]) : null };
}

export function findOriginalDefinition(dictionary, id) {
  const key = Object.keys(dictionary).find(
    (word) => word.trim().toUpperCase() === id.toUpperCase(),
  );
  return key === undefined ? null : dictionary[key];
}
