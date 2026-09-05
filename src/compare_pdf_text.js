const fs=require('fs');

async function extract(file,pdfjs){
  const pdf=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(file)),disableWorker:true}).promise;
  const pages=[];
  for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
    const page=await pdf.getPage(pageNumber);
    const items=(await page.getTextContent()).items;
    pages.push(items.map(item=>item.str).join(' ').replace(/\s+/g,' ').trim());
  }
  return pages;
}

(async()=>{
  const [leftFile,rightFile]=process.argv.slice(2);
  if(!leftFile||!rightFile)throw new Error('Usage: node src/compare_pdf_text.js <left.pdf> <right.pdf>');
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const [left,right]=await Promise.all([extract(leftFile,pdfjs),extract(rightFile,pdfjs)]);
  const differingPages=[];
  for(let i=0;i<Math.max(left.length,right.length);i++)if(left[i]!==right[i])differingPages.push(i+1);
  console.log(JSON.stringify({left_pages:left.length,right_pages:right.length,text_identical:differingPages.length===0,differing_pages:differingPages},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
