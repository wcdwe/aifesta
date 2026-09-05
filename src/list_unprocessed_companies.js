const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),source=path.join(root,'data','투자설명서');
const csv=fs.readFileSync(path.join(root,'data','processed','documents.csv'),'utf8');
for(const company of fs.readdirSync(source,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name)){
  const files=fs.readdirSync(path.join(source,company)).filter(x=>x.toLowerCase().endsWith('.pdf'));
  const done=files.filter(file=>csv.includes(file));
  if(done.length<files.length)console.log(JSON.stringify({company,total:files.length,done:done.length,pending:files.filter(x=>!done.includes(x))}));
}
