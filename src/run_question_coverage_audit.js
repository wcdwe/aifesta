const fs=require('fs');
const path=require('path');
const {readCsv}=require('./common/csv_reader');

const root=path.join(__dirname,'..');
const processed=path.join(root,'data','processed');
const validation=path.join(root,'data','validation');
const csv=file=>readCsv(path.join(processed,file));
const documents=csv('documents.csv');
const funds=csv('funds.csv');
const classes=csv('classes.csv');
const performance=csv('performance.csv');
const aum=csv('aum.csv');
const feeSchedules=csv('class_fee_schedules.csv');
const chunks=fs.readFileSync(path.join(processed,'chunks.jsonl'),'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const sourceIssues=readCsv(path.join(validation,'pdf_source_issues.csv'));

const pct=(value,total)=>Number((100*value/Math.max(1,total)).toFixed(1));
const nonempty=(rows,column)=>rows.filter(row=>String(row[column]??'').trim()!=='').length;
const fundSet=rows=>new Set(rows.map(row=>row.fund_id).filter(Boolean));
const groupCount=(rows,column)=>rows.reduce((out,row)=>(out[row[column]||'NULL']=(out[row[column]||'NULL']||0)+1,out),{});
const sectionFunds=section=>fundSet(chunks.filter(chunk=>chunk.section===section));
const chunkTextByFund=new Map();
for(const chunk of chunks){
 if(!chunkTextByFund.has(chunk.fund_id))chunkTextByFund.set(chunk.fund_id,'');
 chunkTextByFund.set(chunk.fund_id,`${chunkTextByFund.get(chunk.fund_id)} ${chunk.text}`);
}

const performanceFunds=fundSet(performance);
const classFunds=fundSet(classes);
const miraeFundIds=new Set(funds.filter(fund=>fund.company_name==='미래에셋자산운용').map(fund=>fund.fund_id));
const miraeClasses=classes.filter(row=>miraeFundIds.has(row.fund_id));
const aumFunds=fundSet(aum);
const fundLevelPerformance=performance.filter(row=>!row.class_id);
const fundLevel1Y=fundLevelPerformance.filter(row=>row.period==='1Y');
const classPerformance=performance.filter(row=>row.class_id);
const classPerformanceIds=new Set(classPerformance.map(row=>row.class_id));
const sameDate1YGroups=Object.entries(groupCount(fundLevel1Y,'as_of_date')).filter(([date,count])=>date!=='NULL'&&count>=2).map(([as_of_date,fund_count])=>({as_of_date,fund_count})).sort((a,b)=>b.fund_count-a.fund_count);
const equityFunds=funds.filter(fund=>/주식/.test(fund.asset_type_l1));
const bondFunds=funds.filter(fund=>/채권|국공채/.test(`${fund.asset_type_l1} ${fund.asset_type_l2} ${fund.investment_target}`));
const mixedFunds=funds.filter(fund=>/혼합|재간접|집합투자증권/.test(`${fund.asset_type_l1} ${fund.asset_type_l2} ${fund.investment_target} ${fund.fund_structure}`));
const detectedTdfFunds=funds.filter(fund=>/TDF|타깃데이트|타겟데이트|은퇴/.test(`${fund.fund_name_raw} ${fund.fund_name_normalized} ${fund.investment_target}`));
const tdfWithVintage=detectedTdfFunds.filter(fund=>fund.tdf_vintage).length;
const explicitTdfVintageFunds=funds.filter(fund=>fund.tdf_vintage);
const lifecycleLikeFunds=funds.filter(fund=>/라이프사이클/.test(`${fund.fund_name_raw} ${fund.fund_name_normalized}`));
const eligibilityFunds=new Set([...chunkTextByFund].filter(([,text])=>/가입자격|투자자용|가입제한|연금저축계좌|퇴직연금|IRP|Wrap account/i.test(text)).map(([fundId])=>fundId));

const structuredCoverage={
 basic:{fund_name:pct(nonempty(funds,'fund_name_normalized'),funds.length),company:pct(nonempty(funds,'company_name'),funds.length),asset_type_l1:pct(nonempty(funds,'asset_type_l1'),funds.length),investment_target:pct(nonempty(funds,'investment_target'),funds.length),inception_date:pct(nonempty(funds,'inception_date'),funds.length),inception_status:pct(nonempty(funds,'inception_status'),funds.length),scheduled_inception_date:pct(nonempty(funds,'inception_scheduled_date'),funds.length),fund_structure:pct(nonempty(funds,'fund_structure'),funds.length)},
 performance:{funds_with_any_performance:pct(performanceFunds.size,funds.length),funds_with_fund_level_1y:pct(new Set(fundLevel1Y.map(row=>row.fund_id)).size,funds.length),rows_with_as_of_date:pct(nonempty(performance,'as_of_date'),performance.length),rows_with_benchmark:pct(nonempty(performance,'benchmark_return_pct'),performance.length),classes_with_performance:pct(classPerformanceIds.size,classes.length)},
 fees:{funds_with_classes:pct(classFunds.size,funds.length),classes_with_total_fee:pct(nonempty(classes,'total_fee'),classes.length),classes_with_total_expense_ratio:pct(nonempty(classes,'total_expense_ratio'),classes.length),time_dependent_fee_rows:feeSchedules.length},
 classes:{classes:classes.length,account_type:pct(nonempty(classes,'account_type'),classes.length),channel:pct(nonempty(classes,'channel'),classes.length),front_load:pct(nonempty(classes,'front_load'),classes.length),class_inception_date:pct(nonempty(classes,'class_inception_date'),classes.length),class_inception_status:pct(nonempty(classes,'class_inception_status'),classes.length),mirae_classes:miraeClasses.length,mirae_class_inception_status:pct(nonempty(miraeClasses,'class_inception_status'),miraeClasses.length),class_inception_rag_funds:sectionFunds('class_inception').size,eligibility_in_rag_funds:pct(eligibilityFunds.size,funds.length)},
 risk:{risk_grade:pct(nonempty(funds,'risk_grade'),funds.length),volatility:pct(nonempty(funds,'volatility'),funds.length),risk_rag_funds:pct(sectionFunds('risk').size,funds.length)},
 aum:{funds_with_aum:pct(aumFunds.size,funds.length),rows_with_as_of_date:pct(nonempty(aum,'as_of_date'),aum.length),normalized_krw:pct(nonempty(aum,'aum_value_krw'),aum.length)},
 dates:{document_date:pct(nonempty(documents,'document_date'),documents.length),effective_date:pct(nonempty(documents,'effective_date'),documents.length),performance_as_of_date:pct(nonempty(performance,'as_of_date'),performance.length),aum_as_of_date:pct(nonempty(aum,'as_of_date'),aum.length)},
 rag:{strategy_funds:pct(sectionFunds('investment_strategy').size,funds.length),risk_funds:pct(sectionFunds('risk').size,funds.length),fees_funds:pct(sectionFunds('fees').size,funds.length),purchase_redemption_funds:pct(sectionFunds('purchase_redemption').size,funds.length),tax_funds:pct(sectionFunds('tax_distribution').size,funds.length),source_issue_chunks:chunks.filter(chunk=>chunk.section==='source_quality_issue').length}
};

function category(id,name,status,evidence,limitations=[],implementation=[]){return{id,name,status,evidence,limitations,implementation};}
const categories=[
 category('single_product_basic','단일 상품 기본 정보','READY',[`펀드 ${funds.length}건`,structuredCoverage.basic],['미설정 상품은 실제 설정일 대신 상태와 예정일을 구분해 답변']),
 category('returns','수익률 질문','PARTIAL',[`성과 ${performance.length}행`,structuredCoverage.performance],['성과가 없는 신규 펀드가 있으며 기간과 클래스, 기준일을 함께 지정해야 정확함']),
 category('fees','보수/수수료 질문','READY',[`클래스 ${classes.length}건`,structuredCoverage.fees],['시점별·성과연동 보수는 class_fee_schedules 우선 사용']),
 category('classes','클래스 관련 질문','READY_WITH_RAG',[structuredCoverage.classes],['정형 필드에 없는 상세 가입자격은 fees 청크 원문을 조회해야 함']),
 category('risk_grade','위험등급 질문','READY',[structuredCoverage.risk],['위험등급과 개별 위험요인을 구분해 답해야 함']),
 category('aum','AUM/운용규모 질문','PARTIAL',[`AUM ${aum.length}행`,structuredCoverage.aum],[`${funds.length-aumFunds.size}개 펀드는 AUM 정형값이 없음`]),
 category('equity','주식형 특화 질문','READY_WITH_RAG',[`주식 관련 펀드 ${equityFunds.length}건`],['세부 섹터·종목 편입비중은 현재 별도 구조화되지 않음']),
 category('bond','채권/국공채형 질문','READY_WITH_RAG',[`채권 관련 펀드 ${bondFunds.length}건`,`듀레이션 구간 보유 ${nonempty(bondFunds,'bond_duration_bucket')}/${bondFunds.length}`],['신용등급·듀레이션 상세는 RAG 원문 병행']),
 category('mixed_fof','혼합형/재간접형 질문','READY_WITH_RAG',[`혼합·재간접 관련 펀드 ${mixedFunds.length}건`],['정확한 자산별 편입비중은 원문 표 조회 필요']),
 category('tdf','TDF 관련 질문',detectedTdfFunds.length&&tdfWithVintage===detectedTdfFunds.length?'READY':'NOT_READY',[`TDF 명시 상품 ${detectedTdfFunds.length}건`,`빈티지 보유 ${tdfWithVintage}건`,`라이프사이클 유사명칭 ${lifecycleLikeFunds.length}건`],['현재 데이터셋에서 TDF로 명시된 상품이 식별되지 않으며 라이프사이클 상품을 임의로 TDF로 간주하면 안 됨']),
 category('pair_compare','상품 2개 직접 비교','READY',[`fund_id 기준 성과·보수·위험·AUM 조인 가능`],['동일 기간·기준일·클래스로 정규화 후 비교']),
 category('ranking','여러 상품 랭킹 질문','PARTIAL',[`펀드단위 1Y 행 ${fundLevel1Y.length}건`,`동일 기준일 2개 이상 코호트 ${sameDate1YGroups.length}개`],['서로 다른 기준일과 클래스의 수익률을 그대로 순위화하면 안 됨'],['동일 as_of_date·period·대표 클래스 필터 필수']),
 category('multi_filter','다중 조건 검색','READY',[`자산유형·지역·대상·위험등급·클래스·채널·보수·AUM 필터 가능`],['상세 가입자격과 최소가입금액은 RAG 보조']),
 category('as_of','기준일 질문','READY',[structuredCoverage.dates],['문서 작성일, 효력발생일, 성과 기준일, AUM 기준일을 구분']),
 category('customer_situation','고객상황 기반 질문','CONDITIONAL',[structuredCoverage.classes],['연령·투자기간·손실감내도·계좌유형 정보가 없으면 추천 불가'],['적합성 판단 전 역질문 필요']),
 category('insufficient_info','정보 부족시 역질문','AGENT_REQUIRED',['데이터 문제가 아니라 대화 정책·슬롯 수집 문제']),
 category('hallucination_trap','함정/환각 검증 질문','AGENT_REQUIRED',[`원문 이슈 ${sourceIssues.length}건`,`품질 이슈 청크 ${structuredCoverage.rag.source_issue_chunks}건`],['공식 확인되지 않은 오류 후보를 확정 오류라고 말하면 안 됨']),
 category('strategy_risk_rag','투자전략/위험요인 RAG 질문','READY',[structuredCoverage.rag],['답변에 PDF 페이지 출처 표시 필요']),
 category('ambiguous_language','자연어가 애매한 질문','AGENT_REQUIRED',['펀드명·클래스·기간·기준일 엔티티 해소 필요']),
 category('compound','복합 질문','AGENT_REQUIRED',['구조화 검색과 RAG를 한 답변에서 조합해야 함'])
];

const addedCategories=[
 category('benchmark_excess_return','비교지수 및 초과수익 질문','READY',[`비교지수 보유 펀드 ${nonempty(funds,'benchmark')}/${funds.length}`,`비교지수 수익률 보유 성과행 ${nonempty(performance,'benchmark_return_pct')}/${performance.length}`],['같은 기간·기준일로 펀드수익률과 차감']),
 category('risk_return','위험 대비 수익 질문','PARTIAL',[`변동성 보유 펀드 ${nonempty(funds,'volatility')}/${funds.length}`],['샤프지수 계산에 필요한 무위험수익률은 없음']),
 category('track_record','설정일·운용기간 질문','READY',[`실제 설정일 보유 ${nonempty(funds,'inception_date')}/${funds.length}`,`설정 상태 보유 ${nonempty(funds,'inception_status')}/${funds.length}`,`설정 예정일 보유 ${nonempty(funds,'inception_scheduled_date')}/${funds.length}`],['NOT_ESTABLISHED는 운용기간을 계산하지 않음']),
 category('currency_hedge','환헤지 질문','PARTIAL',[`환헤지 정형값 보유 ${nonempty(funds,'currency_hedge')}/${funds.length}`],['NULL은 환헤지 없음이 아니라 미확인']),
 category('eligibility_minimum','가입자격·최소가입금액 질문','READY_WITH_RAG',[`가입자격 관련 원문을 가진 펀드 ${eligibilityFunds.size}/${funds.length}`],['금액 표기가 PDF 추출 과정에서 띄어질 수 있어 키워드+벡터 병행']),
 category('redemption_tax','환매·과세 질문','READY_WITH_RAG',[structuredCoverage.rag],['세법 변경 가능성을 고지하고 문서 기준일 표시']),
 category('source_quality','PDF 오류·상충 질문','READY',[`이슈 레지스트리 ${sourceIssues.length}건`,`연결 품질 청크 ${structuredCoverage.rag.source_issue_chunks}건`],['UNCONFIRMED 상태는 오류 후보라고 표현']),
 category('latest_document','최신 투자설명서 선택 질문','CONDITIONAL',[`문서 ${documents.length}건 / 펀드 ${funds.length}건`],['동일 펀드의 복수 문서가 있어 effective_date 기준 최신본 선택 규칙 필요']),
 category('holdings_sector','보유종목·섹터 비중 질문','NOT_READY',['현재 전용 holdings 테이블 없음'],['원문에 일부 있어도 전수·동일 기준 비교는 보장하지 못함']),
 category('live_market','현재가·오늘 수익률 질문','NOT_READY',['정적 투자설명서 데이터셋'],['실시간 외부 데이터 연결 필요'])
];

const representativeTests=[
 {id:'T01',question:'특정 펀드의 운용사, 유형, 설정일은?',pass:funds.every(row=>row.company_name&&row.asset_type_l1&&row.inception_status&&(row.inception_status==='ESTABLISHED'?row.inception_date:!row.inception_date)),route:['funds']},
 {id:'T02',question:'특정 클래스의 최근 1년 수익률과 기준일은?',pass:performance.some(row=>row.class_id&&row.period==='1Y'&&row.as_of_date&&row.return_pct),route:['performance','classes']},
 {id:'T03',question:'A와 C 클래스의 총보수 차이는?',pass:classes.some(row=>row.class_name_normalized==='A'&&row.total_fee)&&classes.some(row=>row.class_name_normalized==='C'&&row.total_fee),route:['classes']},
 {id:'T04',question:'KCGI 목표전환형의 클래스별 가입자격은?',pass:/가입자격/.test(chunkTextByFund.get('FUND000006')||''),route:['chunks:fees'],expected_pages:['32','33']},
 {id:'T05',question:'위험등급과 주요 위험요인은?',pass:funds.every(row=>row.risk_grade)&&sectionFunds('risk').size===funds.length,route:['funds','chunks:risk']},
 {id:'T06',question:'운용규모와 기준일은?',pass:aum.every(row=>row.aum_value_krw&&row.as_of_date),route:['aum'],coverage_note:`${aumFunds.size}/${funds.length} funds`},
 {id:'T07',question:'동일 기준일 1년 수익률 상위 상품은?',pass:sameDate1YGroups.length>0,route:['performance'],guardrail:'same as_of_date + period + representative class'},
 {id:'T08',question:'투자전략과 환매 위험을 설명해줘',pass:sectionFunds('investment_strategy').size===funds.length&&sectionFunds('risk').size===funds.length,route:['chunks:investment_strategy','chunks:risk']},
 {id:'T09',question:'PDF 원문 오류가 있는 수치야?',pass:sourceIssues.length===chunks.filter(row=>row.section==='source_quality_issue').length,route:['pdf_source_issues','record_issues','chunks:source_quality_issue']},
 {id:'T10',question:'오늘 기준 수익률은?',pass:false,route:[],expected_behavior:'정적 문서 기준 데이터임을 밝히고 실시간 데이터 필요 안내'},
 {id:'T11',question:'TDF 2050 상품을 비교해줘',pass:detectedTdfFunds.length>0,route:['funds','chunks:investment_strategy'],expected_behavior:detectedTdfFunds.length?'식별된 TDF만 비교':'현재 데이터셋에는 TDF로 명시된 상품이 없다고 답하고 라이프사이클 상품과 혼동하지 않음'}
];

const report={
 generated_at:new Date().toISOString(),
 scope:{documents:documents.length,funds:funds.length,classes:classes.length,performance_rows:performance.length,aum_rows:aum.length,chunks:chunks.length,source_issues:sourceIssues.length},
 status_legend:{READY:'구조화 데이터만으로 안정적으로 답변 가능',READY_WITH_RAG:'구조화 데이터와 원문 청크를 함께 사용하면 가능',PARTIAL:'일부 상품 또는 필드만 가능',CONDITIONAL:'정규화·기준일 통제 또는 대화 로직 필요',AGENT_REQUIRED:'데이터보다 에이전트 정책 구현이 핵심',NOT_READY:'현재 데이터 범위 밖'},
 structured_coverage:structuredCoverage,
 dataset_segments:{equity_funds:equityFunds.length,bond_related_funds:bondFunds.length,mixed_or_fund_of_funds:mixedFunds.length,tdf_candidates:detectedTdfFunds.length,tdf_with_vintage:tdfWithVintage,explicit_tdf_vintage_rows:explicitTdfVintageFunds.length,lifecycle_like_funds:lifecycleLikeFunds.map(row=>({fund_id:row.fund_id,fund_name:row.fund_name_normalized})),same_date_1y_ranking_cohorts:sameDate1YGroups.slice(0,20)},
 coverage_gaps:{missing_inception_date:funds.filter(row=>!row.inception_date).map(row=>({fund_id:row.fund_id,fund_name:row.fund_name_normalized,inception_status:row.inception_status,scheduled_date:row.inception_scheduled_date||null})),unresolved_inception_status:funds.filter(row=>!row.inception_status||row.inception_status==='REVIEW_REQUIRED').map(row=>({fund_id:row.fund_id,fund_name:row.fund_name_normalized})),missing_any_performance:funds.filter(row=>!performanceFunds.has(row.fund_id)).map(row=>({fund_id:row.fund_id,fund_name:row.fund_name_normalized})),missing_aum:funds.filter(row=>!aumFunds.has(row.fund_id)).map(row=>({fund_id:row.fund_id,fund_name:row.fund_name_normalized})),missing_tax_rag:funds.filter(row=>!sectionFunds('tax_distribution').has(row.fund_id)).map(row=>({fund_id:row.fund_id,fund_name:row.fund_name_normalized}))},
 requested_question_categories:categories,
 additional_question_categories:addedCategories,
 representative_tests:representativeTests,
 test_summary:{passed:representativeTests.filter(test=>test.pass).length,expected_refusals:representativeTests.filter(test=>!test.pass&&test.expected_behavior).length,failed:representativeTests.filter(test=>!test.pass&&!test.expected_behavior).length},
 recommended_query_policy:{single_product:['resolve fund_id','resolve class and period when relevant','query structured tables','retrieve matching RAG section','attach source_doc_id and source_page'],comparison_or_ranking:['require same metric','require same period','require compatible class','require same as_of_date or disclose mismatch','exclude source-quality quarantined values'],customer_situation:['collect account type','collect investment horizon','collect risk tolerance','collect liquidity need','then filter; do not present as personalized financial advice'],uncertainty:['never treat NULL as zero or no','ask when fund/class/period is ambiguous','say not found when evidence is absent','label unconfirmed source issues as candidates']}
};

const output=path.join(validation,'question_coverage_audit.json');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({file:output,scope:report.scope,status_counts:groupCount([...categories,...addedCategories],'status'),test_summary:report.test_summary,structured_coverage:report.structured_coverage},null,2));
