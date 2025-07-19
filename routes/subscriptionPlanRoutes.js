const express = require("express");
const router = express.Router();
const subscriptionPlanController = require("../controllers/subscriptionPlanController");

router.get("/", subscriptionPlanController.getPlans);
router.post("/", subscriptionPlanController.createPlan);

module.exports = router;
