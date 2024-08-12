import { ObjectId } from 'mongodb';
import { getLastAffectedDocumentID, mergeObject, parseInput } from '../helperFunctions.js';
import { CustomError } from '../../utils/errorHandler.js';

export const createDocsLog = (body) => {
  let {
    collection,
    operation,
    actionSet,
    actionSetType,
    id,
    hashCheck,
    filter,
    update,
    pipeline,
    affectedDocumentsCount,
    lastAffectedDocumentId,
    batchNo,
    batchTotalCount,
    migratedOperationId,
    rollback,
  } = body;

  const doc = {
    collection,
    actionSet,
    actionSetType,
    operation,
    operationId: body.operationId || id,
    hashCheck,
    batchTotalCount,
    filter,
    update,
    pipeline,
    lastAffectedDocumentId,
    affectedDocumentsCount,
    completed: batchNo === batchTotalCount ? true : false,
    batchNo,
    createdAt: new Date(),
    migratedOperationId,
  };
  return doc;
};

export const checkForUpdateDocuments = async (collection, filter, update, documents, rollback) => {
  const client = global.client;
  await client.checkCollection(collection);

  if (update && !update.$set) {
    update = parseInput(update);
    update = { $set: update };
  }
  if (documents && typeof documents === 'string') {
    documents = parseInput(documents);
  }

  if (!rollback && ((!filter && !documents) || (filter && documents))) {
    throw new CustomError('Invalid update criteria', "Provide either 'filter' or 'documents', not both.");
  }

  if ((!update || typeof update !== 'object' || Array.isArray(update)) && !documents) {
    throw new CustomError('Invalid update object', "Ensure 'update' is a valid object.");
  }

  if (documents && documents.length > 1000) {
    throw new CustomError('Cant update directly an array of documents with length more than 1000');
  }
};

export const updateDocumentsRollback = async (body, session) => {
  let {
    lastAffectedDocumentId,
    collection,
    batchNo,
    batchSize,
    affectedDocumentsCount,
    update,
    filter,
    batchTotalCount,
  } = body;
  let affectedDocuments = [];
  const client = global.client;

  let docs = await client.read(
    'AFFECTED_DOCUMENTS',
    { operation_id: body.migratedOperationId },
    session,
    lastAffectedDocumentId,
    batchSize,
    batchNo
  );

  affectedDocuments = docs.map((doc) => doc.document);

  lastAffectedDocumentId = await getLastAffectedDocumentId(lastAffectedDocumentId, collection, session);

  affectedDocumentsCount += affectedDocuments.length;

  await client.bulkDelete(collection, affectedDocuments, session);

  let updates = {
    affectedDocuments,
    filter,
    batchTotalCount,
    batchNo,
    update,
    affectedDocumentsCount,
    lastAffectedDocumentId,
  };
  body = mergeObject(body, updates);
};

export const updateDocumentsMigrate = async (
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
) => {
  let affectedDocuments = [];
  const client = global.client;
  if (!documents) {
    affectedDocuments = await client.read(collection, filter, session, lastAffectedDocumentId, batchSize, batchNo);
  } else {
    affectedDocuments = documents;
  }

  let query = {
    _id: { $in: affectedDocuments.map((doc) => new ObjectId(doc._id)) },
  };
  affectedDocumentsCount += affectedDocuments.length;

  await client.bulkUpdate(collection, query, update, session);

  lastAffectedDocumentId = await getLastAffectedDocumentId(lastAffectedDocumentId, collection, session);

  return { affectedDocuments, affectedDocumentsCount, lastAffectedDocumentId };
};

export const migrateAggregation = async (
  collection,
  filter,
  lastAffectedDocumentId,
  affectedDocumentsCount,
  pipeline,
  batchSize,
  batchNo,
  session
) => {
  const client = global.client;

  if (!pipeline || !pipeline.length) {
    throw new CustomError('Invalid pipeline', "Ensure 'pipeline' is a valid aggregation pipeline not an empty string");
  }

  // If filter is not provided, attempt to extract it from the pipeline
  // const matchStage = pipeline.find((stage) => stage.$match);

  // if (!filter) {
  //   if (matchStage) {
  //     filter = matchStage.$match;
  //   }
  // }
  // Add the match and limit stages to the beginning of the pipeline

  const affectedDocuments = await client.read(collection, filter, session, lastAffectedDocumentId, batchSize, batchNo);

  const results = await client.aggregate(collection, pipeline, batchNo, lastAffectedDocumentId, session);

  lastAffectedDocumentId = await getLastAffectedDocumentId(lastAffectedDocumentId, collection, session);

  const bulkOps = results.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: doc },
      upsert: true,
    },
  }));
  if (bulkOps && bulkOps.length) {
    await client.db.collection(collection).bulkWrite(bulkOps, { session });
  }
  affectedDocumentsCount += results.length;

  return { affectedDocuments, affectedDocumentsCount, lastAffectedDocumentId };
};

export const rollbackAggregationAndUpdate = async (
  collection,
  operationId,
  lastAffectedDocumentId,
  affectedDocumentsCount,
  batchSize,
  batchNo,
  session
) => {
  const client = global.client;
  const docs = await client.read(
    'AFFECTED_DOCUMENTS',
    { operation_id: operationId },
    session,
    lastAffectedDocumentId,
    batchSize,
    batchNo
  );

  let affectedDocuments = docs.map((doc) => doc.document);
  affectedDocumentsCount += affectedDocuments.length;

  lastAffectedDocumentId = await getLastAffectedDocumentId(lastAffectedDocumentId, collection, session);

  const bulkOps = affectedDocuments.map((doc) => ({
    replaceOne: {
      filter: { _id: doc._id },
      replacement: doc,
      upsert: true,
    },
  }));

  const idsToDeleteFromAFFECTED_DOCUMENTS = docs.map((doc) => doc._id);

  if (bulkOps.length) {
    await client.db.collection(collection).bulkWrite(bulkOps, { session });
  }
  await client.bulkDelete('AFFECTED_DOCUMENTS', { _id: { $in: idsToDeleteFromAFFECTED_DOCUMENTS } }, session);

  return { affectedDocumentsCount, lastAffectedDocumentId };
};

export const deleteDocumentsMigration = async (
  collection,
  filter,
  affectedDocuments,
  lastAffectedDocumentId,
  affectedDocumentsCount,
  batchSize,
  batchNo,
  session
) => {
  const client = global.client;
  affectedDocuments = await client.read(collection, filter, session, lastAffectedDocumentId, batchSize, batchNo);
  const idsToDelete = affectedDocuments.map((doc) => doc._id);
  lastAffectedDocumentId = await getLastAffectedDocumentId(lastAffectedDocumentId, collection, session);

  await client.bulkDelete(collection, { _id: { $in: idsToDelete } }, session);
  affectedDocumentsCount += affectedDocuments.length;

  return { affectedDocumentsCount, lastAffectedDocumentId, affectedDocuments };
};

export const deleteDocumentsRollback = async (
  collection,
  migratedOperationId,
  lastAffectedDocumentId,
  affectedDocumentsCount,
  batchSize,
  batchNo,
  session
) => {
  let idsTofind = await client.read(
    'AFFECTED_DOCUMENTS',
    { operation_id: migratedOperationId },
    session,
    lastAffectedDocumentId,
    batchSize,
    batchNo
  );

  let ids = idsTofind.map((doc) => doc.documentId);
  let idsToDeleteFromAFFECTED_DOCUMENTS = idsTofind.map((doc) => doc._id);
  lastAffectedDocumentId = await getLastAffectedDocumentId(lastAffectedDocumentId, collection, session);
  filter = { _id: { $in: ids } };

  await client.bulkDelete(collection, { _id: { $in: idsToDelete } }, session);

  await client.bulkDelete('HISTORYLOGS', { _id: { $in: idsToDeleteFromAFFECTED_DOCUMENTS } }, session);

  if (ids && ids.lenght) {
    affectedDocumentsCount += ids.length;
  }
  return { affectedDocumentsCount, lastAffectedDocumentId };
};
