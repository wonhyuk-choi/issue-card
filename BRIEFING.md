# 이슈 카드 만들기 (정기 작업 지시서)

정기 작업은 사람(프로필)마다 하나씩 있고, 작업 메시지에 대상 프로필 id(예: `p1`)가 적혀 있습니다. 매번 이 파일을 읽고 그대로 따릅니다. 모든 결과는 한국어로 씁니다.
앱 주소: https://wonhyuk-choi.github.io/issue-card/

## 0) 대상과 실행 종류
- 먼저 앱에서 바꾼 맞춤 설정을 가져옵니다(매시 자동 동기화가 늦거나 빠질 수 있어서): `gh api -X POST repos/wonhyuk-choi/issue-card/actions/workflows/worker.yml/dispatches -f ref=main` 로 "알림 저장소 배포·동기화"를 실행하고, `gh api 'repos/wonhyuk-choi/issue-card/actions/workflows/worker.yml/runs?per_page=1'` 의 status가 completed가 될 때까지(최대 3분) 기다린 뒤 `git pull --rebase origin main` 합니다. 실패하면 지금 있는 파일로 그대로 진행합니다.
- `push/profiles.json`에서 대상 프로필을 찾습니다: `job`, `interests`, `note`, `schedule`(`time` "HH:MM", `days` 요일 번호 배열(0=일, 1=월 … 6=토; 예전 형식 "weekdays"=1-5, "daily"=매일), `holidays` true면 공휴일에 쉼).
- 지금 시각(Asia/Seoul)이 그 사람의 `schedule.time` 40분 전부터 그 시각 사이면 **정기 실행**, 아니면 사용자가 직접 실행한 **수동 실행**입니다.

## 1) 쉬는 날 확인 (정기 실행만)
`holidays`가 true이고 오늘이 대한민국 법정 공휴일(신정, 설날 연휴, 삼일절, 어린이날, 부처님오신날, 현충일, 광복절, 추석 연휴, 개천절, 한글날, 성탄절, 대체공휴일, 선거일·임시공휴일 포함)이면 아무것도 바꾸지 말고 "오늘은 공휴일이라 브리핑을 쉽니다" 한 줄로 끝냅니다.
음력 휴일·대체공휴일·임시공휴일은 기억에 의존하지 말고 WebSearch로 "<연도>년 공휴일 대체공휴일"을 검색해 확인합니다.

## 2) 카드 만들기
- 주요 이슈 9~10개: WebSearch(필요하면 web-fetch 에이전트로 본문 확인)로 지금 기준 이슈를 모읍니다. 저녁 시간대라면 그날 하루 동안의 이슈를 정리합니다.
  - 절반 정도(4~5개)는 누구나 알아야 할 그날의 큰 뉴스(경제·증시·환율·금리, 정치, 사회·생활, 국제, 안보 중 가장 중요한 것).
  - 나머지(4~5개)는 그 사람의 `interests`와 `note`에 맞춰 고릅니다. 예: 금융·투자면 증시·금리 비중을, 바이오·헬스케어면 의료·제약 정책을, 게임·콘텐츠면 업계 소식을 늘립니다.
  - `light`가 true(기본값)이면 주요 이슈 중 2~3장은 가벼운 주제(연예·방송, 영화·드라마, 인터넷 밈·트렌드, 스포츠, 여행·맛집, 생활 꿀팁 등, 그 사람이 고른 가벼운 관심분야가 있으면 그쪽 우선)로 채웁니다. false면 가벼운 카드는 넣지 않습니다.
  - 가벼운 관심분야(연예·방송, 영화·드라마·OTT, 음악·공연, 인터넷 밈·트렌드, 스포츠, 여행·맛집, 패션·뷰티, 생활 꿀팁·쇼핑)를 고른 사람에게는 관심분야 몫 중 2~3장을 이런 가벼운 카드로 채워, 시사만 이어지지 않게 합니다. 그런 사람에게는 그 분야 카드도 넣습니다. 밈·트렌드는 언론 기사나 트렌드 정리 글로 확인된 것만 쓰고, "어디서 시작됐고 왜 유행하는지"를 한 줄 넣습니다. 루머·사생활·비방성 내용은 넣지 않습니다.
  - `why`는 모든 카드에서 그 사람 입장(직업·관심분야)에서 왜 중요한지 씁니다.
- 직무 카드 (장수 제한 없음, cat "job", 맨 끝): 그 사람의 직업·관심분야·메모에 맞는 업계·직무·채용 시장 뉴스 중 **새롭고 중요한 것은 모두** 넣습니다. 많으면 5장 넘어도 되고, 지난 카드(`git show HEAD:data/<id>.json`)와 겹치거나 새 소식이 없으면 0장이어도 됩니다. 억지로 채우지 않습니다. `why`는 그 사람 직업 입장에서 왜 중요한지 씁니다.
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
 "issues": [ 주요 이슈 9~10개, 그 뒤에 직무 카드 0장 이상 ]
}
```

카드 한 장의 형식: `cat`(econ/pol/soc/world/tech/sec/biz/ent(연예·방송·영화·음악·스포츠)/trend(밈·SNS 트렌드·여행·맛집·패션·생활 꿀팁), 직무 카드는 "job"), `label`, `num`(핵심 숫자 하나), `numLabel`, `title`, `points`(3개), `why`(한두 문장), `sources`([{"t": 출처 이름, "u": URL}]).
보기 방식이 두 가지라 카드마다 아래를 함께 채웁니다.
- **카드뉴스(그림 위주, 한눈에)**: 글보다 시각 자료가 주인공입니다.
  - `icon`: 주제를 한눈에 보여 주는 이모지 1개(예: 📉 🏦 🚆 ⚖️ 🛡️ 🏭). 언론사 사진은 저작권 때문에 쓰지 않습니다.
  - `cn`: 카드뉴스용 문구 `{"title": 12자 안팎 헤드라인(예: "코스피 6% 급락", "오늘 금리 결정"), "tldr": 25자 안팎 핵심 한 줄(명사형·쉼표로 끊기, 예: "관세 쇼크에 외국인 1.9조 매도, 반도체 직격탄"), "why": 15자 안팎(예: "퇴직연금·ETF 수익률 직격")}`. 키워드 먼저, 긴 문장·서술어 '~습니다/~다'로 끝내지 않습니다.
  - `chart`: 출처에서 확인한 숫자 묶음(값 2개 이상: 지수·환율 추이, 전후 비교, 종목·국가별 비교 등)이 있으면 넣습니다. `{"type": "bar" 또는 "line"(시간 흐름), "labels": [...], "values": [숫자...], "unit": "%", "caption": "무엇인지 (출처 이름)"}`. 가능한 카드는 모두 넣되 값을 추정하거나 지어내지 않습니다.
  - `stats`: 핵심 숫자 타일 2~3개 `[{"v": "4.98%", "l": "주택담보대출 금리"}]` (num과 겹치지 않게).
  - `timeline`: 날짜가 중요한 이슈면 일정 2~4개 `[{"d": "12/10", "t": "총파업 예고"}]`.
- **신문(자세히)**: `detail`에 2~4문단(문단마다 2~3문장)으로 배경(왜 이런 일이), 쟁점·숫자의 의미, 앞으로 볼 것(다음 일정·전망)을 씁니다. points와 같은 문장을 되풀이하지 않습니다. 직무 카드는 실무에 어떤 영향이 있는지도 씁니다.
말투는 보기 방식마다 다릅니다.
- 신문용(`title`, `points`, `detail`, `why`)은 실제 신문 기사체로 씁니다. `title`은 기사 제목처럼(핵심 숫자 + 쉼표·말줄임표 "…", 예: "코스피 6% 급락, 하루 새 308포인트 증발…美 관세 충격에 외국인 1.9조 '팔자'"), 본문은 "~했다/~밝혔다/~할 전망이다" 평서체로, 첫 문장은 누가·언제·무엇을 담은 리드로 씁니다. 존댓말(~습니다)과 구어체는 쓰지 않습니다.
- 카드뉴스용(`cn`)은 위 규칙대로 짧고 굵게 씁니다.
대시(—)는 쓰지 않습니다. 공개 저장소이므로 개인 이름이나 회사명은 넣지 않습니다.

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
- 첫 화면 맞춤 설정에서 초대 코드를 넣고 "등록하고 시작하기"를 누르면 알림 없이도 워커에 기기와 맞춤 설정이 저장되고 다음 번호(`p2`, `p3`…)가 붙습니다. 알림은 나중에 ⚙︎ 설정에서 켜며, 알림을 안 켠 기기와 일시중지한 기기는 알림 발송에서 빠집니다.
- 맞춤 설정은 매시 17분 GitHub Actions("알림 저장소 배포·동기화")가 `push/profiles.json`으로 옮깁니다. 바로 옮기려면 그 워크플로를 수동 실행합니다:
  `gh api -X POST repos/wonhyuk-choi/issue-card/actions/workflows/worker.yml/dispatches -f ref=main`
- 새 사람이 생기면 할 일:
  1. `push/profiles.json`에 그 사람이 들어온 것을 확인합니다(없으면 위 동기화 실행).
  2. 그 사람 첫 카드 `data/<id>.json`을 만듭니다(오늘 날짜, notifyAt 없이). 커밋 메시지에 `[no-notify]`를 넣으면 이 커밋으로는 알림이 안 갑니다.
  3. 그 사람용 정기 작업을 만듭니다: 새 세션 방식, 시각은 `schedule.time`의 25분 전(CRON_TZ=Asia/Seoul), 요일은 `days` 배열을 cron 요일 칸에 쉼표로(예: [1,3,5] → 1,3,5, 7일 모두면 *). 메시지는 "대상 프로필: <id>. 저장소 wonhyuk-choi/issue-card 를 붙이고(add_repo, access push) BRIEFING.md 를 읽고 그대로 따르세요." 알림 시간이 바뀌면 작업을 새로 만들고 예전 것은 지웁니다.
  4. 테스트 알림(그 사람이 알림을 켰을 때만): `gh api -X POST repos/wonhyuk-choi/issue-card/actions/workflows/notify.yml/dispatches -f ref=main -f "inputs[test]=true" -f "inputs[profile]=<id>"`
- 워커가 없을 때(예비): 앱이 보여 주는 코드(JSON)를 받아 `push/subscriptions.json`에 endpoint·keys와 `"profile": "<id>"`를 넣고, `push/profiles.json`에 맞춤 설정을 추가합니다.
