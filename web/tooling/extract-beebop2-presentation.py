"""Capture original presentation blits, without running the Windows graphics API.

Usage: python extract-beebop2-presentation.py BEEBOP2.EXE output.json
Records presentation routines, including the Go click's menu cleanup, with
their original RECTs and 120 Hz waits.
"""
import json
import sys
from pathlib import Path
from importlib.machinery import SourceFileLoader

m = SourceFileLoader('native', str(Path(__file__).with_name('beebop2-native.py'))).load_module()
n = m.Native()
def arg(i):
    return n.get(n.cpu.reg_read(m.UC_X86_REG_SP) + 4 + i * 2)
def rect(i):
    p = arg(i) & 65535
    return [n.get(p + j * 2) for j in range(4)]
def set_rect(n):
    p = arg(4) & 65535
    n.put(p, arg(3), arg(2), arg(1), arg(0))
    return 12
def copy_background(n):
    n.commands.append(['background', *rect(0)])
    return 4
def copy_screen(n):
    n.commands.append(['copy', *rect(2), *rect(0)])
    return 8
def copy_screen_extra(n):
    n.commands.append(['copy', *rect(3), *rect(1)])
    return 10
def draw_icon(n):
    n.commands.append(['icon', arg(2), *rect(0)])
    return 6
def wait(n):
    n.commands.append(['wait', arg(0) * 1000 / 120])
    return 4
def wait_fast(n):
    n.commands.append(['wait', arg(0) * 1000 / 200])
    return 4
def offset_rect(n):
    p = arg(2) & 65535
    l, t, r, b = rect(2)
    n.put(p, l + arg(1), t + arg(0), r + arg(1), b + arg(0))
    return 8
def fill(n):
    n.commands.append(['fill', arg(2), arg(1), arg(0), *rect(3)])
    return 10
def ellipse(n):
    n.commands.append(['ellipse', arg(2), arg(1), arg(0), arg(3), *rect(4)])
    return 12
def tile_region(n):
    n.commands.append(['background', *rect(2)])
    return 8
def mouse_released(n):
    n.cpu.reg_write(m.UC_X86_REG_AX, 0)
    return 0
n.stubs.update({0xe0048: set_rect, 0x50002: 0, 0x33703: 0, 0x331a2: 6,
                0x32ece: copy_background, 0x32fac: copy_screen, 0x67cf9: copy_screen_extra,
                0x6795b: draw_icon, 0x330cb: wait, 0x60002: wait_fast, 0x32c0d: 8})
n.put(0x077a, 19, 3)
sequences = {}
for name, routine in [('entry', 0x192b), ('exit', 0x1d91)]:
    n.commands = []
    n.call(3, routine)
    sequences[name] = n.commands
n.commands = []
n.call(6, 0x01a8, args=(0, 23, 51, 34, 13, 19, 30))
sequences['gameover'] = n.commands
n.stubs.update({0x67d8a: 8, 0x6021b: 0, 0x3300e: fill, 0x333c6: ellipse})
n.commands = []
n.call(6, 0x0230)
sequences['atom'] = n.commands
n.stubs.update({0x3126f: 0, 0x10b7c: (0, False), 0x1195f: (0, False),
                0x31168: 0, 0x331c2: 6, 0x60230: 0, 0x3192b: 0,
                0x67ad9: tile_region, 0xe004d: offset_rect})
for p, values in [(0xc7c, [246,43,411,76]), (0xfb2, [280,150,370,240]),
                  (0xfaa, [560,60,599,100]), (0xf9a, [1,3,180,85]),
                  (0xfa2, [30,333,606,458])]:
    n.put(p, *values)
n.commands = []
# 1000:195f waits for a click through 1000:16d7. Skipping that wait must
# not skip the Go handler's background restores (preview, ranking, controls).
# Execute the real handler with a released mouse over Go; only its transient
# pressed-button feedback and the Windows input calls are stubbed.
n.stubs.update({0x3322f: 4, 0x33204: mouse_released, 0x3367d: 4})
n.put(0x6b7c, 280, 380)
n.call(1, 0x16d7, far=False)
assert n.get(0x0c64) == 1, 'Native Go handler was not selected'
n.call(1, 0x19b2, far=False)
sequences['menuExit'] = n.commands
Path(sys.argv[2]).write_text(json.dumps(sequences, separators=(',', ':')) + '\n')
print({k: len(v) for k, v in sequences.items()})

# Optional independent loss-animation reference, including native line selection.
if len(sys.argv) > 3:
    campaign = json.loads(Path(sys.argv[2]).with_name('campaign.json').read_text())
    rules = json.loads(Path(sys.argv[3]).with_name('beebop2-rules.json').read_text())
    n.stubs.update({0x30ed1: 0, 0x21aa9: 0, 0x3364f: 2, 0x32b5e: 6})
    fixtures = []
    seen = set()
    for stage, x, y, lost in rules['losses']:
        if not lost: continue
        level = next(l for l in campaign['levels'] if l['id'] == stage)
        config = dict(level['config'])
        if stage == 17: config['0d12'] = 0
        kind = (stage, x > config['1004'], y > config['103a'] + 5,
                x > config['1014'] + 35, y < config['1016'] + 10)
        if kind in seen: continue
        seen.add(kind)
        for p, v in config.items(): n.put(int(p, 16), v)
        n.put(0x6bb0, x, y)
        n.commands = []
        n.call(2, 0x1ba5)
        fixtures.append({'stage': stage, 'x': x, 'y': y, 'commands': n.commands})
    Path(sys.argv[3]).write_text(json.dumps(fixtures, separators=(',', ':')) + '\n')
    print('Loss sequences:', len(fixtures))
