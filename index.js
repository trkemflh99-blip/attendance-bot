require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const { Client, GatewayIntentBits } = require("discord.js");

//////////////////////////////
// EXPRESS (عشان Render ما يطفي)
//////////////////////////////

const app = express();
app.get("/", (req, res) => res.send("Bot Running ✅"));
app.listen(process.env.PORT || 3000, () => {
  console.log("Web Server Started");
});

//////////////////////////////
// DATABASE
//////////////////////////////

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo Connected ✅"))
  .catch(err => console.error("Mongo Error:", err));

//////////////////////////////
// DISCORD CLIENT
//////////////////////////////

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

//////////////////////////////
// READY EVENT
//////////////////////////////

client.once("ready", () => {
  console.log(`🔥 Logged in as ${client.user.tag}`);
});

//////////////////////////////
// LOGIN
//////////////////////////////

console.log("TOKEN STATUS:", process.env.TOKEN ? "EXISTS" : "MISSING");

client.login(process.env.TOKEN)
  .then(() => console.log("Discord Login Attempted"))
  .catch(err => console.error("LOGIN ERROR:", err));

//////////////////////////////
// GLOBAL ERROR CATCH
//////////////////////////////

client.on("error", console.error);
client.on("shardError", console.error);
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);
