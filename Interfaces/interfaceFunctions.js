import { validationRules } from '../db/historyLog.schema.js';
import MongoDBWrapper from '../utils/mongoDBWrapper.js';
import parseXML from '../utils/parseXML.js';
import { UUID } from 'mongodb';
import hashObject from 'hash-object';
import { handleCustomError } from '../utils/errorHandler.js';
import {
  checkCanMigrate,
  getMigratedOperations,
  migrateUp,
  validateChangeLog,
} from './helperFunctions/migrateHelper.js';

import { getRollbackOperations, migrateDown, checkCanRollback } from './helperFunctions/rollbackHelper.js';
import { createCollectionsNeededForMigration, printMigrationData } from './interfaceHelper.js';
export const migrate = async (steps) => {
  let idMap = {};
  let actionSet = new UUID().toString();
  let parsedOperations = parseXML();
  let count = 0;

  try {
    await createCollectionsNeededForMigration();

    await checkCanMigrate();

    if (!parsedOperations) return;

    // validateChangeLog(parsedOperations, );

    let operations = await getMigratedOperations(parsedOperations, idMap);
    for (const operation of operations) {
      count++;
      for (const [key, body] of Object.entries(operation)) {
        //
        body.operation = key.toLocaleLowerCase();
        body.actionSet = actionSet;
        body.hashCheck = hashObject(operation);
        //

        await migrateUp(body);

        if (steps && count === steps) return;
      }
    }
  } catch (err) {
    handleCustomError(err);
  }
};

//
//

export const rollback = async (body) => {
  await createCollectionsNeededForMigration();

  let { id, steps } = body;
  let actionSet = new UUID().toString();
  steps = +steps;
  if (!id && !steps) steps = 1;
  const collection = client.db.collection('HISTORYLOGS');
  let docs = [];

  try {
    if (id) {
      let found = await collection.findOne({ _id: new ObjectId(id) });
      if (!found) throw new Error('ID is not found');
    }

    await checkCanRollback();

    let count = 0;

    const rollbackCursor = await getRollbackOperations();
    while (await rollbackCursor.hasNext()) {
      let doc = await rollbackCursor.next();
      doc.actionSetNew = actionSet;
      count++;
      await migrateDown(doc);
      if ((steps && count >= steps) || (doc._id === id && id && doc._id)) {
        return;
      }
    }
  } catch (err) {
    handleCustomError(err);
  }
};

//

export const getCurrentState = async () => {
  try {
    const migratedDocs = await client.read('HISTORYLOGS', {
      actionSetType: 'migrate',
      hasRolledBack: { $exists: false },
    });
    let parsedOperations = parseXML();
    let i = 0;

    for (i; i < migratedDocs.length; i++) {
      for (let [key, body] of Object.entries(parsedOperations[i])) {
        if (!body.completed) {
          body.currentStatus = 'Pending';
        } else {
          body.currentStatus = 'Success';
        }
        body.migrationDate = migratedDocs[i].createdAt;
        body.operation = key;
      }
    }

    for (let j = i; j < parsedOperations.length; j++) {
      for (let [key, body] of Object.entries(parsedOperations[j])) {
        body.currentStatus = 'Not Migrated';
        body.operation = key;
      }
    }

    printMigrationData(parsedOperations);
  } catch (err) {
    handleCustomError(err);
  }
};
