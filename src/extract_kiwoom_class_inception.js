const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '키움투자자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// Dates are transcribed only from the explicit 설정일 column in each PDF's
// performance table. A class omitted from that table stays NOT_DISCLOSED;
// fee-table presence, history dates, and neighboring class dates are not used.
const evidenceByFund = {
  FUND000080: {
    page: '3|32',
    dates: { '31638': '2001-02-23' },
  },
  FUND000081: {
    page: '40|41|42',
    dates: {
      AS325: '2014-08-13', AS326: '2014-05-13', B2588: '2016-01-20',
      BB609: '2016-03-15', BB610: '2016-03-15', BB611: '2016-03-15',
      BB612: '2018-09-21', BE012: '2018-02-09', BE013: '2016-06-08',
      DW245: '2022-10-25', DW246: '2022-10-27',
    },
  },
  FUND000082: {
    page: '39|40',
    dates: { CW278: '2019-09-20', CW279: '2019-11-06' },
  },
  FUND000083: {
    page: '39|40|41',
    dates: {
      BN895: '2017-12-15', BN896: '2017-12-15', BN897: '2017-12-15',
      BN898: '2017-12-15', BN899: '2024-08-21', BN900: '2017-12-13',
      BN901: '2018-09-19', BN902: '2017-12-21', BN903: '2018-04-03',
      BN904: '2023-09-12', C1127: '2017-12-15', C1128: '2018-06-25',
    },
  },
  FUND000084: {
    page: '49|50|51',
    dates: {
      A9257: '2012-04-09', A9796: '2012-04-09', A9258: '2012-04-09',
      A9259: '2012-04-09', A9261: '2012-04-19', AL731: '2013-12-02',
      AQ740: '2014-04-22', BI295: '2016-11-24', BV783: '2017-09-04',
      BV784: '2017-09-29', D3379: '2020-07-20',
    },
  },
  FUND000085: {
    page: '43|44|45',
    dates: {
      A3165: '2011-05-23', A3166: '2011-05-23', A3167: '2012-05-23',
      A3168: '2013-05-23', A3169: '2014-05-26', A3170: '2011-05-23',
      AQ735: '2014-07-28', AQ736: '2014-04-22', B4898: '2015-07-23',
      BU255: '2018-01-29', DD262: '2020-12-09', DD263: '2021-02-09',
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
        ? `운용실적 표의 클래스별 설정일 ${inceptionDate}`
        : '클래스는 가입자격·보수표에 있으나 운용실적 표의 클래스별 설정일 행에는 기재되지 않음',
      reason: inceptionDate
        ? '원문에 명시된 클래스별 설정일을 적재'
        : '펀드 설정일·연혁·인접 클래스 날짜로 추정하지 않고 원문 미공시로 유지',
    };
  });

if (results.length !== 63) {
  throw new Error(`Expected 63 Kiwoom classes, found ${results.length}`);
}
const counts = results.reduce((acc, row) => {
  acc[row.class_inception_status] = (acc[row.class_inception_status] || 0) + 1;
  return acc;
}, {});
if (counts.ESTABLISHED !== 49 || counts.NOT_DISCLOSED !== 14) {
  throw new Error(`Unexpected Kiwoom status counts: ${JSON.stringify(counts)}`);
}

const outputPath = path.join(validation, 'kiwoom_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'kiwoom_class_inception_review.csv'),
  ['file_name', 'company_name', 'fund_id', 'fund_name', 'class_id', 'class_code', 'class_name', 'source_page', 'source_text', 'reason'],
  results.filter((row) => row.class_inception_status === 'REVIEW_REQUIRED'),
);

process.stdout.write(`${JSON.stringify({ output: outputPath, classes: results.length, counts }, null, 2)}\n`);
