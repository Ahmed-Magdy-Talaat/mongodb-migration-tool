import { handleCustomError } from '../../utils/errorHandler.js';

export const collectionNameAndNewNameChecker = async (name, newName) => {
  const client = global.client;
  try {
    await client.checkCollection(name);
    //check for collection with newName
    const collectionsListed = await this.listCollections(newName);

    if (collectionsListed.length > 0) {
      throw new CustomError(
        'Collection already exists',
        `Collection '${newName}' already exists in the database can't rename with this name.`
      );
    }
  } catch (err) {
    handleCustomError(err);
  }
};

export const collectionLogs = (log) => {
  return log;
};
