"""Execute original collision instructions with Unicorn; export portable regression vectors.

Usage: python placeball-native-fixtures.py PLACEBFR.EXE output.json
Requires unicorn only for regenerating fixtures, never for running the web game.
"""
import hashlib
import json
from pathlib import Path
import struct
import sys
from unicorn import Uc, UC_ARCH_X86, UC_MODE_16, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_CS, UC_X86_REG_DS, UC_X86_REG_SS
from unicorn.x86_const import UC_X86_REG_SP, UC_X86_REG_IP, UC_X86_REG_AX, UC_X86_REG_BP

exe = Path(sys.argv[1]).read_bytes()
ne = struct.unpack_from('<I', exe, 60)[0]
table = ne + struct.unpack_from('<H', exe, ne + 34)[0]
shift = struct.unpack_from('<H', exe, ne + 50)[0]


def segment(number):
    offset, size = struct.unpack_from('<HH', exe, table + (number - 1) * 8)
    return exe[offset << shift:(offset << shift) + size]


code, data = segment(6), segment(13)
# Only sound calls and Win16 drawing calls are stubbed, never physics or arithmetic.
stubs = {0xe04: 0, 0xf6e: 0, 0x11ab: 0, 0x1341: 0,
         0xf76: 2, 0xf81: 2, 0xf8d: 4, 0xfaf: 20, 0xfb8: 4, 0xfbe: 2, 0xfc9: 4}


def run(cell, direction, difficulty, score, misaligned):
    cpu = Uc(UC_ARCH_X86, UC_MODE_16)
    cpu.mem_map(0x10000, 0x10000)
    cpu.mem_map(0x60000, 0x10000)
    cpu.mem_write(0x10000, code)
    cpu.mem_write(0x60000, data)
    for register, value in [(UC_X86_REG_CS, 0x1000), (UC_X86_REG_DS, 0x6000),
                            (UC_X86_REG_SS, 0x6000), (UC_X86_REG_BP, 0)]:
        cpu.reg_write(register, value)

    def put(address, *values):
        cpu.mem_write(0x60000 + address, struct.pack('<' + 'H' * len(values), *values))

    def get(address):
        return struct.unpack('<H', cpu.mem_read(0x60000 + address, 2))[0]

    put(0x1c2, difficulty)
    put(0x1cc, 0)
    put(0x25f0, 128 + misaligned, 152, 1, direction, 4)
    put(0x2602, score & 65535, score >> 16)
    put(0x260a, 9, 2)
    address = 0x1fe4 + (5 * 16 + 6) * 2
    put(address, cell)

    def hook(cpu, address, size, user):
        offset = address - 0x10000
        if offset in stubs:
            cpu.reg_write(UC_X86_REG_SP, cpu.reg_read(UC_X86_REG_SP) + stubs[offset])
            cpu.reg_write(UC_X86_REG_AX, 1)
            cpu.reg_write(UC_X86_REG_IP, offset + 5)
        elif cpu.mem_read(address, 1)[0] == 0x9a:
            raise AssertionError(f'Unexpected far call at {offset:x}')

    cpu.hook_add(UC_HOOK_CODE, hook)
    for routine in [0xefb, 0x1136, 0xd9a, 0x12d1, 0x1096, 0x101e]:
        args = [1, 0x25f0, 0x1fe4] if routine == 0xefb else [0x25f0, 0x1fe4]
        cpu.reg_write(UC_X86_REG_SP, 0xff00)
        put(0xff00, 0xfff0, 0x1000, *args)
        cpu.emu_start(0x10000 + routine, 0x1fff0, count=20000)
        assert cpu.reg_read(UC_X86_REG_IP) == 0xfff0
    return {'cell': get(address), 'direction': get(0x25f6),
            'score': get(0x2602) + (get(0x2604) << 16),
            'holes': get(0x260c), 'prizes': get(0x260a)}


cases = []
for cell in [0, 100, 200, 201, 300, 301, 400, 401, 402, 403, 500, 501, 502, 600, 601, 602, 603, 604]:
    for direction in range(1, 5):
        for difficulty in [0, 1]:
            for score, misaligned in [(0, 0), (65530, 0), (0xfffffff0, 0), (91, 1)]:
                args = dict(cell=cell, direction=direction, difficulty=difficulty,
                            score=score, misaligned=misaligned)
                cases.append({'input': args, 'expected': run(**args)})
output = {'provenance': {'executableSha256': hashlib.sha256(exe).hexdigest(),
          'codeSegmentSha256': hashlib.sha256(code).hexdigest(),
          'routines': ['1028:0efb', '1028:1136', '1028:0d9a', '1028:12d1', '1028:1096', '1028:101e'],
          'abi': '16-bit x86, far cdecl; CS=1000 DS=SS=6000; original unmodified segment 6',
          'stubs': {f'1028:{k:04x}': {'argumentBytes': v} for k, v in stubs.items()},
          'scope': 'Collision instructions only; graphics and audio calls skipped; no native timing or window execution.'},
          'cases': cases}
Path(sys.argv[2]).write_text(json.dumps(output, indent=2) + '\n')
print(f'{len(cases)} native vectors')
