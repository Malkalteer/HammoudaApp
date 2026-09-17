const mongoose = require("mongoose");

const FinanceDaySchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, unique: true },
    hasStocktake: { type: Boolean, default: false },
    previousBalance: { type: Number, default: 0 },
    currentInvoiceTotal: { type: Number, default: 0 },
    dailyPaid: { type: Number, default: 0 },
    cashOut: { type: Number, default: 0 },
    cashOuts: [
      {
        amount: { type: Number, required: true },
        reason: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    closedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FinanceDay", FinanceDaySchema);
