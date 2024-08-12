import { CustomError, handleCustomError } from '../utils/errorHandler.js';
import { handleAffectedDocsAndLogsInsertion } from './helperFunctions.js';
import { collectionNameAndNewNameChecker } from './helperFunctions/collectionHelper.js';

export const modifyCollection = async (value) => {
  const { collectionDetails, name, newName, id, actionSet, actionSetType, hashCheck, operation, rollback } = value;
  console.log(`Modify collection ${name} operation started successfully`);

  const client = global.client;
  let originalName;
  if (rollback) {
    ({ originalName, newName } = collectionDetails);
    let original = originalName;
    originalName = newName;
    newName = original;
  } else {
    originalName = name;
  }
  try {
    if (!newName || typeof newName !== 'string') {
      throw new CustomError('Invalid new collection name', "Ensure 'newName' is a non-empty string.");
    }

    await collectionNameAndNewNameChecker(originalName, newName);

    // Rename the collection
    await client.renameCollection(originalName, newName);

    // Prepare the document for history log
    const document = {
      actionSet,
      actionSetType,
      collectionDetails: {
        originalName,
        newName,
      },
      operation,
      operationId: id,
      collection: originalName,
      hashCheck,
      createdAt: new Date(),
    };

    try {
      await handleAffectedDocsAndLogsInsertion(value, () => document, session);
      console.log(`Modify collection name ${name} operation completed successfully`);
    } catch (insertError) {
      // If inserting history log fails, attempt to roll back the collection rename
      try {
        await client.checkCollection(originalName);

        await collectionNameAndNewNameChecker(client, name, newName);

        await client.renameCollection(newName, originalName);
        throw new CustomError(
          'Failed to insert history log',
          'The collection rename has been rolled back due to failure in inserting history log.'
        );
      } catch (rollbackError) {
        console.error('Critical failure: unable to roll back collection rename', rollbackError);
        throw new CustomError(
          'Critical failure',
          'Failed to insert history log and roll back collection rename. Manual intervention required.'
        );
      }
    }
  } catch (err) {
    handleCustomError(err);
  }
};

export const createCollection = async (value) => {
  const { collection, validator, id, actionSet, actionSetType, hashCheck, operation } = value;

  console.log(`Create collection ${collection} operation started successfully...`);

  let sessionStarted = false;
  const client = global.client;
  const session = client.client.startSession();

  try {
    if (!collection || typeof collection !== 'string' || collection.trim() === '') {
      throw new CustomError('Invalid collection name', "Ensure 'collection' is a non-empty string.");
    }

    const existingCollection = await client.listCollections(collection, session);
    if (existingCollection.length > 0) {
      throw new CustomError('Collection already exists', 'The collection already exists in the database.');
    }

    session.startTransaction();
    sessionStarted = true;

    await client.createCollection(collection, validator, session);

    const document = {
      actionSet,
      actionSetType,
      collection,
      operationId: id,
      hashCheck,
      createdAt: new Date(),
      operation,
    };
    console.log(document);
    await handleAffectedDocsAndLogsInsertion(value, () => document, session);
    await session.commitTransaction();
    console.log(`Create collection ${collection} operation completed successfully`);
  } catch (err) {
    if (sessionStarted) {
      await session.abortTransaction();
    }
    handleCustomError(err);
  } finally {
    session.endSession();
  }
};

export const dropCollection = async (value) => {
  console.log(`Drop collection ${collection} operation started successfully...`);

  const { collection, id, actionSet, actionSetType, hashCheck, operation } = value;
  const client = global.client;
  const session = client.client.startSession();

  try {
    if (!collection || typeof collection !== 'string' || collection.trim() === '') {
      throw new CustomError('Invalid collection name', "Ensure 'collection' is a non-empty string.");
    }

    // Check if the collection exists
    await client.checkCollection(collection, session);
    const prefix = new Date().getTime().toString(36) + Math.random().toString(36).slice(2);
    const newName = `${collection}__deleted__${prefix}`;

    await client.renameCollection(collection, newName);

    const document = {
      actionSet,
      actionSetType,
      collectionDetails: {
        originalName: collection,
        newName: newName,
      },
      collection: newName,
      operationId: id,
      hashCheck,
      createdAt: new Date(),
      operation,
    };

    try {
      await handleAffectedDocsAndLogsInsertion(value, () => document);
      console.log(`Drop collection ${collection} operation completed successfully`);
    } catch (insertError) {
      // If inserting history log fails, attempt to roll back the collection rename
      try {
        await client.renameCollection(newName, collection);
        throw new CustomError(
          'Failed to insert history log',
          'The collection rename has been rolled back due to failure in inserting history log.'
        );
      } catch (rollbackError) {
        console.error('Critical failure: unable to roll back collection rename', rollbackError);
        throw new CustomError(
          'Critical failure',
          'Failed to insert history log and roll back collection rename. Manual intervention required.'
        );
      }
    }
  } catch (err) {
    handleCustomError(err);
  }
};
