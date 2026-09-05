const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '한화자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// The summary performance table explicitly labels only class A with a first
// establishment date. Fund-wide performance periods and class-creation history
// are retained as context but are not promoted to class inception dates.
const evidenceByFund = {
  FUND000036: { page: '7', dates: { '92354': '2006-03-06' } },
  FUND000037: { page: '7', dates: { '89962': '2008-10-28' } },
};

const results = classes
  .filter((row) => companyIds.has(row.fund_id))
  .map((classRow) => {
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
        ? `요약정보 연평균 수익률 표에서 종류 A의 최초설정일 ${inceptionDate} 확인`
        : '요약정보는 대표 A 클래스의 최초설정일만 명시하며 다른 클래스의 개별 최초설정일은 공시하지 않음',
      reason: inceptionDate
        ? 'PDF 원문에 클래스 A의 최초설정일이 명시되어 적재'
        : '펀드 전체 성과기간과 클래스 신설 연혁을 개별 클래스 최초설정일로 추정하지 않음',
    };
  });

if (companyFunds.length !== 2 || results.length !== 34) {
  throw new Error(`Expected 2 funds and 34 classes, found ${companyFunds.length} funds and ${results.length} classes`);
}
const counts = results.reduce((acc, row) => {
  acc[row.class_inception_status] = (acc[row.class_inception_status] || 0) + 1;
  return acc;
}, {});
if (counts.ESTABLISHED !== 2 || counts.NOT_DISCLOSED !== 32 || counts.REVIEW_REQUIRED) {
  throw new Error(`Unexpected Hanwha status counts: ${JSON.stringify(counts)}`);
}

const outputPath = path.join(validation, 'hanwha_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'hanwha_class_inception_review.csv'),
  ['file_name', 'company_name', 'fund_id', 'fund_name', 'class_id', 'class_code', 'class_name', 'source_page', 'source_text', 'reason'],
  results.filter((row) => row.class_inception_status === 'REVIEW_REQUIRED'),
);

process.stdout.write(`${JSON.stringify({ output: outputPath, funds: companyFunds.length, classes: results.length, counts }, null, 2)}\n`);
