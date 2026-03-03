require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

mongoose.connect(process.env.MONGO_URI);

const attendanceSchema = new mongoose.Schema({
  userId: String,
  joinTime: Date,
  totalMinutes: { type: Number, default: 0 }
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName('deploy-panel').setDescription('نشر بانل تسجيل الحضور'),
    new SlashCommandBuilder().setName('me').setDescription('عرض دقائقك'),
    new SlashCommandBuilder()
      .setName('force-logout')
      .setDescription('إنهاء جلسة عضو')
      .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'deploy-panel') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('login').setLabel('تسجيل دخول').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('logout').setLabel('تسجيل خروج').setStyle(ButtonStyle.Danger),
      );
      return interaction.reply({ content: 'لوحة الحضور:', components: [row] });
    }

    if (interaction.commandName === 'me') {
      const data = await Attendance.findOne({ userId: interaction.user.id });
      return interaction.reply(`⏱️ مجموع دقائقك: ${data ? data.totalMinutes : 0}`);
    }

    if (interaction.commandName === 'force-logout') {
      const user = interaction.options.getUser('user');
      const data = await Attendance.findOne({ userId: user.id });
      if (data && data.joinTime) {
        const diff = Math.floor((Date.now() - data.joinTime) / 60000);
        data.totalMinutes += diff;
        data.joinTime = null;
        await data.save();
      }
      return interaction.reply(`تم إنهاء جلسة ${user.tag}`);
    }
  }

  if (interaction.isButton()) {
    let data = await Attendance.findOne({ userId: interaction.user.id });
    if (!data) data = new Attendance({ userId: interaction.user.id });

    if (interaction.customId === 'login') {
      data.joinTime = new Date();
      await data.save();
      return interaction.reply({ content: 'تم تسجيل الدخول ✅', ephemeral: true });
    }

    if (interaction.customId === 'logout') {
      if (!data.joinTime) return interaction.reply({ content: 'أنت غير مسجل دخول ❌', ephemeral: true });

      const diff = Math.floor((Date.now() - data.joinTime) / 60000);
      data.totalMinutes += diff;
      data.joinTime = null;
      await data.save();
      return interaction.reply({ content: `تم تسجيل الخروج ⏱️ أضفنا ${diff} دقيقة`, ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
