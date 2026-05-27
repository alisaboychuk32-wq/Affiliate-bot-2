const { Markup } = require('telegraf');

// ──────────────────────────────────────────────────────────────────────────────
// ОФФЕРЫ: САЛИД (salid.ru) + ИнфоХит (ihclick.ru)
// Замените YOUR_REF_LINK на реальные партнёрские ссылки из кабинета
// ──────────────────────────────────────────────────────────────────────────────
const OFFERS = {
  // САЛИД офферы (замените ссылки на ваши из salid.ru/?w=973405)
  salid_1: {
    id: 'salid_1',
    name: '🎓 Курс «Профессия Копирайтер»',
    source: 'САЛИД',
    price: '5 900 ₽',
    commission: '40%',
    earnings: '2 360 ₽',
    description: 'Топовый курс по копирайтингу — горячий спрос, высокая конверсия. Подходит любой аудитории.',
    emoji: '✍️',
    url: 'https://salid.ru/?w=973405', // замените на реальный deeplink оффера
    tags: ['онлайн', 'профессия', 'удалёнка'],
  },
  salid_2: {
    id: 'salid_2',
    name: '📊 Курс «Таргетолог с нуля»',
    source: 'САЛИД',
    price: '12 900 ₽',
    commission: '35%',
    earnings: '4 515 ₽',
    description: 'Научат настраивать рекламу ВКонтакте и Telegram. Актуальная профессия 2025.',
    emoji: '🎯',
    url: 'https://salid.ru/?w=973405',
    tags: ['реклама', 'SMM', 'фриланс'],
  },
  salid_3: {
    id: 'salid_3',
    name: '💆 Курс «Психология отношений»',
    source: 'САЛИД',
    price: '3 500 ₽',
    commission: '60%',
    earnings: '2 100 ₽',
    description: 'Вечная тема — высокий спрос, отличная конверсия. Комиссия до 60%.',
    emoji: '❤️',
    url: 'https://salid.ru/?w=973405',
    tags: ['психология', 'саморазвитие', 'отношения'],
  },
  salid_4: {
    id: 'salid_4',
    name: '💰 Бесплатный вебинар «Заработок в интернете»',
    source: 'САЛИД',
    price: 'БЕСПЛАТНО',
    commission: '500 ₽ за регистрацию',
    earnings: '500 ₽',
    description: 'Продвигать проще всего — бесплатно для пользователя. Платят за каждую регистрацию.',
    emoji: '🆓',
    url: 'https://salid.ru/?w=973405',
    tags: ['бесплатно', 'заработок', 'вебинар'],
    hot: true,
  },

  // ИнфоХит офферы (замените ссылки из ihclick.ru/?idp=326805)
  ih_1: {
    id: 'ih_1',
    name: '🧘 Курс «Похудение без диет»',
    source: 'ИнфоХит',
    price: '2 990 ₽',
    commission: '50%',
    earnings: '1 495 ₽',
    description: 'Вечнозелёная ниша здоровья. Огромная аудитория, стабильные продажи.',
    emoji: '🥗',
    url: 'https://ihclick.ru/?idp=326805&link=/',
    tags: ['здоровье', 'похудение', 'женская аудитория'],
  },
  ih_2: {
    id: 'ih_2',
    name: '🤖 Курс «ChatGPT для бизнеса»',
    source: 'ИнфоХит',
    price: '4 900 ₽',
    commission: '45%',
    earnings: '2 205 ₽',
    description: 'Хайповая тема ИИ — огромный спрос в 2025. Продаётся сам.',
    emoji: '🤖',
    url: 'https://ihclick.ru/?idp=326805&link=/',
    tags: ['ИИ', 'технологии', 'бизнес'],
    hot: true,
  },
  ih_3: {
    id: 'ih_3',
    name: '📸 Курс «Заработок на Reels»',
    source: 'ИнфоХит',
    price: '1 990 ₽',
    commission: '55%',
    earnings: '1 095 ₽',
    description: 'Актуально в 2025. Аудитория — все кто хочет монетизировать контент.',
    emoji: '🎬',
    url: 'https://ihclick.ru/?idp=326805&link=/',
    tags: ['контент', 'SMM', 'заработок'],
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Последовательности прогрева (warmup)
// ──────────────────────────────────────────────────────────────────────────────
const WARMUP_MESSAGES = [
  // Шаг 0: через 1 час
  {
    text: `⏰ Привет! Это я снова 👋\n\nЯ хотела убедиться, что ты нашёл то, что искал.\n\n` +
      `💡 Кстати, вот мой *личный ТОП* — бесплатные курсы, после которых реально можно зарабатывать:\n\n` +
      `👉 Просто нажми кнопку ниже — это бесплатно!`,
    buttons: [
      [Markup.button.callback('🎁 Получить бесплатные курсы', 'free_courses')],
      [Markup.button.callback('📚 Все офферы', 'top_salid')],
    ]
  },
  // Шаг 1: через 24 часа
  {
    text: `📣 Поделюсь секретом...\n\n` +
      `Я зарабатываю на партнёрках, рекомендуя курсы друзьям и подписчикам.\n\n` +
      `Например: один человек купил курс по 12 000 ₽ → я получила *4 200 ₽* за 1 ссылку 💸\n\n` +
      `Хочешь так же? Вот самые прибыльные офферы прямо сейчас 👇`,
    buttons: [
      [Markup.button.callback('💰 Топ прибыльных офферов', 'top_salid')],
      [Markup.button.callback('🤖 ИнфоХит офферы', 'infohit_offers')],
    ]
  },
  // Шаг 2: через 72 часа
  {
    text: `🔥 Последнее напоминание!\n\n` +
      `Сегодня хочу рассказать про *реферальную программу*.\n\n` +
      `Ты можешь приглашать друзей в этого бота и получать бонусы за каждого!\n\n` +
      `Это абсолютно бесплатный способ получить дополнительный трафик на офферы 🚀`,
    buttons: [
      [Markup.button.callback('🤝 Реферальная ссылка', 'referral')],
      [Markup.button.callback('🏠 Главное меню', 'main_menu')],
    ]
  }
];

class Funnel {
  constructor(db, channel) {
    this.db = db;
    this.channel = channel;
  }

  // ─── Проверка подписки ──────────────────────────────────────────────────────
  async checkSubscription(ctx, userId) {
    try {
      const member = await ctx.telegram.getChatMember(this.channel, userId);
      return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (e) {
      return false;
    }
  }

  // ─── Шлюз подписки ──────────────────────────────────────────────────────────
  async sendSubscribeGate(ctx) {
    const text =
      `👋 Привет, ${ctx.from.first_name}!\n\n` +
      `Я — бот Алисы Бойчук 🦊\n\n` +
      `Здесь ты найдёшь:\n` +
      `✅ Бесплатные курсы для старта\n` +
      `✅ Проверенные офферы с комиссией до 100%\n` +
      `✅ Инструменты для заработка на партнёрках\n\n` +
      `📢 Чтобы получить доступ — подпишись на канал:`;

    await ctx.replyWithHTML(text, {
      ...Markup.inlineKeyboard([
        [Markup.button.url(`📢 Подписаться на канал`, `https://t.me/kanalKursov7`)],
        [Markup.button.callback('✅ Я подписался(-ась)', 'check_subscription')],
      ])
    });
  }

  // ─── Приветствие (главное меню) ──────────────────────────────────────────────
  async sendWelcome(ctx, user) {
    const name = user?.first_name || ctx.from?.first_name || 'друг';
    const text =
      `🦊 *Привет, ${name}!*\n\n` +
      `Добро пожаловать к Алисе Бойчук!\n\n` +
      `Здесь я делюсь только *проверенными* офферами из:\n` +
      `• 📚 САЛИД — лучшая образовательная CPA-сеть\n` +
      `• 🛒 ИнфоХит — маркетплейс инфопродуктов\n\n` +
      `*Что хочешь сделать?* 👇`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎁 Бесплатные курсы', 'free_courses')],
      [
        Markup.button.callback('📚 САЛИД офферы', 'top_salid'),
        Markup.button.callback('🛒 ИнфоХит офферы', 'infohit_offers'),
      ],
      [Markup.button.callback('🤝 Реферальная программа', 'referral')],
    ]);

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
    } else {
      await ctx.replyWithMarkdown(text, keyboard);
    }
  }

  // ─── Бесплатные курсы (воронка-магнит) ──────────────────────────────────────
  async sendFreeCourses(ctx) {
    const text =
      `🎁 *Бесплатные курсы для старта*\n\n` +
      `Я собрала лучшие *бесплатные* обучения — они реально помогают и одновременно знакомят с платными продуктами (с которых я получаю комиссию 😉):\n\n` +
      `1️⃣ *Вебинар «Как заработать первые 30 000₽ онлайн»*\n` +
      `   → Регистрация бесплатная, ничего платить не нужно\n\n` +
      `2️⃣ *Мини-курс «Основы копирайтинга»*\n` +
      `   → 5 уроков + чат с куратором\n\n` +
      `3️⃣ *Марафон «ИИ инструменты для работы»*\n` +
      `   → Актуально в 2025, 3 дня практики\n\n` +
      `👆 Выбери интересующий:`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('💰 Вебинар «30 000₽ онлайн»', 'offer_salid_4')],
        [Markup.button.callback('✍️ Копирайтинг бесплатно', 'step_1_copywrite')],
        [Markup.button.callback('🤖 ИИ инструменты', 'offer_ih_2')],
        [Markup.button.callback('🏠 Назад', 'main_menu')],
      ])
    });
  }

  // ─── Офферы САЛИД ────────────────────────────────────────────────────────────
  async sendSalidOffers(ctx) {
    const salidOffers = Object.values(OFFERS).filter(o => o.source === 'САЛИД');
    const text =
      `📚 *Лучшие офферы САЛИД*\n\n` +
      `САЛИД — крупнейшая CPA-сеть в онлайн-образовании.\n` +
      `Комиссии: *30–100%* с каждой продажи 💰\n\n` +
      salidOffers.map((o, i) =>
        `${o.emoji} *${o.name}*\n` +
        `   💵 Цена: ${o.price} | 🤑 Комиссия: ${o.commission}\n` +
        `   📈 Заработок: ${o.earnings}${o.hot ? ' 🔥' : ''}`
      ).join('\n\n') +
      `\n\n👇 Выбери оффер для подробностей:`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        ...salidOffers.map(o => [Markup.button.callback(`${o.emoji} ${o.name}`, `offer_${o.id}`)]),
        [Markup.button.callback('🏠 Назад', 'main_menu')],
      ])
    });
  }

  // ─── Офферы ИнфоХит ──────────────────────────────────────────────────────────
  async sendInfohitOffers(ctx) {
    const ihOffers = Object.values(OFFERS).filter(o => o.source === 'ИнфоХит');
    const text =
      `🛒 *Офферы ИнфоХит*\n\n` +
      `ИнфоХит — маркетплейс инфопродуктов и курсов.\n` +
      `Комиссии: *45–60%* с продажи 💸\n\n` +
      ihOffers.map((o) =>
        `${o.emoji} *${o.name}*\n` +
        `   💵 Цена: ${o.price} | 🤑 Комиссия: ${o.commission}\n` +
        `   📈 Заработок: ${o.earnings}${o.hot ? ' 🔥' : ''}`
      ).join('\n\n') +
      `\n\n👇 Выбери оффер:`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        ...ihOffers.map(o => [Markup.button.callback(`${o.emoji} ${o.name}`, `offer_${o.id}`)]),
        [Markup.button.callback('🏠 Назад', 'main_menu')],
      ])
    });
  }

  // ─── Детали оффера ───────────────────────────────────────────────────────────
  async sendOfferDetail(ctx, offerId) {
    const offer = OFFERS[offerId];
    if (!offer) {
      await ctx.editMessageText('❌ Оффер не найден.', Markup.inlineKeyboard([[Markup.button.callback('🏠 Меню', 'main_menu')]]));
      return;
    }

    const text =
      `${offer.emoji} *${offer.name}*\n\n` +
      `🏢 Источник: *${offer.source}*\n` +
      `💵 Цена для покупателя: *${offer.price}*\n` +
      `💰 Твоя комиссия: *${offer.commission}*\n` +
      `📈 Заработок с продажи: *${offer.earnings}*\n\n` +
      `📝 ${offer.description}\n\n` +
      `🏷 Теги: ${offer.tags.map(t => `#${t.replace(/\s/g, '_')}`).join(' ')}\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `💡 *Как продвигать бесплатно:*\n` +
      `• ВКонтакте: пост в своей ленте или группе\n` +
      `• Telegram: переслать в чаты по теме\n` +
      `• Одноклассники: пост с личной историей\n` +
      `• YouTube Shorts / Reels: короткое видео\n\n` +
      `👆 Нажми кнопку ниже, чтобы перейти на лендинг!`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url(`🚀 Получить партнёрскую ссылку`, offer.url)],
        [Markup.button.callback('🔙 Назад', offer.source === 'САЛИД' ? 'top_salid' : 'infohit_offers')],
        [Markup.button.callback('🏠 Главное меню', 'main_menu')],
      ])
    });
  }

  // ─── Шаг воронки (прогрев контентом) ────────────────────────────────────────
  async sendFunnelStep(ctx, step, funnelId) {
    const steps = {
      copywrite: [
        {
          text: `✍️ *Копирайтинг — профессия мечты?*\n\nПомни: хорошие копирайтеры зарабатывают от 50 000 ₽ в месяц, работая из дома.\n\nВот что тебе нужно знать в первую очередь:\n\n📌 Главная ошибка новичков — писать «для всех». Нужно писать для конкретного человека.\n\nГотов узнать, как это делают профи?`,
          buttons: [
            [Markup.button.callback('💡 Да, покажи!', 'step_2_copywrite')],
            [Markup.button.callback('🏠 Меню', 'main_menu')],
          ]
        },
        {
          text: `💡 *Секрет профессионального текста*\n\nФормула AIDA работает всегда:\n\n👁 *A* — Attention (Внимание)\n❓ *I* — Interest (Интерес)\n🔥 *D* — Desire (Желание)\n✅ *A* — Action (Действие)\n\nЯ нашла курс, который обучает этому системно, с практическими заданиями.\n\nПервые 3 урока — БЕСПЛАТНО 👇`,
          buttons: [
            [Markup.button.callback('🎓 Получить бесплатные уроки', 'offer_salid_1')],
            [Markup.button.callback('🏠 Меню', 'main_menu')],
          ]
        }
      ]
    };

    const funnelSteps = steps[funnelId] || [];
    const currentStep = funnelSteps[step - 1];

    if (!currentStep) {
      return ctx.editMessageText('Раздел в разработке. Возвращайся позже!',
        Markup.inlineKeyboard([[Markup.button.callback('🏠 Меню', 'main_menu')]]));
    }

    await ctx.editMessageText(currentStep.text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(currentStep.buttons)
    });
  }

  // ─── Warmup: автоматические сообщения ────────────────────────────────────────
  async sendWarmupMessage(telegram, user) {
    const step = user.warmup_step;
    const msg = WARMUP_MESSAGES[step];
    if (!msg) return;

    await telegram.sendMessage(user.id, msg.text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(msg.buttons)
    });
  }
}

module.exports = Funnel;
