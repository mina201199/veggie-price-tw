from pathlib import Path
import os
from urllib.parse import urlparse, unquote
BASE_DIR=Path(__file__).resolve().parent.parent
PROJECT_DIR=BASE_DIR.parent
DATA_DIR=Path(os.environ.get('BACKEND_DATA_DIR',str(BASE_DIR/'data'))).resolve()
DATA_DIR.mkdir(parents=True,exist_ok=True)
DEBUG=os.environ.get('DJANGO_DEBUG','1').lower() in ('1','true','yes')
SECRET_KEY=os.environ.get('DJANGO_SECRET_KEY','local-development-only-change-before-deployment')
ALLOWED_HOSTS=[x.strip() for x in os.environ.get('DJANGO_ALLOWED_HOSTS','localhost,127.0.0.1,[::1]').split(',') if x.strip()]
if not DEBUG and (len(SECRET_KEY)<50 or SECRET_KEY=='local-development-only-change-before-deployment' or not os.environ.get('DJANGO_ALLOWED_HOSTS') or '*' in ALLOWED_HOSTS):
    raise RuntimeError('Production requires DJANGO_SECRET_KEY and DJANGO_ALLOWED_HOSTS')
INSTALLED_APPS=['django.contrib.admin','django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles','ledger']
MIDDLEWARE=['django.middleware.security.SecurityMiddleware','django.contrib.sessions.middleware.SessionMiddleware','django.middleware.common.CommonMiddleware','django.middleware.csrf.CsrfViewMiddleware','django.contrib.auth.middleware.AuthenticationMiddleware','django.contrib.messages.middleware.MessageMiddleware','django.middleware.clickjacking.XFrameOptionsMiddleware','ledger.middleware.PrivateAPIMiddleware']
ROOT_URLCONF='config.urls'
TEMPLATES=[{'BACKEND':'django.template.backends.django.DjangoTemplates','DIRS':[],'APP_DIRS':True,'OPTIONS':{'context_processors':['django.template.context_processors.request','django.contrib.auth.context_processors.auth','django.contrib.messages.context_processors.messages']}}]
DATABASES={'default':{'ENGINE':'django.db.backends.sqlite3','NAME':DATA_DIR/'db.sqlite3','OPTIONS':{'timeout':20}}}
if os.environ.get('DATABASE_URL'):
    parsed=urlparse(os.environ['DATABASE_URL'])
    if parsed.scheme not in ('postgres','postgresql'): raise RuntimeError('DATABASE_URL must use PostgreSQL')
    DATABASES={'default':{'ENGINE':'django.db.backends.postgresql','NAME':unquote(parsed.path.lstrip('/')),'USER':unquote(parsed.username or ''),'PASSWORD':unquote(parsed.password or ''),'HOST':parsed.hostname,'PORT':parsed.port or 5432,'CONN_MAX_AGE':60,'OPTIONS':{'sslmode':os.environ.get('DATABASE_SSLMODE','prefer')}}}
AUTH_PASSWORD_VALIDATORS=[{'NAME':'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},{'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator'},{'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'},{'NAME':'django.contrib.auth.password_validation.NumericPasswordValidator'}]
WSGI_APPLICATION='config.wsgi.application'
LANGUAGE_CODE='zh-hant'
TIME_ZONE='Asia/Taipei'
USE_I18N=True
USE_TZ=True
STATIC_URL='/static/'
STATIC_ROOT=DATA_DIR/'static'
MEDIA_ROOT=DATA_DIR/'photos'
DEFAULT_AUTO_FIELD='django.db.models.BigAutoField'
SESSION_COOKIE_HTTPONLY=True
SESSION_COOKIE_SAMESITE='Lax'
SESSION_COOKIE_SECURE=os.environ.get('DJANGO_SECURE_COOKIES','0' if DEBUG else '1').lower() in ('1','true','yes')
CSRF_COOKIE_SECURE=SESSION_COOKIE_SECURE
CSRF_COOKIE_SAMESITE='Lax'
CSRF_TRUSTED_ORIGINS=[x.strip() for x in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS','').split(',') if x.strip()]
CSRF_FAILURE_VIEW='ledger.views.csrf_failure'
SECURE_CONTENT_TYPE_NOSNIFF=True
SECURE_REFERRER_POLICY='same-origin'
SECURE_SSL_REDIRECT=not DEBUG
SECURE_HSTS_SECONDS=0 if DEBUG else 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=not DEBUG
SECURE_HSTS_PRELOAD=not DEBUG
if os.environ.get('DJANGO_PROXY_SSL_HEADER')=='1': SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO','https')
DATA_UPLOAD_MAX_MEMORY_SIZE=32*1024*1024
FILE_UPLOAD_MAX_MEMORY_SIZE=6*1024*1024
SECURE_REDIRECT_EXEMPT=['^api/v1/health/$']
