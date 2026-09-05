const fs = require('fs');
const path = require('path');
const {auditMidasTables} = require('./extractors/midas_table_audit');

(async () => {
  const root = path.resolve(__dirname, '..');
  const result = await auditMidasTables(root);
  const output = path.join(root, 'data', 'validation', 'midas_table_audit.json');
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify({output, documents: Object.keys(result).length, pages: Object.values(result).reduce((n, pages) => n + Object.keys(pages).length, 0)}, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
