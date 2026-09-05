const fs=require('fs');
const path=require('path');
const {extractRagChunks}=require('./extractors/rag_chunks');
(async()=>{
 const root=path.resolve(__dirname,'..'); const {chunks:rows,audit}=await extractRagChunks(root);
 const file=path.join(root,'data','processed','chunks.jsonl'); fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,rows.map(x=>JSON.stringify(x)).join('\n')+'\n','utf8');
 const auditFile=path.join(root,'data','validation','rag_chunk_audit.json');fs.writeFileSync(auditFile,JSON.stringify(audit,null,2)+'\n','utf8');
 if(rows.some(x=>!x.text||!x.doc_id||!x.page||!x.fund_id||!x.section||!x.source_file))throw new Error('chunk provenance validation failed');
 if(audit.documents_without_chunks.length)throw new Error(`documents without chunks: ${audit.documents_without_chunks.map(x=>x.file_name).join(', ')}`);
 console.log(JSON.stringify({chunks:rows.length,documents:audit.documents_total,documents_chunked:audit.documents_chunked,pages_selected:audit.pdf_pages_selected,source_issue_chunks:audit.source_issue_chunks,file,audit_file:auditFile},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
