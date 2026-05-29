const { init, db } = require('../db');
init().then(() => {
  db.prepare("UPDATE projects SET display_zone = 'hot' WHERE status = 'approved'").run();
  const rows = db.prepare('SELECT id, display_zone, status FROM projects ORDER BY id').all();
  console.log(rows);
  process.exit(0);
});
