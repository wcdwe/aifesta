const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const pdfDir = path.join(root, 'data', '투자설명서', '미래에셋자산운용');

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));

const normalizeClass = (value) => String(value || '')
  .replace(/^종류/i, '')
  .replace(/^\*/, '')
  .replace(/[^A-Za-z0-9]/g, '')
  .toLowerCase();

const iso = (raw) => {
  const match = String(raw || '').match(/((?:19|20)\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : null;
};

function tableSection(pageTexts) {
  const startPage = pageTexts.findIndex((text) => /최초설정일/.test(text) && /가입자격/.test(text));
  if (startPage < 0) return null;
  const chunks = [];
  let finished = false;
  for (let index = startPage; index < pageTexts.length && !finished; index += 1) {
    let text = pageTexts[index];
    if (index === startPage) {
      const header = text.search(/(?:구분\s+)?최초설정일\s+가입자격/);
      if (header >= 0) text = text.slice(header);
    }
    const end = text.search(/\(2\)\s*종류별\s*수수료|2\.\s*종류별\s*수수료/);
    if (end >= 0) {
      text = text.slice(0, end);
      finished = true;
    }
    chunks.push({ page: index + 1, text });
  }
  return chunks;
}

function tableRows(chunks) {
  let combined = '';
  const offsets = [];
  for (const chunk of chunks) {
    offsets.push({ offset: combined.length, page: chunk.page });
    combined += ` ${chunk.text}`;
  }
  const pageAt = (position) => {
    let page = offsets[0].page;
    for (const item of offsets) {
      if (item.offset > position) break;
      page = item.page;
    }
    return page;
  };
  const markers = [...combined.matchAll(/종류\s*(\*?[A-Za-z][A-Za-z0-9-]*)\s+(?=수수료|-\s)/g)];
  return markers.map((marker, index) => {
    const segment = combined.slice(marker.index + marker[0].length, markers[index + 1]?.index || combined.length);
    const dateMatch = segment.match(/(?:19|20)\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}/);
    return {
      label: marker[1],
      normalized: normalizeClass(marker[1]),
      date: dateMatch ? iso(dateMatch[0]) : null,
      status: dateMatch ? 'ESTABLISHED' : 'NOT_ESTABLISHED',
      page: pageAt(marker.index),
      evidence: `${marker[0].trim()} ${dateMatch ? dateMatch[0] : '-'}`,
    };
  });
}

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const miraeFunds = funds.filter((fund) => fund.company_name === '미래에셋자산운용');
  const miraeIds = new Set(miraeFunds.map((fund) => fund.fund_id));
  const targetClasses = classes.filter((row) => miraeIds.has(row.fund_id));
  const results = [];

  for (const fund of miraeFunds) {
    const document = documents.find((row) => row.doc_id === fund.source_doc_id);
    const fundClasses = targetClasses.filter((row) => row.fund_id === fund.fund_id);
    const pdfPath = path.join(pdfDir, document.file_name);
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), disableWorker: true }).promise;
    const pageTexts = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' '));
    }
    const section = tableSection(pageTexts);
    const rows = section ? tableRows(section) : [];

    for (const classRow of fundClasses) {
      const normalized = normalizeClass(classRow.class_name_raw);
      const matches = rows.filter((row) => row.normalized === normalized);
      let selected = matches[0] || null;
      let status = selected?.status || 'REVIEW_REQUIRED';
      let reason = selected ? '' : '종류형 구조의 가입자격 표에서 클래스 행을 찾지 못함';
      if (matches.length > 1 && new Set(matches.map((row) => `${row.date}|${row.status}`)).size > 1) {
        status = 'REVIEW_REQUIRED';
        reason = '동일 클래스명에서 서로 다른 설정일 또는 상태가 추출됨';
      }
      if (selected?.date && fund.inception_date && selected.date < fund.inception_date) {
        status = 'REVIEW_REQUIRED';
        reason = `클래스 설정일 ${selected.date}이 펀드 설정일 ${fund.inception_date}보다 빠름`;
      }
      results.push({
        file_name: document.file_name,
        company_name: fund.company_name,
        fund_id: fund.fund_id,
        fund_name: fund.fund_name_normalized,
        class_id: classRow.class_id,
        class_code: classRow.class_code,
        class_name: classRow.class_name_raw,
        class_inception_date: status === 'ESTABLISHED' ? selected.date : null,
        class_inception_status: status,
        source_page: selected?.page || null,
        source_text: selected?.evidence || null,
        reason,
      });
    }
  }

  const outputPath = path.join(validation, 'mirae_class_inception_extraction.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  const reviewRows = results.filter((row) => row.class_inception_status === 'REVIEW_REQUIRED');
  writeCsv(
    path.join(validation, 'class_inception_review.csv'),
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
