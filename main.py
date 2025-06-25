from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackContext
import requests, datetime, asyncio

# بيانات مهمة
BOT_TOKEN = "7648520314:AAGF3kQRZbQ79sy0KAerMreNgTpby34tosc"
DEVELOPER_IDS = [6552765221, 7220328982]
CHANNELS = ["@nuu42", "@AliveCafe646"]

# قواعد البيانات البسيطة (مؤقتًا بالذاكرة)
CODES = {"hakil": 5, "gold24": 24, "silver10": 10}
ACTIVE_USERS = {}  # user_id: {"ff_id": ..., "expires": datetime}
GROUPS = set()

# /start
async def start(update: Update, context: CallbackContext):
    user = update.effective_user
    await update.message.reply_html(
        f"👋 مرحبًا {user.mention_html()}!\n\n"
        f"🎯 يوزرك: @{user.username or 'لا يوجد'}\n🆔 آيديك: {user.id}\n"
        "📎 اضغط /help لعرض الأوامر"
    )

# /help
async def help_command(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    for ch in CHANNELS:
        try:
            member = await context.bot.get_chat_member(ch, user_id)
            if member.status in ["left", "kicked"]:
                raise Exception()
        except:
            await update.message.reply_text(
                "📛 يجب الاشتراك في القنوات التالية أولاً:",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("✅ تحقق", callback_data="verify")]
                ])
            )
            return

    msg = "🧾 الأوامر العامة:\n"
    msg += "/add <id> <code> <مدة>\n"
    msg += "/list - الوقت المتبقي\n"
    if user_id in DEVELOPER_IDS:
        msg += "\n👑 أوامر المطور:\n"
        msg += "/newcod <code> <مدة>\n/user\n/ramved\n/setgrop"
    msg += "\n\n💰 للشراء تواصل مع @k_wro"
    await update.message.reply_text(msg)

# /add id code مدة
async def add(update: Update, context: CallbackContext):
    args = context.args
    user_id = update.effective_user.id
    if len(args) != 3:
        return await update.message.reply_text("❗️الاستخدام: /add <id> <code> <مدة>")
    ff_id, code, dur = args
    if code not in CODES:
        return await update.message.reply_text("❌ كود خاطئ")
    jwt = requests.get("https://aditya-jwt-v9op.onrender.com/token?uid=3966541351&password=92E4370C24915AA8DB8D15ABBC9876912F7A2140C773796C7ECC66259B264FF3").json()["token"]
    requests.get(f"https://fox-freefire-apis.vercel.app/adding_friend?token={jwt}&id={ff_id}")
    expire_time = datetime.datetime.now() + datetime.timedelta(hours=int(dur))
    ACTIVE_USERS[user_id] = {"ff_id": ff_id, "expires": expire_time}
    await update.message.reply_text("✅ تم إرسال طلب الصداقة، وسيتم الحذف عند انتهاء المدة.")

# /list
async def list_ids(update: Update, context: CallbackContext):
    user_id = update.effective_user.id
    if user_id not in ACTIVE_USERS:
        return await update.message.reply_text("⛔️ لا يوجد حسابات مفعلة.")
    info = ACTIVE_USERS[user_id]
    remaining = info["expires"] - datetime.datetime.now()
    await update.message.reply_text(f"⏳ تبقى: {remaining}")

# /newcod code مدة
async def newcod(update: Update, context: CallbackContext):
    if update.effective_user.id not in DEVELOPER_IDS:
        return
    if len(context.args) != 2:
        return await update.message.reply_text("❗️ /newcod <code> <مدة>")
    code, dur = context.args
    CODES[code] = int(dur)
    await update.message.reply_text(f"✅ تم إضافة الكود: {code} لمدة {dur} ساعة")

# /user
async def user_list(update: Update, context: CallbackContext):
    if update.effective_user.id not in DEVELOPER_IDS:
        return
    if not ACTIVE_USERS:
        return await update.message.reply_text("لا يوجد مستخدمين مفعّلين.")
    msg = ""
    for uid, v in ACTIVE_USERS.items():
        msg += f"👤 ID: {uid}, FF: {v['ff_id']}, ينتهي: {v['expires']}\n"
    await update.message.reply_text(msg)

# /ramved
async def ramved(update: Update, context: CallbackContext):
    if update.effective_user.id not in DEVELOPER_IDS:
        return
    jwt = requests.get("https://aditya-jwt-v9op.onrender.com/token?uid=3966541351&password=92E4370C24915AA8DB8D15ABBC9876912F7A2140C773796C7ECC66259B264FF3").json()["token"]
    for data in ACTIVE_USERS.values():
        requests.get(f"https://aditya-jwt-v9op.onrender.com/remove_friend?uid={data['ff_id']}&token={jwt}")
    ACTIVE_USERS.clear()
    await update.message.reply_text("✅ تم حذف جميع الأصدقاء.")

# /setgrop
async def setgrop(update: Update, context: CallbackContext):
    if update.effective_user.id not in DEVELOPER_IDS:
        return
    GROUPS.add(update.effective_chat.id)
    await update.message.reply_text("✅ تم تفعيل البوت في هذه المجموعة.")

# بداية التشغيل
def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("add", add))
    app.add_handler(CommandHandler("list", list_ids))
    app.add_handler(CommandHandler("newcod", newcod))
    app.add_handler(CommandHandler("user", user_list))
    app.add_handler(CommandHandler("ramved", ramved))
    app.add_handler(CommandHandler("setgrop", setgrop))
    app.run_polling()

if __name__ == "__main__":
    main()
