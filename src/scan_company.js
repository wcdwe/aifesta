const fs=require('fs'),path=require('path');
(async()=>{
 const company=process.argv[2]; if(!company)throw new Error('company required');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'); const base=path.join(__dirname,'..','data','투자설명서',company);
 for(const file of fs.readdirSync(base).filter(x=>x.toLowerCase().endsWith('.pdf'))){
  const pdf=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(path.join(base,file))),disableWorker:true}).promise;
  console.log(JSON.stringify({file,pages:pdf.numPages}));
  for(let n=1;n<=pdf.numPages;n++){
   const items=(await (await pdf.getPage(n)).getTextContent()).items; const text=items.map(x=>x.str).join(' ').replace(/\s+/g,' ');
   if(/집합투자기구 명칭|펀드코드|보수 및 수수료|연평균수익률|연도별 수익률|운용실적|운용자산 규모|투자전략|투자위험/.test(text))
    console.log(JSON.stringify({page:n,text:text.slice(0,500)}));
  }
 }
})().catch(e=>{console.error(e);process.exitCode=1});
