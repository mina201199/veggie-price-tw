import base64, hashlib, io, json, mimetypes, re, warnings
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from functools import wraps
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError, RequestDataTooBig
from django.db import transaction, connection, IntegrityError
from django.db.models import F
from django.http import JsonResponse, HttpResponse, FileResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from .models import ShoppingNote, NoteRevision, Photo, AuthAttempt

UNITS=['g','kg','台斤','顆','包','盒','把','個','瓶','罐','份','公升','ml','片']
KINDS=['收據','標價','其他']
class APIError(Exception):
    def __init__(self,message,code='invalid',status=400): self.message,self.code,self.status=message,code,status

def error(message,code='invalid',status=400): return JsonResponse({'error':{'code':code,'message':message}},status=status)
def csrf_failure(request,reason=''): return error('安全驗證失敗，請重新整理頁面。','csrf',403)
def endpoint(methods,private=True):
    def decorator(fn):
        @wraps(fn)
        def wrapped(request,*args,**kwargs):
            if request.method not in methods: return error('不支援此操作。','method',405)
            if private and not request.user.is_authenticated: return error('請先登入。','unauthorized',401)
            try: return fn(request,*args,**kwargs)
            except APIError as exc: return error(exc.message,exc.code,exc.status)
            except (ValueError,TypeError,InvalidOperation,OverflowError,RequestDataTooBig): return error('資料格式或大小不正確。')
            except IntegrityError: return error('資料已由另一個操作更新，請重新整理。','conflict',409)
        return wrapped
    return decorator

def body(request):
    if request.content_type!='application/json': raise APIError('請使用 JSON 格式。')
    if len(request.body)>32*1024*1024: raise APIError('資料超過 32 MB 限制。','too_large',413)
    try: data=json.loads(request.body)
    except (json.JSONDecodeError,UnicodeDecodeError): raise APIError('不是有效的 JSON。')
    if not isinstance(data,dict): raise APIError('資料必須是物件。')
    return data

def text(value,maxlength=200):
    if value is None: return ''
    if not isinstance(value,str) or len(value)>maxlength: raise APIError('文字欄位格式或長度不正確。')
    return value.strip()

def number(value,positive=True):
    if isinstance(value,bool) or value is None: raise APIError('請填寫有效金額或數量。')
    try: n=Decimal(str(value))
    except InvalidOperation: raise APIError('請填寫有效金額或數量。')
    if not n.is_finite() or n<0 or (positive and n==0) or n>1000000 or n.as_tuple().exponent < -6: raise APIError('金額與數量需大於零、不超過一百萬，且最多六位小數。')
    return n

def decimal_string(n): return format(Decimal(n).normalize(),'f')
def valid_date(value,optional=False):
    if optional and value in (None,''): return None
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value): raise APIError('日期格式需為 YYYY-MM-DD。')
    try: return date.fromisoformat(value)
    except ValueError: raise APIError('日期不正確。')
def timestamp(value):
    if not isinstance(value,str) or len(value)>40: raise APIError('歷史時間格式不正確。')
    dt=parse_datetime(value)
    if not dt or timezone.is_naive(dt): raise APIError('歷史時間需包含時區。')
    return dt

def normalize_note(data,owner,photo_map=None,imported=False):
    if not isinstance(data,dict): raise APIError('筆記必須是物件。')
    n={key:text(data.get(key),2000 if key=='notes' else 200) for key in ['venue','product','brand','origin','spec','promo','freshness','taste','service','notes','repurchase']}
    if not n['venue'] or not n['product']: raise APIError('請填寫分店／攤位和商品名稱。')
    n['date']=valid_date(data.get('date')).isoformat()
    n['price']=decimal_string(number(data.get('price')))
    if data.get('quantity') in (None,''):
        n['quantity']=None; n['unit']=''
    else:
        n['quantity']=decimal_string(number(data.get('quantity'))); n['unit']=text(data.get('unit'),12)
        if n['unit'] not in UNITS: raise APIError('請選擇支援的數量單位。')
    n['experience']=text(data.get('experience'),20)
    if n['experience'] not in ('','不好','普通','優秀'): raise APIError('購買經驗選項不正確。')
    n['share']=data.get('share') is True
    source_pid=text(data.get('photo'),200)
    pid=photo_map.get(source_pid,source_pid) if photo_map is not None else source_pid
    if pid:
        n['photoKind']=text(data.get('photoKind'),12)
        if n['photoKind'] not in KINDS: raise APIError('照片類型不正確。')
        try: photo=Photo.objects.select_for_update().get(id=pid,owner=owner)
        except (Photo.DoesNotExist,ValidationError):
            if not imported: raise APIError('照片不存在或不屬於此帳號。')
            photo=find_source(Photo,owner,source_pid)
            if photo is None:
                photo=Photo.objects.create(owner=owner,source_id=source_pid,kind=n['photoKind'],data=b'',width=0,height=0,sha256=hashlib.sha256(b'').hexdigest())
            if photo_map is not None: photo_map[source_pid]=str(photo.id)
        n['photo']=str(photo.id)
    else: n['photo']=''; n['photoKind']=''
    n['savedAt']=data.get('savedAt') if imported else timezone.now().isoformat()
    if imported: timestamp(n['savedAt'])
    return n

def serialize_note(note): return {'id':str(note.id),'createdAt':note.created_at.isoformat(),'versions':[r.data for r in note.revisions.all()],'version':note.version}
def owned(model,owner,id):
    try: return model.objects.get(owner=owner,id=id)
    except (model.DoesNotExist,ValidationError): raise APIError('找不到資料。','not_found',404)
def session_data(request): return {'authenticated':request.user.is_authenticated,'user':{'id':request.user.id,'username':request.user.username} if request.user.is_authenticated else None,'csrfToken':get_token(request)}

@endpoint(['GET'],False)
def health(request):
    with connection.cursor() as cursor: cursor.execute('SELECT 1'); cursor.fetchone()
    return JsonResponse({'ok':True,'database':'ready'})
@endpoint(['GET'],False)
def session(request): return JsonResponse(session_data(request))

def limit_auth(request,username):
    # Database-backed windows work across WSGI workers. Do not trust forwarded IP headers.
    keys=[('ip:'+request.META.get('REMOTE_ADDR','unknown'),200),('username:'+username.casefold(),20)]
    exceeded=False
    with transaction.atomic():
        for raw,maximum in keys:
            key=hashlib.sha256(raw.encode()).hexdigest()
            attempt,_=AuthAttempt.objects.select_for_update().get_or_create(key=key,defaults={'window':timezone.now()})
            if timezone.now()-attempt.window>timedelta(minutes=15): attempt.window=timezone.now();attempt.count=0
            attempt.count+=1;attempt.save()
            if attempt.count>maximum: exceeded=True
    if exceeded: raise APIError('嘗試次數過多，請 15 分鐘後再試。','rate_limited',429)

@endpoint(['POST'],False)
def register(request):
    data=body(request); username=text(data.get('username'),150); password=data.get('password')
    limit_auth(request,username)
    if not username or not re.fullmatch(r'[\w.@+-]+',username): raise APIError('使用者名稱格式不正確。')
    if not isinstance(password,str) or len(password)>128: raise APIError('密碼格式不正確。')
    try: validate_password(password,User(username=username))
    except ValidationError as exc: raise APIError('；'.join(exc.messages))
    if User.objects.filter(username__iexact=username).exists(): raise APIError('此使用者名稱已被使用。','conflict',409)
    user=User.objects.create_user(username=username,password=password)
    login(request,user)
    return JsonResponse(session_data(request),status=201)
@endpoint(['POST'],False)
def sign_in(request):
    data=body(request); username=text(data.get('username'),150);password=data.get('password')
    if not isinstance(password,str) or len(password)>128: raise APIError('密碼格式不正確。')
    limit_auth(request,username)
    user=authenticate(request,username=username,password=password)
    if user is None: raise APIError('使用者名稱或密碼不正確。','credentials',401)
    login(request,user)
    AuthAttempt.objects.filter(key=hashlib.sha256(('username:'+username.casefold()).encode()).hexdigest()).delete()
    return JsonResponse(session_data(request))
@endpoint(['POST'])
def sign_out(request): logout(request);return JsonResponse(session_data(request))

def new_note(owner,data):
    n=normalize_note(data,owner)
    note=ShoppingNote.objects.create(owner=owner,created_at=timezone.now())
    NoteRevision.objects.create(note=note,version=1,data=n)
    response={'record':serialize_note(note)}
    return response

@endpoint(['GET','POST'])
def notes(request):
    if request.method=='POST':
        with transaction.atomic(): result=new_note(request.user,body(request))
        return JsonResponse(result,status=201)
    query=ShoppingNote.objects.filter(owner=request.user,deleted=False).prefetch_related('revisions').order_by('-created_at','id')
    search=request.GET.get('q','').strip(); records=[]
    for note in query:
        n=serialize_note(note); latest=n['versions'][-1]
        if search and search.casefold() not in ' '.join(str(v) for v in latest.values()).casefold(): continue
        if request.GET.get('from') and latest['date']<valid_date(request.GET['from']).isoformat(): continue
        if request.GET.get('to') and latest['date']>valid_date(request.GET['to']).isoformat(): continue
        records.append(n)
    page=max(1,int(request.GET.get('page',1))); size=min(100,max(1,int(request.GET.get('pageSize',100))))
    return JsonResponse({'records':records[(page-1)*size:page*size],'count':len(records),'page':page,'pageSize':size})
@endpoint(['POST'])
def batch(request):
    data=body(request);inputs=data.get('notes',data.get('records'))
    if not isinstance(inputs,list) or not 1<=len(inputs)<=100: raise APIError('一次可新增 1 至 100 筆。')
    with transaction.atomic(): records=[new_note(request.user,d)['record'] for d in inputs]
    return JsonResponse({'records':records},status=201)
@endpoint(['GET','DELETE'])
def note_detail(request,id):
    note=owned(ShoppingNote,request.user,id)
    if note.deleted: raise APIError('找不到資料。','not_found',404)
    if request.method=='DELETE':
        note.deleted=True;note.save(update_fields=['deleted']);return JsonResponse({'deleted':True})
    return JsonResponse({'record':serialize_note(note)})
@endpoint(['POST'])
def revisions(request,id):
    data=body(request)
    with transaction.atomic():
        note=owned(ShoppingNote,request.user,id)
        if note.deleted: raise APIError('找不到資料。','not_found',404)
        expected=data.get('expectedVersion')
        if isinstance(expected,bool) or not isinstance(expected,int): raise APIError('請提供 expectedVersion。')
        merged=dict(note.revisions.order_by('-version').first().data);merged.update(data)
        n=normalize_note(merged,request.user)
        changed=ShoppingNote.objects.filter(id=note.id,version=expected,deleted=False).update(version=F('version')+1)
        if not changed: raise APIError('紀錄已更新，請重新整理後再修改。','conflict',409)
        note.refresh_from_db();NoteRevision.objects.create(note=note,version=note.version,data=n)
        result=serialize_note(note)
    return JsonResponse({'record':result})
@endpoint(['GET'])
def summary(request):
    month=request.GET.get('month',timezone.localdate().strftime('%Y-%m'))
    if not re.fullmatch(r'\d{4}-\d{2}',month): raise APIError('月份格式需為 YYYY-MM。')
    valid_date(month+'-01')
    total=Decimal(0);count=0
    for note in ShoppingNote.objects.filter(owner=request.user,deleted=False).prefetch_related('revisions'):
        n=note.revisions.all().last().data
        if n['date'].startswith(month): total+=Decimal(n['price']);count+=1
    return JsonResponse({'month':month,'total':decimal_string(total),'count':count})

def process_photo(raw):
    if not raw or len(raw)>6*1024*1024: raise APIError('照片需小於 6 MB。','too_large',413)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error',Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as source:
                if source.format not in ('JPEG','PNG','WEBP') or source.width*source.height>20_000_000: raise APIError('支援 JPEG、PNG、WebP，且照片不得超過兩千萬像素。')
                source.load();image=ImageOps.exif_transpose(source).convert('RGB');image.thumbnail((1280,1280))
                output=io.BytesIO();image.save(output,'PNG',compress_level=6)
                encoded=output.getvalue()
                return encoded,image.width,image.height,hashlib.sha256(encoded).hexdigest()
    except (UnidentifiedImageError,OSError,Image.DecompressionBombError,Image.DecompressionBombWarning): raise APIError('照片內容無法讀取，請使用 JPG 或 PNG。')
@endpoint(['POST'])
def upload_photo(request):
    file=request.FILES.get('file')
    if not file: raise APIError('請選擇照片。')
    kind=text(request.POST.get('kind','其他'),12)
    if kind not in KINDS: raise APIError('照片類型不正確。')
    raw,w,h,digest=process_photo(file.read(6*1024*1024+1))
    photo=Photo.objects.create(owner=request.user,kind=kind,data=raw,width=w,height=h,sha256=digest)
    return JsonResponse({'id':str(photo.id),'url':f'/api/v1/photos/{photo.id}/','photoKind':kind},status=201)
@endpoint(['GET','DELETE'])
def photo_detail(request,id):
    photo=owned(Photo,request.user,id)
    if request.method=='DELETE':
        with transaction.atomic():
            photo=Photo.objects.select_for_update().get(id=photo.id,owner=request.user)
            for rev in NoteRevision.objects.filter(note__owner=request.user,note__deleted=False):
                if rev.data.get('photo')==str(photo.id): raise APIError('照片仍由筆記歷史引用。','conflict',409)
            photo.delete()
        return JsonResponse({'deleted':True})
    if not photo.data: raise APIError('此舊照片檔案無法取得。','not_found',404)
    mime='image/png' if bytes(photo.data).startswith(b'\x89PNG') else 'image/jpeg'
    return HttpResponse(bytes(photo.data),content_type=mime,headers={'Content-Disposition':'inline; filename="photo.'+('png' if mime=='image/png' else 'jpg')+'"'})

@endpoint(['GET'],False)
def prices(request):
    path=settings.DATA_DIR/'prices-data.json'
    if not path.is_file(): path=settings.PROJECT_DIR/'prototype-3d'/'prices-data.json'
    if not path.is_file(): raise APIError('尚未建立行情快照。','unavailable',503)
    return JsonResponse(json.loads(path.read_text(encoding='utf-8')),safe=False)

@endpoint(['GET'],False)
def app_file(request,path='mobile-app.html'):
    # Files beneath a fixed public directory only; never use a repository-wide catch-all.
    root=(settings.PROJECT_DIR/'prototype-3d').resolve();target=(root/path).resolve()
    allowed={'.html','.css','.js','.json','.svg','.png','.jpg','.jpeg','.webp','.glb','.gltf','.bin','.webmanifest','.woff','.woff2'}
    if not target.is_relative_to(root) or any(part.startswith('.') for part in Path(path).parts) or target.suffix.lower() not in allowed or not target.is_file(): raise APIError('找不到頁面。','not_found',404)
    content_type=mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
    response=FileResponse(target.open('rb'),content_type=content_type)
    # The map shell embeds its own same-origin views; other sites still cannot frame it.
    response['X-Frame-Options']='SAMEORIGIN'
    return response


def backup_photo(photo):
    result={'id':photo.source_id or str(photo.id),'kind':photo.kind,'createdAt':photo.created_at.isoformat(),'type':'image/png' if bytes(photo.data).startswith(b'\x89PNG') else 'image/jpeg','width':photo.width,'height':photo.height}
    if photo.data: result['data']='data:'+result['type']+';base64,'+base64.b64encode(bytes(photo.data)).decode()
    else: result['missing']=True
    return result

@endpoint(['GET'])
def export_notes(request):
    records=[];photo_ids=set()
    for note in ShoppingNote.objects.filter(owner=request.user,deleted=False).prefetch_related('revisions').order_by('created_at'):
        record=serialize_note(note);record['id']=note.source_id or str(note.id)
        photo_ids.update(v['photo'] for v in record['versions'] if v.get('photo'))
        records.append(record)
    photos=list(Photo.objects.filter(owner=request.user,id__in=photo_ids))
    stable_ids={str(p.id):p.source_id or str(p.id) for p in photos}
    for record in records:
        record['versions']=[dict(v,photo=stable_ids.get(v.get('photo'),v.get('photo',''))) for v in record['versions']]
    return JsonResponse({'schema':1,'records':records,'photos':[backup_photo(p) for p in photos]},headers={'Content-Disposition':'attachment; filename="shopping-backup.json"'})

def find_source(model,user,source_id):
    obj=model.objects.filter(owner=user,source_id=source_id).first()
    if obj: return obj
    try: return model.objects.filter(owner=user,id=source_id).first()
    except (ValidationError,ValueError): return None

def import_data(user,data):
    if data.get('schema')!=1 or not isinstance(data.get('records'),list) or len(data['records'])>10000: raise APIError('不支援的備份格式。')
    photos=data.get('photos',[])
    if not isinstance(photos,list) or len(photos)>5000: raise APIError('照片備份格式不正確。')
    photo_map={};seen=set();photos_added=0
    for p in photos:
        if not isinstance(p,dict): raise APIError('照片備份格式不正確。')
        sid=text(p.get('id'),200)
        if not sid or sid in seen: raise APIError('照片備份識別碼重複或無效。')
        seen.add(sid)
        kind=text(p.get('kind','其他'),12)
        if kind not in KINDS: raise APIError('照片類型不正確。')
        existing=find_source(Photo,user,sid)
        if p.get('missing') is True:
            if existing is None:
                existing=Photo.objects.create(owner=user,source_id=sid,kind=kind,data=b'',width=0,height=0,sha256=hashlib.sha256(b'').hexdigest())
            photo_map[sid]=str(existing.id)
            continue
        encoded=p.get('data')
        if not isinstance(encoded,str) or not re.fullmatch(r'data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+',encoded): raise APIError('照片備份內容不正確。')
        try: raw=base64.b64decode(encoded.split(',',1)[1],validate=True)
        except ValueError: raise APIError('照片備份內容不正確。')
        processed,w,h,digest=process_photo(raw)
        if existing:
            if not existing.data:
                existing.data=processed;existing.width=w;existing.height=h;existing.sha256=digest;existing.kind=kind
                existing.save();photos_added+=1
            elif (existing.sha256 not in (digest,hashlib.sha256(raw).hexdigest()) and process_photo(bytes(existing.data))[3]!=digest) or existing.kind!=kind: raise APIError('同一張照片有不同內容，匯入已停止。','conflict',409)
            photo_map[sid]=str(existing.id)
        else:
            photo=Photo.objects.create(owner=user,source_id=sid,kind=kind,data=processed,width=w,height=h,sha256=digest)
            photo_map[sid]=str(photo.id);photos_added+=1
    result={'added':0,'updated':0,'skipped':0,'photosAdded':photos_added}
    seen=set()
    for record in data['records']:
        if not isinstance(record,dict): raise APIError('筆記備份格式不正確。')
        sid=text(record.get('id'),200)
        if not sid or sid in seen: raise APIError('筆記識別碼重複或無效。')
        seen.add(sid); created=timestamp(record.get('createdAt'));versions=record.get('versions')
        if not isinstance(versions,list) or not 1<=len(versions)<=10000: raise APIError('筆記歷史格式不正確。')
        versions=[normalize_note(v,user,photo_map,True) for v in versions]
        note=find_source(ShoppingNote,user,sid)
        if note:
            if note.deleted: raise APIError('備份包含已刪除的紀錄，請先確認。','conflict',409)
            old=[r.data for r in note.revisions.all()]
            if note.created_at!=created or old[:min(len(old),len(versions))]!=versions[:min(len(old),len(versions))]: raise APIError('同一筆記有不同修改歷史，匯入已停止。','conflict',409)
            if len(versions)>len(old):
                if not ShoppingNote.objects.filter(id=note.id,version=note.version).update(version=len(versions)): raise APIError('筆記已更新，請重試。','conflict',409)
                NoteRevision.objects.bulk_create([NoteRevision(note=note,version=i+1,data=v) for i,v in enumerate(versions) if i>=len(old)])
                result['updated']+=1
            else: result['skipped']+=1
        else:
            note=ShoppingNote.objects.create(owner=user,source_id=sid,created_at=created,version=len(versions))
            NoteRevision.objects.bulk_create([NoteRevision(note=note,version=i+1,data=v) for i,v in enumerate(versions)])
            result['added']+=1
    return result

@endpoint(['POST'])
def import_notes(request):
    data=body(request)
    if 'preview' in data and not isinstance(data['preview'],bool): raise APIError('preview 需為布林值。')
    with transaction.atomic():
        result=import_data(request.user,data)
        if data.get('preview'): transaction.set_rollback(True)
    return JsonResponse(result)


@endpoint(['GET'],False)
def admin_static(request,path):
    root=Path(settings.STATIC_ROOT).resolve()
    target=(root/path).resolve()
    allowed={'.css','.js','.svg','.png','.jpg','.jpeg','.gif','.webp','.woff','.woff2','.ttf','.eot','.ico'}
    if not target.is_relative_to(root) or any(part.startswith('.') for part in Path(path).parts) or target.suffix.lower() not in allowed or not target.is_file():
        raise APIError('找不到資源。','not_found',404)
    response=FileResponse(target.open('rb'),content_type=mimetypes.guess_type(str(target))[0] or 'application/octet-stream')
    response['Cache-Control']='public, max-age=3600'
    return response
