const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = 'NH-Amundi자산운용';
const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

const evidenceByFund = {
  FUND000027: { page: '5|6', date: '2014-09-01', classCode: 'AT976' },
  FUND000028: { page: '6', date: '2019-01-25', classCode: 'CJ521' },
  FUND000029: { page: '5', date: '2018-09-14', classCode: 'C8463' },
  FUND000030: { page: '6', date: '2019-08-14', classCode: 'C9950' },
};

const results = classes.filter((row) => companyIds.has(row.fund_id)).map((classRow) => {
  const fund = companyFunds.find((row) => row.fund_id === classRow.fund_id);
  const document = documents.find((row) => row.doc_id === fund.source_doc_id);
  const evidence = evidenceByFund[classRow.fund_id];
  const isDisclosedClass = classRow.class_code === evidence.classCode;
  const inceptionDate = isDisclosedClass ? evidence.date : null;
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
      ? `요약정보 연평균 수익률 표의 종류 C 최초설정일 ${inceptionDate}`
      : '요약정보는 종류 C의 최초설정일만 명시하며 해당 클래스의 개별 최초설정일은 공시하지 않음',
    reason: inceptionDate
      ? 'PDF 원문에 명시된 클래스 최초설정일을 적재'
      : '펀드 설정일과 종류 C의 날짜를 다른 클래스 최초설정일로 추정하지 않음',
  };
});

if (companyFunds.length !== 4 || results.length !== 67) throw new Error('Unexpected NH-Amundi scope');
const counts = results.reduce((acc, row) => {
  acc[row.class_inception_status] = (acc[row.class_inception_status] || 0) + 1;
  return acc;
}, {});
if (counts.ESTABLISHED !== 4 || counts.NOT_DISCLOSED !== 63) {
  throw new Error(`Unexpected NH-Amundi status counts: ${JSON.stringify(counts)}`);
}

const outputPath = path.join(validation, 'nh_amundi_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'nh_amundi_class_inception_review.csv'),
  ['file_name','company_name','fund_id','fund_name','class_id','class_code','class_name','source_page','source_text','reason'],
  [],
);
process.stdout.write(`${JSON.stringify({ output: outputPath, funds: 4, classes: 67, counts }, null, 2)}\n`);
