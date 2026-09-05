const path=require('path');
const classes=[
 ['C','AQ445',.11,.39,.03,.014,.544,.5468],['C-e','AT359',.11,.195,.03,.014,.349,.3517],
 ['C-F','B6845',.11,.03,.03,.014,.184,.184],['C-R','B6846',.11,.385,.03,.014,.539,.539],
 ['C-RF','B6847',.11,.02,.03,.014,.174,.174],['C-RJ','B6848',.11,0,.03,.014,.154,.154],
 ['S-P','AQ444',.11,.12,.03,.014,.274,.2746],
];
const performance=[
 ['C',[5.17,4.90,2.83,1.11,3.06],[5.37,5.22,3.37,1.65,4.07]],
 ['C-e',[5.37,5.10,3.03,1.31,1.65],[5.37,5.22,3.37,1.65,1.91]],
 ['S-P',[5.45,5.19,3.11,1.38,2.42],[5.37,5.22,3.37,1.65,2.61]],
];
function extractHankookSecondPhase1(root,date){const name='한국투자 골드플랜 연금 증권 전환형 자투자신탁 1호(채권)',file='R2_KR5113420013.pdf';return{documents:[{doc_id:'DOC000089',company_name:'한국투자신탁운용',file_name:file,file_path:path.relative(root,path.join(root,'data','투자설명서','한국투자신탁운용',file)).replaceAll('\\','/'),document_type:'투자설명서',document_date:'2025-02-28',effective_date:'2025-03-28',fund_id:'FUND000087',total_pages:81,extraction_date:date}],funds:[{fund_id:'FUND000087',company_name:'한국투자신탁운용',fund_name_raw:name,fund_name_normalized:name.replaceAll(' ',''),fund_code:'31406',management_company:'한국투자신탁운용주식회사',asset_type_l1:'채권형',asset_type_l2:'우량채권',investment_region:'국내',investment_target:'한국투자 스마트코리아 증권 모투자신탁(채권)에 자산총액의 60% 이상 투자',risk_grade:5,risk_grade_text:'5등급(낮은 위험)',benchmark:'Customized 매경BP채권지수 100%',volatility:4.38,inception_date:'2001-01-31',currency_hedge:null,fund_structure:'투자신탁|증권(채권형)|개방형|추가형|종류형|모자형|전환형',tdf_vintage:null,bond_duration_bucket:null,source_doc_id:'DOC000089',source_page:'1|5|10|12|33|34|45|46|57|59',source_text:'[p.1,5,10,12,33-34,45-46,57,59] 코드 31406; 위험 5등급; 97.5% VaR 4.38%; 비교지수 Customized 매경BP채권지수 100%'}]};}
function account(n){return n.startsWith('C-R')?'퇴직연금':'연금저축';}
function channel(n){if(n==='C-e')return '온라인';if(n==='S-P')return '온라인슈퍼';if(n==='C-F'||n==='C-RF')return '기관';if(n==='C-RJ')return '직판';return '오프라인';}
function extractHankookSecondClasses(){return classes.map((r,i)=>{const[n,code,m,s,t,a,total,expense]=r;return{class_id:`CLASS${String(1017+i).padStart(6,'0')}`,fund_id:'FUND000087',class_code:code,class_name_raw:n,class_name_normalized:n,account_type:account(n),channel:channel(n),front_load:0,back_load:0,management_fee:m,sales_fee:s,trust_fee:t,admin_fee:a,total_fee:total,total_expense_ratio:expense,source_doc_id:'DOC000089',source_page:'10|12|45|46',source_text:`[p.10,12,45-46] ${n}; 코드 ${code}; 총보수 ${total}%; 총보수·비용 ${expense}%`};});}
function extractHankookSecondPerformance(){const ps=['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],ids=new Map(classes.map((r,i)=>[r[0],`CLASS${String(1017+i).padStart(6,'0')}`])),out=[];for(const[n,v,b]of performance)v.forEach((x,i)=>out.push({class_id:ids.get(n),fund_id:'FUND000087',period:ps[i],return_pct:x,benchmark_return_pct:b[i],as_of_date:'2025-02-28',source_doc_id:'DOC000089',source_page:57,source_text:`[p.57] ${n}; ${ps[i]} ${x}%; 비교지수 ${b[i]}%`}));return out;}
module.exports={extractHankookSecondPhase1,extractHankookSecondClasses,extractHankookSecondPerformance};
