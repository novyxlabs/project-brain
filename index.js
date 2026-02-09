#!/usr/bin/env node
/**
 * Project Brain - v2 SDK Integration
 * 
 * Auto-recalls project context and saves technical decisions.
 * Uses Novyx for memory, handles errors gracefully.
 */

const axios = require('axios');
require('dotenv').config();

class ProjectBrain {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.NOVYX_API_KEY;
    this.apiUrl = config.apiUrl || process.env.NOVYX_API_URL || 'https://novyx-ram-api.fly.dev';
    
    if (!this.apiKey) {
      console.warn('⚠️ ProjectBrain: NOVYX_API_KEY not set');
    }
    
    this.commands = [
      { trigger: '/brain status', handler: this.handleStatus.bind(this) },
      { trigger: '/brain stats', handler: this.handleStats.bind(this) },
      { trigger: '/brain recall', handler: this.handleRecall.bind(this) },
      { trigger: '/brain diff', handler: this.handleDiff.bind(this) }
    ];
  }

  /**
   * Remember a memory
   */
  async remember(observation, tags = []) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.post(`${this.apiUrl}/v1/memories`, {
        observation,
        tags
      }, { headers: this._authHeaders() });
      return response.data;
    } catch (error) {
      this._handleError(error, 'remember');
      return null;
    }
  }

  /**
   * Search memories
   */
  async recall(query, limit = 5) {
    if (!this.apiKey) return [];
    try {
      const response = await axios.get(`${this.apiUrl}/v1/memories/search`, {
        params: { q: query, limit },
        headers: this._authHeaders()
      });
      return response.data.memories || [];
    } catch (error) {
      this._handleError(error, 'recall');
      return [];
    }
  }

  /**
   * Get memory stats
   */
  async stats() {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.apiUrl}/v1/memories/stats`, {
        headers: this._authHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'stats');
      return null;
    }
  }

  /**
   * Get usage/limits
   */
  async usage() {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.apiUrl}/v1/usage`, {
        headers: this._authHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'usage');
      return null;
    }
  }

  _authHeaders() {
    return { 'Authorization': `Bearer ${this.apiKey}` };
  }

  /**
   * Handle errors
   */
  _handleError(error, action) {
    if (error.response) {
      const status = error.response.status;
      if (status === 429 || status === 403) {
        const data = error.response.data || {};
        console.warn(`[ProjectBrain] ⚠️ ${data.error || 'Limit reached'} during ${action}. Upgrade at novyxlabs.com/pricing`);
      } else {
        console.error(`[ProjectBrain] API Error (${status}) during ${action}`);
      }
    }
  }

  /**
   * Check if message is a command
   */
  _isCommand(message) {
    return this.commands.some(cmd => message.toLowerCase().startsWith(cmd.trigger));
  }

  /**
   * Middleware: On incoming message
   */
  async onMessage(userMessage, sessionId) {
    // Handle commands
    for (const cmd of this.commands) {
      if (userMessage.toLowerCase().startsWith(cmd.trigger)) {
        return await cmd.handler(userMessage, sessionId);
      }
    }

    // Auto-recall for technical queries
    if (this.isTechnicalQuery(userMessage)) {
      const context = await this.recall(userMessage, 3);
      if (context.length > 0) {
        return `[🧠 Project Context]:\n${context.map(m => `- ${m.observation}`).join('\n')}\n\nUser: ${userMessage}`;
      }
    }
    
    return userMessage;
  }

  /**
   * Middleware: On agent response
   */
  async onResponse(agentResponse, sessionId) {
    if (this.hasTechnicalValue(agentResponse)) {
      await this.remember(agentResponse, ['project-context', 'auto-save']);
    }
  }

  // ---- Command Handlers ----

  async handleStatus(message, sessionId) {
    const recents = await this.recall("project status update context", 5);
    if (recents.length === 0) {
      return "🧠 Brain is empty. Start discussing your project.";
    }
    return `🧠 **Project Context (Recent):**\n${recents.map(m => `- ${m.observation}`).join('\n')}`;
  }

  async handleStats(message, sessionId) {
    const usage = await this.usage();
    const memStats = await this.stats();
    
    if (!usage) {
      return "⚠️ Could not fetch stats.";
    }

    const tier = usage.tier || 'Free';
    const used = usage.usage?.memories_stored || 0;
    const limit = usage.usage?.memory_limit || 1000;
    const percent = Math.round((used / limit) * 100);

    return `📊 **Memory Usage:**\n` +
           `Tier: ${tier}\n` +
           `Used: ${used} / ${limit} (${percent}%)\n` +
           `API Calls: ${usage.usage?.api_calls_this_month || 'N/A'}`;
  }

  async handleRecall(message, sessionId) {
    const query = message.replace('/brain recall', '').trim();
    if (!query) return "Usage: `/brain recall <topic>`";
    
    const results = await this.recall(query, 5);
    if (results.length === 0) return `No memories for "${query}".`;
    
    return `🔍 **Recall for "${query}":**\n${results.map(m => 
      `- ${m.observation} (${Math.round(m.score * 100)}%)`
    ).join('\n')}`;
  }

  async handleDiff(message, sessionId) {
    // What changed recently?
    const recent = await this.recall("recent changes updates decisions", 10);
    return `📋 **Recent Project Memories:**\n${recent.map(m => `- ${m.observation}`).join('\n')}`;
  }

  // ---- Helpers ----

  isTechnicalQuery(text) {
    const keywords = ['stack', 'database', 'auth', 'api', 'bug', 'error', 'fix', 'deploy', 'config', 'env', 'why', 'how'];
    return keywords.some(k => text.toLowerCase().includes(k));
  }

  hasTechnicalValue(text) {
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
