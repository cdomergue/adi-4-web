import struct
import tempfile
import unittest
from pathlib import Path
from server import Server
from storage import Store, timestamp
from classes import CATALOG
from test_server import registration, child_profile


class ClassTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'test.sqlite3'
        self.store = Store(self.path)
        self.server = Server(None, store=self.store)
        self.account, self.code = self.store.register(registration())
        self.child = self.store.register_child(self.account, child_profile())
        self.session = {'account': self.account, 'child': self.child}
        self.starts = timestamp() // 3600 * 3600 + 3600

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def query(self, op, data=b'', kind=2, session=None):
        return self.server.dispatch(kind, op, data, self.session if session is None else session)

    def select(self, starts=None, session=None, subject=77):
        child = self.child if session is None else session['child']
        data = self.query(13, struct.pack('<IBBBI', starts or self.starts, 0, 54, subject, child), session=session)
        self.assertEqual(len(data), 12)
        return struct.unpack('<BBBBII', data)

    def book(self, cid, seat=0, old=0, action=0, session=None, theme=71, lesson=65):
        child = self.child if session is None else session['child']
        return self.query(43, struct.pack('<BBIIBBI', theme, lesson, old, cid, seat, action, child), session=session)

    def test_catalog_and_six_native_seats(self):
        self.assertEqual(len(CATALOG), 222)
        *_, cid = self.select()
        seats = self.query(11, struct.pack('<I', cid))
        self.assertEqual(struct.unpack('<BI6I', seats), (0, 6, 0, 0, 0, 0, 0, 0))
        records = self.query(17, seats[1:])
        self.assertEqual(len(records), 4 + 6*50)
        self.assertEqual(records[4::50], b'\6'*6)

    def test_outside_schedule_returns_native_empty_catalog(self):
        data = struct.pack('<IBBBI', self.starts+40*86400, 70, 54, 77, self.child)
        self.assertEqual(self.query(13,data),bytes(8))

    def test_booking_survives_restart_and_cancellation(self):
        *_, cid = self.select()
        self.assertEqual(self.book(cid, 4), b'\0')
        self.store.close()
        self.store = Store(self.path)
        self.server = Server(None, store=self.store)
        self.session = {'account': self.account, 'child': self.child}
        self.assertEqual(self.select(), (1, 4, 71, 65, 1, cid))
        week = self.starts // 86400 * 86400
        listing = self.query(57, struct.pack('<IBI', week, 0, self.child))
        self.assertEqual(listing, struct.pack('<I',1)+bytes(((self.starts-week)//3600,54,77,71,65)))
        self.assertEqual(self.book(0, 4, old=cid, action=1), b'\0')
        self.assertEqual(self.select()[0], 0)

    def test_occupied_seat_and_failed_move_preserve_booking(self):
        *_, cid = self.select()
        self.assertEqual(self.book(cid), b'\0')
        other = self.store.register_child(self.account, child_profile('Second'))
        session = {'account': self.account, 'child': other}
        self.select(session=session)
        self.assertEqual(self.book(cid, session=session), b'\x0f')
        self.assertEqual(self.book(cid, 1, session=session), b'\0')
        self.assertEqual(self.book(cid, 1, old=cid, action=2), b'\x0f')
        self.assertEqual(self.server.classes.seats(cid)[:2], [self.child,other])
        self.assertEqual(self.book(cid, 2, old=cid, action=2), b'\0')
        self.assertEqual(self.server.classes.seats(cid)[:3], [0,other,self.child])

    def test_other_connection_and_simultaneous_subject_conflict(self):
        *_, cid = self.select()
        store2 = Store(self.path)
        try:
            server2 = Server(None, store=store2)
            self.assertEqual(self.book(cid), b'\0')
            other = self.store.register_child(self.account,child_profile('Concurrent'))
            data = struct.pack('<BBIIBBI',71,65,0,cid,0,0,other)
            self.assertEqual(server2.dispatch(2,43,data,{'account':self.account,'child':other}),b'\x0f')
        finally:
            store2.close()
        *_, french = self.select(subject=70)
        self.assertEqual(self.book(french,theme=65),b'\x0f')

    def test_malformed_and_cross_child_requests_do_not_mutate(self):
        *_, cid = self.select()
        for op, data in [(43,b''),(43,struct.pack('<BBIIBBI',71,65,0,cid,6,0,self.child)),
                         (43,struct.pack('<BBIIBBI',71,65,0,cid,0,0,self.child+1)),
                         (43,struct.pack('<BBIIBBI',90,90,0,cid,0,0,self.child)),
                         (57,struct.pack('<IBI',self.starts,0,self.child+1)),
                         (17,struct.pack('<I',0xffffffff)),(64,bytes(10))]:
            with self.subTest(op=op), self.assertRaises(ValueError):
                self.query(op,data)
        self.assertEqual(self.server.classes.seats(cid),[0]*6)
        with self.assertRaises(ValueError):
            self.query(38,struct.pack('<I',cid),session={'account':self.account,'child':self.child})
        with self.assertRaises(ValueError):
            self.query(52,session={'account':self.account})

    def test_class_entry_missing_archive_and_result_persistence(self):
        self.assertEqual(self.query(12)[-1],15)
        *_, cid = self.select(starts=timestamp()//3600*3600)
        self.assertEqual(self.book(cid),b'\0')
        self.assertEqual(self.query(12)[-1],1)
        info=self.query(38,struct.pack('<I',cid))
        self.assertEqual(info,bytes((0,54,77,71,65)))
        roster=self.query(56,struct.pack('<I',cid))
        self.assertEqual(len(roster),65)
        self.assertEqual(self.query(4,struct.pack('<I',self.child)),b'\0'+child_profile()[4:]+b'\0')
        self.assertEqual(self.query(64,bytes(6)+struct.pack('<I',1)+bytes(5)),struct.pack('<I',1)+b'\6')
        self.query(40,kind=1)
        self.query(49,bytes((10,3,2)),kind=1)
        self.query(49,bytes((15,3,2)),kind=1)
        self.query(10,struct.pack('<I',0),kind=1)
        with self.assertRaises(ValueError):
            self.query(49,bytes((99,3,2)),kind=1)
        self.store.close()
        self.store=Store(self.path)
        self.server=Server(None,store=self.store)
        self.assertEqual(struct.unpack('<IIIB',self.query(52)),(15,0,0,0))
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM class_results').fetchone()[0],1)

    def test_v1_migration_preserves_mail_and_accounts(self):
        self.store.db.executescript('DROP TABLE class_results; DROP TABLE reservations; DROP TABLE classes; PRAGMA user_version=1;')
        self.store.close()
        self.store=Store(self.path)
        self.assertEqual(self.store.db.execute('PRAGMA user_version').fetchone()[0],2)
        self.assertEqual(self.store.authenticate(self.code,b''),self.account)
        self.assertEqual(len(self.store.inbox(self.child)),1)

    def test_child_switch_clears_class_and_counts_persistent_reservations(self):
        *_, cid = self.select(starts=timestamp()//3600*3600)
        self.book(cid)
        self.query(12)
        check = self.query(59, struct.pack('<I', self.child))
        self.assertEqual(check[-1], 1)
        self.assertEqual(check[1], 255)
        other = self.store.register_child(self.account, child_profile('Other'))
        self.assertGreaterEqual(other, 100)
        self.query(53, struct.pack('<II',other,0))
        self.assertEqual(self.session, {'account':self.account,'child':other})
        with self.assertRaises(ValueError):
            self.query(49,bytes((20,3,2)),kind=1)
