#!/usr/bin/env python3
"""Prepare independent ADI/Wine copies; never edit the source installation."""
import argparse
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'serveur/runtime'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prefill', action='store_true', help='Prefill fictitious registration details')
    args = parser.parse_args()
    RUNTIME.mkdir(exist_ok=True)
    for name in ('game', 'wine'):
        source = ROOT / 'runtime' / name
        target = RUNTIME / name
        if not source.is_dir():
            raise SystemExit(f'Missing original installation: {source}')
        if not target.exists():
            subprocess.run(['cp', '--reflink=auto', '-a', str(source), str(target)], check=True)
    config = RUNTIME / 'game/INTERNET/POSTE.INF'
    backup = config.with_suffix('.INF.original')
    if not backup.exists():
        backup.write_bytes(config.read_bytes())
    config.write_bytes(b'[Adresses]\r\nNombre=1\r\nAdresse1=127.0.0.1\r\n'
                       b'\r\n[Ports]\r\nPort1=2001\r\n\r\n[Types]\r\nType1=TCP/IP\r\n')
    details = RUNTIME / 'game/INTERNET/USER/DETAILS.INF'
    if args.prefill and not details.exists():
        details.write_text('[Coordonnees]\nNom=Local\nPrenom=Test\nAdresse1=1 rue du Test\n'
                           'Adresse2=\nVille=Testville\nCodePostal=75000\nTelephone=0100000000\n'
                           'Mail=test@example.invalid\nFournisseur=Local\nCodePays=33\nCodeFour=16\n')
    print(f'Test installation: {RUNTIME}')
    print(f'Original endpoint preserved in: {backup}')


if __name__ == '__main__':
    main()
