import cliProgress from 'cli-progress';
import { CustomError, handleCustomError } from '../utils/errorHandler.js';
import {
  handleAffectedDocsAndLogsInsertion,
  mergeObject,
  parseInput,
  prepareFilter,
  validateCollection,
  getDocsCount,
  validateDocumentsArray,
  getLastAffectedDocumentID,
} from './helperFunctions.js';
import {
  checkForUpdateDocuments,
  createDocsLog,
  updateDocumentsMigrate,
  updateDocumentsRollback,
  migrateAggregation,
  rollbackAggregationAndUpdate,
  deleteDocumentsMigration,
  deleteDocumentsRollback,
} from './helperFunctions/documentHelper.js';

export const insertDocuments = async (body) => {
  const client = global.client;
  const session = client.client.startSession();
  let sessionStarted = false;
  let {
    documents,
    collection,
    rollback,
    batchSize,
    lastAffectedDocumentId,
    batchNo,
    affectedDocumentsCount,
    batchTotalCount,
    filter,
  } = body;

  console.log(`\nInsert documents operation started successfully for collection '${collection}' ...`);
  await client.checkCollection(collection);

  // Initialize the progress bar
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(batchTotalCount, batchNo);

  documents = parseInput(documents);
  try {
    for (; batchNo <= batchTotalCount; batchNo++) {
      progressBar.update(batchNo);

      session.startTransaction();
      sessionStarted = true;

      if (rollback) {
        documents = await client.read(
          'AFFECTED_DOCUMENTS',
          { operation_id: body._id },
          session,
          lastAffectedDocumentId,
          batchSize,
          batchNo
        );

        documents = documents.map((doc) => doc.document);
      }

      lastAffectedDocumentId = await getLastAffectedDocumentID(lastAffectedDocumentId, collection, session);

      const affectedDocuments = await client.bulkInsert(collection, documents, session);
      affectedDocumentsCount += affectedDocuments.length;

      let updates = {
        affectedDocuments,
        filter,
        batchTotalCount,
        batchNo,
        update: null,
        affectedDocumentsCount,
        lastAffectedDocumentId,
      };

      body = mergeObject(body, updates);

      await handleAffectedDocsAndLogsInsertion(body, createDocsLog, session, batchNo);
      await session.commitTransaction();
      sessionStarted = false;
    }

    console.log(`\nInsert documents operation completed successfully for collection '${collection}'\n`);
  } catch (err) {
    if (sessionStarted) {
      await session.abortTransaction();
    }
    console.error(`Error in insert documents operation: ${err.message}`);
    handleCustomError(err);
  } finally {
    progressBar.stop();
    session.endSession();
  }
};

export const deleteDocuments = async (body) => {
  let {
    filter,
    documents,
    collection,
    batchSize,
    rollback,
    lastAffectedDocumentId,
    batchNo,
    affectedDocumentsCount,
    batchTotalCount,
    update,
  } = body;

  console.log(`\nDelete documents operation started successfully for collection '${collection}' ...`);

  let sessionStarted = false;
  const client = global.client;
  const session = client.client.startSession();
  validateCollection(collection);

  // Initialize the progress bar
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(batchTotalCount, batchNo);

  try {
    await client.checkCollection(collection);

    let affectedDocuments = [];
    try {
      for (; batchNo <= batchTotalCount; batchNo++) {
        progressBar.update(batchNo);
        session.startTransaction();
        sessionStarted = true;

        if (rollback) {
          ({ affectedDocuments, lastAffectedDocumentId } = await deleteDocumentsRollback(
            collection,
            migratedOperationId,
            lastAffectedDocumentId,
            affectedDocumentsCount,
            batchSize,
            batchNo,
            session
          ));
        } else {
          ({ affectedDocuments, affectedDocumentsCount, lastAffectedDocumentId } = await deleteDocumentsMigration(
            collection,
            filter,
            affectedDocuments,
            lastAffectedDocumentId,
            affectedDocumentsCount,
            batchSize,
            batchNo,
            session
          ));
        }

        body.affectedDocuments = affectedDocuments;
        body.affectedDocumentsCount = affectedDocumentsCount;
        body.lastAffectedDocumentId = lastAffectedDocumentId;
        body.batchNo = batchNo;
        body.filter = filter;
        body.update = update;
        await handleAffectedDocsAndLogsInsertion(body, createDocsLog, session, batchNo);
        await session.commitTransaction();
        sessionStarted = false;
      }
      console.log(`\nDelete documents operation completed successfully for collection '${collection}'\n`);
    } catch (err) {
      if (sessionStarted) {
        await session.abortTransaction();
      }
      console.error(`Error in delete documents operation: ${err.message}`);
      handleCustomError(err);
    }
  } catch (err) {
    console.error(`Error in delete documents operation: ${err.message}`);
    handleCustomError(err);
  } finally {
    progressBar.stop();
    session.endSession();
  }
};

export const updateDocuments = async (body) => {
  let {
    filter,
    update,
    documents,
    collection,
    rollback,
    batchSize,
    batchNo,
    batchTotalCount,
    lastAffectedDocumentId,
    affectedDocumentsCount,
    migratedOperationId,
  } = body;

  console.log(`\nUpdate documents operation started successfully for collection '${collection}' ...`);
  // Initialize the progress bar
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(batchTotalCount, batchNo);
  let affectedDocuments = [];
  let sessionStarted = false;
  const client = global.client;
  const session = client.client.startSession();
  try {
    update = parseInput(update);
    await checkForUpdateDocuments(collection, filter, update, documents, rollback);

    for (; batchNo <= batchTotalCount; batchNo++) {
      session.startTransaction();
      sessionStarted = true;
      body.batchNo = batchNo;

      if (rollback) {
        ({ affectedDocumentsCount, lastAffectedDocumentId } = await rollbackAggregationAndUpdate(
          collection,
          migratedOperationId,
          lastAffectedDocumentId,
          affectedDocumentsCount,
          batchSize,
          batchNo,
          session
        ));
        body.affectedDocumentsCount = affectedDocumentsCount;
        body.lastAffectedDocumentId = lastAffectedDocumentId;
      } else {
        ({ affectedDocumentsCount, affectedDocuments, lastAffectedDocumentId } = await updateDocumentsMigrate(
          collection,
          documents,
          filter,
          update,
          lastAffectedDocumentId,
          batchSize,
          batchNo,
          batchTotalCount,
          affectedDocumentsCount,
          session
        ));
        body.affectedDocuments = affectedDocuments;
        body.lastAffectedDocumentId = lastAffectedDocumentId;
        body.affectedDocumentsCount = affectedDocumentsCount;
      }
      await handleAffectedDocsAndLogsInsertion(body, createDocsLog, session, batchNo);

      await session.commitTransaction();
      progressBar.update(batchNo);
      sessionStarted = false; // Reset sessionStarted after successful commit
    }

    console.log(`\nUpdate documents operation completed successfully for collection '${collection}'\n`);
  } catch (err) {
    if (sessionStarted) {
      await session.abortTransaction();
    }
    console.error(`Error in update documents operation: ${err.message}`);
    handleCustomError(err);
  } finally {
    progressBar.stop();
    session.endSession();
  }
};

export const createAggregationPipeline = async (body) => {
  const client = global.client;
  const session = client.client.startSession();
  let sessionStarted = false;
  let {
    collection,
    pipeline,
    rollback,
    batchSize,
    batchNo,
    batchTotalCount,
    lastAffectedDocumentId,
    affectedDocumentsCount,
    filter,
    migratedOperationId,
  } = body;
  let affectedDocuments;

  if (!filter || typeof filter !== 'object')
    throw new CustomError('Filter must be passed as an object', 'Invalid filter');

  console.log(`\nAggregation pipeline operation started successfully for collection '${collection}' ...`);
  await client.checkCollection(collection);

  // Initialize the progress bar
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(batchTotalCount, batchNo);

  pipeline = parseInput(pipeline);

  if (batchNo == 1) {
    pipeline.unshift({ $limit: 1000 });
  }

  try {
    for (; batchNo <= batchTotalCount; batchNo++) {
      progressBar.update(batchNo);

      session.startTransaction();
      sessionStarted = true;

      if (rollback) {
        ({ affectedDocumentsCount, lastAffectedDocumentId } = await rollbackAggregationAndUpdate(
          collection,
          migratedOperationId,
          lastAffectedDocumentId,
          affectedDocumentsCount,
          batchSize,
          batchNo,
          session
        ));
      } else {
        ({ affectedDocuments, affectedDocumentsCount, lastAffectedDocumentId } = await migrateAggregation(
          collection,
          filter,
          lastAffectedDocumentId,
          affectedDocumentsCount,
          pipeline,
          batchSize,
          batchNo,
          session
        ));
      }

      body.affectedDocumentsCount = affectedDocumentsCount;
      body.batchNo = batchNo;
      body.lastAffectedDocumentId = lastAffectedDocumentId;
      body.pipeline = pipeline;
      await handleAffectedDocsAndLogsInsertion(body, createDocsLog, session, batchNo);

      await session.commitTransaction();

      sessionStarted = false;
    }
    console.log(`\nAggregation pipeline operation completed successfully for collection '${collection}'\n`);
  } catch (err) {
    if (sessionStarted) {
      await session.abortTransaction();
    }
    console.error(`Error in aggregation pipeline operation: ${err.message}`);
    handleCustomError(err);
  } finally {
    progressBar.stop();
    session.endSession();
  }
};
