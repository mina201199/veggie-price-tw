"""Local-only portable launcher. Python 3.10+, no extra packages."""
import argparse
import functools
import http.server
import pathlib
import socket
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parent / 'prototype-3d'

class LocalServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = False
    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

def make_server(port=8877):
    if not all((ROOT / page).is_file() for page in ('prices.html', 'notebook.html', 'index.html')):
        raise FileNotFoundError('Missing prototype-3d files. Extract/copy the entire project folder first.')
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    return LocalServer(('127.0.0.1', port), handler)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--port', type=int, default=8877)
    args = parser.parse_args()
    try:
        server = make_server(args.port)
    except (OSError, ValueError) as error:
        print('Unable to start:', error)
        print('If port 8877 is busy, close your existing app server and try again.')
        print('No existing process or browser data was changed.')
        return 1
    url = f'http://localhost:{server.server_address[1]}/prices.html'
    print('App ready:', url)
    print('Keep this window open. Close it or press Ctrl+C to stop.')
    print('Notebook: use the same browser and localhost:8877 each time.')
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
