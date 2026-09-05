const rows=[
 ['A','E1729',1,0,.8,.6,.04,.02,1.46],['A-e','E1730',.5,0,.8,.3,.04,.02,1.16],['AG','E1731',.7,0,.8,.42,.04,.02,1.28],
 ['C','E1732',0,0,.8,.95,.04,.02,1.81],['C-e','E1733',0,0,.8,.47,.04,.02,1.33],['CG','E1734',0,0,.8,.66,.04,.02,1.52],
 ['C-I','E1735',0,0,.8,.03,.04,.02,.89],['S','E1736',0,.15,.8,.29,.04,.02,1.15],['C-s','E1737',0,0,.8,.01,.04,.02,.87],
 ['C-w','E1738',0,0,.8,0,.04,.02,.86],['C-P','E1739',0,0,.8,.8,.04,.02,1.66],['C-Pe','E1740',0,0,.8,.4,.04,.02,1.26],
 ['S-P','E1741',0,0,.8,.27,.04,.02,1.13],['C-P2','E1742',0,0,.8,.7,.04,.02,1.56],['C-P2e','E1743',0,0,.8,.35,.04,.02,1.21],['S-P2','E1744',0,0,.8,.26,.04,.02,1.12]
];
function meta(t){
 const account=/P2/.test(t)?'퇴직연금':/-P/.test(t)?'연금저축':t==='C-I'?'기관':t==='C-w'?'랩':t==='C-s'?'집합투자업자':'일반';
 const channel=/e$/.test(t)?'온라인':/^S/.test(t)?'온라인슈퍼':'오프라인';
 return {account,channel};
}
function extractVipClasses(){return rows.map((r,i)=>{const[t,code,front,back,mg,sale,trust,admin,total]=r,m=meta(t);return{class_id:`CLASS${String(220+i).padStart(6,'0')}`,fund_id:'FUND000016',class_code:code,class_name_raw:`종류 ${t}`,class_name_normalized:t,account_type:m.account,channel:m.channel,front_load:front,back_load:back,management_fee:mg,sales_fee:sale,trust_fee:trust,admin_fee:admin,total_fee:total,total_expense_ratio:total,source_doc_id:'DOC000016',source_page:'11|32|33|34',source_text:`[p.11,32-34] 종류 ${t}; 코드 ${code}; 선취 ${front}%; 후취 ${back}%; 기본운용 ${mg}%; 판매 ${sale}%; 수탁 ${trust}%; 사무관리 ${admin}%; 총보수 ${total}%; 기타비용 미산출; 총보수·비용 ${total}%`}})}
function extractVipFeeSchedules(){
 const schedules=[]; let seq=25;
 for(let i=0;i<rows.length;i++){
  const[t,,, ,baseManagement,sales,trust,admin,baseTotal]=rows[i];
  const classId=`CLASS${String(220+i).padStart(6,'0')}`;
  const common={class_id:classId,fund_id:'FUND000016',class_name_normalized:t,sales_fee:sales,trust_fee:trust,admin_fee:admin,source_doc_id:'DOC000016'};
  schedules.push({...common,fee_schedule_id:`FEESCHED${String(seq++).padStart(6,'0')}`,period_type:'INITIAL_FIXED_RATE',effective_from_event:'최초설정일',effective_to_event:'최초 성과연동 운용보수율을 반영한 정정신고 효력발생일 전일',rate_type:'FIXED',management_fee:baseManagement,base_management_fee:baseManagement,min_management_fee:baseManagement,max_management_fee:baseManagement,total_fee:baseTotal,min_total_fee:baseTotal,max_total_fee:baseTotal,total_expense_ratio:baseTotal,benchmark_type:null,benchmark_rate:null,performance_multiplier:null,lookback_months:null,recalculation_months:null,formula:null,source_page:'34|36|37',source_text:`[p.34,36-37] 종류 ${t}; 최초 설정 후 성과평가 및 정정신고 효력발생 전까지 기본운용보수 ${baseManagement}%; 총보수 ${baseTotal}%`});
  const fixedOther=sales+trust+admin;
  schedules.push({...common,fee_schedule_id:`FEESCHED${String(seq++).padStart(6,'0')}`,period_type:'PERFORMANCE_LINKED_RATE',effective_from_event:'최초 성과연동 운용보수율을 반영한 정정신고 효력발생일',effective_to_event:'다음 성과연동 운용보수율을 반영한 정정신고 효력발생일 전일(매 3개월 재산정)',rate_type:'FORMULA',management_fee:null,base_management_fee:.8,min_management_fee:0,max_management_fee:1.6,total_fee:null,min_total_fee:Number(fixedOther.toFixed(6)),max_total_fee:Number((fixedOther+1.6).toFixed(6)),total_expense_ratio:null,benchmark_type:'ABSOLUTE_RETURN',benchmark_rate:8,performance_multiplier:.1,lookback_months:12,recalculation_months:3,formula:'clamp(0.80 + (보수 차감 전 자펀드 최근 1년 수익률 - 8.00) * 0.10, 0.00, 1.60)',source_page:'34|35|36|37',source_text:`[p.34-37] 종류 ${t}; 최근 1년 보수 차감 전 자펀드 수익률 기준; 기준수익률 연 8%; 성과반영률 0.1; 매 3개월 산정; 최종 운용보수 0~1.60%; 정정신고 효력발생일부터 적용; 총보수 범위 ${fixedOther.toFixed(2)}~${(fixedOther+1.6).toFixed(2)}%; 1,000만원 비용 예시는 연 8% 및 성과운용보수 미적용 가정`});
 }
 return schedules;
}
module.exports={extractVipClasses,extractVipFeeSchedules};
