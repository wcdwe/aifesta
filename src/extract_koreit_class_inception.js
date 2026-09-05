const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '코레이트자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// Pages 40-41 explicitly provide a per-class 최초설정일 column.
const datesByCode = {
  BZ696: '2017-12-13',
  BZ697: '2018-02-06',
  BZ698: '2019-04-05',
  BZ699: '2017-12-13',
  BZ704: '2023-11-16',
  BZ702: '2018-06-29',
  BZ703: '2019-12-09',
  CD942: '2019-07-26',
  CD943: '2019-08-23',
  CD944: '2018-08-28',
  CD945: '2018-08-30',
  EB197: '2024-04-08',
  EB196: '2024-09-12',
  E8226: '2024-07-30',
};

const results = classes
  .filter((row) => companyIds.has(row.fund_id))
  .map((classRow) => {
    const fund = companyFunds.find((row) => row.fund_id === classRow.fund_id);
    const document = documents.find((row) => row.doc_id === fund.source_doc_id);
    const inceptionDate = datesByCode[classRow.class_code] || null;
    return {
      file_name: document.file_name,
      company_name: fund.company_name,
      fund_id: fund.fund_id,
      fund_name: fund.fund_name_normalized,
      class_id: classRow.class_id,
      class_code: classRow.class_code,
      class_name: classRow.class_name_raw,
      class_inception_date: inceptionDate,
      class_inception_status: inceptionDate ? 'ESTABLISHED' : 'REVIEW_REQUIRED',
      source_page: '40|41',
      source_text: inceptionDate
        ? `운용실적 표의 클래스별 최초설정일 ${inceptionDate}`
        : '운용실적 표에서 해당 클래스 코드의 최초설정일을 대응하지 못함',
      reason: inceptionDate
        ? '원문에 명시된 클래스별 최초설정일을 적재'
        : '14개 클래스 코드와 날짜 매핑 재확인 필요',
    };
  });

if (results.length !== 14) {
  throw new Error(`Expected 14 Koreit classes, found ${results.length}`);
}
if (results.some((row) => row.class_inception_status !== 'ESTABLISHED')) {
  throw new Error('Every Koreit class must map to an explicit inception date');
}

const outputPath = path.join(validation, 'koreit_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'koreit_class_inception_review.csv'),
  ['file_name', 'company_name', 'fund_id', 'fund_name', 'class_id', 'class_code', 'class_name', 'source_page', 'source_text', 'reason'],
  results.filter((row) => row.class_inception_status === 'REVIEW_REQUIRED'),
);

process.stdout.write(`${JSON.stringify({
  output: outputPath,
  classes: results.length,
  counts: results.reduce((acc, row) => {
    acc[row.class_inception_status] = (acc[row.class_inception_status] || 0) + 1;
    return acc;
  }, {}),
}, null, 2)}\n`);
