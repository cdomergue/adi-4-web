// MCAS provides complete combinations of the five controls; no growth formula is inferred.
export function matchSolution(solutions, values) {
  return solutions.some((solution) =>
    ['1', '2', '3', '4', '5'].every(
      (id) => Number.isInteger(solution[id]) && values[id] === solution[id],
    ),
  );
}

// SL_SIMUL.TOT CalcSimul02, 0xa893..0xabab. Integer divisions truncate.
export function greenhouseGrowth(values) {
  const [water, temperature, light, co2, minerals] = ['1', '2', '3', '4', '5'].map(
    (id) => values[id],
  );
  if (
    ![water, temperature, light, co2, minerals].every(Number.isInteger) ||
    water < 1 ||
    water > 4 ||
    temperature < 1 ||
    temperature > 5 ||
    light < 1 ||
    light > 4 ||
    co2 < 1 ||
    co2 > 4 ||
    minerals < 1 ||
    minerals > 3
  )
    throw new RangeError('Invalid greenhouse setting');
  const div = (a, b) => Math.trunc(a / b);
  const salts = minerals + div(minerals, 2) - div(minerals, 3) * 2 - 1;
  const carbon = co2 - 1 - div(co2, 4);
  const warmth = div(temperature, 3) + div(temperature, 4) + div(temperature, 5);
  const tomato = [
    water - 1 - div(water, 4) * 2,
    temperature - 1 - div(temperature, 5) * 3,
    light - 1 - div(light, 4),
    carbon,
    salts,
  ];
  const product = tomato.reduce((a, b) => a * b, 1),
    sum = tomato.reduce((a, b) => a + b, 0) - 5;
  // For product=1 the sum is zero: explicitly use the zero-growth state.
  const tomatoes = product === 1 ? 0 : sum * div(product, product - 1);
  const strawberry = [
    water - 1,
    warmth,
    light + div(light, 2) - div(light, 3) * 2 - div(light, 4) * 3 - 1,
    carbon,
    salts,
  ];
  const mushroom = [water - 1 - div(water, 4), warmth, 1, 1, salts];
  const growth = (parts) => (parts.includes(0) ? 0 : parts.reduce((a, b) => a + b, 0) - 5);
  return { 7: tomatoes | 0, 8: growth(strawberry) | 0, 9: growth(mushroom) | 0 };
}
