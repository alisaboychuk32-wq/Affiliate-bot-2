require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const Database = require('./database');
const Funnel = require('./funnel');
const Admin = require('./admin');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id)).filter(Boolean);
const CHANNEL = '@Imalisa_boychuk';

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не задан! Проверь переменные окружения.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const db = new Database();
const funnel = new Funnel(db, CHANNEL);
const admin = new Admin(db, ADMIN_IDS);

bot.use(session());

bot.use(async (ctx, next) => {
  if (ctx.from) {
    await db.upsertUser({
      id: ctx.from.id,
      username: ctx.from.username || '',
      first_name: ctx.from.first_name || '',
      last_name: ctx.from.last_name || '',
      joined_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
    });
  }
  return next();
});

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const payload = ctx.startPayload;

  if (payload && payload.startsWith('ref_')) {
    const referrerId = parseInt(payload.replace('ref_', ''));
    if (referrerId !== userId) {
      await db.addReferral({ referrer_id: referrerId, referred_id: userId });
    }
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
    const user = await db.getUser(ctx.from.id);
    await ctx.deleteMessage().catch(() => {});
    await funnel.sendWelcome(ctx, user);
  } else {
    await ctx.answerCbQuery('❌ Вы ещё не подписались на канал!', { show_alert: true });
  }
});

bot.action('main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  await funnel.sendWelcome(ctx, user);
});

bot.action('free_courses', async (ctx) => {
  await ctx.answerCbQuery();
  await db.logEvent({ user_id: ctx.from.id, type: 'funnel_enter', data: 'free_courses' });
  await funnel.sendFreeCourses(ctx);
});

bot.action('top_salid', async (ctx) => {
  await ctx.answerCbQuery();
  await db.logEvent({ user_id: ctx.from.id, type: 'funnel_enter', data: 'top_salid' });
  await funnel.sendSalidOffers(ctx);
});

bot.action('infohit_offers', async (ctx) => {
  await ctx.answerCbQuery();
  await db.logEvent({ user_id: ctx.from.id, type: 'funnel_enter', data: 'infohit' });
  await funnel.sendInfohitOffers(ctx);
});

bot.action('referral', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const stats = await db.getUserStats(userId);
  const botInfo = await bot.telegram.getMe();
  const refLink = `https://t.me/${botInfo.username}?start=ref_${userId}`;

  await ctx.editMessageText(
    `🤝 *Реферальная программа*\n\n` +
    `👥 Твоих рефералов: *${stats.referrals || 0}*\n\n` +
    `🔗 Твоя ссылка:\n\`${refLink}\`\n\n` +
    `💡 *Делись бесплатно:*\n` +
    `• ВКонтакте, Одноклассники\n` +
    `• Telegram чаты\n` +
    `• YouTube Shorts / Reels`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Главное меню', 'main_menu')]])
    }
  );
});

bot.action(/^offer_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const offerId = ctx.match[1];
  await db.incrementStat(ctx.from.id, 'clicks');
  await db.logEvent({ user_id: ctx.from.id, type: 'offer_click', data: offerId });
  await funnel.sendOfferDetail(ctx, offerId);
});

bot.action(/^step_(\d+)_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const step = parseInt(ctx.match[1]);
  const funnelId = ctx.match[2];
  await funnel.sendFunnelStep(ctx, step, funnelId);
});

bot.command('admin', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.reply('⛔ Нет доступа.');
  await admin.sendDashboard(ctx);
});

bot.action('admin_stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  await admin.sendDetailedStats(ctx);
});

bot.action('admin_users', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  await admin.sendUsersList(ctx);
});

bot.action('admin_funnels', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  await admin.sendFunnelStats(ctx);
});

bot.action('admin_broadcast', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  await admin.sendBroadcastMenu(ctx);
});

bot.action('admin_offers', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  await admin.sendOffersStats(ctx);
});

bot.action('admin_errors', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  await admin.sendErrorLog(ctx);
});

bot.action('admin_back', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  await admin.sendDashboard(ctx);
});

bot.action(/^broadcast_(.+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('⛔');
  await ctx.answerCbQuery();
  ctx.session = ctx.session || {};
  ctx.session.awaitingBroadcast = ctx.match[1];
  await ctx.editMessageText(
    `📢 *Рассылка*\n\nВведи текст сообщения (поддерживается Markdown):\n\n_Для отмены введи /admin_`,
    { parse_mode: 'Markdown' }
  );
});

bot.on('text', async (ctx, next) => {
  if (ADMIN_IDS.includes(ctx.from.id) && ctx.session?.awaitingBroadcast) {
    const text = ctx.message.text;
    if (text.startsWith('/')) return next();
    ctx.session.awaitingBroadcast = null;
    const result = await admin.sendBroadcast(ctx, text);
    await ctx.reply(
      `✅ Рассылка завершена!\n📨 Отправлено: ${result.sent}\n❌ Ошибок: ${result.failed}`,
      Markup.inlineKeyboard([[Markup.button.callback('🔙 В кабинет', 'admin_back')]])
    );
    return;
  }
  return next();
});

async function runWarmupScheduler() {
  setInterval(async () => {
    try {
      const users = await db.getUsersForWarmup(Date.now());
      for (const user of users) {
        try {
          await funnel.sendWarmupMessage(bot.telegram, user);
          await db.markWarmupSent(user.id, user.warmup_step);
        } catch (e) {
          if (e.code === 403) await db.markUserBlocked(user.id);
        }
      }
    } catch (e) {
      console.error('Warmup error:', e.message);
    }
  }, 60 * 1000);
}

async function main() {
  await db.init();
  runWarmupScheduler();
  console.log('🤖 Бот запускается...');
  bot.launch({ allowedUpdates: ['message', 'callback_query'] });
  console.log('✅ Бот запущен! Канал:', CHANNEL);
  console.log('👤 Admins:', ADMIN_IDS.join(', '));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch(e => {
  console.error('❌ Ошибка запуска:', e.message);
  process.exit(1);
});
