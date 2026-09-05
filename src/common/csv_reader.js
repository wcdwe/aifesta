const fs=require('fs');

function readCsv(file){
 const source=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');
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
 if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
 const headers=rows.shift()||[];
 return rows.filter(current=>current.some(Boolean)).map(current=>Object.fromEntries(headers.map((key,index)=>[key,current[index]??''])));
}

module.exports={readCsv};
