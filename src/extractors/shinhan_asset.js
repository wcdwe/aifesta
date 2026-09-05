const path=require('path');
const COMPANY='신한자산운용';
function extractShinhanPhase1(root,extractionDate){
 const specs=[
  ['DOC000040','FUND000038','R2_KR5117420097.pdf','2025-08-07','2025-08-14',55,'신한초단기채증권투자신탁[채권]','신한초단기채증권투자신탁','EB483','채권형','국내초단기채','만기가 짧은 채권 등에 주로 투자하고 목표 잔존만기를 90일~180일로 운용',5,'5등급(낮은 위험)','KAP CALL 100%',.12,'2024-05-24','투자신탁|증권형(채권형)|개방형|추가형|종류형','초단기','1|4|9|11|38'],
  ['DOC000041','FUND000039','R2_KR5119450058.pdf','2025-02-14','2025-02-21',64,'신한코리아롱숏증권자투자신탁[주식]','신한코리아롱숏증권자투자신탁','AO420','주식형','국내롱숏','국내 주식 롱포지션과 주식차입매도·파생상품 등 숏포지션을 병행하며 일반적으로 순주식 노출 0~30% 운용',3,'3등급(다소 높은 위험)',null,7.45,'2014-02-05','투자신탁|증권형(주식형)|개방형|추가형|종류형|모자형',null,'1|5|11|12|48|49'],
  ['DOC000042','FUND000040','R2_KR5119501001.pdf','2025-08-07','2025-08-14',50,'신한퇴직연금국공채증권자투자신탁[채권]','신한퇴직연금국공채증권자투자신탁','56941','채권형','국내국공채','국채·통안채·공사채·지방채 등 국공채 중심의 신한단기국공채증권모투자신탁에 주로 투자',5,'5등급(낮은 위험)','KBP국공채(1-1.5년) 95% + 콜금리 5%',.98,'2006-05-18','투자신탁|증권형(채권형)|개방형|추가형|종류형|모자형','단기','1|4|9|10|33'],
  ['DOC000043','FUND000041','R2_KR5119520012.pdf','2025-02-20','2025-02-27',65,'신한상대가치장기증권자투자신탁[채권]','신한상대가치장기증권자투자신탁','54373','채권형','국내중장기채','상대가치종합채권 모펀드를 중심으로 ESG 중장기채권 모펀드를 일부 편입하여 국내 채권에 투자',5,'5등급(낮은 위험)','매경BP종합채권지수 95% + 콜금리 5%',2.60,'2006-02-01','투자신탁|증권형(채권형)|개방형|추가형|종류형|모자형','장기','1|4|9|11|48|49']
 ];
 const documents=[],funds=[];
 for(const s of specs){const[doc_id,fund_id,file_name,document_date,effective_date,total_pages,raw,norm,code,l1,l2,target,grade,gradeText,benchmark,volatility,inception,structure,duration,pages]=s;documents.push({doc_id,company_name:COMPANY,file_name,file_path:path.relative(root,path.join(root,'data','투자설명서',COMPANY,file_name)).replaceAll('\\','/'),document_type:'투자설명서',document_date,effective_date,fund_id,total_pages,extraction_date:extractionDate});funds.push({fund_id,company_name:COMPANY,fund_name_raw:raw,fund_name_normalized:norm,fund_code:code,management_company:'신한자산운용(주)',asset_type_l1:l1,asset_type_l2:l2,investment_region:'국내',investment_target:target,risk_grade:grade,risk_grade_text:gradeText,benchmark,volatility,inception_date:inception,currency_hedge:null,fund_structure:structure,tdf_vintage:null,bond_duration_bucket:duration,source_doc_id:doc_id,source_page:pages,source_text:`[p.1] 작성기준일 ${document_date}; 효력발생일 ${effective_date}; ${gradeText} | [p.5] 펀드코드 ${code}; ${target}; 비교지수 ${benchmark??'없음'} | [p.12] 최초 설정 ${inception} | [p.48-49] 설정일 이후 수익률 변동성 ${volatility}%`});}
 return {documents,funds};
}
module.exports={COMPANY,extractShinhanPhase1};
