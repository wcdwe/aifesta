const audit=require('../../data/validation/midas_table_audit.json');
const {extractMidasClasses}=require('./midas_classes');

const specs=[
 {file:'R2_KR5157420003.pdf',fund_id:'FUND000001',doc_id:'DOC000001',pages:[46,47,48],as_of_date:'2025-07-29',minY:{48:250}},
 {file:'R2_KR5157450017.pdf',fund_id:'FUND000002',doc_id:'DOC000002',pages:[47,48],as_of_date:'2025-04-19',minY:{}},
 {file:'R2_KR5157450090.pdf',fund_id:'FUND000003',doc_id:'DOC000003',pages:[60,61,62],as_of_date:'2025-10-01',minY:{62:250}}
];
const periods=['1Y','2Y','3Y','5Y','SINCE_INCEPTION'];
const continuedLabels=new Map([
 ['R2_KR5157450090.pdf|60|마이다스거북이90증권','마이다스 거북이 90 증권 자투자신탁 1 호 ( 주식 )C1']
]);

function rowText(row){return row.cells.map(c=>c.text).join(' ').replace(/\s+/g,' ').trim();}
function dateCell(row){return row.cells.find(c=>/^\d{4}-\d{2}-\d{2}$/.test(c.text.trim()));}
function valuesAfter(row,x){return row.cells.filter(c=>c.x>x&&/^-?\d+(\.\d+)?$|^-$/.test(c.text.trim())).map(c=>c.text.trim()).slice(0,5);}
function classToken(label,fundClasses){
 const compact=label.replace(/\s+/g,'');
 const tail=compact.slice(compact.lastIndexOf(')')+1);
 return fundClasses.map(c=>c.class_name_normalized).sort((a,b)=>b.length-a.length)
  .find(token=>tail===token||tail.endsWith(token))||null;
}

function extractMidasPerformance(){
 const classes=extractMidasClasses(),out=[],issues=[];
 for(const spec of specs){
  const fundClasses=classes.filter(c=>c.fund_id===spec.fund_id); let lastClass=null;
  for(const pageNo of spec.pages){
   const rows=audit[spec.file][pageNo].filter(r=>r.y>=(spec.minY[pageNo]||0));
   let previousEvent=-1;
   for(let i=0;i<rows.length;i++){
    const row=rows[i],text=rowText(row),date=dateCell(row);
    if(!date)continue;
    const vals=valuesAfter(row,date.x);
    if(vals.length<5)continue;
    if(text.includes('수익률 변동성')){previousEvent=i;continue;}
    if(text.includes('비교지수')){
      if(lastClass){for(let j=0;j<5;j++)if(lastClass[j])lastClass[j].benchmark_return_pct=vals[j]==='-'?null:Number(vals[j]);}
      previousEvent=i;continue;
    }
    let nextEvent=i+1;
    while(nextEvent<rows.length){const d=dateCell(rows[nextEvent]);if(d&&valuesAfter(rows[nextEvent],d.x).length>=5)break;nextEvent++;}
    const extractedLabel=rows.slice(previousEvent+1,nextEvent).flatMap(r=>r.cells.filter(c=>c.x<date.x).map(c=>c.text)).join(' ').replace(/\s+/g,' ').trim();
    const continuationKey=`${spec.file}|${pageNo}|${extractedLabel.replace(/\s+/g,'')}`;
    const label=continuedLabels.get(continuationKey)||extractedLabel;
    const token=classToken(label,fundClasses);
    let cls=token?fundClasses.find(c=>c.class_name_normalized===token):null;
    const isOperating=/운용/.test(label)||(!token&&out.filter(x=>x.fund_id===spec.fund_id).length===0);
    if(!cls&&!isOperating){issues.push({file_name:spec.file,fund_id:spec.fund_id,page:pageNo,label,reason:'수익률 행의 클래스명을 확정하지 못함'});previousEvent=i;lastClass=null;continue;}
    lastClass=[];
    for(let j=0;j<5;j++)if(vals[j]!=='-'){
      const perf={class_id:cls?.class_id||null,fund_id:spec.fund_id,period:periods[j],return_pct:Number(vals[j]),benchmark_return_pct:null,as_of_date:spec.as_of_date,source_doc_id:spec.doc_id,source_page:pageNo,source_text:`[p.${pageNo}] ${label}; 최초설정일 ${date.text}; ${periods[j]} 수익률 ${vals[j]}%`};
      out.push(perf);lastClass[j]=perf;
    }else lastClass[j]=null;
    previousEvent=i;
   }
  }
 }
 return {rows:out,issues};
}
module.exports={extractMidasPerformance};
