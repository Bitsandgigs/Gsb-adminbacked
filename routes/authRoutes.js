const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const uploadUserImage = require("../middlewares/userImageUploadMiddleware");

router.post("/admin/login", authController.loginAdmin);
router.post("/signup", uploadUserImage, authController.signUp);
router.post("/login", authController.loginUser);
router.post("/verify-otp", authController.verifyOTP);

module.exports = router;
// const express = require("express");
// const router = express.Router();
// const { loginAdmin } = require("../controllers/authController");
// const { addTeamMember } = require("../controllers/teamController");
// const authController = require("../controllers/authController");
// const userController = require("../controllers/userController");
// const uploadImage = require("../middlewares/imageUploadMiddleware");

// router.post("/login", loginAdmin);
// router.post("/admin/login", loginAdmin);
// // router.post('/add-member', addTeamMember);

router.post("/send-otp", authController.sendOTP);
// router.post("/verify-otp", authController.verifyOTP);
// router.post("/user/login", authController.loginUser);

// // User creation route with image upload
// router.post("/create-user", uploadImage, userController.createUser);

// module.exports = router;
