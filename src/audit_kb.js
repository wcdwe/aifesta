const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {writeCsv} = require('./common/csv_writer');

const COMPANY = process.argv[2] || 'KB자산운용';
const AUDIT_STEM = process.argv[3] || (COMPANY === 'KB자산운용' ? 'kb' : COMPANY.replace(/[^A-Za-z0-9가-힣]+/g, '_').toLowerCase());
const KEY_PATTERNS = {
  class_codes: /한국금융투자협회\s*펀드코드/,
  fees: /총보수[·ㆍ]?\s*비용|보수 및 수수료에 관한 사항/,
  performance: /연평균\s*수익률/,
  annual_returns: /연도별\s*수익률/,
  aum: /자산총액|순자산총액/,
  benchmark: /비교지수/,
  inception: /설정일|최초설정일/
};

function compact(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function firstMatch(text, pattern) {
  const match = text.match(pattern);
  return match ? compact(match[1]) : null;
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const base = path.join(root, 'data', '투자설명서', COMPANY);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const files = fs.readdirSync(base).filter(file => file.toLowerCase().endsWith('.pdf')).sort();
  const documents = [];

  for (const file of files) {
    const buffer = fs.readFileSync(path.join(base, file));
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const data = new Uint8Array(buffer);
    const pdf = await pdfjs.getDocument({data, disableWorker: true}).promise;
    const pageTexts = [];
    const keyPages = Object.fromEntries(Object.keys(KEY_PATTERNS).map(key => [key, []]));
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      const text = compact(content.items.map(item => item.str).join(' '));
      pageTexts.push(text);
      for (const [key, pattern] of Object.entries(KEY_PATTERNS)) if (pattern.test(text)) keyPages[key].push(page);
    }
    const first = pageTexts[0];
    const normalizedFirst = first.replace(/\s+/g, '');
    const normalizedAll = pageTexts.join(' ').replace(/\s+/g, '');
    const fundCodeMatch = normalizedAll.match(/펀드코드[:：]?([A-Z0-9]{5})/);
    const riskMatch = normalizedFirst.match(/투자위험등급[:：]?(\d)등급/);
    documents.push({
      file_name: file,
      sha256,
      total_pages: pdf.numPages,
      fund_name: firstMatch(first, /집합투자기구\s*명칭\s*:\s*(.+?)\s+2\./),
      fund_code: fundCodeMatch ? fundCodeMatch[1] : null,
      document_date: firstMatch(normalizedFirst, /작성기준일:(\d{4}년\d{1,2}월\d{1,2}일)/),
      effective_date: firstMatch(normalizedFirst, /증권신고서효력발생일:(\d{4}년\d{1,2}월\d{1,2}일)/),
      risk_grade: riskMatch ? Number(riskMatch[1]) : null,
      key_pages: keyPages
    });
  }

  const groups = {};
  for (const document of documents) {
    const key = document.fund_code || document.fund_name || document.file_name;
    (groups[key] ||= []).push(document.file_name);
  }
  const audit = {
    company_name: COMPANY,
    generated_at: new Date().toISOString(),
    source_pdf_count: documents.length,
    unique_fund_group_count: Object.keys(groups).length,
    duplicate_fund_groups: Object.entries(groups).filter(([, names]) => names.length > 1).map(([key, file_names]) => ({key, file_names})),
    exact_duplicate_groups: Object.values(documents.reduce((result, document) => {
      (result[document.sha256] ||= {sha256:document.sha256, file_names:[]}).file_names.push(document.file_name);
      return result;
    }, {})).filter(group => group.file_names.length > 1),
    documents
  };
  const output = path.join(root, 'data', 'validation', `${AUDIT_STEM}_scan_audit.json`);
  fs.writeFileSync(output, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  if (COMPANY === 'KB자산운용') {
    const duplicateRows = audit.exact_duplicate_groups.flatMap((group, index) =>
      group.file_names.map(file_name => ({duplicate_group:`KB-${String(index + 1).padStart(3, '0')}`, file_name}))
    );
    const duplicateOutput = path.join(root, 'data', 'validation', 'duplicate_pdf_files.csv');
    writeCsv(duplicateOutput, ['duplicate_group', 'file_name'], duplicateRows);
  }
  console.log(JSON.stringify({output:path.relative(root, output), source_pdf_count:audit.source_pdf_count, unique_fund_group_count:audit.unique_fund_group_count, duplicate_fund_groups:audit.duplicate_fund_groups}, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
