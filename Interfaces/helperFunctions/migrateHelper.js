import hashObject from 'hash-object';
import { CustomError, handleCustomError } from '../../utils/errorHandler.js';
import { downMap, upMap } from '../../constants/constants.js';
import {
  getBatchTotalCountAndDocsCountToBody,
  mergeObject,
  parseInput,
  prepareFilter,
} from '../../functionalities/helperFunctions.js';
//migrate helper functions

export const migrateUp = async (body) => {
  const client = global.client;
  try {
    body = await prepareBodyForMigration(body);
    const { operation } = body;
    const id = body.id || body.operationId;
    if (!id)
      throw new CustomError('Each Operation must have an id', `give a unique id for the operation ${operation} `);
    const operationFunction = upMap[operation];

    if (operationFunction) {
      await operationFunction(body);
    } else {
      throw new CustomError('Unknown Operation ', `write the operation ${operation} with a correct operation name `);
    }
  } catch (err) {
    handleCustomError(err);
  }
};

export const getMigratedOperations = async (parsedOperations) => {
  const client = global.client;

  try {
    const lastDocument = await client.db
      .collection('HISTORYLOGS')
      .find({
        actionSetType: 'migrate',
        hasRolledBack: { $exists: false },
      })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    if (!lastDocument.length) return parsedOperations;
    let lastDocumentBody = lastDocument[0];

    const checkUnique = uniqueIdChecker(parsedOperations);

    if (!checkUnique) {
      throw new CustomError('Duplicate ID found', 'All operations must have unique ids.');
    }

    let operations = findOperationsToBeMigrated(parsedOperations, lastDocumentBody);
    return operations;
  } catch (err) {
    handleCustomError(err);
  }
};

export const uniqueIdChecker = (parsedOperations) => {
  let idMap = {};

  for (const operation of parsedOperations) {
    for (const [key, value] of Object.entries(operation)) {
      const { id } = value;
      idMap[id] = (idMap[id] || 0) + 1;
      if (idMap[id] > 1) {
        return false;
      }
    }
  }
  return true;
};

export const findOperationsToBeMigrated = (parsedOperations, body) => {
  const { completed, operationId } = body;
  let startId = operationId;
  let flag = false;
  let operations = [];

  for (const operation of parsedOperations) {
    for (let [key, value] of Object.entries(operation)) {
      if (flag) {
        operations.push(operation);
      }
      if (value.id == startId) {
        flag = true;
        if (!completed) {
          operation[key] = body;
          operations.push(operation);
        }
      }
    }
  }

  return operations;
};

export const validateChangeLog = async (operations) => {
  try {
    const client = global.client;
    const docs = await client.read('HISTORYLOGS', {
      actionSetType: 'migrate',
      hasRolledBack: { $exists: false },
      completed: true,
    });
    for (let i = 0; i < docs.length; i++) {
      const operation = operations[i];
      const hash = hashObject(operation); // If hashObject is synchronous
      if (hash != docs[i].hashCheck) {
        throw new CustomError('The changelog has been modified', 'Try to return it to its initial state');
      }
    }
  } catch (err) {
    handleCustomError(err);
  }
};

export const checkCanMigrate = async () => {
  const client = global.client;

  const cursor = client.db
    .collection('HISTORYLOGS')
    .find({}, { sort: { _id: -1 } })
    .limit(1);
  let doc = (await cursor.next()) || {};
  if (!doc.completed && doc.sessionType === 'rollback') {
    throw new CustomError(
      'Cannot migrate',
      'There is a pending rollback operation. Continue rollback this operation then migrate'
    );
  }
};

export const prepareBodyForMigration = async (body) => {
  let { filter, documents, completed, update } = body;

  filter = prepareFilter(filter, documents);
  if (update) {
    update = parseInput(update);
  }

  if (completed || completed == undefined) {
    const updates = {
      actionSetType: 'migrate',
      rollback: false,
      batchSize: 1000,
      completed: false,
      batchNo: 1,
      affectedDocumentsCount: 0,
      lastAffectedDocumentId: undefined,
      filter,
      update,
    };

    body = mergeObject(body, updates);
    body = await getBatchTotalCountAndDocsCountToBody(body);
  } else {
    body.operation_id = body._id;
  }
  return body;
};
