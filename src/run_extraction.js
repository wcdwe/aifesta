const fs = require('fs');
const path = require('path');
const {writeCsv} = require('./common/csv_writer');
const {enrichClassInception} = require('./common/class_inception_enricher');
const {validatePhase1, validateClasses, validatePerformance} = require('./common/validators');
const {extractPhase1, COMPANY} = require('./extractors/midas_asset');
const {extractMidasClasses} = require('./extractors/midas_classes');
const {extractMidasPerformance} = require('./extractors/midas_performance');
const {extractDbPhase1} = require('./extractors/db_asset');
const {extractDbClasses} = require('./extractors/db_classes');
const {extractDbPerformance} = require('./extractors/db_performance');
const {extractKcgiPhase1, COMPANY: KCGI_COMPANY} = require('./extractors/kcgi_asset');
const {extractKcgiClasses,extractKcgiFeeSchedules} = require('./extractors/kcgi_classes');
const {extractKcgiPerformance} = require('./extractors/kcgi_performance');
const {extractBaringsPhase1} = require('./extractors/barings_asset');
const {extractBaringsClasses} = require('./extractors/barings_classes');
const {extractBaringsPerformance} = require('./extractors/barings_performance');
const {extractHeungkukPhase1, COMPANY: HEUNGKUK_COMPANY} = require('./extractors/heungkuk_asset');
const {extractHeungkukClasses} = require('./extractors/heungkuk_classes');
const {extractHeungkukPerformance} = require('./extractors/heungkuk_performance');
const {extractEugenePhase1} = require('./extractors/eugene_asset');
const {extractEugeneClasses} = require('./extractors/eugene_classes');
const {extractEugenePerformance} = require('./extractors/eugene_performance');
const {extractDsPhase1} = require('./extractors/ds_asset');
const {extractDsClasses} = require('./extractors/ds_classes');
const {extractDsPerformance} = require('./extractors/ds_performance');
const {extractTrustonPhase1} = require('./extractors/truston_asset');
const {extractTrustonClasses} = require('./extractors/truston_classes');
const {extractTrustonPerformance} = require('./extractors/truston_performance');
const {extractSparxPhase1} = require('./extractors/sparx_asset');
const {extractSparxClasses} = require('./extractors/sparx_classes');
const {extractSparxPerformance} = require('./extractors/sparx_performance');
const {extractVipPhase1} = require('./extractors/vip_asset');
const {extractVipClasses,extractVipFeeSchedules} = require('./extractors/vip_classes');
const {extractVipPerformance} = require('./extractors/vip_performance');
const {extractAssetplusPhase1} = require('./extractors/assetplus_asset');
const {extractAssetplusClasses} = require('./extractors/assetplus_classes');
const {extractAssetplusPerformance} = require('./extractors/assetplus_performance');
const {extractViPhase1} = require('./extractors/vi_asset');
const {extractViClasses} = require('./extractors/vi_classes');
const {extractViPerformance} = require('./extractors/vi_performance');
const {extractKivaluePhase1} = require('./extractors/kivalue_asset');
const {extractKivalueClasses} = require('./extractors/kivalue_classes');
const {extractKivaluePerformance} = require('./extractors/kivalue_performance');
const {extractKoreitPhase1} = require('./extractors/koreit_asset');
const {extractKoreitClasses} = require('./extractors/koreit_classes');
const {extractKoreitPerformance} = require('./extractors/koreit_performance');
const {extractKbPhase1} = require('./extractors/kb_asset');
const {extractKbClasses} = require('./extractors/kb_classes');
const {extractKbPerformance} = require('./extractors/kb_performance');
const {extractNhPhase1} = require('./extractors/nh_asset');
const {extractNhClasses} = require('./extractors/nh_classes');
const {extractNhPerformance} = require('./extractors/nh_performance');
const {extractDaolPhase1} = require('./extractors/daol_asset');
const {extractDaolClasses} = require('./extractors/daol_classes');
const {extractDaolPerformance} = require('./extractors/daol_performance');
const {extractShinyoungPhase1} = require('./extractors/shinyoung_asset');
const {extractShinyoungClasses} = require('./extractors/shinyoung_classes');
const {extractShinyoungPerformance} = require('./extractors/shinyoung_performance');
const {extractHanaPhase1} = require('./extractors/hana_asset');
const {extractHanaClasses} = require('./extractors/hana_classes');
const {extractHanaPerformance} = require('./extractors/hana_performance');
const {extractHanwhaPhase1} = require('./extractors/hanwha_asset');
const {extractHanwhaClasses} = require('./extractors/hanwha_classes');
const {extractHanwhaPerformance} = require('./extractors/hanwha_performance');
const {extractShinhanPhase1} = require('./extractors/shinhan_asset');
const {extractShinhanClasses} = require('./extractors/shinhan_classes');
const {extractShinhanPerformance} = require('./extractors/shinhan_performance');
const {extractKyoboAxaPhase1} = require('./extractors/kyoboaxa_asset');
const {extractKyoboAxaClasses} = require('./extractors/kyoboaxa_classes');
const {extractKyoboAxaPerformance} = require('./extractors/kyoboaxa_performance');
const {extractKyoboAxaRemainingPhase1}=require('./extractors/kyoboaxa_remaining_asset');
const {extractKyoboAxaRemainingClasses}=require('./extractors/kyoboaxa_remaining_classes');
const {extractKyoboAxaRemainingPerformance}=require('./extractors/kyoboaxa_remaining_performance');
const {extractSamsungPhase1}=require('./extractors/samsung_asset');
const {extractSamsungClasses}=require('./extractors/samsung_classes');
const {extractSamsungPerformance}=require('./extractors/samsung_performance');
const {extractSamsungRemainingPhase1}=require('./extractors/samsung_remaining_asset');
const {extractSamsungRemainingClasses}=require('./extractors/samsung_remaining_classes');
const {extractSamsungRemainingPerformance}=require('./extractors/samsung_remaining_performance');
const {extractMiraeFirstPhase1}=require('./extractors/mirae_first_asset');
const {extractMiraeFirstClasses}=require('./extractors/mirae_first_classes');
const {extractMiraeFirstPerformance}=require('./extractors/mirae_first_performance');
const {extractMiraeBatch}=require('./extractors/mirae_batch');
const {extractWooriFirstPhase1}=require('./extractors/woori_first_asset');
const {extractWooriFirstClasses}=require('./extractors/woori_first_classes');
const {extractWooriFirstPerformance}=require('./extractors/woori_first_performance');
const {extractWooriRemainingBatch}=require('./extractors/woori_remaining_batch');
const {extractKiwoomFirstPhase1}=require('./extractors/kiwoom_first_asset');
const {extractKiwoomFirstClasses}=require('./extractors/kiwoom_first_classes');
const {extractKiwoomFirstPerformance}=require('./extractors/kiwoom_first_performance');
const {extractKiwoomSecondPhase1,extractKiwoomSecondClasses,extractKiwoomSecondPerformance}=require('./extractors/kiwoom_second');
const {extractKiwoomThirdPhase1,extractKiwoomThirdClasses,extractKiwoomThirdPerformance}=require('./extractors/kiwoom_third');
const {extractKiwoomFourthPhase1,extractKiwoomFourthClasses,extractKiwoomFourthPerformance}=require('./extractors/kiwoom_fourth');
const {extractKiwoomRemainingPhase1,extractKiwoomRemainingClasses,extractKiwoomRemainingPerformance}=require('./extractors/kiwoom_remaining');
const {extractHankookFirstPhase1,extractHankookFirstClasses,extractHankookFirstPerformance}=require('./extractors/hankook_first');
const {extractHankookSecondPhase1,extractHankookSecondClasses,extractHankookSecondPerformance}=require('./extractors/hankook_second');
const {extractHankookThirdPhase1,extractHankookThirdClasses,extractHankookThirdPerformance}=require('./extractors/hankook_third');
const {extractHankookFourthPhase1,extractHankookFourthClasses,extractHankookFourthPerformance}=require('./extractors/hankook_fourth');
const {extractHankookFifthPhase1,extractHankookFifthClasses,extractHankookFifthPerformance}=require('./extractors/hankook_fifth');
const {extractHankookSixthPhase1,extractHankookSixthClasses,extractHankookSixthPerformance}=require('./extractors/hankook_sixth');
const {extractHankookSeventhPhase1,extractHankookSeventhClasses,extractHankookSeventhPerformance}=require('./extractors/hankook_seventh');
const {sourceIssues,recordIssues}=require('./source_issues');

const root = path.resolve(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const validation = path.join(root, 'data', 'validation');
const extractionDate = '2026-08-31';
const documentColumns = ['doc_id','company_name','file_name','file_path','document_type','document_date','effective_date','fund_id','total_pages','extraction_date'];
const fundColumns = ['fund_id','company_name','fund_name_raw','fund_name_normalized','fund_code','management_company','asset_type_l1','asset_type_l2','investment_region','investment_target','risk_grade','risk_grade_text','benchmark','volatility','inception_date','inception_status','inception_scheduled_date','currency_hedge','fund_structure','tdf_vintage','bond_duration_bucket','source_doc_id','source_page','source_text'];
const classColumns = ['class_id','fund_id','class_code','class_name_raw','class_name_normalized','account_type','channel','front_load','back_load','management_fee','sales_fee','trust_fee','admin_fee','total_fee','total_expense_ratio','class_inception_date','class_inception_status','source_doc_id','source_page','source_text'];
const feeScheduleColumns = ['fee_schedule_id','class_id','fund_id','class_name_normalized','period_type','effective_from_event','effective_to_event','rate_type','management_fee','base_management_fee','min_management_fee','max_management_fee','sales_fee','trust_fee','admin_fee','total_fee','min_total_fee','max_total_fee','total_expense_ratio','benchmark_type','benchmark_rate','performance_multiplier','lookback_months','recalculation_months','formula','source_doc_id','source_page','source_text'];
const performanceColumns = ['class_id','fund_id','period','return_pct','benchmark_return_pct','as_of_date','source_doc_id','source_page','source_text'];
const aumColumns = ['fund_id','class_id','aum_type','aum_value_raw','aum_value_krw','aum_unit','as_of_date','source_doc_id','source_page','source_text'];

const midas = extractPhase1(root, extractionDate);
const db = extractDbPhase1(root, extractionDate);
const kcgi = extractKcgiPhase1(root, extractionDate);
const barings = extractBaringsPhase1(root, extractionDate);
const heungkuk = extractHeungkukPhase1(root, extractionDate);
const eugene = extractEugenePhase1(root, extractionDate);
const ds = extractDsPhase1(root, extractionDate);
const truston = extractTrustonPhase1(root, extractionDate);
const sparx = extractSparxPhase1(root, extractionDate);
const vip = extractVipPhase1(root, extractionDate);
const assetplus = extractAssetplusPhase1(root, extractionDate);
const vi = extractViPhase1(root, extractionDate);
const kivalue = extractKivaluePhase1(root, extractionDate);
const koreit = extractKoreitPhase1(root, extractionDate);
const kb = extractKbPhase1(root, extractionDate);
const nh = extractNhPhase1(root, extractionDate);
const daol = extractDaolPhase1(root, extractionDate);
const shinyoung = extractShinyoungPhase1(root, extractionDate);
const hana = extractHanaPhase1(root, extractionDate);
const hanwha = extractHanwhaPhase1(root, extractionDate);
const shinhan = extractShinhanPhase1(root, extractionDate);
const kyoboaxa = extractKyoboAxaPhase1(root, extractionDate);
const kyoboaxaRemaining=extractKyoboAxaRemainingPhase1(root,extractionDate);
const samsung=extractSamsungPhase1(root,extractionDate);
const samsungRemaining=extractSamsungRemainingPhase1(root,extractionDate);
const miraeFirst=extractMiraeFirstPhase1(root,extractionDate);
const miraeBatch=extractMiraeBatch(root,extractionDate);
const wooriFirst=extractWooriFirstPhase1(root,extractionDate);
const wooriRemaining=extractWooriRemainingBatch(root,extractionDate);
const kiwoomFirst=extractKiwoomFirstPhase1(root,extractionDate);
const kiwoomSecond=extractKiwoomSecondPhase1(root,extractionDate);
const kiwoomThird=extractKiwoomThirdPhase1(root,extractionDate);
const kiwoomFourth=extractKiwoomFourthPhase1(root,extractionDate);
const kiwoomRemaining=extractKiwoomRemainingPhase1(root,extractionDate);
const hankookFirst=extractHankookFirstPhase1(root,extractionDate);
const hankookSecond=extractHankookSecondPhase1(root,extractionDate);
const hankookThird=extractHankookThirdPhase1(root,extractionDate);
const hankookFourth=extractHankookFourthPhase1(root,extractionDate);
const hankookFifth=extractHankookFifthPhase1(root,extractionDate);
const hankookSixth=extractHankookSixthPhase1(root,extractionDate);
const hankookSeventh=extractHankookSeventhPhase1(root,extractionDate);
const documents = [...midas.documents, ...db.documents, ...kcgi.documents, ...barings.documents, ...heungkuk.documents, ...eugene.documents, ...ds.documents, ...truston.documents, ...sparx.documents, ...vip.documents, ...assetplus.documents, ...vi.documents, ...kivalue.documents, ...koreit.documents, ...kb.documents, ...nh.documents, ...daol.documents, ...shinyoung.documents,...hana.documents,...hanwha.documents,...shinhan.documents,...kyoboaxa.documents,...kyoboaxaRemaining.documents,...samsung.documents,...samsungRemaining.documents,...miraeFirst.documents,...miraeBatch.documents,...wooriFirst.documents,...wooriRemaining.documents,...kiwoomFirst.documents,...kiwoomSecond.documents,...kiwoomThird.documents,...kiwoomFourth.documents,...kiwoomRemaining.documents,...hankookFirst.documents,...hankookSecond.documents,...hankookThird.documents,...hankookFourth.documents,...hankookFifth.documents,...hankookSixth.documents,...hankookSeventh.documents];
const funds = [...midas.funds, ...db.funds, ...kcgi.funds, ...barings.funds, ...heungkuk.funds, ...eugene.funds, ...ds.funds, ...truston.funds, ...sparx.funds, ...vip.funds, ...assetplus.funds, ...vi.funds, ...kivalue.funds, ...koreit.funds, ...kb.funds, ...nh.funds, ...daol.funds, ...shinyoung.funds,...hana.funds,...hanwha.funds,...shinhan.funds,...kyoboaxa.funds,...kyoboaxaRemaining.funds,...samsung.funds,...samsungRemaining.funds,...miraeFirst.funds,...miraeBatch.funds,...wooriFirst.funds,...wooriRemaining.funds,...kiwoomFirst.funds,...kiwoomSecond.funds,...kiwoomThird.funds,...kiwoomFourth.funds,...kiwoomRemaining.funds,...hankookFirst.funds,...hankookSecond.funds,...hankookThird.funds,...hankookFourth.funds,...hankookFifth.funds,...hankookSixth.funds,...hankookSeventh.funds];
const inceptionOverrides = {
  FUND000006: {
    inception_date: null,
    inception_status: 'NOT_ESTABLISHED',
    inception_scheduled_date: null,
    source_page: '42',
    source_text: '신규설정으로 재무정보·설정환매·운용실적·자산구성 해당사항 없음; 변경시행일 및 최초설정일 공란',
  },
  FUND000016: {
    inception_date: null,
    inception_status: 'NOT_ESTABLISHED',
    inception_scheduled_date: '2023-04-03',
    source_page: '11|13',
    source_text: '신규펀드이며 2023-04-03은 최초설정 예정일로 기재됨',
  },
  FUND000062: {
    inception_date: null,
    inception_status: 'NOT_ESTABLISHED',
    inception_scheduled_date: null,
    source_page: '5|12|13',
    source_text: '운용실적 해당사항 없음; 연혁에는 2025-01-09 증권신고서 효력발생만 기재; 모든 클래스 최초설정일은 공란',
  },
};
for (const fund of funds) {
  fund.inception_status = fund.inception_date ? 'ESTABLISHED' : 'NOT_DISCLOSED';
  fund.inception_scheduled_date = null;
  const override = inceptionOverrides[fund.fund_id];
  if (!override) continue;
  fund.inception_date = override.inception_date;
  fund.inception_status = override.inception_status;
  fund.inception_scheduled_date = override.inception_scheduled_date;
  const pages = new Set(String(fund.source_page || '').split('|').filter(Boolean));
  for (const page of override.source_page.split('|')) pages.add(page);
  fund.source_page = [...pages].join('|');
  fund.source_text = `${fund.source_text || ''} | [p.${override.source_page}] ${override.source_text}`;
}
const classes = [...extractMidasClasses(), ...extractDbClasses(), ...extractKcgiClasses(), ...extractBaringsClasses(), ...extractHeungkukClasses(), ...extractEugeneClasses(), ...extractDsClasses(), ...extractTrustonClasses(), ...extractSparxClasses(), ...extractVipClasses(), ...extractAssetplusClasses(), ...extractViClasses(), ...extractKivalueClasses(), ...extractKoreitClasses(), ...extractKbClasses(), ...extractNhClasses(), ...extractDaolClasses(), ...extractShinyoungClasses(),...extractHanaClasses(),...extractHanwhaClasses(),...extractShinhanClasses(),...extractKyoboAxaClasses(),...extractKyoboAxaRemainingClasses(),...extractSamsungClasses(),...extractSamsungRemainingClasses(),...extractMiraeFirstClasses(),...miraeBatch.classes,...extractWooriFirstClasses(),...wooriRemaining.classes,...extractKiwoomFirstClasses(),...extractKiwoomSecondClasses(),...extractKiwoomThirdClasses(),...extractKiwoomFourthClasses(),...extractKiwoomRemainingClasses(),...extractHankookFirstClasses(),...extractHankookSecondClasses(),...extractHankookThirdClasses(),...extractHankookFourthClasses(),...extractHankookFifthClasses(),...extractHankookSixthClasses(),...extractHankookSeventhClasses()];
const classInceptionEnrichment = enrichClassInception(root, classes);
const classFeeSchedules = [...extractKcgiFeeSchedules(),...extractVipFeeSchedules()];
const performanceResult = extractMidasPerformance();
const dbPerformance = extractDbPerformance();
const performance = [...performanceResult.rows, ...dbPerformance, ...extractKcgiPerformance(), ...extractBaringsPerformance(), ...extractHeungkukPerformance(), ...extractEugenePerformance(), ...extractDsPerformance(), ...extractTrustonPerformance(), ...extractSparxPerformance(), ...extractVipPerformance(), ...extractAssetplusPerformance(), ...extractViPerformance(), ...extractKivaluePerformance(), ...extractKoreitPerformance(), ...extractKbPerformance(), ...extractNhPerformance(), ...extractDaolPerformance(), ...extractShinyoungPerformance(),...extractHanaPerformance(),...extractHanwhaPerformance(),...extractShinhanPerformance(),...extractKyoboAxaPerformance(),...extractKyoboAxaRemainingPerformance(),...extractSamsungPerformance(),...extractSamsungRemainingPerformance(),...extractMiraeFirstPerformance(),...miraeBatch.performance,...extractWooriFirstPerformance(),...wooriRemaining.performance,...extractKiwoomFirstPerformance(),...extractKiwoomSecondPerformance(),...extractKiwoomThirdPerformance(),...extractKiwoomFourthPerformance(),...extractKiwoomRemainingPerformance(),...extractHankookFirstPerformance(),...extractHankookSecondPerformance(),...extractHankookThirdPerformance(),...extractHankookFourthPerformance(),...extractHankookFifthPerformance(),...extractHankookSixthPerformance(),...extractHankookSeventhPerformance()];
for (const document of documents) {
  const absolutePath = path.join(root, document.file_path);
  if (!fs.existsSync(absolutePath)) throw new Error(`Source PDF missing: ${absolutePath}`);
}
const validationErrors = validatePhase1(documents, funds);
validationErrors.push(...validateClasses(classes));
validationErrors.push(...validatePerformance(performance));
if (validationErrors.length) throw new Error(`Phase 1 validation failed: ${validationErrors.join('; ')}`);
writeCsv(path.join(processed, 'documents.csv'), documentColumns, documents);
writeCsv(path.join(processed, 'funds.csv'), fundColumns, funds);
writeCsv(path.join(processed, 'classes.csv'), classColumns, classes);
writeCsv(path.join(processed, 'class_fee_schedules.csv'), feeScheduleColumns, classFeeSchedules);
writeCsv(path.join(processed, 'performance.csv'), performanceColumns, performance);
const aum = [
 {fund_id:'FUND000004',class_id:null,aum_type:'자산총액',aum_value_raw:'113,949백만원',aum_value_krw:113949000000,aum_unit:'백만원',as_of_date:'2025-07-18',source_doc_id:'DOC000004',source_page:38,source_text:'[p.38] 집합투자기구 자산구성 현황; 자산총액 113,949백만원'},
 {fund_id:'FUND000005',class_id:null,aum_type:'자산총액',aum_value_raw:'273,894백만원',aum_value_krw:273894000000,aum_unit:'백만원',as_of_date:'2025-12-27',source_doc_id:'DOC000005',source_page:35,source_text:'[p.35] 집합투자기구 자산구성 현황; 자산총액 273,894백만원'},
 {fund_id:'FUND000007',class_id:null,aum_type:'자산총액',aum_value_raw:'6,351억원',aum_value_krw:635100000000,aum_unit:'억원',as_of_date:'2025-07-07',source_doc_id:'DOC000007',source_page:53,source_text:'[p.53] 집합투자기구 자산구성 현황; 자산총액 6,351억원'}
 ,{fund_id:'FUND000008',class_id:null,aum_type:'자산총액',aum_value_raw:'571,769백만원',aum_value_krw:571769000000,aum_unit:'백만원',as_of_date:'2025-12-31',source_doc_id:'DOC000008',source_page:45,source_text:'[p.45] 집합투자기구 자산구성 현황; 자산총액 571,769백만원'}
 ,{fund_id:'FUND000009',class_id:null,aum_type:'자산총액',aum_value_raw:'132,934백만원',aum_value_krw:132934000000,aum_unit:'백만원',as_of_date:'2025-03-10',source_doc_id:'DOC000009',source_page:35,source_text:'[p.35] 집합투자기구 자산구성 현황; 자산총액 132,934백만원'}
 ,{fund_id:'FUND000010',class_id:null,aum_type:'자산총액',aum_value_raw:'155,854백만원',aum_value_krw:155854000000,aum_unit:'백만원',as_of_date:'2025-06-25',source_doc_id:'DOC000010',source_page:45,source_text:'[p.45] 집합투자기구 자산구성 현황; 자산총액 155,854백만원'}
 ,{fund_id:'FUND000011',class_id:null,aum_type:'자산총액',aum_value_raw:'80,473백만원',aum_value_krw:80473000000,aum_unit:'백만원',as_of_date:'2025-09-29',source_doc_id:'DOC000011',source_page:38,source_text:'[p.38] 집합투자기구 자산구성 현황; 자산총액 80,473백만원'}
 ,{fund_id:'FUND000012',class_id:null,aum_type:'자산총액',aum_value_raw:'20,815억원',aum_value_krw:2081500000000,aum_unit:'억원',as_of_date:'2025-12-03',source_doc_id:'DOC000012',source_page:54,source_text:'[p.54] 집합투자기구 자산구성 현황; 자산총액 20,815억원'}
 ,{fund_id:'FUND000013',class_id:null,aum_type:'자산총액',aum_value_raw:'721억원',aum_value_krw:72100000000,aum_unit:'억원',as_of_date:'2025-07-11',source_doc_id:'DOC000013',source_page:54,source_text:'[p.54] 집합투자기구 자산구성 현황; 자산총액 721억원'}
 ,{fund_id:'FUND000014',class_id:null,aum_type:'자산총액',aum_value_raw:'48,406백만원',aum_value_krw:48406000000,aum_unit:'백만원',as_of_date:'2025-03-31',source_doc_id:'DOC000014',source_page:40,source_text:'[p.40] 집합투자기구 자산구성 현황; 자산총액 48,406백만원'}
 ,{fund_id:'FUND000015',class_id:null,aum_type:'자산총액',aum_value_raw:'90억원',aum_value_krw:9000000000,aum_unit:'억원',as_of_date:'2025-01-15',source_doc_id:'DOC000015',source_page:51,source_text:'[p.51] 집합투자기구 자산구성 현황; 자산총액 90억원'}
 ,{fund_id:'FUND000017',class_id:null,aum_type:'자산총액',aum_value_raw:'721억원',aum_value_krw:72100000000,aum_unit:'억원',as_of_date:'2025-05-20',source_doc_id:'DOC000017',source_page:32,source_text:'[p.32] 집합투자기구 자산구성 현황; 자산총액 721억원'}
 ,{fund_id:'FUND000018',class_id:null,aum_type:'자산총액',aum_value_raw:'393억원',aum_value_krw:39300000000,aum_unit:'억원',as_of_date:'2020-12-25',source_doc_id:'DOC000018',source_page:42,source_text:'[p.42] 집합투자기구 자산구성 현황; 자산총액 393억원'}
 ,{fund_id:'FUND000019',class_id:null,aum_type:'자산총액',aum_value_raw:'476억원',aum_value_krw:47600000000,aum_unit:'억원',as_of_date:'2024-12-31',source_doc_id:'DOC000019',source_page:37,source_text:'[p.37] 집합투자기구 자산구성 현황; 자산총액 476억원'}
 ,{fund_id:'FUND000020',class_id:null,aum_type:'자산총액',aum_value_raw:'1,644,172백만원',aum_value_krw:1644172000000,aum_unit:'백만원',as_of_date:'2024-12-12',source_doc_id:'DOC000020',source_page:43,source_text:'[p.43] 집합투자기구 자산구성 현황; 자산총액 1,644,172백만원'}
 ,{fund_id:'FUND000021',class_id:null,aum_type:'자산총액',aum_value_raw:'1,574억원',aum_value_krw:157400000000,aum_unit:'억원',as_of_date:'2024-12-31',source_doc_id:'DOC000021',source_page:37,source_text:'[p.37] 집합투자기구 자산구성 현황; 자산총액 1,574억원'}
 ,{fund_id:'FUND000022',class_id:null,aum_type:'자산총액',aum_value_raw:'833억원',aum_value_krw:83300000000,aum_unit:'억원',as_of_date:'2025-08-20',source_doc_id:'DOC000023',source_page:39,source_text:'[p.39] 집합투자기구 자산구성 현황; 자산총액 833억원'}
 ,{fund_id:'FUND000023',class_id:null,aum_type:'자산총액',aum_value_raw:'605억원',aum_value_krw:60500000000,aum_unit:'억원',as_of_date:'2025-09-07',source_doc_id:'DOC000024',source_page:37,source_text:'[p.37] 집합투자기구 자산구성 현황; 자산총액 605억원'}
 ,{fund_id:'FUND000024',class_id:null,aum_type:'자산총액',aum_value_raw:'1,034억원',aum_value_krw:103400000000,aum_unit:'억원',as_of_date:'2025-11-04',source_doc_id:'DOC000025',source_page:39,source_text:'[p.39] 집합투자기구 자산구성 현황; 자산총액 1,034억원'}
 ,{fund_id:'FUND000025',class_id:null,aum_type:'자산총액',aum_value_raw:'1,168억원',aum_value_krw:116800000000,aum_unit:'억원',as_of_date:'2025-05-17',source_doc_id:'DOC000026',source_page:40,source_text:'[p.40] 집합투자기구 자산구성 현황; 자산총액 1,168억원'}
 ,{fund_id:'FUND000026',class_id:null,aum_type:'자산총액',aum_value_raw:'185억원',aum_value_krw:18500000000,aum_unit:'억원',as_of_date:'2025-11-05',source_doc_id:'DOC000028',source_page:40,source_text:'[p.40] 집합투자기구 자산구성 현황; 자산총액 185억원'}
 ,{fund_id:'FUND000027',class_id:null,aum_type:'자산총액',aum_value_raw:'4,242억원',aum_value_krw:424200000000,aum_unit:'억원',as_of_date:'2025-08-31',source_doc_id:'DOC000029',source_page:56,source_text:'[p.56] 집합투자기구 자산 구성 현황; 자산총액 4,242억원'}
 ,{fund_id:'FUND000028',class_id:null,aum_type:'자산총액',aum_value_raw:'1,205억원',aum_value_krw:120500000000,aum_unit:'억원',as_of_date:'2025-01-24',source_doc_id:'DOC000030',source_page:57,source_text:'[p.57] 집합투자기구 자산 구성 현황; 자산총액 1,205억원'}
 ,{fund_id:'FUND000029',class_id:null,aum_type:'자산총액',aum_value_raw:'7,218억원',aum_value_krw:721800000000,aum_unit:'억원',as_of_date:'2025-09-13',source_doc_id:'DOC000031',source_page:52,source_text:'[p.52] 집합투자기구 자산 구성 현황; 자산총액 7,218억원'}
 ,{fund_id:'FUND000030',class_id:null,aum_type:'자산총액',aum_value_raw:'5,975억원',aum_value_krw:597500000000,aum_unit:'억원',as_of_date:'2025-08-13',source_doc_id:'DOC000032',source_page:54,source_text:'[p.54] 집합투자기구 자산 구성 현황; 자산총액 5,975억원'}
 ,{fund_id:'FUND000031',class_id:null,aum_type:'자산총액',aum_value_raw:'26,758백만원',aum_value_krw:26758000000,aum_unit:'백만원',as_of_date:'2025-01-12',source_doc_id:'DOC000033',source_page:39,source_text:'[p.39] 집합투자기구 자산 구성 현황; 자산총액 26,758백만원'}
 ,{fund_id:'FUND000032',class_id:null,aum_type:'자산총액',aum_value_raw:'1,113,765백만원',aum_value_krw:1113765000000,aum_unit:'백만원',as_of_date:'2025-05-25',source_doc_id:'DOC000034',source_page:46,source_text:'[p.46-47] 자투자신탁 운용 자산 구성 현황; 자산총액 1,113,765백만원'}
 ,{fund_id:'FUND000033',class_id:null,aum_type:'자산총액',aum_value_raw:'422,621백만원',aum_value_krw:422621000000,aum_unit:'백만원',as_of_date:'2025-04-24',source_doc_id:'DOC000035',source_page:44,source_text:'[p.44] 자투자신탁 운용 자산 구성 현황; 자산총액 422,621백만원'}
 ,{fund_id:'FUND000034',class_id:null,aum_type:'자산총액',aum_value_raw:'486,791백만원',aum_value_krw:486791000000,aum_unit:'백만원',as_of_date:'2025-04-16',source_doc_id:'DOC000036',source_page:51,source_text:'[p.51] 자투자신탁 자산구성 현황; 자산총액 486,791백만원'}
 ,{fund_id:'FUND000035',class_id:null,aum_type:'자산총액',aum_value_raw:'208,908백만원',aum_value_krw:208908000000,aum_unit:'백만원',as_of_date:'2025-05-02',source_doc_id:'DOC000037',source_page:58,source_text:'[p.58] 자투자신탁 자산구성 현황; 자산총액 208,908백만원'}
 ,{fund_id:'FUND000037',class_id:null,aum_type:'자산총액',aum_value_raw:'301,645백만원',aum_value_krw:301645000000,aum_unit:'백만원',as_of_date:'2025-11-06',source_doc_id:'DOC000039',source_page:56,source_text:'[p.56] 자투자신탁 자산구성 현황; 자산총액 301,645백만원'}
 ,{fund_id:'FUND000038',class_id:null,aum_type:'자산총액',aum_value_raw:'21,943억원',aum_value_krw:2194300000000,aum_unit:'억원',as_of_date:'2025-07-31',source_doc_id:'DOC000040',source_page:40,source_text:'[p.40] 집합투자기구 자산구성 현황; 자산총액 21,943억원'}
 ,{fund_id:'FUND000039',class_id:null,aum_type:'자산총액',aum_value_raw:'117억원',aum_value_krw:11700000000,aum_unit:'억원',as_of_date:'2025-01-31',source_doc_id:'DOC000041',source_page:50,source_text:'[p.50] 자투자신탁 자산구성 현황; 자산총액 117억원 (p.51 모투자신탁 192억원은 제외)'}
 ,{fund_id:'FUND000040',class_id:null,aum_type:'자산총액',aum_value_raw:'25억원',aum_value_krw:2500000000,aum_unit:'억원',as_of_date:'2025-07-31',source_doc_id:'DOC000042',source_page:35,source_text:'[p.35] 자투자신탁 자산구성 현황; 자산총액 25억원 (p.36 모투자신탁 250억원은 제외)'}
 ,{fund_id:'FUND000041',class_id:null,aum_type:'자산총액',aum_value_raw:'465억원',aum_value_krw:46500000000,aum_unit:'억원',as_of_date:'2025-01-31',source_doc_id:'DOC000043',source_page:50,source_text:'[p.50] 자투자신탁 자산구성 현황; 자산총액 465억원 (p.51-52 모투자신탁 1,368억원 및 195억원은 제외)'}
 ,{fund_id:'FUND000042',class_id:null,aum_type:'자산총액',aum_value_raw:'2,066,617백만원',aum_value_krw:2066617000000,aum_unit:'백만원',as_of_date:'2025-09-04',source_doc_id:'DOC000044',source_page:62,source_text:'[p.62] 집합투자기구 자산구성 현황; 자산총액 2,066,617백만원'}
 ,{fund_id:'FUND000043',class_id:null,aum_type:'자산총액',aum_value_raw:'416,583백만원',aum_value_krw:416583000000,aum_unit:'백만원',as_of_date:'2024-12-20',source_doc_id:'DOC000045',source_page:62,source_text:'[p.62] 자산총액 416,583백만원; 문서 기준일보다 1년 이전 표'}
 ,{fund_id:'FUND000044',class_id:null,aum_type:'자산총액',aum_value_raw:'316,227백만원',aum_value_krw:316227000000,aum_unit:'백만원',as_of_date:'2024-12-18',source_doc_id:'DOC000046',source_page:69,source_text:'[p.69] 자투자신탁 자산총액 316,227백만원'}
 ,{fund_id:'FUND000045',class_id:null,aum_type:'자산총액',aum_value_raw:'18,737백만원',aum_value_krw:18737000000,aum_unit:'백만원',as_of_date:'2025-06-03',source_doc_id:'DOC000047',source_page:56,source_text:'[p.56] 자투자신탁 자산총액 18,737백만원'}
 ,{fund_id:'FUND000046',class_id:null,aum_type:'자산총액',aum_value_raw:'9,385억원',aum_value_krw:938500000000,aum_unit:'억원',as_of_date:'2025-03-31',source_doc_id:'DOC000048',source_page:80,source_text:'[p.80] 집합투자기구 자산구성 현황; 자산총액 9,385억원'}
 ,{fund_id:'FUND000052',class_id:null,aum_type:'자산총액',aum_value_raw:'5,856백만원',aum_value_krw:5856000000,aum_unit:'백만원',as_of_date:'2024-12-31',source_doc_id:'DOC000054',source_page:48,source_text:'[p.48] 집합투자기구 자산구성 현황; 자산총액 5,856백만원'}
 ,...miraeBatch.aum
 ,{fund_id:'FUND000076',class_id:null,aum_type:'자산총액',aum_value_raw:'29,205.0억원',aum_value_krw:2920500000000,aum_unit:'억원',as_of_date:'2025-10-26',source_doc_id:'DOC000078',source_page:54,source_text:'[p.54] 자투자신탁 자산구성 현황; 자산총액 29,205.0억원 (모투자신탁 39,773.0억원은 제외)'}
 ,...wooriRemaining.aum
 ,{fund_id:'FUND000080',class_id:null,aum_type:'자산총액',aum_value_raw:'6.3억원',aum_value_krw:630000000,aum_unit:'억원',as_of_date:'2025-02-22',source_doc_id:'DOC000082',source_page:33,source_text:'[p.33] 자투자신탁 자산 구성 현황; 자산총액 6.3억원 (모투자신탁 63.9억원은 제외)'}
 ,{fund_id:'FUND000081',class_id:null,aum_type:'자산총액',aum_value_raw:'762.9억원',aum_value_krw:76290000000,aum_unit:'억원',as_of_date:'2025-02-26',source_doc_id:'DOC000083',source_page:43,source_text:'[p.43] 자투자신탁 자산 구성 현황; 자산총액 762.9억원 (모투자신탁 1,102.8억원은 제외)'}
 ,{fund_id:'FUND000082',class_id:null,aum_type:'자산총액',aum_value_raw:'430.3억원',aum_value_krw:43030000000,aum_unit:'억원',as_of_date:'2024-12-31',source_doc_id:'DOC000084',source_page:40,source_text:'[p.40] 자투자신탁 자산 구성 현황; 자산총액 430.3억원 (모투자신탁 1,750.7억원은 제외)'}
 ,{fund_id:'FUND000083',class_id:null,aum_type:'자산총액',aum_value_raw:'24,665.2억원',aum_value_krw:2466520000000,aum_unit:'억원',as_of_date:'2024-12-12',source_doc_id:'DOC000085',source_page:42,source_text:'[p.42] 집합투자기구 자산 구성 현황; 자산총액 24,665.2억원'}
 ,{fund_id:'FUND000084',class_id:null,aum_type:'자산총액',aum_value_raw:'195.2억원',aum_value_krw:19520000000,aum_unit:'억원',as_of_date:'2025-04-08',source_doc_id:'DOC000086',source_page:52,source_text:'[p.52] 자투자신탁 자산 구성 현황; 자산총액 195.2억원 (모투자신탁 186.7억원은 제외)'}
 ,{fund_id:'FUND000085',class_id:null,aum_type:'자산총액',aum_value_raw:'1,107.1억원',aum_value_krw:110710000000,aum_unit:'억원',as_of_date:'2025-05-22',source_doc_id:'DOC000087',source_page:46,source_text:'[p.46] 자투자신탁 자산 구성 현황; 자산총액 1,107.1억원 (모투자신탁 1,124.1억원은 제외)'}
 ,{fund_id:'FUND000086',class_id:null,aum_type:'자산총액',aum_value_raw:'223억원',aum_value_krw:22300000000,aum_unit:'억원',as_of_date:'2025-02-28',source_doc_id:'DOC000088',source_page:53,source_text:'[p.53] 집합투자기구 자산 구성 현황; 자산총액 223억원'}
 ,{fund_id:'FUND000087',class_id:null,aum_type:'자산총액',aum_value_raw:'506억원',aum_value_krw:50600000000,aum_unit:'억원',as_of_date:'2025-02-28',source_doc_id:'DOC000089',source_page:59,source_text:'[p.59] 자투자신탁 자산 구성 현황; 자산총액 506억원'}
 ,{fund_id:'FUND000088',class_id:null,aum_type:'자산총액',aum_value_raw:'48,302억원',aum_value_krw:4830200000000,aum_unit:'억원',as_of_date:'2025-11-28',source_doc_id:'DOC000090',source_page:64,source_text:'[p.64] 자투자신탁 자산 구성 현황; 자산총액 48,302억원'}
 ,{fund_id:'FUND000089',class_id:null,aum_type:'자산총액',aum_value_raw:'2,497억원',aum_value_krw:249700000000,aum_unit:'억원',as_of_date:'2025-02-28',source_doc_id:'DOC000091',source_page:54,source_text:'[p.54] 집합투자기구 자산 구성 현황; 자산총액 2,497억원'}
 ,{fund_id:'FUND000090',class_id:null,aum_type:'자산총액',aum_value_raw:'577억원',aum_value_krw:57700000000,aum_unit:'억원',as_of_date:'2025-08-29',source_doc_id:'DOC000092',source_page:64,source_text:'[p.64] 자투자신탁 자산 구성 현황; 자산총액 577억원'}
 ,{fund_id:'FUND000091',class_id:null,aum_type:'자산총액',aum_value_raw:'319억원',aum_value_krw:31900000000,aum_unit:'억원',as_of_date:'2025-10-31',source_doc_id:'DOC000093',source_page:57,source_text:'[p.57] 집합투자기구 자산 구성 현황; 자산총액 319억원'}
 ,{fund_id:'FUND000092',class_id:null,aum_type:'자산총액',aum_value_raw:'1,845억원',aum_value_krw:184500000000,aum_unit:'억원',as_of_date:'2025-02-28',source_doc_id:'DOC000094',source_page:47,source_text:'[p.47] 집합투자기구 자산 구성 현황; 자산총액 1,845억원'}
];
writeCsv(path.join(processed, 'aum.csv'), aumColumns, aum);

writeCsv(path.join(validation, 'extraction_errors.csv'), ['file_name','company_name','field','error_type','message','page'], []);
writeCsv(path.join(validation, 'pdf_source_errors.csv'), ['file_name','company_name','fund_id','field','raw_text','page','reason'], sourceIssues.map(issue=>({file_name:issue.file_name,company_name:issue.company_name,fund_id:issue.fund_id,field:issue.affected_field,raw_text:issue.source_value,page:issue.source_page,reason:`${issue.reason} [${issue.status}; 공식확인 ${issue.official_confirmation}]`})));
writeCsv(path.join(validation, 'pdf_source_issues.csv'), ['issue_id','file_name','source_doc_id','company_name','fund_id','fund_name_normalized','affected_field','issue_type','status','severity','confidence','official_confirmation','source_value','adopted_value','source_page','evidence_pages','handling_action','reason'], sourceIssues);
writeCsv(path.join(validation, 'record_issues.csv'), ['issue_id','table_name','record_key','field_name','relation_type'], recordIssues);
writeCsv(path.join(validation, 'unmatched_fields.csv'), ['file_name','company_name','fund_id','field','raw_text','page','reason'], [
  ...documents.map(document => ({file_name:document.file_name,company_name:document.company_name,fund_id:document.fund_id,field:'aum',raw_text:'운용자산 규모 / 단위: 억원 / 순자산 기준',page:document.file_name==='R2_KR5157450090.pdf'?69:54,reason:'운용사 전체 수탁고이며 개별 펀드 AUM이 아니므로 적재하지 않음'})),
  ...documents.map(document => ({file_name:document.file_name,company_name:document.company_name,fund_id:document.fund_id,field:'currency_hedge',raw_text:'',page:'',reason:'명시적 환헤지 정책을 아직 확인하지 못해 NULL 유지'})),
  ...documents.map(document => ({file_name:document.file_name,company_name:document.company_name,fund_id:document.fund_id,field:'volatility',raw_text:'',page:'',reason:'위험등급 산정값과 기간별 수익률 변동성의 의미가 달라 단일 값으로 확정하지 않음'})),
  ...performanceResult.issues.map(issue=>({file_name:issue.file_name,company_name:COMPANY,fund_id:issue.fund_id,field:'performance.class_id',raw_text:issue.label,page:issue.page,reason:issue.reason}))
  ,{file_name:'R2_KR5147430065.pdf',company_name:KCGI_COMPANY,fund_id:'FUND000006',field:'performance|aum',raw_text:'신규설정으로 해당사항 없음',page:42,reason:'PDF에 명시적으로 데이터 없음'}
  ,{file_name:'R2_KR514X450008.pdf',company_name:'VIP자산운용',fund_id:'FUND000016',field:'performance|aum',raw_text:'신규펀드로서 해당사항 없음',page:6,reason:'작성기준일 현재 설정 전 신규펀드로 PDF에 수익률 및 개별 펀드 AUM 데이터가 없음'}
]);

// Only unresolved mappings belong here. A normal NULL or a value already loaded
// into funds/aum is not an unmatched field.
const resolvedUnmatchedFields=[
  ...performanceResult.issues.map(issue=>({file_name:issue.file_name,company_name:COMPANY,fund_id:issue.fund_id,field:'performance.class_id',raw_text:issue.label,page:issue.page,reason:issue.reason})),
  ...miraeBatch.issues.map(issue=>{const d=documents.find(x=>x.file_name===issue.file);return{file_name:issue.file,company_name:'미래에셋자산운용',fund_id:d?.fund_id||'',field:issue.field,raw_text:'',page:'',reason:issue.reason};}),
];
writeCsv(path.join(validation,'unmatched_fields.csv'),['file_name','company_name','fund_id','field','raw_text','page','reason'],resolvedUnmatchedFields);

console.log(JSON.stringify({companies:22, documents:documents.length, funds:funds.length, classes:classes.length, performance:performance.length, aum:aum.length, total_fee_present:classes.filter(x=>x.total_fee!==null).length, total_expense_ratio_present:classes.filter(x=>x.total_expense_ratio!==null).length, validation_errors:validationErrors.length, extraction_errors:0, unmatched_fields:resolvedUnmatchedFields.length}, null, 2));
