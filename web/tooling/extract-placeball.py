"""Export Place Ball NE artwork and PBWIN.UDF (requires Pillow, not needed to build)."""
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
from PIL import Image


def word(data, offset):
    return struct.unpack_from('<H', data, offset)[0]


def dib(data):
    width, height, planes, bits, compression = struct.unpack_from('<iiHHI', data, 4)
    colors = struct.unpack_from('<I', data, 32)[0] or (1 << bits)
    offset = 40 + colors * 4
    if compression != 2:
        header = b'BM' + struct.pack('<III', len(data) + 14, 0, offset + 14)
        return Image.open(io.BytesIO(header + data)).convert('RGBA')
    # Windows BI_RLE4, including absolute runs, word padding and deltas.
    pixels = bytearray(width * height)
    x, y, p = 0, height - 1, offset
    while p + 1 < len(data):
        count, value = data[p:p + 2]
        p += 2
        if count:
            values = [(value >> 4) if i % 2 == 0 else value & 15 for i in range(count)]
        elif value == 0:
            x, y = 0, y - 1
            continue
        elif value == 1:
            break
        elif value == 2:
            x += data[p]
            y -= data[p + 1]
            p += 2
            continue
        else:
            values = [data[p + i // 2] >> 4 if i % 2 == 0 else data[p + i // 2] & 15
                      for i in range(value)]
            p += ((value + 1) // 2 + 1) & ~1
        for color in values:
            if 0 <= x < width and 0 <= y < height:
                pixels[y * width + x] = color
            x += 1
    image = Image.frombytes('P', (width, height), bytes(pixels))
    image.putpalette([v for i in range(colors) for v in data[40 + 4*i:43 + 4*i][::-1]])
    return image.convert('RGBA')


def export(source, target):
    exe = (source / 'PLACEBFR.EXE').read_bytes()
    udf = (source / 'PBWIN.UDF').read_bytes()
    target.mkdir(parents=True, exist_ok=True)
    ne = struct.unpack_from('<I', exe, 60)[0]
    base = ne + word(exe, ne + 36)
    shift, p = word(exe, base), base + 2
    images, sounds, strings = {}, {}, {}
    while word(exe, p):
        kind, count = word(exe, p), word(exe, p + 2)
        p += 8
        if not kind & 0x8000:
            start = base + kind
            kind = exe[start + 1:start + 1 + exe[start]].decode('ascii')
        else:
            kind &= 0x7fff
        for _ in range(count):
            offset, size, _, ident = struct.unpack_from('<HHHH', exe, p)
            ident &= 0x7fff
            data = exe[offset << shift:(offset + size) << shift]
            p += 12
            if kind == 2:
                image = dib(data)
                image.save(target / f'bitmap-{ident}.png')
                images[ident] = list(image.size)
            elif kind == 'WAVE':
                assert data[:4] == b'RIFF'
                data = data[:struct.unpack_from('<I', data, 4)[0] + 8]
                (target / f'sound-{ident}.wav').write_bytes(data)
                sounds[ident] = hashlib.sha256(data).hexdigest()
            elif kind == 6:
                q = 0
                for i in range(16):
                    n = data[q]
                    if n:
                        strings[(ident - 1) * 16 + i] = data[q+1:q+1+n].decode('cp1252')
                    q += n + 1
    lines = [line.split(';')[0].strip() for line in udf.decode('cp1252').splitlines()]
    count = int(lines[lines.index('$GAME') + 1])
    levels = []
    for number in range(1, count + 1):
        start = lines.index(f'$PUZZLE {number}') + 1
        columns = lines[start:start + 26]
        assert len(columns) == 26 and all(len(c) == 32 and c.isdigit() for c in columns)
        levels.append({'number': number, 'columns': columns})
    campaign = {'version': 1, 'width': 26, 'height': 16, 'levels': levels,
                'secret': lines[lines.index('$SECRETWORD') + 1],
                'sourceSha256': hashlib.sha256(udf).hexdigest()}
    (target / 'campaign.json').write_text(json.dumps(campaign, indent=2) + '\n')
    manifest = {'executableSha256': hashlib.sha256(exe).hexdigest(),
                'images': images, 'sounds': sounds, 'strings': strings}
    (target / 'artwork.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    export(Path(sys.argv[1]), Path(sys.argv[2]))
