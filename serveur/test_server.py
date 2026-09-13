import asyncio
import struct
import unittest
import tempfile
import json
import sqlite3
from pathlib import Path

from server import HEADER, Server, frame, parse_message, response
from storage import Store


def registration(password=b''):
    return bytes(318) + password.ljust(8, b'\0') + b'\0'


def child_profile(name='Test'):
    return bytes(28) + name.encode('cp850').ljust(24, b'\0')


class TransportTests(unittest.TestCase):
    def test_original_listupdate_capture(self):
        wire = bytes.fromhex('1ff112000000022137000100000000004601a5010000ffffffff')
        self.assertEqual(HEADER.unpack(wire[:8]), (0xF11F, 18, 2, 33))
        self.assertEqual(sum(wire[8:]) & 255, 33)
        self.assertEqual(parse_message(2, wire[8:]),
                         (55, 1, bytes.fromhex('004601a5010000ffffffff')))

    def test_response_accepted_by_original_client(self):
        self.assertEqual(response(55, 1, bytes(8)).hex(),
                         '1ff10f0000000338370001000000000000000000000000')

    def test_firstcon_and_childcon_captured_responses(self):
        self.assertEqual(response(28, 2, b'\0LOCAL000001\0\0').hex(),
                         '1ff11500000003aa1c000200000000004c4f43414c3030303030310000')
        self.assertEqual(response(30, 3, b'\0' + struct.pack('<I', 707)).hex(),
                         '1ff10c00000003e61e00030000000000c3020000')

    def test_truncated_cache_rejected(self):
        with self.assertRaises(ValueError):
            parse_message(2, struct.pack('<HIB', 27, 123, 1))


class StreamTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.events = []
        self.server = Server(None)
        self.server.event = lambda event, **data: self.events.append((event, data))
        self.listener = await asyncio.start_server(self.server.handle, '127.0.0.1', 0)
        self.port = self.listener.sockets[0].getsockname()[1]

    async def asyncTearDown(self):
        self.listener.close()
        await self.listener.wait_closed()
        await asyncio.sleep(0)
        self.server.store.close()

    async def test_fragmentation_coalescing_and_token(self):
        reader, writer = await asyncio.open_connection('127.0.0.1', self.port)
        _, code = self.server.store.register(registration())
        request = frame(2, struct.pack('<HIB', 27, 0x12345678, 0)
                        + code.encode() + b'\0' + bytes(9))
        for byte in request[:10]:
            writer.write(bytes([byte]))
            await writer.drain()
        writer.write(request[10:] + request)
        await writer.drain()
        expected = response(27, 0x12345678, b'\0\15') * 2
        self.assertEqual(await asyncio.wait_for(reader.readexactly(len(expected)), 2), expected)
        writer.close()
        await writer.wait_closed()


    async def test_bad_checksum_closes_without_reply(self):
        reader, writer = await asyncio.open_connection('127.0.0.1', self.port)
        packet = bytearray(frame(2, struct.pack('<HIB', 27, 1, 0)))
        packet[7] ^= 1
        writer.write(packet)
        await writer.drain()
        self.assertEqual(await asyncio.wait_for(reader.read(), 2), b'')
        self.assertTrue(any(event == 'protocol_error' for event, _ in self.events))
        writer.close()
        await writer.wait_closed()


class MailboxTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / 'adi.sqlite3'
        self.store = Store(self.path)
        self.server = Server(None, store=self.store)
        self.server.event = lambda *args, **kwargs: None
        self.session = {}
        reply = self.server.dispatch(2, 28, registration(b'secret'), self.session)
        self.code = reply[1:13]
        reply = self.server.dispatch(2, 30, child_profile(), self.session)
        self.child = struct.unpack('<I', reply[1:])[0]

    def tearDown(self):
        self.store.close()
        self.directory.cleanup()

    def restart(self):
        self.store.close()
        self.store = Store(self.path)
        self.server = Server(None, store=self.store)
        self.server.event = lambda *args, **kwargs: None
        self.session = {}
        reply = self.server.dispatch(2, 27, self.code + b'secret\0\0' + b'\0', self.session)
        self.assertEqual(reply, b'\0\15')
        self.assertEqual(self.server.dispatch(2, 53, struct.pack('<II', self.child, 0), self.session), b'\0')

    def list_mail(self):
        return self.server.dispatch(2, 31, struct.pack('<BI', 5, self.child), self.session)

    def test_read_and_delete_survive_restarts(self):
        listing = self.list_mail()
        self.assertEqual(struct.unpack_from('<I', listing)[0], 1)
        self.assertEqual(len(listing), 4 + 75)
        message_id = struct.unpack_from('<I', listing, 4)[0]
        self.assertEqual(listing[8], 1)  # Unread.
        self.restart()
        payload = struct.pack('<IBBI', message_id, 0, 5, self.child)
        reply = self.server.dispatch(2, 32, payload, self.session)
        self.assertEqual(reply[:6], b'\0\1' + bytes(4))
        self.assertEqual(struct.unpack_from('<I', reply, 6)[0], len(reply) - 10)
        self.assertTrue(reply[10:].startswith(b'{\\rtf1'))
        self.restart()
        self.assertEqual(self.list_mail()[8], 2)
        self.server.dispatch(1, 37, struct.pack('<IBB', message_id, 0, 5), self.session)
        self.restart()
        self.assertEqual(self.list_mail(), bytes(4))
        self.assertEqual(self.server.dispatch(2, 32, payload, self.session)[0], 1)
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM messages').fetchone()[0], 1)

    def test_account_and_mailbox_isolation(self):
        self.assertEqual(self.server.dispatch(2, 27, self.code + b'wrong\0\0\0' + b'\0', {}), b'\4\0')
        self.assertIsNone(self.store.authenticate('UNKNOWN0000', b''))
        other_account, _ = self.store.register(registration())
        other_child = self.store.register_child(other_account, child_profile('Else'))
        with self.assertRaises(ValueError):
            self.server.dispatch(2, 31, struct.pack('<BI', 5, other_child), self.session)
        other_message = self.store.inbox(other_child)[0]['id']
        self.assertEqual(self.server.dispatch(2, 32, struct.pack('<IBBI', other_message, 0, 5, self.child), self.session)[0], 1)
        self.server.dispatch(1, 37, struct.pack('<IBB', other_message, 0, 5), self.session)
        self.assertEqual(len(self.store.inbox(other_child)), 1)
        self.assertEqual(self.server.dispatch(2, 53, struct.pack('<II', other_child, 0), self.session), b'\1')
        self.assertNotIn('child', self.session)

    def test_repeated_child_registration_does_not_duplicate_inbox(self):
        for _ in range(2):
            reply = self.server.dispatch(2, 30, child_profile(), self.session)
            self.assertEqual(struct.unpack('<I', reply[1:])[0], self.child)
        self.assertEqual(len(self.store.inbox(self.child)), 1)

    def test_native_forum_access_prerequisite(self):
        reply = self.server.dispatch(2, 59, struct.pack('<I', self.child), self.session)
        self.assertEqual(struct.unpack('<BBiBB', reply), (0, 255, -1, 0, 0))
        with self.assertRaises(ValueError):
            self.server.dispatch(2, 59, struct.pack('<I', self.child + 1), self.session)

    def test_cli_style_delivery_and_rtf_escaping(self):
        self.store.deliver(self.child, 'Message local', 'Été {test} \\ suite\n😊')
        self.restart()
        self.assertEqual(struct.unpack_from('<I', self.list_mail())[0], 2)
        body = self.store.inbox(self.child)[0]['body']
        self.assertIn(b'\\{test\\}', body)
        self.assertIn(b'\\\\ suite', body)
        self.assertIn(b'\\u201?', body)
        self.assertIn(b'\\u-10179?\\u-8694?', body)

    def test_malformed_operations_do_not_mutate_database(self):
        before = self.store.db.execute('SELECT COUNT(*) FROM messages').fetchone()[0]
        for kind, opcode, payload in [(2, 28, bytes(326)), (2, 30, bytes(51)),
                                      (2, 31, bytes(4)), (2, 32, bytes(9)), (1, 37, bytes(5))]:
            with self.assertRaises(ValueError):
                self.server.dispatch(kind, opcode, payload, dict(self.session))
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM messages').fetchone()[0], before)



class MigrationTests(unittest.TestCase):
    def test_import_is_idempotent_and_preserves_original_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            journal = path / 'prototype.jsonl'
            events = [frame(2, struct.pack('<HIB', opcode, 1, 0) + payload)
                      for opcode, payload in [(28, registration()), (30, child_profile())]]
            journal.write_text('\n'.join(json.dumps({'event': 'frame_received', 'hex': wire.hex()})
                                          for wire in events))
            store = Store(path / 'adi.sqlite3')
            try:
                self.assertTrue(store.import_prototype(journal))
                self.assertFalse(store.import_prototype(journal))
                account_id = store.authenticate('LOCAL000001', b'')
                self.assertTrue(store.owns_child(account_id, 707))
                self.assertEqual(len(store.inbox(707)), 1)
            finally:
                store.close()

    def test_import_collision_rolls_back_account_and_mail(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            journal = path / 'prototype.jsonl'
            events = [frame(2, struct.pack('<HIB', opcode, 1, 0) + payload)
                      for opcode, payload in [(28, registration()), (30, child_profile())]]
            journal.write_text('\n'.join(json.dumps({'event': 'frame_received', 'hex': wire.hex()})
                                          for wire in events))
            store = Store(path / 'adi.sqlite3')
            try:
                account_id, _ = store.register(registration(), code='OTHER000001')
                store.register_child(account_id, child_profile(), child_id=707)
                with self.assertRaises(sqlite3.IntegrityError):
                    store.import_prototype(journal)
                self.assertIsNone(store.authenticate('LOCAL000001', b''))
                self.assertEqual(len(store.inbox(707)), 1)
            finally:
                store.close()


if __name__ == '__main__':
    unittest.main()
