// 1020:051f/038e and 003a/0698. Original 8px self-copy propagation.
export function lineCommands(line, flash = false, animate = false) {
  const { vertical, start, end, position } = line;
  const commands = [];
  const icon = (id, x, y) => commands.push(['icon', id, x, y, x + 32, y + 32]);
  if (vertical) {
    const x = position + 2, y = start + 21;
    icon(flash ? 155 : 142, x, y);
    let i = 0;
    do {
      i += 8;
      commands.push(['copy', x, y, x + 6, y + 8, x, y + i, x + 6, y + i + 8]);
      if (animate) commands.push(['wait', line.wait ?? 1000 / 60]);
    } while (start + i <= end - 43);
    if (flash) {
      icon(155, x, end - 34);
      icon(155, x, end - 23);
    } else icon(142, x, y);
  } else {
    const x = start + 20, y = position + 3;
    icon(flash ? 279 : 189, x, y);
    let i = 0;
    do {
      i += 8;
      commands.push(['copy', x + 2, y, x + 10, y + 6, x + i, y, x + i + 8, y + 6]);
      if (animate) commands.push(['wait', line.wait ?? 1000 / 60]);
    } while (start + i <= end - 26);
    icon(flash ? 279 : 189, end - 3, y);
    icon(flash ? 279 : 189, end + 8, y);
  }
  return commands;
}

export function deathLines(state) {
  const r = state.rules;
  const lines = [['1018', '1014', '1016'], ['103c', '1038', '103a'],
    ['1034', '1030', '1032'], ['102c', '1028', '102a']]
    .slice(0, r['0f5c']).map(([start, end, position], i) =>
      ({ start: r[start], end: r[end], position: r[position], vertical: false,
        wait: i < 2 ? 1000 / 60 : 1000 / 120 }));
  if (r['0d12'] || r['0d18'] || (state.stage === 17 && !r['14e0'])) {
    lines.push({ start: r['1002'], end: r['0ffe'], position: r['1004'], vertical: true });
  }
  return lines;
}

export function lossCommands(state, event) {
  const r = state.rules;
  const vertical = Boolean(r['0d12'] ? event.x > r['1004'] && event.x < r['1004'] + 5 &&
    event.y < r['0ffe'] - 9 && event.y > r['1002'] + 3 : r['0d18']);
  const second = !vertical && (r['0d16'] ? event.y > r['103a'] + 5 :
    r['0f5e'] && event.x > r['1014'] + 35);
  const line = vertical ? { vertical: true, start: r['1002'], end: r['0ffe'], position: r['1004'] } :
    { vertical: false, start: r[second ? '103c' : '1018'],
      end: r[second ? '1038' : '1014'], position: r[second ? '103a' : '1016'] };
  const commands = lineCommands(line, true);
  // 1010:0d96: five overlaid frames, erase, sixth frame at the death line.
  for (let i = 1; i <= 5; i++) commands.push(['wait', 1000 / 6],
    ['icon', 3000 + i + (vertical ? 10 : 0), event.x - 10, event.y - 10, event.x + 11, event.y + 11]);
  commands.push(['background', event.x - 10, event.y - 10, event.x + 11, event.y + 11]);
  const x = vertical ? line.position - 6 : event.x - 11;
  const y = vertical ? event.y - 8 : (r['0d16'] && second ? line.position : r['1016']) - 5;
  commands.push(['icon', vertical ? 3016 : 3006, x, y, x + 21, y + 21], ['wait', 1000 / 6]);
  commands.push(...lineCommands(line, false, true));
  return commands;
}
