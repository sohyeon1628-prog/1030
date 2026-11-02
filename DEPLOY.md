# 배포와 운영

서버는 `server/index.js` 하나이고, 저장은 SQLite 파일 하나(`naru.db`)입니다. 화면(`dist`)도 같은 서버가 내줍니다.

## 꼭 지킬 것
1. **영구 디스크**: `DATA_DIR`(기본 `server/data`)를 재시작·재배포해도 지워지지 않는 디스크(볼륨)에 둔다. 컨테이너라면 `/data` 볼륨.
2. **HTTPS**: 마이크·클립보드·공유·로그인 비밀번호는 보안 연결에서만 안전하다. 프록시 뒤라면 `TRUST_PROXY=1`.
3. **인스턴스는 하나**: SQLite는 쓰는 쪽이 하나여야 한다(서버를 여러 대로 늘리지 않는다). 더 늘려야 하면 DB를 Postgres로 바꾸는 작업이 필요하다(`server/db.js`만 갈아끼우면 되도록 나눠 두었다).
4. **관리자 토큰**: `ADMIN_TOKEN`을 정해 두면 그 값을 쓴다. 없으면 처음 시작할 때 무작위로 만들어 `DATA_DIR/.admin-token`에 저장하고 콘솔에 한 번 알려 준다. `/admin`에서 입력한다.

## 환경 변수
| 이름 | 기본값 | 설명 |
|---|---|---|
| `PORT` | 8787 | 서버 포트 |
| `DATA_DIR` | `server/data` | DB·토큰이 저장되는 곳(영구 디스크) |
| `BACKUP_DIR` | `DATA_DIR/backups` | 백업 폴더. 가능하면 다른 디스크나 클라우드 마운트 |
| `BACKUP_KEEP` | 14 | 남길 백업 개수 |
| `BACKUP_EVERY_HOURS` | 24 | 자동 백업 주기(시작할 때도 한 번) |
| `ADMIN_TOKEN` | 자동 생성 | 관리자 화면 토큰 |
| `TRUST_PROXY` | 0 | 프록시 뒤에서 `1` (실제 접속자 IP를 `X-Forwarded-For`로 읽는다) |
| `ALLOW_ORIGIN` | | 앱(다른 출처)에서 호출할 때 허용할 주소, 쉼표로 구분 |
| `HASH_SALT` | 자동 | IP 해시용 소금(없으면 DB에 한 번 만들어 둔다) |
| `PUBLIC_URL` | 요청 주소에서 추정 | 사이트의 공개 주소(예: `https://naru.example.com`). 메일 링크와 소셜 로그인 돌아오는 주소에 쓰인다. **운영에서는 꼭 설정** |
| `RESEND_API_KEY`, `MAIL_FROM` | | 비밀번호 찾기·이메일 인증 메일을 실제로 보낸다([Resend](https://resend.com) 기준, `MAIL_API_URL`로 호환 서비스 사용 가능). 없으면 개발 모드: 보내지 않고 콘솔과 `DATA_DIR/outbox.log`에 링크만 기록 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | | 설정하면 Google 로그인 버튼이 켜진다. 안 쓰면 이메일 가입만 동작한다 |

## 백업과 복원
- 자동: 시작할 때와 주기마다 `naru-날짜.db`를 만든다(SQLite 백업 API라서 쓰는 중에도 일관된 사본). 오래된 것은 지운다.
- 수동: `npm run backup`
- 복원: 서버를 멈추고 백업 파일을 `DATA_DIR/naru.db`로 복사한다. `naru.db-wal`, `naru.db-shm`이 있으면 지운다. 다시 시작.
- 상태 확인: `GET /api/health` → `{ ok, users, letters, voices, backup }` (`backup`은 마지막 백업 시각)

## 예전 파일 저장에서 옮기기
예전 버전은 편지마다 JSON 파일을 `DATA_DIR`에 만들었다. 새 버전은 처음 시작할 때 그 파일을 DB로 옮기고 원본을 `DATA_DIR/legacy/`로 치운다.

## 컨테이너로 실행
```
docker build -t naru .
docker run -d -p 8787:8787 -v naru-data:/data -e ADMIN_TOKEN=원하는토큰 naru
```

## 이메일·소셜 로그인 설정
1. **메일**: Resend에서 발신 도메인을 인증하고 API 키를 받아 `RESEND_API_KEY`, `MAIL_FROM`(예: `나루 우체국 <noreply@내도메인>`)을 넣는다. 설정하지 않으면 비밀번호 찾기 메일이 실제로는 가지 않는다.
2. **소셜 로그인**: 각 서비스(Google Cloud Console)에서 앱을 만들고 **돌아오는 주소(Redirect URI)** 를 `PUBLIC_URL/api/auth/oauth/google/callback` 으로 등록한 뒤, 발급받은 ID·Secret을 환경 변수로 넣는다.
3. 이메일은 인증한 것만 비밀번호 찾기에 쓰인다. 소셜 계정의 인증된 이메일이 기존 계정의 인증된 이메일과 같으면 같은 계정으로 이어진다.

## 개인정보 안내 페이지
`/privacy`에 수집 항목, 녹음을 누가 듣는지, 보관 기간, 지우는 방법이 적혀 있다. 운영자 연락처는 빌드할 때 `VITE_CONTACT_EMAIL` 환경 변수로 넣는다(Render의 Environment에 넣고 다시 배포). 이 문구는 서비스 동작을 그대로 적은 것이라, 공개 전에 약관·개인정보처리방침으로서 적절한지 전문가의 검토를 받는 것이 좋다.

## 개발 명령
| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 화면 개발 서버(5173). 편지·로그인은 `npm run server`(8787)와 함께 |
| `npm test` | 서버·엔진·기록 합치기 자동 시험(26개) |
| `npm run lint` | 정적 검사 |
| `npm run build` | 배포용 빌드(`dist`) |
