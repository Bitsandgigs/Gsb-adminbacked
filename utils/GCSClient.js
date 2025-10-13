require("dotenv").config();
const { Storage } = require("@google-cloud/storage");
const path = require("path");
// Create a new Google Cloud Storage client
const storage = new Storage({
  projectId: 'sublime-night-474607-f8', // same as your GCP project ID
  keyFilename: path.join(__dirname, '../gcs-key.json'), // path to your service account key JSON file
});

console.log("GCS Client initialized with project ID:", storage.projectId);


const bucket = storage.bucket('gsbpathy-media');

// Export the bucket instance
module.exports = bucket;
