const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '유진자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// Page 5 explicitly labels Class C's date as 최초설정일. Other classes appear
// in fee/performance tables, and some have amendment-history "신설" dates, but
// the PDF does not disclose their actual class setting dates. Amendment dates
// and common since-inception periods are therefore not substituted.
const results = classes
  .filter((row) => companyIds.has(row.fund_id))
  .map((classRow) => {
    const fund = companyFunds.find((row) => row.fund_id === classRow.fund_id);
    const document = documents.find((row) => row.doc_id === fund.source_doc_id);
    const isClassC = classRow.class_code === 'AX803';
    return {
      file_name: document.file_name,
      company_name: fund.company_name,
      fund_id: fund.fund_id,
      fund_name: fund.fund_name_normalized,
      class_id: classRow.class_id,
      class_code: classRow.class_code,
      class_name: classRow.class_name_raw,
      class_inception_date: isClassC ? '2014-12-04' : null,
      class_inception_status: isClassC ? 'ESTABLISHED' : 'NOT_DISCLOSED',
      source_page: isClassC ? '5' : '5|13|14|15|51|52|53|54',
      source_text: isClassC
        ? '요약정보 투자실적 추이 표에 Class C 최초설정일 2014-12-04 명시'
        : '클래스 목록·연혁·성과행은 있으나 실제 클래스별 최초설정일 열은 없음',
      reason: isClassC
        ? '원문에 명시된 클래스 최초설정일을 적재'
        : '연혁의 수익증권 신설일과 공통 성과기간을 실제 설정일로 추정하지 않고 원문 미공시로 유지',
    };
  });

if (results.length !== 19) {
  throw new Error(`Expected 19 Eugene classes, found ${results.length}`);
}

const outputPath = path.join(validation, 'eugene_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'eugene_class_inception_review.csv'),
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
