const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');
const { writeCsv } = require('./common/csv_writer');
const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const companyName = 'KCGI자산운용';
const documents = readCsv(path.join(processed, 'documents.csv'));
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const companyFunds = funds.filter((fund) => fund.company_name === companyName);
const companyIds = new Set(companyFunds.map((fund) => fund.fund_id));
const evidenceByFund = {
  FUND000006: { page: '42', status: 'NOT_ESTABLISHED', dates: {} },
  FUND000007: { page: '5', status: 'NOT_DISCLOSED', dates: { AJ438: '2013-07-08' } },
};
const results = classes.filter((row) => companyIds.has(row.fund_id)).map((classRow) => {
  const fund = companyFunds.find((row) => row.fund_id === classRow.fund_id);
  const document = documents.find((row) => row.doc_id === fund.source_doc_id);
  const evidence = evidenceByFund[classRow.fund_id];
  const inceptionDate = evidence.dates[classRow.class_code] || null;
  const status = inceptionDate ? 'ESTABLISHED' : evidence.status;
  return {
    file_name: document.file_name, company_name: fund.company_name, fund_id: fund.fund_id,
    fund_name: fund.fund_name_normalized, class_id: classRow.class_id, class_code: classRow.class_code,
    class_name: classRow.class_name_raw, class_inception_date: inceptionDate, class_inception_status: status,
    source_page: evidence.page,
    source_text: inceptionDate ? `요약정보 연평균 수익률 표의 종류 A 최초설정일 ${inceptionDate}`
      : status === 'NOT_ESTABLISHED' ? '재무정보, 설정·환매현황, 운용실적 및 자산구성 현황이 모두 신규설정으로 해당사항 없음'
        : '요약정보는 종류 A의 최초설정일만 명시하며 해당 클래스의 개별 최초설정일은 공시하지 않음',
    reason: inceptionDate ? 'PDF 원문에 명시된 클래스 최초설정일을 적재'
      : status === 'NOT_ESTABLISHED' ? '작성기준일 현재 신규설정 전 상태가 원문에 명시되어 날짜를 NULL로 유지'
        : '펀드 설정일과 다른 클래스의 날짜를 해당 클래스 최초설정일로 추정하지 않음',
  };
});
if (companyFunds.length !== 2 || results.length !== 33) throw new Error('Unexpected KCGI scope');
const counts = results.reduce((acc, row) => { acc[row.class_inception_status] = (acc[row.class_inception_status] || 0) + 1; return acc; }, {});
if (counts.ESTABLISHED !== 1 || counts.NOT_DISCLOSED !== 20 || counts.NOT_ESTABLISHED !== 12) throw new Error(`Unexpected KCGI status counts: ${JSON.stringify(counts)}`);
const outputPath = path.join(validation, 'kcgi_class_inception_extraction.json');
fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
writeCsv(path.join(validation, 'kcgi_class_inception_review.csv'), ['file_name','company_name','fund_id','fund_name','class_id','class_code','class_name','source_page','source_text','reason'], []);
process.stdout.write(`${JSON.stringify({ output: outputPath, funds: 2, classes: 33, counts }, null, 2)}\n`);
