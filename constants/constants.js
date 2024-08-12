import { createCollection, dropCollection, modifyCollection } from '../functionalities/collectionFunctions.js';
import { addField, deleteField, cloneField, renameField } from '../functionalities/fieldFunctions.js';
import {
  insertDocuments,
  deleteDocuments,
  updateDocuments,
  createAggregationPipeline,
} from '../functionalities/documentFunctions.js';
export const upMap = {
  createcollection: createCollection,
  dropcollection: dropCollection,
  addfield: addField,
  renamefield: renameField,
  deletefield: deleteField,
  clonefield: cloneField,
  insertdocuments: insertDocuments,
  deletedocuments: deleteDocuments,
  updatedocuments: updateDocuments,
  createaggregationpipeline: createAggregationPipeline,
};

export const downMap = {
  createcollection: dropCollection,
  dropcollection: modifyCollection,
  addfield: deleteField,
  renamefield: renameField,
  deletefield: addField,
  clonefield: deleteField,
  insertdocuments: deleteDocuments,
  deletedocuments: insertDocuments,
  updatedocuments: updateDocuments,
  createaggregationpipeline: createAggregationPipeline,
};

export const downOperationNameMap = {
  createcollection: 'dropcollection',
  dropcollection: 'modifycollection',
  addfield: 'deletefield',
  renamefield: 'renamefield',
  deletefield: 'addfield',
  clonefield: 'deletefield',
  insertdocuments: 'deletedocuments',
  deletedocuments: 'insertdocuments',
  updatedocuments: 'updatedocuments',
  createaggregationpipeline: 'createaggregationpipeline',
};
