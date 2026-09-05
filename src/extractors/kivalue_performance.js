const periods=['1Y','2Y','3Y','5Y','SINCE_INCEPTION'];
const rows=[[null,[5.80,5.11,3.74,2.61,2.77],[6.19,5.54,2.89,1.65,2.88]],['CLASS000241',[5.23,4.54,3.18,2.06,2.33],[6.19,5.54,2.89,1.65,2.88]],['CLASS000242',[5.44,4.75,3.39,2.27,2.18],[6.19,5.54,2.89,1.65,2.55]],['CLASS000243',[5.42,4.73,3.37,2.25,2.08],[6.19,5.54,2.89,1.65,2.16]]];
function extractKivaluePerformance(){const out=[];for(const[c,r,b]of rows)for(let i=0;i<5;i++)out.push({class_id:c,fund_id:'FUND000019',period:periods[i],return_pct:r[i],benchmark_return_pct:b[i],as_of_date:'2025-01-15',source_doc_id:'DOC000019',source_page:35,source_text:`[p.35] 연평균수익률; ${periods[i]} ${r[i]}%; 비교지수 ${b[i]}%`});return out}
module.exports={extractKivaluePerformance};
