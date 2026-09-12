#!/usr/bin/env python3
"""Minimal ADI 4.21 TCP transport; loopback only, no external dependencies."""
import argparse
import asyncio
import json
import contextlib
import struct
from datetime import datetime, timezone
from pathlib import Path
from storage import DEFAULT_DB, Store, cstring, timestamp

HEADER = struct.Struct('<HIBB')
MAX_BODY = 1024 * 1024
NAMES = {6: 'GIVEDATE', 27: 'CONNECT', 28: 'FIRSTCON', 30: 'CHILDCON',
         55: 'LISTUPDATE', 29: 'LISTONCHILD', 65: 'GIVESUBS', 53: 'ONCHILDCON',
         31: 'LISTMAIL', 32: 'READMAIL', 37: 'DELETEMAIL', 59: 'GIVECHECK'}


def fixed_text(text, width):
    return text.encode('cp850')[:width - 1].ljust(width, b'\0')


def frame(kind, body=b''):
    return HEADER.pack(0xF11F, len(body), kind, sum(body) & 255) + body


def parse_message(kind, body):
    if kind not in (1, 2, 3):
        raise ValueError(f'Unsupported type {kind}')
    if len(body) < (7 if kind in (2, 3) else 2):
        raise ValueError('Truncated message')
    opcode = struct.unpack_from('<H', body)[0]
    token, cached, offset = 0, 0, 2
    if kind in (2, 3):
        token, cached = struct.unpack_from('<IB', body, 2)
        offset = 7
        if cached:
            offset += 4
    if len(body) < offset:
        raise ValueError('Truncated cache metadata')
    return opcode, token, body[offset:]


def response(opcode, token, payload):
    return frame(3, struct.pack('<HIB', opcode, token, 0) + payload)


class Server:
    def __init__(self, log, observe=False, store=None):
        self.log = log
        self.observe = observe
        self.store = store if store is not None else Store(':memory:')

    def dispatch(self, kind, opcode, payload, session):
        if kind == 2 and opcode == 55:
            return bytes(8)
        if kind == 2 and opcode in (27, 28):
            session.clear()
            if opcode == 28:
                account_id, code = self.store.register(payload)
                session['account'] = account_id
                return b'\0' + code.encode('ascii') + b'\0\5'
            if len(payload) != 21:
                raise ValueError('CONNECT must contain 21 bytes')
            code = cstring(payload[:12]).decode('ascii')
            account_id = self.store.authenticate(code, payload[12:20])
            if account_id is None:
                return b'\4\0'
            session['account'] = account_id
            return b'\0\5'  # TESTWO bits 0 (mail) and 2 (its entrance through the forum).
        if 'account' not in session:
            raise ValueError('Account login required')
        if kind == 2 and opcode == 30:
            child_id = self.store.register_child(session['account'], payload)
            session['child'] = child_id
            return b'\0' + struct.pack('<I', child_id)
        if kind == 2 and opcode == 53:
            if len(payload) < 8:
                raise ValueError('Truncated ONCHILDCON')
            child_id, count = struct.unpack_from('<II', payload)
            if len(payload) != 8 + count * 4:
                raise ValueError('Invalid ONCHILDCON count')
            session.pop('child', None)
            if not self.store.owns_child(session['account'], child_id):
                return b'\1'
            session['child'] = child_id
            return b'\0'
        if kind == 2 and opcode in (6, 29, 65):
            return {6: struct.pack('<I', timestamp()), 29: bytes(4), 65: bytes(60)}[opcode]
        if kind == 2 and opcode == 59:
            if len(payload) != 4 or struct.unpack('<I', payload)[0] != session.get('child'):
                raise ValueError('Invalid child access check')
            # Local test policy: unrestricted forum time, no paid service entitlement.
            return struct.pack('<BBiBB', 0, 3, -1, 0, 0)
        if opcode in (31, 32, 37):
            child_id = session.get('child')
            if child_id is None:
                raise ValueError('Child login required')
            if kind == 2 and opcode == 31:
                if len(payload) != 5:
                    raise ValueError('Invalid LISTMAIL payload')
                mailbox, requested_child = struct.unpack('<BI', payload)
                self.event('mailbox_requested', child_id=requested_child, category=mailbox)
                if mailbox != 5 or requested_child != child_id:
                    raise ValueError('Mailbox does not belong to selected child')
                rows = self.store.inbox(child_id)
                records = []
                for row in rows:
                    records.append(struct.pack('<IBBB', row['id'], 2 if row['read_at'] else 1, 0, 1)
                                   + fixed_text('Adi', 24) + fixed_text(row['title'], 40)
                                   + struct.pack('<I', row['created_at']))
                return struct.pack('<I', len(rows)) + b''.join(records)
            if kind == 2 and opcode == 32:
                if len(payload) != 10:
                    raise ValueError('Invalid READMAIL payload')
                message_id, direction, mailbox, requested_child = struct.unpack('<IBBI', payload)
                if mailbox != 5 or requested_child != child_id or direction != 0:
                    raise ValueError('Invalid mailbox selection')
                row = self.store.read_message(child_id, message_id)
                if row is None:
                    return b'\1\1' + bytes(8)
                body = row['body']
                self.event('mail_read', child_id=child_id, message_id=message_id)
                return b'\0\1' + bytes(4) + struct.pack('<I', len(body)) + body
            if kind == 1 and opcode == 37:
                if len(payload) != 6:
                    raise ValueError('Invalid DELETEMAIL payload')
                message_id, direction, mailbox = struct.unpack('<IBB', payload)
                if mailbox != 5 or direction != 0:
                    raise ValueError('Invalid mailbox selection')
                self.store.delete_message(child_id, message_id)
                self.event('mail_deleted', child_id=child_id, message_id=message_id)
                return None
        self.event('unsupported_request', opcode=opcode)
        return None

    def event(self, event, **data):
        record = {'time': datetime.now(timezone.utc).isoformat(), 'event': event, **data}
        line = json.dumps(record, ensure_ascii=False)
        print(line, flush=True)
        if self.log:
            with self.log.open('a') as output:
                output.write(line + '\n')

    async def heartbeat(self, writer):
        while True:
            await asyncio.sleep(30)
            writer.write(frame(4))
            await writer.drain()
            self.event('keepalive_sent')

    async def handle(self, reader, writer):
        peer = writer.get_extra_info('peername')
        self.event('tcp_accepted', peer=peer)
        heartbeat = asyncio.create_task(self.heartbeat(writer))
        session = {}
        try:
            while True:
                raw = await reader.readexactly(8)
                magic, size, kind, checksum = HEADER.unpack(raw)
                if magic != 0xF11F or size > MAX_BODY:
                    raise ValueError(f'Invalid header {raw.hex()}')
                body = await reader.readexactly(size)
                if sum(body) & 255 != checksum:
                    raise ValueError('Checksum mismatch')
                # Do not log passwords, coordinates, profile fields or message contents.
                self.event('frame_received', kind=kind, size=size)
                if kind == 4:
                    self.event('keepalive_acknowledged')
                    continue
                if kind == 5:
                    continue
                opcode, token, payload = parse_message(kind, body)
                self.event('request', opcode=opcode, name=NAMES.get(opcode, 'UNKNOWN'),
                           token=token, payload_bytes=len(payload))
                if self.observe:
                    continue
                reply = self.dispatch(kind, opcode, payload, session)
                if reply is None:
                    continue
                outgoing = response(opcode, token, reply)
                writer.write(outgoing)
                await writer.drain()
                self.event('reply_sent', opcode=opcode, token=token, payload_bytes=len(reply))
        except asyncio.IncompleteReadError as error:
            self.event('tcp_closed', partial_bytes=len(error.partial))
        except (ValueError, OSError) as error:
            self.event('protocol_error', detail=str(error))
        finally:
            heartbeat.cancel()
            with contextlib.suppress(asyncio.CancelledError, OSError):
                await heartbeat
            writer.close()
            with contextlib.suppress(OSError):
                await writer.wait_closed()


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=2001)
    parser.add_argument('--log', type=Path)
    parser.add_argument('--db', type=Path, default=DEFAULT_DB)
    parser.add_argument('--observe', action='store_true', help='Capture without application replies')
    args = parser.parse_args()
    store = Store(args.db)
    server = Server(args.log, args.observe, store)
    listener = await asyncio.start_server(server.handle, '127.0.0.1', args.port)
    server.event('listening', address='127.0.0.1', port=args.port, observe=args.observe)
    try:
        async with listener:
            await listener.serve_forever()
    finally:
        store.close()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
