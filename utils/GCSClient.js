require("dotenv").config();
const { Storage } = require("@google-cloud/storage");
const dotenv = require("dotenv");
// Create a new Google Cloud Storage client
const storage = new Storage({
  projectId: 'sublime-night-474607-f8', // same as your GCP project ID
  keyFilename: '../gcs-key.json', // path to your service account key JSON file
});

const bucket = storage.bucket('gsbpathy-media');

// Export the bucket instance
module.exports = bucket;
