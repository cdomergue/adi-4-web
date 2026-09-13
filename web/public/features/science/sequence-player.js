// Animated WebP has no ended event. Read its actual frame timings rather than
// estimating a duration from the file size or restarting every scene layer.
export function webpDuration(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 12 || view.getUint32(0) !== 0x52494646 ||
      view.getUint32(8) !== 0x57454250) throw new Error('Invalid WebP');
  let duration = 0;
  for (let offset = 12; offset + 8 <= view.byteLength;) {
    const size = view.getUint32(offset + 4, true);
    if (offset + 8 + size > view.byteLength) throw new Error('Truncated WebP');
    if (view.getUint32(offset) === 0x414e4d46 && size >= 16) {
      duration += view.getUint8(offset + 20) + view.getUint8(offset + 21) * 256 +
        view.getUint8(offset + 22) * 65536;
    }
    offset += 8 + size + (size % 2);
  }
  return duration;
}

// sppIntoDisplay orders presentation independently of CalcSequence. GO keeps
// its explicit SEQS order (the two eclipse cameras must stay independent).
export function displaySequence(data, event) {
  const orders = {
    3: [22, 6, 7, 8, 9, 23, 24, 25, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    4: [7, 8, 9, 11, 10, 12],
    6: [6, 12, 8, 9, 10, 13, 7, 11],
    8: [10, 11, 12, 13, 8, 9, 7, 6],
  };
  const sequence = [...event.sequence];
  if (!event.action && orders[data.id]) {
    const rank = orders[data.id].map(String);
    sequence.sort((a, b) => rank.indexOf(a) - rank.indexOf(b));
  }
  return [...new Set([event.trigger, ...sequence])].filter((id) =>
    !data.hidden.includes(id) && (event.action || event.before[id] !== event.after[id] ||
      (data.id === '7' && event.sequence.includes(id) && data.native?.objects[id]?.transition === 2)));
}

export function stateMedia(data, id, state, assets) {
  const names = data.media?.[id]?.[state];
  const option = data.objects.find((o) => o.id === id)?.options.find((o) => o.id === state);
  return assets[names?.direct || names?.increase] || assets[option?.visual];
}

export function transitionSteps(data, event, id, assets) {
  const from = event.before[id], to = event.after[id];
  const names = data.media?.[id];
  if (data.native?.objects[id]?.transition !== 1 || from === to) {
    return [{ state: to, asset: stateMedia(data, id, to, assets) }];
  }
  const steps = [];
  if (to > from) {
    for (let state = from + 1; state <= to; state++) {
      steps.push({ state, asset: assets[names?.[state]?.increase] });
    }
  } else {
    // PlayDecSeqAnim starts with the OLD state's RMD and stops at new + 1.
    for (let state = from; state > to; state--) {
      steps.push({ state: state - 1, asset: assets[names?.[state]?.decrease] });
    }
  }
  return steps;
}

export function createSequencePlayer({ draw, voice, unavailable, movie }) {
  const durations = new Map();
  let controller = null;
  function reset() { controller?.abort(); controller = null; }
  async function play(data, event, assets) {
    reset();
    controller = new AbortController();
    const { signal } = controller;
    for (const id of displaySequence(data, event)) {
      if (signal.aborted) return false;
      if (movie && await movie(data, id, event.after[id], signal)) continue;
      const object = data.objects.find((o) => o.id === id);
      const option = object.options.find((o) => o.id === event.after[id]);
      const steps = transitionSteps(data, event, id, assets);
      for (const [index, step] of steps.entries()) {
        const asset = step.asset;
        let duration = 0;
        if (asset?.motion) {
          try {
            if (!durations.has(asset.motion)) {
              const response = await fetch(asset.motion, { signal });
              if (!response.ok) throw new Error('Missing motion');
              durations.set(asset.motion, webpDuration(await response.arrayBuffer()));
            }
            duration = durations.get(asset.motion);
          } catch {
            if (signal.aborted) return false;
            unavailable();
          }
        }
        if (signal.aborted) return false;
        draw(id, step.state, duration > 0 ? asset : null);
        await Promise.all([
          voice(index === steps.length - 1 ? option?.audio : null, signal),
          new Promise((resolve) => {
            const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
            const timer = setTimeout(done, duration);
            signal.addEventListener('abort', done, { once: true });
          }),
        ]);
        if (signal.aborted) return false;
        draw(id, step.state, null);
      }
    }
    return !signal.aborted;
  }
  return { play, reset, dispose: reset };
}
