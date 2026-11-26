# 아침 이슈 카드 만들기 (정기 작업 지시서)

정기 작업이 매번 이 파일을 읽고 그대로 따릅니다. 모든 결과는 한국어로 씁니다.
앱 주소: https://wonhyuk-choi.github.io/issue-card/

## 0) 실행 종류
지금 시각(Asia/Seoul)이 평일 06:40~07:15 사이면 **정기 실행**, 그 밖이면 사용자가 직접 실행한 **수동 실행**입니다.

## 1) 공휴일 확인 (정기 실행만)
오늘이 대한민국 법정 공휴일(신정, 설날 연휴, 삼일절, 어린이날, 부처님오신날, 현충일, 광복절, 추석 연휴, 개천절, 한글날, 성탄절, 대체공휴일, 선거일·임시공휴일 포함)이면 아무것도 바꾸지 말고 "오늘은 공휴일이라 브리핑을 쉽니다" 한 줄로 끝냅니다.
음력 휴일·대체공휴일·임시공휴일은 기억에 의존하지 말고 WebSearch로 "<연도>년 공휴일 대체공휴일"을 검색해 확인합니다.

## 2) 공통 이슈 9~10개
WebSearch(필요하면 web-fetch 에이전트로 본문 확인)로 지금 기준 주요 이슈를 모읍니다: 증시·환율·금리 등 경제, 정치, 사회·출퇴근·생활, 국제, AI·테크, 안보.
출처 페이지에서 확인한 사실과 숫자만 쓰고, 지어내지 않습니다.

## 3) 사람별 직무 카드 (각 2개)
`push/profiles.json`의 사람마다(`id`, `job`, `interests`, `note`) 그 사람의 직업과 관심분야에 맞는 업계·직무·채용 시장 뉴스로 카드 2개를 만듭니다.
관심이 겹치는 사람끼리는 검색을 같이 써도 되지만, `why`는 그 사람 직업 입장에서 왜 중요한지 씁니다.

## 4) data/today.json 쓰기
파일을 통째로 새로 씁니다(UTF-8). 형식:

```
{
 "date": "YYYY-MM-DD",
 "dateLabel": "11월 27일 금요일",
 "generatedAt": "지금 시각 ISO, +09:00",
 "notifyAt": "<오늘>T07:20:00+09:00",   ← 정기 실행일 때만. 수동 실행이면 이 줄을 뺍니다
 "headline": "오늘 가장 큰 이슈 한 줄",
 "issues": [ 공통 이슈 카드들 (cat "job" 금지) ],
 "jobSets": { "p1": [직무 카드 2개], "p2": [...] }
}
```

카드 한 장의 형식: `cat`(econ/pol/soc/world/tech/sec/biz 중 하나, 직무 카드는 "job"), `label`, `num`(핵심 숫자 하나), `numLabel`, `title`, `points`(3개), `why`(독자에게 왜 중요한지 한두 문장), `sources`([{"t": 출처 이름, "u": URL}]).
문장은 짧고 평이한 존댓말로, 대시(—)는 쓰지 않습니다. 공개 저장소이므로 개인 이름이나 회사명은 넣지 않습니다.

`python3 -c "import json;json.load(open('data/today.json'))"`로 JSON을 확인한 뒤, main 브랜치에 바로 커밋하고 push 합니다(커밋 메시지 예: "이슈 카드 2026-11-27").
push 하면 GitHub Actions가 웹사이트 반영을 확인하고 notifyAt 시각(없으면 즉시)에 등록된 휴대폰으로 알림을 보냅니다. 네트워크 오류면 최대 4번 재시도합니다.
`data/today.json` 말고 다른 파일(push/, scripts/, .github/, index.html 등)은 건드리지 않습니다.

## 5) 예비 아티팩트 갱신
Artifact 도구로 https://claude.ai/artifact/BoJLPa1UdMstYCaAk2Dr1k 를 action "read"로 읽고, 페이지 코드는 그대로 둔 채 `<!-- ISSUE-DATA:START` 와 `<!-- ISSUE-DATA:END -->` 사이 `<script id="issue-data" type="application/json">` JSON만 바꿔 같은 url로 publish 합니다.
그 JSON은 date, dateLabel, headline, issues(공통 이슈 뒤에 jobSets.p1 카드 2개를 붙인 것)만 담습니다. /mnt/project-files/issue-brief/ 폴더가 있으면 index.html 사본도 저장합니다.
이 단계가 실패해도 4)가 성공했으면 괜찮습니다.

## 6) 마지막 응답
"이슈 뉴스 도착"으로 시작하고, 앱 주소와 오늘 카드 제목 목록(사람별 직무 카드 포함)을 담습니다. 4)가 실패했다면 그 사실과 이유를 맨 앞에 씁니다.

## 새 사람 등록 (참고)
앱의 "알림 켜기" 후 나오는 코드(JSON)에 `profile`이 들어 있으면: `push/profiles.json`에 다음 번호(`p2`, `p3`…)로 job/interests/note를 추가하고, `push/subscriptions.json`에 endpoint·expirationTime·keys와 `"profile": "<id>"`를 추가해 커밋합니다.
그다음 `gh api -X POST repos/wonhyuk-choi/issue-card/actions/workflows/notify.yml/dispatches -f ref=main -f "inputs[test]=true"` 로 테스트 알림을 보냅니다.
