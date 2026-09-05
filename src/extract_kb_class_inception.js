const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = 'KB자산운용';
const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// KB summary tables disclose one representative class inception date per fund.
// Detailed class performance tables contain returns but no inception-date column,
// so dates for all other classes remain explicitly NOT_DISCLOSED.
const evidenceByFund = {
  FUND000021: { page: '4', dates: { A8183: '2003-12-31' } },
  FUND000022: { page: '5', dates: { B5556: '2015-08-20' } },
  FUND000023: { page: '5', dates: { BG608: '2016-09-07' } },
  FUND000024: { page: '4', dates: { '18455': '2010-01-05' } },
  FUND000025: { page: '5', dates: { BD845: '2016-05-17' } },
  FUND000026: { page: '5', dates: { EG177: '2024-11-05' } },
};

const results = classes.filter((row) => companyIds.has(row.fund_id)).map((classRow) => {
  const fund = companyFunds.find((row) => row.fund_id === classRow.fund_id);
  const document = documents.find((row) => row.doc_id === fund.source_doc_id);
  const evidence = evidenceByFund[classRow.fund_id];
  if (!evidence) throw new Error(`Missing evidence configuration for ${classRow.fund_id}`);
  const inceptionDate = evidence.dates[classRow.class_code] || null;
  return {
    file_name: document.file_name,
    company_name: fund.company_name,
    fund_id: fund.fund_id,
    fund_name: fund.fund_name_normalized,
    class_id: classRow.class_id,
    class_code: classRow.class_code,
    class_name: classRow.class_name_raw,
    class_inception_date: inceptionDate,
    class_inception_status: inceptionDate ? 'ESTABLISHED' : 'NOT_DISCLOSED',
    source_page: evidence.page,
    source_text: inceptionDate
      ? `요약정보 투자실적추이 표의 대표 클래스 최초설정일 ${inceptionDate}`
      : '요약정보는 대표 클래스 한 건만 최초설정일을 명시하며 해당 클래스의 개별 날짜는 공시하지 않음',
    reason: inceptionDate
      ? 'PDF 원문의 클래스별 최초설정일 열에 명시된 날짜를 적재'
      : '펀드 설정일, 대표 클래스 날짜, 수익률 존재 여부로 개별 클래스 날짜를 추정하지 않음',
  };
});

if (companyFunds.length !== 6 || results.length !== 90) {
  throw new Error(`Expected 6 funds and 90 classes, found ${companyFunds.length} funds and ${results.length} classes`);
}
const counts = results.reduce((acc, row) => {
  acc[row.class_inception_status] = (acc[row.class_inception_status] || 0) + 1;
  return acc;
}, {});
if (counts.ESTABLISHED !== 6 || counts.NOT_DISCLOSED !== 84 || counts.REVIEW_REQUIRED) {
  throw new Error(`Unexpected KB status counts: ${JSON.stringify(counts)}`);
}

const outputPath = path.join(validation, 'kb_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'kb_class_inception_review.csv'),
  ['file_name', 'company_name', 'fund_id', 'fund_name', 'class_id', 'class_code', 'class_name', 'source_page', 'source_text', 'reason'],
  results.filter((row) => row.class_inception_status === 'REVIEW_REQUIRED'),
);
process.stdout.write(`${JSON.stringify({ output: outputPath, funds: companyFunds.length, classes: results.length, counts }, null, 2)}\n`);
