require('dotenv').config();

const SYSTEM_PROMPT = 'Ты помощник Алисы Бойчук в Telegram-боте. Помогаешь пользователям разобраться в партнёрском маркетинге, онлайн-заработке и курсах. Знаешь про САЛИД и ИнфоХит. Отвечай по-русски, дружелюбно и кратко (2-4 предложения). Не используй символы * _ ` [ ] ( ) # + - = | { } . ! в ответах — только обычный текст.';

class AIAssistant {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.histories = {};
    this.maxHistory = 6;
  }

  isEnabled() {
    return !!this.apiKey;
  }

  // Убираем все Markdown символы из текста
  cleanText(text) {
    return text
      .replace(/[*_`\[\]()#+=|{}.!]/g, '')
      .replace(/@/g, '')
      .trim();
  }

  async answer(userId, userMessage) {
    if (!this.isEnabled()) {
      return { text: 'ИИ-ассистент временно недоступен. Напиши Imalisa_boychuk в Telegram', action: null };
    }

    try {
      if (!this.histories[userId]) this.histories[userId] = [];

      this.histories[userId].push({ role: 'user', content: userMessage });

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

      if (data.error) {
        console.error('AI API error:', data.error);
        return { text: 'Произошла ошибка ИИ. Попробуй позже или напиши администратору.', action: null };
      }

      const rawText = data.content?.[0]?.text || 'Не могу ответить. Попробуй переформулировать вопрос.';

      // Очищаем текст от Markdown символов чтобы не ломать Telegram
      const cleanedText = this.cleanText(rawText);

      this.histories[userId].push({ role: 'assistant', content: rawText });

      const action = this._detectAction(userMessage + ' ' + rawText);

      return { text: '🤖 ' + cleanedText, action };
    } catch (e) {
      console.error('AI error:', e.message);
      return { text: 'Произошла ошибка. Попробуй позже.', action: null };
    }
  }

  clearHistory(userId) {
    delete this.histories[userId];
  }

  _detectAction(text) {
    const lower = text.toLowerCase();
    if (lower.includes('копирайт') || lower.includes('писать')) return { label: 'Курс копирайтинга', data: 'offer_salid_1' };
    if (lower.includes('таргет') || lower.includes('реклам')) return { label: 'Курс таргетолога', data: 'offer_salid_2' };
    if (lower.includes('chatgpt') || lower.includes('ии') || lower.includes('искусственн')) return { label: 'Курс ChatGPT', data: 'offer_ih_2' };
    if (lower.includes('похуд') || lower.includes('здоров')) return { label: 'Курс похудения', data: 'offer_ih_1' };
    if (lower.includes('бесплатн')) return { label: 'Бесплатные курсы', data: 'free_courses' };
    if (lower.includes('реферал') || lower.includes('пригласи')) return { label: 'Реферальная программа', data: 'referral' };
    return { label: 'Топ офферы', data: 'top_salid' };
  }
}

module.exports = AIAssistant;
