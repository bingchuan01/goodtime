const { db } = require('../db');

function ensureProjectStats(projectId) {
  const id = parseInt(projectId, 10);
  if (!id) return null;
  let row = db.prepare('SELECT * FROM project_stats WHERE project_id = ?').get(id);
  if (!row) {
    db.prepare(
      'INSERT INTO project_stats (project_id, consult_uv, favorite_uv, share_pv) VALUES (?, 0, 0, 0)'
    ).run(id);
    row = db.prepare('SELECT * FROM project_stats WHERE project_id = ?').get(id);
  }
  return row;
}

function getProjectStats(projectId) {
  const p = db.prepare('SELECT view_count FROM projects WHERE id = ?').get(parseInt(projectId, 10));
  const row = ensureProjectStats(projectId);
  return {
    consult: Number(row.consult_uv) || 0,
    favorite: Number(row.favorite_uv) || 0,
    share: Number(row.share_pv) || 0,
    view: Number(p && p.view_count) || 0
  };
}

function recountFavoriteUv(projectId) {
  const id = parseInt(projectId, 10);
  if (!id) return;
  ensureProjectStats(id);
  const row = db.prepare('SELECT COUNT(*) as c FROM user_favorites WHERE project_id = ?').get(id);
  const count = Number(row && row.c) || 0;
  db.prepare('UPDATE project_stats SET favorite_uv = ? WHERE project_id = ?').run(count, id);
  return count;
}

function recordConsult(projectId, userId) {
  const pid = parseInt(projectId, 10);
  const uid = String(userId || '').trim();
  if (!pid || !uid) return false;
  const exists = db.prepare(
    'SELECT 1 FROM project_consult_users WHERE project_id = ? AND user_id = ?'
  ).get(pid, uid);
  if (exists) return false;
  db.prepare(
    'INSERT INTO project_consult_users (project_id, user_id, source) VALUES (?, ?, ?)'
  ).run(pid, uid, 'consult');
  ensureProjectStats(pid);
  db.prepare('UPDATE project_stats SET consult_uv = consult_uv + 1 WHERE project_id = ?').run(pid);
  return true;
}

function recordShare(projectId) {
  const pid = parseInt(projectId, 10);
  if (!pid) return;
  ensureProjectStats(pid);
  db.prepare('UPDATE project_stats SET share_pv = share_pv + 1 WHERE project_id = ?').run(pid);
}

module.exports = {
  ensureProjectStats,
  getProjectStats,
  recountFavoriteUv,
  recordConsult,
  recordShare
};
