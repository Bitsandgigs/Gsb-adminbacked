require("dotenv").config();
const { Storage } = require("@google-cloud/storage");
const dotenv = require("dotenv");
// Create a new Google Cloud Storage client
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID, // same as your GCP project ID
  keyFilename: process.env.GCP_KEY_FILE_PATH, // path to your service account key JSON file
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Export the bucket instance
module.exports = bucket;
