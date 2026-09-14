const express = require("express");
const router = express.Router();
const { requireRole } = require("../middleware/auth");
const Subscriber = require("../models/Subscriber");
const Cycle = require("../models/Cycle");

router.get("/overdue", requireRole("admin", "accountant"), async (req, res) => {
  const items = await Subscriber.find({ balance: { $gt: 0 } }).sort({ balance: -1 });
  res.json(items);
});

router.get("/monthly", requireRole("admin", "accountant"), async (req, res) => {
  const data = await Cycle.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        totalInvoice: { $sum: "$invoiceAmount" },
        totalPaid: { $sum: "$paidAmount" },
        totalDue: { $sum: "$remainingBalance" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json(data);
});

module.exports = router;
