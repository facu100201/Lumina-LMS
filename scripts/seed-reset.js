const fs   = require('fs');
const path = require('path');

const DB = path.join(__dirname, '..', 'db', 'lumina.db');

[DB, `${DB}-shm`, `${DB}-wal`].forEach(f => {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log(`[seed:reset] Deleted ${path.basename(f)}`);
  }
});

console.log('[seed:reset] Done — restart the server to re-seed with demo data.');
