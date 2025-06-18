const TelegramBot = require('node-telegram-bot-api');
const bedrock = require('bedrock-protocol');
const fs = require('fs');
const path = require('path');
const huh= require('moment-timezone')
const moment = (tt) => {
    
    if (tt) {
        return tt
    } else return {
        isBefore: (time) => Date.now() < time,
        isAfter: (time) => Date.now() >= time
    }
}

const TOKEN = '7301115604:AAFkmlMvFr8zZG7JFkCwbIXt5aUIzCZ-s6c';
const CHANNEL = '@jhjgkghhhgc';
const bot = new TelegramBot(TOKEN, { polling: true });
const POINTS_PER_DAY = 4;
const TIMEOUT_LINKS = 24;
const MAX_POINTS = 1800;

const pageSize = 100;
const OWNERS = ["@eee_5z"];
const requiredChannels = ['@jhjgkghhhgc']


/* *
 * player move
 * {x,y,z}
 * jump, sprint,
 * */


async function checkChannels(id) {
    if (`${id}`.startsWith('-100')) return true
    let l1 = 0;

    for (const chnl of requiredChannels) {
        try {
            const member = await bot.getChatMember(chnl, id);
            const s = member.status;
            if (s === "creator" || s === "member" || s === "administrator") {
                l1++;
            }
        } catch (err) {
            
        }
    }

    return l1 === requiredChannels.length;
}














let ADMINS = [...OWNERS];
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const FILES = {
  USERS: path.join(DATA_DIR, 'users.json'),
  LINKS: path.join(DATA_DIR, 'links.json'),
  BANNED: path.join(DATA_DIR, 'banned_users.json'),
  CODES: path.join(DATA_DIR, 'code.json'),
  COOLDOWN: path.join(DATA_DIR, 'cooldown.json'),
  SHRT: path.join(DATA_DIR, 'shortcuts.json'),
  HOUR: path.join(DATA_DIR, 'HOUR.json'),
  VALUE: path.join(DATA_DIR, 'LINKS.json')
};

const loadJSON = (file, defaultValue) => {
  if (!fs.existsSync(file)) return defaultValue;

  try {
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`خطأ في تحميل JSON من ${file}:`, err.message);
    return defaultValue;
  }
};
const saveJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data));

let users = loadJSON(FILES.USERS, {});
let pointLinks = loadJSON(FILES.LINKS, {msg: 'Error 404'});
let bannedUsers = loadJSON(FILES.BANNED, {});
let pointCodes = loadJSON(FILES.CODES, {});
let activeBots = {};
let cooldown = loadJSON(FILES.COOLDOWN, {});
let ShortcutLinks = loadJSON(FILES.SHRT, []);
let isGlobalRestriction = false;
let HOURS_PER_POINTS = loadJSON(FILES.HOUR, [0])[0];
let ValueLinks = loadJSON(FILES.VALUE, {money: 0, links: 0})


const save = {
  users: () => saveJSON(FILES.USERS, users),
  links: () => saveJSON(FILES.LINKS, pointLinks),
  banned: () => saveJSON(FILES.BANNED, bannedUsers),
  codes: () => saveJSON(FILES.CODES, pointCodes),
  cooldown: () => saveJSON(FILES.COOLDOWN, cooldown),
  shorcuts: () => saveJSON(FILES.SHRT, ShortcutLinks),
  HOUR: () => saveJSON(FILES.HOUR, HOURS_PER_POINTS),
  LINKS: () => saveJSON(FILES.VALUE, ValueLinks)
};

const ensureUser = (chatId, msg) => {
  if (!users[chatId]) {
    const username = msg?.from?.username ? `@${msg.from.username}` : null;
    const firstName = msg?.from?.first_name || 'غير معروف';
    users[chatId] = {
      points: 0,
      isActive: false,
      lastActivationDate: null,
      expiryDate: null,
      username,
      firstName,
      usedLinks: [],
      usedReferrals: [],
      serverDetails: null
    };
    save.users();

    bot.sendMessage(-1002600317777, "مستخدم جديد ،", {
        message_thread_id: 8
    }).then(c => {
        bot.sendMessage(-1002600317777, 'username: '+(username || 'ليس لديه يوزر'), {
            message_thread_id: 8
        }).then(a => {
            bot.sendMessage(-1002600317777, `[${escapeMarkdown(firstName)}](tg://user?id=${chatId})`, {
            message_thread_id: 8,
            parse_mode: "MarkdownV2"
        }).then(cc=>bot.sendMessage(-1002600317777, '➖️➖️➖️➖️➖️➖️➖️➖️➖️', {
            message_thread_id: 8
        }))
        })
    })
  }
  return users[chatId];
};

function escapeMarkdown(text) {
  return String(text)
    .replace("_", '')
    .replace(".", '')
    .replace("/", '')
    .replace("~", '')
    .replace("|", '')
    .replace("*", '')
    .replace("-", '')
    .replace("+", '')
    .replace("`", '')
    .replace(">", '')
    .replace("#", '')
    .replace("!", '')
    .replace("{", '')
    .replace("}", '')
    .replace("[", '')
    .replace("]", '')
    .replace("(", '')
    .replace(")", '');
}
function ZERO () {
    Object.keys(users).forEach(a => {
        users[a].points = 0
    })
    save.users()
}





function getRemainingTime(endTime, stopTime) {
  let now = Date.now();
  let remaining;

  if (stopTime) {
    // لو المؤقت موقوف، نستخدم stopTime بدل now
    remaining = endTime - stopTime;
  } else {
    remaining = endTime - now;
  }

  if (remaining <= 0) {
    return "انتهى الوقت!";
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `الوقت المتبقي: ${hours} ساعة و ${minutes} دقيقة و ${seconds} ثانية`;
}
const timer = setInterval(getRemainingTime, 1000);

const resetDailyLinks = () => {
  if (pointLinks.lastReset !== today) {
    pointLinks.usedToday = {};
    pointLinks.lastReset = today;
    save.links();
  }
};

const checkExpiredUsers = () => {
  const now = Date.now();
  Object.keys(users).forEach(chatId => {
    const user = users[chatId];
    
    if (user.expiryDate && activeBots[chatId] && now >= user.expiryDate) {
        bot.sendMessage(chatId, "انتهى الوقت.");
        activeBots[chatId].disconnect();
        delete activeBots[chatId];
        user.serverDetails = null;
        user.expiryDate = null;
        user.isActive = false;
        save.users();
    }
  });
  save.users();
};
huh.locale('ar')
huh.tz('Asia/Baghdad')
const RESTART = () => {
    Object.keys(users).forEach(chatId => {
        const user = users[chatId];
        if (user.expiryDate) {
        const now = huh();
        const expiry = huh(user.expiryDate);
        const duration = huh.duration(expiry.diff(now));
        user.expiryDate = Date.now() + (60000 * duration.minutes) + (60000 * 60 * duration.hours)
        }
    })
};

//setInterval(resetDailyLinks, 60000);
setInterval(checkExpiredUsers, 60000);

const isAdmin = (chatId) => ADMINS.includes(users[chatId]?.username);
const isOwner = (chatId) => OWNERS.includes(users[chatId]?.username);

const createKeyboard = (chatId) => {
  const user = users[chatId] || {};
  const admin = isAdmin(chatId);
  const owner = isOwner(chatId);
  
  if (bannedUsers[chatId]) return { reply_markup: { keyboard: [['الدعم الفني']], resize_keyboard: true } };
  if (isGlobalRestriction && !admin) return { reply_markup: { keyboard: [['الوقت المتبقي', 'قناة البوت'], ['الدعم الفني']], resize_keyboard: true } };
  
  const keyboard = [
  ['تشغيل البوت', 'ايقاف البوت'],
  ['اجمع لوشة『NB』', 'طريقة تجميع لوشة『NB』'],
  ['الوقت المتبقي', 'تغيير الخادم الحالي'],
  ['رابط مشاركة', 'متجر الساعات'],
  ['قناة البوت', 'الدعم الفني'],
  ['تشغيل البوت بدون تجميع']
];

  if (admin) keyboard.push(['قائمة الادمن']);
  return { reply_markup: { keyboard, resize_keyboard: true } };
};


const createAdminKeyboard = (chatId) => {
  const keyboard = [
      ['عرض المستخدمين النشطين'],
    ['حظر مستخدم', 'إلغاء حظر مستخدم'],
    ['إحصائيات البوت', 'توليد رابط لوشه'],
    ['عرض مستخدمين البوت', 'عرض المحظورين'],
    ['عرض الادمنز', 'اذاعة'],
    ['عرض الروابط', `تغيير الروابط`],
    ['توليد رابط اختصار لوشه', 'تغيير سعر الساعة'],
    ['اضافة نقاط', 'حذف نقاط']
  ];
  
  if (isOwner(chatId)) keyboard.push(['إضافة ادمن', 'حذف ادمن']);
  keyboard.push(['العودة للقائمة الرئيسية']);
  
  return { reply_markup: { keyboard, resize_keyboard: true } };
};

bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (bannedUsers[chatId]) return bot.sendMessage(chatId, 'تم حظرك من استخدام البوت.', createKeyboard(chatId));
  
  
  const ch = await checkChannels(chatId);
  
  
  if (!ch) {
      bot.sendMessage(chatId, 'يجب عليك الاشتراك بالقنوات التالية:\n'+requiredChannels.join('\n'))
      
      return;
  }
  
  
  const user = ensureUser(chatId, msg);
  const param = match ? match[1] : null;
  
  if (param && param.startsWith('shortcut_') && ShortcutLinks.includes(param.substring(9))) {
      const key = param.substring(9);
      if (user.usedLinks.includes(key)) {
         return bot.sendMessage(chatId, 'لقد استخدمت هذا الرابط حاول اليوم التالي.');
      }
      if (user.points >= MAX_POINTS) {
      return bot.sendMessage(chatId, `لقد وصلت إلى الحد الأقصى لللوشه (${MAX_POINTS} نقاط)`, createKeyboard(chatId));
    }
      const pointsToAdd = Math.min(MAX_POINTS, user.points + 120);
      user.points = pointsToAdd;
      user.usedLinks.push(key);
      save.users();
      bot.sendMessage(chatId, 'تم اضافة 120 نقطه من اختصار الروابط.');
      ValueLinks.money += 0.007;
      ValueLinks.links += 1;
      save.LINKS();
      bot.sendMessage(-1002600317777, `تم تخطي رابط جديد بواسطة: ${chatId},\nاجمالي عدد الروابط: ${ValueLinks.links},\nمجموع الارباح: ${ValueLinks.money}`, {
          message_thread_id: 5871
      });
    return;
  }
  if (param && param.startsWith('point_')) {
    // نظام الروابط التي تعطي نقاط
    const pointKey = param.substring(6);
    
    if (!pointCodes[pointKey]) {
      return bot.sendMessage(chatId, 'هذا الرابط غير صالح أو منتهي.', createKeyboard(chatId));
    }
    
    if (user.points >= MAX_POINTS) {
      return bot.sendMessage(chatId, `لقد وصلت إلى الحد الأقصى لللوشه (${MAX_POINTS} نقاط)`, createKeyboard(chatId));
    }
    
    if (pointCodes[pointKey].points !== "n" && pointCodes[pointKey].usedPersons >= pointCodes[pointKey].persons) {
        return bot.sendMessage(chatId, `الرابط منتهي الصلاحية.`)
    }
    
    if (user.usedLinks.includes(pointKey)) {
      return bot.sendMessage(chatId, 'لقد استخدمت هذا الرابط مسبقاً', createKeyboard(chatId));
    }
    
    const pointsToAdd = pointCodes[pointKey].points;
    user.points = Math.min(MAX_POINTS, user.points + parseInt(pointsToAdd));
    user.usedLinks.push(pointKey);
    save.users();
    
    pointCodes[pointKey].usedPersons++;
    save.codes();
    
    bot.sendMessage(-1002600317777, "تم اضافة نقاط بقيمة "+pointsToAdd, {
        message_thread_id: 10
    }).then(v =>{
        bot.sendMessage(-1002600317777, `username: @${msg.from.username}` || 'ليس لديه يوزر.', {
            message_thread_id: 10
        }).then(g => {
            bot.sendMessage(-1002600317777, `Name :[${escapeMarkdown(msg.from.first_name)}](tg://user?id=${chatId})`, {
                message_thread_id: 10,
                parse_mode: "MarkdownV2"
            }).then(c => {
                bot.sendMessage(-1002600317777, `Link: https://t.me/NB_Player_Bot?start=point_${pointKey}`, {
                    message_thread_id: 10
                }).then(cc=>bot.sendMessage(-1002600317777, '➖️➖️➖️➖️➖️➖️➖️➖️➖️', {
            message_thread_id: 10
        }))
            })
        })
    })


    bot.sendMessage(chatId, `تم إضافة ${pointsToAdd} نقاط لك. النقاط الحالية: ${user.points}/${MAX_POINTS}`, createKeyboard(chatId));
    
  } else if (param && param.startsWith('user_')) {
    // نظام الإحالة
    const referrerId = param.substring(5);
    
    if (referrerId === chatId.toString()) {
      return bot.sendMessage(chatId, 'لا يمكنك استخدام رابط الإحالة الخاص بك.', createKeyboard(chatId));
    }
    
    if (!users[referrerId]) {
      return bot.sendMessage(chatId, 'رابط إحالة غير صالح.', createKeyboard(chatId));
    }
    
    if (user.usedReferrals.includes(referrerId)) {
      return bot.sendMessage(chatId, 'لقد استخدمت هذا الرابط مسبقاً', createKeyboard(chatId));
    }
    
    // إضافة نقطة للمستخدم الذي قام بالإحالة
    if (users[referrerId].points < MAX_POINTS) {
      users[referrerId].points++;
      user.usedReferrals.push(referrerId);
      save.users();
      
      bot.sendMessage(referrerId, `حصلت على لوشة جديدة من إحالة المستخدم ${chatId}. نقاطك الآن: ${users[referrerId].points}/${MAX_POINTS}`);
      bot.sendMessage(chatId, 'مرحباً بك! تم تسجيل دخولك من خلال رابط إحالة.', createKeyboard(chatId));
    }
  } else {
    bot.sendMessage(chatId, 'مرحبا بك في بوت التحكم', createKeyboard(chatId));
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text) return;
  
  if (bannedUsers[chatId] && text !== 'الدعم الفني') {
    return bot.sendMessage(chatId, 'تم حظرك من استخدام البوت.', createKeyboard(chatId));
  }
  const ch = await checkChannels(chatId)
  if (!ch && !(text.startsWith("/start"))) {
      bot.sendMessage(chatId, 'يجب عليك الاشتراك بالقنوات التالية:\n '+requiredChannels.join('\n'))
      return;
  }
  if (text == "/start") return
  const user = ensureUser(chatId, msg);
  const keyboard = createKeyboard(chatId);
  const admin = isAdmin(chatId);
  const owner = isOwner(chatId);

  if (isGlobalRestriction && !admin && text !== 'الوقت المتبقي' && text !== 'قناة البوت' && text !== 'الدعم الفني') {
    return bot.sendMessage(chatId, 'البوت مقيد مؤقتا من قبل المشرف.', keyboard);
  }

  // المستخدم العادي 
  
  if (text == "طريقة تجميع لوشة『NB』") {
      bot.sendMessage(chatId, "لتجميع لوشة: https://t.me/NoorBazooka_Bot_Player/2511");
  }
  if (text == "تشغيل البوت بدون تجميع") {
      bot.sendMessage(chatId, "عزيزي المستخدم يمكنك استخدام البوت بدون تجميع لوشة او مشاهدة الإعلانات وذالك عن طريق إشتراك VIP يمكنك من استخدام البوت لمدة شهر بشكل مجاني دون الحاجة لتجميع نقاط \nسعر الاشتراك 3$\n\nللمزيد من التفاصيل عن كيفية الدفع او الاشتراك تواصل مع @nb00bot")
  }
  if (text === 'تشغيل البوت') {
      if (isGlobalRestriction) {
          return bot.sendMessage(chatId, "البوت مقيد.")
      }
    const now = moment();
    
    if (user.expiryDate && now.isBefore(moment(user.expiryDate)) && user.isActive) {
      if (activeBots[chatId]) {
        return bot.sendMessage(chatId, 'البوت يعمل بالفعل. لتغيير الخادم، قم بإيقاف البوت أولاً.', keyboard);
      } else if (user.serverDetails) {
          bot.sendMessage(chatId, "تم تشغيل البوت من جديد.")
        return connectToServer(chatId, user.serverDetails.host, user.serverDetails.port, user.serverDetails.version, 0, 0);
      }
    }
    
    bot.sendMessage(chatId, 'أرسل عدد الساعات التي ترغب بها:', { reply_markup: { force_reply: true } });
  }
  
  if (text === "تغيير الخادم الحالي") {
  const user = users[chatId];
  if (!user || user.expiryDate == null || user.serverDetails == null || moment().isAfter(moment(user.expiryDate))) {
    return bot.sendMessage(chatId, 'لم يتم تفعيل بوت بعد.');
  }

  bot.sendMessage(chatId, "ارسل الخادم الجديد بصيغة host:port مثل (myserver.com:12345)");

  onceFrom(chatId, "message", msga => {
    const parts = msga.text.split(":");
    if (parts.length < 2) {
      return bot.sendMessage(chatId, "ارسل الخادم بصيغة host:port");
    }

    const host = parts[0].trim();
    const port = parseInt(parts[1]);

    if (isNaN(port)) {
      return bot.sendMessage(chatId, "ارسل بورت صحيح.");
    }

    bot.sendMessage(chatId, "ارسل اصدار السيرفر الجديد (مثل 1.21.70)");

    onceFrom(chatId, "message", MSG => {
      const version = MSG.text.trim();

      // تحقق بسيط أن الإصدار فيه على الأقل رقم ونقطة
      if (!/^\d+\.\d+(\.\d+)?$/.test(version)) {
        return bot.sendMessage(chatId, "ارسل اصدار صحيح رجاءً (مثال: 1.21.70)");
      }

      if (user.isActive && activeBots[chatId]) {
        activeBots[chatId].disconnect();
      }

      connectToServer(chatId, host, port, version, 0, 0);
      bot.sendMessage(chatId, "يتم الاتصال بالخادم الجديد.");
    });
  });
}

  if (msg.reply_to_message && msg.reply_to_message.text.includes('أرسل عدد الساعات')) {
    const hours = parseInt(text);
    if (isNaN(hours) || hours <= 0) {
      return bot.sendMessage(chatId, 'يرجى إدخال رقم صحيح وموجب للساعات.', keyboard);
    }
    
    const requiredPoints = hours * HOURS_PER_POINTS;
    
    if (user.points < requiredPoints) {
      return bot.sendMessage(chatId, `تحتاج إلى ${requiredPoints} لوشة لـ ${hours} ساعة. نقاطك الحالية: ${user.points}`, keyboard);
    }
    
    
    bot.sendMessage(chatId, `سيتم خصم ${requiredPoints} لوشه مقابل ${hours} ساعة. أرسل عنوان السيرفر مع البورت (مثال: myserver.com:19132)`, {
      reply_markup: { force_reply: true }
    });
  }

  if (text === 'ايقاف البوت') {
    if (user.serverDetails && user.expiryDate) {
      try {
        if (activeBots[chatId]) {
            activeBots[chatId].disconnect();
            delete activeBots[chatId];
        }
        
        user.isActive = false;
        user.serverDetails.stopTime = Date.now()
        save.users();
        bot.sendMessage(chatId, 'تم ايقاف البوت بنجاح', keyboard);
      } catch (e) {
        bot.sendMessage(chatId, `حدث خطأ: ${e.message}`, keyboard);
      }
    } else {
      bot.sendMessage(chatId, 'لا يوجد بوت نشط', keyboard);
    }
  }

  if (msg.reply_to_message && msg.reply_to_message.text.includes('عنوان السيرفر')) {
    const serverText = text.split(':');
    if (serverText.length !== 2) {
      return bot.sendMessage(chatId, 'صيغة غير صحيحة، يرجى استخدام host:port', keyboard);
    }
    
    const host = serverText[0].trim();
    const port = parseInt(serverText[1].trim());
    
    if (isNaN(port)) {
      return bot.sendMessage(chatId, 'صيغة البورت غير صحيحة، يجب أن يكون رقماً', keyboard);
    }
    
    // إذا وصلنا إلى هنا، فسنخصم النقاط وسنقوم بالاتصال
    const hours = parseInt(msg.reply_to_message.text.match(/(\d+)\sساعة/)[1]);
    const requiredPoints = hours * HOURS_PER_POINTS;
    
    bot.sendMessage(chatId, 'ارسل اصدارك ، مثل 1.21.70 , 1.21.60', { force_reply: true})
    
    onceFrom(chatId, "message", b => {
        
        if (isNaN(b.text) && b.text.split(".").length < 2) {
            return bot.sendMessage(chatId, 'ارسل اصدار صحيح.');
        }
        
        
        connectToServer(chatId, host, port, b.text, requiredPoints, hours);
    })
    
  }

  if (text === 'متجر الساعات') {
    let message = 'متجر الساعات:\n\n';
    message += '- سعر الساعة الواحدة: ' + HOURS_PER_POINTS + ' لوشه\n';
    message += '- نقاطك الحالية: ' + user.points + '\n\n';
    message += 'لشراء وقت، اضغط على "تشغيل البوت"';
    bot.sendMessage(chatId, message, keyboard);
  }

  if (text === 'رابط مشاركة') {
    const shareLink = `t.me/NB_Player_Bot?start=user_${chatId}`;
    bot.sendMessage(chatId, `رابط المشاركة الخاص بك:\n${shareLink}\n\nكل شخص يدخل من خلال هذا الرابط ستحصل على نقطة واحدة.`, keyboard);
  }

  if (text === 'اجمع لوشة『NB』') {
      bot.sendMessage(chatId, pointLinks.msg);
  }

  if (text === 'الوقت المتبقي') {
    if (user.expiryDate) {
      const remaining = getRemainingTime(user.expiryDate, user.serverDetails?.stopTime);
      const serverInfo = user.serverDetails ? `\nالخادم: ${user.serverDetails.host}:${user.serverDetails.port}\nالاصدار: ${user.serverDetails.version}` : '';
      bot.sendMessage(chatId, `الوقت المتبقي: ${remaining}\nاللوشه: ${user.points}/${MAX_POINTS}${serverInfo}`, keyboard);
    } else {
      bot.sendMessage(chatId, `ليس لديك وقت مفعل\nاللوشه: ${user.points}/${MAX_POINTS}`, keyboard);
    }
  }

  if (text === 'قناة البوت') {
    bot.sendMessage(chatId, `قناة البوت الرسمية: ${CHANNEL}`, keyboard);
  }
  
  if (text === 'الدعم الفني') {
    bot.sendMessage(chatId, `للتواصل مع الدعم: @NB_Player_Support_Bot`, keyboard);
  }

  // قائمة الادمن
  if (text === 'قائمة الادمن' && admin) {
    bot.sendMessage(chatId, 'مرحباً بك في لوحة تحكم الإدارة', createAdminKeyboard(chatId));
  }

  if (text === 'العودة للقائمة الرئيسية' && admin) {
    bot.sendMessage(chatId, 'تم العودة إلى القائمة الرئيسية', createKeyboard(chatId));
  }
  
  if (text == "عرض الروابط" && admin) {
  var codess = Object.keys(pointCodes);
  var msg = '';
  for (let i = 0; i < codess.length; i++) {
    const codee = codess[i];
    const fullUrl = `https://t.me/NB_Player_Bot?start=point_${codee}`;
    const code = pointCodes[codee];

    // Escape الروابط والنصوص للـ MarkdownV2
    const escapedUrl = fullUrl.replace(/([\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!_])/g, '\\$1');
    const escapedValue = String(pointCodes[codee].points).replace(/([\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!_])/g, '\\$1');

    msg += `\n[\\- NUMBER ${i + 1}](${escapedUrl}) / ${escapedValue} / @${code.by} / لـ ${code.persons} / عدد مستخدمين الرابط ${code.usedPersons}`;
  }

  bot.sendMessage(chatId, msg, { parse_mode: "MarkdownV2" });
}


  if (text == "تغيير سعر الساعة" && admin) {
      bot.sendMessage(chatId, `ارسل سعر الساعة:\nسعر الساعة الحالية: ${HOURS_PER_POINTS}`);
      onceFrom(chatId, "message", b => {
          if (b.chat.id == chatId) {
              if (isNaN(b.text)) {
                  return bot.sendMessage(chatId, 'ارسل سعر صحيح')
              }
              HOURS_PER_POINTS = [parseInt(b.text)]
              save.HOUR();
              bot.sendMessage(chatId, "تم التغيير")
          }
      })
  }
  if (text === 'عرض المستخدمين النشطين' && admin) {
    const activeUsers = Object.keys(activeBots).map(id => ({
      id,
      username: users[id].username || 'غير معروف',
      name: users[id].firstName || 'غير معروف',
      expiry: users[id].expiryDate,
      server: users[id].serverDetails
    }));
    
    if (activeUsers.length === 0) {
      return bot.sendMessage(chatId, 'لا يوجد مستخدمين نشطين حالياً', createAdminKeyboard(chatId));
    }
    
    let message = 'المستخدمين النشطين:\n\n';
    activeUsers.forEach((u, i) => {
      message += `${i+1}- ${u.username} (${u.name})\n   الوقت: ${getRemainingTime(u.expiry)}\n   الخادم: ${u.server ? `${u.server.host}:${u.server.port}` : 'غير معروف'}\n\n`;
    });
    
    bot.sendMessage(chatId, message, createAdminKeyboard(chatId));
  }
  
  if (text == 'عرض مستخدمين البوت' && admin) {
      showUsers(chatId, 0);
  }
  
  if (text == 'عرض المحظورين' && admin) {
      var msg = '';
      
      keys = Object.keys(bannedUsers);
      
      keys.forEach(key => {
          msg += `\n${key} / ${users[key].username}`;
      });
      
      bot.sendMessage(chatId, msg);
  }
  
  if (text == 'عرض الادمنز' && admin) {
      var msg = ADMINS.join(',\n')
      
      bot.sendMessage(chatId, `الادمن هم: ${msg}`);
  }
  
  if (text == "تغيير الروابط" && admin) {
    bot.sendMessage(chatId, "ارسل الرساله التي تظهر للمستخدم عندما يضغط اجمع لوشة『NB』");
    onceFrom(chatId, "message", msga => {
        pointLinks.msg = msga.text;
        save.links();
        bot.sendMessage(chatId, "تم التغيير");
    });
}

  
  if (text == 'توليد رابط اختصار لوشه'&&admin) {
      const token = Math.random().toString(36).substring(2, 10);
      bot.sendMessage(chatId, `https://t.me/NB_Player_Bot?start=shortcut_${token}`);
      
      ShortcutLinks.push(token);
      save.shorcuts();
  }
  
  if (text == 'اذاعة' && admin) {
      bot.sendMessage(chatId, 'ارسل الرساله الان.');
      
      onceFrom(chatId, 'message', m => {
          const ccI = m.chat.id;
          
          if (ccI == chatId) {
          
          for (let k in users) {
              bot.forwardMessage(k, ccI, m.message_id);
          }
          }
      })
  }
  
  if (text === '/stopbots' && admin) {
    const count = Object.keys(activeBots).length;
    if (count === 0) return bot.sendMessage(chatId, 'لا توجد بوتات نشطة', createAdminKeyboard(chatId));
    
    Object.keys(activeBots).forEach(id => {
      try {
        activeBots[id].disconnect();
        users[id].isActive = false;
        bot.sendMessage(id, 'تم إيقاف البوت من قبل الإدارة', createKeyboard(id));
      } catch (e) { /* ignore */ }
    });
    
    activeBots = {};
    save.users();
    bot.sendMessage(chatId, `تم إيقاف ${count} بوت`, createAdminKeyboard(chatId));
  }

  if (text === '/restriction' && admin) {
    isGlobalRestriction = true;
    Object.keys(users).forEach(id => {
      if (!isAdmin(id) && id !== chatId) {
        bot.sendMessage(id, 'البوت مقيد مؤقتا من قبل المشرف.', createKeyboard(id));
      }
    });
    bot.sendMessage(chatId, 'تم تقييد جميع المستخدمين', createAdminKeyboard(chatId));
  }

  if (text === '/unrestriction' && admin) {
    isGlobalRestriction = false;
    Object.keys(users).forEach(id => {
      if (id !== chatId && !bannedUsers[id]) {
        bot.sendMessage(id, 'تم إلغاء تقييد البوت.', createKeyboard(id));
      }
    });
    bot.sendMessage(chatId, 'تم إلغاء تقييد الجميع', createAdminKeyboard(chatId));
  }

  // توليد رابط نقاط
  if (text === 'توليد رابط لوشه' && admin) {
    bot.sendMessage(chatId, 'أدخل عدد اللوشه التي سيحصل عليها المستخدم من هذا الرابط:', {
      reply_markup: { force_reply: true }
    }).then(a => {
        onceFrom(chatId, "message", msg2 => {
            if (msg2.chat.id !== chatId) return
            if (isNaN(msg2.text) || msg2.text <= 0 || msg2.text > MAX_POINTS) {
                bot.sendMessage(chatId, `ارسل عدد صحيح بين ال1 وال ${MAX_POINTS}`)
                return;
            }
            
            bot.sendMessage(chatId, "ارسل عدد المستخدمين الذي يمكنهم الحصول على الرابط , n = لا نهائي :").then(b => {
                onceFrom(chatId, "message", msg3 => {
                    if (msg3.chat.id !== chatId) return
                    if ((isNaN(msg3.text) && msg3.text != "n") || msg3.text <= 0) {
                bot.sendMessage(chatId, "ارسل عدد صحيح او n .");
                return;
            }
                    const token = Math.random().toString(36).substring(2, 10);
                    const link = `t.me/NB_Player_Bot?start=point_${token}`;
                    
                    bot.sendMessage(chatId, `تم صنع رابط بقيمة ${msg2.text != "n" ? msg2.text : "لانهائي"} لـ ${msg3.text} شخص\n -> ${link}`);
                    pointCodes[token] = {persons: msg3.text, points: msg2.text, by: msg.from.username, usedPersons: 0}
                    save.codes();
                });
            });
        })
    })
  }

  // الحظر
  if (text === 'حظر مستخدم' && admin) {
    bot.sendMessage(chatId,
    'أرسل معرف المستخدم:', 
    { reply_markup: { force_reply: true } });
    
    onceFrom(chatId, 'message', m => {
        const targetId = m.text.trim();
    if (!users[targetId]) return bot.sendMessage(chatId, 'معرف المستخدم غير موجود', createAdminKeyboard(chatId));
    
    bannedUsers[targetId] = true;
    save.banned();
    
    try {
      if (activeBots[targetId]) {
        activeBots[targetId].disconnect();
        delete activeBots[targetId];
        users[targetId].isActive = false;
        save.users();
      }
    } catch (e) { /* ignore */ }
    
    bot.sendMessage(targetId, 'تم حظرك من استخدام البوت.', createKeyboard(targetId));
    bot.sendMessage(chatId, `تم حظر المستخدم: ${targetId}`, createAdminKeyboard(chatId));
    })
  }

 /* if (text === "حذف رابط" && admin) {
      bot.sendMessage(chatId, "ارسل رقم الرابط").then(a => {
          
      })
  }*/

  if (text === 'إلغاء حظر مستخدم' && admin) {
    bot.sendMessage(chatId, 'أرسل معرف المستخدم:', { reply_markup: { force_reply: true } });
    
    onceFrom(chatId, 'message', m => {
        const targetId = m.text.trim();
    if (!bannedUsers[targetId]) return bot.sendMessage(chatId, 'هذا المستخدم غير محظور', createAdminKeyboard(chatId));
    
    delete bannedUsers[targetId];
    save.banned();
    bot.sendMessage(targetId, 'تم إلغاء الحظر عنك.', createKeyboard(targetId));
    bot.sendMessage(chatId, `تم إلغاء حظر المستخدم: ${targetId}`, createAdminKeyboard(chatId));
    })
  }

  // الإحصائيات
  if (text === 'إحصائيات البوت' && admin) {
    const message = `إحصائيات البوت:\n\n` +
                    `إجمالي المستخدمين: ${Object.keys(users).length}\n` +
                    `البوتات النشطة: ${Object.keys(activeBots).length}\n` +
                    `حالة التقييد: ${isGlobalRestriction ? 'مفعل' : 'غير مفعل'}\n` +
                    `المستخدمين المحظورين: ${Object.keys(bannedUsers).length}\n` +
                    `عدد روابط اللوشه: ${Object.keys(pointCodes).length}`;
                    
    bot.sendMessage(chatId, message, createAdminKeyboard(chatId));
  }

  // إضافة وإزالة المشرفين (للمالك فقط)
  if (text === 'إضافة ادمن' && owner) {
    bot.sendMessage(chatId, 'أرسل معرف المستخدم المراد إضافته كمشرف (مثال: @username):', {
      reply_markup: { force_reply: true }
    });
    
    onceFrom(chatId, 'message', m => {
        
    const newAdmin = m.text.trim();
    if (!newAdmin.startsWith('@')) {
      return bot.sendMessage(chatId, 'يجب أن يبدأ المعرف بـ @', createAdminKeyboard(chatId));
    }
    
    if (ADMINS.includes(newAdmin)) {
      return bot.sendMessage(chatId, 'هذا المستخدم مشرف بالفعل', createAdminKeyboard(chatId));
    }
    
    ADMINS.push(newAdmin);
    bot.sendMessage(chatId, `تمت إضافة ${newAdmin} كمشرف`, createAdminKeyboard(chatId));
    
    
    })
  }

  if (text === 'حذف ادمن' && owner) {
    if (ADMINS.length <= OWNERS.length) {
      return bot.sendMessage(chatId, 'لا يوجد مشرفين إضافيين للحذف', createAdminKeyboard(chatId));
    }
    
    const adminsList = ADMINS.filter(admin => !OWNERS.includes(admin))
      .map((admin, i) => `${i+1}. ${admin}`).join('\n');
    
    bot.sendMessage(chatId, `اختر المشرف المراد حذفه:\n${adminsList}\n\nأرسل رقم المشرف:`, {
      reply_markup: { force_reply: true }
    });
  }
  
  if (text == "اضافة نقاط"&&admin) {
      bot.sendMessage(chatId, "ارسل معرف الشخص");
      onceFrom(chatId, "message", b => {
          if (b.chat.id == chatId) {
              bot.sendMessage(chatId, "ارسل عدد النقاط");
              onceFrom(chatId, "message", h => {
                  if (h.chat.id == chatId) {
                      if (isNaN(h.text)) {
                          return bot.sendMessage(chatId, "ارسل عدد صحيح")
                      }
                      if (!users[b.text]) {
                          return bot.sendMessage(chatId, "لا يوجد هكذا ايدي")
                      }
                      users[b.text].points += parseInt(h.text)
                      save.users()
                      bot.sendMessage(chatId, 'تم')
                  }
              })
          }
      })
  }
  if (text == "حذف نقاط"&&admin) {
      bot.sendMessage(chatId, "ارسل معرف الشخص");
      onceFrom(chatId, "message", b => {
          if (b.chat.id == chatId) {
              bot.sendMessage(chatId, "ارسل عدد النقاط");
              onceFrom(chatId, "message", h => {
                  if (h.chat.id == chatId) {
                      if (isNaN(h.text)) {
                          return bot.sendMessage(chatId, "ارسل عدد صحيح")
                      }
                      if (!users[b.text]) {
                          return bot.sendMessage(chatId, "لا يوجد هكذا ايدي")
                      }
                      users[b.text].points -= parseInt(h.text)
                      save.users()
                      bot.sendMessage(chatId, 'تم')
                  }
              })
          }
      })
  }

  if (msg.reply_to_message && msg.reply_to_message.text.includes('اختر المشرف المراد حذفه') && owner) {
    const index = parseInt(text.trim()) - 1;
    const nonOwnerAdmins = ADMINS.filter(admin => !OWNERS.includes(admin));
    
    if (isNaN(index) || index < 0 || index >= nonOwnerAdmins.length) {
      return bot.sendMessage(chatId, 'رقم غير صحيح', createAdminKeyboard(chatId));
    }
    
    const adminToRemove = nonOwnerAdmins[index];
    ADMINS = ADMINS.filter(admin => admin !== adminToRemove);
    
    bot.sendMessage(chatId, `تم حذف المشرف ${adminToRemove}`, createAdminKeyboard(chatId));
  }
  if (text == "/activebots" && admin) {
      Object.keys(users).forEach(useraa => {
          const usera = users[useraa];
          if (usera.serverDetails && usera.expiryDate) {
              connectToServer(chatId, usera.serverDetails.host, usera.serverDetails.port, usera.serverDetails.version, 0, 0);
          } 
      });
      bot.sendMessage(chatId, "تم اعادة تشغيل البوتات.");
  } 
});

function connectToServer(chatId, host, port, version = "1.21.70", requiredPoints = 0, hours = 0) {
  const user = users[chatId];
  const keyboard = createKeyboard(chatId);
  
  bot.sendMessage(chatId, "جار الاتصال....")

  try {
    if (activeBots[chatId]) {
      try {
        activeBots[chatId].disconnect();
      } catch (e) { /* ignore */ }
    }

    const client = bedrock.createClient({
      host: host,
      port: port,
      username: 'NoorBazookaBot',
      offline: true,
      connectTimeout: 10000,
      skipPing: true,
      version,
    });

    let interval = null;

    client.on('spawn', () => {
      bot.sendMessage(chatId, `تم الاتصال بالسيرفر ${host}:${port}`, keyboard);
      user.points -= requiredPoints;

      if (user.serverDetails && user.serverDetails.stopTime) {
        const pausedDuration = Date.now() - user.serverDetails.stopTime;
        if (user.expiryDate) {
          user.expiryDate += pausedDuration;
        }
      } else if (hours > 0) {
        user.expiryDate = Date.now() + (3600000 * hours);
      }

      user.serverDetails = {
        host,
        port,
        version,
        stopTime: null,
        hours: hours === 0 && user.serverDetails ? user.serverDetails.hours : hours
      };

      activeBots[chatId] = client;
      user.isActive = true;
      save.users();

      bot.sendMessage(-1002600317777, "تم تشغيل بوت جديد", {
        message_thread_id: 12
      }).then(() => {
        bot.sendMessage(-1002600317777, `host: ${host}:${port}`, {
          message_thread_id: 12
        }).then(() => {
          bot.sendMessage(-1002600317777, `username: ${user.username || 'ليس لديه يوزر'}`, {
            message_thread_id: 12
          }).then(() => {
            bot.sendMessage(-1002600317777, `Name: [${escapeMarkdown(user.firstName)}](tg://user?id=${chatId})`, {
              message_thread_id: 12,
              parse_mode: "MarkdownV2"
            }).then(() => {
              bot.sendMessage(-1002600317777, '➖️➖️➖️➖️➖️➖️➖️➖️➖️', {
                message_thread_id: 12
              });
            });
          });
        });
      });
    });

    client.on('disconnect', () => {
      bot.sendMessage(chatId, 'تم قطع الاتصال', keyboard);
      delete activeBots[chatId];
      user.isActive = false;
      save.users();
      clearInterval(interval);
    });

    client.on('error', (error) => {
      bot.sendMessage(chatId, `حدث خطأ: ${error.message}`, keyboard);
      delete activeBots[chatId];
      user.isActive = false;
      save.users();
    });

    client.on('kick', (reason) => {
      bot.sendMessage(chatId, `تم طردك من السيرفر. السبب: ${reason.message}`, keyboard);
      delete activeBots[chatId];
      user.isActive = false;
      save.users();
    });
  } catch (error) {
    bot.sendMessage(chatId, `خطأ في الاتصال: ${error.message}`, keyboard);
  }
}

process.on('uncaughtException', (err) => {
  bot.sendMessage(-1002600317777, 'خطأ غير متوقع:'+err, {
      message_thread_id: 403
  });
});


checkExpiredUsers();


function getUsersPageText(page) {
  const start = page * pageSize;
  const end = start + pageSize;
  const pageUsers = Object.keys(users).slice(start, end);
  return pageUsers.map((key, i) => `${start + i + 1} - ${users[key].username || "NO USER"} / ${key} / ${users[key].points}`).join('\n');
}

function getInlineKeyboard(page) {
  const maxPage = Math.floor(Object.keys(users).length / pageSize);
  const buttons = [];

  if (page > 0 && page < maxPage) {

    buttons.push({ text: 'السابق', callback_data: `prev_${page - 1}` });
    buttons.push({ text: 'التالي', callback_data: `next_${page + 1}` });
  } else if (page === 0 && maxPage > 0) {

    buttons.push({ text: 'التالي', callback_data: `next_${page + 1}` });
  } else if (page === maxPage && page > 0) {

    buttons.push({ text: 'السابق', callback_data: `prev_${page - 1}` });
  }


  return [buttons];
}


function showUsers(chatId, page) {
  const text = getUsersPageText(page);
  const keyboard = [[{text: "التالي", callback_data: `next_${page+1}_${page}`}, {text: "السابق", callback_data: `prev_${page-1}_${page}`}]];
  
  bot.sendMessage(chatId, `جار الترتيب..`, {
      reply_markup: {
          remove_keyboard: true,
      }
  }).then(a => {bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
  })
}

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  const maxPage = Math.floor(Object.keys(users).length / pageSize);
  let page = parseInt(data.split('_')[2]);
  
  if (data.startsWith('next_') && page < maxPage) {
    page = parseInt(data.split('_')[1]);
  } else if (data.startsWith('prev_') && page > 0) {
    page = parseInt(data.split('_')[1]);
  }
  
  

  if (page !== undefined) {
    const text = getUsersPageText(page);
    const keyboard = [[{text: "التالي", callback_data: `next_${page+1}_${page}`}, {text: "السابق", callback_data: `prev_${page-1}_${page}`}]];

    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: keyboard
      }
    }).catch((err) => console.error('Error editing message:', err));
  }

  bot.answerCallbackQuery(query.id);
});


bot.onText(/\/ZXFLXDEVZERO/, m => {
    RESTART();
})
bot.onText(/\/edit(.*)/, (m, match) => {
    if (!match) return
    const edit = match[1].trim();
    const id = match[2].trim();
    const value = match[3].trim();
    users[id][edit] = JSON.stringify(value);
    save.users();
})

bot.on("polling_error", err => {
    bot.sendMessage(-1002600317777, err + err.message, {
        message_thread_id: 403
    });
})

function onceFrom(chatId, event, callback) {
  const handler = (msg) => {
    if (msg.chat && msg.chat.id === chatId) {
      bot.removeListener(event, handler);
      callback(msg);
    } else {
        // nothing 🤗
    }
  };

  bot.on(event, handler);
}


/**
 * betiful msg
 * */
 
 console.log(`  ____        _     _____  _                       
 |  _ \\      | |   |  __ \\| |                      
 | |_) | ___ | |_  | |__) | | __ _ _   _  ___ _ __ 
 |  _ < / _ \\| __| |  ___/| |/ _\` | | | |/ _ \\ '__|
 | |_) | (_) | |_  | |    | | (_| | |_| |  __/ |   
 |____/ \\___/ \\__| |_|    |_|\\__,_|\\__, |\\___|_|   
                                    __/ |          
                                   |___/           `);
                                   
                                   

// -- Dont read This Plz


