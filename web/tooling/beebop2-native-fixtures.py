"""Export BeeBop II native regression vectors with Unicorn.

Usage: python beebop2-native-fixtures.py BEEBOP2.EXE output.json
Graphics/audio calls are stubbed; collision and scoring instructions are executed.
"""
import json,itertools,sys
from pathlib import Path
from importlib.machinery import SourceFileLoader
m=SourceFileLoader('native',str(Path(__file__).with_name('beebop2-native.py'))).load_module()
n=m.Native()
n.stubs.update({0xe0048:12,0x331a2:6,0x67ad9:8,0x6795b:6,0x67d9d:0,
  0x33703:0,0x32b5e:6,0x50bed:0,0x50c74:0,0x50d13:0,0x50da9:0,0x51c93:2,
  0x60908:0,0x60981:0,0x609fe:0,0x32910:0,0x329d3:0,0x67d77:4})
initial=bytes(n.cpu.mem_read(0x90000,65536))
def run(kinds,sx,sy,point,primary,active):
    n.cpu.mem_write(0x90000,initial)
    n.cpu.mem_write(0x919ed,b'0'*247)
    x,y=point
    corners=lambda x,y:(max(1,min(13,(y+29)//30))-1)*19+max(1,min(19,(x+29)//30))-1
    ids=[corners(x-45,y-60),corners(x-45,y-42),corners(x-26,y-42),corners(x-26,y-60)]
    for index,kind in zip(ids,kinds): n.cpu.mem_write(0x919ed+index,bytes([kind]))
    cells=list(n.cpu.mem_read(0x919ed,247))
    n.put(0x6bac,sx,sy,x,y)
    n.put(0x6be2,x-2,y-2)
    n.put(0x6fa0,13,16)
    n.put(0x077a,19,3)
    n.put(0x6bf6,6)
    n.put(0x1222,1 if primary else 2)
    n.put(0x121c,int(active))
    n.put(0x159e,1)
    n.put(0x6f1e,1)
    n.call(2,0x351f)
    return {'input':{'cells':[[i,c] for i,c in enumerate(cells) if c != 48],'ball':{'x':x,'y':y,'previousX':x-2,'previousY':y-2,'sx':sx,'sy':sy,'pattern':0,'primary':primary},'multiballActive':active},
      'expected':{'cells':[[i,c] for i,c in enumerate(n.cpu.mem_read(0x919ed,247)) if c != 48],
        'ball':{'x':n.get(0x6bb0),'y':n.get(0x6bb2),'sx':n.get(0x6bac),'sy':n.get(0x6bae),'pattern':n.get(0x6f96)},
        'lives':n.get(0x6bf6),'weapon':n.get(0x0be0),'score':n.get(0x6d96)*10}}
cases=[]
for mask in itertools.product([48,49,50,65,66,67,77,83,136,215],repeat=2):
    kinds=[mask[0],mask[1],48,48]
    for sx,sy in itertools.product([-1,0,1],repeat=2):
        cases.append(run(kinds,sx,sy,(340,290),True,False))
for kinds in [(48,48,215,48),(48,215,50,48),(65,66,67,49),(49,49,49,49),(50,50,50,48),(77,83,136,215)]:
    for p in [(350,280),(340,270),(345,270),(200,170)]:
        for primary,active in [(True,False),(False,False),(False,True)]:
            cases.append(run(kinds,-1,1,p,primary,active))
paddle_cases=[]
for width in [40,60]:
    n.cpu.mem_write(0x90000,initial)
    n.put(0x6f20,width)
    n.call(6,0x7ba7)
    thresholds=[n.get(i) for i in range(0x6c4e,0x6c5e,2)]
    for x in range(285,316+width):
        for y in [385,386,389,390,391,394,404,417,418,421,422]:
            n.put(0x6b7c,300,400)
            n.put(0x6bb0,x,y)
            n.put(0x6bac,1,-1)
            n.put(0x6f96,3)
            n.put(0x6c4a,9,4)
            n.call(3,0x219d)
            paddle_cases.append({'input':{'x':x,'y':y,'width':width,'thresholds':thresholds},
              'expected':[n.get(0x6bac),n.get(0x6bae),n.get(0x6f96)]})
Path(sys.argv[2]).write_text(json.dumps({'provenance':{'sha256':'948ed1705fc585a7f9583619ffe34365f657207c7de1827c17c4b9471ff737ad','routines':['1008:351f','1010:219d','1028:7ba7']},'cases':cases,'paddleCases':paddle_cases},separators=(',',':'))+'\n')
print(len(cases),'native collisions;',len(paddle_cases),'paddle impacts')
