"""Export BeeBop II NE images and sounds. Requires Pillow and ffmpeg, not at runtime.

Usage: python extract-beebop2.py BEEBOP2.EXE output-directory
"""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import wave
from PIL import Image

spec = importlib.util.spec_from_file_location('placeball_export', Path(__file__).with_name('extract-placeball.py'))
decoder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(decoder)


def resources(exe):
    word = lambda p: struct.unpack_from('<H', exe, p)[0]
    ne = struct.unpack_from('<I', exe, 60)[0]
    base = ne + word(ne + 36)
    shift, p = word(base), base + 2
    def name(value):
        if value & 0x8000:
            return value & 0x7fff
        start = base + value
        return exe[start + 1:start + 1 + exe[start]].decode('ascii')
    result = {}
    while word(p):
        kind, count = name(word(p)), word(p + 2)
        p += 8
        for _ in range(count):
            offset, size, flags, ident = struct.unpack_from('<4H', exe, p)
            p += 12
            result[kind, name(ident)] = exe[offset << shift:(offset + size) << shift]
    return result


def export(source, target):
    exe = source.read_bytes()
    assert hashlib.sha256(exe).hexdigest() == '948ed1705fc585a7f9583619ffe34365f657207c7de1827c17c4b9471ff737ad'
    data = resources(exe)
    manifest = {'episode': 2, 'executableSha256': hashlib.sha256(exe).hexdigest(),
                'bitmaps': {}, 'icons': {}, 'sounds': {}, 'soundDurations': {}}
    for group in ['bitmaps', 'icons', 'sounds']:
        (target / group).mkdir(parents=True, exist_ok=True)
    for (kind, ident), raw in data.items():
        if kind == 2:
            image = decoder.dib(raw)
            path = f'bitmaps/bitmap-{ident}.png'
            image.save(target / path)
            manifest['bitmaps'][ident] = {'path': path, 'width': image.width, 'height': image.height}
        elif kind == 14:
            # Windows group icon entries have 14 bytes; ICO entries have 16.
            count = struct.unpack_from('<H', raw, 4)[0]
            entries, bodies, offset = [], [], 6 + count * 16
            for i in range(count):
                entry = raw[6 + 14*i:20 + 14*i]
                child = struct.unpack_from('<H', entry, 12)[0]
                size = struct.unpack_from('<I', entry, 8)[0]
                body = data[3, child][:size]
                entries.append(entry[:12] + struct.pack('<I', offset))
                bodies.append(body)
                offset += len(body)
            image = Image.open(io.BytesIO(raw[:6] + b''.join(entries + bodies))).convert('RGBA')
            path = f'icons/icon-{ident}.png'
            image.save(target / path)
            manifest['icons'][ident] = {'path': path, 'width': image.width, 'height': image.height}
        elif kind == 'WAVE':
            start = raw.find(b'RIFF')
            assert start >= 0, ident
            size = struct.unpack_from('<I', raw, start + 4)[0] + 8
            path = f'sounds/{ident}-pcm.wav'
            with tempfile.NamedTemporaryFile(suffix='.wav') as temp:
                temp.write(raw[start:start + size])
                temp.flush()
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', temp.name,
                                '-c:a', 'pcm_s16le', str(target / path)], check=True)
            manifest['sounds'][ident] = path
            with wave.open(str(target / path)) as audio:
                manifest['soundDurations'][ident] = audio.getnframes() / audio.getframerate()
    (target / 'artwork.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print({key: len(manifest[key]) for key in ['bitmaps', 'icons', 'sounds']})


if __name__ == '__main__':
    export(Path(sys.argv[1]), Path(sys.argv[2]))
