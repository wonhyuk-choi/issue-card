// 알림 저장소(워커)에 등록된 사람들의 맞춤 설정을 push/profiles.json 으로 옮깁니다. (기기 주소는 저장소에 남기지 않음)
import fs from 'node:fs';
import crypto from 'node:crypto';
if (!fs.existsSync('push/worker.json')) { console.log('알림 저장소가 아직 없습니다.'); process.exit(0); }
const { url } = JSON.parse(fs.readFileSync('push/worker.json', 'utf8'));
const adminKey = crypto.createHash('sha256').update(process.env.VAPID_PRIVATE_KEY || '').digest('hex');
const r = await fetch(url + '/admin/list', { headers: { Authorization: 'Bearer ' + adminKey } });
if (!r.ok) { console.error('목록을 못 가져왔습니다', r.status); process.exit(1); }
const recs = await r.json();
// 등록 현황 요약 (개인 정보 없이)
for (const x of recs) console.log(`등록: ${x.id} · 알림 ${x.sub ? (x.paused ? '일시중지' : '켜짐') : '안 켬'} · 맞춤 설정 ${x.profile ? '있음' : '없음'}${x.profile && x.profile.schedule ? ' · ' + x.profile.schedule.time + ' ' + JSON.stringify(x.profile.schedule.days) : ''} · 등록일 ${String(x.createdAt || '').slice(0, 10)}`);
const old = JSON.parse(fs.readFileSync('push/profiles.json', 'utf8'));
const byId = new Map(old.map((p) => [p.id, p]));
for (const rec of recs) {
  if (!rec.profile) continue;            // 설정 없이 등록한 기기는 기존 프로필 유지
  const prev = byId.get(rec.id) || {};
  byId.set(rec.id, { ...prev, id: rec.id, ...rec.profile });
}
const next = [...byId.values()].sort((a, b) => parseInt(a.id.slice(1)) - parseInt(b.id.slice(1)));
const out = JSON.stringify(next, null, 1) + '\n';
if (out !== fs.readFileSync('push/profiles.json', 'utf8')) { fs.writeFileSync('push/profiles.json', out); console.log('프로필 갱신:', next.map((p) => p.id).join(', ')); }
else console.log('변경 없음');
