require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function checkAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const user = await User.findOne({
      email: "admin@hampsonsgroupofschool.edu.ng",
    }).select("+passwordHash");

    console.log(user);

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkAdmin();