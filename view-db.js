// view-db.js - Friendly Database Viewer Utility
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'analystpath.db');
const db = new DatabaseSync(DB_PATH);

const targetTable = process.argv[2];

if (!targetTable) {
  console.log('========================================================');
  console.log('📊 DATABASE OVERVIEW: analystpath.db');
  console.log('========================================================\n');

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC").all();
  
  const stats = tables.map(t => {
    try {
      const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get().c;
      return { 'Table Name': t.name, 'Total Rows': count };
    } catch (e) {
      return { 'Table Name': t.name, 'Total Rows': 'Error' };
    }
  });

  console.table(stats);
  console.log('\n💡 Tip: To view records from any table, run:');
  console.log('   node view-db.js users');
  console.log('   node view-db.js career_paths');
  console.log('   node view-db.js courses');
  console.log('   node view-db.js questions');
  console.log('   node view-db.js study_groups');
} else {
  console.log(`========================================================`);
  console.log(`📋 RECORDS FROM TABLE: ${targetTable}`);
  console.log(`========================================================\n`);

  try {
    const rows = db.prepare(`SELECT * FROM "${targetTable}" LIMIT 10`).all();
    if (rows.length === 0) {
      console.log(`Table "${targetTable}" is currently empty.`);
    } else {
      // Omit very large JSON or sensitive salt strings for clean console output
      const cleanRows = rows.map(r => {
        const copy = { ...r };
        delete copy.password_hash;
        delete copy.salt;
        for (const k in copy) {
          if (typeof copy[k] === 'string' && copy[k].length > 60) {
            copy[k] = copy[k].slice(0, 57) + '...';
          }
        }
        return copy;
      });
      console.table(cleanRows);
      const total = db.prepare(`SELECT COUNT(*) as c FROM "${targetTable}"`).get().c;
      console.log(`\nShowing first ${rows.length} of ${total} total rows in ${targetTable}.`);
    }
  } catch (err) {
    console.error(`Error querying table "${targetTable}":`, err.message);
  }
}
