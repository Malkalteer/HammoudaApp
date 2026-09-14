require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const { authMiddleware } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const subscriberRoutes = require("./routes/subscribers");
const cycleRoutes = require("./routes/cycles");
const importRoutes = require("./routes/import");
const dashboardRoutes = require("./routes/dashboard");
const reportsRoutes = require("./routes/reports");
const smsRoutes = require("./routes/sms");
const settingsRoutes = require("./routes/settings");
const { router: financeRoutes } = require("./routes/finance");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/subscribers", authMiddleware, subscriberRoutes);
app.use("/api/cycles", authMiddleware, cycleRoutes);
app.use("/api/import", authMiddleware, importRoutes);
app.use("/api/dashboard", authMiddleware, dashboardRoutes);
app.use("/api/reports", authMiddleware, reportsRoutes);
app.use("/api/sms", authMiddleware, smsRoutes);
app.use("/api/settings", authMiddleware, settingsRoutes);
app.use("/api/finance", authMiddleware, financeRoutes);

app.get("/", (req, res) => res.send("Fatura API is running"));

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    return User.countDocuments().then(async (count) => {
      if (count !== 0) return;
      const username = String(process.env.ADMIN_USERNAME || "").trim().toLowerCase();
      const password = String(process.env.ADMIN_PASSWORD || "");
      if (!username || !password) {
        throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required for the first admin account");
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await User.create({ name: "Administrator", username, password: passwordHash, role: "admin" });
      console.log(`Initial admin account created: ${username}`);
    });
  })
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });
