require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const Database = require('./database');
const Funnel = require('./funnel');
const Admin = require('./admin');
const Scheduler = require('./scheduler');
const OffersUpdater = require('./offers_updater');
const AdsManager = require('./ads_manager');
const AIAssistant = require('./ai_assistant');
const PaymentsManager = require('./payments');

const sessions = {};
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id)).filter(Boolean);
const CHANNEL = '@kanalKursov7';

if (!BOT_TOKEN) { console.error('❌ BOT_TOKEN не задан!'); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const db = new Database();
const offersUpdater = new OffersUpdater(bot.telegram, ADMIN_IDS);
const adsManager = new AdsManager(bot.telegram, ADMIN_IDS, CHANNEL);
const ai = new AIAssistant();
const payments = new PaymentsManager(bot.telegram, ADMIN_IDS);
const funnel = new Funnel(db, CHANNEL, offersUpdater);
const admin = new Admin(db, ADMIN_IDS, offersUpdater);

// ИИ лимиты для бесплатных пользователей
const AI_FREE_LIMIT = 5; // вопросов в день
const aiUsage = {}; // { userId: { count, date } }

function checkAiLimit(userId) {
  const today = new Date().toISOString().slice(0, 10);
  if (!aiUsage[userId] || aiUsage[userId].date !== today) {
    aiUsage[userId] = { count: 0, date: today };
  }
  return aiUsage[userId].count < AI_FREE_LIMIT;
}

function incrementAiUsage(userId) {
  const today = new Date().toISOString().slice(0, 10);
  if (!aiUsage[userId] || aiUsage[userId].date !== today) aiUsage[userId] = { count: 0, date: today };
  aiUsage[userId].count++;
  return aiUsage[userId].count;
}

bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (userId) {
    if (!sessions[userId]) sessions[userId] = {};
    ctx.session = sessions[userId];
    await db.upsertUser({ id: userId, username: ctx.from.username || '', first_name: ctx.from.first_name || '', last_name: ctx.from.last_name || '', joined_at: new Date().toISOString(), last_active: new Date().toISOString() });
  }
  return next();
});

// ─── СТАРТ ────────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const payload = ctx.startPayload;
  if (payload && payload.startsWith('ref_')) {
    const referrerId = parseInt(payload.replace('ref_', ''));
    if (referrerId !== userId) await db.addReferral({ referrer_id: referrerId, referred_id: userId });
  }
  const isSubscribed = await funnel.checkSubscription(ctx, userId);
  if (!isSubscribed) return funnel.sendSubscribeGate(ctx);
  await funnel.sendWelcome(ctx, await db.getUser(userId));
});

bot.action('check_subscription', async (ctx) => {
  await ctx.answerCbQuery();
  const isSubscribed = await funnel.checkSubscription(ctx, ctx.from.id);
  if (isSubscribed) { await ctx.deleteMessage().catch(() => {}); await funnel.sendWelcome(ctx, await db.getUser(ctx.from.id)); }
  else await ctx.answerCbQuery('❌ Вы ещё не подписались!', { show_alert: true });
});

bot.action('main_menu', async (ctx) => { await ctx.answerCbQuery(); await funnel.sendWelcome(ctx, await db.getUser(ctx.from.id)); });
bot.action('free_courses', async (ctx) => { await ctx.answerCbQuery(); await db.logEvent({ user_id: ctx.from.id, type: 'funnel_enter', data: 'free_courses' }); await funnel.sendFreeCourses(ctx); });
bot.action('top_salid', async (ctx) => { await ctx.answerCbQuery(); await db.logEvent({ user_id: ctx.from.id, type: 'funnel_enter', data: 'top_salid' }); await funnel.sendSalidOffers(ctx); });
bot.action('infohit_offers', async (ctx) => { await ctx.answerCbQuery(); await db.logEvent({ user_id: ctx.from.id, type: 'funnel_enter', data: 'infohit' }); await funnel.sendInfohitOffers(ctx); });

bot.action('referral', async (ctx) => {
  await ctx.answerCbQuery();
  const stats = await db.getUserStats(ctx.from.id);
  const botInfo = await bot.telegram.getMe();
  const refLink = `https://t.me/${botInfo.username}?start=ref_${ctx.from.id}`;
  await ctx.editMessageText(
    `🤝 *Реферальная программа*\n\n👥 Рефералов: *${stats.referrals || 0}*\n\n🔗 Ссылка:\n\`${refLink}\`\n\n💡 Делись в ВКонтакте, Одноклассниках, Telegram!`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Меню', 'main_menu')]]) }
  );
});

bot.action(/^offer_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await db.incrementStat(ctx.from.id, 'clicks');
  await db.logEvent({ user_id: ctx.from.id, type: 'offer_click', data: ctx.match[1] });
  await funnel.sendOfferDetail(ctx, ctx.match[1]);
});

bot.action(/^step_(\d+)_(.+)$/, async (ctx) => { await ctx.answerCbQuery(); await funnel.sendFunnelStep(ctx, parseInt(ctx.match[1]), ctx.match[2]); });

// ─── ИИ-АССИСТЕНТ ─────────────────────────────────────────────────────────────
bot.action('ask_ai', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const isPremium = await payments.isPremium(userId);
  const hasLimit = checkAiLimit(userId);

  if (!isPremium && !hasLimit) {
    return ctx.editMessageText(
      `🤖 *ИИ-ассистент*\n\n` +
      `⚠️ Ты использовал ${AI_FREE_LIMIT} бесплатных вопросов сегодня.\n\n` +
      `Для неограниченного доступа — оформи Premium:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
        [Markup.button.callback('⭐ Premium — 299 ₽/мес', 'buy_premium')],
        [Markup.button.callback('🏠 Меню', 'main_menu')],
      ])}
    );
  }

  ctx.session.aiMode = true;
  const used = aiUsage[userId]?.count || 0;
  const limitText = isPremium ? '♾️ безлимит (Premium)' : `${AI_FREE_LIMIT - used} из ${AI_FREE_LIMIT} осталось`;

  await ctx.editMessageText(
    `🤖 *ИИ-ассистент Алисы*\n\n` +
    `Задай любой вопрос про:\n` +
    `• Партнёрский маркетинг\n` +
    `• Как выбрать оффер\n` +
    `• Как продвигать бесплатно\n` +
    `• Любой курс из каталога\n\n` +
    `💬 Вопросов сегодня: _${limitText}_\n\n` +
    `_Просто напиши вопрос текстом_ 👇`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('❌ Выйти из режима ИИ', 'ai_exit')],
    ])}
  );
});

bot.action('ai_exit', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.aiMode = false;
  ai.clearHistory(ctx.from.id);
  await funnel.sendWelcome(ctx, await db.getUser(ctx.from.id));
});

// ─── PREMIUM / ПЛАТЕЖИ ────────────────────────────────────────────────────────
bot.action('buy_premium', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const isPremium = await payments.isPremium(userId);
  const info = await payments.getPremiumInfo(userId);
  const statusText = isPremium ? `✅ Premium активен до: _${new Date(info.expires_at).toLocaleDateString('ru-RU')}_\n\n` : '';

  await ctx.editMessageText(
    `⭐ *Premium доступ*\n\n${statusText}` +
    `🔥 Закрытые офферы (70-100%)\n🤖 ИИ без лимита\n📊 Личная аналитика\n⚡ Новые офферы первым\n\n💰 *Выбери пакет:*`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('━━━ 1 месяц — 299 ₽ ━━━', 'noop')],
        [Markup.button.callback('⭐ Stars (100)', 'pay_stars_premium_month'), Markup.button.callback('💛 ЮMoney', 'pay_ymoney_premium_month')],
        [Markup.button.callback('━━━ 3 месяца — 699 ₽ ━━━', 'noop')],
        [Markup.button.callback('⭐ Stars (250)', 'pay_stars_premium_3month'), Markup.button.callback('💛 ЮMoney', 'pay_ymoney_premium_3month')],
        [Markup.button.callback('━━━ Курс «Старт» — 1490 ₽ ━━━', 'noop')],
        [Markup.button.callback('⭐ Stars (500)', 'pay_stars_course_starter'), Markup.button.callback('💛 ЮMoney', 'pay_ymoney_course_starter')],
        [Markup.button.callback('🏠 Назад', 'main_menu')],
      ])
    }
  );
});

bot.action('noop', async (ctx) => { await ctx.answerCbQuery(); });

// Stars
bot.action(/^pay_stars_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  try { await payments.sendStarsInvoice(ctx, ctx.match[1]); await ctx.deleteMessage().catch(() => {}); }
  catch (e) { await ctx.reply(`❌ Ошибка: ${e.message}`); }
});

// ЮMoney
bot.action(/^pay_ymoney_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const productId = ctx.match[1];
  const product = payments.getProducts()[productId];

  if (!process.env.YMONEY_WALLET) {
    return ctx.reply(
      `💛 *Оплата через ЮMoney*\n\n📦 ${product?.name} — *${product?.price_rub} ₽*\n\n⚠️ Напиши @Imalisa_boychuk — она пришлёт реквизиты!`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'buy_premium')]]) }
    );
  }

  const link = payments.generateYmoneyLink(productId, ctx.from.id);
  if (!link) return ctx.reply('❌ Ошибка генерации ссылки');

  await payments.savePendingYmoney(link.label, { userId: ctx.from.id, productId, amount: link.amount });

  await ctx.editMessageText(
    `💛 *Оплата через ЮMoney*\n\n📦 *${product?.name}*\n💰 Сумма: *${link.amount} ₽*\n\n1️⃣ Нажми кнопку ниже\n2️⃣ Оплати картой или с кошелька\n3️⃣ Нажми *«✅ Я оплатил»*`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('💛 Оплатить через ЮMoney', link.url)],
        [Markup.button.callback(`✅ Я оплатил`, `ymoney_confirm_${link.label}`)],
        [Markup.button.callback('🔙 Назад', 'buy_premium')],
      ])
    }
  );
});

// Пользователь нажал "Я оплатил"
bot.action(/^ymoney_confirm_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('⏳ Отправляю на проверку...');
  const label = ctx.match[1];
  for (const adminId of ADMIN_IDS) {
    try {
      await ctx.telegram.sendMessage(adminId,
        `💛 *Заявка ЮMoney*\n\n👤 ${ctx.from.first_name} (@${ctx.from.username || ctx.from.id})\n🏷 \`${label}\`\n\nПроверь в кабинете ЮMoney:`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
          { text: '✅ Подтвердить', callback_data: `admin_ymoney_ok_${label}` },
          { text: '❌ Отклонить', callback_data: `admin_ymoney_no_${label}` },
        ]] } }
      );
    } catch {}
  }
  await ctx.editMessageText(
    `⏳ *Заявка отправлена!*\n\nАдминистратор проверит и активирует доступ.\nЕсли есть вопросы — @Imalisa_boychuk`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Меню', 'main_menu')]]) }
  );
});

// Админ подтверждает
bot.action(/^admin_ymoney_ok_(.+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery('✅ Активирую...');
  const result = await payments.confirmYmoney(ctx.match[1]);
  if (result) {
    await ctx.editMessageText(`✅ Premium активирован для ${result.userId}!`);
    const product = payments.getProducts()[result.productId];
    try {
      await ctx.telegram.sendMessage(result.userId,
        `🎉 *Оплата подтверждена!*\n\n📦 ${product?.name}\n✅ До: *${new Date(result.premiumData.expires_at).toLocaleDateString('ru-RU')}*`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[{ text: '🏠 Меню', callback_data: 'main_menu' }]]) }
      );
    } catch {}
  } else {
    await ctx.editMessageText('❌ Платёж не найден.');
  }
});

bot.action(/^admin_ymoney_no_(.+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  await ctx.editMessageText('❌ Отклонено.');
});

bot.action(/^pay_stars_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const productId = ctx.match[1];
  try {
    await payments.sendStarsInvoice(ctx, productId);
    await ctx.deleteMessage().catch(() => {});
  } catch (e) {
    await ctx.reply(`❌ Ошибка создания инвойса: ${e.message}`);
  }
});

// Оплата рублями (ЮKassa)
bot.action(/^pay_rub_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const productId = ctx.match[1];
    return ctx.reply(
      `💳 *Оплата картой*\n\nДля оплаты картой напиши @Imalisa_boychuk — она пришлёт реквизиты.\n\nПосле оплаты Premium активируется вручную в течение 1 часа.`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'buy_premium')]]) }
    );
  }
  try {
    await payments.sendRubInvoice(ctx, productId);
    await ctx.deleteMessage().catch(() => {});
  } catch (e) {
    await ctx.reply(`❌ Ошибка: ${e.message}`);
  }
});

// Подтверждение pre_checkout (обязательно для Telegram Payments)
bot.on('pre_checkout_query', async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

// Успешная оплата
bot.on('successful_payment', async (ctx) => {
  const payment = ctx.message.successful_payment;
  const payload = payment.invoice_payload; // productId_userId_timestamp
  const productId = payload.split('_').slice(0, -2).join('_');
  const userId = ctx.from.id;

  await payments.recordPayment({
    userId, username: ctx.from.username || '', firstName: ctx.from.first_name || '',
    productId, amount: payment.total_amount / (payment.currency === 'RUB' ? 100 : 1),
    currency: payment.currency, paymentId: payment.telegram_payment_charge_id,
  });

  const premiumData = await payments.activatePremium(userId, productId);
  const product = payments.getProducts()[productId];

  await ctx.reply(
    `🎉 *Оплата прошла успешно!*\n\n` +
    `📦 ${product?.name || productId}\n` +
    `${premiumData ? `✅ Действует до: *${new Date(premiumData.expires_at).toLocaleDateString('ru-RU')}*\n` : ''}` +
    `\nДобро пожаловать в Premium! 🌟`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Главное меню', 'main_menu')]]) }
  );

  await db.logEvent({ user_id: userId, type: 'payment', data: productId });
});

// ─── РЕКЛАМА ──────────────────────────────────────────────────────────────────
bot.action('buy_ads', async (ctx) => {
  await ctx.answerCbQuery();
  await db.logEvent({ user_id: ctx.from.id, type: 'funnel_enter', data: 'buy_ads' });
  await ctx.editMessageText(
    `📣 *Реклама в @kanalKursov7*\n\n🎯 Аудитория: онлайн-заработок, 18–45 лет\n\n💰 *Прайс:*\n1️⃣ 1 пост — 500 ₽\n2️⃣ 3 поста — 1 200 ₽\n3️⃣ Неделя — 2 500 ₽\n4️⃣ Месяц — 8 000 ₽`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('1️⃣ 500 ₽', 'ads_order_post_1x'), Markup.button.callback('2️⃣ 1 200 ₽', 'ads_order_post_3x')],
      [Markup.button.callback('3️⃣ 2 500 ₽', 'ads_order_post_week'), Markup.button.callback('4️⃣ 8 000 ₽', 'ads_order_post_month')],
      [Markup.button.callback('🏠 Назад', 'main_menu')],
    ])}
  );
});

bot.action(/^ads_order_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const prices = adsManager.getPrices();
  const pkg = prices[ctx.match[1]];
  if (!pkg) return;
  ctx.session.adOrder = { packageId: ctx.match[1], step: 'text' };
  await ctx.editMessageText(`📝 *Заявка на рекламу*\n\nПакет: *${pkg.name}* — ${pkg.price} ₽\n\nНапиши текст поста:`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'buy_ads')]]) });
});

bot.action(/^ad_approve_(\d+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery('✅');
  await adsManager.approveOrder(ctx.match[1]);
  await ctx.editMessageText(`✅ Заявка #${ctx.match[1]} одобрена!`);
});

bot.action(/^ad_reject_(\d+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery('❌');
  await adsManager.rejectOrder(ctx.match[1]);
  await ctx.editMessageText(`❌ Заявка #${ctx.match[1]} отклонена.`);
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────
bot.command('admin', async (ctx) => { if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.reply('⛔'); await admin.sendDashboard(ctx); });
bot.action('admin_stats', async (ctx) => { if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔'); await ctx.answerCbQuery(); await admin.sendDetailedStats(ctx); });
bot.action('admin_users', async (ctx) => { if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔'); await ctx.answerCbQuery(); await admin.sendUsersList(ctx); });
bot.action('admin_funnels', async (ctx) => { if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔'); await ctx.answerCbQuery(); await admin.sendFunnelStats(ctx); });
bot.action('admin_broadcast', async (ctx) => { if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔'); await ctx.answerCbQuery(); await admin.sendBroadcastMenu(ctx); });
bot.action('admin_offers', async (ctx) => { if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔'); await ctx.answerCbQuery(); await admin.sendOffersStats(ctx); });
bot.action('admin_errors', async (ctx) => { if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔'); await ctx.answerCbQuery(); await admin.sendErrorLog(ctx); });
bot.action('admin_back', async (ctx) => { if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔'); await ctx.answerCbQuery(); await admin.sendDashboard(ctx); });

bot.action('admin_ads', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  const stats = await adsManager.getStats();
  const payStats = await payments.getStats();
  await ctx.editMessageText(
    `📣 *РЕКЛАМА И ПЛАТЕЖИ*\n\n💰 Доход реклама: *${stats.revenue} ₽*\n💎 Доход Premium: *${payStats.revenue} ₽*\n👑 Активных Premium: *${payStats.activePremium}*\n\n📊 Рекламные заявки:\n• Новых: *${stats.pending}*\n• Опубликовано: *${stats.published}*`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback(`🔴 Заявки (${stats.pending})`, 'admin_ads_pending')],
      [Markup.button.callback('📋 История', 'admin_ads_all')],
      [Markup.button.callback('🔙 Назад', 'admin_back')],
    ])}
  );
});

bot.action('admin_ads_pending', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  const pending = await adsManager.getOrders('pending');
  if (!pending.length) return ctx.editMessageText('✅ Новых заявок нет!', Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_ads')]]));
  for (const o of pending.slice(0, 5)) {
    await ctx.telegram.sendMessage(ctx.from.id,
      `📣 *#${o.id}* | ${o.firstName} | ${o.packageName} — *${o.price}₽*\n📝 _${o.adText}_\n📞 ${o.contactInfo}`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '✅', callback_data: `ad_approve_${o.id}` }, { text: '❌', callback_data: `ad_reject_${o.id}` }]] } }
    );
  }
  await ctx.editMessageText('Заявки 👆', Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_ads')]]));
});

bot.action('admin_ads_all', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  const all = await adsManager.getOrders();
  const rows = all.slice(-8).reverse().map(o => `• ${o.firstName} — ${o.packageName} (${o.status === 'pending' ? '⏳' : o.status === 'published' ? '📢' : o.status === 'approved' ? '✅' : '❌'})`).join('\n') || 'Нет';
  await ctx.editMessageText(`📋 *Заявки:*\n\n${rows}`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_ads')]]) });
});

bot.action('admin_offers_update', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery('🔄');
  const result = await offersUpdater.runWeeklyUpdate(true);
  await ctx.editMessageText(result.success ? `✅ Офферы обновлены! Всего: ${result.total}` : `❌ ${result.error}`,
    Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_offers')]]));
});

bot.action('admin_scheduler', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  const status = await offersUpdater.getStatus();
  await ctx.editMessageText(
    `📅 *РАСПИСАНИЕ*\n\n📢 Автопостинг: каждые 12ч\n☀️ Совет: 09:00 ежедневно\n📨 Рассылка: вс 10:00\n🔄 Офферы: пн 08:00\n\n📦 Офферов: *${status.total}* (🔥${status.hot})`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Обновить офферы', 'admin_offers_update')],
      [Markup.button.callback('🔙 Назад', 'admin_back')],
    ])}
  );
});

bot.action(/^broadcast_(.+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  ctx.session.awaitingBroadcast = ctx.match[1];
  await ctx.editMessageText(`📢 Введи текст рассылки:`, { parse_mode: 'Markdown' });
});

// ─── Обработка всех текстовых сообщений ──────────────────────────────────────
bot.on('text', async (ctx, next) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;
  if (text.startsWith('/')) return next();

  // Реклама шаг 1: текст объявления
  if (ctx.session?.adOrder?.step === 'text') {
    if (text.length > 500) return ctx.reply('❌ Максимум 500 символов:');
    ctx.session.adOrder.adText = text;
    ctx.session.adOrder.step = 'contact';
    return ctx.reply('✅ Принято! Напиши контакт для связи (@username):',
      Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'buy_ads')]]));
  }

  // Реклама шаг 2: контакт
  if (ctx.session?.adOrder?.step === 'contact') {
    const order = await adsManager.createOrder({ userId, username: ctx.from.username || '', firstName: ctx.from.first_name || '', packageId: ctx.session.adOrder.packageId, text: ctx.session.adOrder.adText, contactInfo: text });
    ctx.session.adOrder = null;
    const pkg = adsManager.getPrices()[order.packageId];
    return ctx.reply(`🎉 *Заявка отправлена!*\n\n📦 ${pkg.name} — *${pkg.price} ₽*\n\n⏳ Свяжемся по: *${text}*`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Меню', 'main_menu')]]) });
  }

  // Рассылка от админа
  if (ADMIN_IDS.includes(userId) && ctx.session?.awaitingBroadcast) {
    const target = ctx.session.awaitingBroadcast;
    ctx.session.awaitingBroadcast = null;
    if (target === 'channel_post') {
      try { await bot.telegram.sendMessage(CHANNEL, text, { parse_mode: 'Markdown' }); await ctx.reply('✅ Пост отправлен!', Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_back')]])); }
      catch (e) { await ctx.reply(`❌ ${e.message}`); }
    } else {
      const result = await admin.sendBroadcast(ctx, text);
      await ctx.reply(`✅ Отправлено: ${result.sent}, ошибок: ${result.failed}`, Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_back')]]));
    }
    return;
  }

  // ИИ-ассистент
  if (ctx.session?.aiMode) {
    const isPremium = await payments.isPremium(userId);
    if (!isPremium && !checkAiLimit(userId)) {
      ctx.session.aiMode = false;
      return ctx.reply('⚠️ Лимит вопросов исчерпан. Оформи Premium для безлимитного доступа!',
        Markup.inlineKeyboard([[Markup.button.callback('⭐ Оформить Premium', 'buy_premium')]]));
    }

    const loadingMsg = await ctx.reply('🤖 _Думаю..._', { parse_mode: 'Markdown' });
    incrementAiUsage(userId);
    const response = await ai.answer(userId, text);
    await db.logEvent({ user_id: userId, type: 'ai_question', data: text.slice(0, 50) });

    try { await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id); } catch {}

    const buttons = [[Markup.button.callback('❌ Выйти из ИИ', 'ai_exit')]];
    if (response.action) buttons.unshift([Markup.button.callback(response.action.label, response.action.data)]);

    await ctx.reply(response.text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    return;
  }

  // Если не в режиме ИИ — предложить задать вопрос ИИ
  await ctx.reply(
    `💬 Хочешь задать вопрос ИИ-ассистенту?\n\n_Он поможет выбрать оффер и расскажет как зарабатывать на партнёрках_`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('🤖 Спросить ИИ', 'ask_ai')],
      [Markup.button.callback('🏠 Главное меню', 'main_menu')],
    ])}
  );
});

// ─── Запуск ───────────────────────────────────────────────────────────────────
async function main() {
  await db.init();
  await offersUpdater.init();
  await adsManager.init();
  await payments.init();

  setInterval(async () => {
    try {
      const users = await db.getUsersForWarmup(Date.now());
      for (const user of users) {
        try { await funnel.sendWarmupMessage(bot.telegram, user); await db.markWarmupSent(user.id, user.warmup_step); }
        catch (e) { if (e.code === 403) await db.markUserBlocked(user.id); }
      }
    } catch {}
  }, 60 * 1000);

  const scheduler = new Scheduler(bot.telegram, db);
  scheduler.start();
  offersUpdater.startWeeklyUpdate();

  bot.launch({ allowedUpdates: ['message', 'callback_query', 'pre_checkout_query'] });
  console.log('🤖 Бот запущен!', CHANNEL);
  console.log('🤖 ИИ:', ai.isEnabled() ? 'активен' : 'нужен ANTHROPIC_API_KEY');
  console.log('💳 Платежи Stars: активны');
  console.log('👤 Admins:', ADMIN_IDS.join(', '));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
