const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'app.db');

let db = null;

// 自动保存间隔（5秒）
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveToFile();
    saveTimer = null;
  }, 2000);
}

function saveToFile() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('保存数据库失败:', err);
  }
}

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      content_text TEXT DEFAULT '',
      status TEXT DEFAULT 'processing',
      uploaded_at TEXT DEFAULT (datetime('now', 'localtime')),
      user_id TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT '新对话',
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  saveToFile();
  console.log('✅ 数据库初始化完成');
  return db;
}

// 将 sql.js 返回的对象值转换为 JS 原生类型
function convertRow(obj) {
  if (!obj) return obj;
  const result = {};
  for (const key in obj) {
    const val = obj[key];
    if (val instanceof Uint8Array) {
      result[key] = new TextDecoder().decode(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

// 包装同步风格的 API 以兼容之前的代码
const dbWrapper = {
  prepare(sql) {
    return {
      run(...params) {
        db.run(sql, params);
        scheduleSave();
      },
      get(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        let result = null;
        if (stmt.step()) {
          result = convertRow(stmt.getAsObject());
        }
        stmt.free();
        return result;
      },
      all(...params) {
        const results = [];
        const stmt = db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(convertRow(stmt.getAsObject()));
        }
        stmt.free();
        return results;
      }
    };
  },
  run(sql, params = []) {
    db.run(sql, params);
    scheduleSave();
  },
  exec(sql) {
    db.exec(sql);
    scheduleSave();
  }
};

module.exports = { initDB, dbWrapper, saveToFile };
