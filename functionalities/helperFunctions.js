import { CustomError, handleCustomError } from '../utils/errorHandler.js';

export const parseInput = (input) => (input && typeof input === 'string' ? JSON.parse(input) : input);

export const prepareFilter = (filter, documents) => {
  try {
    if (documents) {
      const documentIds = documents.filter((doc) => doc._id !== undefined).map((doc) => doc._id);

      if (documentIds.length !== documents.length) {
        throw new CustomError('Invalid documents array', 'Each document should include the document ID (_id).');
      }
      return documentIds.length ? { _id: { $in: documentIds } } : null;
    }

    let flag = true;
    if (typeof filter !== 'string') {
      flag = false;
    }
    return flag ? JSON.parse(filter) : filter || {};
  } catch (err) {
    throw new CustomError(err);
  }
};

export const validateCollection = async (collection) => {
  if (!collection || typeof collection !== 'string') {
    throw new CustomError('Invalid collection name', "Ensure 'collection' is a non-empty string.");
  }
};

export const validateDocumentsArray = (documents) => {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new CustomError('Invalid documents array', "Ensure 'documents' is a non-empty array.");
  }
};

export const insertAffectedDocs = async (docs, body, session) => {
  const { actionSet, actionSetType, id, operation, collection, operation_id } = body;
  let records = [];
  const client = global.client;
  try {
    for (let doc of docs) {
      const log = {
        actionSet,
        actionSetType,
        operationId: id,
        operation_id,
        operation,
        collection,
        createdAt: new Date(),
        document: doc,
        documentId: doc._id,
      };
      records.push(log);
    }
    if (records.length) {
      await client.bulkInsert('AFFECTED_DOCUMENTS', records, session);
    }
  } catch (err) {
    throw new CustomError(err);
  }
};
export const wait = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const handleAffectedDocsAndLogsInsertion = async (body, createLog, session, batchNo) => {
  const client = global.client;
  let log = await createLog(body);
  // return;
  const { affectedDocuments, rollback, batchTotalCount } = body;
  let operationId;

  if (batchNo === 1) {
    operationId = await client.insertOne('HISTORYLOGS', log, session);
    body.operation_id = operationId;
  } else {
    await client.updateOne('HISTORYLOGS', { _id: body.operation_id }, log, session);
  }
  if (batchNo === batchTotalCount) {
    if (rollback) {
      const migrateDoc = await client.db
        .collection('HISTORYLOGS')
        .find({ actionSetType: 'migrate', hasRolledBack: { $exists: false } }, { sort: { _id: -1 } })
        .limit(1)
        .toArray();
      if (migrateDoc && migrateDoc.length) {
        await client.updateOne('HISTORYLOGS', { _id: migrateDoc[0]._id }, { hasRolledBack: 1 }, session);
      }
    }
  }
  if (affectedDocuments && affectedDocuments.length > 0 && !rollback) {
    await insertAffectedDocs(affectedDocuments, body, session);
  }
  if (rollback) {
    await deleteAffectedDocumentsForRolledBackOperations(session);
  }
};

export const deleteAffectedDocumentsForRolledBackOperations = async (session) => {
  const client = global.client;
  let rolledBackOperation = await client.db
    .collection('HISTORYLOGS')
    .find({ hasRolledBack: 1 })
    .sort({ id: -1 })
    .limit(1);

  let rolledBackOperationId;
  if (rolledBackOperation) {
    rolledBackOperationId = rolledBackOperation._id;
  }
  let lastAffectedDocumentId = undefined;
  let batchNo = 0;
  let affectedDocuments = [];
  if (rolledBackOperationId) {
    do {
      const docs = await client.read(
        'AFFECTED_DOCUMENTS',
        { operation_id: rolledBackOperationId },
        session,
        lastAffectedDocumentId,
        1000,
        batchNo
      );

      const idsToDelete = affectedDocuments.map((doc) => doc._id);
      lastAffectedDocumentId = idsToDelete[idsToDelete.length - 1];

      await client.bulkDelete(collection, { _id: { $in: idsToDelete } }, session);
      batchNo++;
    } while (docsToBeDeleted && docsToBeDeleted.length);
  }
};

export const mergeObject = (originalObject, updatedObject) => {
  for (const [key, value] of Object.entries(updatedObject)) {
    originalObject[key] = value;
  }
  return originalObject;
};

export const getBatchTotalCountAndDocsCountToBody = async (doc) => {
  const { batchSize, operation } = doc;
  let docsCount = await getDocsCount(doc);

  doc.docsCount = docsCount;
  let remainder = docsCount % batchSize;
  let batchTotalCount = Math.round(docsCount / batchSize);

  if (remainder) {
    batchTotalCount += 1;
  }
  doc.batchTotalCount = batchTotalCount;

  if (docsCount === 0) {
    console.log(`No documents found for rollback of operation ${operation}`);
  }
  return doc;
};

export const getDocsCount = async (body) => {
  const { filter, rollback, documents, collection } = body;
  const client = global.client;
  let docsCount = 0;

  if (documents && documents.length) {
    docsCount = documents.length;
  } else {
    if (rollback) {
      docsCount = await client.db
        .collection('AFFECTED_DOCUMENTS')
        .countDocuments({ operation_id: body._id }, { hint: '_id_' });
    } else {
      docsCount = await client.db.collection(collection).countDocuments(filter, { hint: '_id_' });
    }
  }
  return docsCount;
};

export const getLastAffectedDocumentID = async (lastAffectedDocumentId, collection, session) => {
  const client = global.client;
  // console.log(session, lastAffectedDocumentId, collection);
  let lastDoc = null;
  try {
    const query = lastAffectedDocumentId ? { _id: { $gt: lastAffectedDocumentId } } : {};
    console.log('heheheh', collection);
    // Use `find` and convert the cursor to an array
    let docs = undefined;
    docs = await client.db.collection(collection).find(query, { session }).limit(1000).toArray();
    // Get the last document from the result
    lastDoc = docs && docs.length > 0 ? docs[docs.length - 1] : null;
    return lastDoc ? lastDoc._id : null;
  } catch (error) {
    console.error('Error retrieving last affected document ID:', error, error.stack, error.message);
    return null;
  }
};
