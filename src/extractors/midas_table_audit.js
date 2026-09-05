const fs = require('fs');
const path = require('path');

function groupLines(items) {
  const rows = new Map();
  for (const item of items) {
    const y = Math.round(item.transform[5] * 2) / 2;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({x: item.transform[4], text: item.str});
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, cells]) => ({y, cells: cells.sort((a, b) => a.x - b.x)}));
}

async function auditMidasTables(projectRoot) {
  const {getDocument} = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const base = path.join(projectRoot, 'data', '투자설명서', '마이다스에셋자산운용');
  const specs = {
    'R2_KR5157420003.pdf': [8, 23, 27, 28, 29, 30, 46, 47, 48, 49, 50],
    'R2_KR5157450017.pdf': [8, 23, 28, 29, 30, 31, 46, 47, 48, 49, 50],
    'R2_KR5157450090.pdf': [8, 19, 20, 32, 33, 34, 35, 36, 60, 61, 62, 63, 64, 65]
  };
  const result = {};
  for (const [file, pages] of Object.entries(specs)) {
    const pdf = await getDocument({data: new Uint8Array(fs.readFileSync(path.join(base, file)))}).promise;
    result[file] = {};
    for (const pageNumber of pages) {
      const page = await pdf.getPage(pageNumber);
      result[file][pageNumber] = groupLines((await page.getTextContent()).items);
    }
  }
  return result;
}

module.exports = {auditMidasTables};
