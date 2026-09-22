"""Run complete three-substep trajectories from BeeBop II 1008:0069.

Usage: python beebop2-motion-fixtures.py BEEBOP2.EXE campaign.json output.json
No missile is active; presentation, timing and button reads are stubbed.
"""
import json
import sys
from pathlib import Path
from importlib.machinery import SourceFileLoader

m = SourceFileLoader('native', str(Path(__file__).with_name('beebop2-native.py'))).load_module()
n = m.Native()
n.stubs.update({0xe0048: 12, 0x331a2: 6, 0x67ad9: 8, 0x6795b: 6, 0x67d9d: 0,
                0x33703: 0, 0x32b5e: 6, 0x50bed: 0, 0x50c74: 0, 0x50d13: 0, 0x50da9: 0,
                0x51c93: 2, 0x60908: 0, 0x60981: 0, 0x609fe: 0, 0x32910: 0,
                0x329d3: 0, 0x67d77: 4, 0x327f9: 0, 0x23373: 0, 0x22021: 0,
                0x32865: 0, 0x21ba5: 0})
def button(n):
    n.cpu.reg_write(m.UC_X86_REG_AX, 0)
    return 0
n.stubs[0x33204] = button
initial = bytes(n.cpu.mem_read(0x90000, 65536))
campaign = json.loads(Path(sys.argv[2]).read_text())
board = campaign['levels'][0]['boards']['19ec']
cells = [campaign['cellTypes'][str(c)]['kind'] for c in board]
cases = []
for pattern, routine in enumerate([0x265f, 0x272e, 0x26ea, 0x2771, 0x26a6, 0x27b6]):
    for x, y in [(42, 61), (598, 61), (100, 90), (340, 290), (525, 380), (100, 380), (300, 180), (300, 390)]:
        for sx, sy in [(-1, -1), (-1, 1), (1, -1), (1, 1)]:
            n.cpu.mem_write(0x90000, initial)
            n.put(0x077a, 19, 3)
            n.put(0x6fa0, 13, 16)
            n.put(0x6f20, 40)
            n.call(6, 0x7ba7)
            n.put(0x6b7c, 300, 402)
            n.put(0x6c4a, 9, 4)
            n.call(3, routine)
            n.put(0x6bac, sx, sy, x, y)
            n.put(0x6bf6, 6)
            n.put(0x1222, 1)
            n.put(0x159e, 1)
            n.put(0x6f52, 2)
            n.cpu.mem_write(0x919ed, bytes(cells))
            n.call(2, 0x0069)
            cases.append({'input': {'x': x, 'y': y, 'sx': sx, 'sy': sy, 'pattern': pattern},
                          'expected': {'x': n.get(0x6bb0), 'y': n.get(0x6bb2),
                                       'sx': n.get(0x6bac), 'sy': n.get(0x6bae), 'pattern': n.get(0x6f96),
                                       'cells': list(n.cpu.mem_read(0x919ed, 247)),
                                       'score': n.get(0x6d96) * 10, 'weapon': n.get(0x0be0),
                                       'lives': n.get(0x6bf6)}})
Path(sys.argv[3]).write_text(json.dumps(cases, separators=(',', ':')) + '\n')
print(len(cases), 'native three-substep trajectories')
