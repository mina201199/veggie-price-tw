"""Single app process; migrations run after PostgreSQL health check."""
import os
from pathlib import Path
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
subprocess.run([sys.executable, str(ROOT / 'backend/manage.py'), 'migrate', '--noinput'], check=True)
subprocess.run([sys.executable, str(ROOT / 'backend/manage.py'), 'check', '--deploy'], check=True)
subprocess.run([sys.executable, str(ROOT / 'backend/manage.py'), 'collectstatic', '--noinput'], check=True)
from config.wsgi import application
from waitress import serve
from proxy_config import proxy_options
serve(application, host='0.0.0.0', port=8878, threads=4, max_request_body_size=32 * 1024 * 1024, **proxy_options(os.environ))
