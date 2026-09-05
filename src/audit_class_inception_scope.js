const path = require('path');
const { readCsv } = require('./common/csv_reader');

const root = path.join(__dirname, '..');
const processed = path.join(root, 'data', 'processed');
const funds = readCsv(path.join(processed, 'funds.csv'));
const classes = readCsv(path.join(processed, 'classes.csv'));
const fundById = new Map(funds.map((row) => [row.fund_id, row]));
const summary = new Map();

for (const row of classes) {
  if (row.class_inception_status) continue;
  const fund = fundById.get(row.fund_id);
  if (!fund) continue;
  const current = summary.get(fund.company_name) || { company_name: fund.company_name, funds: new Set(), classes: 0 };
  current.funds.add(row.fund_id);
  current.classes += 1;
  summary.set(fund.company_name, current);
}

const rows = [...summary.values()]
  .map((row) => ({ company_name: row.company_name, funds: row.funds.size, classes: row.classes }))
  .sort((a, b) => a.company_name.localeCompare(b.company_name, 'ko'));

process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
