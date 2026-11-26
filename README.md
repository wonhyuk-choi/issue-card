# 아침 이슈 카드

평일 아침 7시 20분, 한 손으로 넘겨 보는 이슈 카드 웹앱(PWA)입니다.

- `index.html`, `sw.js`, `manifest.webmanifest`: 앱 화면 (GitHub Pages)
- `data/today.json`: 오늘의 카드. 매일 아침 정기 작업이 이 파일을 바꿉니다.
- `.github/workflows/notify.yml`: `data/today.json`이 바뀌면 등록된 휴대폰으로 푸시 알림을 보냅니다.
- `push/subscriptions.json`: 알림 받을 기기 목록. `push/config.json`: 알림 공개 키.
- 비공개 키는 저장소 Settings → Secrets → Actions 의 `VAPID_PRIVATE_KEY` 에 있습니다.

## today.json 형식

`date`(YYYY-MM-DD), `dateLabel`, `generatedAt`(ISO, +09:00), `notifyAt`(정기 실행일 때만, 예: `2026-11-27T07:20:00+09:00`), `headline`, `issues[]`
(각 항목: `cat` econ/pol/soc/world/tech/sec/biz/job, `label`, `num`, `numLabel`, `title`, `points[3]`, `why`, `sources[{t,u}]`).
