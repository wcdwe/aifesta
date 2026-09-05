const path=require('path');
const classes=[
 ['A','88837',.15,.21,.02,.011,.391,.3934,.02,0],['A1','E1702',.15,.13,.02,.011,.311,.3134,.1,0],
 ['A-e','BV952',.15,.105,.02,.011,.286,.2885,.01,0],['A-G','BV953',.15,.147,.02,.011,.328,.328,.014,0],
 ['C','88838',.15,.23,.02,.011,.411,.4134,0,0],['C-e','88839',.15,.15,.02,.011,.331,.3334,0,0],
 ['C-F','88861',.15,.03,.02,.011,.211,.2134,0,0],['C-G','BV954',.15,.16,.02,.011,.341,.341,0,0],
 ['C-P','CH625',.15,.225,.02,.011,.406,.4084,0,0],['C-Pe','CH626',.15,.113,.02,.011,.294,.2964,0,0],
 ['C-R','BV956',.15,.22,.02,.011,.401,.4034,0,0],['C-Re','BV957',.15,.11,.02,.011,.291,.2935,0,0],
 ['C-W','BV958',.15,0,.02,.011,.181,.1834,0,0],['S','AP094',.15,.10,.02,.011,.281,.2834,0,.15],
 ['S-P','CH638',.15,.09,.02,.011,.271,.2734,0,0],['S-R','D1885',.15,.08,.02,.011,.261,.2633,0,0],
];
const b=[2.66,3.47,3.80,2.46];
const perf=[
 ['C-F',[3.54,5.36,6.43,3.71,3.18],[...b,2.06]],['A-e',[3.46,5.29,6.35,3.63,3.32],[...b,2.27]],
 ['C-R',[3.34,5.17,6.23,3.51,3.21],[...b,2.27]],['C-W',[3.57,5.40,6.47,3.74,3.43],[...b,2.27]],
 ['C-Re',[3.45,5.28,6.35,3.62,3.30],[...b,2.25]],['S-P',[3.47,5.30,6.37,3.64,3.34],[...b,2.27]],
 ['C-P',[3.34,5.16,6.23,3.51,3.20],[...b,2.27]],['C-Pe',[3.45,5.28,6.35,3.62,3.32],[...b,2.27]],
 ['S-R',[3.48,5.31,6.38,3.66,3.46],[...b,2.30]],['S',[3.46,5.29,6.36,3.63,3.04],[...b,2.38]],
 ['A1',[3.43,5.26,null,null,5.29],[2.66,3.47,null,null,3.40]],['A',[3.35,5.17,6.24,3.52,3.51],[...b,3.42]],
 ['C',[3.33,5.15,6.22,3.50,3.49],[...b,3.42]],['C-e',[3.41,5.24,6.31,3.58,3.55],[...b,3.42]],
];
function extractHankookThirdPhase1(root,date){const name='한국투자 크레딧포커스 ESG 증권 자투자신탁 1호(채권)',file='R2_KR5113420069.pdf';return{documents:[{doc_id:'DOC000090',company_name:'한국투자신탁운용',file_name:file,file_path:path.relative(root,path.join(root,'data','투자설명서','한국투자신탁운용',file)).replaceAll('\\','/'),document_type:'투자설명서',document_date:'2025-11-28',effective_date:'2026-01-06',fund_id:'FUND000088',total_pages:88,extraction_date:date}],funds:[{fund_id:'FUND000088',company_name:'한국투자신탁운용',fund_name_raw:name,fund_name_normalized:name.replaceAll(' ',''),fund_code:'88828',management_company:'한국투자신탁운용주식회사',asset_type_l1:'채권형',asset_type_l2:'ESG크레딧',investment_region:'국내',investment_target:'한국투자 크레딧포커스 ESG 증권 모투자신탁(채권)에 60% 이상 투자; 모펀드는 A등급 이상 크레딧 채권 60% 이상, ESG 상위 3개 등급 채권 50% 이상 투자',risk_grade:5,risk_grade_text:'5등급(낮은 위험)',benchmark:'KOBI120지수 100%',volatility:1.57,inception_date:'2008-11-03',currency_hedge:null,fund_structure:'투자신탁|증권(채권형)|개방형|추가형|종류형|모자형',tdf_vintage:null,bond_duration_bucket:null,source_doc_id:'DOC000090',source_page:'1|6|11|13|32|42|43|61|62|64',source_text:'[p.1,6,11,13,32,42-43,61-62,64] 코드 88828; 위험 5등급; 97.5% VaR 1.57%; 비교지수 KOBI120지수 100%'}]};}
function account(n){if(n.endsWith('-R')||n==='C-R'||n==='C-Re')return '퇴직연금';if(n.endsWith('-P')||n==='C-P'||n==='C-Pe')return '연금저축';return '일반';}
function channel(n){if(n==='S'||n.startsWith('S-'))return '온라인슈퍼';if(n.endsWith('-e')||n.endsWith('Pe')||n.endsWith('Re'))return '온라인';if(n==='C-W')return '랩';if(n==='C-F')return '기관';return '오프라인';}
function extractHankookThirdClasses(){return classes.map((r,i)=>{const[n,code,m,s,t,a,total,expense,front,back]=r;return{class_id:`CLASS${String(1024+i).padStart(6,'0')}`,fund_id:'FUND000088',class_code:code,class_name_raw:n,class_name_normalized:n,account_type:account(n),channel:channel(n),front_load:front,back_load:back,management_fee:m,sales_fee:s,trust_fee:t,admin_fee:a,total_fee:total,total_expense_ratio:expense,source_doc_id:'DOC000090',source_page:'11|13|41|42|43',source_text:`[p.11,13,41-43] ${n}; 코드 ${code}; 총보수 ${total}%; 총보수·비용 ${expense}%`};});}
function extractHankookThirdPerformance(){const ps=['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],ids=new Map(classes.map((r,i)=>[r[0],`CLASS${String(1024+i).padStart(6,'0')}`])),out=[];for(const[n,v,bm]of perf)v.forEach((x,i)=>{if(x!==null)out.push({class_id:ids.get(n),fund_id:'FUND000088',period:ps[i],return_pct:x,benchmark_return_pct:bm[i],as_of_date:'2025-11-28',source_doc_id:'DOC000090',source_page:'61|62',source_text:`[p.61-62] ${n}; ${ps[i]} ${x}%; 비교지수 ${bm[i]}%`});});return out;}
module.exports={extractHankookThirdPhase1,extractHankookThirdClasses,extractHankookThirdPerformance};
