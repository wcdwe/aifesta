const path=require('path');
const classes=[
 ['A','71771',.526,.73,.03,.014,1.3,1.302,.5,0],['A1','AJ473',.526,.23,.03,.014,.8,.8019,1,0],
 ['A-e','AJ496',.526,.11,.03,.014,.68,.6819,.5,0],['A-G','BP224',.526,.51,.03,.014,1.08,1.08,.5,0],
 ['C','71772',.526,1,.03,.014,1.57,1.5719,0,0],['C-e','71773',.526,.43,.03,.014,1,1.002,0,0],
 ['C-F','AB720',.526,.03,.03,.014,.6,.6028,0,0],['C-G','BP226',.526,.7,.03,.014,1.27,1.2702,0,0],
 ['C-P','AH289',.526,.95,.03,.014,1.52,1.5219,0,0],['C-Pe','AU047',.526,.475,.03,.014,1.045,1.047,0,0],
 ['C-R','BM035',.526,.63,.03,.014,1.2,1.2019,0,0],['C-Re','BT748',.526,.315,.03,.014,.885,.8872,0,0],
 ['C-W','A8858',.526,0,.03,.014,.57,.572,0,0],['S','AQ501',.526,.35,.03,.014,.92,.9215,0,.15],
 ['S-P','AQ502',.526,.28,.03,.014,.85,.8518,0,0],
];
const common=[15.91,8,5.42,6.32];
const perf=[
 ['A-e',[28.46,21.28,15.38,13.88,7.59],[...common,3.78]],['S',[28.17,21,15.10,13.61,7.17],[...common,3.69]],
 ['S-P',[28.25,21.08,15.18,13.69,7.26],[...common,3.69]],['A',[27.70,20.55,14.67,13.18,6.97],[...common,2.22]],
 ['C',[27.37,20.23,14.37,12.88,6.63],[...common,2.22]],['C-e',[28.07,20.90,15.01,13.52,7.31],[...common,2.22]],
 ['C-W',[28.60,21.41,15.50,14,5.48],[...common,2.17]],['C-R',[27.82,20.67,14.78,13.30,7.09],[...common,3.75]],
 ['A1',[28.32,21.14,15.25,13.75,6.84],[...common,3.30]],['C-G',[27.74,20.59,14.71,13.22,6.08],[...common,2.77]],
 ['C-Pe',[28.01,20.85,14.96,13.47,6.62],[...common,3.03]],['C-F',[24.71,11.66,7.63,7.80,4.71],[.26,.13,.09,.06,-2.05]],
 ['C-Re',[28.21,21.04,15.14,13.65,6.32],[...common,2.71]],['C-P',[27.43,20.29,14.42,12.94,7.04],[...common,3.83]],
];
function extractHankookFifthPhase1(root,date){const name='한국투자 중소밸류 증권 자투자신탁(주식)',file='R2_KR5113450401.pdf';return{documents:[{doc_id:'DOC000092',company_name:'한국투자신탁운용',file_name:file,file_path:path.relative(root,path.join(root,'data','투자설명서','한국투자신탁운용',file)).replaceAll('\\','/'),document_type:'투자설명서',document_date:'2025-08-29',effective_date:'2025-09-30',fund_id:'FUND000090',total_pages:86,extraction_date:date}],funds:[{fund_id:'FUND000090',company_name:'한국투자신탁운용',fund_name_raw:name,fund_name_normalized:name.replaceAll(' ',''),fund_code:'71774',management_company:'한국투자신탁운용주식회사',asset_type_l1:'주식형',asset_type_l2:'중소형가치주',investment_region:'국내',investment_target:'한국투자 중소밸류 증권 모투자신탁(주식)에 60% 이상 투자; 모펀드는 국내 중소형 가치주에 60% 이상 투자',risk_grade:3,risk_grade_text:'3등급(다소 높은 위험)',benchmark:'중소형지수수익률 90% + CD금리 10%',volatility:29.11,inception_date:'2007-07-23',currency_hedge:null,fund_structure:'투자신탁|증권(주식형)|개방형|추가형|종류형|모자형',tdf_vintage:null,bond_duration_bucket:null,source_doc_id:'DOC000092',source_page:'1|6|11|13|31|32|42|43|61|62|64',source_text:'[p.1,6,11,13,31-32,42-43,61-62,64] 코드 71774; 위험 3등급; 97.5% VaR 29.11%; 비교지수 중소형지수 90% + CD금리 10%'}]};}
function account(n){if(n==='C-R'||n==='C-Re')return '퇴직연금';if(n==='C-P'||n==='C-Pe'||n==='S-P')return '연금저축';return '일반';}
function channel(n){if(n==='S'||n==='S-P')return '온라인슈퍼';if(n==='A-e'||n==='C-e'||n==='C-Pe'||n==='C-Re')return '온라인';if(n==='C-W')return '랩';if(n==='C-F')return '기관';return '오프라인';}
function extractHankookFifthClasses(){return classes.map((r,i)=>{const[n,code,m,s,t,a,total,expense,front,back]=r;return{class_id:`CLASS${String(1043+i).padStart(6,'0')}`,fund_id:'FUND000090',class_code:code,class_name_raw:n,class_name_normalized:n,account_type:account(n),channel:channel(n),front_load:front,back_load:back,management_fee:m,sales_fee:s,trust_fee:t,admin_fee:a,total_fee:total,total_expense_ratio:expense,source_doc_id:'DOC000092',source_page:'11|13|41|42|43',source_text:`[p.11,13,41-43] ${n}; 코드 ${code}; 총보수 ${total}%; 총보수·비용 ${expense}%`};});}
function extractHankookFifthPerformance(){const ps=['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],ids=new Map(classes.map((r,i)=>[r[0],`CLASS${String(1043+i).padStart(6,'0')}`])),out=[];for(const[n,v,b]of perf)v.forEach((x,i)=>out.push({class_id:ids.get(n),fund_id:'FUND000090',period:ps[i],return_pct:x,benchmark_return_pct:b[i],as_of_date:'2025-08-29',source_doc_id:'DOC000092',source_page:'61|62',source_text:`[p.61-62] ${n}; ${ps[i]} ${x}%; 비교지수 ${b[i]}%`}));return out;}
module.exports={extractHankookFifthPhase1,extractHankookFifthClasses,extractHankookFifthPerformance};
