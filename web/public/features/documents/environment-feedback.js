// MOTEUR:a028, a17e: success animation, or a spoken hint every third check.
export function feedbackName(state, example, count) {
  const correct = example.inputs.filter((value, i) => state.inputs[i] === value).length;
  if (correct === example.inputs.length) return 'SGAGNE';
  if (count % 3 !== 0) return null;
  if (correct === example.inputs.length - 1) return 'SRECPAR3';
  return (correct * 100) / example.inputs.length < 30 ? 'SRECPAR1' : 'SRECPAR2';
}
