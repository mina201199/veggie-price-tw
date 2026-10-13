import json, io
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

class APITests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('alice',password='Str0ng-pass-2026')
        self.other=User.objects.create_user('bob',password='Str0ng-pass-2026')
        self.client.force_login(self.user)
    def post(self,path,data):
        return self.client.post('/api/v1/'+path,data=json.dumps(data),content_type='application/json')
    def note(self,**extra):
        return dict(venue='市場',product='番茄',date='2026-10-08',price='25.50',quantity='2',unit='顆',**extra)
    def test_auth_session(self):
        r=self.client.get('/api/v1/auth/session/')
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['user']['username'],'alice')
        self.assertTrue(r.json()['csrfToken'])
    def test_unauthenticated_and_csrf(self):
        c=Client(enforce_csrf_checks=True)
        self.assertEqual(c.post('/api/v1/notes/',{},content_type='application/json').status_code,403)
        c.force_login(self.user)
        self.assertEqual(c.post('/api/v1/notes/',{},content_type='application/json').status_code,403)
    def test_note_history_conflict_and_isolation(self):
        r=self.post('notes/',self.note()); self.assertEqual(r.status_code,201)
        rid=r.json()['record']['id']
        self.assertEqual(self.post(f'notes/{rid}/revisions/',dict(self.note(),expectedVersion=1,price='30')).status_code,200)
        self.assertEqual(self.post(f'notes/{rid}/revisions/',dict(self.note(),expectedVersion=1)).status_code,409)
        self.assertEqual(len(self.client.get(f'/api/v1/notes/{rid}/').json()['record']['versions']),2)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/api/v1/notes/{rid}/').status_code,404)
        self.assertEqual(self.client.get('/api/v1/notes/').json()['count'],0)
    def test_summary_uses_latest_revision(self):
        r=self.post('notes/',self.note())
        rid=r.json()['record']['id']
        self.post(f'notes/{rid}/revisions/',dict(self.note(),expectedVersion=1,price='30'))
        self.assertEqual(self.client.get('/api/v1/summary/?month=2026-10').json()['total'],'30')
    def test_import_idempotent_conflict_atomic(self):
        doc={'schema':1,'records':[{'id':'legacy-id','createdAt':'2026-10-08T10:00:00Z','versions':[dict(self.note(),savedAt='2026-10-08T10:00:00Z')]}]}
        self.assertEqual(self.post('notes/import/',dict(doc,preview=True)).json()['added'],1)
        self.assertEqual(self.client.get('/api/v1/notes/').json()['count'],0)
        self.assertEqual(self.post('notes/import/',doc).json()['added'],1)
        self.assertEqual(self.post('notes/import/',doc).json()['skipped'],1)
        doc['records'][0]['versions'][0]['price']='999'
        self.assertEqual(self.post('notes/import/',doc).status_code,409)
        self.assertEqual(self.client.get('/api/v1/notes/export/').json()['records'][0]['versions'][0]['price'],'25.5')
    def test_private_photo_content_and_owner(self):
        buf=io.BytesIO(); Image.new('RGB',(5,5),'red').save(buf,'PNG')
        r=self.client.post('/api/v1/photos/',{'file':SimpleUploadedFile('test.png',buf.getvalue(),content_type='image/png')})
        self.assertEqual(r.status_code,201)
        pid=r.json()['id']
        self.assertEqual(self.client.get(r.json()['url']).status_code,200)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/api/v1/photos/{pid}/').status_code,404)
        self.assertEqual(self.post('notes/',self.note(photo=pid,photoKind='其他')).status_code,400)
        self.assertEqual(self.client.post('/api/v1/photos/',{'file':SimpleUploadedFile('bad.jpg',b'bad')}).status_code,400)
    def test_batch_atomic(self):
        self.assertEqual(self.post('notes/batch/',{'notes':[self.note(),dict(self.note(),price='bad')]}).status_code,400)
        self.assertEqual(self.client.get('/api/v1/notes/').json()['count'],0)


    def test_real_csrf_registration_login_logout_and_hash(self):
        c=Client(enforce_csrf_checks=True)
        session=c.get('/api/v1/auth/session/').json()
        r=c.post('/api/v1/auth/register/',json.dumps({'username':'charlie','password':'Good-Password-2026'}),content_type='application/json',HTTP_X_CSRFTOKEN=session['csrfToken'])
        self.assertEqual(r.status_code,201)
        self.assertNotEqual(User.objects.get(username='charlie').password,'Good-Password-2026')
        token=r.json()['csrfToken']
        self.assertEqual(c.post('/api/v1/auth/logout/',{},content_type='application/json',HTTP_X_CSRFTOKEN=token).status_code,200)
        self.assertFalse(c.get('/api/v1/auth/session/').json()['authenticated'])
        token=c.get('/api/v1/auth/session/').json()['csrfToken']
        r=c.post('/api/v1/auth/login/',json.dumps({'username':'charlie','password':'Good-Password-2026'}),content_type='application/json',HTTP_X_CSRFTOKEN=token)
        self.assertEqual(r.status_code,200)
        self.assertTrue(r.json()['authenticated'])
    def test_login_rate_limit(self):
        c=Client()
        for _ in range(20):
            self.assertEqual(c.post('/api/v1/auth/login/',json.dumps({'username':'missing','password':'wrong'}),content_type='application/json').status_code,401)
        self.assertEqual(c.post('/api/v1/auth/login/',json.dumps({'username':'missing','password':'wrong'}),content_type='application/json').status_code,429)
    def test_malformed_batch_and_import_return_json(self):
        r=self.post('notes/batch/',{'notes':[None]})
        self.assertEqual(r.status_code,400)
        self.assertIn('error',r.json())
        doc={'schema':1,'records':[{'id':'bad','createdAt':'2026-10-08T10:00:00Z','versions':[None]}]}
        self.assertEqual(self.post('notes/import/',doc).status_code,400)
    def test_photo_backup_roundtrip_and_reference_delete(self):
        buf=io.BytesIO();Image.new('RGB',(5,5),'blue').save(buf,'PNG')
        upload=self.client.post('/api/v1/photos/',{'file':SimpleUploadedFile('test.png',buf.getvalue()),'kind':'收據'}).json()
        self.post('notes/',self.note(photo=upload['id'],photoKind='收據'))
        self.assertEqual(self.client.delete(upload['url']).status_code,409)
        doc=self.client.get('/api/v1/notes/export/').json()
        self.client.force_login(self.other)
        self.assertEqual(self.post('notes/import/',dict(doc,preview=True)).json()['photosAdded'],1)
        self.assertEqual(self.client.get('/api/v1/notes/').json()['count'],0)
        self.assertEqual(self.post('notes/import/',doc).json()['added'],1)
        self.assertEqual(self.post('notes/import/',doc).json()['skipped'],1)
        restored=self.client.get('/api/v1/notes/').json()['records'][0]['versions'][0]
        self.assertNotEqual(restored['photo'],upload['id'])
        self.assertEqual(self.client.get(f"/api/v1/photos/{restored['photo']}/").status_code,200)
    def test_import_prefix_extends_history_and_conflict_rolls_back(self):
        from .models import ShoppingNote,Photo
        doc={'schema':1,'records':[{'id':'history','createdAt':'2026-10-08T10:00:00Z','versions':[dict(self.note(),savedAt='2026-10-08T10:00:00Z')]}]}
        self.post('notes/import/',doc)
        doc['records'][0]['versions'].append(dict(self.note(),price='50',savedAt='2026-10-08T11:00:00Z'))
        self.assertEqual(self.post('notes/import/',doc).json()['updated'],1)
        self.assertEqual(self.client.get('/api/v1/notes/').json()['records'][0]['version'],2)
        doc['records'].insert(0,{'id':'new-first','createdAt':'2026-10-08T10:00:00Z','versions':[dict(self.note(),savedAt='2026-10-08T10:00:00Z')]})
        doc['records'][1]['versions'][0]['price']='75'
        self.assertEqual(self.post('notes/import/',doc).status_code,409)
        self.assertEqual(ShoppingNote.objects.filter(owner=self.user).count(),1)
    def test_unknown_quantity_and_deleted_note_summary(self):
        r=self.post('notes/',dict(self.note(),quantity=None,unit='kg'))
        self.assertIsNone(r.json()['record']['versions'][0]['quantity'])
        self.assertEqual(r.json()['record']['versions'][0]['unit'],'')
        rid=r.json()['record']['id']
        self.assertEqual(self.client.delete(f'/api/v1/notes/{rid}/').status_code,200)
        self.assertEqual(self.client.get('/api/v1/summary/?month=2026-10').json()['count'],0)
        self.assertEqual(self.post(f'notes/{rid}/revisions/',dict(self.note(),expectedVersion=1)).status_code,404)
    def test_static_traversal_and_private_cache(self):
        self.assertEqual(self.client.get('/app/../backend/config/settings.py').status_code,404)
        self.assertEqual(self.client.get('/app/.git/config').status_code,404)
        self.assertIn('no-store',self.client.get('/api/v1/notes/')['Cache-Control'])
        self.assertEqual(self.client.get('/api/v1/health/').json()['database'],'ready')

class PriceUpdateTests(TestCase):
    def setUp(self):
        import tempfile
        from pathlib import Path
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        (self.root/'tools').mkdir();(self.root/'data').mkdir();(self.root/'prototype-3d').mkdir()
        (self.root/'prototype-3d'/'prices-data.json').write_text('{"latest":"2026-10-07","items":[]}',encoding='utf-8')
    def test_failed_build_preserves_snapshot(self):
        from django.core.management import call_command, CommandError
        from .models import UpdateRun
        (self.root/'tools'/'build_prices.py').write_text('raise SystemExit(1)',encoding='utf-8')
        with self.settings(PROJECT_DIR=self.root,DATA_DIR=self.root/'runtime'):
            with self.assertRaises(CommandError): call_command('update_prices',skip_fetch=True)
        self.assertEqual(json.loads((self.root/'prototype-3d'/'prices-data.json').read_text())['latest'],'2026-10-07')
        self.assertFalse(UpdateRun.objects.get().success)
    def test_success_records_snapshot_date(self):
        from django.core.management import call_command
        from .models import UpdateRun
        (self.root/'tools'/'build_prices.py').write_text("from pathlib import Path\nPath('prototype-3d/prices-data.json').write_text('{\"latest\":\"2026-10-08\",\"items\":[]}')",encoding='utf-8')
        with self.settings(PROJECT_DIR=self.root,DATA_DIR=self.root/'runtime'):
            call_command('update_prices',skip_fetch=True)
        self.assertTrue(UpdateRun.objects.get().success)
        self.assertEqual(UpdateRun.objects.get().snapshot_date,'2026-10-08')
        self.assertEqual(json.loads((self.root/'runtime'/'prices-data.json').read_text())['latest'],'2026-10-08')

class BackupRoundtripTests(TestCase):
    setUp=APITests.setUp
    post=APITests.post
    note=APITests.note
    def test_cross_account_photo_backup_returns_to_original_account(self):
        buf=io.BytesIO();Image.new('RGB',(5,5),'green').save(buf,'PNG')
        upload=self.client.post('/api/v1/photos/',{'file':SimpleUploadedFile('test.png',buf.getvalue())}).json()
        self.post('notes/',self.note(photo=upload['id'],photoKind='其他'))
        original=self.client.get('/api/v1/notes/export/').json()
        self.client.force_login(self.other)
        self.assertEqual(self.post('notes/import/',original).status_code,200)
        returned=self.client.get('/api/v1/notes/export/').json()
        self.client.force_login(self.user)
        response=self.post('notes/import/',returned)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['skipped'],1)
    def test_missing_legacy_photo_preserves_note_and_is_idempotent(self):
        document={'schema':1,'records':[{'id':'missing-photo-note','createdAt':'2026-10-08T10:00:00Z','versions':[dict(self.note(photo='legacy-photo-missing',photoKind='收據'),savedAt='2026-10-08T10:00:00Z')]}]}
        self.assertEqual(self.post('notes/import/',document).status_code,200)
        self.assertEqual(self.post('notes/import/',document).json()['skipped'],1)
        record=self.client.get('/api/v1/notes/').json()['records'][0]
        photo=record['versions'][0]['photo']
        self.assertTrue(photo)
        self.assertEqual(self.client.get(f'/api/v1/photos/{photo}/').status_code,404)
        backup=self.client.get('/api/v1/notes/export/').json()
        self.assertTrue(backup['photos'][0]['missing'])
        self.assertEqual(self.post('notes/import/',backup).json()['skipped'],1)
    def test_successful_logins_do_not_exhaust_account_failure_bucket(self):
        for _ in range(22):
            self.assertEqual(self.post('auth/login/',{'username':'alice','password':'Str0ng-pass-2026'}).status_code,200)
    def test_placeholder_can_later_receive_missing_photo_data(self):
        from .models import Photo
        document={'schema':1,'records':[{'id':'restore-later','createdAt':'2026-10-08T10:00:00Z','versions':[dict(self.note(photo='restore-photo',photoKind='收據'),savedAt='2026-10-08T10:00:00Z')]}]}
        self.post('notes/import/',document)
        buf=io.BytesIO();Image.new('RGB',(5,5),'yellow').save(buf,'PNG')
        import base64
        document['photos']=[{'id':'restore-photo','kind':'收據','data':'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()}]
        response=self.post('notes/import/',document)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['skipped'],1)
        photo=Photo.objects.get(owner=self.user,source_id='restore-photo')
        self.assertTrue(photo.data)
        self.assertEqual(self.client.get(f'/api/v1/photos/{photo.id}/').status_code,200)
    def test_nonuniform_photo_backup_roundtrip_does_not_recompress_into_conflict(self):
        buf=io.BytesIO();Image.effect_noise((64,64),100).convert('RGB').save(buf,'PNG')
        photo=self.client.post('/api/v1/photos/',{'file':SimpleUploadedFile('noise.png',buf.getvalue())}).json()['id']
        self.post('notes/',self.note(photo=photo,photoKind='其他'))
        original=self.client.get('/api/v1/notes/export/').json()
        self.client.force_login(self.other)
        self.assertEqual(self.post('notes/import/',original).status_code,200)
        returned=self.client.get('/api/v1/notes/export/').json()
        self.client.force_login(self.user)
        self.assertEqual(self.post('notes/import/',returned).status_code,200)

class AdminStaticTests(TestCase):
    def test_public_static_css_and_traversal_boundary(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary); public=root/'static';public.mkdir()
            (public/'admin.css').write_text('body { color: blue; }',encoding='utf-8')
            (root/'private.css').write_text('SECRET',encoding='utf-8')
            (public/'hidden.py').write_text('SECRET',encoding='utf-8')
            with self.settings(STATIC_ROOT=public):
                response=self.client.get('/static/admin.css')
                self.assertEqual(response.status_code,200)
                self.assertEqual(b''.join(response.streaming_content),b'body { color: blue; }')
                self.assertEqual(self.client.get('/static/../private.css').status_code,404)
                self.assertEqual(self.client.get('/static/hidden.py').status_code,404)
                self.assertEqual(self.client.get('/static/.env').status_code,404)
