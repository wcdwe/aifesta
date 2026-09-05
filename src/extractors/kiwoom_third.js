const path = require('path');

const classes = [
  ['C', 'CW278', 0.15, 0.20, 0.02, 0, 0.37, 0.3821],
  ['C-e', 'CW279', 0.15, 0.10, 0.02, 0, 0.27, 0.2820],
  ['C-I', 'D0998', 0.15, 0.05, 0.02, 0, 0.22, 0.2200],
];

const performance = [
  ['C', [7.24, 5.93, 3.06, 1.65, 2.65], [7.26, 5.61, 3.04, 1.67, 1.45]],
  ['C-e', [7.35, 6.04, 3.17, 1.75, 1.85], [7.26, 5.61, 3.04, 1.67, 1.76]],
];

function extractKiwoomThirdPhase1(root, extractionDate) {
  const fundName = '키움파이어니어ESG증권자투자신탁제1호[채권]';
  const fileName = 'R2_KR5123420039.pdf';
  return {
    documents: [{
      doc_id: 'DOC000084', company_name: '키움투자자산운용', file_name: fileName,
      file_path: path.relative(root, path.join(root, 'data', '투자설명서', '키움투자자산운용', fileName)).replaceAll('\\', '/'),
      document_type: '투자설명서', document_date: '2025-01-19', effective_date: '2025-02-13',
      fund_id: 'FUND000082', total_pages: 55, extraction_date: extractionDate,
    }],
    funds: [{
      fund_id: 'FUND000082', company_name: '키움투자자산운용', fund_name_raw: fundName,
      fund_name_normalized: fundName.replaceAll(' ', ''), fund_code: '53657',
      management_company: '키움투자자산운용 주식회사', asset_type_l1: '채권형', asset_type_l2: 'ESG채권',
      investment_region: '국내', investment_target: '키움 ESG 증권 모투자신탁[채권]에 자산총액의 90% 이상 투자',
      risk_grade: 5, risk_grade_text: '5등급(낮은 위험)', benchmark: 'KAP종합채권 100%', volatility: 8.2,
      inception_date: '2006-01-13', currency_hedge: null,
      fund_structure: '투자신탁|증권(채권형)|개방형|추가형|모자형|종류형',
      tdf_vintage: null, bond_duration_bucket: null, source_doc_id: 'DOC000084',
      source_page: '1|4|11|12|25|31|39|40',
      source_text: '[p.1,4,11-12,25,31,39-40] 코드 53657; 위험 5등급; 97.5% VaR 8.2%; 비교지수 KAP종합채권 100%; 펀드 연혁상 최초설정일 2006-01-13',
    }],
  };
}

function extractKiwoomThirdClasses() {
  return classes.map((row, index) => {
    const [name, classCode, managementFee, salesFee, trustFee, adminFee, totalFee, totalExpenseRatio] = row;
    return {
      class_id: `CLASS${String(965 + index).padStart(6, '0')}`, fund_id: 'FUND000082', class_code: classCode,
      class_name_raw: name, class_name_normalized: name, account_type: '퇴직연금',
      channel: name === 'C-e' ? '온라인' : name === 'C-I' ? '기관' : '오프라인',
      front_load: 0, back_load: 0, management_fee: managementFee, sales_fee: salesFee,
      trust_fee: trustFee, admin_fee: adminFee, total_fee: totalFee, total_expense_ratio: totalExpenseRatio,
      source_doc_id: 'DOC000084', source_page: '11|12|31',
      source_text: `[p.11-12,31] ${name}; 코드 ${classCode}; 총보수 ${totalFee}%; 총보수·비용 ${totalExpenseRatio}%`,
    };
  });
}

function extractKiwoomThirdPerformance() {
  const periods = ['1Y', '2Y', '3Y', '5Y', 'SINCE_INCEPTION'];
  const classIds = new Map(classes.map((row, index) => [row[0], `CLASS${String(965 + index).padStart(6, '0')}`]));
  const rows = [];
  for (const [name, returns, benchmarks] of performance) {
    returns.forEach((value, index) => rows.push({
      class_id: classIds.get(name), fund_id: 'FUND000082', period: periods[index], return_pct: value,
      benchmark_return_pct: benchmarks[index], as_of_date: '2025-01-19', source_doc_id: 'DOC000084', source_page: 39,
      source_text: `[p.39] ${name}; ${periods[index]} ${value}%; 비교지수 ${benchmarks[index]}%`,
    }));
  }
  return rows;
}

module.exports = {extractKiwoomThirdPhase1, extractKiwoomThirdClasses, extractKiwoomThirdPerformance};
