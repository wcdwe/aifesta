function validatePhase1(documents, funds) {
  const errors = [];
  const ids = values => new Set(values).size === values.length;
  if (!ids(documents.map(row => row.doc_id))) errors.push('duplicate doc_id');
  if (!ids(funds.map(row => row.fund_id))) errors.push('duplicate fund_id');
  const documentIds = new Set(documents.map(row => row.doc_id));
  const fundIds = new Set(funds.map(row => row.fund_id));
  const documentedFundIds = new Set(documents.map(row => row.fund_id));
  for (const row of documents) {
    if (!fundIds.has(row.fund_id)) errors.push(`${row.doc_id}: orphan fund_id`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.document_date)) errors.push(`${row.doc_id}: invalid document_date`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.effective_date)) errors.push(`${row.doc_id}: invalid effective_date`);
    if (!Number.isInteger(row.total_pages) || row.total_pages < 1) errors.push(`${row.doc_id}: invalid total_pages`);
  }
  for (const row of funds) {
    if (!documentedFundIds.has(row.fund_id)) errors.push(`${row.fund_id}: no linked document`);
    if (!documentIds.has(row.source_doc_id)) errors.push(`${row.fund_id}: invalid source_doc_id`);
    if (row.risk_grade < 1 || row.risk_grade > 6) errors.push(`${row.fund_id}: invalid risk_grade`);
    if (!row.source_doc_id || !row.source_page || !row.source_text) errors.push(`${row.fund_id}: missing provenance`);
  }
  return errors;
}

module.exports = {validatePhase1};

function validateClasses(rows) {
  const errors=[]; const keys=new Set();
  for(const row of rows){
    const key=`${row.fund_id}|${row.class_name_normalized}`;
    if(keys.has(key))errors.push(`${key}: duplicate class`); keys.add(key);
    const parts=[row.management_fee,row.sales_fee,row.trust_fee,row.admin_fee];
    if(parts.some(v=>v<0)||(row.total_fee!==null&&row.total_fee<0)||(row.total_expense_ratio!==null&&row.total_expense_ratio<0))errors.push(`${row.class_id}: negative fee`);
    const sum=parts.reduce((a,b)=>a+b,0);
    if(row.total_fee!==null&&Math.abs(sum-row.total_fee)>.00001)errors.push(`${row.class_id}: component sum ${sum} != total_fee ${row.total_fee}`);
    if(row.total_fee!==null&&row.total_expense_ratio!==null&&row.total_expense_ratio+0.00001<row.total_fee)errors.push(`${row.class_id}: total_expense_ratio below total_fee`);
    if(row.class_inception_status){
      if(!['ESTABLISHED','NOT_ESTABLISHED','NOT_DISCLOSED','REVIEW_REQUIRED'].includes(row.class_inception_status))errors.push(`${row.class_id}: invalid class_inception_status`);
      if(row.class_inception_status==='ESTABLISHED'&&!/^\d{4}-\d{2}-\d{2}$/.test(row.class_inception_date||''))errors.push(`${row.class_id}: established class missing valid inception date`);
      if(row.class_inception_status!=='ESTABLISHED'&&row.class_inception_date)errors.push(`${row.class_id}: non-established class has inception date`);
    }
    if(!row.source_doc_id||!row.source_page||!row.source_text)errors.push(`${row.class_id}: missing provenance`);
  }
  return errors;
}
module.exports.validateClasses=validateClasses;

function validatePerformance(rows) {
  const errors=[]; const keys=new Set();
  for(const row of rows){
    const key=`${row.class_id||row.fund_id+'|FUND'}|${row.period}|${row.as_of_date}`;
    if(keys.has(key))errors.push(`${key}: duplicate performance`); keys.add(key);
    if(!['1Y','2Y','3Y','5Y','SINCE_INCEPTION'].includes(row.period))errors.push(`${key}: invalid period`);
    if(!Number.isFinite(row.return_pct)||row.return_pct < -100 || row.return_pct > 1000)errors.push(`${key}: unreasonable return`);
    if(row.benchmark_return_pct!==null&&(!Number.isFinite(row.benchmark_return_pct)||row.benchmark_return_pct < -100 || row.benchmark_return_pct > 1000))errors.push(`${key}: unreasonable benchmark`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(row.as_of_date))errors.push(`${key}: invalid as_of_date`);
    if(!row.source_doc_id||!row.source_page||!row.source_text)errors.push(`${key}: missing provenance`);
  }
  return errors;
}
module.exports.validatePerformance=validatePerformance;
