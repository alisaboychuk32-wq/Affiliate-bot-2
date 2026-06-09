require('dotenv').config();
const { JsonDB, Config } = require('node-json-db');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const PRODUCTS = {
  premium_month: {
    id: 'premium_month',
    name: '⭐ Premium на месяц',
    description: 'Закрытые офферы + ИИ без лимита + личная аналитика',
    price_stars: 100,
    price_rub: 299,
    duration_days: 30,
  },
  premium_3month: {
    id: 'premium_3month',
    name: '⭐⭐ Premium на 3 месяца',
    description: 'Всё из Premium + личный разбор стратегии от Алисы',
    price_stars: 250,
    price_rub: 699,
    duration_days: 90,
  },
  course_starter: {
    id: 'course_starter',
    name: '📚 Курс «Старт в партнёрках»',
    description: 'Авторский курс Алисы — от 0 до первых продаж за 7 дней',
    price_stars: 500,
    price_rub: 1490,
    duration_days: 365,
  },
};

class PaymentsManager {
  constructor(telegram, adminIds) {
    this.telegram = telegram;
    this.adminIds = adminIds;
    this.db = new JsonDB(new Config(path.join(dataDir, 'payments'), true, true, '/'));

    // Токены платёжных систем
    this.yukassaToken = process.env.YUKASSA_TOKEN || '';     // ЮKassa провайдер токен
    this.ymoneyWallet = process.env.YMONEY_WALLET || '';     // Номер кошелька ЮMoney
    this.ymoneySecret = process.env.YMONEY_SECRET || '';     // Секрет для проверки уведомлений
  }

  async init() {
    try { await this.db.getData('/payments'); } catch { await this.db.push('/payments', []); }
    try { await this.db.getData('/premium_users'); } catch { await this.db.push('/premium_users', {}); }
    try { await this.db.getData('/pending_ymoney'); } catch { await this.db.push('/pending_ymoney', {}); }
    console.log('💳 Платежи: Stars ✅ | ЮKassa:', this.yukassaToken ? '✅' : '❌', '| ЮMoney:', this.ymoneyWallet ? '✅' : '❌');
  }

  getProducts() { return PRODUCTS; }

  async isPremium(userId) {
    try {
      const user = await this.db.getData(`/premium_users/${userId}`);
      return user && new Date(user.expires_at) > new Date();
    } catch { return false; }
  }

  async getPremiumInfo(userId) {
    try { return await this.db.getData(`/premium_users/${userId}`); } catch { return null; }
  }

  async activatePremium(userId, productId) {
    const product = PRODUCTS[productId];
    if (!product) return null;
    const expiresAt = new Date(Date.now() + product.duration_days * 86400000);
    const data = { userId, productId, productName: product.name, activated_at: new Date().toISOString(), expires_at: expiresAt.toISOString() };
    await this.db.push(`/premium_users/${userId}`, data);
    return data;
  }

  async recordPayment({ userId, username, firstName, productId, amount, currency, paymentId }) {
    const p = { id: Date.now(), userId, username, firstName, productId, amount, currency, paymentId, created_at: new Date().toISOString() };
    await this.db.push('/payments[]', p, true);
    for (const adminId of this.adminIds) {
      try {
        await this.telegram.sendMessage(adminId,
          `💰 *Новая оплата!*\n\n👤 ${firstName} (@${username || userId})\n📦 ${PRODUCTS[productId]?.name}\n💵 ${amount} ${currency}\n🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК`,
          { parse_mode: 'Markdown' });
      } catch {}
    }
    return p;
  }

  // ─── Telegram Stars ──────────────────────────────────────────────────────────
  async sendStarsInvoice(ctx, productId) {
    const product = PRODUCTS[productId];
    if (!product) return;
    await ctx.telegram.sendInvoice(ctx.from.id, {
      title: product.name,
      description: product.description,
      payload: `${productId}_${ctx.from.id}_${Date.now()}`,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: product.name, amount: product.price_stars }],
    });
  }

  // ─── ЮKassa (через Telegram Payments) ───────────────────────────────────────
  async sendYukassaInvoice(ctx, productId) {
    const product = PRODUCTS[productId];
    if (!product || !this.yukassaToken) return false;
    await ctx.telegram.sendInvoice(ctx.from.id, {
      title: product.name,
      description: product.description,
      payload: `${productId}_${ctx.from.id}_${Date.now()}`,
      provider_token: this.yukassaToken,
      currency: 'RUB',
      prices: [{ label: product.name, amount: product.price_rub * 100 }],
      need_name: false,
      need_email: false,
      need_phone: false,
    });
    return true;
  }

  // ─── ЮMoney (оплата по ссылке) ───────────────────────────────────────────────
  generateYmoneyLink(productId, userId) {
    const product = PRODUCTS[productId];
    if (!product || !this.ymoneyWallet) return null;

    // Формируем ссылку на форму оплаты ЮMoney
    const label = `${productId}_${userId}_${Date.now()}`;
    const params = new URLSearchParams({
      receiver: this.ymoneyWallet,
      'quickpay-form': 'button',
      targets: product.name,
      paymentType: 'AC', // банковская карта
      sum: product.price_rub,
      label: label,
      successURL: `https://t.me/kurs7botikov_bot?start=payment_${label}`,
    });

    return {
      url: `https://yoomoney.ru/quickpay/confirm?${params.toString()}`,
      label,
      amount: product.price_rub,
    };
  }

  // Сохранить ожидающий платёж ЮMoney
  async savePendingYmoney(label, { userId, productId, amount }) {
    await this.db.push(`/pending_ymoney/${label}`, {
      userId, productId, amount,
      created_at: new Date().toISOString(),
    });
  }

  // Проверить и активировать платёж ЮMoney по label
  async confirmYmoney(label) {
    try {
      const pending = await this.db.getData(`/pending_ymoney/${label}`);
      if (!pending) return null;

      // Активируем Premium
      const premiumData = await this.activatePremium(pending.userId, pending.productId);

      // Записываем платёж
      await this.recordPayment({
        userId: pending.userId,
        username: '', firstName: 'ЮMoney',
        productId: pending.productId,
        amount: pending.amount,
        currency: 'RUB',
        paymentId: label,
      });

      // Удаляем из ожидающих
      await this.db.delete(`/pending_ymoney/${label}`);

      return { premiumData, productId: pending.productId, userId: pending.userId };
    } catch { return null; }
  }

  async getStats() {
    try {
      const payments = await this.db.getData('/payments').catch(() => []);
      const premiumUsers = await this.db.getData('/premium_users').catch(() => ({}));
      const totalRevenue = payments.reduce((s, p) => s + (p.currency === 'RUB' ? p.amount : p.amount * 3), 0);
      const activePremium = Object.values(premiumUsers).filter(u => new Date(u.expires_at) > new Date()).length;
      const byMethod = {
        stars: payments.filter(p => p.currency === 'XTR').length,
        yukassa: payments.filter(p => p.currency === 'RUB' && p.paymentId && p.paymentId.length > 20).length,
        ymoney: payments.filter(p => p.currency === 'RUB' && p.paymentId && p.paymentId.length <= 20).length,
      };
      return { total: payments.length, revenue: Math.round(totalRevenue), activePremium, byMethod };
    } catch { return { total: 0, revenue: 0, activePremium: 0, byMethod: { stars: 0, yukassa: 0, ymoney: 0 } }; }
  }
}

module.exports = PaymentsManager;
module.exports.PRODUCTS = PRODUCTS;
