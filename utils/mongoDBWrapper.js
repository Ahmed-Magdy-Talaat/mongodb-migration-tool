import { MongoClient, ObjectId } from 'mongodb';
import parseProperties from './parseProperties.js';
import { CustomError } from './errorHandler.js';
import { validateCollection } from '../functionalities/helperFunctions.js';

class MongoDBWrapper {
  constructor() {
    const { dbUrl, dbName } = parseProperties();
    this.client = new MongoClient(dbUrl, {});
    this.dbName = dbName;
    this.db = this.client.db(this.dbName);
    this.isShuttingDown = false;
    this.connectionPromise = null;
    this.addSignalHandlers();
  }

  async connect() {
    if (!this.client.topology || !this.client.topology.isConnected()) {
      try {
        this.connectionPromise = this.client.connect();
        await this.connectionPromise;
        this.db = this.client.db(this.dbName);
        console.log('Connected to MongoDB');
      } catch (err) {
        console.error('Failed to connect to MongoDB:', err.message);
        setTimeout(() => this.connect(), 1000);
      }
    }
  }

  async disconnect() {
    if (this.client && this.client.topology && this.client.topology.isConnected()) {
      await this.client.close();
      console.log('Disconnected from MongoDB');
    } else {
      console.warn('Cannot close MongoClient: not connected');
    }
  }
  addSignalHandlers() {
    const handleSignal = async (signal) => {
      if (this.isShuttingDown) return; // Prevent multiple shutdown attempts
      this.isShuttingDown = true;
      console.log(`Received ${signal}. Closing MongoDB connection...`);

      // Wait for ongoing operations to complete
      try {
        await this.disconnect();
      } catch (err) {
        console.error(`Error during disconnect: ${err.message}`);
      }
    };

    process.on('SIGINT', handleSignal); // Ctrl+C
    process.on('SIGTERM', handleSignal); // Termination signal
    process.on('SIGTSTP', handleSignal); // Ctrl+Z
  }
  modifyQueryWithLastId(query, lastDocumentId, batchNo) {
    lastDocumentId = new ObjectId(lastDocumentId);
    let filter = { ...query };
    if (batchNo > 1 && lastDocumentId) {
      filter = { _id: { $gte: lastDocumentId }, ...query };
    }
    return filter;
  }
  async insertOne(collection, document, session) {
    try {
      validateCollection(collection);
      if (!document || typeof document !== 'object') {
        throw new CustomError('Invalid document', 'Document must be a valid object.');
      }
      const result = await this.db.collection(collection).insertOne(document, { session });
      return result.insertedId;
    } catch (err) {
      throw new Error(`Error inserting document: ${err.message}`);
    }
  }

  async read(collection, query = {}, session, lastDocumentId, processingBatchSize = 1000, processingBatchNo = 1) {
    try {
      validateCollection(collection);

      if (typeof query !== 'object') {
        throw new CustomError('Invalid query', 'Query must be a valid object.');
      }

      lastDocumentId = new ObjectId(lastDocumentId);
      let cursor;
      let filter = this.modifyQueryWithLastId(query, lastDocumentId, processingBatchNo);
      cursor = this.db.collection(collection).find(filter, { session }).limit(processingBatchSize);

      const result = await cursor.toArray();
      // console.log(result, filter);
      return result;
    } catch (err) {
      throw new Error(`Error reading: ${err.message}`);
    }
  }

  async aggregate(collection, pipeline, batchNo, lastDocumentId, session) {
    try {
      validateCollection(collection);
      if (!Array.isArray(pipeline) || pipeline.length === 0) {
        throw new CustomError('Invalid pipeline', 'Pipeline must be a non-empty array of stages.');
      }

      if (batchNo === 2) {
        pipeline.unshift({ $match: { _id: { $gt: lastDocumentId } } });
      } else if (batchNo > 2) {
        pipeline[0] = { $match: { _id: { $gt: lastDocumentId } } };
      }

      const cursor = this.db.collection(collection).aggregate(pipeline, { session });
      const result = await cursor.toArray();

      return result;
    } catch (err) {
      throw new CustomError(`Error aggregating documents: ${err.message}`);
    }
  }

  async bulkUpdate(collection, query, update, session) {
    try {
      validateCollection(collection);
      if (typeof query !== 'object' || query === null) {
        throw new CustomError('Invalid query', 'Query must be a valid object.');
      }
      if (typeof update !== 'object' || update === null) {
        throw new CustomError('Invalid update', 'Update must be a valid object.');
      }

      if (!query || !update) {
        throw new CustomError('Invalid query or update', "Both 'query' and 'update' should be provided.");
      }

      const result = await this.db.collection(collection).updateMany(query, update, { session });

      return result ? result.modifiedCount : 0;
    } catch (err) {
      throw new CustomError(`Error updating documents: ${err.message} ${err.stack} ${err.hint}`);
    }
  }

  async updateOne(collection, query, update, session, options) {
    try {
      validateCollection(collection);
      if (typeof query !== 'object') {
        throw new CustomError('Invalid query', 'Query must be a valid object.');
      }
      if (typeof update !== 'object') {
        throw new CustomError('Invalid update', 'Update operation must be a valid object.');
      }
      const result = await this.db.collection(collection).updateOne(query, { $set: update }, { session });
      return result.modifiedCount;
    } catch (err) {
      throw new CustomError(`Error updating document: ${err.message}`);
    }
  }

  async updateDirect(collection, docs, session) {
    try {
      validateCollection(collection);
      if (!Array.isArray(docs) || docs.some((doc) => typeof doc !== 'object') || docs.length === 0) {
        throw new CustomError('Invalid documents', 'Documents must be an array of valid objects.');
      }
      let validDocs = docs.map((doc) => {
        if (typeof doc._id === 'string') {
          doc._id = new ObjectId(doc._id);
        }
        return doc;
      });

      const operations = validDocs.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: doc },
          upsert: false,
        },
      }));
      let result;
      if (operations.length) {
        result = await this.db.collection(collection).bulkWrite(operations, { session, ordered: false, upsert: false });
      }

      return result;
    } catch (err) {
      throw new CustomError(`Error updating documents: ${err.message}`);
    }
  }

  async deleteOne(collection, query, session) {
    try {
      validateCollection(collection);
      if (typeof query !== 'object') {
        throw new CustomError('Invalid query', 'Query must be a valid object.');
      }
      const result = await this.db.collection(collection).deleteOne(query, { session });
      return result.deletedCount;
    } catch (err) {
      throw new CustomError(`Error deleting document: ${err.message}`);
    }
  }

  async bulkInsert(collection, documents, session) {
    try {
      validateCollection(collection);
      if (!Array.isArray(documents) || documents.some((doc) => typeof doc !== 'object' || !documents.length)) {
        throw new CustomError('Invalid documents', 'Documents must be a non empty array of valid objects.');
      }
      const result = await this.db.collection(collection).insertMany(documents, { session });
      const insertedDocuments = Object.values(result.insertedIds).map((id) => ({
        _id: id,
      }));
      return insertedDocuments;
    } catch (err) {
      throw new CustomError(`Error inserting documents into ${collection}: ${err.message}`);
    }
  }

  async bulkDelete(collection, query, session, processingBatchSize = 1000) {
    try {
      await validateCollection(collection);
      if (typeof query !== 'object') {
        throw new CustomError('Invalid query', 'Query must be a valid object.');
      }
      const cursor = this.db.collection(collection).find(query, { session }).limit(processingBatchSize);
      const docs = await cursor.toArray();
      let result = [];
      if (docs.length > 0) {
        let ids = docs.map((doc) => doc._id);
        result = await this.db.collection(collection).deleteMany({ _id: { $in: ids } }, { session });
      }
      return result.deletedCount;
    } catch (err) {
      throw new CustomError(`Error deleting documents: ${err.message}`);
    }
  }

  async checkCollection(collection) {
    try {
      validateCollection(collection);
      const collections = await this.listCollections(collection);
      if (collections.length === 0) {
        throw new CustomError('Collection not found', `Collection '${collection}' does not exist in the database.`);
      }
    } catch (err) {
      throw new CustomError(`Error checking collection: ${err.message}`);
    }
  }

  async listCollections(collection) {
    try {
      validateCollection(collection);
      if (collection) return await this.db.listCollections({ name: collection }).toArray();
      else return await this.db.listCollections({}).toArray();
    } catch (err) {
      throw new CustomError(`Error listing collections: ${err.message}`);
    }
  }

  async createCollection(collection, validator, session) {
    try {
      validateCollection(collection);
      await this.db.createCollection(collection, { validator, session });
    } catch (err) {
      throw new Error(`Error creating collection: ${err.message}`);
    }
  }

  async renameCollection(collection, newName, session) {
    try {
      validateCollection(collection);
      await this.db.collection(collection).rename(newName, { session });
    } catch (err) {
      throw new Error(`Error renaming collection: ${err.message}`);
    }
  }

  async removeAllCollections() {
    const client = new MongoDBWrapper();

    try {
      await client.connect();
      const session = client.client.startSession();
      const collections = await client.db.listCollections({}).toArray();
      for (let collection of collections) {
        await client.db.collection(collection.name).drop();
        console.log(`Dropped collection: ${collection.name}`);
      }
      console.log('All collections removed successfully.');
    } catch (err) {
      console.error(`Error removing collections: ${err.message}`);
    } finally {
      await client.disconnect();
    }
  }
  //   async function deleteAllDatabases(uri) {
  //   const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  //   try {
  //     // Connect to the MongoDB server
  //     await client.connect();
  //     console.log('Connected successfully to MongoDB server');

  //     // Get the admin database
  //     const adminDb = client.db().admin();

  //     // List all databases
  //     const dbList = await adminDb.listDatabases();

  //     for (const dbInfo of dbList.databases) {
  //       const dbName = dbInfo.name;

  //       // Skip system databases
  //       if (dbName === 'admin' || dbName === 'config' || dbName === 'local') {
  //         continue;
  //       }

  //       // Drop the database
  //       console.log(`Dropping database: ${dbName}`);
  //       await client.db(dbName).dropDatabase();
  //     }

  //     console.log('All databases dropped successfully.');
  //   } catch (err) {
  //     console.error('An error occurred while deleting databases:', err);
  //   } finally {
  //     // Close the connection
  //     await client.close();
  //     console.log('Connection to MongoDB server closed');
  //   }
  // }
}

export default MongoDBWrapper;
