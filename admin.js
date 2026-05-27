const { Markup } = require('telegraf');

class Admin {
  constructor(db, adminIds) {
    this.db = db;
    this.adminIds = adminIds;
  }

  // ─── Главный дашборд ─────────────────────────────────────────────────────────
  async sendDashboard(ctx) {
    const stats = this.db.getGlobalStats();
    const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

    const text =
      `🛠 *ЛИЧНЫЙ КАБИНЕТ АДМИНИСТРАТОРА*\n` +
      `_Обновлено: ${now} МСК_\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 *ПОЛЬЗОВАТЕЛИ*\n` +
      `• Всего: *${stats.totalUsers}*\n` +
      `• Активных: *${stats.activeUsers}*\n` +
      `• Заблокировали бота: *${stats.blockedUsers}*\n` +
      `• Сегодня: *+${stats.todayUsers}*\n` +
      `• За 7 дней: *+${stats.weekUsers}*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *АКТИВНОСТЬ*\n` +
      `• Кликов по офферам: *${stats.totalClicks}*\n` +
      `• Рефералов привлечено: *${stats.totalReferrals}*\n` +
      `• Конверсий: *${stats.totalConversions}*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🔥 *ТОП ВОРОНКИ:*\n` +
      (stats.funnelStats.slice(0, 3).map(f =>
        `• ${f.data}: *${f.cnt}* входов`
      ).join('\n') || '• Нет данных') +
      `\n\n🎯 *Выбери раздел:*`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 Детальная статистика', 'admin_stats'),
        Markup.button.callback('👥 Пользователи', 'admin_users'),
      ],
      [
        Markup.button.callback('🎯 Воронки', 'admin_funnels'),
        Markup.button.callback('💰 Офферы', 'admin_offers'),
      ],
      [
        Markup.button.callback('📢 Рассылка', 'admin_broadcast'),
        Markup.button.callback('🚨 Ошибки', 'admin_errors'),
      ],
    ]);

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
    } else {
      await ctx.replyWithMarkdown(text, keyboard);
    }
  }

  // ─── Детальная статистика ─────────────────────────────────────────────────────
  async sendDetailedStats(ctx) {
    const stats = this.db.getGlobalStats();

    const convRate = stats.totalClicks > 0
      ? ((stats.totalConversions / stats.totalClicks) * 100).toFixed(1)
      : '0.0';

    const growthChart = stats.dailyGrowth.slice(-7).map(d => {
      const bars = '█'.repeat(Math.min(d.cnt, 10));
      return `${d.day.slice(5)}: ${bars} ${d.cnt}`;
    }).join('\n');

    const text =
      `📊 *ДЕТАЛЬНАЯ СТАТИСТИКА*\n\n` +
      `📈 *Рост за 7 дней:*\n\`\`\`\n${growthChart || 'Нет данных'}\n\`\`\`\n\n` +
      `🔢 *Ключевые метрики:*\n` +
      `• CTR (клики/юзеры): *${stats.totalUsers > 0 ? ((stats.totalClicks / stats.totalUsers) * 100).toFixed(1) : 0}%*\n` +
      `• CR (конверсии/клики): *${convRate}%*\n` +
      `• Рефвирусность: *${stats.totalUsers > 0 ? (stats.totalReferrals / stats.totalUsers * 100).toFixed(1) : 0}%*\n\n` +
      `💡 *ТОП офферов по кликам:*\n` +
      (stats.offerStats.slice(0, 5).map((o, i) =>
        `${i + 1}. ${o.data}: *${o.cnt}* кликов`
      ).join('\n') || '• Нет данных');

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_back')]])
    });
  }

  // ─── Список пользователей ─────────────────────────────────────────────────────
  async sendUsersList(ctx) {
    const users = this.db.getRecentUsers(15);
    const topReferrers = this.db.getTopReferrers(5);

    const userList = users.map((u, i) => {
      const name = u.first_name || 'Аноним';
      const username = u.username ? `@${u.username}` : `id:${u.id}`;
      const date = u.joined_at ? u.joined_at.slice(0, 10) : '?';
      return `${i + 1}. ${name} (${username}) — ${date}`;
    }).join('\n');

    const refList = topReferrers.map((u, i) =>
      `${i + 1}. ${u.first_name || 'Аноним'} — ${u.referrals} рефералов`
    ).join('\n');

    const text =
      `👥 *ПОЛЬЗОВАТЕЛИ*\n\n` +
      `📋 *Последние 15 регистраций:*\n\`\`\`\n${userList || 'Нет'}\n\`\`\`\n\n` +
      `🏆 *Топ рефереров:*\n\`\`\`\n${refList || 'Нет'}\n\`\`\``;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_back')]])
    });
  }

  // ─── Статистика воронок ──────────────────────────────────────────────────────
  async sendFunnelStats(ctx) {
    const stats = this.db.getGlobalStats();

    const funnelRows = stats.funnelStats.map((f, i) => {
      const bar = '▓'.repeat(Math.min(Math.floor(f.cnt / 2), 15));
      return `${i + 1}. *${f.data}*\n   ${bar} ${f.cnt} входов`;
    }).join('\n\n');

    const text =
      `🎯 *СТАТИСТИКА ВОРОНОК*\n\n` +
      `Распределение трафика по воронкам:\n\n` +
      (funnelRows || '_Нет данных_') + `\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `💡 *Активные воронки бота:*\n` +
      `• 🎁 Бесплатные курсы — входной магнит\n` +
      `• 📚 САЛИД офферы — основная воронка\n` +
      `• 🛒 ИнфоХит офферы — дополнительная\n` +
      `• 🤝 Реферальная — виральный механизм\n` +
      `• ⏰ Warmup 3 шага — автоматический прогрев\n\n` +
      `_Warmup: +1ч → +24ч → +72ч после регистрации_`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_back')]])
    });
  }

  // ─── Статистика офферов ──────────────────────────────────────────────────────
  async sendOffersStats(ctx) {
    const stats = this.db.getGlobalStats();

    const offerRows = stats.offerStats.map((o, i) =>
      `${i + 1}. \`${o.data}\` — *${o.cnt}* кликов`
    ).join('\n');

    const text =
      `💰 *СТАТИСТИКА ОФФЕРОВ*\n\n` +
      `Клики по офферам:\n` +
      (offerRows || '_Нет данных_') + `\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `📋 *Все подключённые офферы:*\n\n` +
      `📚 *САЛИД (salid.ru/?w=973405):*\n` +
      `• ✍️ Копирайтер — 40% (2 360₽)\n` +
      `• 🎯 Таргетолог — 35% (4 515₽)\n` +
      `• ❤️ Психология — 60% (2 100₽)\n` +
      `• 🆓 Вебинар — 500₽/рег 🔥\n\n` +
      `🛒 *ИнфоХит (ihclick.ru/?idp=326805):*\n` +
      `• 🥗 Похудение — 50% (1 495₽)\n` +
      `• 🤖 ChatGPT — 45% (2 205₽) 🔥\n` +
      `• 🎬 Reels — 55% (1 095₽)\n\n` +
      `⚠️ _Замени ссылки в funnel.js на реальные из ЛК партнёрок!_`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_back')]])
    });
  }

  // ─── Меню рассылки ────────────────────────────────────────────────────────────
  async sendBroadcastMenu(ctx) {
    const stats = this.db.getGlobalStats();

    const text =
      `📢 *РАССЫЛКА*\n\n` +
      `Доступная аудитория:\n` +
      `• Все пользователи: *${stats.totalUsers}*\n` +
      `• Активных (не заблокировали): *${stats.activeUsers}*\n\n` +
      `Выбери тип рассылки:`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(`📨 Всем активным (${stats.activeUsers})`, 'broadcast_all')],
        [Markup.button.callback('🔙 Назад', 'admin_back')],
      ])
    });
  }

  // ─── Выполнение рассылки ─────────────────────────────────────────────────────
  async sendBroadcast(ctx, text, target) {
    const users = this.db.getAllUsers(true); // только активные
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await ctx.telegram.sendMessage(user.id, text, { parse_mode: 'Markdown' });
        sent++;
        // Задержка чтобы не получить flood от Telegram
        await new Promise(r => setTimeout(r, 35));
      } catch (e) {
        failed++;
        if (e.code === 403) {
          this.db.markUserBlocked(user.id);
        }
      }
    }

    return { sent, failed };
  }

  // ─── Лог ошибок ──────────────────────────────────────────────────────────────
  async sendErrorLog(ctx) {
    const errors = this.db.getErrors(10);

    const errorText = errors.length > 0
      ? errors.map((e, i) =>
          `${i + 1}. ${e.created_at.slice(0, 16)}\n   ${e.message.slice(0, 100)}`
        ).join('\n\n')
      : '✅ Ошибок не обнаружено!';

    const text =
      `🚨 *ЛОГ ОШИБОК* (последние 10)\n\n` +
      `\`\`\`\n${errorText}\n\`\`\``;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_back')]])
    });
  }
}

module.exports = Admin;
