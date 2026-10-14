const SITE_ORIGIN = 'https://taoyuan-gps-walk.ruru0109lee.chatgpt.site';
const UNITS = ['g', 'kg', '台斤', '顆', '包', '盒', '把'];
const PHOTO_KINDS = ['收據', '標價', '其他'];
const PHOTO_ID = /^[A-Za-z0-9-]{8,64}$/;
const EMPTY = { schema: 1, records: [] };
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function json(value, status = 200) { return Response.json(value, { status, headers: PRIVATE_HEADERS }); }
function invalid(message) { throw new InputError(message); }
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const validTime = value => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));

// Same normalization as ShoppingNotes.validate; only approved note fields are persisted.
function validateNote(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Invalid note');
  const note = {};
  for (const key of ['venue','product','brand','origin','spec','promo','freshness','taste','service','notes','repurchase']) note[key] = clean(input[key], key === 'notes' ? 2000 : 200);
  note.date = clean(input.date, 10); note.unit = clean(input.unit, 4);
  note.price = Number(input.price); note.quantity = Number(input.quantity); note.share = input.share === true;
  note.experience = clean(input.experience, 20);
  if (!['', '不好', '普通', '優秀'].includes(note.experience)) invalid('Invalid experience');
  note.photo = clean(input.photo, 64);
  if (note.photo && !PHOTO_ID.test(note.photo)) invalid('Invalid photo reference');
  note.photoKind = note.photo ? clean(input.photoKind, 4) : '';
  if (note.photo && !PHOTO_KINDS.includes(note.photoKind)) invalid('Invalid photo kind');
  if (!note.venue || !note.product) invalid('Venue and product required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(note.date) || !Number.isFinite(Date.parse(note.date)) || new Date(note.date).toISOString().slice(0, 10) !== note.date) invalid('Invalid purchase date');
  if (!Number.isFinite(note.price) || note.price <= 0 || note.price > 1000000) invalid('Invalid price');
  if (input.quantity == null || String(input.quantity).trim() === '') { note.quantity = null; note.unit = ''; }
  else if (!Number.isFinite(note.quantity) || note.quantity <= 0 || note.quantity > 1000000 || !UNITS.includes(note.unit)) invalid('Invalid quantity or unit');
  if (!validTime(input.savedAt)) invalid('Invalid history timestamp');
  return { ...note, savedAt: input.savedAt };
}
export function validateDocument(document) {
  if (!document || document.schema !== 1 || !Array.isArray(document.records) || document.records.length > 10000) invalid('Unsupported notebook format');
  const ids = new Set();
  const records = document.records.map(record => {
    if (!record || typeof record.id !== 'string' || !record.id || record.id.length > 200 || ids.has(record.id) || !validTime(record.createdAt) || !Array.isArray(record.versions) || !record.versions.length || record.versions.length > 10000) invalid('Invalid or duplicate record');
    ids.add(record.id);
    return { id: record.id, createdAt: record.createdAt, versions: record.versions.map(validateNote) };
  });
  return { schema: 1, records };
}
async function boundedBody(request, limit) {
  const length = request.headers.get('Content-Length');
  if (length && Number(length) > limit) throw new InputError('Request too large', 413);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new InputError('Request too large', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
async function currentNotes(db, userId) {
  const row = await db.prepare('SELECT version, document FROM cloud_notes WHERE user_id = ?').bind(userId).first();
  return row ? { version: row.version, document: JSON.parse(row.document) } : { version: 0, document: EMPTY };
}
function photoType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n)) return 'image/png';
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}
export async function handleCloudRequest(request, env, suppliedPath) {
  const userId = request.headers.get('oai-authenticated-user-id');
  if (!userId?.trim()) return json({ error: 'Sign in required' }, 401);
  const expectedUser=request.headers.get('X-Sync-User');
  if(expectedUser!==null&&expectedUser!==userId)return json({error:'Account changed; sign in again'},401);
  const path = suppliedPath === undefined ? new URL(request.url).pathname.replace(/^\/api\/cloud\/?/, '') : Array.isArray(suppliedPath) ? suppliedPath.join('/') : suppliedPath;
  const method = request.method.toUpperCase();
  if (!['GET','HEAD','OPTIONS'].includes(method)) {
    if(expectedUser!==userId)return json({error:'Account confirmation required'},401);
    const origin = request.headers.get('Origin');
    if (request.headers.get('X-Sync-Request') !== '1' || !origin || ![new URL(request.url).origin, SITE_ORIGIN].includes(origin)) return json({ error: 'Invalid request origin' }, 403);
  }
  try {
    if (path === 'session' && method === 'GET') {
      const email = request.headers.get('oai-authenticated-user-email') || '';
      let name = request.headers.get('oai-authenticated-user-full-name') || '';
      if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') { try { name = decodeURIComponent(name); } catch { name = ''; } }
      return json({ user: { id: userId, name: name || email, email } });
    }
    if (path === 'plan') {
      if (!env.DB) return json({ error: 'Shopping list unavailable' }, 503);
      const read = async () => {
        const row = await env.DB.prepare('SELECT version, document FROM cloud_plans WHERE user_id = ?').bind(userId).first();
        return row ? { version: row.version, items: JSON.parse(row.document) } : { version: 0, items: [] };
      };
      if (method === 'GET') return json(await read());
      if (method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
      if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') invalid('JSON required');
      let payload;try { payload=JSON.parse(new TextDecoder().decode(await boundedBody(request,4096))); } catch(error) { if(error instanceof InputError)throw error;invalid('Invalid JSON'); }
      if (!payload || !['add','remove'].includes(payload.action) || typeof payload.product !== 'string' || !payload.product.trim() || payload.product.length > 200) invalid('Invalid shopping item');
      const product=payload.product.trim();
      for(let attempt=0;attempt<8;attempt++) {
        const current=await read();
        if(payload.action==='add' && current.items.includes(product) || payload.action==='remove' && !current.items.includes(product)) return json(current);
        if(payload.action==='add' && current.items.length>=100) invalid('Shopping list allows at most 100 items');
        const items=payload.action==='add'?[...current.items,product]:current.items.filter(x=>x!==product);
        const result=current.version===0
          ?await env.DB.prepare('INSERT INTO cloud_plans (user_id,version,document) VALUES (?,1,?) ON CONFLICT(user_id) DO NOTHING').bind(userId,JSON.stringify(items)).run()
          :await env.DB.prepare('UPDATE cloud_plans SET document = ?, version = version + 1 WHERE user_id = ? AND version = ?').bind(JSON.stringify(items),userId,current.version).run();
        if(result.meta?.changes===1)return json({version:current.version+1,items});
      }
      return json({error:'Shopping list busy; retry the same operation'},409);
    }
    if (path === 'notes') {
      if (!env.DB) return json({ error: 'Notebook service unavailable' }, 503);
      if (method === 'GET') return json(await currentNotes(env.DB, userId));
      if (method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
      if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') invalid('JSON required');
      const bytes = await boundedBody(request, 5000000);
      let payload; try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch { invalid('Invalid JSON'); }
      if (!payload || !Number.isSafeInteger(payload.expectedVersion) || payload.expectedVersion < 0 || payload.expectedVersion >= Number.MAX_SAFE_INTEGER) invalid('Invalid expected version');
      const document = validateDocument(payload.document), serialized = JSON.stringify(document), version = payload.expectedVersion;
      if (new TextEncoder().encode(serialized).byteLength > 5000000) throw new InputError('Notebook too large', 413);
      // Each statement is an atomic CAS. A separate existence check would permit lost updates.
      const result = version === 0
        ? await env.DB.prepare('INSERT INTO cloud_notes (user_id, version, document) VALUES (?, 1, ?) ON CONFLICT(user_id) DO NOTHING').bind(userId, serialized).run()
        : await env.DB.prepare('UPDATE cloud_notes SET document = ?, version = version + 1 WHERE user_id = ? AND version = ?').bind(serialized, userId, version).run();
      if (result.meta?.changes !== 1) return json(await currentNotes(env.DB, userId), 409);
      return json({ version: version + 1, document });
    }
    if (path.startsWith('photos/')) {
      const id = path.slice(7);
      if (!PHOTO_ID.test(id)) invalid('Invalid photo ID');
      if (!env.BUCKET) return json({ error: 'Photo service unavailable' }, 503);
      const key = `cloud-photos/${encodeURIComponent(userId)}/${id}`;
      if (method === 'GET') {
        const object = await env.BUCKET.get(key);
        if (!object) return json({ error: 'Photo not found' }, 404);
        return new Response(object.body, { headers: { ...PRIVATE_HEADERS, 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream','X-Photo-Kind':encodeURIComponent(object.customMetadata?.kind||'其他'),'X-Photo-Created-At':object.customMetadata?.createdAt||'','X-Photo-Width':object.customMetadata?.width||'0','X-Photo-Height':object.customMetadata?.height||'0' } });
      }
      if (method === 'DELETE') { await env.BUCKET.delete(key); return new Response(null, { status: 204, headers: PRIVATE_HEADERS }); }
      if (method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
      const bytes = await boundedBody(request, 6000000), detected = photoType(bytes);
      const contentType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
      if (!detected || detected !== contentType) invalid('Photo must be JPEG, PNG or WebP matching its MIME type');
      let kind=request.headers.get('X-Photo-Kind')||'';try{kind=decodeURIComponent(kind)}catch{kind=''}
      const createdAt=request.headers.get('X-Photo-Created-At');
      const dimension=header=>String(Math.max(0,Math.min(10000,Number(request.headers.get(header))||0)));
      const customMetadata = {kind:PHOTO_KINDS.includes(kind)?kind:'其他',createdAt:validTime(createdAt)?createdAt:new Date().toISOString(),width:dimension('X-Photo-Width'),height:dimension('X-Photo-Height')};
      await env.BUCKET.put(key, bytes, { httpMetadata: { contentType }, customMetadata });
      return json({ id });
    }
    return json({ error: 'Not found' }, 404);
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, error.status);
    // Storage failures never look like an empty notebook or a successful save.
    return json({ error: 'Cloud storage unavailable; your changes were not confirmed' }, 503);
  }
}
