// 사람별 카드 파일(data/<id>.json)이 새로 올라오면 그 사람 휴대폰으로 "이슈 뉴스 도착" 푸시를 보냅니다.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import webpush from 'web-push';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const test = process.env.TEST === 'true';
const [owner, repo] = (process.env.GITHUB_REPOSITORY || '/').split('/');
const site = process.env.SITE_URL || `https://${owner.toLowerCase()}.github.io/${repo}/`;

const { publicKey } = read('push/config.json');
const privateKey = process.env.VAPID_PRIVATE_KEY;
if (!privateKey) { console.error('VAPID_PRIVATE_KEY 시크릿이 없습니다.'); process.exit(1); }
const subs = read('push/subscriptions.json');
const vapidDetails = { subject: site, publicKey, privateKey };

async function send(list, payload) {
  let ok = 0;
  for (const s of list) {
    try {
      await webpush.sendNotification(s, JSON.stringify(payload), { TTL: 6 * 3600, urgency: 'high', vapidDetails });
      ok++; console.log('전송 성공', s.profile || 'p1', new URL(s.endpoint).host);
    } catch (e) {
      console.error('전송 실패', s.profile || 'p1', new URL(s.endpoint).host, e.statusCode, e.body || e.message);
    }
  }
  return ok;
}

// 테스트: 특정 사람(PROFILE) 또는 전체에게 테스트 알림
if (test) {
  const only = process.env.PROFILE;
  const list = subs.filter((s) => !only || (s.profile || 'p1') === only);
  const ok = await send(list, { title: '이슈 카드 알림 테스트', body: '이 알림이 보이면 설정 완료예요.', url: site });
  console.log(`${ok}/${list.length} 기기에 보냄`);
  process.exit(list.length && !ok ? 1 : 0);
}

// 커밋 메시지에 [no-notify]가 있으면 알림을 보내지 않음 (구조 정리용 커밋)
try { if (sh('git log -1 --format=%B').includes('[no-notify]')) { console.log('[no-notify] 커밋이라 건너뜁니다.'); process.exit(0); } } catch {}

// 이번 커밋에서 내용(generatedAt)이 바뀐 사람별 카드 파일만 골라냄
let changed = [];
try { changed = sh('git diff --name-only HEAD~1 HEAD -- data/').split('\n').filter((f) => /^data\/[\w-]+\.json$/.test(f)); } catch {}
const jobs = [];
for (const file of changed) {
  if (!fs.existsSync(file)) continue;
  const id = file.slice(5, -5);
  const data = read(file);
  try { if (JSON.parse(sh(`git show HEAD~1:${file}`)).generatedAt === data.generatedAt) continue; } catch {}
  const list = subs.filter((s) => (s.profile || 'p1') === id);
  if (list.length) jobs.push({ id, file, data, list });
}
if (!jobs.length) { console.log('새 카드가 없어 알림을 보내지 않습니다.'); process.exit(0); }

let failed = false;
await Promise.all(jobs.map(async ({ id, file, data, list }) => {
  // 1) 웹사이트에 새 카드가 반영될 때까지 기다림 (최대 10분)
  for (let k = 0; k < 30; k++) {
    try {
      const r = await fetch(`${site}${file}?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok && (await r.json()).generatedAt === data.generatedAt) { console.log(id, '웹사이트 반영 확인'); break; }
    } catch {}
    await sleep(20000);
  }
  // 2) 그 사람이 정한 알림 시각(notifyAt)까지 기다림
  if (data.notifyAt) {
    const wait = Date.parse(data.notifyAt) - Date.now();
    if (wait > 0 && wait < 45 * 60 * 1000) { console.log(id, `알림 시각까지 ${Math.round(wait / 1000)}초 대기`); await sleep(wait); }
  }
  const ok = await send(list, { title: '이슈 뉴스 도착', body: data.headline, url: site });
  console.log(id, `${ok}/${list.length} 기기에 보냄`);
  if (!ok) failed = true;
}));
if (failed) process.exit(1);
