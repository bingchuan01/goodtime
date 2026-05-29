const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DBS = [
  path.join(__dirname, '..', 'goodtime.db'),
  path.join(__dirname, '..', '..', 'backups', 'backup-20260510-133106', 'goodtime.db.snapshot'),
  path.join(__dirname, '..', '..', 'backups', 'backup-20260510-133106', 'server', 'goodtime.db')
];

async function inspect(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', f)
  });
  const db = new SQL.Database(fs.readFileSync(filePath));
  const total = db.exec('SELECT COUNT(*) as c FROM projects')[0]?.values[0][0] || 0;
  const apr = db.exec(
    `SELECT id, title, status, published_at, carousel_images, display_zone
     FROM projects
     WHERE published_at >= '2026-04-20' AND published_at <= '2026-04-21 23:59:59'
     ORDER BY published_at`
  );
  const approved = db.exec(
    `SELECT COUNT(*) FROM projects WHERE status = 'approved'`
  )[0]?.values[0][0] || 0;
  const rows = apr[0] ? apr[0].values.map((v) => {
    const o = {};
    apr[0].columns.forEach((c, i) => { o[c] = v[i]; });
    return o;
  }) : [];
  return { filePath, total, approved, aprCount: rows.length, aprRows: rows };
}

async function main() {
  for (const p of DBS) {
    const r = await inspect(p);
    if (!r) {
      console.log('\n--- MISSING:', p);
      continue;
    }
    console.log('\n===', p);
    console.log('total projects:', r.total, '| approved:', r.approved, '| 2026-04-20~21:', r.aprCount);
    r.aprRows.forEach((row) => {
      console.log(`  #${row.id} ${row.status} ${row.published_at} | ${(row.title || '').slice(0, 40)}`);
    });
  }
}

main().catch(console.error);
