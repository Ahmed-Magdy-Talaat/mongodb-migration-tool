import { CustomError, handleCustomError } from '../utils/errorHandler.js';
import { checkForRenameField, performFieldOperation } from './helperFunctions/fieldHelper.js';

export const addField = async (body) => {
  const client = global.client;

  try {
    let { name, value, rollback, collection, update, field } = body;
    if ((!name || typeof name !== 'string' || name.trim() === '') && !rollback) {
      throw new CustomError('Invalid field name', "Ensure 'name' is a non-empty string.");
    }

    await client.checkCollection(collection);

    const isFieldExists = await client.read(collection, {
      [name]: { $exists: true },
    });
    if (isFieldExists.length) {
      throw new CustomError('Field already exists', `The field '${name}' already exists in the collection.`);
    }
    if (!rollback) {
      field = {};
      field.name = name;
      field.value = value;
      update = { $set: { [name]: value } };
    } else {
      body.name = field.name;
    }
    body.update = update;
    body.field = field;
    body.printedMessage = `Add field ${name} to collection ${collection}`;
    await performFieldOperation(body);
  } catch (err) {
    handleCustomError(err);
  }
};

export const deleteField = async (body) => {
  const client = global.client;
  body.steps = 0;
  try {
    let { name, field, update, filter, collection } = body;

    if (!name && field) {
      name = field.name;
    }

    body.field = { name };

    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new CustomError('Invalid field name', "Ensure 'name' is a non-empty string.");
    }
    if (!collection || typeof collection !== 'string') {
      throw new CustomError('Invalid collection name', "Ensure 'collection' is a non-empty string.");
    }

    const fieldFound = await client.db.collection(collection).findOne({ [name]: { $exists: true } });
    if (!fieldFound) {
      throw new CustomError(`Field '${name}' does not exist in the collection`, 'Check the field name and try again.');
    }

    if (name) {
      update = { $unset: { [name]: '' } };
    }
    // console.log(update, filter, collection);
    body.update = update;

    await performFieldOperation(body);
  } catch (err) {
    handleCustomError(err);
  }
};

export const renameField = async (body) => {
  const client = global.client;

  let { collection, name, update, field, batchNo, newName, rollback } = body;

  if (!newName) {
    newName = field.name;
    name = field.oldName;
  }

  await checkForRenameField(collection, name, newName);

  try {
    if (!rollback) {
      const fieldFound = await client.db.collection(collection).findOne({ [name]: { $exists: true } });
      if (!fieldFound) {
        throw new CustomError(
          `Field '${name}' does not exist in the collection`,
          'Check the field name and try again.'
        );
      }

      field = { name: newName, oldName: name };
      body.field = field;
    }

    update['$rename'] = { [name]: newName };

    body.update = update;

    await performFieldOperation(body);
  } catch (err) {
    handleCustomError(err);
  }
};

export const cloneField = async (body) => {
  const client = global.client;
  try {
    let { name, clonedField, filter, update, collection } = body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new CustomError('Invalid field name', "Ensure 'name' is a non-empty string.");
    }
    if (!clonedField || typeof clonedField !== 'string' || clonedField.trim() === '') {
      throw new CustomError('Invalid cloned field name', "Ensure 'clonedField' is a non-empty string.");
    }

    await client.checkCollection(collection);

    const fieldFound = await client.db.collection(collection).findOne({ [clonedField]: { $exists: true } });
    if (!fieldFound) {
      throw new CustomError(
        `Field '${clonedField}' does not exist in the collection`,
        'Check the field name and try again.'
      );
    }

    if (!filter) filter = {};
    let field = { name, clonedField };
    if (update != {}) {
      update = [{ $set: { [name]: `$${clonedField}` } }];
    }
    body.field = field;
    body.update = update;
    body.printedMessage = `Clone field ${clonedField} into field ${name} in the collection ${collection} `;
    await performFieldOperation(body);
  } catch (err) {
    handleCustomError(err);
  }
};
