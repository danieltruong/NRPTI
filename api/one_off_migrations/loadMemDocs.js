'use strict';

const MongoClient = require("mongodb").MongoClient;
const ObjectID = require("mongodb").ObjectID;
const https = require('https');

const localUri = "mongodb://localhost:27017/nrpti-load-mem-docs";
const bcmiUrl = 'https://mines.empr.gov.bc.ca'; // prod mem-admin api url

async function main() {
  const localClient = await MongoClient.connect(localUri, { useNewUrlParser: true });
  const localDb = localClient.db('nrpti-load-mem-docs');
  const localDbConnection = localDb.collection('nrpti_load_mem_docs');

  // ------------------------------------------------------------
  // ------------------------------------------------------------
  // ------------------------------------------------------------

  // We need to check if we had a previous run of this script
  let localMineCount = 0;
  try {
    localMineCount = await localDbConnection.count();
  } catch (error) {
    console.log('Error getting local mine count: ', error);
  }

  // ------------------------------------------------------------
  // ------------------------------------------------------------
  // ------------------------------------------------------------

  // This can be determined if there are mines in our local DB
  if (localMineCount === 0) {
    // Get published mines from EMPR
    let publishedMines = [];
    try {
      publishedMines = await getMemMines();
    } catch (error) {
      console.log('Error getting published mines: ', error);
    }
    console.log('Located ' + publishedMines.length + ' mines. Fetching Collections and Docs for import to NRPTI...');

    // Store the mines locally
    try {
      await storeMinesToLocal(localDbConnection, publishedMines);
    } catch (error) {
      console.log('Error storing mines to local: ', error);
    }
  }

  // ------------------------------------------------------------
  // ------------------------------------------------------------
  // ------------------------------------------------------------

  // For each mine, store locally and get collection via mine code
  // Get mines from local DB
  let localMines = [];
  try {
    localMines = await getLocalMines(localDbConnection);
  } catch (error) {
    console.log('Error getting published mines: ', error);
  }

  // Iterate through mines to get all collections
  let i = 0, len = localMines.length;
  console.log('Getting collections from Mem');
  while (i < len) {
    let mine = localMines[i];
    if (!mine.collectionsSavedOnLocal) {
      let collections = [];
      // Get collections
      try {
        collections = await getMemCollections(mine);
      } catch (error) {
        console.log('Error getting collection for mine' + mine.code + ': ' + error);
      }

      let res = null;
      let collectionObjIds = [];
      try {
        // For each collection, store locally
        res = await storeCollectionsToLocal(localDbConnection, collections, mine._id);
        let collectionIds = Object.values(res.insertedIds);
        for (let j = 0; j < collectionIds.length; j++) {
          collectionObjIds.push(ObjectID(collectionIds[j]));
        }
      } catch (error) {
        console.log('Error saving collection for mine' + mine.code + ' to local: ' + error);
      }

      // Update mine's flag
      try {
        await localDbConnection.findOneAndUpdate(
          { _id: mine._id },
          {
            $set: {
              collectionsSavedOnLocal: true,
              collections: collectionObjIds
            }
          }
        );
      } catch (error) {
        console.log('Error updating local mine with collection ids: ', error);
      }
    }
    i++;
  }

  // At this point we should have everything loaded into local
  // Note: collections have their document meta already associated with them.

  // ------------------------------------------------------------
  // ------------------------------------------------------------
  // ------------------------------------------------------------

  // Get local collections
  let localCollections = [];
  try {
    localCollections = await getLocalCollecitons(localDbConnection);
  } catch (error) {
    console.log('Error with getting local collections ', error)
  }

  // Iterate through documents and prepare to upload documents
  let i = 0, len = localCollections.length;
  while (i < len) {
    let collection = localCollections[i];
    if (!collection.documentsSavedOnNrpti) {
      // Save documents first
      let j = 0, docLen = collection.documents.length;
      while (j < docLen) {

        j++;
      }
    }

    // Then we save the collection
    // We can assume all these collections have flag savedOnNrpti as false.
    // Get should have not returned savedOnNrpti true collections.

    // TODO: save collection to NRPTI
    i++;
  }


  await localClient.close();
}

main().catch(console.error);

async function getLocalCollecitons(localDbConnection) {
  console.log('Getting collections from local DB');
  // We only return local collections that have not been saved on NRPTI
  return await localDbConnection.find({
    _schemaName: 'Collection',
    savedOnNrpti: false
  }).toArray();
}

async function storeCollectionsToLocal(localDbConnection, collections, mineId) {
  let i = 0, len = collections.length;
  let collectionsToSaveLocally = [];
  while (i < len) {
    let collection = collections[i];
    collection['originalId'] = ObjectID(collection['id']);
    delete collection['id'];
    delete collection['_id'];

    // Set a flag in case if everything blows up and we need to run again.
    collection['savedOnNrpti'] = false;
    collection['documentsSavedOnNrpti'] = false;

    let allDocs = collection['mainDocuments'].concat(collection['otherDocuments']);
    allDocs.forEach(doc => {
      doc['uploadedToS3'] = false;
      doc['metaSavedOnNRPTI'] = false;
    });
    collection['documents'] = allDocs;

    collection['_mine'] = ObjectID(mineId);

    collectionsToSaveLocally.push(collection);
    i++;
  }

  try {
    return await localDbConnection.insertMany(collectionsToSaveLocally);
  } catch (error) {
    throw error;
  }
}

async function getMemCollections(mine) {
  console.log(`Loading ${mine.code} collections...`);
  return await getRequest(bcmiUrl + '/api/collections/project/' + mine.code);
}

async function getLocalMines(localDbConnection) {
  console.log('Getting mines from local DB');
  // We only return local mines that have not been saved on NRPTI
  return await localDbConnection.find({
    _schemaName: 'Mine',
    savedOnNrpti: false
  }).toArray();
}

async function storeMinesToLocal(localDbConnection, mines) {
  let i = 0, len = mines.length;
  let minesToSaveLocally = [];
  while (i < len) {
    let mine = mines[i];
    mine['originalId'] = ObjectID(mine['id']);
    delete mine['id'];
    delete mine['_id'];

    mine['_schemaName'] = 'Mine';

    // Set a flag in case if everything blows up and we need to run again.
    mine['savedOnNrpti'] = false;
    mine['collectionsSavedOnLocal'] = false;
    mine['collectionsSavedOnNrpti'] = false;

    minesToSaveLocally.push(mine);
    i++;
  }

  try {
    await localDbConnection.insertMany(minesToSaveLocally);
    return;
  } catch (error) {
    throw error;
  }
}

async function getMemMines() {
  console.log('Fetching all major mines in BCMI from Mem');
  return await getRequest(bcmiUrl + '/api/projects/published');
}

function getRequest(url, asJson = true) {
  return new Promise(function (resolve, reject) {
    let req = https.get(url, function (res) {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error('statusCode=' + res.statusCode));
      }
      let body = [];
      res.on('data', function (chunk) {
        body.push(chunk);
      });
      res.on('end', function () {
        try {
          body = Buffer.concat(body);
          // If request is expecting JSON response then convert the bugger to JSON.
          if (asJson) {
            body = JSON.parse(body.toString());
          }
        } catch (e) {
          reject(e);
        }
        resolve(body);
      });
    });

    req.on('error', function (err) {
      reject(err);
    });

    req.end();
  });
}
