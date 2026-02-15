#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbPath = path.join(process.env.HOME, 'Library/Application Support/Cursor/User/globalStorage/state.vscdb');
const contentPath = path.join(__dirname, '..', '.cursor-rules-content.txt');
const content = fs.readFileSync(contentPath, 'utf8');
const escaped = content.replace(/'/g, "''");
const sql = `UPDATE ItemTable SET value = '${escaped}' WHERE key = 'aicontext.personalContext';`;
const sqlPath = path.join(__dirname, '.cursor-rules-update.sql');
fs.writeFileSync(sqlPath, sql, 'utf8');
execSync(`sqlite3 "${dbPath}" ".read ${sqlPath}"`, { stdio: 'inherit' });
fs.unlinkSync(sqlPath);
console.log('Cursor 全域規則已寫入，長度:', content.length);
