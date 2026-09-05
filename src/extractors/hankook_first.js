const path=require('path');
const classes=[
 ['C','AQ443',.11,.39,.03,.014,.544,.5517],
 ['C-e','AT356',.11,.195,.03,.014,.349,.3564],
 ['S-P','AQ442',.11,.12,.03,.014,.274,.2793],
];
const performance=[
 ['C',[5.33,4.97,2.75,1.00,2.95],[5.43,5.18,3.19,1.49,4.00]],
 ['C-e',[5.54,5.18,2.96,1.20,2.12],[5.43,5.18,3.19,1.49,2.31]],
 ['S-P',[5.62,5.26,3.03,1.28,2.30],[5.43,5.18,3.19,1.49,2.46]],
];
function extractHankookFirstPhase1(root,date){const name='한국투자 골드플랜 연금 증권 전환형 투자신탁 1호(국공채)',file='R2_KR5113420012.pdf';return{documents:[{doc_id:'DOC000088',company_name:'한국투자신탁운용',file_name:file,file_path:path.relative(root,path.join(root,'data','투자설명서','한국투자신탁운용',file)).replaceAll('\\','/'),document_type:'투자설명서',document_date:'2025-02-28',effective_date:'2025-03-28',fund_id:'FUND000086',total_pages:75,extraction_date:date}],funds:[{fund_id:'FUND000086',company_name:'한국투자신탁운용',fund_name_raw:name,fund_name_normalized:name.replaceAll(' ',''),fund_code:'31405',management_company:'한국투자신탁운용주식회사',asset_type_l1:'채권형',asset_type_l2:'국공채',investment_region:'국내',investment_target:'국공채에 증권의 50% 이상 투자하고, 채권에 자산총액의 60% 이상 95% 이하 투자',risk_grade:5,risk_grade_text:'5등급(낮은 위험)',benchmark:'Customized 매경BP국공채지수 100%',volatility:5.16,inception_date:'2001-01-31',currency_hedge:null,fund_structure:'투자신탁|증권(채권형)|개방형|추가형|종류형|전환형',tdf_vintage:null,bond_duration_bucket:null,source_doc_id:'DOC000088',source_page:'1|5|10|12|29|30|40|51|53',source_text:'[p.1,5,10,12,29-30,40,51,53] 코드 31405; 위험 5등급; 97.5% VaR 5.16%; 비교지수 Customized 매경BP국공채지수 100%'}]};}
function extractHankookFirstClasses(){return classes.map((r,i)=>{const[n,code,m,s,t,a,total,expense]=r;return{class_id:`CLASS${String(1014+i).padStart(6,'0')}`,fund_id:'FUND000086',class_code:code,class_name_raw:n,class_name_normalized:n,account_type:'연금저축',channel:n==='C'?'오프라인':n==='C-e'?'온라인':'온라인슈퍼',front_load:0,back_load:0,management_fee:m,sales_fee:s,trust_fee:t,admin_fee:a,total_fee:total,total_expense_ratio:expense,source_doc_id:'DOC000088',source_page:'10|40',source_text:`[p.10,40] ${n}; 코드 ${code}; 총보수 ${total}%; 총보수·비용 ${expense}%`};});}
function extractHankookFirstPerformance(){const ps=['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],ids=new Map(classes.map((r,i)=>[r[0],`CLASS${String(1014+i).padStart(6,'0')}`])),out=[];for(const[n,v,b]of performance)v.forEach((x,i)=>out.push({class_id:ids.get(n),fund_id:'FUND000086',period:ps[i],return_pct:x,benchmark_return_pct:b[i],as_of_date:'2025-02-28',source_doc_id:'DOC000088',source_page:51,source_text:`[p.51] ${n}; ${ps[i]} ${x}%; 비교지수 ${b[i]}%`}));return out;}
module.exports={extractHankookFirstPhase1,extractHankookFirstClasses,extractHankookFirstPerformance};
