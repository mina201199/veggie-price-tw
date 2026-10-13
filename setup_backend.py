"""Install isolated backend dependencies into the project .venv."""
import os
from pathlib import Path
import subprocess
import sys
import venv
ROOT = Path(__file__).resolve().parent
if __name__ == '__main__':
    if sys.version_info < (3, 10):
        raise SystemExit('Python 3.10 or newer is required.')
    folder = ROOT / '.venv'
    python = folder / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not python.exists():
        venv.EnvBuilder(with_pip=True).create(folder)
    subprocess.run([str(python), '-m', 'pip', 'install', '-r', str(ROOT / 'requirements-backend.txt')], check=True, cwd=ROOT)
    print('Ready. Run Start-Backend.cmd (or python start_backend.py --lan).')
