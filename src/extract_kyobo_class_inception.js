const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '교보악사자산운용';
const pdfDir = path.join(root, 'data', '투자설명서', companyName);

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));

const normalizeClass = (value) => String(value || '')
  .replace(/^class/i, '')
  .replace(/^종류/i, '')
  .replace(/[^A-Za-z0-9]/g, '')
  .toLowerCase();

const iso = (raw) => {
  const match = String(raw || '').match(/((?:19|20)\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : null;
};

function performanceRows(pageTexts) {
  const rows = [];
  const rowPattern = /Class\s*([A-Za-z0-9]+(?:\s*-\s*[A-Za-z0-9]+)*)(?:\s*\([^)]*\))?\s+((?:19|20)\d{2}\s*[-./]\s*\d{1,2}\s*[-./]\s*\d{1,2})/gi;
  pageTexts.forEach((text, pageIndex) => {
    for (const match of text.matchAll(rowPattern)) {
      rows.push({
        label: match[1].replace(/\s+/g, ''),
        normalized: normalizeClass(match[1]),
        date: iso(match[2]),
        page: pageIndex + 1,
        evidence: `Class${match[1].replace(/\s+/g, '')} ${iso(match[2])}`,
      });
    }
  });
  return rows;
}

// A few table pages are image/vector-only and return no text through pdf.js.
// These overrides were transcribed from rendered full-table pages and are kept
// explicit so every non-machine-readable value remains auditable.
const visualOverrides = {
  'R2_KR5120420091.pdf': {
    cp: { date: '2022-12-21', page: 58 },
    cpe: { date: '2022-12-21', page: 58 },
    cr: { date: '2022-12-21', page: 58 },
    cre: { date: '2022-12-21', page: 59 },
    sr: { date: '2022-12-23', page: 59 },
    cw: { status: 'NOT_ESTABLISHED', page: 61 },
    ag: { status: 'NOT_ESTABLISHED', page: 61 },
    cg: { status: 'NOT_ESTABLISHED', page: 61 },
    ci: { status: 'NOT_ESTABLISHED', page: 61 },
  },
  'R2_KR5120450015.pdf': {
    c: { date: '2009-06-17', page: 66 },
    ch: { status: 'NOT_ESTABLISHED', page: 67 },
    cg: { status: 'NOT_ESTABLISHED', page: 67 },
    cf: { status: 'NOT_ESTABLISHED', page: 67 },
  },
  'R2_KR5120451001.pdf': {
    cw: { status: 'NOT_DISCLOSED', page: 54 },
    ch: { status: 'NOT_DISCLOSED', page: 54 },
  },
};

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const companyFunds = funds.filter((fund) => fund.company_name === companyName);
  const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));
  const targetClasses = classes.filter((row) => companyIds.has(row.fund_id));
  const results = [];

  for (const fund of companyFunds) {
    const document = documents.find((row) => row.doc_id === fund.source_doc_id);
    const pdfPath = path.join(pdfDir, document.file_name);
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), disableWorker: true }).promise;
    const pageTexts = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' '));
    }
    const rows = performanceRows(pageTexts);
    const unestablishedPageIndex = pageTexts.findIndex((text) => /상기\s*외[^.]{0,100}Class[^.]{0,100}설정\s*전/i.test(text));
    const explicitlyMarksOtherClassesUnestablished = unestablishedPageIndex >= 0;
    const fundClasses = targetClasses.filter((row) => row.fund_id === fund.fund_id);

    for (const classRow of fundClasses) {
      const normalized = normalizeClass(classRow.class_name_raw);
      const visualOverride = visualOverrides[document.file_name]?.[normalized];
      const matches = rows.filter((row) => row.normalized === normalized);
      const uniqueDates = [...new Set(matches.map((row) => row.date).filter(Boolean))];
      const selected = matches[0] || null;
      let status = 'REVIEW_REQUIRED';
      let reason = '성과표에서 클래스 최초설정일을 찾지 못했고 미설정 각주도 확인되지 않음';
      if (uniqueDates.length === 1) {
        status = 'ESTABLISHED';
        reason = '';
      } else if (uniqueDates.length > 1) {
        reason = `동일 클래스에서 서로 다른 최초설정일이 확인됨: ${uniqueDates.join('|')}`;
      } else if (explicitlyMarksOtherClassesUnestablished) {
        status = 'NOT_ESTABLISHED';
        reason = "원문 각주 '상기 외의 Class는 설정 전' 적용";
      }
      if (visualOverride?.date) {
        status = 'ESTABLISHED';
        uniqueDates.splice(0, uniqueDates.length, visualOverride.date);
        reason = '텍스트 추출 불가 표를 렌더링하여 원문 날짜 대조';
      } else if (visualOverride?.status) {
        status = visualOverride.status;
        reason = visualOverride.status === 'NOT_ESTABLISHED'
          ? "렌더링된 원문 각주 '상기 Class 외의 Class는 설정되지 않음' 적용"
          : '전체 성과표에 해당 클래스의 최초설정일이 기재되지 않아 미공시로 보존';
      }
      if (status === 'ESTABLISHED' && fund.inception_date && uniqueDates[0] < fund.inception_date) {
        status = 'REVIEW_REQUIRED';
        reason = `클래스 설정일 ${uniqueDates[0]}이 펀드 설정일 ${fund.inception_date}보다 빠름`;
      }
      results.push({
        file_name: document.file_name,
        company_name: fund.company_name,
        fund_id: fund.fund_id,
        fund_name: fund.fund_name_normalized,
        class_id: classRow.class_id,
        class_code: classRow.class_code,
        class_name: classRow.class_name_raw,
        class_inception_date: status === 'ESTABLISHED' ? uniqueDates[0] : null,
        class_inception_status: status,
        source_page: visualOverride?.page || selected?.page || (explicitlyMarksOtherClassesUnestablished ? unestablishedPageIndex + 1 : null),
        source_text: visualOverride?.date
          ? `Class${classRow.class_name_raw} ${visualOverride.date}`
          : visualOverride?.status === 'NOT_ESTABLISHED'
            ? '상기 Class 외의 Class는 설정되지 않음'
            : visualOverride?.status === 'NOT_DISCLOSED'
              ? '전체 성과표에 해당 클래스 최초설정일 기재 없음'
              : selected?.evidence || (explicitlyMarksOtherClassesUnestablished ? "상기 외의 Class는 설정 전" : null),
        reason,
      });
    }
  }

  const outputPath = path.join(validation, 'kyobo_class_inception_extraction.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  const reviewRows = results.filter((row) => row.class_inception_status === 'REVIEW_REQUIRED');
  writeCsv(
    path.join(validation, 'kyobo_class_inception_review.csv'),
    ['file_name', 'company_name', 'fund_id', 'fund_name', 'class_id', 'class_code', 'class_name', 'source_page', 'source_text', 'reason'],
    reviewRows,
  );
  const counts = results.reduce((acc, row) => {
    acc[row.class_inception_status] = (acc[row.class_inception_status] || 0) + 1;
    return acc;
  }, {});
  process.stdout.write(`${JSON.stringify({ output: outputPath, classes: results.length, counts }, null, 2)}\n`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
