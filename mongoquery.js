// const organizationId = "a27eb3a1-d712-4955-abae-558946797da4";

let db;
const systemContentType = {
  commonContentType: [],
  FolderContentType: [],
  VersionContentType: [],
};
initSystemContentTypes();
function initSystemContentTypes() {
  systemContentType.commonContentType = [
    {
      title: 'id',
      type: 'textfield',
      field: 'content.SystemContentType.data.CommonContentType.data.id',
    },
    {
      title: 'Name',

      field: 'content.SystemContentType.data.CommonContentType.data.name',
      type: 'textfield',
    },
    {
      title: 'Type',
      field: 'content.SystemContentType.data.CommonContentType.data.type',
      type: 'textfield',
    },
    {
      title: 'Creation Date',
      field: 'content.SystemContentType.data.CommonContentType.data.creationDate',
      type: 'textfield',
    },
    {
      title: 'Created By',
      field: 'content.SystemContentType.data.CommonContentType.data.createdBy',
      type: 'textfield',
    },
    {
      title: 'Modification Date',
      field: 'content.SystemContentType.data.CommonContentType.data.modificationDate',
      type: 'textfield',
    },
    {
      title: 'Modified By',
      field: 'content.SystemContentType.data.CommonContentType.data.modifiedBy',
      type: 'textfield',
    },
    {
      title: 'Current Size',
      field: 'content.SystemContentType.data.CommonContentType.data.currentSize',
      type: 'number',
    },
    {
      title: 'Content Type Name',
      field: 'content.SystemContentType.data.CommonContentType.data.contentTypeName',
      type: 'textfield',
    },
    {
      title: 'Content Type GroupId',
      field: 'content.SystemContentType.data.CommonContentType.data.contentTypeGroupId',
      type: 'textfield',
    },
  ];
  systemContentType.FolderContentType = [
    {
      title: 'Efficiency',
      field: 'content.SystemContentType.data.FolderContentType.data.efficiency',
      type: 'textfield',
    },
    {
      title: 'isSystemFolder',
      field: 'content.SystemContentType.data.FolderContentType.data.isSystemFolder',
      type: 'textfield',
    },
  ];
  systemContentType.VersionContentType = [
    {
      title: 'Version Number',
      field: 'content.SystemContentType.data.VersionContentType.data.versionNumber',
      type: 'textfield',
    },
    {
      title: 'Current Rendition Size',
      field: 'content.SystemContentType.data.VersionContentType.data.currentRenditionSize',
      type: 'textfield',
    },
    {
      title: 'Current Versions Size',
      field: 'content.SystemContentType.data.VersionContentType.data.currentVersionsSize',
      type: 'textfield',
    },
    {
      title: 'Extention',
      field: 'content.SystemContentType.data.VersionContentType.data.extention',
      type: 'textfield',
    },
  ];
}
function addCommonContentType(New, old) {
  setDataInObjectPath(New, 'content.SystemContentType.data.CommonContentType.data.id', old.id);
  setDataInObjectPath(New, 'content.SystemContentType.data.CommonContentType.data.name', old.name.trim().split('.')[0]);
  setDataInObjectPath(New, 'content.SystemContentType.data.CommonContentType.data.type', old.type);
  setDataInObjectPath(New, 'content.SystemContentType.data.CommonContentType.data.creationDate', old.createdDate);
  setDataInObjectPath(New, 'content.SystemContentType.data.CommonContentType.data.createdBy', old.createdBy);
  setDataInObjectPath(New, 'content.SystemContentType.data.CommonContentType.data.modificationDate', old.modifiedDate);
  setDataInObjectPath(
    New,
    'content.SystemContentType.data.CommonContentType.data.modifiedBy',
    old.modifiedBy || old.createdBy
  );
  setDataInObjectPath(
    New,
    'content.SystemContentType.data.CommonContentType.data.currentSize',
    (old.type == 'file' ? old.currentNodeSize : old.currentVersionsSize) || 0
  );
  setDataInObjectPath(
    New,
    'content.SystemContentType.data.CommonContentType.data.createdByUserFullName',
    old?.userInfo?.fullName || old?.userInfo?.email || old.createdBy
  );
  setDataInObjectPath(
    New,
    'content.SystemContentType.data.CommonContentType.data.contentTypeName',
    old.contentTypeInfo?.title || 'Blank'
  );
  setDataInObjectPath(
    New,
    'content.SystemContentType.data.CommonContentType.data.contentTypeGroupId',
    old.contentTypeGroupId
  );
}
function addVersionContentType(New, old) {
  setDataInObjectPath(New, 'content.SystemContentType.data.VersionContentType.data.versionNumber', old.version);
  setDataInObjectPath(
    New,
    'content.SystemContentType.data.VersionContentType.data.currentRenditionSize',
    old.currentRenditionsSize || 0
  );
  setDataInObjectPath(
    New,
    'content.SystemContentType.data.VersionContentType.data.currentVersionsSize',
    old.currentVersionsSize
  );
  setDataInObjectPath(
    New,
    'content.SystemContentType.data.VersionContentType.data.extention',
    old.name.trim().split('.')[1]
  );
  setDataInObjectPath(New, 'content.SystemContentType.data.VersionContentType.data.pagesCount', old.pagesCount);
}
function addFolderContentType(New, old) {
  setDataInObjectPath(New, 'content.SystemContentType.data.FolderContentType.data.efficiency', old.efficiency);
  setDataInObjectPath(New, 'content.SystemContentType.data.FolderContentType.data.isSystemFolder', false);
}
module.exports.run = async function run(client, allDatabases) {
  try {
    console.log('%c------------------------- Start ----------------------------', 'color:green;');
    console.time('update organization content');
    for (let j = 0; j < allDatabases.length; j++) {
      const organizationId = allDatabases[j];
      console.log(`%c------------------------- Start ${organizationId}----------------------------`, 'color:yellow;');
      db = await client.db(organizationId);

      let insertRecords = 0;
      console.time('get-count');
      let count = await db.collection('organization-content').countDocuments({ id: { $ne: organizationId } });
      console.timeEnd('get-count');
      console.time(`${count} - element`);
      let i = 0;
      for (let i = 0; ; i++)
        try {
          console.time('get-document');
          const organizationContent = [];
          let res = await db
            .collection('organization-content')
            .find({ id: { $ne: organizationId } })
            .limit(1000)
            .skip(i * 1000)
            .toArray();
          console.timeEnd('get-document');
          if (res.length == 0) {
            break;
          }
          for (let ct of res) {
            const newCT = await convertToNewContent(db, ct);
            if (newCT)
              organizationContent.push({
                updateOne: {
                  filter: { _id: ct._id },
                  update: {
                    $set: {
                      content: newCT.content,
                      modificationDate: ct.modifiedDate,
                      creationDate: ct.createdDate,
                    },
                  },
                },
              });
          }
          if (organizationContent.length > 0) {
            console.time('bulk-update');
            let bulkRes = await db.collection('organization-content').bulkWrite(organizationContent);
            console.timeEnd('bulk-update');
            insertRecords += bulkRes.modifiedCount;
            console.log(`Updated: ${insertRecords} / ${count}`);
          }
        } catch (error) {
          error.i = i;
          throw error;
        }
      console.timeEnd(`${count} - element`);
      console.log(`%c------------------------- End ${organizationId}----------------------------`, 'color:yellow;');
    }
    console.log('%c------------------------- End All ----------------------------', 'color:green;');
    console.timeEnd('update organization content');
  } catch (error) {
    console.log(error);
  }
};
async function convertToNewContent(db, old) {
  try {
    const contentType = await getContentTypeComponents(db, old.contentTypeId);
    if (!contentType) return;
    const components = contentType.components || undefined;
    let New = { content: {} };

    if (components)
      for (let component of components) {
        const content = old.content.find((c) => c.key && c.key.replace(/-/g, '_') == component.field.split('.').pop());
        if (content?.type == 'singleSelectList') content.value = content?.value?.listValue || '';
        else if (content?.type == 'number') {
          content.value = +content?.value;
          if (isNaN(content.value)) content.value = null;
        }
        setDataInObjectPath(New, component.field, content?.value || getDefault(component.type));
      }
    addCommonContentType(New, old);
    if (contentType.appliedFor == 'VersionContentType') addVersionContentType(New, old);
    if (contentType.appliedFor == 'FolderContentType') addFolderContentType(New, old);
    old.content = New.content;
    return old;
  } catch (error) {
    console.error(error);
  }
}
function getDefault(type) {
  if (['text', 'textfield', 'select', 'textarea'].includes(type)) {
    return '';
  } else if (type == 'checkbox') {
    return false;
  } else return null;
}
function setDataInObjectPath(object, path, data) {
  const pathArr = path.split('.');
  let pointer = object;
  let key = pathArr.pop();
  for (let p of pathArr) {
    if (!pointer[p]) pointer[p] = {};
    pointer = pointer[p];
  }
  pointer[key] =
    data instanceof Date && pathArr.indexOf('SystemContentType') === -1
      ? new Date(data.toISOString().slice(0, 10))
      : data;
  return key;
}
let allContentType = [];

let getContentTypeComponents = async function (db, contentTypeId) {
  try {
    let findCt = allContentType.find((a) => a.id === contentTypeId);
    if (findCt) return findCt;

    let RowData = await db.collection('content-type').findOne({ id: contentTypeId });
    if (RowData) {
      let components = [];
      for (let component of RowData.components) {
        components = components.concat(await getFiledsOfcomponent(db, component, 'content'));
      }
      const contentType = {
        id: RowData.id,
        name: RowData.name,
        title: RowData.title,
        path: RowData.path,
        key: RowData.key,
        type: RowData.type,
        display: RowData.display,
        groupId: RowData.groupId,
        appliedFor: RowData.appliedFor,
        isSystemContentType: RowData.isSystemContentType,
        components: components,
      };
      if (contentType) allContentType.push(contentType);
      return contentType;
    } else {
      console.error(`Content type with id ${contentTypeId} not exists.`);
      return null;
    }
  } catch (error) {
    console.log(error);
  }
};

let getFiledsOfcomponent = async (db, component, key) => {
  let fields = [];
  const parentKey = key;
  key += '.' + component.key;
  switch (component.type) {
    case 'form':
      const contentType = await db.collection('content-type').findOne({ _id: component.form });
      if (contentType && contentType.components)
        for (let subcomponent of contentType.components)
          fields = fields.concat(await getFiledsOfcomponent(db, subcomponent, key + '.data'));
      break;
    case 'table':
      for (let row of component.rows)
        for (let column of row)
          for (let subcomponent of column.components)
            fields = fields.concat(await getFiledsOfcomponent(db, subcomponent, parentKey));
      break;
    case 'panel':
      for (let subcomponent of component.components)
        fields = fields.concat(await getFiledsOfcomponent(db, subcomponent, parentKey));
      break;
    default:
      if (component.label) {
        const res = {
          field: key,
          title: component.label,
          ...component,
        };
        delete res.key, res.label;
        return [res];
      }
  }
  return fields;
};


    {
      $project: {
        contentTypeId: 1,
        id: 1,
        name: 1,
        type: 1,
        createdDate: 1,
        createdBy: 1,
        modifiedDate: 1,
        modifiedBy: 1,
        currentNodeSize: 1,
        currentVersionsSize: 1,
        efficiency: 1,
        contentTypeGroupId: 1,
        contentTypeInfo: 1,
        version: 1,
        pagesCount: 1,
        userInfo: 1,
        content: 1
      }
    },
    {
        $addFields: {
          "content.SystemContentType.data.CommonContentType.data.id": "$id",
          "content.SystemContentType.data.CommonContentType.data.name": {
            $arrayElemAt: [
              { $split: ["$name", "."] },
              0
            ]
          },
          "content.SystemContentType.data.CommonContentType.data.type": "$type",
          "content.SystemContentType.data.CommonContentType.data.creationDate": "$createdDate",
          "content.SystemContentType.data.CommonContentType.data.createdBy": "$createdBy",
          "content.SystemContentType.data.CommonContentType.data.modificationDate": "$modifiedDate",
          "content.SystemContentType.data.CommonContentType.data.modifiedBy": { $ifNull: ["$modifiedBy", "$createdBy"] },
          "content.SystemContentType.data.CommonContentType.data.currentSize": {
            $ifNull: [
              { $cond: { if: { $eq: ["$type", "file"] }, then: "$currentNodeSize", else: "$currentVersionsSize" } },
              0
            ]
          },
          "content.SystemContentType.data.CommonContentType.data.createdByUserFullName": {
            $ifNull: ["$userInfo.fullName", { $ifNull: ["$userInfo.email", "$createdBy"] }]
          },
          "content.SystemContentType.data.CommonContentType.data.contentTypeName": {
            $ifNull: ["$contentTypeInfo.title", "Blank"]
          },
          "content.SystemContentType.data.CommonContentType.data.contentTypeGroupId": "$contentTypeGroupId",
          "content.SystemContentType.data.VersionContentType.data.versionNumber": "$version",
          "content.SystemContentType.data.VersionContentType.data.currentRenditionSize": { $ifNull: ["$currentRenditionsSize", 0] },
          "content.SystemContentType.data.VersionContentType.data.currentVersionsSize": "$currentVersionsSize",
          "content.SystemContentType.data.VersionContentType.data.extention": { $arrayElemAt: [{ $split: ["$name", "."] }, 1] },
          "content.SystemContentType.data.VersionContentType.data.pagesCount": "$pagesCount",
          "content.SystemContentType.data.FolderContentType.data.efficiency": "$efficiency",
          "content.SystemContentType.data.FolderContentType.data.isSystemFolder": false
        }
      },
      $addFields: {
        "content.SystemContentType.data.CommonContentType.data.id": "$id",
        "content.SystemContentType.data.CommonContentType.data.name": {
          "$cond": {
            "if": { "$gte": [{ "$indexOfCP": ["$name", "."] }, 0] },
            "then": { "$substrCP": ["$name", 0, { "$indexOfCP": ["$name", "."] }] },
            "else": "$name"
          }
        },
        "content.SystemContentType.data.CommonContentType.data.type": "$type",
        "content.SystemContentType.data.CommonContentType.data.creationDate": "$createdDate",
        "content.SystemContentType.data.CommonContentType.data.createdBy": "$createdBy",
        "content.SystemContentType.data.CommonContentType.data.modificationDate": "$modifiedDate",
        "content.SystemContentType.data.CommonContentType.data.modifiedBy": { "$ifNull": ["$modifiedBy", "$createdBy"] },
        "content.SystemContentType.data.CommonContentType.data.currentSize": {
          "$cond": {
            "if": { "$eq": ["$type", "file"] },
            "then": "$currentNodeSize",
            "else": "$currentVersionsSize"
          }
        },
        "content.SystemContentType.data.CommonContentType.data.createdByUserFullName": { "$ifNull": ["$userInfo.fullName", { "$ifNull": ["$userInfo.email", "$createdBy"] }] },
        "content.SystemContentType.data.CommonContentType.data.contentTypeName": { "$ifNull": ["$contentTypeInfo.title", "Blank"] },
        "content.SystemContentType.data.CommonContentType.data.contentTypeGroupId": "$contentTypeGroupId"
      }
    ,
    {
      $addFields: {
        "content.SystemContentType.data.VersionContentType.data.versionNumber": "$version",
        "content.SystemContentType.data.VersionContentType.data.currentRenditionSize": { "$ifNull": ["$currentRenditionsSize", 0] },
        "content.SystemContentType.data.VersionContentType.data.currentVersionsSize": "$currentVersionsSize",
        "content.SystemContentType.data.VersionContentType.data.extension": { "$arrayElemAt": [{ "$split": ["$name", "."] }, 1] },
        "content.SystemContentType.data.VersionContentType.data.pagesCount": "$pagesCount"
      }
    },
    {
      $addFields: {
        "content.SystemContentType.data.FolderContentType.data.efficiency": "$efficiency",
        "content.SystemContentType.data.FolderContentType.data.isSystemFolder": false
      }
    },
    {
      $limit: 5
    }