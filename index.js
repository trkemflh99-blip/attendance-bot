require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");

//////////////////////////////
// 🌐 WEB SERVER (مهم لـ Render)
//////////////////////////////

const app = express();
app.get("/", (req, res) => res.send("Attendance Bot Running ✅"));
app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Web Server Started");
});

//////////////////////////////
// 🗄 DATABASE
//////////////////////////////

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 Mongo Connected"))
  .catch(err => console.error("Mongo Error:", err));

const userSchema = new mongoose.Schema({
  userId: String,
  guildId: String,
  totalTime: { type: Number, default: 0 }
});

const sessionSchema = new mongoose.Schema({
  userId: String,
  guildId: String,
  startTime: Date
});

const configSchema = new mongoose.Schema({
  guildId: String,
  systemEnabled: { type: Boolean, default: true }
});

const User = mongoose.model("User", userSchema);
const Session = mongoose.model("Session", sessionSchema);
const Config = mongoose.model("Config", configSchema);

//////////////////////////////
// 🤖 DISCORD CLIENT
//////////////////////////////

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

//////////////////////////////
// 🔧 READY
//////////////////////////////

client.once("ready", async () => {
  console.log(`🔥 Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("panel")
      .setDescription("Deploy attendance panel"),

    new SlashCommandBuilder()
      .setName("me")
      .setDescription("Show your total time"),

    new SlashCommandBuilder()
      .setName("top")
      .setDescription("Show leaderboard"),

    new SlashCommandBuilder()
      .setName("system")
      .setDescription("Enable / Disable system")
      .addBooleanOption(o =>
        o.setName("state").setDescription("true / false").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Commands Registered");
  } catch (err) {
    console.error("Command Register Error:", err);
  }
});

//////////////////////////////
// 🧠 COMMAND HANDLER
//////////////////////////////

client.on("interactionCreate", async interaction => {

  if (interaction.isChatInputCommand()) {

    const guildId = interaction.guild.id;
    let config = await Config.findOne({ guildId });
    if (!config) config = await Config.create({ guildId });

    if (interaction.commandName === "panel") {

      const embed = new EmbedBuilder()
        .setTitle("📊 Attendance System")
        .setDescription("اضغط لتسجيل الدخول أو الخروج")
        .setColor("Blue");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("login")
          .setLabel("Login")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("logout")
          .setLabel("Logout")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (interaction.commandName === "me") {
      let user = await User.findOne({ userId: interaction.user.id, guildId });
      if (!user) user = await User.create({ userId: interaction.user.id, guildId });

      return interaction.reply(`⏱️ Total: ${Math.floor(user.totalTime / 60)} minutes`);
    }

    if (interaction.commandName === "top") {
      const top = await User.find({ guildId }).sort({ totalTime: -1 }).limit(10);

      let text = "";
      for (let i = 0; i < top.length; i++) {
        const member = await client.users.fetch(top[i].userId).catch(() => null);
        if (!member) continue;
        text += `**${i + 1}.** ${member.tag} — ${Math.floor(top[i].totalTime / 60)}m\n`;
      }

      return interaction.reply(text || "No data");
    }

    if (interaction.commandName === "system") {
      const state = interaction.options.getBoolean("state");
      config.systemEnabled = state;
      await config.save();
      return interaction.reply(`System ${state ? "Enabled" : "Disabled"}`);
    }
  }

  //////////////////////////////
  // 🔘 BUTTONS
  //////////////////////////////

  if (interaction.isButton()) {

    const guildId = interaction.guild.id;
    const config = await Config.findOne({ guildId });

    if (!config.systemEnabled)
      return interaction.reply({ content: "النظام متوقف", ephemeral: true });

    let session = await Session.findOne({ userId: interaction.user.id, guildId });

    if (interaction.customId === "login") {

      if (session)
        return interaction.reply({ content: "أنت مسجل دخول", ephemeral: true });

      await Session.create({
        userId: interaction.user.id,
        guildId,
        startTime: new Date()
      });

      return interaction.reply({ content: "تم تسجيل الدخول ✅", ephemeral: true });
    }

    if (interaction.customId === "logout") {

      if (!session)
        return interaction.reply({ content: "أنت غير مسجل", ephemeral: true });

      const diff = Math.floor((Date.now() - session.startTime) / 1000);

      let user = await User.findOne({ userId: interaction.user.id, guildId });
      if (!user) user = await User.create({ userId: interaction.user.id, guildId });

      user.totalTime += diff;
      await user.save();

      await Session.deleteOne({ _id: session._id });

      return interaction.reply({
        content: `تم تسجيل الخروج (+${Math.floor(diff / 60)} دقيقة)`,
        ephemeral: true
      });
    }
  }
});

//////////////////////////////
// 🚀 LOGIN
//////////////////////////////

console.log("TOKEN STATUS:", process.env.TOKEN ? "EXISTS" : "MISSING");

client.login(process.env.TOKEN)
  .then(() => console.log("Discord Login Attempted"))
  .catch(err => console.error("LOGIN ERROR:", err));
