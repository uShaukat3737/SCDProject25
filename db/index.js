const fileDB = require('./file');
const recordUtils = require('./record');
const vaultEvents = require('../events');
const fs = require('fs');
require('dotenv').config();

// === MongoDB Setup (Optional) ===
let mongoose, Record, useMongo = false;

try {
  mongoose = require('mongoose');
  mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 })
    .then(() => {
      useMongo = true;
      Record = mongoose.model('Record', new mongoose.Schema({
        id: Number,
        name: String,
        value: String,
        createdAt: { type: Date, default: Date.now }
      }));
      console.log("MongoDB connected");
    })
    .catch(err => {
      console.log("MongoDB not available (using file DB):", err.message);
    });
} catch (e) {
  console.log("Mongoose not installed — using file DB");
}

// === CRUD (MongoDB or File) ===
async function addRecord({ name, value }) {
  recordUtils.validateRecord({ name, value });
  const newRecord = { id: recordUtils.generateId(), name, value, createdAt: new Date() };

  if (useMongo && Record) {
    await new Record(newRecord).save();
  } else {
    const data = fileDB.readDB();
    data.push(newRecord);
    fileDB.writeDB(data);
  }
  vaultEvents.emit('recordAdded', newRecord);
  createBackup();
  return newRecord;
}

async function listRecords() {
  if (useMongo && Record) return await Record.find().sort({ createdAt: 1 });
  return fileDB.readDB();
}

async function updateRecord(id, newName, newValue) {
  if (useMongo && Record) {
    const updated = await Record.findOneAndUpdate({ id }, { name: newName, value: newValue }, { new: true });
    if (updated) vaultEvents.emit('recordUpdated', updated);
    return updated;
  }
  const data = fileDB.readDB();
  const record = data.find(r => r.id === id);
  if (!record) return null;
  record.name = newName;
  record.value = newValue;
  fileDB.writeDB(data);
  vaultEvents.emit('recordUpdated', record);
  return record;
}

async function deleteRecord(id) {
  if (useMongo && Record) {
    const deleted = await Record.findOneAndDelete({ id });
    if (deleted) {
      vaultEvents.emit('recordDeleted', deleted);
      createBackup();
    }
    return deleted;
  }
  let data = fileDB.readDB();
  const record = data.find(r => r.id === id);
  if (!record) return null;
  data = data.filter(r => r.id !== id);
  fileDB.writeDB(data);
  vaultEvents.emit('recordDeleted', record);
  createBackup();
  return record;
}

async function searchRecords(keyword) {
  const term = keyword.toLowerCase();
  const data = useMongo && Record ? await Record.find() : fileDB.readDB();
  return data.filter(r =>
    r.id.toString().includes(term) ||
    r.name.toLowerCase().includes(term) ||
    r.value.toLowerCase().includes(term)
  );
}

async function sortRecords(field = 'name', order = 'asc') {
  const data = useMongo && Record ? await Record.find() : fileDB.readDB();
  const sorted = [...data].sort((a, b) => {
    if (field === 'name') return a.name.localeCompare(b.name);
    if (field === 'value') return a.value.localeCompare(b.value);
    return 0;
  });
  if (order === 'desc') sorted.reverse();
  return sorted;
}

function exportData() {
  const data = fileDB.readDB();
  const header = `Vault Export - ${new Date().toLocaleString()}\nTotal Records: ${data.length}\nFile: export.txt\n\nRecords:\n`;
  const lines = data.map(r => `ID: ${r.id} | Name: ${r.name} | Value: ${r.value} | Created: ${r.createdAt || 'N/A'}`);
  fs.writeFileSync('export.txt', header + lines.join('\n') + '\n');
  console.log("Data exported to export.txt");
}

function createBackup() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
  if (!fs.existsSync('backups')) fs.mkdirSync('backups');
  const data = fileDB.readDB();
  fs.writeFileSync(`backups/backup_${ts}.json`, JSON.stringify(data, null, 2));
  console.log(`Backup: backup_${ts}.json`);
}

async function getStats() {
  let data = [];
  let lastMod = 'Never';
  try {
    data = useMongo && Record ? await Record.find() : fileDB.readDB();
    if (data.length > 0 && !useMongo) {
      const fileStat = fs.statSync('vault.json');
      lastMod = fileStat.mtime.toLocaleString();
    }
  } catch (e) {}

  if (data.length === 0) {
    return { total: 0, longest: '', longestLen: 0, earliest: '', latest: '', lastMod };
  }

  const names = data.map(r => r.name);
  const longest = names.reduce((a, b) => a.length > b.length ? a : b, "");
  const dates = data.map(r => new Date(r.createdAt || Date.now()));
  const earliest = new Date(Math.min(...dates)).toISOString().split('T')[0];
  const latest = new Date(Math.max(...dates)).toISOString().split('T')[0];

  return { total: data.length, longest, longestLen: longest.length, earliest, latest, lastMod };
}

module.exports = {
  addRecord, listRecords, updateRecord, deleteRecord,
  searchRecords, sortRecords, exportData, createBackup, getStats
};
