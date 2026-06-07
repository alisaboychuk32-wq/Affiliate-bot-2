require('dotenv').config();
const { JsonDB, Config } = require('node-json-db');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ─── База офферов (обновляется каждую неделю) ────────────────────────────────
const DEFAULT_OFFERS = {
  salid_1: {
    id: 'salid_1', source: 'САЛИД', emoji: '✍️',
    name: 'Курс «Профессия Копирайтер»',
    price: '5 900 ₽', commission: '40%', earnings: '2 360 ₽',
    description: 'Топовый курс по копирайтингу — горячий спрос, высокая конверсия.',
    url: 'https://salid.ru/?w=973405',
    tags: ['онлайн', 'профессия', 'удалёнка'], hot: false,
    updated_at: new Date().toISOString(),
  },
  salid_2: {
    id: 'salid_2', source: 'САЛИД', emoji: '🎯',
    name: 'Курс «Таргетолог с нуля»',
    price: '12 900 ₽', commission: '35%', earnings: '4 515 ₽',
    description: 'Научат настраивать рекламу ВКонтакте и Telegram.',
    url: 'https://salid.ru/?w=973405',
    tags: ['реклама', 'SMM', 'фриланс'], hot: false,
    updated_at: new Date().toISOString(),
  },
  salid_3: {
    id: 'salid_3', source: 'САЛИД', emoji: '❤️',
    name: 'Курс «Психология отношений»',
    price: '3 500 ₽', commission: '60%', earnings: '2 100 ₽',
    description: 'Вечная тема — высокий спрос, отличная конверсия.',
    url: 'https://salid.ru/?w=973405',
    tags: ['психология', 'саморазвитие'], hot: false,
    updated_at: new Date().toISOString(),
  },
  salid_4: {
    id: 'salid_4', source: 'САЛИД', emoji: '🆓',
    name: 'Бесплатный вебинар «Заработок в интернете»',
    price: 'БЕСПЛАТНО', commission: '500 ₽ за регистрацию', earnings: '500 ₽',
    description: 'Продвигать проще всего — бесплатно для пользователя.',
    url: 'https://salid.ru/?w=973405',
    tags: ['бесплатно', 'заработок', 'вебинар'], hot: true,
    updated_at: new Date().toISOString(),
  },
  ih_1: {
    id: 'ih_1', source: 'ИнфоХит', emoji: '🥗',
    name: 'Курс «Похудение без диет»',
    price: '2 990 ₽', commission: '50%', earnings: '1 495 ₽',
    description: 'Вечнозелёная ниша здоровья. Огромная аудитория.',
    url: 'https://ihclick.ru/?idp=326805&link=/',
    tags: ['здоровье', 'похудение'], hot: false,
    updated_at: new Date().toISOString(),
  },
  ih_2: {
    id: 'ih_2', source: 'ИнфоХит', emoji: '🤖',
    name: 'Курс «ChatGPT для бизнеса»',
    price: '4 900 ₽', commission: '45%', earnings: '2 205 ₽',
    description: 'Хайповая тема ИИ — огромный спрос в 2025.',
    url: 'https://ihclick.ru/?idp=326805&link=/',
    tags: ['ИИ', 'технологии', 'бизнес'], hot: true,
    updated_at: new Date().toISOString(),
  },
  ih_3: {
    id: 'ih_3', source: 'ИнфоХит', emoji: '🎬',
    name: 'Курс «Заработок на Reels»',
    price: '1 990 ₽', commission: '55%', earnings: '1 095 ₽',
    description: 'Актуально в 2025. Монетизация контента.',
    url: 'https://ihclick.ru/?idp=326805&link=/',
    tags: ['контент', 'SMM', 'заработок'], hot: false,
    updated_at: new Date().toISOString(),
  },
};

// Новые офферы добавляются в ротацию каждую неделю
const WEEKLY_NEW_OFFERS = [
  // Неделя 1
  [
    {
      id: 'salid_w1', source: 'САЛИД', emoji: '💻',
      name: 'Курс «Python для начинающих»',
      price: '8 900 ₽', commission: '38%', earnings: '3 382 ₽',
      description: 'Программирование — профессия будущего. Высокий спрос.',
      url: 'https://salid.ru/?w=973405',
      tags: ['IT', 'программирование', 'профессия'], hot: true,
    },
  ],
  // Неделя 2
  [
    {
      id: 'ih_w2', source: 'ИнфоХит', emoji: '💰',
      name: 'Курс «Инвестиции с нуля»',
      price: '6 500 ₽', commission: '50%', earnings: '3 250 ₽',
      description: 'Финансовая грамотность — тренд 2025. Широкая аудитория.',
      url: 'https://ihclick.ru/?idp=326805&link=/',
      tags: ['финансы', 'инвестиции', 'деньги'], hot: true,
    },
  ],
  // Неделя 3
  [
    {
      id: 'salid_w3', source: 'САЛИД', emoji: '🎨',
      name: 'Курс «Графический дизайн»',
      price: '7 200 ₽', commission: '42%', earnings: '3 024 ₽',
      description: 'Профессия дизайнера — удалёнка, фриланс, высокий доход.',
      url: 'https://salid.ru/?w=973405',
      tags: ['дизайн', 'творчество', 'фриланс'], hot: false,
    },
  ],
  // Неделя 4
  [
    {
      id: 'ih_w4', source: 'ИнфоХит', emoji: '🧘',
      name: 'Курс «Медитация и осознанность»',
      price: '2 500 ₽', commission: '55%', earnings: '1 375 ₽',
      description: 'Вечнозелёная ниша психологии и здоровья.',
      url: 'https://ihclick.ru/?idp=326805&link=/',
      tags: ['психология', 'здоровье', 'саморазвитие'], hot: false,
    },
  ],
];

class OffersUpdater {
  constructor(telegram, adminIds) {
    this.telegram = telegram;
    this.adminIds = adminIds;
    this.db = new JsonDB(new Config(path.join(dataDir, 'offers'), true, true, '/'));
    this.weekIndex = 0;
  }

  async init() {
    try {
      await this.db.getData('/offers');
    } catch {
      await this.db.push('/offers', DEFAULT_OFFERS);
      await this.db.push('/last_updated', new Date().toISOString());
      await this.db.push('/week_index', 0);
    }
    try {
      this.weekIndex = await this.db.getData('/week_index');
    } catch {
      this.weekIndex = 0;
    }
    console.log('📦 Менеджер офферов инициализирован');
  }

  async getOffers() {
    try {
      return await this.db.getData('/offers');
    } catch {
      return DEFAULT_OFFERS;
    }
  }

  async getLastUpdated() {
    try {
      return await this.db.getData('/last_updated');
    } catch {
      return new Date().toISOString();
    }
  }

  // Запуск еженедельного обновления
  startWeeklyUpdate() {
    // Проверяем каждый час — не пришло ли время обновления (понедельник 08:00)
    setInterval(async () => {
      const now = new Date();
      if (now.getDay() === 1 && now.getHours() === 8 && now.getMinutes() === 0) {
        await this.runWeeklyUpdate();
      }
    }, 60 * 1000);

    console.log('📅 Еженедельное обновление офферов запланировано (пн 08:00)');
  }

  async runWeeklyUpdate(manual = false) {
    try {
      console.log('🔄 Обновление офферов...');

      // Получаем текущие офферы
      const currentOffers = await this.getOffers();

      // Добавляем новый оффер недели
      const newWeekOffers = WEEKLY_NEW_OFFERS[this.weekIndex % WEEKLY_NEW_OFFERS.length];
      const updatedAt = new Date().toISOString();

      for (const offer of newWeekOffers) {
        offer.updated_at = updatedAt;
        offer.hot = true; // новый оффер всегда горячий
        currentOffers[offer.id] = offer;
      }

      // Убираем метку hot у старых офферов (кроме постоянно горячих)
      const permanentHot = ['salid_4', 'ih_2'];
      for (const [id, offer] of Object.entries(currentOffers)) {
        if (!permanentHot.includes(id) && !newWeekOffers.find(o => o.id === id)) {
          currentOffers[id].hot = false;
        }
      }

      // Сохраняем
      await this.db.push('/offers', currentOffers);
      await this.db.push('/last_updated', updatedAt);
      this.weekIndex = (this.weekIndex + 1) % WEEKLY_NEW_OFFERS.length;
      await this.db.push('/week_index', this.weekIndex);

      // Уведомляем админа
      const newOfferNames = newWeekOffers.map(o => `${o.emoji} ${o.name}`).join('\n');
      const msg =
        `🔄 *Офферы обновлены!*\n\n` +
        `${manual ? '👤 Обновление вручную' : '📅 Еженедельное обновление'}\n` +
        `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК\n\n` +
        `✨ *Новые офферы этой недели:*\n${newOfferNames}\n\n` +
        `📊 Всего офферов в базе: *${Object.keys(currentOffers).length}*`;

      for (const adminId of this.adminIds) {
        try {
          await this.telegram.sendMessage(adminId, msg, { parse_mode: 'Markdown' });
        } catch (e) {}
      }

      console.log(`✅ Офферы обновлены. Новых: ${newWeekOffers.length}`);
      return { success: true, newOffers: newWeekOffers, total: Object.keys(currentOffers).length };
    } catch (e) {
      console.error('❌ Ошибка обновления офферов:', e.message);
      return { success: false, error: e.message };
    }
  }

  // Добавить оффер вручную из админки
  async addOffer(offer) {
    const offers = await this.getOffers();
    offer.updated_at = new Date().toISOString();
    offers[offer.id] = offer;
    await this.db.push('/offers', offers);
    return offers;
  }

  // Удалить оффер из админки
  async removeOffer(offerId) {
    const offers = await this.getOffers();
    delete offers[offerId];
    await this.db.push('/offers', offers);
    return offers;
  }

  // Статус для админки
  async getStatus() {
    const offers = await this.getOffers();
    const lastUpdated = await this.getLastUpdated();
    const hotOffers = Object.values(offers).filter(o => o.hot).length;
    const salidCount = Object.values(offers).filter(o => o.source === 'САЛИД').length;
    const ihCount = Object.values(offers).filter(o => o.source === 'ИнфоХит').length;
    return {
      total: Object.keys(offers).length,
      hot: hotOffers,
      salid: salidCount,
      infohit: ihCount,
      lastUpdated,
      weekIndex: this.weekIndex,
      nextUpdate: `Неделя ${this.weekIndex + 1} из ${WEEKLY_NEW_OFFERS.length}`,
    };
  }
}

module.exports = OffersUpdater;
