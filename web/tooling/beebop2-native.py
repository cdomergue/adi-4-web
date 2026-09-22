"""Minimal NE loader for BeeBop II regression extraction (Unicorn, development only)."""
import struct
import sys
import hashlib
from pathlib import Path
from unicorn import Uc, UC_ARCH_X86, UC_MODE_16, UC_HOOK_CODE
from unicorn.x86_const import *

EXE = Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(EXE).hexdigest() == '948ed1705fc585a7f9583619ffe34365f657207c7de1827c17c4b9471ff737ad', 'Unexpected BeeBop II executable'
def w(data, p): return struct.unpack_from('<H', data, p)[0]
NE = struct.unpack_from('<I', EXE, 60)[0]
TABLE = NE + w(EXE, NE+34)
SHIFT = w(EXE, NE+50)
ENTRIES = {}
p, ordinal = NE+w(EXE,NE+4),1
while EXE[p]:
    count, kind = EXE[p:p+2]
    p += 2
    for _ in range(count):
        if kind == 255:
            ENTRIES[ordinal] = (EXE[p+3],w(EXE,p+4))
            p += 6
        elif kind:
            ENTRIES[ordinal] = (kind,w(EXE,p+1))
            p += 3
        ordinal += 1
def segment(n):
    offset, size, flags, minimum = struct.unpack_from('<4H', EXE, TABLE+(n-1)*8)
    return EXE[offset<<SHIFT:(offset<<SHIFT)+(size or 65536)]

class Native:
    def __init__(self):
        self.cpu = Uc(UC_ARCH_X86, UC_MODE_16)
        self.cpu.mem_map(0, 0x100000)
        for n in range(1,w(EXE,NE+28)+1):
            offset, size, flags, minimum = struct.unpack_from('<4H', EXE, TABLE+(n-1)*8)
            data = bytearray(segment(n))
            if flags & 0x100:
                p = (offset<<SHIFT)+(size or 65536)
                for j in range(w(EXE,p)):
                    kind, flag, source, a, b = struct.unpack_from('<BBHHH', EXE,p+2+j*8)
                    if flag & 3 == 0:
                        if a == 255: a,b = ENTRIES[b]
                        value = struct.pack('<HH',b,a*0x1000) if kind == 3 else struct.pack('<H',b if kind == 5 else a*0x1000)
                        assert kind in (2,3,5), (n,kind)
                    else:
                        value = struct.pack('<HH',b,0xe000) if kind == 3 else struct.pack('<H',0xe000)
                    while source != 65535:
                        next_source = w(data,source)
                        assert not flag & 4, (n,kind,flag)
                        data[source:source+len(value)] = value
                        source = next_source
            self.cpu.mem_write(n*0x10000,bytes(data))
        self.stubs = {}
        self.cpu.hook_add(UC_HOOK_CODE,self.hook)
    def put(self, address, *values):
        self.cpu.mem_write(0x90000+address,struct.pack('<'+'H'*len(values),*[v&65535 for v in values]))
    def get(self,address):
        return struct.unpack('<h',self.cpu.mem_read(0x90000+address,2))[0]
    def hook(self,cpu,address,size,user):
        if address in self.stubs:
            cleanup = self.stubs[address]
            if callable(cleanup): cleanup = cleanup(self)
            far = True
            if isinstance(cleanup, tuple): cleanup, far = cleanup
            sp = cpu.reg_read(UC_X86_REG_SP)
            ip, cs = struct.unpack('<HH',cpu.mem_read(0x90000+sp,4))
            cpu.reg_write(UC_X86_REG_SP,(sp+(4 if far else 2)+cleanup)&65535)
            if far: cpu.reg_write(UC_X86_REG_CS,cs)
            cpu.reg_write(UC_X86_REG_IP,ip)
        elif address >= 0xa0000:
            raise AssertionError(f'Unexpected external call {address:x}')
    def call(self,seg,offset,args=(),far=True):
        for reg,value in [(UC_X86_REG_CS,seg*0x1000),(UC_X86_REG_DS,0x9000),
                          (UC_X86_REG_SS,0x9000),(UC_X86_REG_SP,0xff00),(UC_X86_REG_BP,0)]:
            self.cpu.reg_write(reg,value)
        self.put(0xff00,*([0xfff0,0x1000] if far else [0xfff0]),*args)
        self.cpu.emu_start(seg*0x10000+offset,0x1fff0 if far else seg*0x10000+0xfff0,count=2000000)
        assert self.cpu.reg_read(UC_X86_REG_IP)==0xfff0
