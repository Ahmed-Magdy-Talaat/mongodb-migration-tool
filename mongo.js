const pipeline = [
  {
    $match: { id: { $ne: 'a27eb3a1-d712-4955-abae-558946797da4' } },
  },
  {
    $lookup: {
      from: 'content-type',
      localField: 'contentTypeId',
      foreignField: 'id',
      as: 'contentTypeDetails',
    },
  },
  {
    $unwind:"$contentTypeDetails"
  },{
    
  }
];
