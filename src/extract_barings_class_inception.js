const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '베어링자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

const mappings = {
  FUND000008: {
    A: ['2016-08-29', 42],
    Ae: ['2016-08-31', 42],
    C1: ['2016-08-29', 42],
    C2: ['2017-08-29', 43],
    C3: ['2018-08-29', 43],
    C4: ['2019-08-29', 43],
    Ce: ['2016-08-31', 43],
    'C-W': ['2016-09-19', 43],
    'C-P': ['2016-11-28', 43],
    'C-P2': ['2016-09-07', 43],
    'C-Pe': ['2016-12-30', 43],
    'C-P2e': ['2017-08-02', 43],
  },
  FUND000009: {
    A: ['2002-04-02', 33],
    Ae: ['2014-03-10', 33],
    Ce: ['2014-03-10', 33],
    'C-I': ['2014-09-03', 33],
    'C-W': ['2014-04-28', 33],
    'C-P': ['2015-07-20', 33],
    'P-F': ['2015-07-20', 33],
    S: ['2014-04-22', 33],
    'S-P': ['2015-06-29', 33],
  },
};

const results = classes
  .filter((row) => companyIds.has(row.fund_id))
  .map((classRow) => {
    const fund = companyFunds.find((row) => row.fund_id === classRow.fund_id);
    const document = documents.find((row) => row.doc_id === fund.source_doc_id);
    const mapped = mappings[classRow.fund_id]?.[classRow.class_name_normalized];
    return {
      file_name: document.file_name,
      company_name: fund.company_name,
      fund_id: fund.fund_id,
      fund_name: fund.fund_name_normalized,
      class_id: classRow.class_id,
      class_code: classRow.class_code,
      class_name: classRow.class_name_raw,
      class_inception_date: mapped ? mapped[0] : null,
      class_inception_status: mapped ? 'ESTABLISHED' : 'NOT_DISCLOSED',
      source_page: mapped ? mapped[1] : '42|43',
      source_text: mapped
        ? `연평균 수익률 표: ${classRow.class_name_normalized} 최초설정일 ${mapped[0]}`
        : '클래스 목록에는 존재하지만 최초설정일이 기재된 성과표에는 해당 클래스 행이 없음',
      reason: mapped
        ? 'PDF의 클래스별 최초설정일 열에 날짜가 직접 명시됨'
        : '클래스 신설 여부나 펀드 최초설정일을 근거로 날짜 또는 미설정을 추정하지 않음',
    };
  });

const outputPath = path.join(validation, 'barings_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'barings_class_inception_review.csv'),
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
