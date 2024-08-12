export const validationRules = {
  $jsonSchema: {
    bsonType: "object",
    required: ["operation", "collection"], // Only require these fields
    additionalProperties: true,
    properties: {
      collection: { bsonType: "string" },
      operation: { bsonType: "string" },
      field: {
        // Optional field
        bsonType: "object",
        additionalProperties: true,
      },
      collectionDetails: {
        // Optional field
        bsonType: "object",
        properties: {
          originalName: { bsonType: "string" },
          newName: { bsonType: "string" },
        },
      },
      createdAt: { bsonType: "date" }, // Optional field
      affected_documents: {
        // Optional field
        bsonType: "array",
        items: {
          bsonType: "object",
          additionalProperties: true, // Allows arbitrary properties in objects
        },
      },
      filter: { bsonType: "object", additionalProperties: true }, // Optional field
      update: { bsonType: "object", additionalProperties: true }, // Optional field
    },
  },
};

