const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = '신한자산운용';

const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));

// Only explicit class creation statements are treated as class inception dates.
// Fund-level inception dates, performance coverage periods, and class rename dates
// are deliberately not copied into the class-level field.
const explicitClassCreation = {
  FUND000038: {
    EF146: ['2024-09-13', '11', '집합투자기구 연혁에 "종류 C-i 수익증권 신설"이 직접 명시됨'],
  },
  FUND000041: {
    D6403: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 A1이 직접 명시됨'],
    D6404: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 A-e가 직접 명시됨'],
    D6406: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 A-g가 직접 명시됨'],
    D6405: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 C1이 직접 명시됨'],
    D6407: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 C-e가 직접 명시됨'],
    D6412: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 C-g가 직접 명시됨'],
    D6408: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 C-i가 직접 명시됨'],
    D6409: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 C-p가 직접 명시됨'],
    D6410: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 C-pe가 직접 명시됨'],
    D6411: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 C-w가 직접 명시됨'],
    D6413: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 S가 직접 명시됨'],
    D6414: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 S-P가 직접 명시됨'],
    D6415: ['2020-06-05', '11', '집합투자기구 연혁의 클래스 신설 목록에 종류 S-R이 직접 명시됨'],
  },
};

const undisclosedEvidence = {
  FUND000038: ['11|38|39', '펀드 최초설정일과 C-i 신설일만 기재되어 있으며 이 클래스의 최초설정일은 원문에 없음'],
  FUND000039: ['12|48|49', '펀드 신규설정일과 클래스별 성과는 기재되어 있으나 클래스별 최초설정일은 원문에 없음'],
  FUND000040: ['9|33|34', '펀드 최초설정일과 두 클래스의 성과는 기재되어 있으나 클래스별 최초설정일은 원문에 없음'],
  FUND000041: ['11|48|49', '2020-06-05에 기존 클래스를 현재 명칭으로 변경했다는 연혁만 있고 해당 클래스의 원래 최초설정일은 없음'],
};
const renamedClassCodes = new Set(['AN108', 'BT857', 'AN109']);

const results = classes
  .filter((row) => companyIds.has(row.fund_id))
  .map((classRow) => {
    const fund = companyFunds.find((row) => row.fund_id === classRow.fund_id);
    const document = documents.find((row) => row.doc_id === fund.source_doc_id);
    const creation = explicitClassCreation[classRow.fund_id]?.[classRow.class_code];
    const [fallbackPage, fallbackText] = undisclosedEvidence[classRow.fund_id] || [];
    if (!creation && !fallbackPage) {
      throw new Error(`Unclassified Shinhan class: ${classRow.fund_id} ${classRow.class_code} ${classRow.class_name_raw}`);
    }
    if (!creation && classRow.fund_id === 'FUND000041' && !renamedClassCodes.has(classRow.class_code)) {
      throw new Error(`Missing explicit 2020-06-05 creation mapping: ${classRow.class_code} ${classRow.class_name_raw}`);
    }
    return {
      file_name: document.file_name,
      company_name: fund.company_name,
      fund_id: fund.fund_id,
      fund_name: fund.fund_name_normalized,
      class_id: classRow.class_id,
      class_code: classRow.class_code,
      class_name: classRow.class_name_raw,
      class_inception_date: creation ? creation[0] : null,
      class_inception_status: creation ? 'ESTABLISHED' : 'NOT_DISCLOSED',
      source_page: creation ? creation[1] : fallbackPage,
      source_text: creation ? creation[2] : fallbackText,
      reason: creation
        ? 'PDF 연혁에 해당 클래스의 신설일이 직접 명시됨'
        : '펀드 설정일, 성과기간 또는 클래스 명칭 변경일을 최초설정일로 추정하지 않음',
    };
  });

if (results.length !== 47) {
  throw new Error(`Expected 47 Shinhan classes, found ${results.length}`);
}

const outputPath = path.join(validation, 'shinhan_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(
  path.join(validation, 'shinhan_class_inception_review.csv'),
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
