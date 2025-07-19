const SubscriptionPlan = require("../models/SubscriptionPlan");

exports.getPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ active: true }).select(
      "planType name amount currency description features subscriptionType"
    );
    res.status(200).json({ success: true, plans });
  } catch (error) {
    console.error("Get plans error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching plans",
        error: error.message,
      });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const {
      planType,
      name,
      amount,
      currency,
      description,
      features,
      subscriptionType,
    } = req.body;

    if (!planType || !name || !amount || !currency || !subscriptionType) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const existingPlan = await SubscriptionPlan.findOne({ planType });
    if (existingPlan) {
      return res
        .status(400)
        .json({ success: false, message: "Plan type already exists" });
    }

    const plan = new SubscriptionPlan({
      planType,
      name,
      amount: parseFloat(amount),
      currency,
      description,
      features,
      subscriptionType,
    });

    await plan.save();
    res
      .status(201)
      .json({ success: true, message: "Plan created successfully", plan });
  } catch (error) {
    console.error("Create plan error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error creating plan",
        error: error.message,
      });
  }
};
