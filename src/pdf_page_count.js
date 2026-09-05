const fs=require('fs');
(async()=>{const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');for(const file of process.argv.slice(2)){const pdf=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(file)),disableWorker:true}).promise;console.log(`${file}\t${pdf.numPages}`);}})().catch(error=>{console.error(error);process.exitCode=1;});
