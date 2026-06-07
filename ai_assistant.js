require('dotenv').config();

// ─── ИИ-ассистент на базе Claude API ─────────────────────────────────────────
// Отвечает на вопросы пользователей про заработок, курсы, партнёрки

const SYSTEM_PROMPT = `Ты — помощник Алисы Бойчук в Telegram-боте @kurs7botikov_bot.
Твоя задача — помогать пользователям разобраться в партнёрском маркетинге, онлайн-заработке и курсах.

Ты знаешь про:
- Партнёрские программы САЛИД (salid.ru) и ИнфоХит (ihclick.ru)
- Офферы: курсы копирайтинга, таргетинга, психологии, ChatGPT, похудения, Reels
- Комиссии: 35-60% с продажи
- Бесплатные способы продвижения: ВКонтакте, Одноклассники, Telegram, YouTube Shorts

Правила:
1. Отвечай по-русски, дружелюбно и кратко (2-4 предложения)
2. Всегда направляй к конкретным действиям в боте
3. Если не знаешь ответа — предложи написать @Imalisa_boychuk
4. Не давай финансовых гарантий
5. В конце ответа всегда добавляй одну кнопку-подсказку из бота`;

class AIAssistant {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.histories = {}; // история диалогов по userId
    this.maxHistory = 6; // максимум сообщений в истории
  }

  isEnabled() {
    return !!this.apiKey;
  }

  async answer(userId, userMessage) {
    if (!this.isEnabled()) {
      return { text: '🤖 ИИ-ассистент временно недоступен. Напиши @Imalisa_boychuk', action: null };
    }

    try {
      // Инициализируем историю
      if (!this.histories[userId]) this.histories[userId] = [];

      // Добавляем вопрос в историю
      this.histories[userId].push({ role: 'user', content: userMessage });

      // Ограничиваем историю
      if (this.histories[userId].length > this.maxHistory) {
        this.histories[userId] = this.histories[userId].slice(-this.maxHistory);
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: this.histories[userId],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || 'Не могу ответить. Напиши @Imalisa_boychuk';

      // Добавляем ответ в историю
      this.histories[userId].push({ role: 'assistant', content: text });

      // Определяем кнопку-подсказку по контексту
      const action = this._detectAction(userMessage + ' ' + text);

      return { text: `🤖 ${text}`, action };
    } catch (e) {
      console.error('AI error:', e.message);
      return { text: '🤖 Произошла ошибка. Напиши @Imalisa_boychuk', action: null };
    }
  }

  clearHistory(userId) {
    delete this.histories[userId];
  }

  _detectAction(text) {
    const lower = text.toLowerCase();
    if (lower.includes('копирайт') || lower.includes('писать')) return { label: '✍️ Курс копирайтинга', data: 'offer_salid_1' };
    if (lower.includes('таргет') || lower.includes('реклам')) return { label: '🎯 Курс таргетолога', data: 'offer_salid_2' };
    if (lower.includes('chatgpt') || lower.includes('ии') || lower.includes('искусственн')) return { label: '🤖 Курс ChatGPT', data: 'offer_ih_2' };
    if (lower.includes('похуд') || lower.includes('здоров')) return { label: '🥗 Курс похудения', data: 'offer_ih_1' };
    if (lower.includes('бесплатн')) return { label: '🎁 Бесплатные курсы', data: 'free_courses' };
    if (lower.includes('реферал') || lower.includes('пригласи')) return { label: '🤝 Реферальная программа', data: 'referral' };
    if (lower.includes('заработ') || lower.includes('деньг')) return { label: '💰 Топ офферы', data: 'top_salid' };
    return { label: '📚 Все офферы', data: 'top_salid' };
  }
}

module.exports = AIAssistant;
