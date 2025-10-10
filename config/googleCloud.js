const { Storage } = require('@google-cloud/storage');
const { GOOGLE_CLOUD_BUCKET_NAME } = require('../constant');

// Creates a client from a Google service account key
const storage = new Storage({
  projectId: process.env.PROJECT_ID,
  keyFilename: null,
  credentials: {
    client_email: process.env.CLIENT_EMAIL,
    private_key: process.env.PRIVATE_KEY,
  }
});

// // The ID of your GCS bucket
// const bucketName = GOOGLE_CLOUD_BUCKET_NAME;

// async function createBucket() {
//   // Creates the new bucket
//   await storage.createBucket(bucketName);
//   console.log(`Bucket ${bucketName} created.`);
// }

// createBucket().catch(console.error);


module.exports = storage;