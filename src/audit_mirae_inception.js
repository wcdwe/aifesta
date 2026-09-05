const fs = require('fs');
const path = require('path');
const { readCsv } = require('./common/csv_reader');

const root = path.join(__dirname, '..');
const pdfDir = path.join(root, 'data', '투자설명서', '미래에셋자산운용');
const funds = readCsv(path.join(root, 'data', 'processed', 'funds.csv'));
const documents = readCsv(path.join(root, 'data', 'processed', 'documents.csv'));

function iso(raw) {
  const match = raw.match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : null;
}

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const targets = funds.filter((fund) => fund.company_name === '미래에셋자산운용' && !fund.inception_date);
  const results = [];

  for (const fund of targets) {
    const document = documents.find((row) => row.doc_id === fund.source_doc_id);
    const pdfPath = path.join(pdfDir, document.file_name);
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), disableWorker: true }).promise;
    const history = [];
    const classDates = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ');
      const dates = [...text.matchAll(/(?:19|20)\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}/g)].map((match) => iso(match[0]));

      const explicit = [...text.matchAll(/((?:19|20)\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2})\s+(?:투자신탁\s*)?최초\s*설정/g)];
      for (const match of explicit) history.push({ date: iso(match[1]), page: pageNumber });
      if (/최초설정일/.test(text) && /가입자격/.test(text)) {
        for (const date of dates) classDates.push({ date, page: pageNumber });
      }
    }

    const uniqueClassDates = [...new Map(classDates.map((row) => [row.date, row])).values()]
      .sort((a, b) => a.date.localeCompare(b.date));
    results.push({
      fund_id: fund.fund_id,
      file_name: document.file_name,
      fund_name: fund.fund_name_normalized,
      history,
      earliest_class_date: uniqueClassDates[0] || null,
      class_dates: uniqueClassDates,
    });
  }

  const outputPath = path.join(root, 'data', 'validation', 'mirae_inception_audit.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ output: outputPath, funds: results.length }, null, 2)}\n`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
