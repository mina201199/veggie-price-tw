"""Start the bookkeeping notes on this PC; --lan permits the local network."""
from __future__ import annotations
import argparse
import ipaddress
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys

ROOT = Path(__file__).resolve().parent

def ordered_lan_addresses(candidates, primary=None):
    addresses = set()
    for candidate in [*candidates, primary]:
        try:
            address = ipaddress.ip_address(candidate)
        except ValueError:
            continue
        if address.version == 4 and address.is_private and not address.is_loopback and not address.is_link_local:
            addresses.add(str(address))
    return sorted(addresses, key=lambda address: (address != primary, address))

def lan_addresses():
    candidates = []
    primary = None
    try:
        candidates = [entry[4][0] for entry in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)]
    except OSError:
        pass
    # UDP connect asks the OS for its route; no application data is sent.
    for destination in ('1.1.1.1', '8.8.8.8'):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as route:
                route.connect((destination, 80))
                primary = route.getsockname()[0]
            break
        except OSError:
            continue
    return ordered_lan_addresses(candidates, primary)

def local_environment(data_dir, lan, port, addresses, inherited):
    env = dict(inherited)
    data_dir.mkdir(parents=True, exist_ok=True)
    key_path = data_dir / 'secret.key'
    if not env.get('DJANGO_SECRET_KEY'):
        try:
            descriptor = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            pass
        else:
            with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
                stream.write(secrets.token_urlsafe(64))
        env['DJANGO_SECRET_KEY'] = key_path.read_text(encoding='utf-8').strip()
        if len(env['DJANGO_SECRET_KEY']) < 50:
            raise ValueError('secret.key is invalid; restore your original secret or supply DJANGO_SECRET_KEY.')
    hosts = ['127.0.0.1', 'localhost'] + (list(addresses) if lan else [])
    hosts += [host.strip() for host in env.get('DJANGO_ALLOWED_HOSTS', '').split(',') if host.strip()]
    if '*' in hosts:
        raise ValueError('DJANGO_ALLOWED_HOSTS must name individual hosts; wildcard is not permitted by the local launcher.')
    env.update(BACKEND_DATA_DIR=str(data_dir.resolve()), DJANGO_ALLOWED_HOSTS=','.join(dict.fromkeys(hosts)))
    env.setdefault('DJANGO_DEBUG', '1')
    env.setdefault('DJANGO_SECURE_COOKIES', '0')
    urls = [f'http://127.0.0.1:{port}/app/']
    if lan:
        urls += [f'http://{address}:{port}/app/' for address in addresses]
    return env, urls

def venv_python():
    return ROOT / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lan', action='store_true', help='Listen on this PC local network (same Wi-Fi only).')
    parser.add_argument('--port', type=int, default=8878)
    parser.add_argument('--data-dir', type=Path, default=None)
    parser.add_argument('--check', action='store_true', help='Prepare database and run Django checks without starting server.')
    parser.add_argument('--manage', nargs=argparse.REMAINDER, help='Run a Django management command with the same private data settings.')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('--port must be between 1 and 65535')
    if sys.version_info < (3, 10):
        parser.error('Python 3.10 or newer is required.')
    python = venv_python()
    if Path(sys.prefix).resolve() != (ROOT / '.venv').resolve():
        if not python.exists():
            print('Install first: python setup_backend.py', flush=True)
            return 1
        return subprocess.call([str(python), str(Path(__file__).resolve()), *sys.argv[1:]], cwd=ROOT)
    try:
        import django
        import waitress
    except ImportError:
        print('Install/update dependencies: python setup_backend.py', flush=True)
        return 1
    data_dir = args.data_dir or Path(os.environ.get('BACKEND_DATA_DIR', ROOT / 'private' / 'backend'))
    try:
        env, urls = local_environment(data_dir, args.lan, args.port, lan_addresses(), os.environ)
        os.environ.update(env)
        if args.manage:
            return subprocess.call([sys.executable, str(ROOT / 'backend' / 'manage.py'), *args.manage], cwd=ROOT, env=env)
        for command in (['migrate', '--noinput'], ['check'], ['collectstatic', '--noinput']):
            subprocess.run([sys.executable, str(ROOT / 'backend' / 'manage.py'), *command], cwd=ROOT, env=env, check=True)
        if args.check:
            return 0
        sys.path.insert(0, str(ROOT / 'backend'))
        from config.wsgi import application
        print('\nBookkeeping notes:', flush=True)
        for index, url in enumerate(urls):
            label = 'Computer' if index == 0 else ('Phone: try first' if index == 1 else 'Other adapter: optional')
            print(f'  {label}: {url}', flush=True)
        if args.lan:
            print('iPhone: use the same Wi-Fi. These HTTP URLs work only on your local network.', flush=True)
            if len(urls) == 1:
                print('No LAN IPv4 detected. Check ipconfig, then set DJANGO_ALLOWED_HOSTS to the PC Wi-Fi IPv4.', flush=True)
        print('Keep this window open. Ctrl+C stops the server.', flush=True)
        waitress.serve(application, host='0.0.0.0' if args.lan else '127.0.0.1', port=args.port, threads=4, max_request_body_size=32 * 1024 * 1024)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f'Cannot start: {error}', file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 0
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
