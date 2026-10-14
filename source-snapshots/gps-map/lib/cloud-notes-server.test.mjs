import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleCloudRequest } from './cloud-notes-server.mjs';

// Run the actual D1 SQL on SQLite, including its atomic compare-and-swap semantics.
class D1 {
  database = new DatabaseSync(':memory:');
  constructor() { this.database.exec('CREATE TABLE cloud_notes (user_id TEXT PRIMARY KEY NOT NULL, version INTEGER NOT NULL, document TEXT NOT NULL)'); }
  prepare(sql) {
    return { bind: (...args) => ({
      first: async () => this.database.prepare(sql).get(...args) || null,
      run: async () => ({ success: true, meta: { changes: this.database.prepare(sql).run(...args).changes } }),
    }) };
  }
}
class Bucket {
  objects = new Map();
  async put(key, bytes, options) { this.objects.set(key, { body: bytes, httpMetadata: options.httpMetadata, customMetadata: options.customMetadata }); }
  async get(key) { return this.objects.get(key) || null; }
  async delete(key) { this.objects.delete(key); }
}
const origin = 'https://taoyuan-gps-walk.ruru0109lee.chatgpt.site';
const empty = { schema: 1, records: [] };
function doc(product = '高麗菜') {
  return { schema: 1, records: [{ id: 'note-1', createdAt: '2026-10-13T01:00:00Z', versions: [{ venue: '市場', product, date: '2026-10-13', price: 20, quantity: 1, unit: 'kg', savedAt: '2026-10-13T01:00:00Z' }] }] };
}
function req(path, { user = 'alice', method = 'GET', body, headers = {} } = {}) {
  return new Request(origin + '/api/cloud/' + path, { method, headers: { ...(user ? { 'oai-authenticated-user-id': user } : {}), ...(method !== 'GET' ? { Origin: origin, 'X-Sync-Request': '1', 'X-Sync-User':user||'', 'Content-Type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body) });
}
const env = () => ({ DB: new D1(), BUCKET: new Bucket() });
const put = (document, expectedVersion = 0, user = 'alice') => req('notes', { method: 'PUT', user, body: { expectedVersion, document } });

test('anonymous requests cannot read session, notes or private photos', async () => {
  for (const path of ['session', 'notes', 'photos/photo-123']) assert.equal((await handleCloudRequest(req(path, { user: null }), env())).status, 401);
});
test('identity changed mid-request cannot write another account document or photo',async()=>{const e=env();for(const path of ['notes','photos/photo-123']){const r=await handleCloudRequest(req(path,{user:'bob',method:'PUT',body:path==='notes'?{expectedVersion:0,document:doc()}:new Uint8Array([255,216,255]),headers:{'X-Sync-User':'alice','Content-Type':path==='notes'?'application/json':'image/jpeg'}}),e);assert.equal(r.status,401)}assert.equal(e.BUCKET.objects.size,0);assert.equal((await (await handleCloudRequest(req('notes',{user:'bob'}),e)).json()).version,0)});
test('session is sourced only from dispatch identity', async () => {
  const response = await handleCloudRequest(req('session', { headers: { 'oai-authenticated-user-email': 'a@example.com', 'oai-authenticated-user-full-name': '%E7%8E%8B', 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' } }), env());
  assert.deepEqual(await response.json(), { user: { id: 'alice', name: '王', email: 'a@example.com' } });
});
test('documents persist per user and concurrent inserts return one conflict', async () => {
  const e = env();
  assert.deepEqual(await (await handleCloudRequest(req('notes'), e)).json(), { version: 0, document: empty });
  const outcomes = await Promise.all([handleCloudRequest(put(doc()), e), handleCloudRequest(put(doc('白菜')), e)]);
  assert.deepEqual(outcomes.map(r => r.status).sort(), [200, 409]);
  const current = await (await handleCloudRequest(req('notes'), e)).json();
  assert.equal(current.version, 1);
  const conflict = await outcomes.find(r => r.status === 409).json();
  assert.deepEqual(conflict, current);
  assert.deepEqual(await (await handleCloudRequest(req('notes', { user: 'bob' }), e)).json(), { version: 0, document: empty });
  assert.equal((await handleCloudRequest(put(doc('更新'), 1), e)).status, 200);
  assert.equal((await handleCloudRequest(put(doc('過期'), 1), e)).status, 409);
  assert.equal((await (await handleCloudRequest(req('notes'), e)).json()).document.records[0].versions[0].product, '更新');
});
test('simultaneous versioned updates cannot overwrite each other', async () => {
  const e = env();
  await handleCloudRequest(put(doc()), e);
  const results = await Promise.all([handleCloudRequest(put(doc('蘿蔔'), 1), e), handleCloudRequest(put(doc('番茄'), 1), e)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const current = await (await handleCloudRequest(req('notes'), e)).json();
  assert.equal(current.version, 2);
  assert.deepEqual(await results.find(r => r.status === 409).json(), current);
});
test('writes reject foreign origins and missing sync intent', async () => {
  for (const headers of [{ Origin: 'https://evil.test' }, { Origin: '' }, { 'X-Sync-Request': '' }]) assert.equal((await handleCloudRequest(req('notes', { method: 'PUT', body: { expectedVersion: 0, document: empty }, headers }), env())).status, 403);
});
test('malformed complete histories and versions are rejected without replacing notes', async () => {
  const e = env();
  for (const document of [{ schema: 2, records: [] }, { schema: 1, records: [{ id: 'x', versions: [] }] }, doc(), doc(), doc()]) {
    if (document.records?.[0]?.versions?.[0]) { const note = document.records[0].versions[0]; if (!e.badCount) note.date = '2026-02-30'; else if (e.badCount === 1) note.price = 0; else note.savedAt = 'nonsense'; e.badCount = (e.badCount || 0) + 1; }
    assert.equal((await handleCloudRequest(put(document), e)).status, 400);
  }
  assert.equal((await handleCloudRequest(put(empty, -1), e)).status, 400);
  assert.equal((await handleCloudRequest(req('notes', { method: 'PUT', body: '{broken' }), e)).status, 400);
  assert.equal((await handleCloudRequest(req('notes', { method: 'PUT', body: ' '.repeat(5000001) }), e)).status, 413);
});
test('photos are private, ID safe, magic checked and deletable only by owner', async () => {
  const e = env(), png = new Uint8Array([137,80,78,71,13,10,26,10,1]);
  const photoPut = (body, headers = {}) => req('photos/photo-123', { method: 'PUT', body, headers: { 'Content-Type': 'image/png', ...headers } });
  assert.equal((await handleCloudRequest(photoPut(png), e)).status, 200);
  assert.equal((await handleCloudRequest(req('photos/photo-123', { user: 'bob' }), e)).status, 404);
  const download = await handleCloudRequest(req('photos/photo-123'), e);
  assert.equal(download.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(new Uint8Array(await download.arrayBuffer()), png);
  await handleCloudRequest(req('photos/photo-123', { method: 'DELETE', user: 'bob' }), e);
  assert.equal((await handleCloudRequest(req('photos/photo-123'), e)).status, 200);
  assert.equal((await handleCloudRequest(photoPut(new Uint8Array([1,2,3])), e)).status, 400);
  assert.equal((await handleCloudRequest(photoPut(png, { 'Content-Type': 'image/jpeg' }), e)).status, 400);
  assert.equal((await handleCloudRequest(photoPut(new Uint8Array(6000001)), e)).status, 413);
  assert.equal((await handleCloudRequest(req('photos/unsafe_id'), e)).status, 400);
  assert.equal((await handleCloudRequest(req('photos/photo-123', { method: 'DELETE' }), e)).status, 204);
  assert.equal((await handleCloudRequest(req('photos/photo-123'), e)).status, 404);
});
test('all history versions are checked and unknown GPS data is never persisted', async () => {
  const e = env(), document = doc();
  document.gps = { latitude: 25, longitude: 121 };
  document.records[0].versions[0].gps = document.gps;
  assert.equal((await handleCloudRequest(put(document), e)).status, 200);
  const saved = await (await handleCloudRequest(req('notes'), e)).json();
  assert.equal('gps' in saved.document, false);
  assert.equal('gps' in saved.document.records[0].versions[0], false);
  document.records[0].versions.unshift({ ...document.records[0].versions[0], price: -1 });
  assert.equal((await handleCloudRequest(put(document, 1), e)).status, 400);
  assert.deepEqual(await (await handleCloudRequest(req('notes'), e)).json(), saved);
  const duplicate = doc(); duplicate.records.push(structuredClone(duplicate.records[0]));
  assert.equal((await handleCloudRequest(put(duplicate, 1), e)).status, 400);
});
test('JPEG and WebP uploads retain MIME and user prefixes cannot collide', async () => {
  const e = env();
  for (const [type, bytes] of [['image/jpeg', new Uint8Array([255,216,255,1])], ['image/webp', new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80])]]) {
    assert.equal((await handleCloudRequest(req('photos/photo-123', { method: 'PUT', user: 'a/b', body: bytes, headers: { 'Content-Type': type } }), e)).status, 200);
    assert.equal((await handleCloudRequest(req('photos/photo-123', { user: 'a%2Fb' }), e)).status, 404);
    assert.equal((await handleCloudRequest(req('photos/photo-123', { user: 'a/b' }), e)).headers.get('Content-Type'), type);
  }
});
test('storage outages do not report a successful save or empty notes', async () => {
  const e = { ...env(), DB: { prepare() { throw Error('offline'); } } };
  assert.equal((await handleCloudRequest(req('notes'), e)).status, 503);
  assert.equal((await handleCloudRequest(put(empty), e)).status, 503);
  assert.equal((await handleCloudRequest(req('notes'), {})).status, 503);
});
