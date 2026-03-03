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
  PermissionsBitField,
  EmbedBuilder
} = require("discord.js");

const User = require("./models/User");
const Config = require("./models/Config");
const Session = require("./models/Session");
const { secondsToReadable } = require("./utils/timeUtils");
const { getOverallTop, getWeeklyTop, getMonthlyTop } = require("./utils/leaderboard");
const { checkAndAssignRoles } = require("./utils/roleManager");

//////////////////////////////
// EXPRESS
//////////////////////////////

const app = express();
app.get("/", (req, res) => res.send("Attendance Bot Running ✅"));
app.listen(process.env.PORT || 3000);

//////////////////////////////
// DATABASE
//////////////////////////////

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo Connected ✅"))
  .catch(err => console.log(err));

//////////////////////////////
// CLIENT
//////////////////////////////

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

//////////////////////////////
// READY
//////////////////////////////

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [

    new SlashCommandBuilder()
      .setName("deploy-panel")
      .setDescription("Deploy attendance panel"),

    new SlashCommandBuilder()
      .setName("me")
      .setDescription("Show your attendance"),

    new SlashCommandBuilder()
      .setName("top")
      .setDescription("Show leaderboard")
      .addStringOption(o =>
        o.setName("type")
          .setDescription("overall / weekly / monthly")
          .setRequired(true)
          .addChoices(
            { name: "overall", value: "overall" },
            { name: "weekly", value: "weekly" },
            { name: "monthly", value: "monthly" }
          )
      ),

    new SlashCommandBuilder()
      .setName("set-log")
      .setDescription("Set log channel")
      .addChannelOption(o =>
        o.setName("channel").setDescription("Channel").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("system")
      .setDescription("Enable or disable time counting")
      .addBooleanOption(o =>
        o.setName("state").setDescription("true=on false=off").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    new SlashCommandBuilder()
      .setName("login-control")
      .setDescription("Enable or disable login button")
      .addBooleanOption(o =>
        o.setName("state").setDescription("true=enable false=disable").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    new SlashCommandBuilder()
      .setName("set-role")
      .setDescription("Set reward role")
      .addIntegerOption(o =>
        o.setName("hours").setDescription("Hours required").setRequired(true)
      )
      .addRoleOption(o =>
        o.setName("role").setDescription("Role").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)

  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

//////////////////////////////
// INTERACTIONS
//////////////////////////////

client.on("interactionCreate", async interaction => {

  if (interaction.isChatInputCommand()) {

    const guildId = interaction.guild.id;
    let config = await Config.findOne({ guildId });
    if (!config) config = await Config.create({ guildId });

    //////////////////////////////////
    // DEPLOY PANEL
    //////////////////////////////////

    if (interaction.commandName === "deploy-panel") {

      const embed = new EmbedBuilder()
        .setTitle("📊 Attendance System")
        .setDescription("اضغط الأزرار لإدارة حضورك")
        .setColor("Blue");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("login")
          .setLabel("Login")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("logout")
          .setLabel("Logout")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("pause")
          .setLabel("Pause")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    //////////////////////////////////
    // ME
    //////////////////////////////////

    if (interaction.commandName === "me") {
      let user = await User.findOne({ userId: interaction.user.id, guildId });
      if (!user) user = await User.create({ userId: interaction.user.id, guildId });

      return interaction.reply(`⏱️ وقتك الكلي: ${secondsToReadable(user.totalTime)}`);
    }

    //////////////////////////////////
    // TOP
    //////////////////////////////////

    if (interaction.commandName === "top") {

      const type = interaction.options.getString("type");
      let data;

      if (type === "overall") data = await getOverallTop(guildId);
      if (type === "weekly") data = await getWeeklyTop(guildId);
      if (type === "monthly") data = await getMonthlyTop(guildId);

      let desc = "";
      for (let i = 0; i < data.length; i++) {
        const userObj = await client.users.fetch(data[i].userId).catch(()=>null);
        if (!userObj) continue;
        desc += `**${i+1}.** ${userObj.tag} — ${secondsToReadable(data[i].totalTime)}\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Top ${type}`)
        .setDescription(desc || "No data")
        .setColor("Gold");

      return interaction.reply({ embeds: [embed] });
    }

    //////////////////////////////////
    // SET LOG
    //////////////////////////////////

    if (interaction.commandName === "set-log") {
      const channel = interaction.options.getChannel("channel");
      config.logChannel = channel.id;
      await config.save();
      return interaction.reply("✅ Log channel set");
    }

    //////////////////////////////////
    // SYSTEM ON/OFF
    //////////////////////////////////

    if (interaction.commandName === "system") {
      const state = interaction.options.getBoolean("state");
      config.systemEnabled = state;
      await config.save();
      return interaction.reply(`System ${state ? "Enabled" : "Disabled"}`);
    }

    //////////////////////////////////
    // LOGIN CONTROL
    //////////////////////////////////

    if (interaction.commandName === "login-control") {
      const state = interaction.options.getBoolean("state");
      config.loginEnabled = state;
      await config.save();
      return interaction.reply(`Login ${state ? "Enabled" : "Disabled"}`);
    }

    //////////////////////////////////
    // SET ROLE REWARD
    //////////////////////////////////

    if (interaction.commandName === "set-role") {

      const hours = interaction.options.getInteger("hours");
      const role = interaction.options.getRole("role");

      config.roleRewards.push({
        hours,
        roleId: role.id
      });

      await config.save();
      return interaction.reply(`Role reward set for ${hours} hours`);
    }

  }

  //////////////////////////////////
  // BUTTONS
  //////////////////////////////////

  if (interaction.isButton()) {

    const guildId = interaction.guild.id;
    const config = await Config.findOne({ guildId });

    if (!config.systemEnabled)
      return interaction.reply({ content: "النظام متوقف حالياً", ephemeral: true });

    let session = await Session.findOne({ userId: interaction.user.id, guildId });

    //////////////////////////////////
    // LOGIN
    //////////////////////////////////

    if (interaction.customId === "login") {

      if (!config.loginEnabled)
        return interaction.reply({ content: "تسجيل الدخول معطل حالياً", ephemeral: true });

      if (session)
        return interaction.reply({ content: "أنت مسجل دخول بالفعل", ephemeral: true });

      await Session.create({
        userId: interaction.user.id,
        guildId,
        startTime: new Date()
      });

      return interaction.reply({ content: "تم تسجيل الدخول ✅", ephemeral: true });
    }

    //////////////////////////////////
    // LOGOUT
    //////////////////////////////////

    if (interaction.customId === "logout") {

      if (!session)
        return interaction.reply({ content: "أنت غير مسجل دخول", ephemeral: true });

      const diff = Math.floor((Date.now() - session.startTime) / 1000);

      let user = await User.findOne({ userId: interaction.user.id, guildId });
      if (!user) user = await User.create({ userId: interaction.user.id, guildId });

      user.totalTime += diff;
      await user.save();

      await checkAndAssignRoles(interaction.member, user.totalTime);

      await Session.deleteOne({ _id: session._id });

      return interaction.reply({ content: `تم تسجيل الخروج (+${secondsToReadable(diff)})`, ephemeral: true });
    }

    //////////////////////////////////
    // PAUSE
    //////////////////////////////////

    if (interaction.customId === "pause") {

      if (!session)
        return interaction.reply({ content: "أنت غير مسجل دخول", ephemeral: true });

      const diff = Math.floor((Date.now() - session.startTime) / 1000);

      let user = await User.findOne({ userId: interaction.user.id, guildId });
      if (!user) user = await User.create({ userId: interaction.user.id, guildId });

      user.totalTime += diff;
      await user.save();

      session.startTime = new Date();
      await session.save();

      return interaction.reply({ content: "تم إيقاف الجلسة مؤقتاً ⏸️", ephemeral: true });
    }

  }

});

client.login(process.env.TOKEN);
