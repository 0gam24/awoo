# 예약 발행 대기 폴더

`_scheduled/{YYYY-MM-DD}/{slug}.json` 형태로 두면 매일 18:15 KST에
publish-scheduled.yml 워크플로우가 기일 도래분(오늘 이하 + 17시 이후의 내일자)만
본 폴더로 옮겨 커밋·배포한다. 여기 있는 동안은 사이트에 노출되지 않는다.
수동 실행: npm run publish:scheduled
