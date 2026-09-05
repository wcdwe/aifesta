# pension extraction

회사별 PDF 추출기와 공통 스키마를 사용해 투자설명서의 문서, 펀드, 클래스,
성과, AUM, 보수 이력 및 RAG 청크를 생성합니다.

```text
npm run extract
npm run extract:chunks
npm run validate:final
```

원본 PDF는 `data/투자설명서/`에서 읽기만 하며 수정하지 않습니다.

클래스/보수 검증은 `npm run validate:classes`, 원문 좌표 감사 자료 재생성은
`npm run audit:midas-tables`로 실행합니다.

확정할 수 없는 값은 추정하지 않고 `data/validation/unmatched_fields.csv`에 남깁니다.

## PDF 원문 품질 이슈

- `data/validation/pdf_source_issues.csv`: 원문 값, 이슈 유형, 공식 확인 여부,
  채택값, 처리 방식 및 판단 근거를 보존하는 품질 이슈 원장
- `data/validation/record_issues.csv`: 품질 이슈와 처리 테이블/제외 원문 행의 연결표
- `data/validation/pdf_source_errors.csv`: 기존 도구와의 호환을 위한 요약 파일
- `data/processed/chunks.jsonl`: `source_quality_issue` 섹션으로 각 품질 이슈를
  검색할 수 있도록 포함

공식 정정이 확인되지 않은 문제는 `CONFIRMED_SOURCE_ERROR`가 아니라
`SUSPECTED_SOURCE_ERROR` 또는 `RESOLVED_WITH_EVIDENCE`로 표시합니다. 원문 값은
덮어쓰지 않으며, 신뢰할 대체값이 없으면 처리 데이터에서 제외하거나 `NULL`로
보존합니다.

## suhyeon 통합 파이프라인

Python 기반 상세 추출·검색·API 코드는 `suhyeon` 브랜치의
`c21c9a43d320ec511261a8e4bf5b9e4929219d50` 커밋을 기준으로 통합했습니다.

- 기존 검증 데이터: `data/processed/` (덮어쓰지 않음)
- 팀원 원본 산출물: `data/staging/suhyeon/`
- 결합 산출물: `data/integrated/`
- 매핑·충돌·RAG 감사: `data/validation/integration_*`
- Python 추출·검색·API: `scripts/`, `api/`, `eval/`
- 통합 어댑터와 갱신 절차: `integration/README.md`

```text
npm run integrate
npm run integrate:all
npm run validate:final
npm run audit:questions
```

통합 RAG는 팀원의 전체 페이지 텍스트를 사용하되 기존 중복 문서 그룹을
적용하여 대표 문서만 색인하고, 모든 상품코드는 별칭으로 보존합니다.
`integrate:all`은 결합 데이터와 RAG뿐 아니라 SQLite/FTS 및 이식 가능한
의미검색 인덱스까지 다시 생성합니다.
