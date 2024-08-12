import hashObject from 'hash-object';
import { downMap, downOperationNameMap, upMap } from '../../constants/constants.js';
import { CustomError, handleCustomError } from '../../utils/errorHandler.js';
import {
  getBatchTotalCountAndDocsCountToBody,
  getDocsCount,
  mergeObject,
  prepareFilter,
} from '../../functionalities/helperFunctions.js';

export const migrateDown = async (body) => {
  const client = global.client;
  body = await prepareRollbackBody(body);
  const { operation } = body;
  try {
    const rollback = upMap[operation];
    await rollback(body);
  } catch (err) {
    handleCustomError(err);
  }
};

//rollback helper functions

export const getRollbackOperations = async () => {
  const sortCriteria = { createdAt: -1 };
  const client = global.client;

  const collection = await client.db.collection('HISTORYLOGS');

  const cursor = collection.find(
    {
      $or: [
        {
          actionSetType: 'migrate',
          hasRolledBack: { $exists: false },
        },
        {
          actionSetType: 'rollback',
          completed: false,
        },
      ],
    },
    {
      sort: { _id: -1 },
    }
  );
  return cursor;
};

export const checkCanRollback = async () => {
  const client = global.client;
  const cursor = await client.db.collection('HISTORYLOGS').find({}, { sort: { _id: -1 } });
  let doc = (await cursor.next()) || {};
  if (!doc.completed && doc.actionSetType === 'migrate') {
    throw new CustomError(
      'Cannot rollback',
      'There is a pending migration operation. Continue migrating this operation then rollback'
    );
  }
};

export const prepareRollbackBody = async (body) => {
  const client = global.client;
  let operation = body.operation.toLowerCase();

  let { filter, documents, batchTotalCount, completed } = body;

  filter = prepareFilter(filter, documents);

  let updates = {};

  if (completed || completed === undefined) {
    updates = {
      operation,
      operation: downOperationNameMap[operation],
      rollback: true,
      actionSet: body.actionSetNew,
      actionSetType: 'rollback',
      id: body.operationId,
      batchSize: 1000,
      completed: false,
      batchNo: 1,
      batchTotalCount: batchTotalCount,
      lastAffectedDocumentId: undefined,
      affectedDocumentsCount: 0,
      filter,
      migratedOperationId: body._id,
    };

    body = mergeObject(body, updates);
    body = await getBatchTotalCountAndDocsCountToBody(body);
  } else {
    body.operation_id = body._id;
    body.rollback = true;
  }

  return body;
};
