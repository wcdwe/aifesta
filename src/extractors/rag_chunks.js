const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const {readCsv}=require('../common/csv_reader');
const {sourceIssues}=require('../source_issues');

const headings={
 investment_objective:'투자목적 및 펀드 개요',
 investment_target:'투자대상 및 투자제한',
 investment_strategy:'투자전략 및 위험관리',
 risk:'투자위험',
 purchase_redemption:'매입·환매·전환',
 pricing:'기준가격',
 fees:'수수료·보수 및 비용',
 performance:'투자실적 및 수익률',
 asset_composition:'자산구성 및 AUM',
 tax_distribution:'이익분배 및 과세'
};
const maxSectionSpan={investment_objective:8,investment_target:15,investment_strategy:15,risk:16,purchase_redemption:10,pricing:5,fees:12,tax_distribution:8};
const coreSections=['investment_strategy','risk','fees'];

function compact(text){return text.replace(/\s+/g,'');}
function cleanText(text){
 return text
  .replace(/페이지\s*\d+\s*\/\s*\d+/g,' ')
  .replace(/\s+/g,' ')
  .trim();
}
function hash(text){return crypto.createHash('sha256').update(text,'utf8').digest('hex');}

function detectTopLevelSection(text,currentSection){
 const value=compact(text);
 const rules=[
  ['investment_objective',/(?:^|[^0-9])7\.?(?:집합투자기구의)?투자목적/],
  ['investment_target',/(?:^|[^0-9])8\.?(?:집합투자기구의)?투자대상/],
  ['investment_strategy',/(?:^|[^0-9])9\.?(?:집합투자기구의)?투자전략/],
  ['risk',/(?:^|[^0-9])10\.?(?:집합투자기구의)?투자위험/],
  ['purchase_redemption',/(?:^|[^0-9])11\.?매입,환매(?:,전환)?(?:절차및기준가격적용기준|기준|및전환기준)?/],
  ['pricing',/(?:^|[^0-9])12\.?기준가격/],
  ['fees',/(?:^|[^0-9])13\.?보수및수수료/],
  ['tax_distribution',/(?:^|[^0-9])14\.?이익분배및과세에관한사항/]
 ];
 let selected=null,selectedIndex=-1;
 for(const[section,pattern]of rules){
  const match=value.match(pattern);
  if(!match)continue;
  const context=value.slice(Math.max(0,match.index-18),match.index);
  // "제2부의 11. 매입·환매 참조"처럼 본문에서 다른 절을 가리키는
  // 문구는 실제 절 시작이 아니므로 제외한다.
  if(section==='purchase_redemption'&&/(?:제[0-9]부의|아래|상기|참조)/.test(context))continue;
  if(match.index>=selectedIndex){selected=section;selectedIndex=match.index;}
 }
 return selected;
}

function detectSpecificSection(text,currentSection){
 const value=compact(text);
 if(/10\.?(?:집합투자기구의)?투자위험/.test(value))return'risk';
 if(/주요투자전략및위험관리/.test(value))return'investment_strategy';
 if(/집합투자기구의투자실적추이|연평균수익률|연도별수익률|투자실적추이/.test(value))return'performance';
 if(/집합투자기구(?:의)?자산구성현황|집합투자기구(?:의)?자산구성내역|자산구성현황\(단위/.test(value))return'asset_composition';
 if(/집합투자기구에부과되는보수및비용|수수료및보수비용의투자기간별예시|성과연동운용보수율산정/.test(value))return'fees';
 if((!currentSection||['risk','investment_strategy'].includes(currentSection))&&/세부구분투자위험주요내용|투자원본손실위험|일반위험.*특수위험/.test(value))return'risk';
 if((!currentSection||['investment_target','investment_strategy'].includes(currentSection))&&/투자전략(?:및위험관리|,위험관리|및수익구조)|주요투자전략|위험관리방법/.test(value))return'investment_strategy';
 if(/매입,환매,전환기준|매입및환매절차|환매수수료/.test(value)&&!['fees','tax_distribution'].includes(currentSection))return'purchase_redemption';
 if(/이익분배및과세에관한사항|집합투자기구의과세|수익자에대한과세/.test(value))return'tax_distribution';
 return currentSection;
}

function splitText(text,maxLength=2200,overlap=180){
 if(text.length<=maxLength)return[text];
 const sentences=text.split(/(?<=[.!?다요함됨])\s+/).filter(Boolean),parts=[];let current='';
 for(const sentence of sentences){
  if(current&&current.length+sentence.length+1>maxLength){
   parts.push(current.trim());
   const tail=current.slice(Math.max(0,current.length-overlap));
   current=`${tail} ${sentence}`;
  }else current+=`${current?' ':''}${sentence}`;
 }
 if(current.trim())parts.push(current.trim());
 return parts;
}

function shouldKeep(section,text){
 if(!section||!headings[section])return false;
 if(text.length<80)return false;
 const value=compact(text);
 if(/목차제1부|투자결정시유의사항안내/.test(value)&&text.length<800)return false;
 return true;
}

async function extractRagChunks(root){
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const processed=path.join(root,'data','processed');
 const documents=readCsv(path.join(processed,'documents.csv'));
 const funds=readCsv(path.join(processed,'funds.csv'));
 const classes=readCsv(path.join(processed,'classes.csv'));
 const fundById=new Map(funds.map(fund=>[fund.fund_id,fund]));
 const documentById=new Map(documents.map(document=>[document.doc_id,document]));
 const chunks=[];const seenChunkKeys=new Set();const auditDocuments=[];let sequence=1,totalPages=0,selectedPages=0;

 for(const document of documents){
  const absolutePath=path.join(root,document.file_path);
  const pdf=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(absolutePath)),disableWorker:true}).promise;
  const fund=fundById.get(document.fund_id);let currentSection=null,currentSectionStart=null,documentSelectedPages=0,documentChunks=0,textPages=0;
  const sectionCounts={};
  totalPages+=pdf.numPages;
  for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
   const content=await(await pdf.getPage(pageNo)).getTextContent();
   const rawText=content.items.map(item=>item.str).join(' ');
   const text=cleanText(rawText);
   if(text.length>=40)textPages++;
   const compactText=compact(text);
   if(/제3부집합투자기구의재무및운용실적|제4부집합투자기구관련회사에관한사항|제5부기타투자자보호를위해필요한사항/.test(compactText)){currentSection=null;currentSectionStart=null;}
   const anchoredSection=detectTopLevelSection(text,currentSection);
   if(anchoredSection){currentSection=anchoredSection;currentSectionStart=pageNo;}
   if(currentSection&&currentSectionStart&&pageNo-currentSectionStart>=maxSectionSpan[currentSection]){currentSection=null;currentSectionStart=null;}
   const section=detectSpecificSection(text,currentSection);
   if(!shouldKeep(section,text))continue;
   documentSelectedPages++;selectedPages++;sectionCounts[section]=(sectionCounts[section]||0)+1;
   const parts=splitText(text);
   for(let partIndex=0;partIndex<parts.length;partIndex++){
    const part=parts[partIndex],chunkHash=hash(part),dedupeKey=`${document.doc_id}|${pageNo}|${section}|${chunkHash}`;
    if(seenChunkKeys.has(dedupeKey))continue;
    seenChunkKeys.add(dedupeKey);documentChunks++;
    chunks.push({chunk_id:`CHUNK${String(sequence++).padStart(6,'0')}`,company_name:document.company_name,fund_id:document.fund_id,fund_name_normalized:fund?.fund_name_normalized||'',section,heading:headings[section],text:part,doc_id:document.doc_id,page:pageNo,source_file:document.file_name,chunk_index_on_page:partIndex+1,chunk_hash:chunkHash,quality_status:'NORMAL'});
   }
  }
  const missingCoreSections=coreSections.filter(section=>!sectionCounts[section]);
  auditDocuments.push({doc_id:document.doc_id,file_name:document.file_name,company_name:document.company_name,fund_id:document.fund_id,total_pages:pdf.numPages,text_pages:textPages,selected_pages:documentSelectedPages,chunks:documentChunks,section_page_counts:sectionCounts,missing_core_sections:missingCoreSections,status:documentChunks?'CHUNKED':'NO_MATCHED_SECTION'});
 }

 for(const fund of funds){
  const datedClasses=classes.filter(row=>row.fund_id===fund.fund_id&&row.class_inception_status);
  if(!datedClasses.length)continue;
  const document=documentById.get(fund.source_doc_id);
  const pages=[...new Set(datedClasses.flatMap(row=>{
   const match=String(row.source_text||'').match(/\[p\.([^\]]+)\]\s*클래스 최초설정일/);
   return match?match[1].split('|'):[];
  }).filter(Boolean))].join('|');
  const inceptionLabel=row=>row.class_inception_status==='ESTABLISHED'?row.class_inception_date:row.class_inception_status==='NOT_ESTABLISHED'?'미설정':row.class_inception_status==='NOT_DISCLOSED'?'원문 미공시':'확인 필요';
  const details=datedClasses.map(row=>`${row.class_name_raw}(${row.class_code}): ${inceptionLabel(row)}`).join('; ');
  const text=`${fund.fund_name_normalized} 클래스별 최초설정일. ${details}. 미설정은 원문에서 설정 전으로 확인된 경우이며, 원문 미공시는 날짜를 추정하지 않고 NULL로 보존했다.`;
  chunks.push({chunk_id:`CHUNK${String(sequence++).padStart(6,'0')}`,company_name:document.company_name,fund_id:fund.fund_id,fund_name_normalized:fund.fund_name_normalized,section:'class_inception',heading:'클래스별 최초설정일',text,doc_id:document.doc_id,page:pages,source_file:document.file_name,chunk_index_on_page:1,chunk_hash:hash(text),quality_status:'NORMAL'});
 }

 for(const issue of sourceIssues){
  const text=`[${issue.issue_id}] 상태 ${issue.status}; 공식 확인 ${issue.official_confirmation}; 심각도 ${issue.severity}; 신뢰도 ${issue.confidence}. 원문(${issue.source_page}쪽): ${issue.source_value}. 채택값: ${issue.adopted_value}. 처리: ${issue.handling_action}. 판단 근거: ${issue.reason}`;
  chunks.push({chunk_id:`CHUNK${String(sequence++).padStart(6,'0')}`,company_name:issue.company_name,fund_id:issue.fund_id,fund_name_normalized:issue.fund_name_normalized,section:'source_quality_issue',heading:'PDF 원문 품질 이슈',text,doc_id:issue.source_doc_id,page:issue.source_page,source_file:issue.file_name,chunk_index_on_page:1,chunk_hash:hash(text),quality_status:issue.status,issue_id:issue.issue_id,issue_status:issue.status});
 }

 const globalDuplicateHashes=Object.entries(chunks.reduce((result,chunk)=>(result[chunk.chunk_hash]=(result[chunk.chunk_hash]||0)+1,result),{})).filter(([,count])=>count>1).map(([chunk_hash,count])=>({chunk_hash,count}));
 const withinDocumentDuplicateKeys=Object.entries(chunks.reduce((result,chunk)=>{const key=`${chunk.doc_id}|${chunk.chunk_hash}`;result[key]=(result[key]||0)+1;return result;},{})).filter(([,count])=>count>1).map(([key,count])=>({key,count}));
 const audit={generated_at:new Date().toISOString(),documents_total:documents.length,documents_chunked:auditDocuments.filter(row=>row.chunks>0).length,documents_without_chunks:auditDocuments.filter(row=>row.chunks===0).map(row=>({doc_id:row.doc_id,file_name:row.file_name,company_name:row.company_name,fund_id:row.fund_id,text_pages:row.text_pages})),documents_missing_core_sections:auditDocuments.filter(row=>row.missing_core_sections.length).map(row=>({doc_id:row.doc_id,file_name:row.file_name,fund_id:row.fund_id,missing_core_sections:row.missing_core_sections})),pdf_pages_total:totalPages,pdf_pages_selected:selectedPages,chunks_total:chunks.length,source_issue_chunks:sourceIssues.length,empty_chunks:chunks.filter(chunk=>!chunk.text).length,missing_provenance_chunks:chunks.filter(chunk=>!chunk.doc_id||!chunk.fund_id||!chunk.page||!chunk.section||!chunk.source_file).length,within_document_duplicate_hash_groups:withinDocumentDuplicateKeys.length,cross_document_duplicate_hash_groups:globalDuplicateHashes.length,section_chunk_counts:chunks.reduce((result,chunk)=>(result[chunk.section]=(result[chunk.section]||0)+1,result),{}),documents:auditDocuments};
 return{chunks,audit};
}

module.exports={extractRagChunks,detectTopLevelSection,detectSpecificSection,splitText};
