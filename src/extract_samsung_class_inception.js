const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '삼성자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// Only class-specific dates printed under the PDF's "설정일이후" column are used.
// Fund-level inception dates and neighboring class dates are never copied to a class.
const established = {
  FUND000046: {
    CJ763: ['2019-02-12', 52], CJ971: ['2019-02-08', 53], '48770': ['2005-04-26', 54],
    BH562: ['2020-02-04', 55], '99055': ['2024-05-30', 56], BC057: ['2016-07-14', 57],
    BT466: ['2017-08-02', 58], A6073: ['2012-10-22', 59], BT467: ['2017-08-02', 60],
    '59289': ['2006-08-17', 61], '60091': ['2006-09-11', 62], BC058: ['2016-04-15', 63],
    BC059: ['2016-08-09', 64], BC060: ['2016-08-09', 65], D1337: ['2020-02-20', 66],
    D0664: ['2020-01-28', 67],
  },
  FUND000047: { BH083: ['2001-02-07', 47], BH088: ['2017-08-10', 48], BH089: ['2016-08-29', 49] },
  FUND000048: {
    AF706: ['2016-03-31', 49], CS233: ['2019-07-30', 49], AF707: ['2015-10-02', 50],
    CS234: ['2019-07-26', 51], B6619: ['2015-08-17', 52], AH838: ['2013-05-09', 53],
    BS810: ['2019-02-11', 54], D6126: ['2021-01-27', 55], D6124: ['2021-01-20', 56],
    BC911: ['2017-07-31', 57], BW455: ['2018-11-15', 58], D0670: ['2020-02-14', 59],
  },
  FUND000049: { BV572: ['2005-12-30', 40], BV573: ['2017-08-17', 40] },
  FUND000050: { BG693: ['2008-12-30', 51], BG694: ['2016-08-31', 52], BG766: ['2020-08-05', 53] },
  FUND000051: { BU598: ['2006-03-28', 38], BU599: ['2017-08-22', 39], D4482: ['2020-06-08', 40] },
};

const notDisclosedPages = {
  FUND000046: { BO969: 55, BO970: 55, BZ273: 61 },
  FUND000048: { AF708: 53, B5228: 53, D6125: 55, AF705: 59 },
  FUND000049: { BV574: 41 },
  FUND000051: { BU600: 40 },
};

const results = classes
  .filter((row) => companyIds.has(row.fund_id))
  .map((classRow) => {
    const fund = companyFunds.find((row) => row.fund_id === classRow.fund_id);
    const document = documents.find((row) => row.doc_id === fund.source_doc_id);
    const hit = established[classRow.fund_id]?.[classRow.class_code];
    const page = hit?.[1] ?? notDisclosedPages[classRow.fund_id]?.[classRow.class_code];
    if (page === undefined) {
      throw new Error(`Unclassified Samsung class: ${classRow.fund_id} ${classRow.class_code} ${classRow.class_name_raw}`);
    }
    return {
      file_name: document.file_name,
      company_name: fund.company_name,
      fund_id: fund.fund_id,
      fund_name: fund.fund_name_normalized,
      class_id: classRow.class_id,
      class_code: classRow.class_code,
      class_name: classRow.class_name_raw,
      class_inception_date: hit ? hit[0] : null,
      class_inception_status: hit ? 'ESTABLISHED' : 'NOT_DISCLOSED',
      source_page: page,
      source_text: hit
        ? `클래스별 연평균수익률 표의 설정일이후 기간 시작일 ${hit[0]}`
        : '클래스별 연평균수익률 항목이 해당사항 없음이거나 별도 날짜 행이 기재되지 않음',
      reason: hit
        ? 'PDF의 해당 클래스 설정일이후 열에 시작일이 직접 명시됨'
        : '펀드 또는 인접 클래스 날짜를 추정하여 대입하지 않음',
    };
  });

const outputPath = path.join(validation, 'samsung_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'samsung_class_inception_review.csv'),
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
