// ─── Планировщик: автопостинг в канал + авторассылка ─────────────────────────
const CHANNEL = '@kanalKursov7';

// Контент для автопостинга в канал (ротация по кругу)
const CHANNEL_POSTS = [
  {
    text: `🔥 *ТОП оффер недели!*\n\n` +
      `🤖 *Курс «ChatGPT для бизнеса»*\n\n` +
      `Научись зарабатывать с помощью ИИ!\n` +
      `💰 Комиссия партнёрам: 45%\n` +
      `📈 Тысячи людей уже прошли курс\n\n` +
      `👇 Узнай подробности в боте:`,
    button: { text: '🚀 Узнать подробности', url: 'https://t.me/kurs7botikov_bot' }
  },
  {
    text: `💡 *Знаешь как зарабатывать рекомендуя курсы?*\n\n` +
      `Это называется партнёрский маркетинг!\n\n` +
      `✅ Не нужен свой продукт\n` +
      `✅ Работает 24/7 без тебя\n` +
      `✅ Комиссии до 60% с продажи\n\n` +
      `Я уже собрала лучшие офферы — жми:`,
    button: { text: '📚 Смотреть офферы', url: 'https://t.me/kurs7botikov_bot' }
  },
  {
    text: `🎁 *Бесплатные курсы — это реально!*\n\n` +
      `Собрала для тебя подборку обучений, где:\n\n` +
      `✍️ Копирайтинг — первые 3 урока бесплатно\n` +
      `🤖 ИИ инструменты — 3-дневный марафон\n` +
      `💰 Заработок онлайн — вебинар бесплатно\n\n` +
      `Получи доступ прямо сейчас:`,
    button: { text: '🎁 Получить бесплатно', url: 'https://t.me/kurs7botikov_bot' }
  },
  {
    text: `📊 *Реальные цифры партнёрского маркетинга:*\n\n` +
      `💵 Курс за 12 900₽ → твоя комиссия *4 515₽*\n` +
      `💵 Курс за 5 900₽ → твоя комиссия *2 360₽*\n` +
      `💵 Бесплатный вебинар → *500₽* за регистрацию\n\n` +
      `Один человек = одна ссылка = реальные деньги 💸\n\n` +
      `Хочешь так же? Старт здесь:`,
    button: { text: '💰 Начать зарабатывать', url: 'https://t.me/kurs7botikov_bot' }
  },
  {
    text: `🏆 *Лучшие ниши для партнёрок в 2025:*\n\n` +
      `1️⃣ Онлайн-образование (САЛИД)\n` +
      `2️⃣ Здоровье и похудение\n` +
      `3️⃣ ИИ инструменты и ChatGPT\n` +
      `4️⃣ Заработок в интернете\n` +
      `5️⃣ Психология и отношения\n\n` +
      `Все эти офферы уже собраны для тебя 👇`,
    button: { text: '🎯 Смотреть все офферы', url: 'https://t.me/kurs7botikov_bot' }
  },
  {
    text: `⏰ *Утренняя мотивация!*\n\n` +
      `Пока ты спишь — партнёрские ссылки работают.\n` +
      `Пока ты отдыхаешь — комиссии капают.\n\n` +
      `Это и есть пассивный доход 🌙\n\n` +
      `Начни сегодня — поставь первую ссылку:`,
    button: { text: '🚀 Начать прямо сейчас', url: 'https://t.me/kurs7botikov_bot' }
  },
  {
    text: `📣 *Бесплатные способы продвигать партнёрки:*\n\n` +
      `• ВКонтакте — пост с личной историей\n` +
      `• Одноклассники — огромная аудитория 35+\n` +
      `• Telegram чаты — тематические группы\n` +
      `• YouTube Shorts — 60-секундное видео\n` +
      `• Reels — охваты без бюджета\n\n` +
      `Офферы для продвижения уже готовы:`,
    button: { text: '📋 Взять офферы', url: 'https://t.me/kurs7botikov_bot' }
  },
];

// Авторассылка по пользователям (еженедельно)
const WEEKLY_BROADCASTS = [
  `🌟 *Привет! Алиса Бойчук на связи*\n\n` +
  `На этой неделе горячий оффер — курс по ChatGPT.\n` +
  `Комиссия 45%, спрос огромный!\n\n` +
  `Открой бота и забери ссылку 👇`,

  `💰 *Напоминаю — ты в шаге от заработка!*\n\n` +
  `Одна партнёрская ссылка может принести тебе\n` +
  `от 500 до 4 500₽ с одного человека.\n\n` +
  `Не откладывай — заходи и выбирай оффер:`,

  `🎯 *Новая неделя — новые возможности!*\n\n` +
  `Обновила подборку офферов.\n` +
  `Добавила бесплатные курсы с высокой конверсией.\n\n` +
  `Заходи, смотри, зарабатывай 🚀`,

  `🤝 *Реферальная программа работает!*\n\n` +
  `Уже ${Math.floor(Math.random() * 50) + 10} человек получили бонусы\n` +
  `за приглашение друзей в бот.\n\n` +
  `Ты уже поделился своей ссылкой? Если нет — самое время!`,
];

class Scheduler {
  constructor(telegram, db) {
    this.telegram = telegram;
    this.db = db;
    this.postIndex = 0;
    this.broadcastIndex = 0;
  }

  start() {
    this._scheduleChannelPosts();
    this._scheduleWeeklyBroadcast();
    this._scheduleDailyBroadcast();
    console.log('📅 Планировщик запущен');
  }

  // Пост в канал каждые 12 часов
  _scheduleChannelPosts() {
    const INTERVAL = 12 * 60 * 60 * 1000; // 12 часов

    const postNow = async () => {
      try {
        const post = CHANNEL_POSTS[this.postIndex % CHANNEL_POSTS.length];
        await this.telegram.sendMessage(CHANNEL, post.text, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: post.button.text, url: post.button.url }]]
          }
        });
        this.postIndex++;
        console.log(`📢 Пост в канал отправлен (${this.postIndex})`);
      } catch (e) {
        console.error('Ошибка автопостинга:', e.message);
      }
    };

    // Первый пост через 10 минут после старта
    setTimeout(postNow, 10 * 60 * 1000);
    // Потом каждые 12 часов
    setInterval(postNow, INTERVAL);
  }

  // Еженедельная рассылка по пользователям (каждое воскресенье в 10:00)
  _scheduleWeeklyBroadcast() {
    const checkAndSend = async () => {
      const now = new Date();
      // Воскресенье = 0, 10:00
      if (now.getDay() === 0 && now.getHours() === 10 && now.getMinutes() === 0) {
        await this._sendBroadcast(
          WEEKLY_BROADCASTS[this.broadcastIndex % WEEKLY_BROADCASTS.length],
          '📅 Еженедельная рассылка'
        );
        this.broadcastIndex++;
      }
    };
    setInterval(checkAndSend, 60 * 1000);
  }

  // Ежедневный пост в канал с полезным контентом (каждый день в 09:00)
  _scheduleDailyBroadcast() {
    const checkAndSend = async () => {
      const now = new Date();
      if (now.getHours() === 9 && now.getMinutes() === 0) {
        try {
          const tips = [
            `☀️ *Доброе утро!*\n\nСовет дня: поделись партнёрской ссылкой в одной группе ВКонтакте — это займёт 2 минуты и может принести продажу 💰`,
            `☀️ *Доброе утро!*\n\nСовет дня: напиши пост с личной историей об онлайн-обучении. Люди доверяют личному опыту больше, чем рекламе 📖`,
            `☀️ *Доброе утро!*\n\nСовет дня: сними короткое Reels или Shorts на тему «Как я зарабатываю на рекомендациях». Это бесплатный трафик! 🎬`,
            `☀️ *Доброе утро!*\n\nСовет дня: попроси 3 друзей зарегистрироваться по твоей реферальной ссылке. Это абсолютно бесплатно для них! 🤝`,
            `☀️ *Доброе утро!*\n\nСовет дня: ответь на 5 вопросов в тематических Telegram-чатах и оставь ссылку на бота. Помогаешь людям — и получаешь трафик! 💡`,
            `☀️ *Доброе утро!*\n\nСовет дня: обнови статус в WhatsApp/ВКонтакте со ссылкой на бота. Твои контакты увидят его бесплатно! 📱`,
            `☀️ *Доброе утро!*\n\nСовет дня: проверь статистику в /admin — узнай какой оффер кликают чаще и сделай на него акцент сегодня! 📊`,
          ];
          const tip = tips[new Date().getDay()];
          await this.telegram.sendMessage(CHANNEL, tip, { parse_mode: 'Markdown' });
          console.log('☀️ Утренний пост отправлен');
        } catch (e) {
          console.error('Ошибка утреннего поста:', e.message);
        }
      }
    };
    setInterval(checkAndSend, 60 * 1000);
  }

  // Отправка рассылки всем активным пользователям
  async _sendBroadcast(text, label) {
    try {
      const users = await this.db.getAllUsers(true);
      let sent = 0, failed = 0;
      for (const user of users) {
        try {
          await this.telegram.sendMessage(user.id, text, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '🚀 Открыть бота', url: 'https://t.me/kurs7botikov_bot' }]]
            }
          });
          sent++;
          await new Promise(r => setTimeout(r, 50));
        } catch (e) {
          failed++;
          if (e.code === 403) await this.db.markUserBlocked(user.id);
        }
      }
      console.log(`${label}: отправлено ${sent}, ошибок ${failed}`);
    } catch (e) {
      console.error('Ошибка рассылки:', e.message);
    }
  }

  // Ручной запуск рассылки из админки
  async sendManualBroadcast(text) {
    await this._sendBroadcast(text, '📢 Ручная рассылка');
  }
}

module.exports = Scheduler;
