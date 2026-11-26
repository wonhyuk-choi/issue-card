// 새 카드가 올라오면 등록된 휴대폰으로 "이슈 뉴스 도착" 푸시를 보냅니다.
import fs from 'node:fs';
import webpush from 'web-push';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const test = process.env.TEST === 'true';
const [owner, repo] = (process.env.GITHUB_REPOSITORY || '/').split('/');
const site = process.env.SITE_URL || `https://${owner.toLowerCase()}.github.io/${repo}/`;

const { publicKey } = read('push/config.json');
const privateKey = process.env.VAPID_PRIVATE_KEY;
if (!privateKey) { console.error('VAPID_PRIVATE_KEY 시크릿이 없습니다.'); process.exit(1); }
const subs = read('push/subscriptions.json');
if (!subs.length) { console.log('등록된 기기가 없습니다. 보낼 곳이 없어 종료합니다.'); process.exit(0); }
const data = read('data/today.json');

if (!test) {
  // 1) 웹사이트에 새 카드가 반영될 때까지 기다림 (최대 10분)
  for (let k = 0; k < 30; k++) {
    try {
      const r = await fetch(`${site}data/today.json?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok && (await r.json()).generatedAt === data.generatedAt) { console.log('웹사이트 반영 확인'); break; }
    } catch {}
    console.log('웹사이트 반영 대기 중…'); await sleep(20000);
  }
  // 2) 정기 브리핑이면 약속한 시각(notifyAt, 보통 07:20 KST)까지 기다림
  if (data.notifyAt) {
    const wait = Date.parse(data.notifyAt) - Date.now();
    if (wait > 0 && wait < 40 * 60 * 1000) { console.log(`알림 시각까지 ${Math.round(wait / 1000)}초 대기`); await sleep(wait); }
  }
}

const payload = JSON.stringify(test
  ? { title: '이슈 카드 알림 테스트', body: '이 알림이 보이면 설정 완료예요. 평일 오전 7:20에 만나요.', url: site }
  : { title: '이슈 뉴스 도착', body: data.headline, url: site });

let ok = 0;
for (const s of subs) {
  try {
    await webpush.sendNotification(s, payload, {
      TTL: 6 * 3600, urgency: 'high',
      vapidDetails: { subject: site, publicKey, privateKey },
    });
    ok++; console.log('전송 성공', new URL(s.endpoint).host);
  } catch (e) {
    console.error('전송 실패', new URL(s.endpoint).host, e.statusCode, e.body || e.message);
  }
}
console.log(`${ok}/${subs.length} 기기에 보냄`);
if (!ok) process.exit(1);
