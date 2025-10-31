const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const uploadImage = require("../middlewares/imageUploadMiddleware");
const uploadUserImage = require("../middlewares/userImageUploadMiddleware");

router.patch("/update-user/:id", uploadUserImage, userController.updateUser);
router.get("/:id/score", userController.getUserWithScore);
router.get("/all/scores", userController.getAllUsersWithScores);
router.delete("/delete-user/:id", userController.deleteUser);
router.post("/all/flag-count", userController.allGreenFlags);
router.put("/update-flag/:id", userController.changeFlag);
router.get("/:id", userController.getUserById);
router.post("/submit-age", authController.submitAge);
router.post("/submit-height-weight", authController.submitHeightWeight);

module.exports = router;
// const express = require("express");
// const router = express.Router();
// const userController = require("../controllers/userController");
// const uploadImage = require("../middlewares/imageUploadMiddleware");
// const uploadUserImage = require("../middlewares/userImageUploadMiddleware");

// router.post("/create-user", uploadUserImage, userController.createUser);
// router.put("/update-user/:id", uploadUserImage, userController.updateUser);

// // Get user with calculated score
// router.get("/:id/score", userController.getUserWithScore);

// // Get all users with scores
// router.get("/all/scores", userController.getAllUsersWithScores);
// router.delete("/delete-user/:id", userController.deleteUser);
// router.post("/all/flag-count", userController.allGreenFlags);
// router.put("/update-flag/:id", userController.changeFlag);
// router.get("/:id", userController.getUserById);

// module.exports = router;
