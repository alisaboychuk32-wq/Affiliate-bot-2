require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const Database = require('./database');
const Funnel = require('./funnel');
const Admin = require('./admin');
const Scheduler = require('./scheduler');
const OffersUpdater = require('./offers_updater');
const AdsManager = require('./ads_manager');

const sessions = {};
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id)).filter(Boolean);
const CHANNEL = '@kanalKursov7';

if (!BOT_TOKEN) { console.error('❌ BOT_TOKEN не задан!'); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const db = new Database();
const offersUpdater = new OffersUpdater(bot.telegram, ADMIN_IDS);
const adsManager = new AdsManager(bot.telegram, ADMIN_IDS, CHANNEL);
const funnel = new Funnel(db, CHANNEL, offersUpdater);
const admin = new Admin(db, ADMIN_IDS, offersUpdater);

bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (userId) {
    if (!sessions[userId]) sessions[userId] = {};
    ctx.session = sessions[userId];
    await db.upsertUser({ id: userId, username: ctx.from.username || '', first_name: ctx.from.first_name || '', last_name: ctx.from.last_name || '', joined_at: new Date().toISOString(), last_active: new Date().toISOString() });
  }
  return next();
});

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const payload = ctx.startPayload;
  if (payload && payload.startsWith('ref_')) {
    const referrerId = parseInt(payload.replace('ref_', ''));
    if (referrerId !== userId) await db.addReferral({ referrer_id: referrerId, referred_id: userId });
  }
  const isSubscribed = await funnel.checkSubscription(ctx, userId);
  if (!isSubscribed) return funnel.sendSubscribeGate(ctx);
  const user = await db.getUser(userId);
  await funnel.sendWelcome(ctx, user);
});

bot.action('check_subscription', async (ctx) => {
  await ctx.answerCbQuery();
  const isSubscribed = await funnel.checkSubscription(ctx, ctx.from.id);
  if (isSubscribed) {
    await ctx.deleteMessage().catch(() => {});
    await funnel.sendWelcome(ctx, await db.getUser(ctx.from.id));
  } else {
    await ctx.answerCbQuery('❌ Вы ещё не подписались!', { show_alert: true });
  }
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

// ─── РЕКЛАМА ──────────────────────────────────────────────────────────────────
bot.action('buy_ads', async (ctx) => {
  await ctx.answerCbQuery();
  await db.logEvent({ user_id: ctx.from.id, type: 'funnel_enter', data: 'buy_ads' });
  await ctx.editMessageText(
    `📣 *Реклама в канале @kanalKursov7*\n\n` +
    `🎯 *Наша аудитория:*\n• Люди интересующиеся онлайн-заработком\n• Возраст 18–45 лет\n• Активные подписчики\n\n` +
    `━━━━━━━━━━━━━━━\n💰 *Прайс-лист:*\n\n` +
    `1️⃣ *1 пост* — 500 ₽ → 24ч в ленте\n` +
    `2️⃣ *3 поста* — 1 200 ₽ _(−20%)_ → 3 дня\n` +
    `3️⃣ *Неделя* — 2 500 ₽ _(−30%)_ → 7 постов + закреп\n` +
    `4️⃣ *Месяц* — 8 000 ₽ _(−45%)_ → 30 постов + 2 закрепа\n\n` +
    `👇 Выбери пакет:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('1️⃣ 1 пост — 500 ₽', 'ads_order_post_1x')],
        [Markup.button.callback('2️⃣ 3 поста — 1 200 ₽', 'ads_order_post_3x')],
        [Markup.button.callback('3️⃣ Неделя — 2 500 ₽', 'ads_order_post_week')],
        [Markup.button.callback('4️⃣ Месяц — 8 000 ₽', 'ads_order_post_month')],
        [Markup.button.callback('🏠 Назад', 'main_menu')],
      ])
    }
  );
});

bot.action(/^ads_order_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const prices = adsManager.getPrices();
  const pkg = prices[ctx.match[1]];
  if (!pkg) return;
  ctx.session.adOrder = { packageId: ctx.match[1], step: 'text' };
  await ctx.editMessageText(
    `📝 *Оформление заявки*\n\nПакет: *${pkg.name}* — ${pkg.price} ₽\n\nНапиши текст рекламного поста:\n_(максимум 500 символов)_`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'buy_ads')]]) }
  );
});

bot.action(/^ad_approve_(\d+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery('✅ Одобряю...');
  await adsManager.approveOrder(ctx.match[1]);
  await ctx.editMessageText(`✅ Заявка #${ctx.match[1]} одобрена! Рекламодатель получил реквизиты.`);
});

bot.action(/^ad_reject_(\d+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery('❌ Отклоняю...');
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
bot.action('admin_offers_update', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery('🔄 Обновляю...');
  const result = await offersUpdater.runWeeklyUpdate(true);
  await ctx.editMessageText(result.success ? `✅ Офферы обновлены! Всего: ${result.total}` : `❌ Ошибка: ${result.error}`,
    Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_offers')]]));
});

bot.action('admin_ads', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  const stats = await adsManager.getStats();
  await ctx.editMessageText(
    `📣 *РЕКЛАМА В КАНАЛЕ*\n\n` +
    `💰 Доход от рекламы: *${stats.revenue} ₽*\n\n` +
    `📊 Заявки:\n• Новых: *${stats.pending}* ${stats.pending > 0 ? '🔴' : ''}\n• Одобрено: *${stats.approved}*\n• Опубликовано: *${stats.published}*\n• Отклонено: *${stats.rejected}*`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(`🔴 Новые заявки (${stats.pending})`, 'admin_ads_pending')],
        [Markup.button.callback('📋 Все заявки', 'admin_ads_all')],
        [Markup.button.callback('🔙 Назад', 'admin_back')],
      ])
    }
  );
});

bot.action('admin_ads_pending', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  const pending = await adsManager.getOrders('pending');
  if (pending.length === 0) return ctx.editMessageText('✅ Новых заявок нет!', Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_ads')]]));
  for (const o of pending.slice(0, 5)) {
    await ctx.telegram.sendMessage(ctx.from.id,
      `📣 *Заявка #${o.id}*\n👤 ${o.firstName} (@${o.username || o.userId})\n📦 ${o.packageName} — *${o.price} ₽*\n📝 _${o.adText}_\n📞 ${o.contactInfo}`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '✅ Одобрить', callback_data: `ad_approve_${o.id}` }, { text: '❌ Отклонить', callback_data: `ad_reject_${o.id}` }]] } }
    );
  }
  await ctx.editMessageText(`Показаны заявки 👆`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_ads')]]));
});

bot.action('admin_ads_all', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  const all = await adsManager.getOrders();
  const rows = all.slice(-8).reverse().map(o => `• #${o.id} ${o.firstName} — ${o.packageName} (${o.status === 'pending' ? '⏳' : o.status === 'approved' ? '✅' : o.status === 'published' ? '📢' : '❌'})`).join('\n') || 'Нет';
  await ctx.editMessageText(`📋 *Заявки:*\n\n${rows}`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_ads')]]) });
});

bot.action('admin_scheduler', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  const status = await offersUpdater.getStatus();
  await ctx.editMessageText(
    `📅 *РАСПИСАНИЕ*\n\n📢 Автопостинг: каждые 12ч\n☀️ Совет дня: 09:00\n📨 Рассылка: вс 10:00\n🔄 Офферы: пн 08:00\n\n📦 Офферов в базе: *${status.total}* (🔥 ${status.hot})\n🕐 Обновлено: _${new Date(status.lastUpdated).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}_`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔄 Обновить офферы', 'admin_offers_update')], [Markup.button.callback('🔙 Назад', 'admin_back')]]) }
  );
});

bot.action('admin_post_now', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  ctx.session.awaitingBroadcast = 'channel_post';
  await ctx.editMessageText(`📢 Введи текст поста:`, { parse_mode: 'Markdown' });
});

bot.action(/^broadcast_(.+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  ctx.session.awaitingBroadcast = ctx.match[1];
  await ctx.editMessageText(`📢 *Рассылка*\n\nВведи текст:`, { parse_mode: 'Markdown' });
});

// ─── Обработка текста (сессии) ────────────────────────────────────────────────
bot.on('text', async (ctx, next) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;

  // Заявка на рекламу — шаг 1: текст объявления
  if (ctx.session?.adOrder?.step === 'text') {
    if (text.startsWith('/')) { ctx.session.adOrder = null; return next(); }
    if (text.length > 500) return ctx.reply('❌ Максимум 500 символов. Попробуй ещё раз:');
    ctx.session.adOrder.adText = text;
    ctx.session.adOrder.step = 'contact';
    return ctx.reply(`✅ Текст принят!\n\n📞 Напиши контакт для связи:\n_(например @username)_`,
      Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'buy_ads')]]));
  }

  // Заявка на рекламу — шаг 2: контакт
  if (ctx.session?.adOrder?.step === 'contact') {
    if (text.startsWith('/')) { ctx.session.adOrder = null; return next(); }
    const order = await adsManager.createOrder({ userId, username: ctx.from.username || '', firstName: ctx.from.first_name || '', packageId: ctx.session.adOrder.packageId, text: ctx.session.adOrder.adText, contactInfo: text });
    ctx.session.adOrder = null;
    const pkg = adsManager.getPrices()[order.packageId];
    return ctx.reply(
      `🎉 *Заявка отправлена!*\n\n📦 ${pkg.name} — *${pkg.price} ₽*\n\n⏳ Администратор свяжется с тобой по: *${text}*\n\nID заявки: \`${order.id}\``,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Главное меню', 'main_menu')]]) }
    );
  }

  // Рассылка от админа
  if (ADMIN_IDS.includes(userId) && ctx.session?.awaitingBroadcast) {
    if (text.startsWith('/')) return next();
    const target = ctx.session.awaitingBroadcast;
    ctx.session.awaitingBroadcast = null;
    if (target === 'channel_post') {
      try { await bot.telegram.sendMessage(CHANNEL, text, { parse_mode: 'Markdown' }); await ctx.reply('✅ Пост отправлен!', Markup.inlineKeyboard([[Markup.button.callback('🔙 В кабинет', 'admin_back')]])); }
      catch (e) { await ctx.reply(`❌ Ошибка: ${e.message}`); }
    } else {
      const result = await admin.sendBroadcast(ctx, text);
      await ctx.reply(`✅ Рассылка!\n📨 Отправлено: ${result.sent}\n❌ Ошибок: ${result.failed}`, Markup.inlineKeyboard([[Markup.button.callback('🔙 В кабинет', 'admin_back')]]));
    }
    return;
  }
  return next();
});

// ─── Запуск ───────────────────────────────────────────────────────────────────
async function main() {
  await db.init();
  await offersUpdater.init();
  await adsManager.init();

  setInterval(async () => {
    try {
      const users = await db.getUsersForWarmup(Date.now());
      for (const user of users) {
        try { await funnel.sendWarmupMessage(bot.telegram, user); await db.markWarmupSent(user.id, user.warmup_step); }
        catch (e) { if (e.code === 403) await db.markUserBlocked(user.id); }
      }
    } catch (e) {}
  }, 60 * 1000);

  const scheduler = new Scheduler(bot.telegram, db);
  scheduler.start();
  offersUpdater.startWeeklyUpdate();

  bot.launch({ allowedUpdates: ['message', 'callback_query'] });
  console.log('🤖 Бот запускается...');
  console.log('✅ Бот запущен! Канал:', CHANNEL);
  console.log('📣 Продажа рекламы активна');
  console.log('🔄 Автообновление офферов активно');
  console.log('👤 Admins:', ADMIN_IDS.join(', '));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch(e => { console.error('❌ Ошибка:', e.message); process.exit(1); });
