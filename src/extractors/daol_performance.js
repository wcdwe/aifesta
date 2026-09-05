const periods=['1Y','2Y','3Y','5Y','SINCE_INCEPTION'];
const ids={A:415,C:416,Ce:417,CI:418,CI2:419,CF:420,Ae:421,CI3:422,CW:423,CP:424,'C-P':425,Ag:426,Cg:427,CPe:428,'C-Pe':429};
const rows=[['A',[4.98,3.63,2.79,1.80,1.37]],['Ae',[5.04,3.70,2.85,1.86,1.34]],['C',[4.88,3.54,2.70,1.71,1.31]],['Ce',[4.99,3.65,2.80,1.81,1.38]],['CF',[5.08,3.74,2.89,1.90,1.31]],['Cg',[4.96,3.62,2.77,1.78,1.25]],['CI',[null,null,null,null,.03]],['CI2',[5.04,3.70,2.85,1.86,1.42]],['CP',[4.96,3.61,2.77,1.78,1.37]],['C-P',[4.95,3.60,2.76,1.77,1.37]],['CPe',[5.03,3.69,2.84,1.85,1.32]],['C-Pe',[5.02,3.68,2.83,1.84,1.31]],['CW',[5.09,3.75,2.90,1.91,1.49]],['CI3',[null,null,null,null,-.41]]];
const benchmark=[3.76,3.74,2.88,2.02,1.82];
function extractDaolPerformance(){const out=[];for(const[n,v]of rows)for(let i=0;i<5;i++){if(v[i]===null)continue;out.push({class_id:`CLASS${String(ids[n]).padStart(6,'0')}`,fund_id:'FUND000031',period:periods[i],return_pct:v[i],benchmark_return_pct:benchmark[i],as_of_date:'2025-01-12',source_doc_id:'DOC000033',source_page:37,source_text:`[p.37] 연평균수익률; ${n}; ${periods[i]} ${v[i]}%; 비교지수 ${benchmark[i]}%`});}return out;}
module.exports={extractDaolPerformance};
