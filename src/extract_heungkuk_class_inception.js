const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '흥국자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// Each date below is taken only from the class-specific "최초 설정일" column
// in the summary performance table. Dates are not inferred from fund history,
// fund-wide inception dates, or shared since-inception performance periods.
const evidenceByFund = {
  FUND000010: {
    page: '5',
    dates: {
      BB515: '2016-04-08',
      AF411: '2008-06-26',
      BT538: '2017-08-02',
      BT539: '2017-08-02',
    },
  },
  FUND000011: {
    page: '5',
    dates: {
      BT536: '2014-09-30',
      BT537: '2017-08-02',
    },
  },
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
        ? `요약정보 연평균 수익률 표의 클래스별 최초 설정일 ${inceptionDate}`
        : '요약정보 연평균 수익률 표에 대표 클래스만 수록되어 해당 클래스의 개별 최초 설정일은 공시되지 않음',
      reason: inceptionDate
        ? 'PDF 원문의 클래스별 최초 설정일 열에 명시된 날짜를 적재'
        : '펀드 전체 설정일과 다른 클래스의 날짜를 해당 클래스 최초설정일로 추정하지 않음',
    };
  });

if (companyFunds.length !== 2 || results.length !== 19) {
  throw new Error(`Expected 2 funds and 19 classes, found ${companyFunds.length} funds and ${results.length} classes`);
}
const counts = results.reduce((acc, row) => {
  acc[row.class_inception_status] = (acc[row.class_inception_status] || 0) + 1;
  return acc;
}, {});
if (counts.ESTABLISHED !== 6 || counts.NOT_DISCLOSED !== 13 || counts.REVIEW_REQUIRED) {
  throw new Error(`Unexpected Heungkuk status counts: ${JSON.stringify(counts)}`);
}

const outputPath = path.join(validation, 'heungkuk_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'heungkuk_class_inception_review.csv'),
  ['file_name', 'company_name', 'fund_id', 'fund_name', 'class_id', 'class_code', 'class_name', 'source_page', 'source_text', 'reason'],
  results.filter((row) => row.class_inception_status === 'REVIEW_REQUIRED'),
);

process.stdout.write(`${JSON.stringify({ output: outputPath, funds: companyFunds.length, classes: results.length, counts }, null, 2)}\n`);
