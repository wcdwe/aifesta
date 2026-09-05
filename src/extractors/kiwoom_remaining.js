const path=require('path');

const smartClasses=[
 ['A1','A9257',.4,.4,.03,.015,.845,.847,.8,0],['A-e','A9796',.4,.2,.03,.015,.645,.6469,.4,0],
 ['C1','A9258',.4,.8,.03,.015,1.245,1.2468,0,0],['C-e','A9259',.4,.4,.03,.015,.845,.8468,0,0],
 ['C-F','A9260',.4,.03,.03,.015,.475,.475,0,0],['C-W','A9261',.4,.1,.03,.015,.545,.545,0,0],
 ['C-P','AL731',.4,.5,.03,.015,.945,.9468,0,0],['S','AQ740',.4,.2,.03,.015,.645,.6463,0,.15],
 ['C-P2(퇴직연금)','BI295',.4,.45,.03,.015,.895,.8971,0,0],['C-Pe','BV783',.4,.25,.03,.015,.695,.6966,0,0],
 ['C-P2e(퇴직연금)','BV784',.4,.22,.03,.015,.665,.6672,0,0],['AG','BV785',.4,.3,.03,.015,.745,.745,.6,0],
 ['CG','BV786',.4,.6,.03,.015,1.045,1.045,0,0],['S-P','D3378',.4,.15,.03,.015,.595,.595,0,0],
 ['S-P2(퇴직연금)','D3379',.4,.14,.03,.015,.585,.585,0,0],
];
const smartPerformance=[
 ['A1',[-5.19,4.66,2.20,6.33,3.42]],['A-e',[-5.00,4.87,2.41,6.55,3.67]],
 ['C1',[-5.58,4.25,1.79,5.91,3.03]],['C-e',[-5.19,4.66,2.20,6.33,3.45]],
 ['C-W',[-4.90,4.98,2.52,6.66,3.76]],['C-P',[-5.29,4.56,2.10,6.23,2.91]],
 ['S',[-5.00,4.87,2.41,6.55,3.32]],['C-P2(퇴직연금)',[-5.24,4.61,2.15,6.28,2.75]],
 ['C-Pe',[-5.05,4.82,2.36,6.49,2.05]],['C-P2e(퇴직연금)',[-5.02,4.85,2.39,6.53,1.93]],
 ['S-P2(퇴직연금)',[-4.94,4.94,2.48,3.80]],
];

const mobilityClasses=[
 ['A1','A3165',.7,.98,.03,.02,1.73,1.7367,1,0],['C1','A3166',.7,1.5,.03,.02,2.25,2.2548,0,0],
 ['C2','A3167',.7,1.35,.03,.02,2.10,2.1059,0,0],['C3','A3168',.7,.99,.03,.02,1.74,1.7454,0,0],
 ['C4','A3169',.7,.89,.03,.02,1.64,1.6462,0,0],['C-e','A3170',.7,.97,.03,.02,1.72,1.7267,0,0],
 ['C-F','A3171',.7,.06,.03,.02,.81,.81,0,0],['C-W','A3172',.7,0,.03,.02,.75,.75,0,0],
 ['A-e','AQ735',.7,.35,.03,.02,1.10,1.1061,.5,0],['S','AQ736',.7,.35,.03,.02,1.10,1.1054,0,.15],
 ['C-P','B4898',.7,.9,.03,.02,1.65,1.6554,0,0],['AG','BP779',.7,.73,.03,.02,1.48,1.48,.75,0],
 ['C-Pe','BU255',.7,.45,.03,.02,1.20,1.2053,0,0],['C-P2(퇴직연금)','DD262',.7,.82,.03,.02,1.57,1.575,0,0],
 ['C-P2e(퇴직연금)','DD263',.7,.41,.03,.02,1.16,1.166,0,0],['S-P','DD264',.7,.27,.03,.02,1.02,1.02,0,0],
 ['S-P2(퇴직연금)','DD265',.7,.26,.03,.02,1.01,1.01,0,0],
];
const mobilityPerformance=[
 ['A1',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[-1.65,2.67,8.67,14.08,-1.21],[9.79,9.45,9.61,7.82,2.69]],
 ['C1',['1Y','2Y','3Y','SINCE_INCEPTION'],[-2.16,2.13,8.11,8.66],[9.79,9.45,9.61,4.85]],
 ['C2',['1Y','2Y','3Y','SINCE_INCEPTION'],[-2.02,2.29,8.28,1.04],[9.79,9.45,9.61,-.16]],
 ['C3',['1Y','2Y','SINCE_INCEPTION'],[-1.66,2.66,7.12],[9.79,9.45,8.47]],
 ['C4',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[-1.56,2.76,8.77,14.19,-.08],[9.79,9.45,9.61,7.82,3.86]],
 ['C-e',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[-1.64,2.68,8.68,14.09,-1.19],[9.79,9.45,9.61,7.82,2.69]],
 ['A-e',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[-1.03,3.31,9.35,14.79,.45],[9.79,9.45,9.61,7.82,3.84]],
 ['S',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[-1.03,3.31,9.35,14.79,1.04],[9.79,9.45,9.61,7.82,3.91]],
 ['C-P',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[-1.57,2.75,8.76,14.18,1.25],[9.79,9.45,9.61,7.82,4.07]],
 ['C-Pe',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[-1.13,3.21,9.24,14.68,5.36],[9.79,9.45,9.61,7.82,2.41]],
 ['C-P2(퇴직연금)',['1Y','2Y','3Y','SINCE_INCEPTION'],[-1.49,2.83,8.85,6.01],[9.79,9.45,9.61,2.86]],
 ['C-P2e(퇴직연금)',['1Y','2Y','3Y','SINCE_INCEPTION'],[-1.09,3.25,9.29,1.34],[9.79,9.45,9.61,-.14]],
];

function extractKiwoomRemainingPhase1(root,date){
 const defs=[
  {doc:'DOC000086',fund:'FUND000084',file:'R2_KR5123490013.pdf',name:'키움 Smart Investor 분할매수 증권 자투자신탁 제1호[주식혼합-재간접형]',code:'A9256',date:'2025-05-12',effective:'2025-05-30',pages:65,l1:'혼합형',l2:'주식혼합-재간접형',target:'키움 Smart Investor 분할매수 증권 모투자신탁[주식혼합-재간접형]에 50% 이상 투자',risk:36.95,benchmark:null,inception:'2012-04-09',structure:'투자신탁|증권(주식혼합-재간접형)|개방형|추가형|모자형|종류형',source:'1|5|10|11|28|35|36|49|50|52'},
  {doc:'DOC000087',fund:'FUND000085',file:'R2_KR5185450009.pdf',name:'키움 차세대모빌리티 증권 자투자신탁 제1호[주식]',code:'A3164',date:'2025-06-30',effective:'2025-07-15',pages:59,l1:'주식형',l2:'차세대모빌리티',target:'국내 주식에 주로 투자하는 키움 차세대모빌리티 증권 모투자신탁[주식]에 투자',risk:39.84,benchmark:'KOSPI 지수 100%',inception:'2011-05-23',structure:'투자신탁|증권(주식형)|개방형|추가형|모자형|종류형',source:'1|3|8|9|20|28|29|43|44|46'},
 ];
 return {documents:defs.map(x=>({doc_id:x.doc,company_name:'키움투자자산운용',file_name:x.file,file_path:path.relative(root,path.join(root,'data','투자설명서','키움투자자산운용',x.file)).replaceAll('\\','/'),document_type:'투자설명서',document_date:x.date,effective_date:x.effective,fund_id:x.fund,total_pages:x.pages,extraction_date:date})),funds:defs.map(x=>({fund_id:x.fund,company_name:'키움투자자산운용',fund_name_raw:x.name,fund_name_normalized:x.name.replaceAll(' ',''),fund_code:x.code,management_company:'키움투자자산운용 주식회사',asset_type_l1:x.l1,asset_type_l2:x.l2,investment_region:'국내',investment_target:x.target,risk_grade:2,risk_grade_text:'2등급(높은 위험)',benchmark:x.benchmark,volatility:x.risk,inception_date:x.inception,currency_hedge:null,fund_structure:x.structure,tdf_vintage:null,bond_duration_bucket:null,source_doc_id:x.doc,source_page:x.source,source_text:`[p.${x.source}] 코드 ${x.code}; 위험 2등급; 97.5% VaR ${x.risk}%; ${x.benchmark?`비교지수 ${x.benchmark}`:'비교지수 없음'}`}))};
}
function account(name){if(name.includes('퇴직연금'))return '퇴직연금';if(/(?:C-P|S-P)/.test(name))return '연금저축';return '일반';}
function channel(name){if(name==='S'||name.startsWith('S-P'))return '온라인슈퍼';if(name.includes('-e')||name.includes('Pe')||name.includes('P2e'))return '온라인';if(name==='C-W')return '랩';if(name==='C-F')return '기관';return '오프라인';}
function classRows(rows,start,fund,doc,pages){return rows.map((r,i)=>{const[n,code,m,s,t,a,total,expense,front,back]=r;return{class_id:`CLASS${String(start+i).padStart(6,'0')}`,fund_id:fund,class_code:code,class_name_raw:n,class_name_normalized:n,account_type:account(n),channel:channel(n),front_load:front,back_load:back,management_fee:m,sales_fee:s,trust_fee:t,admin_fee:a,total_fee:total,total_expense_ratio:expense,source_doc_id:doc,source_page:pages,source_text:`[p.${pages}] ${n}; 코드 ${code}; 총보수 ${total}%; 총보수·비용 ${expense}%`};});}
function extractKiwoomRemainingClasses(){return[...classRows(smartClasses,982,'FUND000084','DOC000086','10|11|34|35|36'),...classRows(mobilityClasses,997,'FUND000085','DOC000087','8|9|26|27|28|29')];}
function extractKiwoomRemainingPerformance(){const out=[],periods=['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],smartIds=new Map(smartClasses.map((r,i)=>[r[0],`CLASS${String(982+i).padStart(6,'0')}`])),mobilityIds=new Map(mobilityClasses.map((r,i)=>[r[0],`CLASS${String(997+i).padStart(6,'0')}`]));for(const[n,vals]of smartPerformance){const ps=vals.length===5?periods:['1Y','2Y','3Y','SINCE_INCEPTION'];vals.forEach((v,i)=>out.push({class_id:smartIds.get(n),fund_id:'FUND000084',period:ps[i],return_pct:v,benchmark_return_pct:null,as_of_date:'2025-05-12',source_doc_id:'DOC000086',source_page:'49|50',source_text:`[p.49-50] ${n}; ${ps[i]} ${v}%; 비교지수 없음(PDF 0.00 표시)`}));}for(const[n,ps,vals,bench]of mobilityPerformance)vals.forEach((v,i)=>out.push({class_id:mobilityIds.get(n),fund_id:'FUND000085',period:ps[i],return_pct:v,benchmark_return_pct:bench[i],as_of_date:'2025-06-30',source_doc_id:'DOC000087',source_page:'43|44',source_text:`[p.43-44] ${n}; ${ps[i]} ${v}%; 비교지수 ${bench[i]}%`}));return out;}
module.exports={extractKiwoomRemainingPhase1,extractKiwoomRemainingClasses,extractKiwoomRemainingPerformance};
