// 이슈 카드 알림 저장소 (Cloudflare Worker + KV, 무료)
// 앱: 알림 등록(/register), 상태 확인(/status), 일시중지·재개(/pause), 맞춤 설정 저장(/profile)
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

      if (url.pathname === '/register' && req.method === 'POST') {
        const sub = cleanSub(body.sub);
        if (!sub) return json({ error: 'bad subscription' }, 400);
        const k = await keyOf(sub.endpoint);
        let rec = await env.KV.get(k, 'json');
        if (!rec) {
          const n = (await env.KV.list({ prefix: 'sub:' })).keys.length;
          if (n >= MAX_SUBS) return json({ error: 'full' }, 429);
          rec = { id: await nextId(env), createdAt: now() };
        }
        rec.sub = sub;
        if (body.profile) rec.profile = cleanProfile(body.profile);
        rec.paused = false;
        rec.updatedAt = now();
        await env.KV.put(k, JSON.stringify(rec));
        return json({ id: rec.id, paused: false });
      }
      if (url.pathname === '/status' && req.method === 'POST') {
        const rec = ep ? await env.KV.get(await keyOf(ep), 'json') : null;
        if (!rec) return json({ registered: false });
        return json({ registered: true, id: rec.id, paused: !!rec.paused, profile: rec.profile || null });
      }
      if (url.pathname === '/pause' && req.method === 'POST') {
        const k = ep ? await keyOf(ep) : '';
        const rec = k ? await env.KV.get(k, 'json') : null;
        if (!rec) return json({ error: 'not registered' }, 404);
        rec.paused = !!body.paused; rec.updatedAt = now();
        await env.KV.put(k, JSON.stringify(rec));
        return json({ id: rec.id, paused: rec.paused });
      }
      if (url.pathname === '/profile' && req.method === 'POST') {
        const k = ep ? await keyOf(ep) : '';
        const rec = k ? await env.KV.get(k, 'json') : null;
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
        for (const x of body.items || []) {
          const sub = cleanSub(x.sub || x);
          if (!sub) continue;
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
function cleanProfile(p) {
  const str = (v, n) => String(v || '').slice(0, n);
  const s = p.schedule || {};
  const time = /^\d{2}:\d{2}$/.test(s.time || '') ? s.time : '07:20';
  return {
    job: str(p.job, 60),
    interests: Array.isArray(p.interests) ? p.interests.slice(0, 15).map((x) => str(x, 30)) : [],
    note: str(p.note, 200),
    schedule: { time, days: s.days === 'daily' ? 'daily' : 'weekdays', holidays: s.holidays !== false },
  };
}
