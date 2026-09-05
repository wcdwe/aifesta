const path=require('path');

const classes=[
 ['A','61853',.1,.4,.03,.014,.544,.5717,.9,0],
 ['A-e','BW530',.1,.2,.03,.014,.344,.372,.45,0],
 ['A-H','73952',.1,.39,.03,.014,.534,.5599,.9,0],
 ['C','61287',.1,1,.03,.014,1.144,1.1716,0,0],
 ['C-e','62270',.1,.5,.03,.014,.644,.6717,0,0],
 ['C-F','99928',.1,.03,.03,.014,.174,.174,0,0],
 ['C-P','AJ114',.1,.49,.03,.014,.634,.6615,0,0],
 ['C-Pe','AU008',.1,.245,.03,.014,.389,.4167,0,0],
 ['C-W','EB377',.1,0,.03,.014,.144,.144,0,0],
 ['S','AP483',.1,.19,.03,.014,.334,.361,0,.15],
 ['S-P','AP485',.1,.147,.03,.014,.291,.3169,0,0],
];

const benchmark=[70.77,37.65,24.57,13.95,6.42];
const perf=[
 ['C-Pe',[75.21,41.28,27.47,16.48,9.50],[70.77,37.65,24.57,13.95,7.16]],
 ['A-e',[75.29,41.34,27.52,16.53,9.83],[70.77,37.65,24.57,13.95,7.43]],
 ['A-H',[74.99,41.08,27.29,16.32,6.41],[70.77,37.65,24.57,13.95,4.96]],
 ['C',[74.00,40.25,26.53,15.62,7.20],benchmark],
 ['A',[74.96,41.06,27.27,16.30,7.85],[70.77,37.65,24.57,13.95,6.37]],
 ['C-e',[74.80,40.93,27.15,16.19,7.68],[70.77,37.65,24.57,13.95,6.30]],
 ['S',[75.34,41.38,27.56,16.56,9.16],[70.77,37.65,24.57,13.95,7.16]],
 ['S-P',[75.38,41.41,27.59,16.59,9.17],[70.77,37.65,24.57,13.95,7.16]],
 ['C-P',[74.82,40.94,27.17,16.20,8.98],[70.77,37.65,24.57,13.95,7.37]],
];

function extractHankookSixthPhase1(root,date){
 const name='한국투자 인덱스플러스 증권 투자신탁 1호(주식-파생형)',file='R2_KR5113470030.pdf';
 return{
  documents:[{doc_id:'DOC000093',company_name:'한국투자신탁운용',file_name:file,file_path:path.relative(root,path.join(root,'data','투자설명서','한국투자신탁운용',file)).replaceAll('\\','/'),document_type:'투자설명서',document_date:'2025-10-31',effective_date:'2025-12-04',fund_id:'FUND000091',total_pages:80,extraction_date:date}],
  funds:[{fund_id:'FUND000091',company_name:'한국투자신탁운용',fund_name_raw:name,fund_name_normalized:name.replaceAll(' ',''),fund_code:'61288',management_company:'한국투자신탁운용주식회사',asset_type_l1:'주식형',asset_type_l2:'인덱스·주식파생형',investment_region:'국내',investment_target:'국내 주식 및 주식관련 장내파생상품에 60% 이상 투자하여 KOSPI200 지수 수익률 추종',risk_grade:2,risk_grade_text:'2등급(높은 위험)',benchmark:'KOSPI 200 100%',volatility:37.33,inception_date:'2006-10-23',currency_hedge:null,fund_structure:'투자신탁|증권(주식파생형)|개방형|추가형|종류형',tdf_vintage:null,bond_duration_bucket:null,source_doc_id:'DOC000093',source_page:'1|5|10|12|17|22|28|37|38|54|55|57',source_text:'[p.1,5,10,12,17,22,28,37-38,54-55,57] 코드 61288; 위험 2등급; 97.5% VaR 37.33%; 비교지수 KOSPI 200 100%'}]
 };
}

function account(n){if(n==='C-P'||n==='C-Pe'||n==='S-P')return '연금저축';if(n==='A-H')return '주택마련';return '일반';}
function channel(n){if(n==='S'||n==='S-P')return '온라인슈퍼';if(n==='A-e'||n==='C-e'||n==='C-Pe')return '온라인';if(n==='C-W')return '랩';if(n==='C-F')return '기관';return '오프라인';}
function extractHankookSixthClasses(){return classes.map((r,i)=>{const[n,code,m,s,t,a,total,expense,front,back]=r;return{class_id:`CLASS${String(1058+i).padStart(6,'0')}`,fund_id:'FUND000091',class_code:code,class_name_raw:n,class_name_normalized:n,account_type:account(n),channel:channel(n),front_load:front,back_load:back,management_fee:m,sales_fee:s,trust_fee:t,admin_fee:a,total_fee:total,total_expense_ratio:expense,source_doc_id:'DOC000093',source_page:'10|12|37|38',source_text:`[p.10,12,37-38] ${n}; 코드 ${code}; 총보수 ${total}%; 총보수·비용 ${expense}%`};});}
function extractHankookSixthPerformance(){const ps=['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],ids=new Map(classes.map((r,i)=>[r[0],`CLASS${String(1058+i).padStart(6,'0')}`])),out=[];for(const[n,v,b]of perf)v.forEach((x,i)=>out.push({class_id:ids.get(n),fund_id:'FUND000091',period:ps[i],return_pct:x,benchmark_return_pct:b[i],as_of_date:'2025-10-31',source_doc_id:'DOC000093',source_page:'54|55',source_text:`[p.54-55] ${n}; ${ps[i]} ${x}%; 비교지수 ${b[i]}%`}));return out;}

module.exports={extractHankookSixthPhase1,extractHankookSixthClasses,extractHankookSixthPerformance};
