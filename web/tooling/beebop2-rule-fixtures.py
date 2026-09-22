"""Execute original gate/transition and missile collision routines (Unicorn).

Usage: python beebop2-rule-fixtures.py BEEBOP2.EXE campaign.json output.json
Only drawing and sound are stubbed. SETRECT writes its real output structure.
"""
import json
import sys
from pathlib import Path
from importlib.machinery import SourceFileLoader

m = SourceFileLoader('native', str(Path(__file__).with_name('beebop2-native.py'))).load_module()
n = m.Native()
n.stubs.update({0x331a2: 6, 0x67ad9: 8, 0x6795b: 6, 0x67d77: 4,
                0x67b6e: 6, 0x33703: 0, 0x32b5e: 6,
                0x50bed: 0, 0x50c74: 0, 0x50d13: 0, 0x50da9: 0})

def set_rect(n):
    sp = n.cpu.reg_read(m.UC_X86_REG_SP)
    address = n.get(sp + 12) & 65535
    n.put(address, *[n.get(sp + i) for i in (10, 8, 6, 4)])
    return 12

n.stubs[0xe0048] = set_rect
initial = bytes(n.cpu.mem_read(0x90000, 65536))
campaign = json.loads(Path(sys.argv[2]).read_text())
cases = []
for level in campaign['levels']:
    for scenario in ['initial', 'destroyed', '160c', '1704', '17fc', '18f4']:
        if scenario in level['boards'] and not level['boards'][scenario]:
            continue
        n.cpu.mem_write(0x90000, initial)
        rules = {**level['config'], '077a': 19, '077c': 3}
        if level['id'] == 17:
            rules['0d12'] = 0
        if scenario in level['boards']:
            rules['14e0'] = ['160c', '1704', '17fc', '18f4'].index(scenario)
            # Test the mask-driven path separately from cell-specific triggers.
            rules['0d1c'] = 0
        for key, value in rules.items():
            n.put(int(key, 16), value)
        n.put(0x6fa0, 13, 16)
        n.put(0x6bcc, level['id'])
        cells = [campaign['cellTypes'][str(c)]['kind'] for c in level['boards']['19ec']]
        target = [campaign['cellTypes'][str(c)]['target'] for c in level['boards']['19ec']]
        if scenario == 'destroyed':
            cells = target[:]
        elif scenario in level['boards']:
            cells = level['boards'][scenario][:]
        for key, board in {**level['boards'], '19ec': cells, '1ae4': target}.items():
            n.cpu.mem_write(0x90000 + int(key, 16), bytes([len(board), *board]))
        n.call(2, 0x0472)
        cases.append({'stage': level['id'], 'scenario': scenario,
                      'input': {'rules': rules, 'cells': cells, 'targetCells': target},
                      'expected': {'rules': {k: n.get(int(k, 16)) for k in rules},
                                   'cells': list(n.cpu.mem_read(0x919ed, 247)),
                                   'targetCells': list(n.cpu.mem_read(0x91ae5, 247))}})

missiles = []
for left in [48, 49, 50, 65, 66, 67, 77, 83, 136, 215]:
    for right in [48, 49, 50, 65, 66, 67, 77, 83, 136, 215]:
        for ball_x, ball_y, sy in [(500, 100, 1), (334, 70, -1), (334, 280, -1), (334, 280, 1)]:
            n.cpu.mem_write(0x90000, initial)
            n.put(0x077a, 19, 3)
            n.put(0x6fa0, 13, 16)
            n.put(0x0d3e, 15)
            n.put(0x0d42, 5)
            n.put(0x6bb0, ball_x, ball_y)
            n.put(0x6bae, sy)
            cells = [48] * 247
            cells[161], cells[162] = left, right
            n.cpu.mem_write(0x919ed, bytes(cells))
            n.call(5, 0x1143, args=(300, 334))
            missiles.append({'input': {'cells': cells, 'x': 334, 'y': 300,
                                      'ball': {'x': ball_x, 'y': ball_y, 'sy': sy}},
                             'expected': {'cells': list(n.cpu.mem_read(0x919ed, 247)),
                                          'stop': bool(n.get(0x0d52)), 'sy': n.get(0x6bae),
                                          'score': n.get(0x6d96) * 10}})
losses = []
def lost(n):
    n.lost = True
    return 0
n.stubs.update({0x21aa9: lost, 0x30d96: 0, 0x5051f: 6, 0x5038e: 0,
                0x5003a: 6, 0x50698: 0, 0x5081b: 0, 0x501f4: 0})
for level in campaign['levels']:
    r = {**level['config']}
    if level['id'] == 17:
        r['0d12'] = 0
    xs = sorted({40, 200, 600, *[r['1004'] + d for d in range(-1, 7)]})
    ys = sorted({60, 200, 434, *[r[k] + d for k in ['1016', '103a', '1002', '0ffe']
                               for d in [-10, -9, -8, 2, 3, 4, 5, 6, 9, 10, 11]]})
    for x in xs:
        for y in ys:
            n.cpu.mem_write(0x90000, initial)
            for k, v in r.items():
                n.put(int(k, 16), v)
            n.put(0x077a, 19, 3)
            n.put(0x6bb0, x, y)
            n.lost = False
            n.call(2, 0x1ba5)
            losses.append([level['id'], x, y, n.lost])
Path(sys.argv[3]).write_text(json.dumps({'sha256': campaign['sourceSha256'],
                                       'rules': cases, 'missiles': missiles,
                                       'losses': losses}, separators=(',', ':')) + '\n')
print(len(cases), 'transitions;', len(missiles), 'missiles;', len(losses), 'death-line probes')
