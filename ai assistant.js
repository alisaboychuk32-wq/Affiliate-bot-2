require('dotenv').config();

// ─── ИИ-ассистент на базе Groq (бесплатно, очень быстро) ─────────────────────
// Модель: llama-3.1-8b-instant — быстрая и умная
// Получить ключ: https://console.groq.com → API Keys → Create API Key

const SYSTEM_PROMPT = 'Ты помощник Алисы Бойчук в Telegram-боте о партнёрском маркетинге. Помогаешь пользователям разобраться в заработке на партнёрках, выборе офферов и курсов. Знаешь про САЛИД и ИнфоХит. Отвечай по-русски, дружелюбно и кратко (2-4 предложения). Используй только обычный текст без форматирования.';

class AIAssistant {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.histories = {};
    this.maxHistory = 6;
  }

  isEnabled() {
    return !!this.apiKey;
  }

  cleanText(text) {
    return text
      .replace(/[*_`\[\]()#+\-=|{}.!]/g, ' ')
      .replace(/@/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async answer(userId, userMessage) {
    if (!this.isEnabled()) {
      return { text: 'ИИ-ассистент временно недоступен. Напиши администратору.', action: null };
    }

    try {
      if (!this.histories[userId]) this.histories[userId] = [];

      this.histories[userId].push({ role: 'user', content: userMessage });

      if (this.histories[userId].length > this.maxHistory) {
        this.histories[userId] = this.histories[userId].slice(-this.maxHistory);
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.apiKey,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          max_tokens: 300,
          temperature: 0.7,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...this.histories[userId],
          ],
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error('Groq API error:', data.error);
        return { text: 'Произошла ошибка. Попробуй позже.', action: null };
      }

      const rawText = data.choices?.[0]?.message?.content || 'Не могу ответить. Попробуй переформулировать вопрос.';
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
