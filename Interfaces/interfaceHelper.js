import hashObject from 'hash-object';
import { downMap, upMap } from '../constants/constants.js';
import { CustomError, handleCustomError } from '../utils/errorHandler.js';
import chalk from 'chalk';
import Table from 'cli-table3';

//status helper function
export function printMigrationData(data) {
  // Create a new table instance
  const table = new Table({
    head: ['# ID', 'Operation Type', 'Description', 'Status', 'Migration Date'],
    colWidths: [10, 20, 70, 30, 30],
    wordWrap: true,
    style: {
      head: ['blue'], // Colorize the header
    },
  });
  let i = 0;
  // Populate the table with data
  data.forEach((item, index) => {
    i += 1;
    let id, name, description, status, date;
    for (let [key, value] of Object.entries(item)) {
      id = chalk.yellow(String(i));
      name = value.operation;
      description = value.description ? value.description : '';
      status = value.currentStatus ? value.currentStatus : '';
      date = value.migrationDate ? new Date(value.migrationDate).toISOString() : '';

      // Apply colors to status
      if (value.currentStatus === 'Success') {
        status = chalk.green(status);
      } else {
        status = status;
      }
    }
    table.push([id, name, description, status, date]);
  });

  // Render the table to console
}

export const createCollectionsNeededForMigration = async () => {
  const client = global.client;
  let isFound = await client.listCollections('HISTORYLOGS');
  if (!isFound) {
    await client.createCollection('HISTORYLOGS', validationRules);
  }
  isFound = await client.listCollections('AFFECTED_DOCUMENTS');
  if (!isFound) {
    await client.createCollection('AFFECTED_DOCUMENTS');
  }
  await client.db.collection('AFFECTED_DOCUMENTS').createIndex({ operation_id: 1 });
};
