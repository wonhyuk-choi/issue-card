# 이슈 카드 만들기 (정기 작업 지시서)

정기 작업은 사람(프로필)마다 하나씩 있고, 작업 메시지에 대상 프로필 id(예: `p1`)가 적혀 있습니다. 매번 이 파일을 읽고 그대로 따릅니다. 모든 결과는 한국어로 씁니다.
앱 주소: https://wonhyuk-choi.github.io/issue-card/

## 0) 대상과 실행 종류
- `push/profiles.json`에서 대상 프로필을 찾습니다: `job`, `interests`, `note`, `schedule`(`time` "HH:MM", `days` 요일 번호 배열(0=일, 1=월 … 6=토; 예전 형식 "weekdays"=1-5, "daily"=매일), `holidays` true면 공휴일에 쉼).
- 지금 시각(Asia/Seoul)이 그 사람의 `schedule.time` 40분 전부터 그 시각 사이면 **정기 실행**, 아니면 사용자가 직접 실행한 **수동 실행**입니다.

## 1) 쉬는 날 확인 (정기 실행만)
`holidays`가 true이고 오늘이 대한민국 법정 공휴일(신정, 설날 연휴, 삼일절, 어린이날, 부처님오신날, 현충일, 광복절, 추석 연휴, 개천절, 한글날, 성탄절, 대체공휴일, 선거일·임시공휴일 포함)이면 아무것도 바꾸지 말고 "오늘은 공휴일이라 브리핑을 쉽니다" 한 줄로 끝냅니다.
음력 휴일·대체공휴일·임시공휴일은 기억에 의존하지 말고 WebSearch로 "<연도>년 공휴일 대체공휴일"을 검색해 확인합니다.

## 2) 카드 만들기
- 주요 이슈 9~10개: WebSearch(필요하면 web-fetch 에이전트로 본문 확인)로 지금 기준 이슈를 모읍니다. 저녁 시간대라면 그날 하루 동안의 이슈를 정리합니다.
  - 절반 정도(4~5개)는 누구나 알아야 할 그날의 큰 뉴스(경제·증시·환율·금리, 정치, 사회·생활, 국제, 안보 중 가장 중요한 것).
  - 나머지(4~5개)는 그 사람의 `interests`와 `note`에 맞춰 고릅니다. 예: 금융·투자면 증시·금리 비중을, 바이오·헬스케어면 의료·제약 정책을, 게임·콘텐츠면 업계 소식을 늘립니다.
  - `why`는 모든 카드에서 그 사람 입장(직업·관심분야)에서 왜 중요한지 씁니다.
- 직무 카드 2개(cat "job", 맨 끝): 그 사람의 직업·관심분야·메모에 맞는 업계·직무·채용 시장 뉴스. `why`는 그 사람 직업 입장에서 왜 중요한지 씁니다.
- 출처 페이지에서 확인한 사실과 숫자만 쓰고, 지어내지 않습니다.

## 3) data/<id>.json 쓰기
그 사람의 파일(예: `data/p1.json`)만 통째로 새로 씁니다(UTF-8). 형식:

```
{
 "date": "YYYY-MM-DD",
 "dateLabel": "11월 27일 금요일",
 "generatedAt": "지금 시각 ISO, +09:00",
 "notifyAt": "<오늘>T<schedule.time>:00+09:00",   ← 정기 실행일 때만. 수동 실행이면 이 줄을 뺍니다
 "headline": "오늘 가장 큰 이슈 한 줄",
 "issues": [ 공통 이슈 9~10개, 그 뒤에 직무 카드 2개 ]
}
```

카드 한 장의 형식: `cat`(econ/pol/soc/world/tech/sec/biz, 직무 카드는 "job"), `label`, `num`(핵심 숫자 하나), `numLabel`, `title`, `points`(3개), `why`(한두 문장), `sources`([{"t": 출처 이름, "u": URL}]).
문장은 짧고 평이한 존댓말로, 대시(—)는 쓰지 않습니다. 공개 저장소이므로 개인 이름이나 회사명은 넣지 않습니다.

`python3 -c "import json;json.load(open('data/<id>.json'))"`로 확인한 뒤 커밋합니다(메시지 예: "이슈 카드 p1 2026-11-27").
push 전에 `git pull --rebase origin main`을 하고 main에 push 합니다. 네트워크 오류나 충돌이면 pull --rebase 후 최대 4번 재시도합니다.
push 하면 GitHub Actions가 웹사이트 반영을 확인하고 notifyAt 시각(없으면 즉시)에 그 사람 휴대폰으로 알림을 보냅니다.
자기 파일 말고 다른 파일(다른 사람 data, push/, scripts/, .github/, index.html 등)은 건드리지 않습니다.

## 4) 예비 아티팩트 갱신 (p1만)
대상이 `p1`일 때만: Artifact 도구로 https://claude.ai/artifact/BoJLPa1UdMstYCaAk2Dr1k 를 action "read"로 읽고, 페이지 코드는 그대로 둔 채 `<!-- ISSUE-DATA:START` 와 `<!-- ISSUE-DATA:END -->` 사이 `<script id="issue-data" type="application/json">` JSON만 date, dateLabel, headline, issues로 바꿔 같은 url로 publish 합니다. /mnt/project-files/issue-brief/ 폴더가 있으면 index.html 사본도 저장합니다. 실패해도 3)이 성공했으면 괜찮습니다.

## 5) 마지막 응답
"이슈 뉴스 도착 (<id>)"로 시작하고, 앱 주소와 오늘 카드 제목 목록을 담습니다. 3)이 실패했다면 그 사실과 이유를 맨 앞에 씁니다.

---

## 새 사람 등록 / 설정 변경 (관리용)
알림 저장소(Cloudflare Worker, 주소는 `push/worker.json`)가 있으면 등록·일시중지는 앱에서 자동으로 처리됩니다.
- 앱에서 "알림 켜기"를 누르면 워커에 기기와 맞춤 설정이 저장되고 다음 번호(`p2`, `p3`…)가 붙습니다. 일시중지한 기기는 알림 발송에서 빠집니다.
- 맞춤 설정은 매시 17분 GitHub Actions("알림 저장소 배포·동기화")가 `push/profiles.json`으로 옮깁니다. 바로 옮기려면 그 워크플로를 수동 실행합니다:
  `gh api -X POST repos/wonhyuk-choi/issue-card/actions/workflows/worker.yml/dispatches -f ref=main`
- 새 사람이 생기면 할 일:
  1. `push/profiles.json`에 그 사람이 들어온 것을 확인합니다(없으면 위 동기화 실행).
  2. 그 사람 첫 카드 `data/<id>.json`을 만듭니다(오늘 날짜, notifyAt 없이). 커밋 메시지에 `[no-notify]`를 넣으면 이 커밋으로는 알림이 안 갑니다.
  3. 그 사람용 정기 작업을 만듭니다: 새 세션 방식, 시각은 `schedule.time`의 25분 전(CRON_TZ=Asia/Seoul), 요일은 `days` 배열을 cron 요일 칸에 쉼표로(예: [1,3,5] → 1,3,5, 7일 모두면 *). 메시지는 "대상 프로필: <id>. 저장소 wonhyuk-choi/issue-card 를 붙이고(add_repo, access push) BRIEFING.md 를 읽고 그대로 따르세요." 알림 시간이 바뀌면 작업을 새로 만들고 예전 것은 지웁니다.
  4. 테스트 알림: `gh api -X POST repos/wonhyuk-choi/issue-card/actions/workflows/notify.yml/dispatches -f ref=main -f "inputs[test]=true" -f "inputs[profile]=<id>"`
- 워커가 없을 때(예비): 앱이 보여 주는 코드(JSON)를 받아 `push/subscriptions.json`에 endpoint·keys와 `"profile": "<id>"`를 넣고, `push/profiles.json`에 맞춤 설정을 추가합니다.
