export function readScores(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(row => row && typeof row.name === 'string' &&
    Number.isInteger(row.score) && row.score > 0 && row.score < 100000)
    .map(row => ({ name: row.name.slice(0, 17), score: row.score }))
    .sort((a, b) => b.score - a.score).slice(0, 10);
}

// 1010:17ab and 02c0: strictly higher than the tenth score; ties remain behind
// existing entries. Position 18 of the 21-byte record is overwritten by score.
export function qualifies(scores, score) {
  return score > (scores[9]?.score ?? 0);
}

export function insertScore(scores, name, score) {
  if (!qualifies(scores, score)) return scores;
  return readScores([...scores, { name, score }]);
}
