const fs=require('fs'),path=require('path');
const DUP='R2_KR518102001M.pdf',periods=['1Y','2Y','3Y','5Y','SINCE_INCEPTION'];
const reviewedAum=new Map([
 ['R2_KR5153420022.pdf',{raw:'72,197',value:72197000000,asOf:'2020-12-31',page:'45|46'}],
 ['R2_KR5153450112.pdf',{raw:'160,467',value:160467000000,asOf:'2025-03-31',page:'70|71'}],
 ['R2_KR5153450431.pdf',{raw:'6,620',value:6620000000,asOf:'2025-06-30',page:'46|47'}],
 ['R2_KR5153451009.pdf',{raw:'5,153',value:5153000000,asOf:'2025-09-30',page:'47|48'}]
]);
const reviewedAumNotApplicable=new Map([
 ['R2_KR5153420339.pdf',{page:'36',reason:'원문 자산구성 현황에 해당사항 없음으로 명시'}]
]);
const reviewedInception=new Map([
 ['R2_KR510902773M.pdf',{date:'2013-08-19',page:'12|13',evidence:'운용전문인력 변경내역 시작일 및 최초 종류 C 설정일'}],
 ['R2_KR510902777M.pdf',{date:'2013-09-30',page:'13|15',evidence:'운용전문인력 변경내역 시작일 및 최초 종류 C 설정일'}],
 ['R2_KR5110501016.pdf',{date:'2006-11-08',page:'11|16',evidence:'집합투자기구 연혁의 투자신탁 최초설정일 및 최초 종류 Crp 설정일'}],
 ['R2_KR5110601022.pdf',{date:'2007-04-05',page:'11|15',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153420022.pdf',{date:'2005-10-28',page:'10|14',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153420063.pdf',{date:'2003-12-30',page:'10|12',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153420079.pdf',{date:'2009-05-11',page:'11|14',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153420105.pdf',{date:'2008-11-18',page:'11|14',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153420318.pdf',{date:'2024-08-01',page:'12|15',evidence:'집합투자기구 연혁의 최초설정일 및 설정된 최초 클래스의 설정일'}],
 ['R2_KR5153450009.pdf',{date:'2006-01-04',page:'9|11',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153450112.pdf',{date:'2005-10-26',page:'11|18',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153450209.pdf',{date:'2015-04-29',page:'9|11',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153450250.pdf',{date:'2015-07-01',page:'9|11',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153450268.pdf',{date:'2014-04-16',page:'11|13',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153450431.pdf',{date:'2012-05-07',page:'11|14',evidence:'집합투자기구 연혁의 펀드 최초설정일; 종류 C 설정일은 2012-05-08'}],
 ['R2_KR5153450658.pdf',{date:'2017-10-23',page:'13|15',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153450772.pdf',{date:'2009-06-05',page:'11|14',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153450785.pdf',{date:'2019-10-21',page:'12|14',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153450791.pdf',{date:'2014-01-15',page:'9|11',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153451009.pdf',{date:'2015-09-22',page:'11|14',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR5153520012.pdf',{date:'2006-01-31',page:'9|12',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}],
 ['R2_KR518101002M.pdf',{date:'2006-01-02',page:'9|12',evidence:'집합투자기구 연혁의 최초설정일 및 최초 클래스 설정일'}]
]);
const reviewedFees=new Map([
 ['R2_KR5153420063.pdf|C-F',{management:0.15,sales:0,trust:0.03,admin:0.02,total:0.20,expense:0.21,page:'24'}],
 ['R2_KR5153420063.pdf|I',{management:0.15,sales:0.03,trust:0.03,admin:0.02,total:0.23,expense:0.23,page:'24'}],
 ['R2_KR5153420339.pdf|A',{management:0.04,sales:0.12,trust:0.01,admin:0.01,total:0.18,expense:0.18,page:'29'}],
 ['R2_KR5153420339.pdf|A-e',{management:0.04,sales:0.06,trust:0.01,admin:0.01,total:0.12,expense:0.12,page:'29'}],
 ['R2_KR5153420339.pdf|AG',{management:0.04,sales:0.084,trust:0.01,admin:0.01,total:0.144,expense:0.144,page:'29'}],
 ['R2_KR5153420339.pdf|C',{management:0.04,sales:0.32,trust:0.01,admin:0.01,total:0.38,expense:0.38,page:'29'}],
 ['R2_KR5153420339.pdf|C-e',{management:0.04,sales:0.16,trust:0.01,admin:0.01,total:0.22,expense:0.22,page:'29'}],
 ['R2_KR5153420339.pdf|CG',{management:0.04,sales:0.224,trust:0.01,admin:0.01,total:0.284,expense:0.284,page:'29'}],
 ['R2_KR5153420339.pdf|C-I',{management:0.04,sales:0.03,trust:0.01,admin:0.01,total:0.09,expense:0.09,page:'29'}],
 ['R2_KR5153420339.pdf|F',{management:0.04,sales:0,trust:0.01,admin:0.01,total:0.06,expense:0.06,page:'29'}],
 ['R2_KR5153420339.pdf|S',{management:0.04,sales:0.05,trust:0.01,admin:0.01,total:0.11,expense:0.11,page:'29'}],
 ['R2_KR5153420339.pdf|C-P',{management:0.04,sales:0.26,trust:0.01,admin:0.01,total:0.32,expense:0.32,page:'29'}],
 ['R2_KR5153420339.pdf|C-Pe',{management:0.04,sales:0.13,trust:0.01,admin:0.01,total:0.19,expense:0.19,page:'29'}],
 ['R2_KR5153420339.pdf|C-P2',{management:0.04,sales:0.2,trust:0.01,admin:0.01,total:0.26,expense:0.26,page:'29'}],
 ['R2_KR5153420339.pdf|C-P2e',{management:0.04,sales:0.1,trust:0.01,admin:0.01,total:0.16,expense:0.16,page:'29'}]
]);
const iso=s=>{const m=s?.match(/(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:null};
const nums=s=>(s.match(/-?\d+(?:\.\d+)?|-/g)||[]).slice(-5).map(v=>v==='-'?null:Number(v));
function extractMiraeBatch(root,date){const audit=JSON.parse(fs.readFileSync(path.join(root,'data','validation','mirae_batch_audit.json'),'utf8')).filter(x=>x.file!==DUP),documents=[],funds=[],classes=[],performance=[],aum=[],issues=[];let ci=699;
 audit.forEach((x,i)=>{const docId=`DOC${String(55+i).padStart(6,'0')}`,fundId=`FUND${String(53+i).padStart(6,'0')}`,cover=x.cover.replace(/\s+/g,' '),sum=x.summary?.text.replace(/\s+/g,' ')||'',ct=x.classes?.text.replace(/\s+/g,' ')||'',pt=x.performance?.text.replace(/\s+/g,' ')||'',ut=x.aum?.text.replace(/\s+/g,' ')||'';const name=cover.match(/1\. 집합투자기구 명칭 (.*?) 2\. 집합투자업자/)?.[1],fundCode=sum.match(/\(([A-Z0-9]{5})\)\s*<요약정보>/)?.[1]||ct.match(/금융투자협회 펀드코드 .*? ([A-Z0-9]{5})\s+종류/)?.[1],risk=Number((sum.match(/투자위험등급\s*(\d)등급/)||cover.match(/(\d)등급으로 분류/))?.[1]),l1=/\(주식\)|\[주식\]/.test(name)?'주식형':'채권형',benchmark=(sum.match(/\(주1\) 비교지수\s*:\s*(.*?)(?:<|\(주2\))/)?.[1]||pt.match(/비교지수는\s*(.*?)(?:이며|이고|\.)/)?.[1]||null)?.trim();documents.push({doc_id:docId,company_name:'미래에셋자산운용',file_name:x.file,file_path:`data/투자설명서/미래에셋자산운용/${x.file}`,document_type:'투자설명서',document_date:iso(cover.match(/작성 기준일\s*(.*?)\s*5\./)?.[1]),effective_date:iso(cover.match(/효력발생일\s*(.*?)\s*6\./)?.[1]),fund_id:fundId,total_pages:x.total_pages,extraction_date:date});funds.push({fund_id:fundId,company_name:'미래에셋자산운용',fund_name_raw:name,fund_name_normalized:name?.replaceAll(' ',''),fund_code:fundCode,management_company:'미래에셋자산운용㈜',asset_type_l1:l1,asset_type_l2:l1==='주식형'?'주식':'채권',investment_region:/미국|글로벌|아시아/.test(name)?'해외':'국내',investment_target:sum.match(/투자목적 (.*?) 2\. 투자전략/)?.[1]||null,risk_grade:risk,risk_grade_text:`${risk}등급`,benchmark,volatility:null,inception_date:null,currency_hedge:null,fund_structure:`투자신탁|증권(${l1})|개방형|추가형|종류형`,tdf_vintage:null,bond_duration_bucket:null,source_doc_id:docId,source_page:`1|${x.summary?.page||''}|${x.classes?.page||''}|${x.performance?.page||''}|${x.aum?.page||''}`,source_text:`[p.1] ${name}; 코드 ${fundCode}; 위험 ${risk}등급`});
 const block=ct.split(/2\. 집합투자기구의 종류/)[0],marks=[...block.matchAll(/종류([A-Za-z0-9-]+)\s+/g)],map=new Map();for(let k=0;k<marks.length;k++){const n=marks[k][1];if(n==='형')continue;const seg=block.slice(marks[k].index+(marks[k][0].length),marks[k+1]?.index||block.length),code=seg.match(/\b[A-Z0-9]{5}\b/)?.[0];if(!code||map.has(n))continue;const classId=`CLASS${String(ci++).padStart(6,'0')}`;map.set(n,classId);classes.push({class_id:classId,fund_id:fundId,class_code:code,class_name_raw:n,class_name_normalized:n,account_type:/P2|rp/.test(n)?'퇴직연금':/-P/.test(n)?'연금저축':'일반',channel:/e$/.test(n)?'온라인':n==='S'?'온라인슈퍼':/F|I/.test(n)?'기관':'오프라인',front_load:/^A$/.test(n)?1:/^A-e|^Ae/.test(n)?.5:0,back_load:n==='S'?.15:0,management_fee:null,sales_fee:null,trust_fee:null,admin_fee:null,total_fee:null,total_expense_ratio:null,source_doc_id:docId,source_page:String(x.classes?.page||''),source_text:`[p.${x.classes?.page}] 종류${n}; 코드 ${code}`});}
 const feeText=x.fees?.text.replace(/\s+/g,' ')||'',feeTable=feeText.split(/구분 지급비용\(연간%\)|구분 지급비용/)[1]||feeText;for(const c of classes.filter(z=>z.fund_id===fundId)){const re=new RegExp(`종류${c.class_name_raw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s+`,'g'),matches=[...feeTable.matchAll(re)];let parsed=null;for(const mm of matches){const seg=feeTable.slice(mm.index+mm[0].length,feeTable.indexOf(' 종류',mm.index+mm[0].length)>0?feeTable.indexOf(' 종류',mm.index+mm[0].length):feeTable.length),ns=seg.match(/(?:^|\s)(-?\d+(?:\.\d+)?|-)(?=\s|$)/g)?.map(v=>v.trim());if(ns?.length>=7){parsed=ns;break;}}if(parsed){const val=i=>parsed[i]==='-'?0:Number(parsed[i]);c.management_fee=val(0);c.sales_fee=val(1);c.trust_fee=val(2);c.admin_fee=val(3);c.total_fee=val(4);c.total_expense_ratio=parsed[6]==='-'?c.total_fee:Number(parsed[6]);c.source_page=`${c.source_page}|${x.fees?.page}`;c.source_text+=`; [p.${x.fees?.page}] 총보수 ${c.total_fee}%`;const componentSum=Number((c.management_fee+c.sales_fee+c.trust_fee+c.admin_fee).toFixed(4));if(Math.abs(componentSum-c.total_fee)>.001||c.total_expense_ratio<c.total_fee){c.management_fee=c.sales_fee=c.trust_fee=c.admin_fee=c.total_fee=c.total_expense_ratio=null;issues.push({file:x.file,field:`class.fees.${c.class_name_raw}`,reason:'보수표 자동 구문분석 불일치로 추정 적재하지 않음'});}}}
 const annual=pt.split(/나\. 연도별 수익률|연도별 수익률 추이/)[0],benchMatch=annual.match(/비교지수\s+(-?\d+(?:\.\d+)?|-)\s+(-?\d+(?:\.\d+)?|-)\s+(-?\d+(?:\.\d+)?|-)\s+(-?\d+(?:\.\d+)?|-)\s+(-?\d+(?:\.\d+)?|-)/),bv=benchMatch?benchMatch.slice(1).map(v=>v==='-'?null:Number(v)):[null,null,null,null,null],asof=(annual.match(/~\s*(\d{2})[.년]\s*(\d{2})[.월]\s*(\d{2})/)||[]);const asOf=asof.length?`20${asof[1]}-${asof[2]}-${asof[3]}`:documents.at(-1).document_date,seen=new Set();
 for(const m of annual.matchAll(/종류([A-Za-z0-9-]+)\s+.*?\s+(-?\d+(?:\.\d+)?|-)\s+(-?\d+(?:\.\d+)?|-)\s+(-?\d+(?:\.\d+)?|-)\s+(-?\d+(?:\.\d+)?|-)\s+(-?\d+(?:\.\d+)?|-)(?=\s+종류|\s+투자신탁)/g)){const id=map.get(m[1]);if(!id)continue;m.slice(2).forEach((v,j)=>{const key=`${id}|${periods[j]}|${asOf}`;if(v!=='-'&&!seen.has(key)){seen.add(key);performance.push({class_id:id,fund_id:fundId,period:periods[j],return_pct:Number(v),benchmark_return_pct:bv[j],as_of_date:asOf,source_doc_id:docId,source_page:String(x.performance?.page||''),source_text:`[p.${x.performance?.page}] 종류${m[1]}; ${periods[j]} ${v}%`});}});}
 const reviewed=reviewedAum.get(x.file),am=reviewed?null:ut.match(/합계\s+((?:[-\d,]+\s+){11})([-\d,]+)/);if(reviewed){aum.push({fund_id:fundId,class_id:null,aum_type:'자산총액',aum_value_raw:`${reviewed.raw}백만원`,aum_value_krw:reviewed.value,aum_unit:'백만원',as_of_date:reviewed.asOf,source_doc_id:docId,source_page:reviewed.page,source_text:`[p.${reviewed.page}] 자산구성 현황; 합계 ${reviewed.raw}백만원`});}else if(am){const raw=am[2];if(raw!=='-'&&!/\s/.test(raw)){const v=Number(raw.replaceAll(',',''));if(Number.isFinite(v))aum.push({fund_id:fundId,class_id:null,aum_type:'자산총액',aum_value_raw:`${raw}백만원`,aum_value_krw:v*1000000,aum_unit:'백만원',as_of_date:(ut.match(/(20\d{2})[.년]\s*(\d{1,2})[.월]\s*(\d{1,2})/)||[]).slice(1).map((z,j)=>j?z.padStart(2,'0'):z).join('-')||documents.at(-1).document_date,source_doc_id:docId,source_page:x.aum.page,source_text:`[p.${x.aum.page}] 자산구성 현황; 합계 ${raw}백만원`});}else issues.push({file:x.file,field:'aum',reason:'자산총액 OCR 분리 오류'});}else issues.push({file:x.file,field:'aum',reason:'자산총액 자동 구문분석 실패'});
 });
 for(const [file,reviewed] of reviewedInception){const doc=documents.find(d=>d.file_name===file),fund=doc&&funds.find(row=>row.fund_id===doc.fund_id);if(!fund)continue;fund.inception_date=reviewed.date;fund.source_page=[...new Set([...String(fund.source_page).split('|').filter(Boolean),...reviewed.page.split('|')])].join('|');fund.source_text+=` | [p.${reviewed.page}] ${reviewed.evidence} ${reviewed.date}`;}
 for(const [key,reviewedFee] of reviewedFees){const [file,className]=key.split('|'),doc=documents.find(d=>d.file_name===file),c=doc&&classes.find(row=>row.fund_id===doc.fund_id&&row.class_name_raw===className);if(!c)continue;c.management_fee=reviewedFee.management;c.sales_fee=reviewedFee.sales;c.trust_fee=reviewedFee.trust;c.admin_fee=reviewedFee.admin;c.total_fee=reviewedFee.total;c.total_expense_ratio=reviewedFee.expense;if(!String(c.source_page).split('|').includes(reviewedFee.page))c.source_page=`${c.source_page}|${reviewedFee.page}`;c.source_text=c.source_text.replace(/; \[p\.\d+\] 총보수 [^;]+%/g,'');c.source_text+=`; [p.${reviewedFee.page}] 검토 확정 총보수 ${c.total_fee}%; 총보수·비용 ${c.total_expense_ratio}%`;for(let j=issues.length-1;j>=0;j--)if(issues[j].file===file&&issues[j].field===`class.fees.${className}`)issues.splice(j,1);}
 for(const [file,reviewedAum] of reviewedAumNotApplicable){const doc=documents.find(d=>d.file_name===file),fund=doc&&funds.find(f=>f.fund_id===doc.fund_id);if(fund){fund.source_page=[...new Set([...String(fund.source_page).split('|').filter(Boolean),reviewedAum.page])].join('|');fund.source_text+=`; [p.${reviewedAum.page}] 자산구성 현황 해당사항 없음`;}for(let j=issues.length-1;j>=0;j--)if(issues[j].file===file&&issues[j].field==='aum')issues.splice(j,1);}
 return{documents,funds,classes,performance,aum,issues,duplicate:{file_name:DUP,duplicate_of:'R2_KR5153450009.pdf',reason:'동일 펀드명·작성기준일·클래스 코드·성과·AUM'}};}module.exports={extractMiraeBatch};
