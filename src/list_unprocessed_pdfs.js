const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const sourceRoot=path.join(root,'data','투자설명서');
const documentsText=fs.readFileSync(path.join(root,'data','processed','documents.csv'),'utf8');
const processed=new Set(documentsText.match(/R2_[^",\r\n]+\.pdf/g)||[]);
const duplicatesText=fs.readFileSync(path.join(root,'data','validation','duplicate_pdf_files.csv'),'utf8');
const knownDuplicates=new Set(duplicatesText.match(/R2_[^",\r\n]+\.pdf/g)||[]);
const rows=[];
for(const company of fs.readdirSync(sourceRoot)){
  const companyPath=path.join(sourceRoot,company);
  if(!fs.statSync(companyPath).isDirectory())continue;
  for(const file of fs.readdirSync(companyPath))if(file.toLowerCase().endsWith('.pdf')&&!processed.has(file))rows.push({company,file,known_duplicate:knownDuplicates.has(file)});
}
console.log(JSON.stringify({raw_pdf_count:[...processed].length+rows.length,processed_document_count:processed.size,unprocessed:rows},null,2));
