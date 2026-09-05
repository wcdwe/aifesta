const {extractMidasClasses}=require('./extractors/midas_classes');
const rows=extractMidasClasses();
function counts(key){return Object.fromEntries([...new Set(rows.map(r=>r[key]))].sort().map(v=>[v,rows.filter(r=>r[key]===v).length]));}
const byFund=Object.fromEntries([...new Set(rows.map(r=>r.fund_id))].map(id=>[id,rows.filter(r=>r.fund_id===id).length]));
const report={rows:rows.length,by_fund:byFund,account_type:counts('account_type'),channel:counts('channel'),front_load_nonzero:rows.filter(r=>r.front_load>0).length,back_load_nonzero:rows.filter(r=>r.back_load>0).length,total_fee_null:rows.filter(r=>r.total_fee==null).length,total_expense_ratio_null:rows.filter(r=>r.total_expense_ratio==null).length,source_page_present:rows.filter(r=>r.source_page).length};
console.log(JSON.stringify(report,null,2));
