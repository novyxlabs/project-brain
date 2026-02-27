const axios = require('axios');
require('dotenv').config();

class ProjectBrain {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.NOVYX_API_KEY;
    this.apiUrl = config.apiUrl || process.env.NOVYX_API_URL || 'https://novyx-ram-api.fly.dev';
    
    if (!this.apiKey) {
      console.warn('⚠️ ProjectBrain: NOVYX_API_KEY is not set. Memory features disabled.');
    }
  }

  // --- Core Methods ---

  async save(content, sessionId, role = 'user') {
    if (!this.apiKey) return;

    try {
      console.log(`[ProjectBrain] Saving: "${content.substring(0, 50)}..."`);
      await axios.post(`${this.apiUrl}/v1/memories`, {
        observation: content,
        tags: [`role:${role}`, `session:${sessionId}`, 'project-context']
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      console.log(`[ProjectBrain] ✅ Saved.`);
    } catch (error) {
      console.error('[ProjectBrain] ❌ Save Error:', error.response ? error.response.data : error.message);
    }
  }

  async recall(query, limit = 3) {
    if (!this.apiKey) return [];

    try {
      console.log(`[ProjectBrain] Recalling: "${query}"`);
      const response = await axios.get(`${this.apiUrl}/v1/memories/search`, {
        params: {
          q: query,
          limit: limit
        },
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data.memories || [];
    } catch (error) {
      console.error('[ProjectBrain] ❌ Recall Error:', error.response ? error.response.data : error.message);
      return [];
    }
  }

  async getStats() {
    if (!this.apiKey) return { used: 0, limit: 0 };
    try {
      const response = await axios.get(`${this.apiUrl}/v1/usage`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return {
        used: response.data.memories?.current || 0,
        limit: response.data.memories?.limit || 0
      };
    } catch (error) {
      console.error('[ProjectBrain] Stats Error:', error.response ? error.response.data : error.message);
      return { used: 0, limit: 0 };
    }
  }

  // --- Logic ---

  isTechnical(text) {
    const keywords = ['stack', 'database', 'auth', 'api', 'bug', 'error', 'fix', 'deploy', 'config', 'env', 'why', 'how', 'use', 'prefer'];
    return keywords.some(k => text.toLowerCase().includes(k));
  }
}

// --- Test Script ---
async function runTest() {
  const brain = new ProjectBrain({
    apiKey: process.env.NOVYX_API_KEY
  });

  const sessionId = `test-project-${Date.now()}`;

  console.log('--- 🧪 ProjectBrain Test Suite ---');

  // 1. Simulate User defining stack
  const msg1 = "For this project, we decided to use Postgres for the database and Supabase for auth.";
  if (brain.isTechnical(msg1)) {
    await brain.save(msg1, sessionId, 'user');
  }

  // 2. Simulate User defining a preference
  const msg2 = "I prefer using Tailwind CSS over Bootstrap.";
  if (brain.isTechnical(msg2)) {
    await brain.save(msg2, sessionId, 'user');
  }

  // Wait for indexing (simulated delay if needed, usually instant)
  console.log('--- ⏳ Waiting for indexing... ---');
  await new Promise(r => setTimeout(r, 2000));

  // 3. Test Recall: "What database?"
  const query1 = "Which database are we using?";
  const recall1 = await brain.recall(query1);
  console.log(`\nQ: "${query1}"`);
  recall1.forEach(m => console.log(`   🧠 Found: "${m.observation}" (Score: ${m.score})`));

  // 4. Test Recall: "CSS preference"
  const query2 = "What CSS framework do I like?";
  const recall2 = await brain.recall(query2);
  console.log(`\nQ: "${query2}"`);
  recall2.forEach(m => console.log(`   🧠 Found: "${m.observation}" (Score: ${m.score})`));

  // 5. Test Stats
  const stats = await brain.getStats();
  console.log(`\n📊 Stats: ${stats.used} / ${stats.limit} memories used.`);
}

if (require.main === module) {
  runTest();
}

module.exports = ProjectBrain;
