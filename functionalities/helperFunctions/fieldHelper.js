import { CustomError, handleCustomError } from '../../utils/errorHandler.js';
import {
  getLastAffectedDocumentID,
  handleAffectedDocsAndLogsInsertion,
  mergeObject,
  prepareFilter,
} from '../helperFunctions.js';
import cliProgress from 'cli-progress';

export const performFieldOperation = async (body) => {
  let { collection, filter, operation, lastAffectedDocumentId, affectedDocumentsCount, batchNo, batchTotalCount } =
    body;
  const client = global.client;
  console.log(`\n${operation} operation started successfully...`);
  const session = client.client.startSession();
  let sessionStarted = false;
  // Initialize the progress bar
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(batchTotalCount, batchNo);

  try {
    for (; batchNo <= batchTotalCount; batchNo++) {
      progressBar.update(batchNo);
      session.startTransaction();
      sessionStarted = true;
      let affectedDocuments = await executeFieldUpdate(body, session);

      affectedDocumentsCount += (affectedDocuments && affectedDocuments.length) || 0;
      lastAffectedDocumentId = await getLastAffectedDocumentID(lastAffectedDocumentId, collection, session);
      body.lastAffectedDocumentId = lastAffectedDocumentId;

      let updates = {
        affectedDocuments,
        filter,
        batchTotalCount,
        batchNo,
        affectedDocumentsCount,
      };

      body = mergeObject(body, updates);
      await handleAffectedDocsAndLogsInsertion(body, createFieldLog, session, batchNo);

      await session.commitTransaction();
      sessionStarted = false;
    }

    console.log(`\n${operation} completed successfully\n`);
  } catch (err) {
    if (sessionStarted) {
      await session.abortTransaction();
    }
    handleCustomError(err);
  } finally {
    session.endSession();
  }
};

export const executeFieldUpdate = async (body, session) => {
  let { collection, filter, name, update, rollback, operation, lastAffectedDocumentId, batchSize, batchNo } = body;
  const client = global.client;
  let docs;

  if (rollback) {
    docs = await client.read(
      'AFFECTED_DOCUMENTS',
      { operation_id: body._id },
      session,
      lastAffectedDocumentId,
      batchSize,
      batchNo
    );
    if (docs && docs.length) {
      docs = docs.map((doc) => doc.document);
    }
  } else {
    docs = await client.read(collection, filter, session, lastAffectedDocumentId, batchSize, batchNo);
  }

  if (!docs && !docs.length) {
    throw new CustomError('No documents found for the given filter', 'Check the filter criteria and try again.');
  }
  let affectedDocuments =
    docs &&
    docs.length &&
    docs.map((doc) => ({
      _id: doc._id,
      ...(doc[name] != undefined && { [name]: doc[name] }),
    }));

  filter = { _id: { $in: docs.map((doc) => doc._id) } };

  if (rollback && operation === 'addfield') {
    await client.updateDirect(collection, affectedDocuments, session);
  } else {
    await client.bulkUpdate(collection, filter, update, session);
  }

  return affectedDocuments;
};

export const createFieldLog = (body) => {
  const {
    collection,
    operation,
    field,
    lastAffectedDocumentId,
    affectedDocumentsCount,
    filter,
    update,
    id,
    actionSet,
    hashCheck,
    actionSetType,
    batchNo,
    batchTotalCount,
  } = body;

  return {
    collection,
    actionSet,
    actionSetType,
    operation,
    operationId: id,
    hashCheck,
    field,
    filter,
    update,
    lastAffectedDocumentId,
    affectedDocumentsCount,
    batchNo,
    batchTotalCount,
    completed: batchNo === batchTotalCount ? true : false,
    createdAt: new Date(),
  };
};

export const checkForRenameField = async (collection, name, newName) => {
  const client = global.client;

  await client.checkCollection(collection);

  if (batchNo == 1) {
    const isNewFieldNameExists = await client.read(collection, {
      [newName]: { $exists: true },
    });
    if (isNewFieldNameExists.length) {
      throw new CustomError('Field already exists', `The field '${newName}' already exists in the collection.`);
    }
  }

  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new CustomError('Invalid field name', "Ensure 'name' is a non-empty string.");
  }
  if (!newName || typeof newName !== 'string' || newName.trim() === '') {
    throw new CustomError('Invalid new field name', "Ensure 'newName' is a non-empty string.");
  }

  if (name === newName) {
    throw new CustomError(
      'Cannot rename field to the same name',
      'The new field name should be different from the old field name.'
    );
  }
};
