"""ADI class reservations. Wire layouts come from AI_REQUE/CV_REQUE 4.21.

Six seats per class; catalog metadata is bundled, educational STK files are not.
All mutations run in SQLite transactions, including seat changes.
"""
import json
import struct
from pathlib import Path
from storage import timestamp

CATALOG = json.loads(Path(__file__).with_name('class-catalog.json').read_text(encoding='utf-8'))
LESSONS = {(ord(r['subject']), ord(r['level']), ord(r['theme']), ord(r['lesson']))
           for r in CATALOG}
OPCODES = {4, 10, 11, 12, 13, 17, 20, 38, 40, 43, 49, 51, 52, 54, 56, 57, 64}


def unpack(fmt, payload):
    if len(payload) != struct.calcsize(fmt):
        raise ValueError('Invalid class request length')
    return struct.unpack(fmt, payload)


class Classes:
    def __init__(self, store):
        self.store = store
        self.db = store.db

    def row(self, class_id):
        row = self.db.execute('SELECT * FROM classes WHERE id=?', (class_id,)).fetchone()
        if row is None:
            raise ValueError('Unknown class')
        return row

    def catalog_class(self, starts, subject, level):
        if starts % 3600 or abs(starts - timestamp()) > 35 * 86400:
            raise ValueError('Class date must be on the hour, within 35 days')
        choices = [r for r in CATALOG if ord(r['subject']) == subject and ord(r['level']) == level]
        if not choices:
            raise ValueError('Unknown subject or level')
        first = choices[0]
        with self.store.transaction():
            self.db.execute('INSERT OR IGNORE INTO classes '
                            '(starts_at,subject,level,theme,lesson) VALUES (?,?,?,?,?)',
                            (starts, subject, level, ord(first['theme']), ord(first['lesson'])))
        return self.db.execute('SELECT * FROM classes WHERE starts_at=? AND subject=? AND level=?',
                               (starts, subject, level)).fetchone()

    def seats(self, class_id):
        result = [0] * 6
        for row in self.db.execute('SELECT seat,child_id FROM reservations WHERE class_id=?',
                                   (class_id,)):
            result[row['seat']] = row['child_id']
        return result

    def booking(self, child, payload):
        theme, lesson, old_id, new_id, seat, action, requested = unpack('<BBIIBBI', payload)
        if requested != child or action not in (0, 1, 2) or seat >= 6:
            raise ValueError('Invalid reservation owner or action')
        with self.store.transaction():
            if action in (1, 2):
                old = self.db.execute('SELECT * FROM reservations WHERE class_id=? AND child_id=?',
                                      (old_id, child)).fetchone()
                if old is None:
                    return b'\x10'
            elif old_id:
                raise ValueError('Unexpected previous class')
            if action != 1:
                row = self.row(new_id)
                if row['starts_at'] + 3600 <= timestamp():
                    return b'\x10'
                if (row['subject'], row['level'], theme, lesson) not in LESSONS:
                    raise ValueError('Unknown lesson')
                occupied = self.seats(new_id)
                if occupied[seat] not in (0, child):
                    return b'\x0f'
                conflict = self.db.execute('''SELECT r.class_id FROM reservations r JOIN classes c
                    ON c.id=r.class_id WHERE r.child_id=? AND c.starts_at=?
                    AND r.class_id NOT IN (?,?)''', (child, row['starts_at'], old_id, new_id)).fetchone()
                if conflict:
                    return b'\x0f'
                others = [i for i in occupied if i and i != child]
                if others and (theme, lesson) != (row['theme'], row['lesson']):
                    return b'\x0f'
            if action in (1, 2):
                self.db.execute('DELETE FROM reservations WHERE class_id=? AND child_id=?',
                                (old_id, child))
            if action != 1:
                self.db.execute('DELETE FROM reservations WHERE class_id=? AND child_id=?',
                                (new_id, child))
                self.db.execute('INSERT INTO reservations VALUES (?,?,?,?)',
                                (new_id, child, seat, timestamp()))
                self.db.execute('UPDATE classes SET theme=?,lesson=? WHERE id=?',
                                (theme, lesson, new_id))
        return b'\0'

    def child_record(self, child, visible):
        if not child or child not in visible:
            return b'\6' + bytes(49)
        row = self.db.execute('SELECT profile FROM children WHERE id=?', (child,)).fetchone()
        return b'\0' + row['profile'][4:] + b'\0'

    def dispatch(self, kind, opcode, payload, session):
        child = session.get('child')
        if child is None:
            raise ValueError('Child login required for classes')
        if kind == 2 and opcode == 12:
            unpack('', payload)
            row = self.db.execute('''SELECT c.* FROM reservations r JOIN classes c ON c.id=r.class_id
                WHERE r.child_id=? AND c.starts_at<=? AND c.starts_at+3600>?
                ORDER BY c.starts_at LIMIT 1''', (child, timestamp(), timestamp())).fetchone()
            if row is None:
                session.pop('class', None)
                return struct.pack('<IIIB', 0, 0, 0, 15)
            session['class'] = row['id']
            session['phase'] = 1
            return struct.pack('<IIIB', row['id'], row['starts_at'],
                               max(1, row['starts_at'] + 3600 - timestamp()), 1)
        if kind == 2 and opcode == 13:
            starts, language, level, subject, requested = unpack('<IBBBI', payload)
            if requested != child:
                raise ValueError('Reservation does not belong to selected child')
            if starts % 3600 or abs(starts - timestamp()) > 35 * 86400:
                # The client displays its native "no class" dialog for an empty catalog.
                return bytes(8)
            row = self.catalog_class(starts, subject, level)
            session.setdefault('viewed_classes', set()).add(row['id'])
            seats = self.seats(row['id'])
            index = seats.index(child) if child in seats else 0
            return struct.pack('<BBBBII', int(child in seats), index, row['theme'],
                               row['lesson'], 1, row['id'])
        if kind == 2 and opcode in (11, 38, 56):
            class_id, = unpack('<I', payload)
            if class_id not in session.get('viewed_classes', set()) and class_id != session.get('class'):
                raise ValueError('Class has not been selected')
            row = self.row(class_id)
            seats = self.seats(class_id)
            if opcode == 11:
                return b'\0' + struct.pack('<I6I', 6, *seats)
            if opcode == 38:
                return bytes((0, row['level'], row['subject'], row['theme'], row['lesson']))
            return b'\0' + struct.pack('<I', 6) + b''.join(
                struct.pack('<BBIi', i, int(occupant == child), 1, occupant or -1)
                for i, occupant in enumerate(seats))
        if kind == 2 and opcode in (17, 4):
            visible = {child}
            for cid in session.get('viewed_classes', set()) | {session.get('class', 0)}:
                visible.update(self.seats(cid))
            if opcode == 4:
                requested, = unpack('<I', payload)
                return self.child_record(requested, visible)
            if len(payload) < 4:
                raise ValueError('Truncated child list')
            count, = struct.unpack_from('<I', payload)
            if count > 6 or len(payload) != 4 + count * 4:
                raise ValueError('Invalid child list')
            ids = struct.unpack_from(f'<{count}I', payload, 4)
            return struct.pack('<I', count) + b''.join(self.child_record(i, visible) for i in ids)
        if kind == 2 and opcode == 43:
            return self.booking(child, payload)
        if kind == 2 and opcode == 57:
            start, language, requested = unpack('<IBI', payload)
            if child != requested:
                raise ValueError('Invalid reservation owner')
            rows = self.db.execute('''SELECT c.* FROM reservations r JOIN classes c ON c.id=r.class_id
                WHERE r.child_id=? AND c.starts_at>=? AND c.starts_at<? ORDER BY c.starts_at''',
                (child, start, start + 7 * 86400)).fetchall()
            return struct.pack('<I', len(rows)) + b''.join(bytes(((r['starts_at'] - start) // 3600,
                r['level'], r['subject'], r['theme'], r['lesson'])) for r in rows)
        if kind == 2 and opcode == 20:
            if len(payload) < 12:
                raise ValueError('Truncated reservation grid')
            start, language, level, subject, mode, count = struct.unpack_from('<IBBBBI', payload)
            if count > 6 or len(payload) != 12 + 4 * count:
                raise ValueError('Invalid reservation grid')
            # Only the selected child's bookings are exposed by this local server.
            grid = bytearray(168)
            for row in self.db.execute('''SELECT c.starts_at FROM reservations r JOIN classes c
                ON c.id=r.class_id WHERE r.child_id=? AND c.subject=? AND c.level=?
                AND c.starts_at>=? AND c.starts_at<?''', (child, subject, level, start, start+604800)):
                grid[(row[0]-start)//3600] = 1
            return struct.pack('<I', 168) + grid
        if kind == 2 and opcode == 52:
            unpack('', payload)
            # SENDRESULT carries cumulative points for a session, not a delta.
            points = self.db.execute('''SELECT COALESCE(SUM(points),0) FROM (
                SELECT MAX(points) AS points FROM class_results WHERE child_id=? GROUP BY class_id)''',
                (child,)).fetchone()[0]
            return struct.pack('<IIIB', points, 0, 0, 0)
        if kind == 2 and opcode == 64:
            if len(payload) < 10:
                raise ValueError('Truncated lesson request')
            count, = struct.unpack_from('<I', payload, 6)
            if not 1 <= count <= 6 or len(payload) != 10 + 5 * count:
                raise ValueError('Invalid lesson count')
            # Native missing-resource status. Never send a made-up STK archive.
            return struct.pack('<I', count) + b'\6' * count
        if kind == 1 and opcode in (10, 40, 49):
            class_id = session.get('class')
            if class_id is None or not self.db.execute(
                    'SELECT 1 FROM reservations WHERE class_id=? AND child_id=?',
                    (class_id, child)).fetchone():
                raise ValueError('Enter a class first')
            if opcode == 10:
                phase, = unpack('<I', payload)
                if phase > 14:
                    raise ValueError('Invalid class phase')
                session['screen'] = phase
                if phase == 0:
                    session.pop('class', None)
                    session.pop('ready', None)
                return None
            if opcode == 40:
                unpack('', payload)
                session['ready'] = True
                return None
            points, phase, answer = unpack('<BBB', payload)
            if not 1 <= phase <= 14:
                raise ValueError('Invalid result phase')
            with self.store.transaction():
                self.db.execute('''INSERT INTO class_results VALUES (?,?,?,?,?,?)
                    ON CONFLICT(class_id,child_id,phase) DO UPDATE SET
                    points=excluded.points, answer=excluded.answer, updated_at=excluded.updated_at''',
                    (class_id, child, phase, points, answer, timestamp()))
            return None
        if kind == 2 and opcode == 51:
            start, language, subject, level, requested, end = unpack('<IBBBII', payload)
            if requested != child or end < start:
                raise ValueError('Invalid result owner or dates')
            # Result records need their own historical aggregation; an empty history is valid.
            return b'\0' + bytes(4)
        if kind == 2 and opcode == 54:
            unpack('<I', payload)
            return b'\0'
        if kind == 1 and opcode == 54:
            unpack('<I', payload)
            return None
        raise ValueError(f'Class opcode {opcode} not implemented yet')


def main():
    import argparse
    from datetime import datetime, timezone
    from storage import DEFAULT_DB, Store

    parser = argparse.ArgumentParser(description='Gérer les réservations des classes locales ADI.')
    parser.add_argument('--db', type=Path, default=DEFAULT_DB)
    commands = parser.add_subparsers(dest='command', required=True)
    listing = commands.add_parser('list', help='Afficher les réservations enregistrées')
    listing.add_argument('--child', type=int)
    reserve = commands.add_parser('reserve', help='Réserver une place locale')
    reserve.add_argument('--child', type=int, required=True)
    reserve.add_argument('--at', default='now', help='now ou date locale YYYY-MM-DDTHH:00')
    reserve.add_argument('--subject', choices=('M', 'F'), default='M')
    reserve.add_argument('--level', choices=tuple('A9876543'), default='6')
    reserve.add_argument('--theme', default='G')
    reserve.add_argument('--lesson', default='A')
    reserve.add_argument('--seat', type=int, choices=range(1, 7), default=1)
    cancel = commands.add_parser('cancel', help='Annuler une réservation')
    cancel.add_argument('--child', type=int, required=True)
    cancel.add_argument('--class-id', type=int, required=True)
    args = parser.parse_args()
    store = Store(args.db)
    try:
        classes = Classes(store)
        if args.command == 'list':
            rows = store.db.execute('''SELECT c.*,r.child_id,r.seat,ch.name FROM reservations r
                JOIN classes c ON c.id=r.class_id JOIN children ch ON ch.id=r.child_id
                WHERE (? IS NULL OR r.child_id=?) ORDER BY c.starts_at,c.id,r.seat''',
                (args.child, args.child)).fetchall()
            print(json.dumps([dict(r) for r in rows], ensure_ascii=False, indent=2))
            return
        if not store.db.execute('SELECT 1 FROM children WHERE id=?', (args.child,)).fetchone():
            parser.error('Élève inconnu ; utiliser mail.py profiles pour voir les identifiants.')
        if args.command == 'reserve':
            if len(args.theme) != 1 or len(args.lesson) != 1:
                parser.error('Le thème et la séance doivent être des codes de catalogue à une lettre.')
            starts = (timestamp() // 3600 * 3600 if args.at == 'now' else
                      int(datetime.fromisoformat(args.at).replace(tzinfo=timezone.utc).timestamp()))
            row = classes.catalog_class(starts, ord(args.subject), ord(args.level))
            reply = classes.booking(args.child, struct.pack('<BBIIBBI', ord(args.theme),
                ord(args.lesson), 0, row['id'], args.seat-1, 0, args.child))
            result = {'class_id': row['id'], 'child_id': args.child, 'status': reply[0]}
        else:
            reply = classes.booking(args.child, struct.pack('<BBIIBBI', 0, 0, args.class_id,
                                     0, 0, 1, args.child))
            result = {'class_id': args.class_id, 'child_id': args.child, 'status': reply[0]}
        print(json.dumps(result))
        if reply != b'\0':
            raise SystemExit(1)
    except ValueError as error:
        parser.error(str(error))
    finally:
        store.close()


if __name__ == '__main__':
    main()
