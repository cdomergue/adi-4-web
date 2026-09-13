"""Persistent local accounts, children, inboxes and classes (SQLite)."""
import contextlib
import hashlib
import hmac
import json
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_DB = Path(__file__).resolve().parent / 'runtime/adi.sqlite3'


def timestamp():
    # ADI represents local calendar time as seconds since 1970, without TZ conversion.
    return int(datetime.now().replace(tzinfo=timezone.utc).timestamp())


def cstring(data):
    return data.split(b'\0', 1)[0]


def rtf(text):
    """Escape text into an ASCII RTF document, including Unicode surrogate pairs."""
    result = []
    for char in text.replace('\r\n', '\n').replace('\r', '\n'):
        if char == '\n':
            result.append('\\par\n')
        elif char in '\\{}':
            result.append('\\' + char)
        elif char == '\t':
            result.append('\\tab ')
        elif 32 <= ord(char) < 127:
            result.append(char)
        else:
            data = char.encode('utf-16-le')
            for index in range(0, len(data), 2):
                unit = int.from_bytes(data[index:index + 2], 'little', signed=True)
                result.append(f'\\u{unit}?')
    return ('{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1'
            '{\\fonttbl{\\f0 Arial;}}\\f0\\fs24 ' + ''.join(result) + '}').encode('ascii')


class Store:
    def __init__(self, path=DEFAULT_DB):
        if str(path) != ':memory:':
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.execute('PRAGMA busy_timeout=5000')
        self.db.execute('PRAGMA journal_mode=WAL')
        version = self.db.execute('PRAGMA user_version').fetchone()[0]
        if version not in (0, 1, 2):
            self.db.close()
            raise ValueError(f'Unsupported database schema {version}')
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                password_salt BLOB NOT NULL,
                password_hash BLOB NOT NULL,
                details BLOB NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS children (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL REFERENCES accounts(id),
                name TEXT NOT NULL,
                profile BLOB NOT NULL,
                UNIQUE(account_id, profile)
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER NOT NULL REFERENCES children(id),
                title TEXT NOT NULL,
                body BLOB NOT NULL,
                created_at INTEGER NOT NULL,
                read_at INTEGER,
                deleted_at INTEGER,
                seed_key TEXT UNIQUE
            );
            CREATE INDEX IF NOT EXISTS inbox ON messages(child_id, deleted_at, id);
            CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                starts_at INTEGER NOT NULL,
                subject INTEGER NOT NULL,
                level INTEGER NOT NULL,
                theme INTEGER NOT NULL,
                lesson INTEGER NOT NULL,
                UNIQUE(starts_at, subject, level)
            );
            CREATE TABLE IF NOT EXISTS reservations (
                class_id INTEGER NOT NULL REFERENCES classes(id),
                child_id INTEGER NOT NULL REFERENCES children(id),
                seat INTEGER NOT NULL CHECK(seat BETWEEN 0 AND 5),
                created_at INTEGER NOT NULL,
                PRIMARY KEY(class_id, child_id),
                UNIQUE(class_id, seat)
            );
            CREATE TABLE IF NOT EXISTS class_results (
                class_id INTEGER NOT NULL REFERENCES classes(id),
                child_id INTEGER NOT NULL REFERENCES children(id),
                phase INTEGER NOT NULL,
                points INTEGER NOT NULL CHECK(points BETWEEN 0 AND 255),
                answer INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY(class_id, child_id, phase)
            );
            PRAGMA user_version=2;
        ''')

    def close(self):
        self.db.close()

    @contextlib.contextmanager
    def transaction(self):
        # Nested savepoints keep the explicit prototype migration atomic.
        if self.db.in_transaction:
            name = 'adi_' + secrets.token_hex(8)
            self.db.execute(f'SAVEPOINT {name}')
            try:
                yield
            except BaseException:
                self.db.execute(f'ROLLBACK TO {name}')
                self.db.execute(f'RELEASE {name}')
                raise
            else:
                self.db.execute(f'RELEASE {name}')
        else:
            self.db.execute('BEGIN IMMEDIATE')
            try:
                yield
            except BaseException:
                self.db.rollback()
                raise
            else:
                self.db.commit()

    @staticmethod
    def password_hash(password, salt):
        return hashlib.pbkdf2_hmac('sha256', cstring(password), salt, 120_000)

    def register(self, payload, code=None):
        if len(payload) != 327:
            raise ValueError('FIRSTCON must contain 327 bytes')
        salt = secrets.token_bytes(16)
        password_hash = self.password_hash(payload[318:326], salt)
        with self.transaction():
            # Allocate a unique 11-character code; the wire reserves its 12th byte for NUL.
            if code is None:
                number = self.db.execute('SELECT COALESCE(MAX(id), 0) + 1 FROM accounts').fetchone()[0]
                code = f'LOCAL{number:06d}'
            if len(code) != 11 or not code.isascii():
                raise ValueError('Account code must contain 11 ASCII characters')
            cursor = self.db.execute(
                'INSERT INTO accounts(code,password_salt,password_hash,details,created_at) VALUES(?,?,?,?,?)',
                (code, salt, password_hash, payload[:318], timestamp()))
            return cursor.lastrowid, code

    def authenticate(self, code, password):
        row = self.db.execute('SELECT * FROM accounts WHERE code=?', (code,)).fetchone()
        if row is None:
            return None
        if not hmac.compare_digest(self.password_hash(password, row['password_salt']), row['password_hash']):
            return None
        return row['id']

    def register_child(self, account_id, profile, child_id=None):
        if len(profile) != 52:
            raise ValueError('CHILDCON must contain 52 bytes')
        name = cstring(profile[28:52]).decode('cp850')
        with self.transaction():
            row = self.db.execute('SELECT id FROM children WHERE account_id=? AND profile=?',
                                  (account_id, profile)).fetchone()
            if row:
                return row['id']
            if child_id is None:
                # The native virtual-class client reserves IDs 10, 11 and 12 for clowns.
                child_id = max(100, self.db.execute(
                    'SELECT COALESCE(MAX(id),0)+1 FROM children').fetchone()[0])
            cursor = self.db.execute('INSERT INTO children(id,account_id,name,profile) VALUES(?,?,?,?)',
                                     (child_id, account_id, name, profile))
            child_id = cursor.lastrowid
            self.db.execute('INSERT INTO messages(child_id,title,body,created_at,seed_key) VALUES(?,?,?,?,?)',
                            (child_id, 'Bienvenue dans ton courrier local',
                             rtf('Bonjour !\n\nCe message vient de ton serveur local. '
                                 'Ta boîte aux lettres conserve maintenant tes messages.\n\n'
                                 'Tu peux lire ce message, quitter Adi, te reconnecter et le retrouver. '
                                 'Si tu le supprimes, il restera supprimé après le redémarrage.\n\n'
                                 'Bon retour sur la planète ADI421 !'), timestamp(), f'welcome:{child_id}'))
            return child_id

    def owns_child(self, account_id, child_id):
        return self.db.execute('SELECT 1 FROM children WHERE id=? AND account_id=?',
                               (child_id, account_id)).fetchone() is not None

    def inbox(self, child_id):
        return self.db.execute('SELECT * FROM messages WHERE child_id=? AND deleted_at IS NULL '
                               'ORDER BY id DESC LIMIT 200', (child_id,)).fetchall()

    def read_message(self, child_id, message_id):
        with self.transaction():
            row = self.db.execute('SELECT * FROM messages WHERE id=? AND child_id=? AND deleted_at IS NULL',
                                  (message_id, child_id)).fetchone()
            if row:
                self.db.execute('UPDATE messages SET read_at=COALESCE(read_at,?) WHERE id=?',
                                (timestamp(), message_id))
            return row

    def delete_message(self, child_id, message_id):
        with self.transaction():
            self.db.execute('UPDATE messages SET deleted_at=COALESCE(deleted_at,?) WHERE id=? AND child_id=?',
                            (timestamp(), message_id, child_id))

    def deliver(self, child_id, title, text):
        if not title or len(title.encode('cp850')) > 39:
            raise ValueError('Title must contain 1–39 CP850 bytes')
        body = rtf(text)
        if len(body) > 100_000:
            raise ValueError('Message is too long')
        with self.transaction():
            cursor = self.db.execute('INSERT INTO messages(child_id,title,body,created_at) VALUES(?,?,?,?)',
                                     (child_id, title, body, timestamp()))
            return cursor.lastrowid

    def import_prototype(self, journal):
        """One-time explicit migration of the earlier local account, preserving ID 707."""
        if self.db.execute('SELECT 1 FROM accounts WHERE code=?', ('LOCAL000001',)).fetchone():
            return False
        registration = profile = None
        for line in Path(journal).read_text().splitlines():
            event = json.loads(line)
            if event.get('event') != 'frame_received' or 'hex' not in event:
                continue
            wire = bytes.fromhex(event['hex'])
            if len(wire) < 15 or wire[6] != 2 or wire[14] != 0:
                continue
            opcode = int.from_bytes(wire[8:10], 'little')
            if opcode == 28 and len(wire[15:]) == 327:
                registration = wire[15:]
            elif opcode == 30 and len(wire[15:]) == 52:
                profile = wire[15:]
        if registration is None or profile is None:
            raise ValueError('Journal has no complete prototype registration and child profile')
        with self.transaction():
            account_id, _ = self.register(registration, code='LOCAL000001')
            self.register_child(account_id, profile, child_id=707)
        return True
