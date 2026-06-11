require('dotenv').config();

// ─── Генератор контента для Яндекс Дзен и Яндекс Q ──────────────────────────
// Использует Groq API для генерации SEO-статей и ответов
// Готовые тексты отправляются админу для публикации

const DZEN_TOPICS = [
  'Как заработать на партнёрках в 2025 году: полный гайд для новичков',
  'Топ-5 курсов для старта удалённой карьеры',
  'Партнёрский маркетинг: сколько можно реально заработать',
  'Как выбрать прибыльный оффер для продвижения',
  'Бесплатные способы продвигать партнёрские ссылки',
  'ChatGPT для заработка: реальные кейсы 2025',
  'Копирайтинг как профессия: с чего начать',
  'Как я зарабатываю на рекомендациях курсов',
];

const YANDEX_Q_QUESTIONS = [
  'Как заработать в интернете без вложений?',
  'Что такое партнёрский маркетинг и как на нём заработать?',
  'Какие онлайн-профессии востребованы в 2025?',
  'Где найти хорошие курсы по копирайтингу?',
  'Как начать зарабатывать на рекомендациях?',
  'Что такое CPA сеть и как с ней работать?',
  'Как выбрать онлайн-курс и не потратить деньги зря?',
  'Можно ли жить на доходы от партнёрок?',
];

class ContentGenerator {
  constructor(adminIds, telegram) {
    this.adminIds = adminIds;
    this.telegram = telegram;
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.dzenIndex = 0;
    this.qIndex = 0;
  }

  isEnabled() {
    return !!this.apiKey;
  }

  async callGroq(prompt) {
    if (!this.apiKey) throw new Error('GROQ_API_KEY не задан');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.apiKey,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 800,
        temperature: 0.8,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  }

  // Генерация статьи для Яндекс Дзен
  async generateDzenArticle(topic) {
    const prompt = 'Напиши короткую статью для Яндекс Дзен на тему: "' + topic + '"\n\n' +
      'Требования:\n' +
      '- Длина 300-400 слов\n' +
      '- Живой разговорный стиль от первого лица\n' +
      '- В конце добавь: "Все лучшие курсы и офферы я собрала в своём Telegram-боте: t.me/kurs7botikov_bot"\n' +
      '- Без лишних заголовков, просто текст\n' +
      '- Только обычный текст без форматирования';

    return await this.callGroq(prompt);
  }

  // Генерация ответа для Яндекс Q
  async generateYandexQAnswer(question) {
    const prompt = 'Напиши экспертный ответ на вопрос с Яндекс Q: "' + question + '"\n\n' +
      'Требования:\n' +
      '- Длина 150-200 слов\n' +
      '- Конкретный и полезный ответ\n' +
      '- От имени Алисы Бойчук — эксперта по партнёрскому маркетингу\n' +
      '- В конце: "Подробнее в моём Telegram-боте: t.me/kurs7botikov_bot"\n' +
      '- Только обычный текст без форматирования и символов';

    return await this.callGroq(prompt);
  }

  // Отправить сгенерированный контент админу
  async sendContentToAdmin(type, title, content) {
    const header = type === 'dzen'
      ? 'СТАТЬЯ ДЛЯ ЯНДЕКС ДЗЕН\n\nТема: ' + title + '\n\nСкопируй и опубликуй на dzen.ru\n\n'
      : 'ОТВЕТ ДЛЯ ЯНДЕКС Q\n\nВопрос: ' + title + '\n\nНайди этот вопрос на q.yandex.ru и скопируй ответ\n\n';

    const fullText = header + '---\n\n' + content;

    // Разбиваем на части если текст длинный
    const maxLen = 4000;
    for (let i = 0; i < fullText.length; i += maxLen) {
      const chunk = fullText.slice(i, i + maxLen);
      for (const adminId of this.adminIds) {
        try {
          await this.telegram.sendMessage(adminId, chunk);
        } catch (e) {}
      }
    }
  }

  // Запуск автогенерации по расписанию
  startAutoGeneration() {
    if (!this.isEnabled()) {
      console.log('Генератор контента: нужен GROQ_API_KEY');
      return;
    }

    // Статья для Дзен каждые 3 дня в 08:00
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 8 && now.getMinutes() === 0 && now.getDate() % 3 === 0) {
        try {
          const topic = DZEN_TOPICS[this.dzenIndex % DZEN_TOPICS.length];
          const article = await this.generateDzenArticle(topic);
          await this.sendContentToAdmin('dzen', topic, article);
          this.dzenIndex++;
          console.log('Дзен статья сгенерирована: ' + topic);
        } catch (e) {
          console.error('Ошибка генерации Дзен:', e.message);
        }
      }

      // Ответ для Яндекс Q каждые 2 дня в 09:00
      if (now.getHours() === 9 && now.getMinutes() === 0 && now.getDate() % 2 === 0) {
        try {
          const question = YANDEX_Q_QUESTIONS[this.qIndex % YANDEX_Q_QUESTIONS.length];
          const answer = await this.generateYandexQAnswer(question);
          await this.sendContentToAdmin('q', question, answer);
          this.qIndex++;
          console.log('Яндекс Q ответ сгенерирован');
        } catch (e) {
          console.error('Ошибка генерации Q:', e.message);
        }
      }
    }, 60 * 1000);

    console.log('Генератор контента запущен (Дзен: каждые 3 дня, Q: каждые 2 дня)');
  }

  getDzenTopics() { return DZEN_TOPICS; }
  getQQuestions() { return YANDEX_Q_QUESTIONS; }
}

module.exports = ContentGenerator;
