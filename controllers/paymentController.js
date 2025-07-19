const Payment = require("../models/Payment");
const User = require("../models/User");

// Create a new payment record
exports.createPayment = async (req, res) => {
  try {
    const {
      userId,
      amount,
      paymentMethod,
      transactionId,
      subscriptionType,
      source,
      description,
    } = req.body;

    if (
      !userId ||
      !amount ||
      !paymentMethod ||
      !transactionId ||
      !subscriptionType
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: "Amount must be positive" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const payment = new Payment({
      user: userId,
      amount: parseFloat(amount),
      paymentMethod,
      transactionId,
      subscriptionType,
      source: source || "app",
      description,
      status: paymentMethod === "easebuzz" ? "pending" : "completed",
    });

    await payment.save();
    if (payment.status === "completed") {
      await User.findByIdAndUpdate(userId, { subscribed: true }, { new: true });
    }

    res.status(201).json({ message: "Payment recorded successfully", payment });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all payments with user details
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("user", "fullName phoneNumber")
      .sort({ createdAt: -1 });

    res.status(200).json({ payments });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get payment analytics
exports.getPaymentAnalytics = async (req, res) => {
  try {
    console.log("Payment analytics endpoint called");

    const totalPayments = await Payment.countDocuments({ status: "completed" });
    console.log("Total completed payments:", totalPayments);

    const totalRevenue = await Payment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    console.log("Total revenue aggregation:", totalRevenue);

    const appPayments = await Payment.countDocuments({
      source: "app",
      status: "completed",
    });
    const webPayments = await Payment.countDocuments({
      source: "web",
      status: "completed",
    });
    const manualPayments = await Payment.countDocuments({
      source: "manual",
      status: "completed",
    });

    const monthlySubscriptions = await Payment.countDocuments({
      subscriptionType: "monthly",
      status: "completed",
    });
    const yearlySubscriptions = await Payment.countDocuments({
      subscriptionType: "yearly",
      status: "completed",
    });
    const lifetimeSubscriptions = await Payment.countDocuments({
      subscriptionType: "lifetime",
      status: "completed",
    });

    // Payment type analytics (subscription vs product)
    const subscriptionPayments = await Payment.countDocuments({
      paymentType: "subscription",
      status: "completed",
    });
    const productPayments = await Payment.countDocuments({
      paymentType: "product",
      status: "completed",
    });

    console.log("Subscription payments count:", subscriptionPayments);
    console.log("Product payments count:", productPayments);

    // Revenue by payment type
    const revenueByPaymentType = await Payment.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$paymentType",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Revenue by source
    const revenueBySource = await Payment.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$source",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Monthly revenue trend
    const monthlyRevenue = await Payment.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: {
            year: { $year: "$paymentDate" },
            month: { $month: "$paymentDate" },
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]);

    res.status(200).json({
      analytics: {
        totalPayments,
        totalRevenue: totalRevenue[0]?.total || 0,
        paymentSources: {
          app: appPayments,
          web: webPayments,
          manual: manualPayments,
        },
        paymentTypes: {
          subscription: subscriptionPayments,
          product: productPayments,
        },
        subscriptionTypes: {
          monthly: monthlySubscriptions,
          yearly: yearlySubscriptions,
          lifetime: lifetimeSubscriptions,
        },
        revenueBySource,
        revenueByPaymentType,
        monthlyRevenue,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get payments by user
exports.getPaymentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const payments = await Payment.find({ user: userId }).sort({
      createdAt: -1,
    });

    res.status(200).json({ payments });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
