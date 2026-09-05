const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = 'DB자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// Only dates printed in the class-specific "최초설정일" column are loaded.
// Fund-wide dates, benchmark dates, and class history are not substitutes.
const evidenceByFund = {
  FUND000004: {
    page: '36',
    dates: {
      BS761: '2017-08-07',
      BS762: '2017-12-13',
      BS763: '2017-08-07',
      BS764: '2018-11-16',
      BS766: '2017-07-19',
      BS768: '2020-12-02',
      BT508: '2020-05-20',
      BT428: '2017-11-07',
      BT509: '2019-02-08',
      BT429: '2017-08-09',
    },
  },
  FUND000005: {
    page: '33|34',
    dates: {
      BF440: '2019-04-03',
      BF441: '2016-07-26',
      BF442: '2020-04-16',
      BF444: '2016-06-29',
      BT427: '2022-12-20',
      DW268: '2023-01-13',
      DW270: '2022-11-14',
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
        ? `운용실적 표의 클래스별 최초설정일 ${inceptionDate}`
        : '운용실적 표에 해당 클래스 행이 없어 개별 최초설정일이 공시되지 않음',
      reason: inceptionDate
        ? 'PDF 원문의 클래스별 최초설정일 열에 명시된 날짜를 적재'
        : '펀드 설정일이나 다른 클래스의 날짜를 해당 클래스 최초설정일로 추정하지 않음',
    };
  });

if (companyFunds.length !== 2 || results.length !== 24) {
  throw new Error(`Expected 2 funds and 24 classes, found ${companyFunds.length} funds and ${results.length} classes`);
}
const counts = results.reduce((acc, row) => {
  acc[row.class_inception_status] = (acc[row.class_inception_status] || 0) + 1;
  return acc;
}, {});
if (counts.ESTABLISHED !== 17 || counts.NOT_DISCLOSED !== 7 || counts.REVIEW_REQUIRED) {
  throw new Error(`Unexpected DB status counts: ${JSON.stringify(counts)}`);
}

const outputPath = path.join(validation, 'db_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'db_class_inception_review.csv'),
  ['file_name', 'company_name', 'fund_id', 'fund_name', 'class_id', 'class_code', 'class_name', 'source_page', 'source_text', 'reason'],
  results.filter((row) => row.class_inception_status === 'REVIEW_REQUIRED'),
);

process.stdout.write(`${JSON.stringify({ output: outputPath, funds: companyFunds.length, classes: results.length, counts }, null, 2)}\n`);
