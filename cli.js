#!/usr/bin/env node

import { Command } from 'commander';
import { getCurrentState, migrate, rollback } from './Interfaces/interfaceFunctions.js';
import parseXML from './utils/parseXML.js';
import MongoDBWrapper from './utils/mongoDBWrapper.js';

const client = new MongoDBWrapper();

global.client = client;

const program = new Command();

const executeUp = async (steps) => {
  await client.connect();
  await migrate(steps);
  await client.disconnect();
};

const executeDown = async (steps, id) => {
  await client.connect();
  await rollback({ id, steps });
  await client.disconnect();
};

const executeStats = async (steps) => {
  await client.connect();
  await getCurrentState();
  await client.disconnect();
};
program
  .command('migrate')
  .description('Run migration up')
  .option('-s, --steps <steps>', 'Number of steps to migrate', parseInt)
  .action(async (cmdObj) => {
    const { steps } = cmdObj;
    await executeUp(steps);
    console.log('Migration up completed.');
    process.exit();
  });

program
  .command('rollback')
  .description('Rollback migrations')
  .option('-s, --steps <steps>', 'Number of steps to rollback', parseInt)
  .option('-i, --id <id>', 'Rollback to a specific ID')
  .action(async (cmdObj) => {
    const { steps, id } = cmdObj;
    await executeDown(steps, id);
    console.log(`Rollback completed ${steps ? `by ${steps} steps` : ''}${id ? ` to ID ${id}` : ''}.`);
    process.exit();
  });

program
  .command('status')
  .description('get current status')
  .action(async () => {
    await executeStats();
    process.exit();
  });

program.parse(process.argv);
