"""Execute full original missile salvos, including spawn and retirement.

Usage: python beebop2-salvo-fixtures.py BEEBOP2.EXE output.json
"""
import json
import sys
from pathlib import Path
from importlib.machinery import SourceFileLoader

m = SourceFileLoader('native', str(Path(__file__).with_name('beebop2-native.py'))).load_module()
n = m.Native()
def button(n):
    n.cpu.reg_write(m.UC_X86_REG_AX, int(n.fire))
    return 0
def sound(n):
    n.fired = True
    return 6
n.stubs.update({0xe0048:12, 0x331a2:6, 0x67ad9:8, 0x6795b:6, 0x67b6e:6,
                0x67d77:4, 0x50bed:0, 0x50c74:0, 0x50d13:0, 0x50da9:0,
                0x33204:button, 0xe0002:sound, 0x3326f:6, 0x33703:0,
                0x67cf9:10, 0x32ece:4, 0x32b5e:6})
initial = bytes(n.cpu.mem_read(0x90000, 65536))
cases = []
for weapon in [1, 2]:
    for kind in [48, 49, 50, 65, 77]:
        for bx, by, sy in [(500, 100, 1), (320, 380, 1), (304, 280, -1), (334, 200, -1)]:
            n.cpu.mem_write(0x90000, initial)
            n.put(0x077a, 19, 3)
            n.put(0x6fa0, 13, 16)
            n.put(0x0be0, weapon)
            n.put(0x6b7c, 300, 400)
            n.put(0x1008, 400)
            n.put(0x6f20, 40)
            n.put(0x6bb0, bx, by)
            n.put(0x6bae, sy)
            n.cpu.mem_write(0x90d5c, b'\x03non')
            cells = [48] * 247
            cells[7*19+9] = kind
            n.cpu.mem_write(0x919ed, bytes(cells))
            frames = []
            for tick in range(40):
                n.fire = tick % 5 != 3
                n.fired = False
                n.call(5, 0x169f)
                active = bytes(n.cpu.mem_read(0x90d5c, 4)) == b'\x03oui'
                shots = [{'x':n.get(0x0d54+i*4), 'y':n.get(0x0d56+i*4),
                          'stopped':bool(n.get(0x0ba8-i*2))} for i in range(weapon)] if active else []
                frames.append({'fire':n.fire, 'missiles':shots, 'cells':list(n.cpu.mem_read(0x919ed, 247)),
                               'sy':n.get(0x6bae), 'score':n.get(0x6d96)*10, 'fired':n.fired})
            cases.append({'input':{'weapon':weapon, 'cells':cells, 'ball':{'x':bx,'y':by,'sy':sy}}, 'frames':frames})
Path(sys.argv[2]).write_text(json.dumps(cases, separators=(',', ':')) + '\n')
print(len(cases), 'salvos,', sum(len(c['frames']) for c in cases), 'steps')
