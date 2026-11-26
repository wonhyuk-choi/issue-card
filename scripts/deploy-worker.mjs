// GitHub Actions에서 Cloudflare Worker(알림 저장소)를 배포합니다. 필요한 시크릿: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, VAPID_PRIVATE_KEY
import fs from 'node:fs';
import crypto from 'node:crypto';

let A = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const T = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
if (!T) { console.log('CLOUDFLARE_API_TOKEN 시크릿이 아직 없어 배포를 건너뜁니다.'); process.exit(0); }
if (!A) {
  // Account ID 시크릿이 없으면 토큰으로 계정을 찾음
  const r = await fetch('https://api.cloudflare.com/client/v4/accounts', { headers: { Authorization: `Bearer ${T}` } });
  const j = await r.json().catch(() => ({}));
  A = (j.result && j.result[0] && j.result[0].id) || '';
  if (!A) { console.error('계정을 찾지 못했습니다', r.status, JSON.stringify(j.errors || j)); process.exit(1); }
  console.log('계정 찾음');
}
const NAME = 'issue-card';
const ORIGIN = 'https://wonhyuk-choi.github.io';
const adminKey = crypto.createHash('sha256').update(process.env.VAPID_PRIVATE_KEY || '').digest('hex');

async function api(path, opts = {}) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${A}${path}`, { ...opts, headers: { Authorization: `Bearer ${T}`, ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.success !== false, status: r.status, j };
}
const must = (res, what) => { if (!res.ok) { console.error(what, '실패', res.status, JSON.stringify(res.j.errors || res.j)); process.exit(1); } return res.j.result; };

// 1) KV 저장 공간
let ns = must(await api('/storage/kv/namespaces?per_page=100'), 'KV 목록').find((x) => x.title === 'issue-card-subs');
if (!ns) ns = must(await api('/storage/kv/namespaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'issue-card-subs' }) }), 'KV 만들기');
console.log('KV:', ns.id);

// 2) workers.dev 주소
let sd = await api('/workers/subdomain');
let sub = sd.ok && sd.j.result && sd.j.result.subdomain;
if (!sub) {
  sub = 'issuecard-' + A.slice(0, 8).toLowerCase();
  must(await api('/workers/subdomain', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subdomain: sub }) }), 'workers.dev 주소 만들기');
}

// 3) 코드 올리기
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify({
  main_module: 'worker.js',
  compatibility_date: '2024-11-01',
  bindings: [
    { type: 'kv_namespace', name: 'KV', namespace_id: ns.id },
    { type: 'secret_text', name: 'ADMIN_KEY', text: adminKey },
    { type: 'plain_text', name: 'ALLOW_ORIGIN', text: ORIGIN },
    ...(process.env.INVITE_CODE ? [{ type: 'secret_text', name: 'INVITE_CODE', text: process.env.INVITE_CODE.trim() }] : []),
  ],
})], { type: 'application/json' }));
form.append('worker.js', new Blob([fs.readFileSync('worker/worker.js', 'utf8')], { type: 'application/javascript+module' }), 'worker.js');
must(await api(`/workers/scripts/${NAME}`, { method: 'PUT', body: form }), '워커 올리기');
must(await api(`/workers/scripts/${NAME}/subdomain`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true, previews_enabled: false }) }), 'workers.dev 켜기');

const url = `https://${NAME}.${sub}.workers.dev`;
console.log('WORKER_URL=' + url);

// 4) 기존 등록 기기 옮기기 (이미 있으면 건너뜀)
const items = JSON.parse(fs.readFileSync('push/subscriptions.json', 'utf8')).map((s) => ({ sub: s, id: s.profile || 'p1' }));
for (let k = 0; k < 12; k++) {
  try {
    const r = await fetch(url + '/admin/import', { method: 'POST', headers: { Authorization: 'Bearer ' + adminKey, 'content-type': 'application/json' }, body: JSON.stringify({ items }) });
    if (r.ok) { console.log('기존 기기 옮김:', JSON.stringify(await r.json())); break; }
    console.log('워커 준비 대기…', r.status);
  } catch (e) { console.log('워커 준비 대기…', e.message); }
  await new Promise((r) => setTimeout(r, 10000));
}
fs.writeFileSync('push/worker.json', JSON.stringify({ url }, null, 1) + '\n');
