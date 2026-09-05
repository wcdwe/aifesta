const fs=require('fs');
const path=require('path');
const {extractPhase1,COMPANY}=require('./midas_asset');
const {extractDbPhase1}=require('./db_asset');
const {extractKcgiPhase1}=require('./kcgi_asset');
const {extractBaringsPhase1}=require('./barings_asset');
const {extractHeungkukPhase1}=require('./heungkuk_asset');
const {extractEugenePhase1}=require('./eugene_asset');
const {extractDsPhase1}=require('./ds_asset');
const {extractTrustonPhase1}=require('./truston_asset');
const {extractSparxPhase1}=require('./sparx_asset');
const {extractVipPhase1}=require('./vip_asset');
const {extractAssetplusPhase1}=require('./assetplus_asset');
const {extractViPhase1}=require('./vi_asset');
const {extractKivaluePhase1}=require('./kivalue_asset');
const {extractKoreitPhase1}=require('./koreit_asset');
const {sourceIssues}=require('../source_issues');

const sections={
 'R2_KR5157420003.pdf':[{pages:[18,19],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[20,21,22],section:'risk_other',heading:'투자위험'}],
 'R2_KR5157450017.pdf':[{pages:[17,18,19],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[20,21,22],section:'risk_other',heading:'투자위험'}],
 'R2_KR5157450090.pdf':[{pages:[23,24],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[25,26],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5131420007.pdf':[{pages:[19],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[20,21],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5131420025.pdf':[{pages:[17],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[18,19],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5147430065.pdf':[{pages:[19,20,21,22,23,24],section:'investment_strategy',heading:'목표전환형 투자전략 및 위험관리'},{pages:[25,26,27],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR515302022M.pdf':[{pages:[20,21,22],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[23,24],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5156450026.pdf':[{pages:[19,20],section:'investment_strategy',heading:'고배당주 투자전략'},{pages:[21,22,23],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR555202013M.pdf':[{pages:[15],section:'investment_strategy',heading:'고배당주 투자전략'},{pages:[16,17,18],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5139420015.pdf':[{pages:[20],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[21,22,23],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5139420020.pdf':[{pages:[20],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[21,22,23],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5122420005.pdf':[{pages:[23,24],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[25,26,27,28],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5169950018.pdf':[{pages:[20,21],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[22,23,24,25],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5172450019.pdf':[{pages:[17,18],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[18,19,20],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5194450018.pdf':[{pages:[22,23,24,25],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[25,26,27],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR514X450008.pdf':[{pages:[21,22,23,24],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[25,26,27],section:'risk_other',heading:'투자위험'},{pages:[34,35,36,37],section:'fees',heading:'보수 및 비용 / 성과연동 운용보수'}]
 ,'R2_KR516702010M.pdf':[{pages:[15,16],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[17,18],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5116501001.pdf':[{pages:[23,24,25],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[25,26,27],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5174420011.pdf':[{pages:[18,19],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[19,20,21],section:'risk_other',heading:'투자위험'}]
 ,'R2_KR5160420009.pdf':[{pages:[18,19],section:'investment_strategy',heading:'투자전략 및 위험관리'},{pages:[20,21,22],section:'risk_other',heading:'투자위험'}]
};

function splitText(text,max=2400){
 const lines=text.split('\n').map(x=>x.trim()).filter(Boolean),out=[]; let current='';
 for(const line of lines){
  if(current&&current.length+line.length+1>max){out.push(current);current='';}
  current+=(current?'\n':'')+line;
 }
 if(current)out.push(current); return out;
}

async function extractMidasChunks(root){
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const midas=extractPhase1(root,'2026-08-31'),db=extractDbPhase1(root,'2026-08-31'),kcgi=extractKcgiPhase1(root,'2026-08-31'),barings=extractBaringsPhase1(root,'2026-08-31'),heungkuk=extractHeungkukPhase1(root,'2026-08-31'),eugene=extractEugenePhase1(root,'2026-08-31'),ds=extractDsPhase1(root,'2026-08-31'),truston=extractTrustonPhase1(root,'2026-08-31'),sparx=extractSparxPhase1(root,'2026-08-31'),vip=extractVipPhase1(root,'2026-08-31'),assetplus=extractAssetplusPhase1(root,'2026-08-31'),vi=extractViPhase1(root,'2026-08-31'),kivalue=extractKivaluePhase1(root,'2026-08-31'),koreit=extractKoreitPhase1(root,'2026-08-31'); const documents=[...midas.documents,...db.documents,...kcgi.documents,...barings.documents,...heungkuk.documents,...eugene.documents,...ds.documents,...truston.documents,...sparx.documents,...vip.documents,...assetplus.documents,...vi.documents,...kivalue.documents,...koreit.documents],funds=[...midas.funds,...db.funds,...kcgi.funds,...barings.funds,...heungkuk.funds,...eugene.funds,...ds.funds,...truston.funds,...sparx.funds,...vip.funds,...assetplus.funds,...vi.funds,...kivalue.funds,...koreit.funds]; const chunks=[]; let seq=1;
 for(const document of documents){
  const fund=funds.find(x=>x.fund_id===document.fund_id);
  const bytes=new Uint8Array(fs.readFileSync(path.join(root,document.file_path)));
  const pdf=await pdfjs.getDocument({data:bytes,disableWorker:true}).promise;
  for(const spec of sections[document.file_name])for(const pageNo of spec.pages){
   const content=await (await pdf.getPage(pageNo)).getTextContent();
   const text=content.items.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim();
   for(const part of splitText(text))chunks.push({
    chunk_id:`CHUNK${String(seq++).padStart(6,'0')}`,company_name:document.company_name,fund_id:document.fund_id,
    fund_name_normalized:fund.fund_name_normalized,section:spec.section,heading:spec.heading,
    text:part,doc_id:document.doc_id,page:pageNo
   });
  }
 }
 for(const issue of sourceIssues){
  const fund=funds.find(x=>x.fund_id===issue.fund_id);
  chunks.push({
   chunk_id:`CHUNK${String(seq++).padStart(6,'0')}`,company_name:issue.company_name,fund_id:issue.fund_id,
   fund_name_normalized:fund?.fund_name_normalized||issue.fund_name_normalized,section:'source_quality_issue',heading:'PDF 원문 품질 이슈',
   text:`[${issue.issue_id}] 상태 ${issue.status}; 공식 확인 ${issue.official_confirmation}; 심각도 ${issue.severity}; 신뢰도 ${issue.confidence}. 원문(${issue.source_page}쪽): ${issue.source_value}. 채택값: ${issue.adopted_value}. 처리: ${issue.handling_action}. 판단 근거: ${issue.reason}`,
   doc_id:issue.source_doc_id,page:issue.source_page,issue_id:issue.issue_id,issue_status:issue.status
  });
 }
 return chunks;
}
module.exports={extractMidasChunks};
