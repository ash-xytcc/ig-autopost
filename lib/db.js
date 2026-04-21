const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.env.APPDATA || process.env.HOME, "ig-autopost", "runtime");
const DB_PATH = path.join(DATA_DIR, "db.json");
const BACKUP_PATH = path.join(DATA_DIR, "db.backup.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDB() {
  ensureDataDir();

  if (!fs.existsSync(DB_PATH)) {
    const empty = { profiles: [], posts: [], targets: [], logs: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);

    if (
      parsed &&
      (parsed.posts?.length || parsed.profiles?.length || parsed.targets?.length)
    ) {
      return parsed;
    }

    if (fs.existsSync(BACKUP_PATH)) {
      console.warn("DB looks empty, restoring from backup...");
      return JSON.parse(fs.readFileSync(BACKUP_PATH, "utf-8"));
    }

    return parsed;
  } catch (err) {
    console.error("DB corrupted, attempting backup restore", err);

    if (fs.existsSync(BACKUP_PATH)) {
      return JSON.parse(fs.readFileSync(BACKUP_PATH, "utf-8"));
    }

    throw err;
  }
}

function saveDB(db) {
  ensureDataDir();

  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
  }

  const tempPath = DB_PATH + ".tmp";
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2));
  fs.renameSync(tempPath, DB_PATH);
}

module.exports = { loadDB, saveDB, DB_PATH };
