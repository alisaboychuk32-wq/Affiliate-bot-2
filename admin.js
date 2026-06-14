const { Markup } = require('telegraf');

class Admin {
  constructor(db, adminIds) {
    this.db = db;
    this.adminIds = adminIds;
  }

  async sendDashboard(ctx) {
    const stats = await this.db.getGlobalStats();
    const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const funnelStats = stats.funnelStats || [];
    const text =
      `🛠 *ЛИЧНЫЙ КАБИНЕТ*\n` +
      `_${now} МСК_\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 *ПОЛЬЗОВАТЕЛИ*\n` +
      `• Всего: *${stats.totalUsers || 0}*\n` +
      `• Активных: *${stats.activeUsers || 0}*\n` +
      `• Заблокировали: *${stats.blockedUsers || 0}*\n` +
      `• Сегодня: *+${stats.todayUsers || 0}*\n` +
      `• За 7 дней: *+${stats.weekUsers || 0}*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *АКТИВНОСТЬ*\n` +
      `• Кликов: *${stats.totalClicks || 0}*\n` +
      `• Рефералов: *${stats.totalReferrals || 0}*\n` +
      `• Конверсий: *${stats.totalConversions || 0}*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🔥 *ТОП ВОРОНКИ:*\n` +
      (funnelStats.slice(0, 3).map(f => `• ${f.data}: *${f.cnt}* входов`).join('\n') || '• Нет данных') +
      `\n\n🎯 *Выбери раздел:*`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Статистика', 'admin_stats'), Markup.button.callback('👥 Пользователи', 'admin_users')],
      [Markup.button.callback('🎯 Воронки', 'admin_funnels'), Markup.button.callback('💰 Офферы', 'admin_offers')],
      [Markup.button.callback('📢 Рассылка', 'admin_broadcast'), Markup.button.callback('📅 Расписание', 'admin_scheduler')],
      [Markup.button.callback('📣 Реклама', 'admin_ads'), Markup.button.callback('🚨 Ошибки', 'admin_errors')],
    ]);

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
    } else {
      await ctx.replyWithMarkdown(text, keyboard);
    }
  }

  async sendDetailedStats(ctx) {
    const stats = await this.db.getGlobalStats();
    const convRate = (stats.totalClicks || 0) > 0 ? (((stats.totalConversions || 0) / stats.totalClicks) * 100).toFixed(1) : '0.0';
    const text =
      `📊 *ДЕТАЛЬНАЯ СТАТИСТИКА*\n\n` +
      `🔢 *Ключевые метрики:*\n` +
      `• CTR: *${(stats.totalUsers || 0) > 0 ? (((stats.totalClicks || 0) / stats.totalUsers) * 100).toFixed(1) : 0}%*\n` +
      `• CR: *${convRate}%*\n` +
      `• Рефвирусность: *${(stats.totalUsers || 0) > 0 ? (((stats.totalReferrals || 0) / stats.totalUsers) * 100).toFixed(1) : 0}%*\n\n` +
      `💡 *ТОП офферов:*\n` +
      ((stats.offerStats || []).slice(0, 5).map((o, i) => `${i + 1}. ${o.data}: *${o.cnt}* кликов`).join('\n') || '• Нет данных');
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_back')]]) });
  }

  async sendUsersList(ctx) {
    const users = await this.db.getRecentUsers(15);
    const topReferrers = await this.db.getTopReferrers(5);
    const userList = users.map((u, i) => `${i + 1}. ${u.first_name || 'Аноним'} (@${u.username || u.id}) — ${(u.joined_at || '').slice(0, 10)}`).join('\n');
    const refList = topReferrers.map((u, i) => `${i + 1}. ${u.first_name || 'Аноним'} — ${u.referrals} реф.`).join('\n');
    const text =
      `👥 *ПОЛЬЗОВАТЕЛИ*\n\n` +
      `📋 *Последние 15:*\n\`\`\`\n${userList || 'Нет'}\n\`\`\`\n\n` +
      `🏆 *Топ рефереров:*\n\`\`\`\n${refList || 'Нет'}\n\`\`\``;
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_back')]]) });
  }

  async sendFunnelStats(ctx) {
    const stats = await this.db.getGlobalStats();
    const funnelStats = stats.funnelStats || [];
    const rows = funnelStats.map((f, i) => `${i + 1}. *${f.data}*: ${f.cnt} входов`).join('\n\n') || '_Нет данных_';
    const text =
      `🎯 *СТАТИСТИКА ВОРОНОК*\n\n${rows}\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `💡 *Активные воронки:*\n` +
      `• 🎁 Бесплатные курсы\n• 📚 САЛИД офферы\n• 🛒 ИнфоХит офферы\n• 🤝 Реферальная\n• ⏰ Warmup 3 шага`;
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_back')]]) });
  }

  async sendOffersStats(ctx) {
    const stats = await this.db.getGlobalStats();
    const offerStats = stats.offerStats || [];
    const rows = offerStats.map((o, i) => `${i + 1}. \`${o.data}\` — *${o.cnt}* кликов`).join('\n') || '_Нет данных_';
    const text =
      `💰 *СТАТИСТИКА ОФФЕРОВ*\n\n${rows}\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `📚 *САЛИД:* ✍️ Копирайтер · 🎯 Таргетолог · ❤️ Психология · 🆓 Вебинар\n` +
      `🛒 *ИнфоХит:* 🥗 Похудение · 🤖 ChatGPT · 🎬 Reels`;
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_back')]]) });
  }

  async sendBroadcastMenu(ctx) {
    const stats = await this.db.getGlobalStats();
    const text =
      `📢 *РАССЫЛКА*\n\n` +
      `Активных пользователей: *${stats.activeUsers || 0}*\n\nВыбери тип:`;
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(`📨 Всем активным (${stats.activeUsers || 0})`, 'broadcast_all')],
        [Markup.button.callback('🔙 Назад', 'admin_back')],
      ])
    });
  }

  async sendBroadcast(ctx, text) {
    const users = await this.db.getAllUsers(true);
    let sent = 0, failed = 0;
    for (const user of users) {
      try {
        await ctx.telegram.sendMessage(user.id, text, { parse_mode: 'Markdown' });
        sent++;
        await new Promise(r => setTimeout(r, 35));
      } catch (e) {
        failed++;
        if (e.code === 403) await this.db.markUserBlocked(user.id);
      }
    }
    return { sent, failed };
  }

  async sendErrorLog(ctx) {
    const errors = await this.db.getErrors(10);
    const text = errors.length > 0
      ? errors.map((e, i) => `${i + 1}. ${(e.created_at || '').slice(0, 16)}\n   ${(e.message || '').slice(0, 100)}`).join('\n\n')
      : '✅ Ошибок нет!';
    await ctx.editMessageText(`🚨 *ЛОГ ОШИБОК*\n\n\`\`\`\n${text}\n\`\`\``, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'admin_back')]])
    });
  }
}

module.exports = Admin;
