const path=require('path');
const COMPANY='VIP자산운용';

function extractVipPhase1(root,extractionDate){
 const doc_id='DOC000016',fund_id='FUND000016',file='R2_KR514X450008.pdf';
 const base=path.join(root,'data','투자설명서',COMPANY);
 return {documents:[{doc_id,company_name:COMPANY,file_name:file,file_path:path.relative(root,path.join(base,file)).replaceAll('\\','/'),document_type:'투자설명서',document_date:'2022-12-31',effective_date:'2023-03-31',fund_id,total_pages:59,extraction_date:extractionDate}],funds:[{
  fund_id,company_name:COMPANY,fund_name_raw:'VIP한국형가치투자증권자투자신탁[주식]',fund_name_normalized:'VIP한국형가치투자증권자투자신탁',fund_code:'E1728',management_company:'㈜브이아이피자산운용',asset_type_l1:'주식형',asset_type_l2:'국내주식',investment_region:'국내',investment_target:'국내 가치주 및 안정적인 이익성장이 예상되는 종목에 투자하는 모투자신탁',risk_grade:2,risk_grade_text:'2등급(높은 위험)',benchmark:null,volatility:null,inception_date:'2023-04-03',currency_hedge:null,fund_structure:'투자신탁|증권(주식형)|개방형|추가형|종류형|모자형|성과연동운용보수형',tdf_vintage:null,bond_duration_bucket:null,source_doc_id:doc_id,source_page:'1|5|6|11|13|21|22|24',source_text:'[p.1] VIP한국형가치투자증권자투자신탁[주식]; 작성기준일 2022-12-31; 효력발생일 2023-03-31; 2등급(높은 위험) | [p.5] 국내 주식형 모투자신탁에 90% 이상 투자; 국내 가치주 및 안정적 이익성장 종목 | [p.11] 펀드코드 E1728; 성과연동운용보수형 | [p.13] 최초설정 예정일 2023-04-03 | [p.6] 신규펀드로 투자실적 해당사항 없음'
 }]};
}
module.exports={COMPANY,extractVipPhase1};
