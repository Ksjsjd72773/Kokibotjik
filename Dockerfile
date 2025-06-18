# استخدم نسخة Node
FROM node:18

# إعداد مجلد العمل داخل الحاوية
WORKDIR /app

# نسخ الملفات إلى الحاوية
COPY . .

# تثبيت التبعيات
RUN npm install

# تشغيل البوت
CMD ["npm", "start"]
