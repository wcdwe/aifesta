const fs = require('fs');
const path = require('path');

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(filePath, columns, rows) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(columns.map(column => csvCell(row[column])).join(','));
  fs.writeFileSync(filePath, `\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

module.exports = {writeCsv};
