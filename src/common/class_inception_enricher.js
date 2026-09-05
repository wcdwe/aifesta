const fs = require('fs');
const path = require('path');
const { writeCsv } = require('./csv_writer');

function enrichClassInception(root, classes) {
  const validationDir = path.join(root, 'data', 'validation');
  const files = fs.readdirSync(validationDir)
    .filter((name) => name.endsWith('_class_inception_extraction.json'))
    .sort();
  if (!files.length) throw new Error(`Class inception extraction missing in: ${validationDir}`);
  const extracted = files.flatMap((name) => JSON.parse(fs.readFileSync(path.join(validationDir, name), 'utf8')));
  const byKey = new Map(extracted.map((row) => [`${row.fund_id}|${row.class_code}|${row.class_name}`, row]));
  let applied = 0;

  for (const row of classes) {
    row.class_inception_date = null;
    row.class_inception_status = null;
    const evidence = byKey.get(`${row.fund_id}|${row.class_code}|${row.class_name_raw}`);
    if (!evidence) continue;
    row.class_inception_date = evidence.class_inception_date;
    row.class_inception_status = evidence.class_inception_status;
    if (evidence.source_page) {
      const pages = new Set(String(row.source_page || '').split('|').filter(Boolean));
      pages.add(String(evidence.source_page));
      row.source_page = [...pages].join('|');
      row.source_text += `; [p.${evidence.source_page}] 클래스 최초설정일 ${evidence.class_inception_date || '-'} (${evidence.class_inception_status})`;
    }
    applied += 1;
  }
  const reviewRows = extracted.filter((row) => row.class_inception_status === 'REVIEW_REQUIRED');
  writeCsv(
    path.join(validationDir, 'class_inception_review.csv'),
    ['file_name', 'company_name', 'fund_id', 'fund_name', 'class_id', 'class_code', 'class_name', 'source_page', 'source_text', 'reason'],
    reviewRows,
  );
  return { applied, extracted: extracted.length, files: files.length, review_required: reviewRows.length };
}

module.exports = { enrichClassInception };
