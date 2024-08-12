import MongoDBWrapper from "./utils/mongoDBWrapper.js";
let client = new MongoDBWrapper();
await client.removeAllCollections();

import { MongoClient } from "mongodb";

async function deleteAllDatabases(uri) {
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    // Connect to the MongoDB server
    await client.connect();
    console.log("Connected successfully to MongoDB server");

    // Get the admin database
    const adminDb = client.db().admin();

    // List all databases
    const dbList = await adminDb.listDatabases();

    for (const dbInfo of dbList.databases) {
      const dbName = dbInfo.name;

      // Skip system databases
      if (dbName === "admin" || dbName === "config" || dbName === "local") {
        continue;
      }

      // Drop the database

      console.log(`Dropping database: ${dbName}`);
      await client.db(dbName).dropDatabase();
    }

    console.log("All databases dropped successfully.");
  } catch (err) {
    console.error("An error occurred while deleting databases:", err);
  } finally {
    // Close the connection
    await client.close();
    console.log("Connection to MongoDB server closed");
  }
}

// Replace with your MongoDB connection string
const uri = "mongodb://localhost:27017";

deleteAllDatabases(uri);
