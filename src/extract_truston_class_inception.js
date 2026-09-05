const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '트러스톤자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// Only the explicit 설정일 column in the annual-return table is transcribed.
// The fund inception date shown in parentheses for C1 and class creation dates
// in the history section are not substituted for an undisclosed class date.
const evidenceByFund = {
  FUND000014: {
    page: '37|38',
    dates: {
      '85268': '2008-06-26',
      BZ217: '2017-12-04',
      '85269': '2024-12-02',
      '94047': '2010-01-25',
      '94048': '2011-06-27',
      '94069': '2012-06-27',
      '95187': '2009-06-02',
      '94308': '2009-10-06',
      '18879': '2010-04-12',
      AP789: '2014-04-22',
      BR052: '2017-06-05',
      BR053: '2017-06-09',
      '24712': '2010-03-12',
      BU118: '2017-08-07',
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
        ? `연평균 수익률 표의 클래스별 설정일 ${inceptionDate}`
        : '가입자격·보수표에는 있으나 연평균 수익률 표에 클래스 설정일이 기재되지 않음',
      reason: inceptionDate
        ? 'PDF 원문에 명시된 클래스별 설정일을 적재'
        : '펀드 최초설정일·연혁·인접 클래스 날짜를 추정하지 않고 원문 미공시로 유지',
    };
  });

if (results.length !== 18) {
  throw new Error(`Expected 18 Truston classes, found ${results.length}`);
}
const counts = results.reduce((acc, row) => {
  acc[row.class_inception_status] = (acc[row.class_inception_status] || 0) + 1;
  return acc;
}, {});
if (counts.ESTABLISHED !== 14 || counts.NOT_DISCLOSED !== 4) {
  throw new Error(`Unexpected Truston status counts: ${JSON.stringify(counts)}`);
}

const outputPath = path.join(validation, 'truston_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'truston_class_inception_review.csv'),
  ['file_name', 'company_name', 'fund_id', 'fund_name', 'class_id', 'class_code', 'class_name', 'source_page', 'source_text', 'reason'],
  results.filter((row) => row.class_inception_status === 'REVIEW_REQUIRED'),
);

process.stdout.write(`${JSON.stringify({ output: outputPath, classes: results.length, counts }, null, 2)}\n`);
