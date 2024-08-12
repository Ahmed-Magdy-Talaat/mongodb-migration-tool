import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';

const transformData = (ops) => {
  return Array.isArray(ops) ? ops : [ops]; // Ensure operations is always an array
};

const removeWhitespaceFromValues = (obj) => {
  const result = {};
  for (let [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = value.replace(/\s+/g, ' ').trim(); // Replaces multiple spaces with a single space and trims
    } else {
      result[key] = value;
    }
  }
  return result;
};

const parseXML = () => {
  const options = {
    ignoreAttributes: false, // Include attributes in JSON
    ignoreNameSpace: true, // Ignore namespaces
    parseAttributeValue: true, // Parse attribute values
    parseNodeValue: true, // Parse node values
    parseTrueNumberOnly: true, // Parse numbers only as numbers, not strings
    attributeNamePrefix: '', // Remove '@' from attribute names
  };

  const parser = new XMLParser(options);

  // Getting the changelog.xml file
  const __filename = new URL(import.meta.url).pathname;
  const __dirname = path.dirname(__filename);
  const filePath = path.resolve(__dirname, '../changelog1.xml');

  // parsing the xml file and preparing the object to be used in migration
  const data = fs.readFileSync(filePath, 'utf-8');
  const operations = parser.parse(data).migration;

  // Check if the XML file is not wrapped by the migration tag
  if (operations == undefined)
    throw new Error('Error in XML file wrap your xml config with <migration> your config </migration>');
  // console.log(operations);

  const operationsList = transformData(operations.operation);
  operationsList.map((op) => {
    for (const [key, value] of Object.entries(op)) {
      op[key].operation = key.toLocaleLowerCase();
      op[key] = removeWhitespaceFromValues(value);
    }
  });

  return operationsList;
};

parseXML();

export default parseXML;
