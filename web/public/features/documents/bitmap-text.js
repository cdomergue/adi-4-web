// Original ADI bitmap-font layout and Canvas rendering.

export function glyphFor(font, character) {
  if (font?.characters?.[character]) return font.characters[character];
  return font?.glyphs?.find((glyph) => glyph.char === character) || null;
}

export function normalizeBitmapText(text, font) {
  let result = String(text ?? '').replace(/[‘’]/g, "'");
  if (!glyphFor(font, 'œ')) result = result.replace(/œ/g, 'oe');
  if (!glyphFor(font, 'Œ')) result = result.replace(/Œ/g, 'OE');
  return result;
}

export function measureBitmapText(text, font) {
  const normalized = normalizeBitmapText(text, font);
  let width = 0;
  const glyphs = [];
  for (const character of normalized) {
    if (character === '\n') continue;
    const glyph = glyphFor(font, character) || glyphFor(font, '?');
    if (!glyph) continue;
    glyphs.push({ character, glyph });
    width += glyph.advance;
  }
  return { text: normalized, width, glyphs };
}

function line(text, font, align, width) {
  const measured = measureBitmapText(text, font);
  const x =
    align === 'center'
      ? Math.max(0, (width - measured.width) / 2)
      : align === 'right'
        ? Math.max(0, width - measured.width)
        : 0;
  return { ...measured, x };
}

function wrapParagraph(paragraph, font, width, align) {
  if (!paragraph) return [line('', font, align, width)];
  const words = paragraph.trim().split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measureBitmapText(candidate, font).width > width) {
      lines.push(line(current, font, align, width));
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(line(current, font, align, width));
  return lines;
}

/**
 * Produce DOM-independent original-font layout.  Words are never split: a word
 * wider than the requested width occupies its own overflowing line.
 */
export function wrapBitmapText(text, font, { width = Infinity, align = 'left' } = {}) {
  const normalized = normalizeBitmapText(text, font).replace(/\r\n?/g, '\n');
  const constraint = Number.isFinite(width) && width >= 0 ? width : Infinity;
  return normalized
    .split('\n')
    .flatMap((paragraph) => wrapParagraph(paragraph, font, constraint, align));
}

/**
 * Replace an element's contents with the supplied bitmap font rendered to Canvas.
 * `atlas` is a loaded Image/Canvas whose source cells are described by `font`.
 */
export function renderBitmapText(
  element,
  text,
  { font, atlas, width, height, lineHeight = font?.height, color = '#ffffff', align = 'left' } = {},
) {
  if (!element?.ownerDocument) throw new TypeError('renderBitmapText requires a DOM element');
  if (!font || !atlas) throw new TypeError('font and atlas are required');
  const layoutWidth =
    width ?? Math.max(...wrapBitmapText(text, font).map((entry) => entry.width), 0);
  const lines = wrapBitmapText(text, font, { width: layoutWidth, align });
  const resolvedLineHeight = lineHeight ?? font.height;
  const canvas = element.ownerDocument.createElement('canvas');
  canvas.width = layoutWidth;
  canvas.height = height ?? Math.max(0, (lines.length - 1) * resolvedLineHeight + font.height);
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const entry = lines[lineIndex];
    let x = entry.x;
    const y = lineIndex * resolvedLineHeight;
    for (const { glyph } of entry.glyphs) {
      context.drawImage(
        atlas,
        glyph.x,
        glyph.y,
        glyph.width,
        glyph.height,
        x,
        y,
        glyph.width,
        glyph.height,
      );
      x += glyph.advance;
    }
  }
  // The atlas is a white alpha mask.  source-in retains its alpha while applying
  // the original palette-selected ink colour in one deterministic operation.
  context.save();
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
  const accessibleName = element.getAttribute('aria-label') || normalizeBitmapText(text, font);
  element.setAttribute('aria-label', accessibleName);
  element.replaceChildren(canvas);
  return { canvas, lines, width: canvas.width, height: canvas.height };
}
