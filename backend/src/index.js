#!/usr/bin/env node

const path = require('path');
const sync = require('./services/sync');

// When invoked directly we behave as a simple CLI; otherwise the
// module can be required by other components (e.g. tests).
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'sync') {
    const root = path.resolve(__dirname, '../content');
    console.log(`Starting sync on ${root}`);
    try {
      await sync.run(root);
      console.log('Sync completed.');
    } catch (err) {
      console.error('Sync failed:', err);
      process.exit(1);
    }
  } else {
    console.log('TheCookBook backend CLI');
    console.log('Usage: npm run sync');
  }
}

if (require.main === module) {
  main();
} else {
  // if this file is required, just export the sync function
  module.exports = { sync };
}
