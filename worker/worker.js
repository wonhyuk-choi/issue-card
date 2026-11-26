// 이슈 카드 알림 저장소 (Cloudflare Worker + KV, 무료)
// 앱: 등록(/register, 초대 코드만으로 또는 알림과 함께), 상태 확인(/status), 일시중지·재개(/pause), 맞춤 설정 저장(/profile)
// 관리(GitHub Actions 전용, ADMIN_KEY 필요): /admin/list, /admin/import
const MAX_SUBS = 50;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin') || '';
    const allow = (env.ALLOW_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allow.includes(origin) ? origin : (allow[0] || '*'),
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'content-type,authorization',
      'Vary': 'Origin',
    };
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const admin = !!env.ADMIN_KEY && req.headers.get('authorization') === 'Bearer ' + env.ADMIN_KEY;

    try {
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      const ep = body.endpoint || (body.sub && body.sub.endpoint) || '';

      // 기기 찾기: 앱이 만든 기기 번호(device)가 우선, 예전 기기는 알림 주소(endpoint)로 찾고 기기 번호 쪽으로 옮김
      const dev = typeof body.device === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(body.device) ? body.device : '';
      const locate = async () => {
        const dk = dev ? await keyOf('device:' + dev) : '';
        if (dk) { const r = await env.KV.get(dk, 'json'); if (r) return { k: dk, rec: r }; }
        if (ep) {
          const ek = await keyOf(ep); const r = await env.KV.get(ek, 'json');
          if (r && dk) { await env.KV.put(dk, JSON.stringify(r)); await env.KV.delete(ek); return { k: dk, rec: r }; }
          if (r) return { k: ek, rec: r };
          return { k: dk || ek, rec: null };
        }
        return { k: dk, rec: null };
      };
      const view = (rec) => ({ registered: true, id: rec.id, paused: !!rec.paused, push: !!rec.sub && !!ep && rec.sub.endpoint === ep, profile: rec.profile || null });

      if (url.pathname === '/register' && req.method === 'POST') {
        // 초대 코드만으로 등록(알림 없이)도 되고, 알림 주소(sub)가 오면 알림도 켬
        const sub = body.sub ? cleanSub(body.sub) : null;
        if (body.sub && !sub) return json({ error: 'bad subscription' }, 400);
        if (!dev && !sub) return json({ error: 'bad request' }, 400);
        const found = await locate();
        let rec = found.rec;
        const k = found.k || await keyOf(sub.endpoint);
        if (!rec) {
          // 새 기기는 초대 코드가 맞아야 등록됨 (이미 등록된 기기는 그대로)
          if (env.INVITE_CODE && String(body.invite || '').trim() !== env.INVITE_CODE) return json({ error: 'invite' }, 403);
          const n = (await env.KV.list({ prefix: 'sub:' })).keys.length;
          if (n >= MAX_SUBS) return json({ error: 'full' }, 429);
          rec = { id: await nextId(env), createdAt: now(), paused: false };
        }
        if (sub) { rec.sub = sub; rec.paused = false; }
        if (body.profile) rec.profile = cleanProfile(body.profile);
        rec.updatedAt = now();
        await env.KV.put(k, JSON.stringify(rec));
        return json({ id: rec.id, paused: !!rec.paused, push: !!sub || (!!rec.sub && !!ep && rec.sub.endpoint === ep) });
      }
      if (url.pathname === '/status' && req.method === 'POST') {
        const { rec } = await locate();
        if (!rec) return json({ registered: false });
        return json(view(rec));
      }
      if (url.pathname === '/pause' && req.method === 'POST') {
        const { k, rec } = await locate();
        if (!rec) return json({ error: 'not registered' }, 404);
        rec.paused = !!body.paused; rec.updatedAt = now();
        await env.KV.put(k, JSON.stringify(rec));
        return json({ id: rec.id, paused: rec.paused });
      }
      if (url.pathname === '/profile' && req.method === 'POST') {
        const { k, rec } = await locate();
        if (!rec) return json({ error: 'not registered' }, 404);
        rec.profile = cleanProfile(body.profile || {}); rec.updatedAt = now();
        await env.KV.put(k, JSON.stringify(rec));
        return json({ id: rec.id });
      }
      if (url.pathname === '/admin/list' && admin) {
        const out = [];
        let cursor;
        do {
          const page = await env.KV.list({ prefix: 'sub:', cursor });
          for (const x of page.keys) { const r = await env.KV.get(x.name, 'json'); if (r) out.push(r); }
          cursor = page.list_complete ? null : page.cursor;
        } while (cursor);
        return json(out);
      }
      if (url.pathname === '/admin/import' && admin && req.method === 'POST') {
        let added = 0;
        // 이미 있는 알림 주소는 다시 넣지 않음 (기기 번호 쪽으로 옮겨진 기록 포함)
        const have = new Set();
        for (const x of (await env.KV.list({ prefix: 'sub:' })).keys) { const r = await env.KV.get(x.name, 'json'); if (r && r.sub) have.add(r.sub.endpoint); }
        for (const x of body.items || []) {
          const sub = cleanSub(x.sub || x);
          if (!sub || have.has(sub.endpoint)) continue;
          const k = await keyOf(sub.endpoint);
          if (await env.KV.get(k)) continue;
          const id = x.id || x.profile || await nextId(env);
          await env.KV.put(k, JSON.stringify({ id, sub, profile: x.profileData ? cleanProfile(x.profileData) : null, paused: false, createdAt: now(), updatedAt: now() }));
          added++;
        }
        const ids = (body.items || []).map((x) => x.id || x.profile).filter(Boolean).map((s) => parseInt(String(s).slice(1), 10)).filter((n) => n > 0);
        const cur = parseInt((await env.KV.get('meta:next')) || '1', 10);
        const need = ids.length ? Math.max(...ids) + 1 : cur;
        if (need > cur) await env.KV.put('meta:next', String(need));
        return json({ added });
      }
      if (url.pathname === '/') return json({ ok: true, service: 'issue-card' });
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'server error' }, 500);
    }
  },
};

function now() { return new Date().toISOString(); }
async function keyOf(endpoint) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return 'sub:' + [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function nextId(env) {
  const n = parseInt((await env.KV.get('meta:next')) || '1', 10);
  await env.KV.put('meta:next', String(n + 1));
  return 'p' + n;
}
function cleanSub(s) {
  if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 1000) return null;
  const k = s.keys || {};
  if (typeof k.p256dh !== 'string' || typeof k.auth !== 'string' || k.p256dh.length > 200 || k.auth.length > 100) return null;
  return { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: k.p256dh, auth: k.auth } };
}
function cleanDays(d) {
  if (d === 'daily') return [0, 1, 2, 3, 4, 5, 6];
  if (!Array.isArray(d)) return [1, 2, 3, 4, 5];
  const out = [...new Set(d.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
  return out.length ? out : [1, 2, 3, 4, 5];
}
function cleanProfile(p) {
  const str = (v, n) => String(v || '').slice(0, n);
  const s = p.schedule || {};
  const time = /^\d{2}:\d{2}$/.test(s.time || '') ? s.time : '07:20';
  return {
    job: str(p.job, 150),
    interests: Array.isArray(p.interests) ? p.interests.slice(0, 15).map((x) => str(x, 30)) : [],
    note: str(p.note, 300),
    light: p.light !== false,
    schedule: { time, days: cleanDays(s.days), holidays: s.holidays !== false },
  };
}
