// Native scenes use a 640 × 480 coordinate system, independent of viewport size.
export function clipBox(box) {
  if (!box || box.length !== 4 || !box.every(Number.isFinite)) return null;
  const [x, y, w, h] = box;
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x >= 640 || y >= 480) return null;
  return [x, y, Math.min(w, 640 - x), Math.min(h, 480 - y)];
}

export function position(box) {
  const [x, y, w, h] = box;
  return `left:${x / 6.4}%;top:${y / 4.8}%;width:${w / 6.4}%;height:${h / 4.8}%`;
}

export function caseData(data, currentCase) {
  return {
    ...data,
    objects: data.objects.map((object) => ({
      ...object,
      options: object.options.map((option) => ({
        ...option,
        ...currentCase.options?.[object.id]?.[option.id],
      })),
    })),
  };
}

export function optionLabel(object, option, config = {}) {
  if (config.labels?.[option.id]) return config.labels[option.id];
  if (config.mode === 'action') return option.id === 1 ? 'Prêt' : 'Lancé';
  return usefulLabel(option.label) || `${object.label} — position ${option.id}`;
}

export function usefulLabel(label) {
  return /^(?:intitulé état|empty|pas de commentaire)/i.test(label?.trim() || '') ? '' : label;
}

export function activeControls(data, definition, currentCase) {
  return data.objects.filter((object) => definition.controls[object.id] &&
    (!definition.isVisible || definition.isVisible(object, currentCase)));
}

export function sceneTargets(data, definition, currentCase) {
  return activeControls(data, definition, currentCase).flatMap((object) => {
    const config = definition.controls[object.id];
    const target = (box, action, state, label) => ({
      object: object.id, box: clipBox(box), action, state, label,
    });
    if (config.mode === 'panel') {
      return [target(object.box, 'panel', null, `Choisir : ${object.label}`)];
    }
    if (config.mode === 'action' || config.mode === 'toggle') {
      return [target(object.box, config.mode, config.state || 2, config.label || object.label)];
    }
    const targets = object.options.flatMap((option) => (option.zones || [])
      .filter(clipBox)
      .map((box) => target(box, 'select', option.id,
        `${object.label} : ${optionLabel(object, option, config)}`)));
    // Supplemental panels are explicitly positioned by the experiment, never a large
    // invisible object rectangle layered over the smaller native click targets.
    if (config.panelBox) targets.push(target(config.panelBox, 'panel', null, config.panelLabel));
    return targets;
  }).filter((target) => target.box);
}

export function targetState(target, object, selected) {
  if (target.action !== 'toggle') return target.state;
  const index = object.options.findIndex((option) => option.id === selected[object.id]);
  return object.options[(index + 1) % object.options.length].id;
}
