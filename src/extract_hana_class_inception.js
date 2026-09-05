const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '하나자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// Transcribe only dates explicitly printed in the 최초설정일 column of the
// annual-return tables. History/creation dates and the fund inception date are
// not used as substitutes when a class is absent from those tables.
const evidenceByFund = {
  FUND000034: {
    page: '49|50',
    dates: {
      BB854: '2016-04-18',
      BJ474: '2017-01-09',
      BL292: '2017-02-06',
      BB855: '2007-04-17',
      BL294: '2017-02-06',
      BH500: '2016-09-22',
      BL297: '2017-01-31',
      BL299: '2017-02-16',
      BB856: '2016-03-16',
      BO901: '2017-09-06',
      CP065: '2019-06-25',
    },
  },
  FUND000035: {
    page: '56|57',
    dates: {
      '68415': '2007-05-03',
      BM910: '2017-05-18',
      AG643: '2013-04-02',
      '68416': '2007-05-03',
      '96115': '2010-10-18',
      '96118': '2010-10-18',
      '96120': '2010-10-18',
      '96157': '2011-05-04',
      BM911: '2017-05-19',
      '93725': '2016-11-14',
      BM912: '2017-05-22',
      BM913: '2017-04-11',
      BM914: '2017-07-18',
      BM915: '2017-11-28',
      BP497: '2017-06-27',
      BP498: '2017-11-03',
      C8312: '2018-05-29',
      C9652: '2020-02-14',
      D4932: '2020-06-29',
    },
  },
};

const results = classes
  .filter((row) => companyIds.has(row.fund_id))
  .map((classRow) => {
    const fund = companyFunds.find((row) => row.fund_id === classRow.fund_id);
    const document = documents.find((row) => row.doc_id === fund.source_doc_id);
    const evidence = evidenceByFund[classRow.fund_id];
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
        ? `연평균 수익률 표의 클래스별 최초설정일 ${inceptionDate}`
        : '가입자격·보수표에는 있으나 연평균 수익률 표에 클래스 최초설정일이 기재되지 않음',
      reason: inceptionDate
        ? 'PDF 원문에 명시된 클래스별 최초설정일을 적재'
        : '펀드 설정일·연혁·인접 클래스 날짜를 추정하지 않고 원문 미공시로 유지',
    };
  });

if (results.length !== 33) {
  throw new Error(`Expected 33 Hana classes, found ${results.length}`);
}
const counts = results.reduce((acc, row) => {
  acc[row.class_inception_status] = (acc[row.class_inception_status] || 0) + 1;
  return acc;
}, {});
if (counts.ESTABLISHED !== 30 || counts.NOT_DISCLOSED !== 3) {
  throw new Error(`Unexpected Hana status counts: ${JSON.stringify(counts)}`);
}

const outputPath = path.join(validation, 'hana_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'hana_class_inception_review.csv'),
  ['file_name', 'company_name', 'fund_id', 'fund_name', 'class_id', 'class_code', 'class_name', 'source_page', 'source_text', 'reason'],
  results.filter((row) => row.class_inception_status === 'REVIEW_REQUIRED'),
);

process.stdout.write(`${JSON.stringify({ output: outputPath, classes: results.length, counts }, null, 2)}\n`);
