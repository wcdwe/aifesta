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
