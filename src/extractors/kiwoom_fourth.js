const path = require('path');

const classes = [
  ['A','BN895',.05,.20,.015,.01,.275,.2847,.1,0],
  ['A-e','BN896',.05,.10,.015,.01,.175,.1847,.05,0],
  ['C','BN897',.05,.25,.015,.01,.325,.3347,0,0],
  ['C-e','BN898',.05,.125,.015,.01,.20,.2097,0,0],
  ['C-I','BN899',.05,.05,.015,.01,.125,.1347,0,0],
  ['C-F','BN900',.05,.02,.015,.01,.095,.1047,0,0],
  ['C-W','BN901',.05,0,.015,.01,.075,.0844,0,0],
  ['C-P','BN902',.05,.22,.015,.01,.295,.3046,0,0],
  ['C-P2(퇴직연금)','BN903',.05,.21,.015,.01,.285,.2947,0,0],
  ['S','BN904',.05,.08,.015,.01,.155,.1644,0,.15],
  ['C-Pe','C1127',.05,.11,.015,.01,.185,.1947,0,0],
  ['C-P2e(퇴직연금)','C1128',.05,.10,.015,.01,.175,.1847,0,0],
  ['AG','C1129',.05,.15,.015,.01,.225,.225,.07,0],
  ['CG','C1130',.05,.18,.015,.01,.255,.255,0,0],
];

const performance = [
  ['A',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[4.50,4.94,4.10,3.02,2.80],[3.65,3.75,3.23,2.34,2.20]],
  ['A-e',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[4.61,5.04,4.20,3.12,2.90],[3.65,3.75,3.23,2.34,2.20]],
  ['C',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[4.45,4.88,4.04,2.97,2.75],[3.65,3.75,3.23,2.34,2.20]],
  ['C-e',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[4.58,5.01,4.17,3.09,2.87],[3.65,3.75,3.23,2.34,2.20]],
  ['C-I',['SINCE_INCEPTION'],[4.39],[3.58]],
  ['C-F',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[4.69,5.12,4.28,3.20,2.98],[3.65,3.75,3.23,2.34,2.20]],
  ['C-W',['1Y','2Y','3Y','SINCE_INCEPTION'],[4.71,5.15,4.30,3.62],[3.65,3.75,3.23,2.70]],
  ['C-P',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[4.48,4.92,4.08,3.00,2.78],[3.65,3.75,3.23,2.34,2.21]],
  ['C-P2(퇴직연금)',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[4.49,4.93,4.09,3.01,2.81],[3.65,3.75,3.23,2.34,2.22]],
  ['S',['1Y','SINCE_INCEPTION'],[4.63,4.84],[3.65,3.82]],
  ['C-Pe',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[4.60,5.03,4.19,3.11,2.89],[3.65,3.75,3.23,2.34,2.20]],
  ['C-P2e(퇴직연금)',['1Y','2Y','3Y','5Y','SINCE_INCEPTION'],[4.61,5.04,4.20,3.12,2.94],[3.65,3.75,3.23,2.34,2.23]],
];

function extractKiwoomFourthPhase1(root, extractionDate) {
  const fundName = '키움더드림단기채증권투자신탁[채권]';
  const fileName = 'R2_KR5123420049.pdf';
  return {
    documents:[{doc_id:'DOC000085',company_name:'키움투자자산운용',file_name:fileName,file_path:path.relative(root,path.join(root,'data','투자설명서','키움투자자산운용',fileName)).replaceAll('\\','/'),document_type:'투자설명서',document_date:'2025-01-19',effective_date:'2025-02-13',fund_id:'FUND000083',total_pages:55,extraction_date:extractionDate}],
    funds:[{fund_id:'FUND000083',company_name:'키움투자자산운용',fund_name_raw:fundName,fund_name_normalized:fundName.replaceAll(' ',''),fund_code:'BN894',management_company:'키움투자자산운용 주식회사',asset_type_l1:'채권형',asset_type_l2:'단기채권',investment_region:'국내',investment_target:'전자단기사채 및 어음 등(A2- 이상)을 포함한 채권·어음에 자산총액의 60% 이상 투자',risk_grade:6,risk_grade_text:'6등급(매우 낮은 위험)',benchmark:'MK 머니마켓 지수 100%',volatility:.28,inception_date:'2017-12-13',currency_hedge:null,fund_structure:'투자신탁|증권(채권형)|개방형|추가형|종류형',tdf_vintage:null,bond_duration_bucket:null,source_doc_id:'DOC000085',source_page:'1|3|8|9|12|19|25|26|39|40|42',source_text:'[p.1,3,8-9,12,19,25-26,39-40,42] 코드 BN894; 위험 6등급; 97.5% VaR 0.28%; 비교지수 MK 머니마켓 지수 100%'}],
  };
}

function accountType(name) {
  if (name.includes('퇴직연금')) return '퇴직연금';
  if (name.includes('C-P')) return '연금저축';
  return '일반';
}
function channel(name) {
  if (name === 'S') return '온라인슈퍼';
  if (name.includes('-e') || name.includes('Pe') || name.includes('P2e')) return '온라인';
  if (name === 'C-W') return '랩';
  if (name === 'C-F' || name === 'C-I') return '기관';
  return '오프라인';
}
function extractKiwoomFourthClasses() {
  return classes.map((r,i)=>{const [name,classCode,managementFee,salesFee,trustFee,adminFee,totalFee,totalExpenseRatio,frontLoad,backLoad]=r;return{class_id:`CLASS${String(968+i).padStart(6,'0')}`,fund_id:'FUND000083',class_code:classCode,class_name_raw:name,class_name_normalized:name,account_type:accountType(name),channel:channel(name),front_load:frontLoad,back_load:backLoad,management_fee:managementFee,sales_fee:salesFee,trust_fee:trustFee,admin_fee:adminFee,total_fee:totalFee,total_expense_ratio:totalExpenseRatio,source_doc_id:'DOC000085',source_page:'8|24|25|26',source_text:`[p.8,24-26] ${name}; 코드 ${classCode}; 총보수 ${totalFee}%; 총보수·비용 ${totalExpenseRatio}%`};});
}
function extractKiwoomFourthPerformance() {
  const ids=new Map(classes.map((r,i)=>[r[0],`CLASS${String(968+i).padStart(6,'0')}`])),out=[];
  for(const [name,periods,returns,benchmarks] of performance) periods.forEach((period,i)=>out.push({class_id:ids.get(name),fund_id:'FUND000083',period,return_pct:returns[i],benchmark_return_pct:benchmarks[i],as_of_date:'2025-01-19',source_doc_id:'DOC000085',source_page:'39|40',source_text:`[p.39-40] ${name}; ${period} ${returns[i]}%; 비교지수 ${benchmarks[i]}%`}));
  return out;
}
module.exports={extractKiwoomFourthPhase1,extractKiwoomFourthClasses,extractKiwoomFourthPerformance};
