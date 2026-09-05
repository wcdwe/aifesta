const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '디에스자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

const results = classes
  .filter((row) => companyIds.has(row.fund_id))
  .map((classRow) => {
    const fund = companyFunds.find((row) => row.fund_id === classRow.fund_id);
    const document = documents.find((row) => row.doc_id === fund.source_doc_id);
    const isCe = classRow.class_name_normalized === 'C-e';
    return {
      file_name: document.file_name,
      company_name: fund.company_name,
      fund_id: fund.fund_id,
      fund_name: fund.fund_name_normalized,
      class_id: classRow.class_id,
      class_code: classRow.class_code,
      class_name: classRow.class_name_raw,
      class_inception_date: isCe ? '2023-07-12' : null,
      class_inception_status: isCe ? 'ESTABLISHED' : 'NOT_DISCLOSED',
      source_page: isCe ? 4 : 50,
      source_text: isCe
        ? '투자실적 추이 표: 수수료미징구-온라인형(C-e) 최초설정일 23.07.12'
        : '연평균 수익률 표에 클래스별 최초설정일 열이 없고 해당 클래스의 날짜가 별도로 공시되지 않음',
      reason: isCe
        ? 'PDF에 클래스 최초설정일이 명시됨'
        : '펀드 최초설정일 2023-07-12를 클래스 최초설정일로 추정하여 복사하지 않음',
    };
  });

const outputPath = path.join(validation, 'ds_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'ds_class_inception_review.csv'),
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
