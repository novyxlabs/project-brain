const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment variables if .env exists
require('dotenv').config();

class ProjectBrain {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.NOVYX_API_KEY;
    this.apiUrl = config.apiUrl || process.env.NOVYX_API_URL || 'https://novyx-ram-api.fly.dev';
    
    if (!this.apiKey) {
      console.warn('⚠️ ProjectBrain: NOVYX_API_KEY is not set. Memory features disabled.');
    }
    
    this.commands = [
      { trigger: '/brain status', handler: this.handleStatus.bind(this) },
      { trigger: '/brain stats', handler: this.handleStats.bind(this) },
      { trigger: '/brain recall', handler: this.handleRecall.bind(this) }
    ];
  }

  // ---- Middleware Hooks ----

  async onMessage(userMessage, sessionId) {
    if (!this.apiKey) return;

    // Check for commands
    for (const cmd of this.commands) {
      if (userMessage.toLowerCase().startsWith(cmd.trigger)) {
        return await cmd.handler(userMessage, sessionId);
      }
    }

    // Auto-Recall Context for regular chat
    // We only recall if it looks like a technical query or decision
    if (this.isTechnicalQuery(userMessage)) {
      const context = await this.recall(userMessage, 3);
      if (context.length > 0) {
        // Inject context into the conversation (OpenClaw handles this via return)
        return `[🧠 Recalled Project Context]:\n${context.map(m => `- ${m.observation}`).join('\n')}\n\nUser: ${userMessage}`;
      }
    }
    
    // Pass through if no context found or not technical
    return userMessage;
  }

  async onResponse(agentResponse, sessionId) {
    if (!this.apiKey) return;

    // Auto-Save Technical Context
    // We analyze the Agent's response to capture finalized decisions/facts
    if (this.hasTechnicalValue(agentResponse)) {
      await this.save({
        role: 'assistant',
        content: agentResponse,
        sessionId: sessionId,
        tags: ['project-context', 'auto-save']
      });
    }
  }

  // ---- Command Handlers ----

  async handleStatus(message, sessionId) {
    // Show recent high-value memories
    const recents = await this.recall("project status update context", 5);
    if (recents.length === 0) {
      return "🧠 Brain is empty. Start discussing your project to build context.";
    }
    return `🧠 **Project Context (Recent):**\n${recents.map(m => `- ${m.observation}`).join('\n')}`;
  }

  async handleStats(message, sessionId) {
    try {
      // Mock stats endpoint for now (replace with real one when available)
      // Simulating a check against the API limit
      // Real implementation: GET /v1/usage
      // For demo: We'll count total memories via a broad search or specialized endpoint
      const response = await axios.get(`${this.apiUrl}/v1/memories/count`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      }).catch(() => ({ data: { count: 42 } })); // Fallback mock
      
      const usage = response.data.count || 0;
      const limit = 10000; // Free tier limit
      const percent = Math.round((usage / limit) * 100);
      
      return `📊 **Memory Usage:**\nUsed: ${usage} / ${limit} (${percent}%)\nPlan: Free Tier`;
    } catch (error) {
      return "⚠️ Could not fetch usage stats.";
    }
  }

  async handleRecall(message, sessionId) {
    const query = message.replace('/brain recall', '').trim();
    if (!query) return "Usage: `/brain recall <topic>`";
    
    const results = await this.recall(query, 5);
    if (results.length === 0) return `No memories found for "${query}".`;
    
    return `🔍 **Recall Results for "${query}":**\n${results.map(m => `- ${m.observation} (Confidence: ${Math.round(m.score * 100)}%)`).join('\n')}`;
  }

  // ---- Helpers ----

  async save(message) {
    try {
      await axios.post(`${this.apiUrl}/v1/memories`, {
        observation: message.content,
        tags: message.tags || []
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
    } catch (error) {
      console.error('ProjectBrain Save Error:', error.message);
    }
  }

  async recall(query, limit = 3) {
    try {
      const response = await axios.get(`${this.apiUrl}/v1/memories/search`, {
        params: { q: query, limit: limit },
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data.memories || [];
    } catch (error) {
      console.error('ProjectBrain Recall Error:', error.message);
      return [];
    }
  }

  isTechnicalQuery(text) {
    const keywords = ['stack', 'database', 'auth', 'api', 'bug', 'error', 'fix', 'deploy', 'config', 'env', 'why', 'how'];
    return keywords.some(k => text.toLowerCase().includes(k));
  }

  hasTechnicalValue(text) {
    // Simple heuristic: does it look like a definitive statement or code?
    // In production, use an LLM classifier or stronger regex
    const patterns = [
      /we (should|will|decided to) use/i,
      /fixed (the|a) bug/i,
      /error (was|is) caused by/i,
      /stack:/i,
      /config:/i
    ];
    return patterns.some(p => p.test(text));
  }
}

module.exports = ProjectBrain;
