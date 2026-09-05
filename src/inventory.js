const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','data','투자설명서');
for(const d of fs.readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory())){
 const files=fs.readdirSync(path.join(root,d.name)).filter(x=>x.toLowerCase().endsWith('.pdf'));
 console.log(JSON.stringify({company:d.name,count:files.length,files}));
}
