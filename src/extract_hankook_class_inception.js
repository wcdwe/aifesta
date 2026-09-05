const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '한국투자신탁운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// Each cited summary table explicitly identifies only the representative C class.
// The detailed performance tables state that their common "since inception" period
// is based on the first-created class, so that period must not be copied to others.
const evidenceByFund = {
  FUND000086: { page: '6', dates: { AQ443: '2001-01-31' } },
  FUND000087: { page: '6', dates: { AQ445: '2001-01-31' } },
  FUND000088: { page: '7', dates: { '88838': '2008-11-03' } },
  FUND000089: { page: '6', dates: { AQ448: '2001-01-31' } },
  FUND000090: { page: '7', dates: { '71772': '2007-07-23' } },
  FUND000091: { page: '6', dates: { '61287': '2006-10-23' } },
  FUND000092: { page: '6', dates: { BT578: '2006-01-02' } },
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
        ? `요약정보 연평균 수익률 표에서 종류 C의 최초설정일 ${inceptionDate} 확인`
        : '요약정보는 대표 C 클래스의 최초설정일만 명시하며, 다른 클래스의 개별 최초설정일은 공시하지 않음',
      reason: inceptionDate
        ? 'PDF 원문에 클래스 C의 최초설정일이 명시되어 적재'
        : '공통 설정일 이후 기간은 최초 설정된 종류 수익증권 기준이라는 원문 주석에 따라 개별 날짜로 추정하지 않음',
    };
  });

if (companyFunds.length !== 7 || results.length !== 58) {
  throw new Error(`Expected 7 funds and 58 classes, found ${companyFunds.length} funds and ${results.length} classes`);
}
const counts = results.reduce((acc, row) => {
  acc[row.class_inception_status] = (acc[row.class_inception_status] || 0) + 1;
  return acc;
}, {});
if (counts.ESTABLISHED !== 7 || counts.NOT_DISCLOSED !== 51 || counts.REVIEW_REQUIRED) {
  throw new Error(`Unexpected Korea Investment Management status counts: ${JSON.stringify(counts)}`);
}

const outputPath = path.join(validation, 'hankook_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'hankook_class_inception_review.csv'),
  ['file_name', 'company_name', 'fund_id', 'fund_name', 'class_id', 'class_code', 'class_name', 'source_page', 'source_text', 'reason'],
  results.filter((row) => row.class_inception_status === 'REVIEW_REQUIRED'),
);

process.stdout.write(`${JSON.stringify({ output: outputPath, funds: companyFunds.length, classes: results.length, counts }, null, 2)}\n`);
