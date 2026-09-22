"""Execute BeeBop II initializers to export campaign data and cell normalization.

Usage: python extract-beebop2-campaign.py BEEBOP2.EXE output.json
Requires Unicorn only for regenerating data, never in the browser.
"""
import json, sys
from pathlib import Path
from importlib.machinery import SourceFileLoader
m=SourceFileLoader('native',str(Path(__file__).with_name('beebop2-native.py'))).load_module()
n=m.Native()
n.call(6,0x58d3)
initial=bytes(n.cpu.mem_read(0x90000,65536))
n.stubs.update({0x32ba7:2,0xe0048:12,0x3322f:4,0x330cb:4})
def icon(n):
    n.draws.append(n.get(n.cpu.reg_read(m.UC_X86_REG_SP)+8)&65535)
    return 6
n.stubs[0x3332b]=icon
# These are display-only paths in the cell renderer.
n.draws=[]
cell_map={}
for c in range(256):
    n.cpu.mem_write(0x90000,initial)
    n.cpu.mem_write(0x919ed,bytes([c]))
    n.cpu.mem_write(0x91ae5,b'0')
    n.put(0x15ba,1,1)
    n.draws=[]
    n.call(2,0x2090)
    cell_map[c]={'kind':n.cpu.mem_read(0x919ed,1)[0], 'target':n.cpu.mem_read(0x91ae5,1)[0], 'icons':n.draws}

paths=[]
for routine in [0x1135,0x1250]:
    ids=[]
    for step in range(1,21):
        n.put(0x6f9c,step)
        n.call(2,routine,far=False)
        ids.append(n.get(0x6bcc))
    paths.append(ids)
levels=[]
for ident in sorted(set(sum(paths,[]))):
    n.cpu.mem_write(0x90000,initial)
    n.put(0x6bcc,ident)
    n.put(0x6fa0,13,16)
    n.put(0x077a,19,3)
    n.put(0x0f5c,1)
    n.call(4,2)
    n.call(1,0x2a93,far=False)
    config={f'{i:04x}':n.get(i) for i in list(range(0x0d12,0x0d24,2))+[0x0f5c,0x0f5e]+list(range(0x0ffe,0x103e,2))+list(range(0x1214,0x1218,2))+list(range(0x14dc,0x15ba,2))}
    boards={f'{p:04x}':list(n.cpu.mem_read(0x90000+p+1,n.cpu.mem_read(0x90000+p,1)[0])) for p in [0x19ec,0x160c,0x1704,0x17fc,0x18f4]}
    levels.append({'id':ident, 'config':config,'boards':boards})
out={'episode':2,'sourceSha256':'948ed1705fc585a7f9583619ffe34365f657207c7de1827c17c4b9471ff737ad', 'paths':paths, 'cellTypes':cell_map, 'levels':levels}
Path(sys.argv[2]).write_text(json.dumps(out,indent=2)+'\n')
print('paths',paths,'levels',len(levels))
