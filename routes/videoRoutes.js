// const express = require("express");
// const router = express.Router();
// const videoController = require("../controllers/videoController");
// const videoUpload = require("../middlewares/videouploadMiddleware"); // path to the above file

// // GET routes (no middleware needed)
// router.get("/", videoController.getAllVideos);
// router.get("/all-videos", videoController.getAllVideos);

// // POST routes (with upload middleware)
// router.post("/", videoUpload, videoController.uploadVideo);
// router.post("/upload", videoUpload, videoController.uploadVideo);

// // DELETE routes
// router.delete("/:id", videoController.deleteVideo);
// module.exports = router;
const express = require("express");
const router = express.Router();
const videoController = require("../controllers/videoController");
const videoUpload = require("../middlewares/videouploadMiddleware");

router.get("/", videoController.getAllVideos);
router.post("/", videoUpload, videoController.uploadVideo);
router.patch("/:id", videoUpload, videoController.updateVideo);
router.delete("/:id", videoController.deleteVideo);

module.exports = router;
