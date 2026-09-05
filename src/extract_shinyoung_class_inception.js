const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '신영자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// Dates are taken only from the class-specific "최초설정일" columns.
// In FUND000033, the malformed annual-average table is not used for the five
// shifted rows; their dates come from the correctly aligned annual-return table.
const established = {
  FUND000032: {
    '67752': ['2007-04-17', 43], AV245: ['2014-09-01', 43], BP302: ['2017-05-24', 43],
    '37179': ['2003-05-26', 43], '67753': ['2007-04-17', 43], '95031': ['2009-06-10', 43],
    A3467: ['2013-10-28', 43], AA844: ['2012-05-18', 43], AH141: ['2013-04-03', 44],
    BG622: ['2016-08-31', 44], BP304: ['2017-06-02', 43], CT172: ['2019-08-14', 44],
    CT173: ['2019-08-14', 44], DZ491: ['2022-12-21', 44], DZ492: ['2022-12-21', 44],
    DZ493: ['2022-12-22', 44],
  },
  FUND000033: {
    D3668: ['2020-04-02', 44], D3669: ['2020-04-14', 44], '34301': ['2002-04-25', 43],
    '78553': ['2008-01-22', 43], BP317: ['2017-05-26', 44], '52805': ['2005-11-30', 43],
    '99957': ['2011-01-19', 43], AH142: ['2013-04-08', 43], BE093: ['2016-08-31', 43],
    BC028: ['2016-04-07', 43], BT895: ['2017-08-02', 43], DZ488: ['2022-12-21', 44],
    DZ489: ['2022-12-21', 44], DZ490: ['2022-12-22', 44],
  },
};

const notDisclosed = { FUND000033: { D3670: 44 } };

const results = classes
  .filter((row) => companyIds.has(row.fund_id))
  .map((classRow) => {
    const fund = companyFunds.find((row) => row.fund_id === classRow.fund_id);
    const document = documents.find((row) => row.doc_id === fund.source_doc_id);
    const hit = established[classRow.fund_id]?.[classRow.class_code];
    const page = hit?.[1] ?? notDisclosed[classRow.fund_id]?.[classRow.class_code];
    if (page === undefined) {
      throw new Error(`Unclassified Shinyoung class: ${classRow.fund_id} ${classRow.class_code} ${classRow.class_name_raw}`);
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
        ? `연평균 또는 연도별 수익률 표의 클래스별 최초설정일 ${hit[0]}`
        : '클래스는 보수표에 존재하지만 클래스별 성과표와 최초설정일 행은 기재되지 않음',
      reason: hit
        ? 'PDF의 해당 클래스 최초설정일 열에 날짜가 직접 명시됨'
        : '다른 클래스 또는 펀드 설정일을 추정하여 대입하지 않음',
    };
  });

if (results.length !== 31) {
  throw new Error(`Expected 31 Shinyoung classes, found ${results.length}`);
}

const outputPath = path.join(validation, 'shinyoung_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'shinyoung_class_inception_review.csv'),
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
