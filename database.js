const { JsonDB, Config } = require('node-json-db');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

class Database {
  constructor() {
    this.db = new JsonDB(new Config(path.join(dataDir, 'bot'), true, true, '/'));
  }

  async init() {
    try { await this.db.getData('/users'); } catch { await this.db.push('/users', {}); }
    try { await this.db.getData('/events'); } catch { await this.db.push('/events', []); }
    try { await this.db.getData('/errors'); } catch { await this.db.push('/errors', []); }
    try { await this.db.getData('/referrals'); } catch { await this.db.push('/referrals', {}); }
    return Promise.resolve();
  }

  async upsertUser(user) {
    try {
      const existing = await this.getUser(user.id);
      if (!existing) {
        const newUser = {
          ...user,
          blocked: false,
          warmup_step: 0,
          warmup_next_at: Date.now() + 60 * 60 * 1000,
          referrals: 0,
          clicks: 0,
          conversions: 0,
        };
        await this.db.push(`/users/${user.id}`, newUser);
      } else {
        await this.db.push(`/users/${user.id}/username`, user.username || '');
        await this.db.push(`/users/${user.id}/first_name`, user.first_name || '');
        await this.db.push(`/users/${user.id}/last_active`, user.last_active);
      }
    } catch (e) { console.error('upsertUser error:', e.message); }
  }

  async getUser(id) {
    try { return await this.db.getData(`/users/${id}`); } catch { return null; }
  }

  async getAllUsers(onlyActive = false) {
    try {
      const users = await this.db.getData('/users');
      const list = Object.values(users);
      return onlyActive ? list.filter(u => !u.blocked) : list;
    } catch { return []; }
  }

  async getUsersForWarmup(now) {
    try {
      const users = await this.db.getData('/users');
      return Object.values(users).filter(u =>
        !u.blocked &&
        u.warmup_step < 3 &&
        u.warmup_next_at > 0 &&
        u.warmup_next_at <= now
      );
    } catch { return []; }
  }

  async markWarmupSent(userId, currentStep) {
    const delays = [24 * 60 * 60 * 1000, 48 * 60 * 60 * 1000, 0];
    const nextStep = currentStep + 1;
    const nextAt = nextStep < 3 ? Date.now() + delays[currentStep] : 0;
    await this.db.push(`/users/${userId}/warmup_step`, nextStep);
    await this.db.push(`/users/${userId}/warmup_next_at`, nextAt);
  }

  async markUserBlocked(userId) {
    try { await this.db.push(`/users/${userId}/blocked`, true); } catch {}
  }

  async addReferral({ referrer_id, referred_id }) {
    try {
      await this.db.push(`/referrals/${referred_id}`, referrer_id);
      const current = await this.db.getData(`/users/${referrer_id}/referrals`);
      await this.db.push(`/users/${referrer_id}/referrals`, (current || 0) + 1);
    } catch {}
  }

  async incrementStat(userId, field) {
    try {
      const current = await this.db.getData(`/users/${userId}/${field}`);
      await this.db.push(`/users/${userId}/${field}`, (current || 0) + 1);
    } catch {}
  }

  async getUserStats(userId) {
    const user = await this.getUser(userId);
    return user ? { referrals: user.referrals || 0, clicks: user.clicks || 0, conversions: user.conversions || 0 } : {};
  }

  async logEvent({ user_id, type, data }) {
    try {
      await this.db.push('/events[]', { user_id, type, data: JSON.stringify(data), created_at: new Date().toISOString() }, true);
    } catch {}
  }

  async logError(message, stack) {
    try {
      await this.db.push('/errors[]', { message, stack: stack || '', created_at: new Date().toISOString() }, true);
    } catch {}
  }

  async getGlobalStats() {
    try {
      const users = Object.values(await this.db.getData('/users').catch(() => ({})));
      const events = await this.db.getData('/events').catch(() => []);
      const errors = await this.db.getData('/errors').catch(() => []);

      const totalUsers = users.length;
      const activeUsers = users.filter(u => !u.blocked).length;
      const blockedUsers = users.filter(u => u.blocked).length;
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const todayUsers = users.filter(u => u.joined_at && u.joined_at.slice(0, 10) === today).length;
      const weekUsers = users.filter(u => u.joined_at && u.joined_at.slice(0, 10) >= weekAgo).length;
      const totalClicks = users.reduce((s, u) => s + (u.clicks || 0), 0);
      const totalReferrals = users.reduce((s, u) => s + (u.referrals || 0), 0);
      const totalConversions = users.reduce((s, u) => s + (u.conversions || 0), 0);

      // Funnel stats
      const funnelMap = {};
      events.filter(e => e.type === 'funnel_enter').forEach(e => {
        funnelMap[e.data] = (funnelMap[e.data] || 0) + 1;
      });
      const funnelStats = Object.entries(funnelMap).map(([data, cnt]) => ({ data, cnt })).sort((a, b) => b.cnt - a.cnt);

      // Offer stats
      const offerMap = {};
      events.filter(e => e.type === 'offer_click').forEach(e => {
        offerMap[e.data] = (offerMap[e.data] || 0) + 1;
      });
      const offerStats = Object.entries(offerMap).map(([data, cnt]) => ({ data, cnt })).sort((a, b) => b.cnt - a.cnt).slice(0, 10);

      // Daily growth last 14 days
      const dailyMap = {};
      users.forEach(u => {
        if (u.joined_at) {
          const day = u.joined_at.slice(0, 10);
          dailyMap[day] = (dailyMap[day] || 0) + 1;
        }
      });
      const dailyGrowth = Object.entries(dailyMap).map(([day, cnt]) => ({ day, cnt })).sort((a, b) => a.day.localeCompare(b.day)).slice(-14);

      return { totalUsers, activeUsers, blockedUsers, todayUsers, weekUsers, totalClicks, totalReferrals, totalConversions, funnelStats, offerStats, dailyGrowth };
    } catch (e) {
      return { totalUsers: 0, activeUsers: 0, blockedUsers: 0, todayUsers: 0, weekUsers: 0, totalClicks: 0, totalReferrals: 0, totalConversions: 0, funnelStats: [], offerStats: [], dailyGrowth: [] };
    }
  }

  async getRecentUsers(limit = 20) {
    try {
      const users = Object.values(await this.db.getData('/users').catch(() => ({})));
      return users.sort((a, b) => (b.joined_at || '').localeCompare(a.joined_at || '')).slice(0, limit);
    } catch { return []; }
  }

  async getErrors(limit = 10) {
    try {
      const errors = await this.db.getData('/errors');
      return errors.slice(-limit).reverse();
    } catch { return []; }
  }

  async getTopReferrers(limit = 10) {
    try {
      const users = Object.values(await this.db.getData('/users').catch(() => ({})));
      return users.filter(u => u.referrals > 0).sort((a, b) => b.referrals - a.referrals).slice(0, limit);
    } catch { return []; }
  }
}

module.exports = Database;
