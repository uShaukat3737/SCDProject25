const readline = require('readline');
const db = require('./db');
require('./events/logger');   // keep the logger

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Helper to ask a question and return a Promise
 */
function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

/**
 * Main menu – async/await version (cleaner & works with MongoDB later)
 */
async function menu() {
  console.log(`
===== NodeVault =====
1. Add Record
2. List Records
3. Update Record
4. Delete Record
5. Search Records
6. Sort Records
7. Export Data
8. View Statistics
9. Exit
=====================
  `);

  const choice = await ask('Choose option: ');

  switch (choice.trim()) {
    case '1':
      const name = await ask('Enter name: ');
      const value = await ask('Enter value: ');
      await db.addRecord({ name, value });
      console.log('Record added successfully!');
      break;

    case '2':
      const all = await db.listRecords();
      if (all.length === 0) console.log('No records found.');
      else all.forEach(r => console.log(`ID: ${r.id} | ${r.name} = ${r.value}`));
      break;

    case '3':
      const idUpd = parseInt(await ask('Enter record ID to update: '));
      const newName = await ask('New name: ');
      const newValue = await ask('New value: ');
      const upd = await db.updateRecord(idUpd, newName, newValue);
      console.log(upd ? 'Record updated!' : 'Record not found.');
      break;

    case '4':
      const idDel = parseInt(await ask('Enter record ID to delete: '));
      const del = await db.deleteRecord(idDel);
      console.log(del ? 'Record deleted!' : 'Record not found.');
      break;

    case '5':
      const term = await ask('Enter search keyword: ');
      const results = await db.searchRecords(term);
      if (results.length === 0) console.log('No records found.');
      else {
        console.log(`Found ${results.length} matching record(s):`);
        results.forEach((r, i) => console.log(`${i + 1}. ID: ${r.id} | ${r.name}`));
      }
      break;

    case '6':
      console.log('Sort by: (1) Name  (2) Creation Date');
      const sortField = await ask('Choice: ');
      console.log('Order: (1) Ascending  (2) Descending');
      const sortOrder = await ask('Choice: ');
      const sorted = await db.sortRecords(
        sortField === '1' ? 'name' : 'createdAt',
        sortOrder === '1' ? 'asc' : 'desc'
      );
      console.log('Sorted records:');
      sorted.forEach(r => console.log(`→ ${r.name} (${r.createdAt || 'N/A'})`));
      break;

    case '7':
      db.exportData();
      break;

    case '8':
      const stats = await db.getStats();
      console.log('Vault Statistics:');
      console.log('--------------------------');
      console.log(`Total Records: ${stats.total}`);
      console.log(`Last Modified: ${stats.lastMod}`);
      console.log(`Longest Name: ${stats.longest} (${stats.longestLen} characters)`);
      console.log(`Earliest Record: ${stats.earliest}`);
      console.log(`Latest Record: ${stats.latest}`);
      break;

    case '9':
      console.log('Exiting NodeVault...');
      rl.close();
      return;

    default:
      console.log('Invalid choice. Try again.');
  }

  // Loop back to menu
  menu();
}

// Start the app
menu();
