require('dotenv').config();
const { JsonDB, Config } = require('node-json-db');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ─── База офферов по умолчанию ────────────────────────────────────────────────
const DEFAULT_OFFERS = {
  salid_1: { id: 'salid_1', source: 'САЛИД', emoji: '✍️', name: 'Курс «Профессия Копирайтер»', price: '5 900 руб', commission: '40%', earnings: '2 360 руб', description: 'Топовый курс по копирайтингу — горячий спрос, высокая конверсия.', url: 'https://salid.ru/?w=973405', tags: ['онлайн', 'профессия'], hot: false, updated_at: new Date().toISOString() },
  salid_2: { id: 'salid_2', source: 'САЛИД', emoji: '🎯', name: 'Курс «Таргетолог с нуля»', price: '12 900 руб', commission: '35%', earnings: '4 515 руб', description: 'Научат настраивать рекламу ВКонтакте и Telegram.', url: 'https://salid.ru/?w=973405', tags: ['реклама', 'SMM'], hot: false, updated_at: new Date().toISOString() },
  salid_3: { id: 'salid_3', source: 'САЛИД', emoji: '❤️', name: 'Курс «Психология отношений»', price: '3 500 руб', commission: '60%', earnings: '2 100 руб', description: 'Вечная тема — высокий спрос, отличная конверсия.', url: 'https://salid.ru/?w=973405', tags: ['психология'], hot: false, updated_at: new Date().toISOString() },
  salid_4: { id: 'salid_4', source: 'САЛИД', emoji: '🆓', name: 'Вебинар «Заработок в интернете»', price: 'БЕСПЛАТНО', commission: '500 руб за регистрацию', earnings: '500 руб', description: 'Бесплатно для пользователя — платят за каждую регистрацию.', url: 'https://salid.ru/?w=973405', tags: ['бесплатно', 'вебинар'], hot: true, updated_at: new Date().toISOString() },
  ih_1: { id: 'ih_1', source: 'ИнфоХит', emoji: '🥗', name: 'Курс «Похудение без диет»', price: '2 990 руб', commission: '50%', earnings: '1 495 руб', description: 'Вечнозелёная ниша здоровья. Огромная аудитория.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['здоровье', 'похудение'], hot: false, updated_at: new Date().toISOString() },
  ih_2: { id: 'ih_2', source: 'ИнфоХит', emoji: '🤖', name: 'Курс «ChatGPT для бизнеса»', price: '4 900 руб', commission: '45%', earnings: '2 205 руб', description: 'Хайповая тема ИИ — огромный спрос в 2025.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['ИИ', 'бизнес'], hot: true, updated_at: new Date().toISOString() },
  ih_3: { id: 'ih_3', source: 'ИнфоХит', emoji: '🎬', name: 'Курс «Заработок на Reels»', price: '1 990 руб', commission: '55%', earnings: '1 095 руб', description: 'Актуально в 2025. Монетизация контента.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['контент', 'SMM'], hot: false, updated_at: new Date().toISOString() },
};

// ─── Большая база новых курсов для ежедневного добавления ─────────────────────
const DAILY_NEW_COURSES = [
  { id: 'd_001', source: 'САЛИД', emoji: '💻', name: 'Курс «Python с нуля»', price: '8 900 руб', commission: '38%', earnings: '3 382 руб', description: 'Программирование — профессия будущего. Высокий спрос в 2025.', url: 'https://salid.ru/?w=973405', tags: ['IT', 'программирование'], hot: true },
  { id: 'd_002', source: 'ИнфоХит', emoji: '💰', name: 'Курс «Инвестиции с нуля»', price: '6 500 руб', commission: '50%', earnings: '3 250 руб', description: 'Финансовая грамотность — тренд 2025. Широкая аудитория.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['финансы', 'инвестиции'], hot: true },
  { id: 'd_003', source: 'САЛИД', emoji: '🎨', name: 'Курс «Графический дизайн»', price: '7 200 руб', commission: '42%', earnings: '3 024 руб', description: 'Профессия дизайнера — удалёнка, фриланс, высокий доход.', url: 'https://salid.ru/?w=973405', tags: ['дизайн', 'фриланс'], hot: false },
  { id: 'd_004', source: 'ИнфоХит', emoji: '🧘', name: 'Курс «Медитация и осознанность»', price: '2 500 руб', commission: '55%', earnings: '1 375 руб', description: 'Вечнозелёная ниша психологии и здоровья.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['психология', 'здоровье'], hot: false },
  { id: 'd_005', source: 'САЛИД', emoji: '📱', name: 'Курс «SMM с нуля до про»', price: '9 900 руб', commission: '40%', earnings: '3 960 руб', description: 'Ведение соцсетей — востребованная профессия.', url: 'https://salid.ru/?w=973405', tags: ['SMM', 'соцсети'], hot: true },
  { id: 'd_006', source: 'ИнфоХит', emoji: '🗣️', name: 'Курс «Ораторское искусство»', price: '3 800 руб', commission: '50%', earnings: '1 900 руб', description: 'Публичные выступления — навык который стоит дорого.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['ораторство', 'личностный рост'], hot: false },
  { id: 'd_007', source: 'САЛИД', emoji: '📊', name: 'Курс «Excel и Google Таблицы»', price: '4 500 руб', commission: '45%', earnings: '2 025 руб', description: 'Нужен в любой профессии. Огромная аудитория.', url: 'https://salid.ru/?w=973405', tags: ['офис', 'таблицы'], hot: false },
  { id: 'd_008', source: 'ИнфоХит', emoji: '🏃', name: 'Курс «Бег для начинающих»', price: '1 900 руб', commission: '55%', earnings: '1 045 руб', description: 'Здоровый образ жизни — вечная ниша с высоким спросом.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['спорт', 'здоровье'], hot: false },
  { id: 'd_009', source: 'САЛИД', emoji: '🤝', name: 'Курс «Переговоры и продажи»', price: '11 000 руб', commission: '38%', earnings: '4 180 руб', description: 'Навык продаж — самый высокооплачиваемый в мире.', url: 'https://salid.ru/?w=973405', tags: ['продажи', 'бизнес'], hot: true },
  { id: 'd_010', source: 'ИнфоХит', emoji: '✈️', name: 'Курс «Заработок на путешествиях»', price: '3 200 руб', commission: '50%', earnings: '1 600 руб', description: 'Тревел-блогинг и монетизация — популярная ниша.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['путешествия', 'блогинг'], hot: false },
  { id: 'd_011', source: 'САЛИД', emoji: '🎵', name: 'Курс «Музыкальное продюсирование»', price: '8 500 руб', commission: '40%', earnings: '3 400 руб', description: 'Создание музыки на компьютере — растущий рынок.', url: 'https://salid.ru/?w=973405', tags: ['музыка', 'творчество'], hot: false },
  { id: 'd_012', source: 'ИнфоХит', emoji: '🍳', name: 'Курс «Правильное питание»', price: '2 200 руб', commission: '55%', earnings: '1 210 руб', description: 'Здоровое питание — вечная тема с широкой аудиторией.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['питание', 'здоровье'], hot: false },
  { id: 'd_013', source: 'САЛИД', emoji: '🌐', name: 'Курс «Создание сайтов на Tilda»', price: '6 800 руб', commission: '42%', earnings: '2 856 руб', description: 'Создание сайтов без кода — популярный навык.', url: 'https://salid.ru/?w=973405', tags: ['сайты', 'IT'], hot: true },
  { id: 'd_014', source: 'ИнфоХит', emoji: '🧠', name: 'Курс «Развитие памяти»', price: '2 800 руб', commission: '50%', earnings: '1 400 руб', description: 'Улучшение памяти и концентрации — востребованная тема.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['саморазвитие', 'мозг'], hot: false },
  { id: 'd_015', source: 'САЛИД', emoji: '📸', name: 'Курс «Фотография с нуля»', price: '7 500 руб', commission: '40%', earnings: '3 000 руб', description: 'Мобильная и профессиональная фотография — большая аудитория.', url: 'https://salid.ru/?w=973405', tags: ['фото', 'творчество'], hot: false },
  { id: 'd_016', source: 'ИнфоХит', emoji: '🗺️', name: 'Курс «Английский за 3 месяца»', price: '9 500 руб', commission: '45%', earnings: '4 275 руб', description: 'Изучение языка — огромный рынок и стабильный спрос.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['английский', 'языки'], hot: true },
  { id: 'd_017', source: 'САЛИД', emoji: '🎮', name: 'Курс «Создание игр на Unity»', price: '12 000 руб', commission: '35%', earnings: '4 200 руб', description: 'Разработка игр — высокооплачиваемая IT-профессия.', url: 'https://salid.ru/?w=973405', tags: ['игры', 'IT', 'программирование'], hot: false },
  { id: 'd_018', source: 'ИнфоХит', emoji: '🏠', name: 'Курс «Заработок на недвижимости»', price: '15 000 руб', commission: '40%', earnings: '6 000 руб', description: 'Инвестиции в недвижимость — высокий чек, большие комиссии.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['недвижимость', 'инвестиции'], hot: true },
  { id: 'd_019', source: 'САЛИД', emoji: '✂️', name: 'Курс «Видеомонтаж»', price: '5 500 руб', commission: '42%', earnings: '2 310 руб', description: 'Монтаж видео — востребованный навык для блогеров.', url: 'https://salid.ru/?w=973405', tags: ['видео', 'контент'], hot: false },
  { id: 'd_020', source: 'ИнфоХит', emoji: '💆', name: 'Курс «Стресс-менеджмент»', price: '3 100 руб', commission: '52%', earnings: '1 612 руб', description: 'Управление стрессом — актуально для всех.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['психология', 'здоровье'], hot: false },
  { id: 'd_021', source: 'САЛИД', emoji: '📦', name: 'Курс «Бизнес на Wildberries»', price: '14 900 руб', commission: '35%', earnings: '5 215 руб', description: 'Маркетплейсы — один из самых горячих трендов 2025.', url: 'https://salid.ru/?w=973405', tags: ['маркетплейс', 'бизнес', 'WB'], hot: true },
  { id: 'd_022', source: 'ИнфоХит', emoji: '🌿', name: 'Курс «Уход за кожей лица»', price: '2 700 руб', commission: '55%', earnings: '1 485 руб', description: 'Бьюти-ниша — огромная женская аудитория.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['красота', 'уход'], hot: false },
  { id: 'd_023', source: 'САЛИД', emoji: '🤑', name: 'Курс «Трейдинг для начинающих»', price: '16 000 руб', commission: '35%', earnings: '5 600 руб', description: 'Торговля на бирже — высокий интерес и большие чеки.', url: 'https://salid.ru/?w=973405', tags: ['трейдинг', 'финансы'], hot: true },
  { id: 'd_024', source: 'ИнфоХит', emoji: '🎤', name: 'Курс «Вокал с нуля»', price: '4 200 руб', commission: '48%', earnings: '2 016 руб', description: 'Развитие голоса и вокала — творческая ниша.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['музыка', 'вокал'], hot: false },
  { id: 'd_025', source: 'САЛИД', emoji: '🏋️', name: 'Курс «Домашние тренировки»', price: '2 400 руб', commission: '55%', earnings: '1 320 руб', description: 'Фитнес дома — массовая аудитория, стабильный спрос.', url: 'https://salid.ru/?w=973405', tags: ['фитнес', 'спорт'], hot: false },
  { id: 'd_026', source: 'ИнфоХит', emoji: '🖥️', name: 'Курс «Удалённая работа»', price: '5 900 руб', commission: '45%', earnings: '2 655 руб', description: 'Как найти удалённую работу — актуально для всех.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['удалёнка', 'карьера'], hot: true },
  { id: 'd_027', source: 'САЛИД', emoji: '🎭', name: 'Курс «Актёрское мастерство»', price: '6 000 руб', commission: '42%', earnings: '2 520 руб', description: 'Навыки публичности для блогеров и бизнеса.', url: 'https://salid.ru/?w=973405', tags: ['актёрство', 'публичность'], hot: false },
  { id: 'd_028', source: 'ИнфоХит', emoji: '🧩', name: 'Курс «Логическое мышление»', price: '3 500 руб', commission: '50%', earnings: '1 750 руб', description: 'Развитие критического мышления — востребовано везде.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['мышление', 'саморазвитие'], hot: false },
  { id: 'd_029', source: 'САЛИД', emoji: '🐾', name: 'Курс «Зоопсихология»', price: '4 800 руб', commission: '48%', earnings: '2 304 руб', description: 'Работа с животными — уникальная ниша.', url: 'https://salid.ru/?w=973405', tags: ['животные', 'психология'], hot: false },
  { id: 'd_030', source: 'ИнфоХит', emoji: '🌍', name: 'Курс «Китайский язык»', price: '11 000 руб', commission: '40%', earnings: '4 400 руб', description: 'Китайский — язык будущего. Растущий рынок.', url: 'https://ihclick.ru/?idp=326805&link=/', tags: ['языки', 'китайский'], hot: true },
];

class OffersUpdater {
  constructor(telegram, adminIds) {
    this.telegram = telegram;
    this.adminIds = adminIds;
    this.db = new JsonDB(new Config(path.join(dataDir, 'offers'), true, true, '/'));
    this.weekIndex = 0;
    this.dailyIndex = 0;
  }

  async init() {
    try { await this.db.getData('/offers'); } catch { await this.db.push('/offers', DEFAULT_OFFERS); }
    try { await this.db.getData('/last_updated'); } catch { await this.db.push('/last_updated', new Date().toISOString()); }
    try { await this.db.getData('/week_index'); } catch { await this.db.push('/week_index', 0); }
    try { this.weekIndex = await this.db.getData('/week_index'); } catch { this.weekIndex = 0; }
    try { this.dailyIndex = await this.db.getData('/daily_index'); } catch { this.dailyIndex = 0; }
    console.log('📦 Менеджер офферов инициализирован');
  }

  async getOffers() {
    try { return await this.db.getData('/offers'); } catch { return DEFAULT_OFFERS; }
  }

  async getLastUpdated() {
    try { return await this.db.getData('/last_updated'); } catch { return new Date().toISOString(); }
  }

  // ─── Еженедельное обновление (пн 08:00) ──────────────────────────────────────
  startWeeklyUpdate() {
    setInterval(async () => {
      const now = new Date();
      if (now.getDay() === 1 && now.getHours() === 8 && now.getMinutes() === 0) {
        await this.runWeeklyUpdate();
      }
    }, 60 * 1000);
    console.log('📅 Еженедельное обновление офферов запланировано (пн 08:00)');
  }

  // ─── Ежедневное добавление нового курса (каждый день 10:00) ──────────────────
  startDailyUpdate() {
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 10 && now.getMinutes() === 0) {
        await this.addDailyCourse();
      }
    }, 60 * 1000);
    console.log('📅 Ежедневное добавление курса запланировано (10:00)');
  }

  async addDailyCourse(manual = false) {
    try {
      const offers = await this.getOffers();
      const course = DAILY_NEW_COURSES[this.dailyIndex % DAILY_NEW_COURSES.length];
      course.updated_at = new Date().toISOString();
      course.hot = true;

      // Убираем hot у предыдущего ежедневного курса
      const prevIndex = (this.dailyIndex - 1 + DAILY_NEW_COURSES.length) % DAILY_NEW_COURSES.length;
      const prevId = 'd_' + String(prevIndex + 1).padStart(3, '0');
      if (offers[prevId]) offers[prevId].hot = false;

      offers[course.id] = course;
      await this.db.push('/offers', offers);
      await this.db.push('/last_updated', new Date().toISOString());

      this.dailyIndex = (this.dailyIndex + 1) % DAILY_NEW_COURSES.length;
      await this.db.push('/daily_index', this.dailyIndex);

      // Уведомляем канал о новом курсе
      const channelMsg =
        '🆕 Новый курс!\n\n' +
        course.emoji + ' ' + course.name + '\n' +
        'Цена: ' + course.price + '\n' +
        'Комиссия: ' + course.commission + ' (' + course.earnings + ')\n\n' +
        course.description + '\n\n' +
        'Переходи в бот и забирай партнёрскую ссылку!';

      try {
        await this.telegram.sendMessage('@kanalKursov7', channelMsg, {
          reply_markup: { inline_keyboard: [[{ text: 'Получить ссылку', url: 'https://t.me/kurs7botikov_bot' }]] }
        });
      } catch (e) {}

      // Уведомляем админа
      for (const adminId of this.adminIds) {
        try {
          await this.telegram.sendMessage(adminId,
            '📦 Новый курс добавлен!\n\n' +
            course.emoji + ' ' + course.name + '\n' +
            'Источник: ' + course.source + '\n' +
            'Комиссия: ' + course.commission + '\n' +
            'Всего курсов: ' + Object.keys(offers).length
          );
        } catch (e) {}
      }

      console.log('Новый курс добавлен: ' + course.name);
      return { success: true, course, total: Object.keys(offers).length };
    } catch (e) {
      console.error('Ошибка добавления курса:', e.message);
      return { success: false, error: e.message };
    }
  }

  async runWeeklyUpdate(manual = false) {
    try {
      const offers = await this.getOffers();
      const updatedAt = new Date().toISOString();

      // Убираем hot у старых
      for (const id of Object.keys(offers)) {
        if (!['salid_4', 'ih_2'].includes(id)) offers[id].hot = false;
      }

      await this.db.push('/offers', offers);
      await this.db.push('/last_updated', updatedAt);
      this.weekIndex = (this.weekIndex + 1) % 4;
      await this.db.push('/week_index', this.weekIndex);

      for (const adminId of this.adminIds) {
        try {
          await this.telegram.sendMessage(adminId,
            (manual ? 'Обновление вручную' : 'Еженедельное обновление') + '\nВсего офферов: ' + Object.keys(offers).length
          );
        } catch (e) {}
      }

      return { success: true, total: Object.keys(offers).length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getStatus() {
    const offers = await this.getOffers();
    const lastUpdated = await this.getLastUpdated();
    const hotOffers = Object.values(offers).filter(o => o.hot).length;
    const salidCount = Object.values(offers).filter(o => o.source === 'САЛИД').length;
    const ihCount = Object.values(offers).filter(o => o.source === 'ИнфоХит').length;
    const nextDailyIndex = this.dailyIndex % DAILY_NEW_COURSES.length;
    const nextCourse = DAILY_NEW_COURSES[nextDailyIndex];
    return {
      total: Object.keys(offers).length,
      hot: hotOffers,
      salid: salidCount,
      infohit: ihCount,
      lastUpdated,
      nextCourse: nextCourse ? nextCourse.name : 'все курсы добавлены',
      totalInPool: DAILY_NEW_COURSES.length,
    };
  }
}

module.exports = OffersUpdater;
