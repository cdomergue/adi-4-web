#!/usr/bin/env python3
"""Deliver a message to an ADI inbox in the local SQLite database."""
import argparse
import json
from pathlib import Path
from storage import DEFAULT_DB, Store


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, default=DEFAULT_DB)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('profiles')
    migration = commands.add_parser('import-prototype')
    migration.add_argument('journal', type=Path)
    delivery = commands.add_parser('deliver')
    delivery.add_argument('--child', type=int, required=True)
    delivery.add_argument('--title', required=True)
    delivery.add_argument('--body-file', type=Path, required=True)
    args = parser.parse_args()
    store = Store(args.db)
    try:
        if args.command == 'profiles':
            rows = store.db.execute('SELECT children.id,children.name,accounts.code FROM children '
                                    'JOIN accounts ON account_id=accounts.id ORDER BY children.id')
            print(json.dumps([dict(row) for row in rows], ensure_ascii=False, indent=2))
        elif args.command == 'import-prototype':
            print('Imported.' if store.import_prototype(args.journal) else 'Already imported.')
        else:
            message_id = store.deliver(args.child, args.title, args.body_file.read_text())
            print(f'Local message {message_id} delivered to child {args.child}.')
    finally:
        store.close()


if __name__ == '__main__':
    main()
