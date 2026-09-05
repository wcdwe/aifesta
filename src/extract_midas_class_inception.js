const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '마이다스에셋자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

const mappings = {
  FUND000001: {
    A: ['2019-07-30', 46],
    Ae: ['2019-08-01', 46],
    C: ['2019-07-30', 46],
    Ce: ['2019-07-30', 46],
    'C-P1': ['2019-08-22', 47],
    'C-Pe1': ['2019-10-21', 47],
    'C-P2': ['2020-08-27', 47],
    'C-Pe2': ['2019-09-04', 47],
    'C-F': ['2020-05-14', 47],
    S: ['2019-11-19', 47],
    'S-P': ['2019-10-29', 47],
    'C-W': ['2020-08-21', 47],
    A2: ['2020-08-26', 48],
    'C-I': ['2021-05-26', 48],
    'C-I2': ['2021-12-24', 48],
  },
  FUND000002: {
    A1: ['2009-04-20', 47],
    Ae: ['2014-06-11', 48],
    C1: ['2015-07-24', 47],
    C2: ['2010-04-21', 47],
    C3: ['2018-02-28', 47],
    C4: ['2012-04-23', 47],
    Ce: ['2009-04-20', 47],
    'C-F': ['2017-10-18', 47],
    'C-W': ['2017-11-15', 48],
    'C-P1': ['2016-01-19', 48],
    'C-Pe1': ['2017-10-18', 48],
    'C-P2': ['2016-06-27', 48],
    'C-Pe2': ['2017-08-07', 48],
    S: ['2014-04-23', 48],
    'S-P': ['2016-06-30', 48],
  },
  FUND000003: {
    A: ['2013-10-02', 60],
    Ae: ['2013-10-24', 60],
    C1: ['2013-10-02', 60],
    C2: ['2014-10-02', 61],
    C3: ['2015-10-02', 61],
    C4: ['2016-10-10', 61],
    Ce: ['2013-11-08', 61],
    'C-F': ['2018-04-20', 62],
    'C-W': ['2013-12-10', 61],
    'C-P1': ['2023-11-01', 61],
    'C-Pe1': ['2023-01-19', 62],
    'C-P2': ['2024-05-28', 62],
    'C-Pe2': ['2023-01-19', 62],
    S: ['2016-07-05', 61],
    'S-P': ['2016-07-05', 61],
    'S-R': ['2022-12-05', 62],
    AG: ['2025-06-25', 61],
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
      source_page: mapped ? mapped[1] : classRow.fund_id === 'FUND000002' ? '47|48' : '60|62',
      source_text: mapped
        ? `연평균 수익률 표: ${classRow.class_name_normalized} 최초설정일 ${mapped[0]}`
        : '클래스 목록에는 존재하지만 최초설정일이 기재된 성과표에는 해당 클래스 행이 없음',
      reason: mapped
        ? 'PDF의 클래스별 최초설정일 열에 날짜가 직접 명시됨'
        : '연혁의 클래스 신설일을 실제 최초설정일로 추정하지 않고 원문 미공시로 보존',
    };
  });

const outputPath = path.join(validation, 'midas_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'midas_class_inception_review.csv'),
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
