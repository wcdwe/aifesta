const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const processedDir=path.join(root,'data','processed');
const validationDir=path.join(root,'data','validation');

function readCsv(dir,file){
 let source=fs.readFileSync(path.join(dir,file),'utf8').replace(/^\uFEFF/,'');
 const rows=[]; let row=[],cell='',quoted=false;
 for(let i=0;i<source.length;i++){
  const char=source[i];
  if(quoted){
   if(char==='"'&&source[i+1]==='"'){cell+='"';i++;}
   else if(char==='"')quoted=false;
   else cell+=char;
  }else if(char==='"')quoted=true;
  else if(char===','){row.push(cell);cell='';}
  else if(char==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
  else cell+=char;
 }
 const headers=rows.shift()||[];
 return rows.filter(current=>current.some(Boolean)).map(current=>Object.fromEntries(headers.map((key,index)=>[key,current[index]??''])));
}

const csv=file=>readCsv(processedDir,file);
const validationCsv=file=>readCsv(validationDir,file);
const documents=csv('documents.csv');
const funds=csv('funds.csv');
const classes=csv('classes.csv');
const feeSchedules=csv('class_fee_schedules.csv');
const performance=csv('performance.csv');
const aum=csv('aum.csv');
const sourceIssues=validationCsv('pdf_source_issues.csv');
const recordIssues=validationCsv('record_issues.csv');
const errors=[];

function unique(rows,key,label){
 const values=new Set();
 for(const row of rows){
  if(!row[key])errors.push(`${label}: missing ${key}`);
  else if(values.has(row[key]))errors.push(`${label}: duplicate ${row[key]}`);
  else values.add(row[key]);
 }
 return values;
}

const docIds=unique(documents,'doc_id','documents');
const fundIds=unique(funds,'fund_id','funds');
const fundById=new Map(funds.map(row=>[row.fund_id,row]));
const classIds=unique(classes,'class_id','classes');
unique(feeSchedules,'fee_schedule_id','class_fee_schedules');
const issueIds=unique(sourceIssues,'issue_id','pdf_source_issues');

for(const fund of funds)if(!docIds.has(fund.source_doc_id))errors.push(`${fund.fund_id}: orphan source_doc_id`);
for(const fund of funds){
 if(!['ESTABLISHED','NOT_ESTABLISHED','NOT_DISCLOSED','REVIEW_REQUIRED'].includes(fund.inception_status))errors.push(`${fund.fund_id}: invalid fund inception status`);
 if(fund.inception_status==='ESTABLISHED'&&!/^\d{4}-\d{2}-\d{2}$/.test(fund.inception_date))errors.push(`${fund.fund_id}: established fund missing inception date`);
 if(fund.inception_status!=='ESTABLISHED'&&fund.inception_date)errors.push(`${fund.fund_id}: non-established fund has inception date`);
 if(fund.inception_scheduled_date&&!/^\d{4}-\d{2}-\d{2}$/.test(fund.inception_scheduled_date))errors.push(`${fund.fund_id}: invalid scheduled inception date`);
}
for(const fundClass of classes){
 if(!fundIds.has(fundClass.fund_id))errors.push(`${fundClass.class_id}: orphan fund_id`);
 if(fundClass.class_inception_status){
  if(!['ESTABLISHED','NOT_ESTABLISHED','NOT_DISCLOSED','REVIEW_REQUIRED'].includes(fundClass.class_inception_status))errors.push(`${fundClass.class_id}: invalid class inception status`);
  if(fundClass.class_inception_status==='ESTABLISHED'&&!/^\d{4}-\d{2}-\d{2}$/.test(fundClass.class_inception_date))errors.push(`${fundClass.class_id}: invalid class inception date`);
  if(fundClass.class_inception_status!=='ESTABLISHED'&&fundClass.class_inception_date)errors.push(`${fundClass.class_id}: non-established class has inception date`);
  const fund=fundById.get(fundClass.fund_id);
  if(fundClass.class_inception_date&&fund?.inception_date&&fundClass.class_inception_date<fund.inception_date)errors.push(`${fundClass.class_id}: class inception precedes fund inception`);
 }
}

const feeScheduleKeys=new Set();
for(const row of feeSchedules){
 if(!fundIds.has(row.fund_id))errors.push(`${row.fee_schedule_id}: orphan fund_id`);
 if(!classIds.has(row.class_id))errors.push(`${row.fee_schedule_id}: orphan class_id`);
 if(!docIds.has(row.source_doc_id))errors.push(`${row.fee_schedule_id}: orphan source_doc_id`);
 const key=`${row.class_id}|${row.period_type}`;
 if(feeScheduleKeys.has(key))errors.push(`${row.fee_schedule_id}: duplicate class/period`);
 feeScheduleKeys.add(key);
 const fixedComponents=['sales_fee','trust_fee','admin_fee'].reduce((sum,column)=>sum+Number(row[column]),0);
 if(row.rate_type==='FORMULA'){
  const minTotal=Number(row.min_total_fee),maxTotal=Number(row.max_total_fee),minManagement=Number(row.min_management_fee),maxManagement=Number(row.max_management_fee);
  if(Math.abs(fixedComponents+minManagement-minTotal)>.000001)errors.push(`${row.fee_schedule_id}: minimum fee components do not sum to minimum total`);
  if(Math.abs(fixedComponents+maxManagement-maxTotal)>.000001)errors.push(`${row.fee_schedule_id}: maximum fee components do not sum to maximum total`);
  if(!row.formula)errors.push(`${row.fee_schedule_id}: formula rate missing formula`);
 }else{
  const componentSum=fixedComponents+Number(row.management_fee),total=Number(row.total_fee),expense=Number(row.total_expense_ratio);
  if(Math.abs(componentSum-total)>.000001)errors.push(`${row.fee_schedule_id}: fee components do not sum to total`);
  if(expense<total)errors.push(`${row.fee_schedule_id}: total_expense_ratio below total_fee`);
 }
}

const performanceKeys=new Set();
for(const row of performance){
 if(!fundIds.has(row.fund_id))errors.push(`performance: orphan fund ${row.fund_id}`);
 if(row.class_id&&!classIds.has(row.class_id))errors.push(`performance: orphan class ${row.class_id}`);
 const key=[row.class_id,row.period,row.as_of_date].join('|');
 if(performanceKeys.has(key)&&row.class_id)errors.push(`performance: duplicate ${key}`);
 performanceKeys.add(key);
}
for(const row of aum)if(!fundIds.has(row.fund_id))errors.push(`aum: orphan fund ${row.fund_id}`);

const allowedStatuses=new Set(['SUSPECTED_SOURCE_ERROR','INTERNAL_CONFLICT','RESOLVED_WITH_EVIDENCE','REQUIRES_REVIEW','CONFIRMED_SOURCE_ERROR']);
const allowedConfirmations=new Set(['UNCONFIRMED','CONFIRMED']);
for(const issue of sourceIssues){
 if(!fundIds.has(issue.fund_id))errors.push(`${issue.issue_id}: orphan fund_id`);
 if(!docIds.has(issue.source_doc_id))errors.push(`${issue.issue_id}: orphan source_doc_id`);
 if(!allowedStatuses.has(issue.status))errors.push(`${issue.issue_id}: invalid status ${issue.status}`);
 if(!allowedConfirmations.has(issue.official_confirmation))errors.push(`${issue.issue_id}: invalid official_confirmation ${issue.official_confirmation}`);
 const confidence=Number(issue.confidence);
 if(!Number.isFinite(confidence)||confidence<0||confidence>1)errors.push(`${issue.issue_id}: invalid confidence`);
 for(const key of ['affected_field','issue_type','severity','source_value','source_page','handling_action','reason'])if(!issue[key])errors.push(`${issue.issue_id}: missing ${key}`);
 if(issue.status==='CONFIRMED_SOURCE_ERROR'&&issue.official_confirmation!=='CONFIRMED')errors.push(`${issue.issue_id}: confirmed error lacks official confirmation`);
}

const recordIssueKeys=new Set();
for(const link of recordIssues){
 if(!issueIds.has(link.issue_id))errors.push(`record_issues: orphan issue ${link.issue_id}`);
 if(!link.table_name||!link.record_key||!link.field_name||!link.relation_type)errors.push(`record_issues: incomplete link for ${link.issue_id}`);
 const key=`${link.issue_id}|${link.table_name}|${link.record_key}|${link.field_name}`;
 if(recordIssueKeys.has(key))errors.push(`record_issues: duplicate ${key}`);
 recordIssueKeys.add(key);
 if(link.relation_type==='LOADED_RECORD'){
  if(link.table_name==='classes'&&!classIds.has(link.record_key))errors.push(`${link.issue_id}: missing class ${link.record_key}`);
  if(link.table_name==='documents'&&!docIds.has(link.record_key))errors.push(`${link.issue_id}: missing document ${link.record_key}`);
  if(link.table_name==='funds'&&!fundIds.has(link.record_key))errors.push(`${link.issue_id}: missing fund ${link.record_key}`);
 }
}

const chunkFile=path.join(processedDir,'chunks.jsonl');
const chunkRows=fs.existsSync(chunkFile)?fs.readFileSync(chunkFile,'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line)):[];
const issueChunkIds=new Set(chunkRows.filter(row=>row.section==='source_quality_issue').map(row=>row.issue_id));
for(const issueId of issueIds)if(!issueChunkIds.has(issueId))errors.push(`${issueId}: missing source quality RAG chunk`);
const ragAuditFile=path.join(validationDir,'rag_chunk_audit.json');
const ragAudit=fs.existsSync(ragAuditFile)?JSON.parse(fs.readFileSync(ragAuditFile,'utf8')):null;
const questionAuditFile=path.join(validationDir,'question_coverage_audit.json');
const questionAudit=fs.existsSync(questionAuditFile)?JSON.parse(fs.readFileSync(questionAuditFile,'utf8')):null;
if(!ragAudit)errors.push('RAG: missing rag_chunk_audit.json');
else{
 if(ragAudit.documents_total!==documents.length)errors.push(`RAG: audited ${ragAudit.documents_total} of ${documents.length} documents`);
 if(ragAudit.documents_chunked!==documents.length)errors.push(`RAG: only ${ragAudit.documents_chunked} of ${documents.length} documents chunked`);
 if(ragAudit.chunks_total!==chunkRows.length)errors.push(`RAG: audit chunk count ${ragAudit.chunks_total} differs from JSONL ${chunkRows.length}`);
 if(ragAudit.source_issue_chunks!==sourceIssues.length)errors.push(`RAG: source issue chunks ${ragAudit.source_issue_chunks} differs from registry ${sourceIssues.length}`);
 if(ragAudit.empty_chunks)errors.push(`RAG: ${ragAudit.empty_chunks} empty chunks`);
 if(ragAudit.missing_provenance_chunks)errors.push(`RAG: ${ragAudit.missing_provenance_chunks} chunks missing provenance`);
 if(ragAudit.within_document_duplicate_hash_groups)errors.push(`RAG: ${ragAudit.within_document_duplicate_hash_groups} within-document duplicate groups`);
 if((ragAudit.documents_without_chunks||[]).length)errors.push(`RAG: ${(ragAudit.documents_without_chunks||[]).length} documents without chunks`);
 if((ragAudit.documents_missing_core_sections||[]).length)errors.push(`RAG: ${(ragAudit.documents_missing_core_sections||[]).length} documents missing strategy, risk, or fees`);
}

const distribution=(rows,key)=>rows.reduce((result,row)=>(result[row[key]||'NULL']=(result[row[key]||'NULL']||0)+1,result),{});
const nullRate=(rows,key)=>Number((rows.filter(row=>!row[key]).length/Math.max(1,rows.length)).toFixed(4));
const lineCount=file=>fs.existsSync(path.join(validationDir,file))?Math.max(0,fs.readFileSync(path.join(validationDir,file),'utf8').trim().split(/\r?\n/).length-1):0;
const chunks=chunkRows.length;
const summary={
 companies:[...new Set(documents.map(row=>row.company_name))],
 status:errors.length?'failed':'passed',
 counts:{documents:documents.length,funds:funds.length,classes:classes.length,class_fee_schedules:feeSchedules.length,performance:performance.length,aum:aum.length,chunks,source_issues:sourceIssues.length,record_issue_links:recordIssues.length,source_issue_chunks:issueChunkIds.size,rag_documents_chunked:ragAudit?.documents_chunked||0,rag_pdf_pages_selected:ragAudit?.pdf_pages_selected||0},
 distributions:{risk_grade:distribution(funds,'risk_grade'),asset_type_l1:distribution(funds,'asset_type_l1'),fund_inception_status:distribution(funds,'inception_status'),performance_period:distribution(performance,'period'),fee_schedule_period_type:distribution(feeSchedules,'period_type'),class_inception_status:distribution(classes,'class_inception_status'),source_issue_status:distribution(sourceIssues,'status'),source_issue_type:distribution(sourceIssues,'issue_type'),source_issue_handling_action:distribution(sourceIssues,'handling_action')},
 null_rates:{fund_benchmark:nullRate(funds,'benchmark'),fund_volatility:nullRate(funds,'volatility'),fund_inception_date:nullRate(funds,'inception_date'),fund_inception_status:nullRate(funds,'inception_status'),fund_scheduled_inception_date:nullRate(funds,'inception_scheduled_date'),fund_currency_hedge:nullRate(funds,'currency_hedge'),class_total_fee:nullRate(classes,'total_fee'),class_total_expense_ratio:nullRate(classes,'total_expense_ratio'),class_inception_date:nullRate(classes,'class_inception_date'),class_inception_status:nullRate(classes,'class_inception_status'),performance_benchmark:nullRate(performance,'benchmark_return_pct'),performance_as_of_date:nullRate(performance,'as_of_date')},
 source_coverage:{fund_source_page:1-nullRate(funds,'source_page'),class_source_page:1-nullRate(classes,'source_page'),fee_schedule_source_page:1-nullRate(feeSchedules,'source_page'),performance_source_page:1-nullRate(performance,'source_page'),source_issue_page:1-nullRate(sourceIssues,'source_page'),source_issue_rag_chunk:Number((issueChunkIds.size/Math.max(1,sourceIssues.length)).toFixed(4))},
 performance_by_fund:Object.fromEntries(funds.map(fund=>[fund.fund_id,performance.filter(row=>row.fund_id===fund.fund_id).length])),
 null_policy:{dash_as_null:true,unknown_as_null:true,zero_preserved_only_when_explicit:true},
 source_quality_policy:{source_values_never_overwritten:true,official_confirmation_required_for_confirmed_error:true,unconfirmed_issues_labeled_as_candidates:true,issue_registry:'data/validation/pdf_source_issues.csv',record_links:'data/validation/record_issues.csv',legacy_compatibility_file:'data/validation/pdf_source_errors.csv'},
 rag:{audit_file:'data/validation/rag_chunk_audit.json',documents_total:ragAudit?.documents_total||0,documents_chunked:ragAudit?.documents_chunked||0,pdf_pages_total:ragAudit?.pdf_pages_total||0,pdf_pages_selected:ragAudit?.pdf_pages_selected||0,documents_without_chunks:ragAudit?.documents_without_chunks||[],documents_missing_core_sections:ragAudit?.documents_missing_core_sections||[],empty_chunks:ragAudit?.empty_chunks||0,missing_provenance_chunks:ragAudit?.missing_provenance_chunks||0,within_document_duplicate_hash_groups:ragAudit?.within_document_duplicate_hash_groups||0,cross_document_duplicate_hash_groups:ragAudit?.cross_document_duplicate_hash_groups||0,section_chunk_counts:ragAudit?.section_chunk_counts||{}},
 question_readiness:{audit_file:'data/validation/question_coverage_audit.json',status_counts:questionAudit?[...questionAudit.requested_question_categories,...questionAudit.additional_question_categories].reduce((result,row)=>(result[row.status]=(result[row.status]||0)+1,result),{}):{},test_summary:questionAudit?.test_summary||{},coverage_gap_counts:questionAudit?Object.fromEntries(Object.entries(questionAudit.coverage_gaps).map(([key,rows])=>[key,rows.length])):{}},
 validation:{errors,unmatched_fields:lineCount('unmatched_fields.csv'),pdf_source_issue_candidates:sourceIssues.filter(row=>row.official_confirmation==='UNCONFIRMED').length,pdf_source_confirmed_errors:sourceIssues.filter(row=>row.status==='CONFIRMED_SOURCE_ERROR').length,duplicate_pdf_files:lineCount('duplicate_pdf_files.csv'),pdf_source_issues_file:'data/validation/pdf_source_issues.csv',record_issues_file:'data/validation/record_issues.csv',rag_chunk_audit_file:'data/validation/rag_chunk_audit.json',question_coverage_audit_file:'data/validation/question_coverage_audit.json'}
};
fs.writeFileSync(path.join(validationDir,'validation_summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({status:summary.status,counts:summary.counts,errors:errors.length,companies:summary.companies.length},null,2));
if(errors.length)process.exitCode=1;
