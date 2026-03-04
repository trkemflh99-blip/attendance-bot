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

////////////////////////////////////////////////////////
//// WEB SERVER (حتى لا ينام البوت)
////////////////////////////////////////////////////////

const app = express();

app.get("/", (req,res)=>{
res.send("Attendance Bot Running");
});

app.listen(3000,()=>{
console.log("Web Server Started");
});

////////////////////////////////////////////////////////
//// DATABASE
////////////////////////////////////////////////////////

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("Mongo Connected"))
.catch(err=>console.log(err));

////////////////////////////////////////////////////////
//// MODELS
////////////////////////////////////////////////////////

const userSchema = new mongoose.Schema({

userId:String,
guildId:String,

totalTime:{
type:Number,
default:0
}

});

const sessionSchema = new mongoose.Schema({

userId:String,
guildId:String,

startTime:Date

});

const configSchema = new mongoose.Schema({

guildId:String,

logChannel:String,

systemDisabled:{
type:Boolean,
default:false
},

countDisabled:{
type:Boolean,
default:false
},

loginRole:String,

modOnlyTime:{
type:Boolean,
default:false
},

rewardRoles:[
{
hours:Number,
roleId:String
}
]

});

const User = mongoose.model("User",userSchema);
const Session = mongoose.model("Session",sessionSchema);
const Config = mongoose.model("Config",configSchema);

////////////////////////////////////////////////////////
//// CLIENT
////////////////////////////////////////////////////////

const client = new Client({
intents:[GatewayIntentBits.Guilds]
});

////////////////////////////////////////////////////////
//// TIME FORMAT
////////////////////////////////////////////////////////

function formatTime(seconds){

const h = Math.floor(seconds/3600);
const m = Math.floor((seconds%3600)/60);

return `${h} ساعة ${m} دقيقة`;

}

////////////////////////////////////////////////////////
//// READY
////////////////////////////////////////////////////////

client.once("ready", async()=>{

console.log(`Logged in as ${client.user.tag}`);

const commands=[

new SlashCommandBuilder()
.setName("البانل")
.setDescription("إرسال لوحة الحضور"),

new SlashCommandBuilder()
.setName("وقتي")
.setDescription("عرض وقت حضورك"),

new SlashCommandBuilder()
.setName("التوب")
.setDescription("عرض أكثر الأعضاء حضوراً"),

new SlashCommandBuilder()
.setName("اللوق")
.setDescription("تحديد روم اللوق")
.addChannelOption(o=>
o.setName("الروم")
.setDescription("اختر روم اللوق")
.setRequired(true)
),

new SlashCommandBuilder()
.setName("تعطيل")
.setDescription("تعطيل نظام الحضور"),

new SlashCommandBuilder()
.setName("تشغيل")
.setDescription("تشغيل نظام الحضور"),

new SlashCommandBuilder()
.setName("تعطيل-الوقت")
.setDescription("إيقاف حساب الوقت مؤقتاً"),

new SlashCommandBuilder()
.setName("تشغيل-الوقت")
.setDescription("إعادة حساب الوقت"),

new SlashCommandBuilder()
.setName("رتبة-الدخول")
.setDescription("تحديد رتبة مسموح لها تسجيل الدخول")
.addRoleOption(o=>
o.setName("الرتبة")
.setDescription("اختر الرتبة")
.setRequired(true)
),

new SlashCommandBuilder()
.setName("رتبة-ساعات")
.setDescription("إضافة رتبة مقابل عدد ساعات")
.addIntegerOption(o=>
o.setName("الساعات")
.setDescription("عدد الساعات")
.setRequired(true)
)
.addRoleOption(o=>
o.setName("الرتبة")
.setDescription("اختر الرتبة")
.setRequired(true)
),

new SlashCommandBuilder()
.setName("وقت-المودات")
.setDescription("تفعيل تسجيل الحضور للمودات فقط"),

new SlashCommandBuilder()
.setName("الغاء-وقت-المودات")
.setDescription("إلغاء وضع المودات"),

new SlashCommandBuilder()
.setName("حظر-سيرفر")
.setDescription("حظر سيرفر من استخدام البوت")
.addStringOption(o=>
o.setName("الايدي")
.setDescription("ايدي السيرفر")
.setRequired(true)
)

].map(c=>c.toJSON());

const rest = new REST({version:"10"}).setToken(process.env.TOKEN);

await rest.put(
Routes.applicationCommands(client.user.id),
{body:commands}
);

console.log("Commands Registered");

});////////////////////////////////////////////////////////
//// INTERACTIONS
////////////////////////////////////////////////////////

client.on("interactionCreate", async interaction => {

if(!interaction.guild) return;

const guildId = interaction.guild.id;

let config = await Config.findOne({guildId});
if(!config) config = await Config.create({guildId});

////////////////////////////////////////////////////////
//// الأوامر
////////////////////////////////////////////////////////

if(interaction.isChatInputCommand()){

////////////////////////////////////////
//// البانل
////////////////////////////////////////

if(interaction.commandName === "البانل"){

const embed = new EmbedBuilder()

.setColor("Blue")

.setTitle("نظام الحضور")

.setDescription(`
اضغط الأزرار لإدارة حضورك

• تسجيل دخول
• تسجيل خروج
• تسجيل خروج مؤقت
`);

const row = new ActionRowBuilder()

.addComponents(

new ButtonBuilder()
.setCustomId("login")
.setLabel("تسجيل دخول")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("logout")
.setLabel("تسجيل خروج")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("temp")
.setLabel("خروج مؤقت")
.setStyle(ButtonStyle.Secondary)

);

return interaction.reply({
embeds:[embed],
components:[row]
});

}

////////////////////////////////////////
//// وقتي
////////////////////////////////////////

if(interaction.commandName === "وقتي"){

let user = await User.findOne({
userId:interaction.user.id,
guildId
});

if(!user) user = await User.create({
userId:interaction.user.id,
guildId
});

return interaction.reply(`وقت حضورك: ${formatTime(user.totalTime)}`);

}

////////////////////////////////////////
//// التوب
////////////////////////////////////////

if(interaction.commandName === "التوب"){

const users = await User.find({guildId})
.sort({totalTime:-1})
.limit(10);

let text="";

for(let i=0;i<users.length;i++){

const member = await client.users.fetch(users[i].userId).catch(()=>null);

if(!member) continue;

text += `${i+1}. ${member.username} : ${formatTime(users[i].totalTime)}\n`;

}

const embed = new EmbedBuilder()

.setTitle("🏆 أكثر الأعضاء حضوراً")

.setDescription(text || "لا يوجد بيانات")

.setColor("Gold");

return interaction.reply({embeds:[embed]});

}

////////////////////////////////////////
//// اللوق
////////////////////////////////////////

if(interaction.commandName === "اللوق"){

config.logChannel = interaction.options.getChannel("الروم").id;

await config.save();

return interaction.reply("تم تحديد روم اللوق");

}

////////////////////////////////////////
//// تعطيل النظام
////////////////////////////////////////

if(interaction.commandName === "تعطيل"){

config.systemDisabled = true;

await config.save();

await Session.deleteMany({guildId});

return interaction.reply("تم تعطيل النظام وإخراج الجميع");

}

////////////////////////////////////////
//// تشغيل النظام
////////////////////////////////////////

if(interaction.commandName === "تشغيل"){

config.systemDisabled = false;

await config.save();

return interaction.reply("تم تشغيل النظام");

}

////////////////////////////////////////
//// تعطيل الوقت
////////////////////////////////////////

if(interaction.commandName === "تعطيل-الوقت"){

config.countDisabled = true;

await config.save();

return interaction.reply("تم تعطيل حساب الوقت");

}

////////////////////////////////////////
//// تشغيل الوقت
////////////////////////////////////////

if(interaction.commandName === "تشغيل-الوقت"){

config.countDisabled = false;

await config.save();

return interaction.reply("تم تشغيل حساب الوقت");

}

////////////////////////////////////////
//// رتبة الدخول
////////////////////////////////////////

if(interaction.commandName === "رتبة-الدخول"){

const role = interaction.options.getRole("الرتبة");

config.loginRole = role.id;

await config.save();

return interaction.reply("تم تحديد رتبة الدخول");

}

////////////////////////////////////////
//// رتبة الساعات
////////////////////////////////////////

if(interaction.commandName === "رتبة-ساعات"){

const hours = interaction.options.getInteger("الساعات");

const role = interaction.options.getRole("الرتبة");

config.rewardRoles.push({

hours,
roleId:role.id

});

await config.save();

return interaction.reply("تم إضافة رتبة الساعات");

}

////////////////////////////////////////
//// وقت المودات
////////////////////////////////////////

if(interaction.commandName === "وقت-المودات"){

config.modOnlyTime = true;

await config.save();

return interaction.reply("الآن فقط المودات يمكنهم تسجيل الحضور");

}

if(interaction.commandName === "الغاء-وقت-المودات"){

config.modOnlyTime = false;

await config.save();

return interaction.reply("تم إلغاء وضع المودات");

}

////////////////////////////////////////
//// حظر سيرفر
////////////////////////////////////////

if(interaction.commandName === "حظر-سيرفر"){

const id = interaction.options.getString("الايدي");

if(interaction.guild.id === id){

await interaction.guild.leave();

}

}

}

////////////////////////////////////////////////////////
//// الأزرار
////////////////////////////////////////////////////////

if(interaction.isButton()){

if(config.systemDisabled){

return interaction.reply({
content:"النظام متوقف حالياً",
ephemeral:true
});

}

let session = await Session.findOne({
userId:interaction.user.id,
guildId
});

////////////////////////////////////////
//// تسجيل دخول
////////////////////////////////////////

if(interaction.customId === "login"){

if(config.loginRole){

if(!interaction.member.roles.cache.has(config.loginRole)){

return interaction.reply({
content:"ليس لديك رتبة الدخول",
ephemeral:true
});

}

}

if(config.modOnlyTime){

if(!interaction.member.permissions.has("ManageMessages")){

interaction.user.send("تم تسجيل دخولك في وقت غير مخصص");

}

}

if(session){

return interaction.reply({
content:"أنت مسجل دخول بالفعل",
ephemeral:true
});

}

await Session.create({

userId:interaction.user.id,
guildId,
startTime:new Date()

});

return interaction.reply({
content:"تم تسجيل الدخول",
ephemeral:true
});

}////////////////////////////////////////
//// تسجيل خروج
////////////////////////////////////////

if(interaction.customId === "logout"){

if(!session){

return interaction.reply({
content:"أنت غير مسجل دخول",
ephemeral:true
});

}

const diff = Math.floor((Date.now()-session.startTime)/1000);

let user = await User.findOne({
userId:interaction.user.id,
guildId
});

if(!user){

user = await User.create({
userId:interaction.user.id,
guildId
});

}

////////////////////////////////////////////////
//// حساب الوقت
////////////////////////////////////////////////

if(!config.countDisabled){

user.totalTime += diff;

}

await user.save();

await Session.deleteOne({_id:session._id});

////////////////////////////////////////////////
//// إعطاء رتبة الساعات
////////////////////////////////////////////////

for(const reward of config.rewardRoles){

const needed = reward.hours * 3600;

if(user.totalTime >= needed){

const role = interaction.guild.roles.cache.get(reward.roleId);

if(role && !interaction.member.roles.cache.has(role.id)){

await interaction.member.roles.add(role).catch(()=>{});

}

}

}

////////////////////////////////////////////////
//// اللوق
////////////////////////////////////////////////

if(config.logChannel){

const log = interaction.guild.channels.cache.get(config.logChannel);

if(log){

const embed = new EmbedBuilder()

.setTitle("تسجيل خروج")

.setDescription(`
المستخدم: ${interaction.user}

الوقت المكتسب:
${formatTime(diff)}
`)

.setColor("Red");

log.send({embeds:[embed]});

}

}

return interaction.reply({

content:`تم تسجيل الخروج (+${formatTime(diff)})`,
ephemeral:true

});

}

////////////////////////////////////////
//// خروج مؤقت
////////////////////////////////////////

if(interaction.customId === "temp"){

if(!session){

return interaction.reply({
content:"أنت غير مسجل دخول",
ephemeral:true
});

}

const diff = Math.floor((Date.now()-session.startTime)/1000);

let user = await User.findOne({
userId:interaction.user.id,
guildId
});

if(!user){

user = await User.create({
userId:interaction.user.id,
guildId
});

}

if(!config.countDisabled){

user.totalTime += diff;

}

await user.save();

await Session.deleteOne({_id:session._id});

if(config.logChannel){

const log = interaction.guild.channels.cache.get(config.logChannel);

if(log){

const embed = new EmbedBuilder()

.setTitle("خروج مؤقت")

.setDescription(`
المستخدم: ${interaction.user}

الوقت المكتسب:
${formatTime(diff)}
`)

.setColor("Yellow");

log.send({embeds:[embed]});

}

}

return interaction.reply({

content:`تم تسجيل خروجك مؤقتاً (+${formatTime(diff)})`,
ephemeral:true

});

}

}

});

////////////////////////////////////////////////////////
//// تشغيل البوت
////////////////////////////////////////////////////////

client.login(process.env.TOKEN);
