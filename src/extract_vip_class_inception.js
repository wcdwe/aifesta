const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = 'VIP자산운용';
const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

const results = classes.filter((row) => companyIds.has(row.fund_id)).map((classRow) => {
  const fund = companyFunds.find((row) => row.fund_id === classRow.fund_id);
  const document = documents.find((row) => row.doc_id === fund.source_doc_id);
  return {
    file_name: document.file_name,
    company_name: fund.company_name,
    fund_id: fund.fund_id,
    fund_name: fund.fund_name_normalized,
    class_id: classRow.class_id,
    class_code: classRow.class_code,
    class_name: classRow.class_name_raw,
    class_inception_date: null,
    class_inception_status: 'NOT_ESTABLISHED',
    source_page: '11|13',
    source_text: '16개 클래스와 펀드코드를 열거하고, 펀드 최초설정 예정일을 2023-04-03으로 명시; 작성기준일 현재 신규펀드로 운용실적 해당사항 없음',
    reason: '예정일을 실제 클래스 최초설정일로 적재하지 않고, 문서 작성 시점의 미설정 상태를 NULL과 상태값으로 보존',
  };
});

if (companyFunds.length !== 1 || results.length !== 16) throw new Error('Unexpected VIP scope');
if (results.some((row) => row.class_inception_status !== 'NOT_ESTABLISHED' || row.class_inception_date !== null)) {
  throw new Error('Unexpected VIP class inception result');
}

const outputPath = path.join(validation, 'vip_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'vip_class_inception_review.csv'),
  ['file_name','company_name','fund_id','fund_name','class_id','class_code','class_name','source_page','source_text','reason'],
  [],
);
process.stdout.write(`${JSON.stringify({ output: outputPath, funds: 1, classes: 16, counts: { NOT_ESTABLISHED: 16 } }, null, 2)}\n`);
