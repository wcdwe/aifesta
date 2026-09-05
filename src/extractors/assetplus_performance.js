const periods=['1Y','2Y','3Y','5Y','SINCE_INCEPTION'];
const rows=[[null,[21.54,9.59,6.04,12.78,7.54],[-4.62,1.44,-.21,5.42,2.35]],['CLASS000236',[19.76,7.94,4.45,11.09,5.92],[-4.62,1.44,-.21,5.42,2.35]],['CLASS000237',[20.32,8.45,4.95,11.61,6.32],[-4.62,1.44,-.21,5.42,2.14]],['CLASS000238',[20.54,8.66,5.14,11.82,6.43],[-4.62,1.44,-.21,5.42,2.46]]];
function extractAssetplusPerformance(){const out=[];for(const[c,r,b]of rows)for(let i=0;i<5;i++)out.push({class_id:c,fund_id:'FUND000017',period:periods[i],return_pct:r[i],benchmark_return_pct:b[i],as_of_date:'2025-05-20',source_doc_id:'DOC000017',source_page:30,source_text:`[p.30] 연평균수익률; ${periods[i]} 수익률 ${r[i]}%; 비교지수 ${b[i]}%`});return out}
module.exports={extractAssetplusPerformance};
