const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '우리자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// These dates are transcribed only from the explicit per-class "설정일" column
// in the performance tables. Classes omitted from that column remain
// NOT_DISCLOSED; history dates, fee-table presence, and neighboring class dates
// are not used as substitutes.
const evidenceByFund = {
  FUND000076: {
    page: '52|53',
    dates: {
      '48779': '2005-04-27',
      'B4949': '2015-06-22',
      'BP334': '2017-09-18',
      '59042': '2006-08-04',
      'E8606': '2024-03-20',
      'CK371': '2019-03-08',
      '63114': '2006-12-15',
      'AE960': '2015-06-24',
      'BB898': '2016-04-14',
      'B9535': '2015-12-09',
      'BU024': '2017-08-17',
      'AO985': '2014-04-22',
      'AW579': '2014-11-10',
      'BU025': '2017-09-11',
      'B1602': '2015-04-14',
      'D9392': '2020-08-27',
    },
  },
  FUND000077: {
    page: '44|45',
    dates: {
      'EA910': '2024-05-08',
      'EA911': '2024-05-20',
      'EA912': '2024-05-08',
      'EA913': '2024-05-08',
      'EA914': '2024-05-08',
      'EA915': '2024-04-22',
      'EA916': '2024-04-22',
      'EA917': '2024-08-02',
      'EA918': '2024-06-20',
      'EA919': '2024-05-20',
      'EA920': '2024-05-23',
      'EA922': '2024-06-21',
      'EA923': '2025-01-31',
      'EA924': '2024-05-08',
      'EA925': '2024-06-20',
    },
  },
  FUND000078: {
    page: '54|55',
    dates: {
      '98749': '2011-01-17',
      '98750': '2011-01-17',
      'BJ308': '2017-01-19',
      'BJ311': '2017-01-18',
      'CC031': '2018-10-15',
      'CC033': '2018-10-02',
      'CC034': '2018-12-26',
      'CC032': '2018-08-16',
      'BJ312': '2016-12-13',
      'CC321': '2018-07-18',
      'D4450': '2020-08-05',
    },
  },
  FUND000079: {
    page: '44',
    dates: {
      'BB039': '2016-03-16',
      'BF762': '2016-08-10',
      'BB040': '2016-04-21',
      'BP340': '2018-06-08',
      'BB021': '2016-03-16',
      'BB022': '2016-04-19',
      'BP341': '2017-06-09',
      'BH601': '2016-09-07',
      'BB025': '2017-04-10',
      'BU014': '2017-08-29',
      'BB024': '2017-02-13',
      'BB026': '2017-02-02',
      'BU015': '2017-10-20',
      'D9389': '2024-12-16',
      'D9390': '2024-12-13',
      'D9391': '2020-09-04',
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
        : '연혁·펀드 설정일·인접 클래스 날짜로 추정하지 않고 원문 미공시로 유지',
    };
  });

if (results.length !== 64) {
  throw new Error(`Expected 64 Woori classes, found ${results.length}`);
}

const outputPath = path.join(validation, 'woori_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'woori_class_inception_review.csv'),
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
