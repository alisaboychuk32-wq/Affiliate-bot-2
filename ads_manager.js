require('dotenv').config();
const { JsonDB, Config } = require('node-json-db');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ─── Прайс-лист рекламы ───────────────────────────────────────────────────────
const AD_PRICES = {
  post_1x: { id: 'post_1x', name: '1 пост в канале', price: 500, description: 'Один рекламный пост в @kanalKursov7', duration: '24 часа в ленте' },
  post_3x: { id: 'post_3x', name: '3 поста в канале', price: 1200, description: 'Три рекламных поста с интервалом 2 дня', duration: '3 дня' },
  post_week: { id: 'post_week', name: 'Пакет на неделю', price: 2500, description: '7 постов за неделю + закреп на 24ч', duration: '7 дней' },
  post_month: { id: 'post_month', name: 'Пакет на месяц', price: 8000, description: '30 постов + 2 закрепа + упоминание в шапке', duration: '30 дней' },
};

class AdsManager {
  constructor(telegram, adminIds, channel) {
    this.telegram = telegram;
    this.adminIds = adminIds;
    this.channel = channel;
    this.db = new JsonDB(new Config(path.join(dataDir, 'ads'), true, true, '/'));
  }

  async init() {
    try { await this.db.getData('/orders'); } catch { await this.db.push('/orders', []); }
    try { await this.db.getData('/published'); } catch { await this.db.push('/published', []); }
    console.log('📣 Менеджер рекламы инициализирован');
  }

  // Создать заявку на рекламу
  async createOrder({ userId, username, firstName, packageId, text, contactInfo }) {
    const pkg = AD_PRICES[packageId];
    if (!pkg) return null;
    const order = {
      id: Date.now(),
      userId, username, firstName,
      packageId, packageName: pkg.name,
      price: pkg.price,
      adText: text,
      contactInfo,
      status: 'pending', // pending → approved → published / rejected
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await this.db.push('/orders[]', order, true);

    // Уведомить админа
    const msg =
      `📣 *Новая заявка на рекламу!*\n\n` +
      `👤 От: ${firstName} (@${username || userId})\n` +
      `📦 Пакет: *${pkg.name}*\n` +
      `💰 Стоимость: *${pkg.price} ₽*\n` +
      `📝 Текст объявления:\n_${text}_\n\n` +
      `📞 Контакт: ${contactInfo}\n` +
      `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК\n\n` +
      `ID заявки: \`${order.id}\``;

    for (const adminId of this.adminIds) {
      try {
        await this.telegram.sendMessage(adminId, msg, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Одобрить', callback_data: `ad_approve_${order.id}` },
                { text: '❌ Отклонить', callback_data: `ad_reject_${order.id}` },
              ]
            ]
          }
        });
      } catch (e) {}
    }
    return order;
  }

  // Одобрить заявку
  async approveOrder(orderId) {
    try {
      const orders = await this.db.getData('/orders');
      const idx = orders.findIndex(o => o.id == orderId);
      if (idx === -1) return null;
      orders[idx].status = 'approved';
      orders[idx].updated_at = new Date().toISOString();
      await this.db.push('/orders', orders);

      // Уведомить рекламодателя
      try {
        await this.telegram.sendMessage(orders[idx].userId,
          `✅ *Ваша реклама одобрена!*\n\n` +
          `📦 Пакет: *${orders[idx].packageName}*\n` +
          `💰 К оплате: *${orders[idx].price} ₽*\n\n` +
          `💳 *Реквизиты для оплаты:*\n` +
          `Карта СБП: отправьте запрос администратору\n\n` +
          `После оплаты пришлите скриншот — и реклама выйдет в течение 24 часов!\n\n` +
          `📞 Связь с администратором: @Imalisa_boychuk`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {}
      return orders[idx];
    } catch (e) { return null; }
  }

  // Отклонить заявку
  async rejectOrder(orderId, reason = '') {
    try {
      const orders = await this.db.getData('/orders');
      const idx = orders.findIndex(o => o.id == orderId);
      if (idx === -1) return null;
      orders[idx].status = 'rejected';
      orders[idx].updated_at = new Date().toISOString();
      await this.db.push('/orders', orders);

      try {
        await this.telegram.sendMessage(orders[idx].userId,
          `❌ *Ваша заявка на рекламу отклонена*\n\n` +
          `${reason ? `Причина: ${reason}\n\n` : ''}` +
          `Если есть вопросы — напишите: @Imalisa_boychuk`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {}
      return orders[idx];
    } catch (e) { return null; }
  }

  // Опубликовать рекламу в канале
  async publishAd(orderId, finalText) {
    try {
      const orders = await this.db.getData('/orders');
      const idx = orders.findIndex(o => o.id == orderId);
      if (idx === -1) return null;

      await this.telegram.sendMessage(this.channel, finalText, { parse_mode: 'Markdown' });

      orders[idx].status = 'published';
      orders[idx].published_at = new Date().toISOString();
      await this.db.push('/orders', orders);

      try {
        await this.telegram.sendMessage(orders[idx].userId,
          `🎉 *Ваша реклама опубликована!*\n\n` +
          `Канал: ${this.channel}\n` +
          `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК\n\n` +
          `Спасибо за сотрудничество! 🤝`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {}
      return orders[idx];
    } catch (e) { return null; }
  }

  async getOrders(status = null) {
    try {
      const orders = await this.db.getData('/orders');
      return status ? orders.filter(o => o.status === status) : orders;
    } catch { return []; }
  }

  async getStats() {
    try {
      const orders = await this.db.getData('/orders');
      const total = orders.length;
      const pending = orders.filter(o => o.status === 'pending').length;
      const approved = orders.filter(o => o.status === 'approved').length;
      const published = orders.filter(o => o.status === 'published').length;
      const rejected = orders.filter(o => o.status === 'rejected').length;
      const revenue = orders.filter(o => o.status === 'published').reduce((s, o) => s + (o.price || 0), 0);
      return { total, pending, approved, published, rejected, revenue };
    } catch { return { total: 0, pending: 0, approved: 0, published: 0, rejected: 0, revenue: 0 }; }
  }

  getPrices() { return AD_PRICES; }
}

module.exports = AdsManager;
module.exports.AD_PRICES = AD_PRICES;
