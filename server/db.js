/**
 * 使用 sql.js（纯 JS，无需 Windows 原生编译）替代 better-sqlite3
 * 兼容原有 db.prepare().get/run/all、db.exec 接口，并持久化到 goodtime.db
 */
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'goodtime.db');
let innerDb = null; // sql.js Database 实例
let saveTimer = null;

function save() {
  if (!innerDb) return;
  try {
    const data = innerDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (e) {
    console.error('db save error:', e.message);
  }
}

function prepare(sql) {
  return {
    get(...args) {
      const stmt = innerDb.prepare(sql);
      try {
        if (args && args.length > 0) stmt.bind(args);
        const row = stmt.step() ? stmt.getAsObject() : undefined;
        return row;
      } finally {
        stmt.free();
      }
    },
    all(...args) {
      const rows = [];
      const stmt = innerDb.prepare(sql);
      try {
        if (args && args.length > 0) stmt.bind(args);
        while (stmt.step()) rows.push(stmt.getAsObject());
        return rows;
      } finally {
        stmt.free();
      }
    },
    run(...args) {
      const stmt = innerDb.prepare(sql);
      try {
        if (args && args.length > 0) stmt.bind(args);
        stmt.step();
        stmt.free();
      } catch (e) {
        stmt.free();
        throw e;
      }
      let lastInsertRowid = 0;
      const idStmt = innerDb.prepare('SELECT last_insert_rowid() as id');
      try {
        if (idStmt.step()) {
          const row = idStmt.getAsObject();
          if (row && row.id != null) lastInsertRowid = row.id;
        }
      } finally {
        idStmt.free();
      }
      save();
      return { lastInsertRowid };
    }
  };
}

function exec(sql) {
  innerDb.exec(sql);
  save();
}

const db = {
  prepare,
  exec(sql) {
    exec(sql);
  }
};

async function init() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    innerDb = new SQL.Database(buf);
  } else {
    innerDb = new SQL.Database();
  }

  // sql.js: 使用 run/exec 避免部分环境下 prepare 未就绪
  if (typeof innerDb.run !== 'function') {
    throw new Error('sql.js Database.run is not available. Ensure initSqlJs() resolved correctly.');
  }
  innerDb.run('PRAGMA journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      openid TEXT,
      member_level TEXT DEFAULT '',
      member_expire_time TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS user_message_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      read_at TEXT,
      FOREIGN KEY (message_id) REFERENCES messages(id),
      UNIQUE(message_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      ip_address TEXT DEFAULT '',
      store_count TEXT DEFAULT '',
      base_amount TEXT DEFAULT '',
      max_amount TEXT DEFAULT '',
      category_id TEXT DEFAULT '',
      category_tag TEXT DEFAULT '',
      cover_type TEXT DEFAULT 'carousel',
      carousel_images TEXT DEFAULT '[]',
      video_url TEXT DEFAULT '',
      video_poster TEXT DEFAULT '',
      detail_content TEXT DEFAULT '',
      member_level TEXT DEFAULT 'V6',
      status TEXT DEFAULT 'pending',
      reject_reason TEXT DEFAULT '',
      display_zone TEXT DEFAULT '',
      is_official INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      clue_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '',
      sort INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_type TEXT DEFAULT '',
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'moderator'
    );

    CREATE TABLE IF NOT EXISTS settlement_agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_url TEXT NOT NULL,
      file_name TEXT DEFAULT '',
      version TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      uploaded_by TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS user_settlement_agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      project_id INTEGER,
      agreement_template_id INTEGER,
      signed_file_url TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reject_reason TEXT DEFAULT '',
      reviewed_by TEXT DEFAULT '',
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (agreement_template_id) REFERENCES settlement_agreements(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_ums_message_user ON user_message_status(message_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_ums_user_deleted ON user_message_status(user_id, deleted);
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_display_zone ON projects(display_zone);
    CREATE INDEX IF NOT EXISTS idx_settlement_agreements_active ON settlement_agreements(is_active);
    CREATE INDEX IF NOT EXISTS idx_user_settlement_agreements_user ON user_settlement_agreements(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_settlement_agreements_status ON user_settlement_agreements(status);
  `);

  try {
    innerDb.run('ALTER TABLE messages ADD COLUMN contact TEXT');
    save();
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
  try {
    innerDb.run('ALTER TABLE users ADD COLUMN openid TEXT');
    save();
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
  try {
    innerDb.run('ALTER TABLE users ADD COLUMN member_level TEXT DEFAULT ""');
    save();
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
  try {
    innerDb.run('ALTER TABLE users ADD COLUMN member_expire_time TEXT');
    save();
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
  try {
    innerDb.run('ALTER TABLE projects ADD COLUMN published_at TEXT');
    save();
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
  try {
    innerDb.run('ALTER TABLE users ADD COLUMN identity_tag TEXT');
    save();
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
  try {
    innerDb.run('ALTER TABLE projects ADD COLUMN expire_at TEXT');
    save();
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
  try {
    innerDb.run('ALTER TABLE projects ADD COLUMN introduction TEXT');
    save();
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
  // 项目到期时间统一为一年：已有发布时间但无到期时间的，补全为 发布时间+1年
  try {
    innerDb.run("UPDATE projects SET expire_at = date(published_at, '+1 year') WHERE (published_at IS NOT NULL AND published_at != '') AND (expire_at IS NULL OR expire_at = '')");
    save();
  } catch (e) {}
  
  // 入驻协议相关表的创建（如果不存在）
  try {
    innerDb.run('CREATE TABLE IF NOT EXISTS settlement_agreements (id INTEGER PRIMARY KEY AUTOINCREMENT, file_url TEXT NOT NULL, file_name TEXT DEFAULT "", version TEXT DEFAULT "", is_active INTEGER DEFAULT 1, uploaded_by TEXT DEFAULT "", created_at TEXT DEFAULT (datetime(\'now\', \'localtime\')), updated_at TEXT DEFAULT (datetime(\'now\', \'localtime\')))');
    save();
  } catch (e) {}
  try {
    innerDb.run('CREATE TABLE IF NOT EXISTS user_settlement_agreements (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, project_id INTEGER, agreement_template_id INTEGER, signed_file_url TEXT NOT NULL, status TEXT DEFAULT "pending", reject_reason TEXT DEFAULT "", reviewed_by TEXT DEFAULT "", reviewed_at TEXT, created_at TEXT DEFAULT (datetime(\'now\', \'localtime\')), updated_at TEXT DEFAULT (datetime(\'now\', \'localtime\')))');
    save();
  } catch (e) {}

  // 使用 exec 做 COUNT，避免 init 阶段 prepare 未就绪（sql.js 在 Node 下）
  function countByExec(sql) {
    const r = innerDb.exec(sql);
    if (!r || !r[0] || !r[0].values || !r[0].values[0]) return { c: 0 };
    return { c: r[0].values[0][0] };
  }

  const userCount = countByExec('SELECT COUNT(*) as c FROM users');
  if (userCount && userCount.c === 0) {
    innerDb.run("INSERT INTO users (id, nickname, avatar) VALUES ('user_1', '当前用户', '/images/icons/default-avatar.svg')");
    innerDb.run("INSERT INTO users (id, nickname, avatar) VALUES ('pub_project_1', '吉祥米线', '/images/icons/default-avatar.svg')");
    innerDb.run("INSERT INTO users (id, nickname, avatar) VALUES ('pub_project_2', '咪柚品牌', '/images/icons/default-avatar.svg')");
    innerDb.run("INSERT INTO users (id, nickname, avatar) VALUES ('pub_project_3', '某某加盟', '/images/icons/default-avatar.svg')");
    save();
  }
  // 初始化时用 exec/run 插入 official，避免 init 阶段调用 prepare
  const officialCount = countByExec("SELECT COUNT(*) as c FROM users WHERE id = 'official'");
  if (officialCount && officialCount.c === 0) {
    innerDb.run("INSERT INTO users (id, nickname, avatar) VALUES ('official', '官方', '')");
    save();
  }

  const catCount = countByExec('SELECT COUNT(*) as c FROM categories');
  if (catCount && catCount.c === 0) {
    const defaults = [
      ['hot', '热门', '/images/icons/fire.svg', 1],
      ['trend', '趋势', '/images/icons/trend.svg', 2],
      ['new', '上新', '/images/icons/new.svg', 3],
      ['food', '餐饮美食', '/images/icons/food.svg', 10],
      ['education', '教育培训', '/images/icons/education.svg', 11],
      ['beauty', '医美护肤', '/images/icons/beauty.svg', 12],
      ['retail', '零售连锁', '/images/icons/shop.svg', 13],
      ['service', '生活服务', '/images/icons/handshake.svg', 14]
    ];
    defaults.forEach(([id, name, icon, sort]) => {
      const esc = (s) => (s || '').replace(/'/g, "''");
      innerDb.run(`INSERT OR IGNORE INTO categories (id, name, icon, sort, enabled) VALUES ('${esc(id)}', '${esc(name)}', '${esc(icon)}', ${Number(sort) || 0}, 1)`);
    });
    save();
  }

  const configCount = countByExec('SELECT COUNT(*) as c FROM config');
  if (configCount && configCount.c === 0) {
    const esc = (s) => (s || '').replace(/'/g, "''");
    innerDb.run("INSERT OR IGNORE INTO config (key, value) VALUES ('purchase_notice', '" + esc('<p>1. 会员有效期为自开通之日起365天。</p><p>2. 会员权益具体以平台公示为准。</p><p>3. 如有疑问请联系客服。</p>') + "')");
    innerDb.run("INSERT OR IGNORE INTO config (key, value) VALUES ('benefits_doc', '" + esc('<p><strong>会员权益说明</strong></p><p>会员包含多项权益，为入驻品牌提效。具体权益以平台公示为准。</p>') + "')");
    innerDb.run("INSERT OR IGNORE INTO config (key, value) VALUES ('dashboard', '" + esc(JSON.stringify({
      marketSize: '8万亿',
      serviceMerchants: '3630',
      strategicPartners: '13家',
      marketShare: '0.03',
      registeredUsers: '73.7万'
    })) + "')");
    innerDb.run("INSERT OR IGNORE INTO config (key, value) VALUES ('benefits_carousel', '[]')");
    save();
  }

  // 会员定价配置（若不存在则写入默认值，兼容已有数据库）
  const memberPlansRow = db.prepare('SELECT value FROM config WHERE key = ?').get('member_plans');
  if (!memberPlansRow) {
    const defaultPlans = JSON.stringify([
      { id: 'v6', name: 'V6', price: 598, days: 365 },
      { id: 'v8', name: 'V8', price: 21980, days: 365 }
    ]);
    db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('member_plans', defaultPlans);
    save();
  }

  const adminCount = countByExec('SELECT COUNT(*) as c FROM admin_users');
  if (adminCount && adminCount.c === 0) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update('admin123').digest('hex');
    innerDb.run("INSERT INTO admin_users (username, password_hash, role) VALUES ('admin', '" + hash + "', 'admin')");
    save();
  }

  saveTimer = setInterval(save, 15000);
  process.on('exit', () => {
    if (saveTimer) clearInterval(saveTimer);
    save();
  });
}

function ensureUser(id, nickname, avatar) {
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!u) {
    db.prepare('INSERT INTO users (id, nickname, avatar) VALUES (?, ?, ?)').run(
      id,
      nickname || '未知',
      avatar || ''
    );
  }
}

module.exports = { db, init, ensureUser };
