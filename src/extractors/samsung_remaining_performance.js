const p=['1Y','2Y','3Y','5Y','SINCE_INCEPTION'];const rows=[
 [656,'FUND000047','DOC000049','C','2025-02-20',[3.44,3.25,2.12,1.11,1.05],[4.53,4.33,3.13,2.11,3.51]],
 [659,'FUND000048','DOC000050','A','2025-07-07',[null,null,null,null,null],[null,null,null,null,null]],
 [675,'FUND000049','DOC000051','C','2026-01-02',[2.28,3.02,3.41,2.22,1.93],[2.48,3.14,3.43,2.37,2.96]],
 [678,'FUND000050','DOC000052','C','2025-01-10',[5.50,6.53,-3.82,4.02,3.58],[-.71,3.49,-4.50,2.70,5.11]],
 [681,'FUND000051','DOC000053','C','2026-01-02',[99.84,34.01,30.89,11.80,10.31],[96.42,31.57,28.85,10.07,6.74]]];
function extractSamsungRemainingPerformance(){const out=[];for(const[id,f,d,n,date,v,b]of rows)v.forEach((x,i)=>{if(x!==null)out.push({class_id:`CLASS${String(id).padStart(6,'0')}`,fund_id:f,period:p[i],return_pct:x,benchmark_return_pct:b[i],as_of_date:date,source_doc_id:d,source_page:'7',source_text:`[p.7] 연평균수익률; ${n}; ${p[i]} ${x}%; 비교지수 ${b[i]}%`});});return out;}module.exports={extractSamsungRemainingPerformance};
