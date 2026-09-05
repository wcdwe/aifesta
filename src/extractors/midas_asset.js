const path = require('path');

const COMPANY = '마이다스에셋자산운용';

// Values in this audited seed are transcribed only where the same value was
// confirmed in the visible PDF layout and its text layer. Blank means unknown.
const auditedDocuments = [
  {
    doc_id: 'DOC000001', fund_id: 'FUND000001', file_name: 'R2_KR5157420003.pdf',
    document_date: '2025-07-29', effective_date: '2025-09-05', total_pages: 67,
    fund: {
      fund_name_raw: '마이다스 우량채권 증권 자투자신탁 제1호(채권)',
      fund_name_normalized: '마이다스우량채권', fund_code: 'CK138',
      asset_type_l1: '채권형', asset_type_l2: '국내중기채', investment_region: '국내',
      investment_target: '국내 우량채권', risk_grade: 5, risk_grade_text: '5등급(낮은 위험)',
      benchmark: 'KIS 중단기지수(1-2Y)*55% + KIS 중기지수(2-3Y)*40% + Call 지수*5%',
      inception_date: '2019-07-30',
      fund_structure: '투자신탁|증권(채권형)|개방형|추가형|종류형|모자형 자투자신탁',
      source_page: '1|8|18|19|46',
      source_text: '[p.1] 집합투자기구 명칭: 마이다스 우량채권 증권 자투자신탁 제1호(채권); 투자위험등급: 5등급(낮은 위험) | [p.8] 펀드코드 CK138; 운용자산별 종류: 증권(채권형); 종류형·모자형 자투자신탁 | [p.18-19] 비교지수: KIS 중단기지수(1-2Y)*55% + KIS 중기지수(2-3Y)*40% + Call 지수*5%; 국내 우량채권 투자; 통상 기준 듀레이션 1.7년±0.5년 | [p.46] 운용 최초설정일 2019-07-30'
    }
  },
  {
    doc_id: 'DOC000002', fund_id: 'FUND000002', file_name: 'R2_KR5157450017.pdf',
    document_date: '2025-10-31', effective_date: '2025-11-13', total_pages: 67,
    fund: {
      fund_name_raw: '마이다스 책임투자 증권 투자신탁(주식)',
      fund_name_normalized: '마이다스책임투자', fund_code: '93983',
      asset_type_l1: '주식형', asset_type_l2: '국내주식', investment_region: '국내',
      investment_target: '국내 주식(ESG 책임투자)', risk_grade: 2, risk_grade_text: '2등급(높은 위험)',
      benchmark: 'KOSPI*100%', inception_date: '2009-04-20',
      fund_structure: '투자신탁|증권(주식형)|개방형|추가형|종류형',
      source_page: '1|4|8|17|46',
      source_text: '[p.1] 집합투자기구 명칭: 마이다스 책임투자 증권 투자신탁(주식); 투자위험등급: 2등급(높은 위험) | [p.4] 비교지수: KOSPI*100%; 최초설정일 2009-04-20 | [p.8] 펀드코드 93983; 운용자산별 종류: 증권(주식형); 종류형 | [p.17] 국내 주식 60% 이상; ESG 비재무적 요소를 반영한 책임투자 Universe'
    }
  },
  {
    doc_id: 'DOC000003', fund_id: 'FUND000003', file_name: 'R2_KR5157450090.pdf',
    document_date: '2025-10-01', effective_date: '2025-11-13', total_pages: 81,
    fund: {
      fund_name_raw: '마이다스 거북이90 증권 자투자신탁 1호(주식)',
      fund_name_normalized: '마이다스거북이90', fund_code: 'AL420',
      asset_type_l1: '주식형', asset_type_l2: '국내주식', investment_region: '국내',
      investment_target: '국내 주식형 및 채권형 모투자신탁', risk_grade: 4, risk_grade_text: '4등급(보통 위험)',
      benchmark: 'KOSPI*9% + 매경BP종합채권지수 국고채1-2Y*81% + [KIS중단기지수(1-2Y)*55% + KIS중기지수(2-3Y)*40% + Call지수*5%]*10%',
      inception_date: '2013-10-02',
      fund_structure: '투자신탁|증권(주식형)|개방형|추가형|종류형|모자형 자투자신탁',
      source_page: '1|4|8|23|60',
      source_text: '[p.1] 집합투자기구 명칭: 마이다스 거북이90 증권 자투자신탁 1호(주식); 투자위험등급: 4등급(보통 위험) | [p.4] 비교지수: KOSPI*9% + 매경BP종합채권지수 국고채1-2Y*81% + 복합 채권지수*10% | [p.8] 펀드코드 AL420; 운용자산별 종류: 증권(주식형); 종류형·모자형 자투자신탁 | [p.23] 주식형 모투자신탁 80% 이상, 채권형 모투자신탁 20% 이하 | [p.60] 운용 최초설정일 2013-10-02'
    }
  }
];

function extractPhase1(projectRoot, extractionDate) {
  const pdfRoot = path.join(projectRoot, 'data', '투자설명서', COMPANY);
  const documents = auditedDocuments.map(item => ({
    doc_id: item.doc_id, company_name: COMPANY, file_name: item.file_name,
    file_path: path.relative(projectRoot, path.join(pdfRoot, item.file_name)).replaceAll('\\', '/'),
    document_type: '투자설명서', document_date: item.document_date,
    effective_date: item.effective_date, fund_id: item.fund_id,
    total_pages: item.total_pages, extraction_date: extractionDate
  }));
  const funds = auditedDocuments.map(item => ({
    fund_id: item.fund_id, company_name: COMPANY,
    fund_name_raw: item.fund.fund_name_raw,
    fund_name_normalized: item.fund.fund_name_normalized,
    fund_code: item.fund.fund_code, management_company: '마이다스에셋자산운용주식회사',
    asset_type_l1: item.fund.asset_type_l1, asset_type_l2: item.fund.asset_type_l2,
    investment_region: item.fund.investment_region, investment_target: item.fund.investment_target,
    risk_grade: item.fund.risk_grade, risk_grade_text: item.fund.risk_grade_text,
    benchmark: item.fund.benchmark, volatility: null, inception_date: item.fund.inception_date,
    currency_hedge: null, fund_structure: item.fund.fund_structure,
    tdf_vintage: null, bond_duration_bucket: item.fund.asset_type_l1 === '채권형' ? '중기' : null,
    source_doc_id: item.doc_id, source_page: item.fund.source_page, source_text: item.fund.source_text
  }));
  return {documents, funds};
}

module.exports = {COMPANY, extractPhase1};
