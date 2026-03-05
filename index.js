#!/usr/bin/env node
/**
 * Project Brain v2 — AI Coding Partner with Persistent Memory
 *
 * Semantic auto-capture, rollback, lifecycle audit, time-range diffing.
 * Pro+ features degrade gracefully on Free tier.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

class ProjectBrain {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.NOVYX_API_KEY;
    this.apiUrl = config.apiUrl || process.env.NOVYX_API_URL || 'https://novyx-ram-api.fly.dev';
    this.noveltyThreshold = config.noveltyThreshold || 0.75;

    if (!this.apiKey) {
      console.warn('[ProjectBrain] NOVYX_API_KEY not set. Memory features disabled.');
    }

    // Pending rollback state for confirmation flow (persisted to temp file)
    this._rollbackFile = path.join(os.tmpdir(), `.project-brain-rollback-${(this.apiKey || '').slice(-8)}.json`);
    this.pendingRollback = this._loadPendingRollback();

    this.commands = [
      { trigger: '/brain status', handler: this.handleStatus.bind(this) },
      { trigger: '/brain stats', handler: this.handleStats.bind(this) },
      { trigger: '/brain recall', handler: this.handleRecall.bind(this) },
      { trigger: '/brain rewind confirm', handler: this.handleRewindConfirm.bind(this) },
      { trigger: '/brain rewind', handler: this.handleRewind.bind(this) },
      { trigger: '/brain prove', handler: this.handleProve.bind(this) },
      { trigger: '/brain diff', handler: this.handleDiff.bind(this) },
      { trigger: '/brain help', handler: this.handleHelp.bind(this) },
    ];
  }

  // ---- Core API Methods ----

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

  async rollback(target, dryRun = false) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.post(`${this.apiUrl}/v1/rollback`, {
        target,
        dry_run: dryRun
      }, { headers: this._authHeaders() });
      return response.data;
    } catch (error) {
      this._handleError(error, 'rollback');
      return null;
    }
  }

  async replayLifecycle(memoryId) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.apiUrl}/v1/replay/memory/${memoryId}`, {
        headers: this._authHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'replay lifecycle');
      return null;
    }
  }

  async replayDiff(fromTs, toTs) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.apiUrl}/v1/replay/diff`, {
        params: { from: fromTs, to: toTs },
        headers: this._authHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'replay diff');
      return null;
    }
  }

  _authHeaders() {
    return { 'Authorization': `Bearer ${this.apiKey}` };
  }

  // ---- Middleware Hooks ----

  async onMessage(userMessage, sessionId) {
    // Handle commands
    for (const cmd of this.commands) {
      if (userMessage.toLowerCase().startsWith(cmd.trigger)) {
        return await cmd.handler(userMessage, sessionId);
      }
    }

    // Skip recall for trivial messages
    if (userMessage.length < 15) {
      return userMessage;
    }

    // Auto-recall: semantic search for relevant context
    const context = await this.recall(userMessage, 3);
    if (context.length > 0) {
      const contextBlock = context.map(m => `- ${m.observation}`).join('\n');
      return `[Project Context]\n${contextBlock}\n\nUser: ${userMessage}`;
    }

    return userMessage;
  }

  async onResponse(agentResponse, sessionId) {
    if (!this.apiKey) return;
    if (!agentResponse || agentResponse.length < 20) return;  // Skip trivial responses

    const isNovel = await this._isNovel(agentResponse);
    if (isNovel) {
      // Truncate long responses to avoid storing filler
      const observation = agentResponse.length > 500
        ? agentResponse.slice(0, 500) + '...'
        : agentResponse;
      await this.remember(observation, ['project-context', 'auto-save', `session:${sessionId}`]);
    }
  }

  // ---- Command Handlers ----

  async handleStatus(message, sessionId) {
    const recents = await this.recall("project status update context decisions", 5);
    if (recents.length === 0) {
      return "Brain is empty. Start discussing your project.";
    }
    return `**Project Context (Recent):**\n${recents.map(m => `- ${m.observation}`).join('\n')}`;
  }

  async handleStats(message, sessionId) {
    const usageData = await this.usage();
    if (!usageData) return "Could not fetch stats. Check your API key.";

    const tier = usageData.tier || 'Free';
    const memUsed = usageData.memories?.current || 0;
    const memLimit = usageData.memories?.limit || 0;
    const pct = memLimit > 0 ? Math.round((memUsed / memLimit) * 100) : 0;
    const apiUsed = usageData.api_calls?.current || 0;
    const apiLimit = usageData.api_calls?.limit || 0;

    return `**Memory Stats:**\n` +
           `Tier: ${tier}\n` +
           `Memories: ${memUsed} / ${memLimit} (${pct}%)\n` +
           `API Calls: ${apiUsed} / ${apiLimit}`;
  }

  async handleRecall(message, sessionId) {
    const query = message.replace('/brain recall', '').trim();
    if (!query) return "Usage: `/brain recall <topic>`";

    const results = await this.recall(query, 5);
    if (results.length === 0) return `No memories found for "${query}".`;

    return `**Recall: "${query}"**\n${results.map(m =>
      `- ${m.observation} (${Math.round((m.score || 0) * 100)}%)`
    ).join('\n')}`;
  }

  async handleRewind(message, sessionId) {
    const rawTarget = message.replace('/brain rewind', '').trim() || '1 hour ago';
    const target = this._parseRelativeTime(rawTarget);
    if (!target) {
      return `Could not parse time: "${rawTarget}". Try "1h", "30m", "2 days ago", or an ISO timestamp.`;
    }

    // Always preview first
    const preview = await this.rollback(target, true);
    if (!preview) {
      return "Rewind failed. This feature requires Pro plan or above.";
    }

    // Store pending rollback for confirmation
    this.pendingRollback = {
      target: target,
      preview: preview,
      timestamp: new Date().toISOString()
    };
    this._savePendingRollback(this.pendingRollback);

    return `**Rewind Preview** (to: ${preview.target_timestamp || target})\n` +
           `Artifacts affected: ${preview.artifacts_affected || 0}\n` +
           `  - Restore: ${preview.artifacts_restored || 0}\n` +
           `  - Remove: ${preview.artifacts_removed || 0}\n` +
           `\n⚠️ To execute this rollback, type: \`/brain rewind confirm\``;
  }

  async handleRewindConfirm(message, sessionId) {
    if (!this.pendingRollback) {
      return "No pending rollback. Use `/brain rewind <time>` first to preview.";
    }

    const { target, preview, timestamp } = this.pendingRollback;
    const pendingAge = Date.now() - new Date(timestamp).getTime();
    const maxAgeMs = 5 * 60 * 1000; // 5 minutes

    if (pendingAge > maxAgeMs) {
      this._clearPendingRollback();
      return "⏰ Rollback preview expired (5 min). Run `/brain rewind <time>` again.";
    }

    // Safety check: max 100 artifacts
    if (preview.artifacts_affected > 100) {
      this._clearPendingRollback();
      return `❌ Rollback aborted: Too many artifacts (${preview.artifacts_affected}).\n` +
             `Manual review required. Use Novyx dashboard for large rollbacks.`;
    }

    // Execute the rollback
    const result = await this.rollback(target, false);
    if (!result) {
      return "❌ Rollback execution failed. Check your API key and plan.";
    }

    // Clear pending state
    this._clearPendingRollback();

    return `✅ **Rollback Executed**\n` +
           `Restored to: ${result.target_timestamp || target}\n` +
           `Artifacts restored: ${result.artifacts_restored || 0}\n` +
           `Artifacts removed: ${result.artifacts_removed || 0}\n` +
           `\nYour project memory has been rolled back.`;
  }

  async handleProve(message, sessionId) {
    const memoryId = message.replace('/brain prove', '').trim();
    if (!memoryId) {
      return "Usage: `/brain prove <memory_id>`\n" +
             "Shows the full lifecycle of a memory: creation, updates, recalls, links.";
    }

    const lifecycle = await this.replayLifecycle(memoryId);
    if (!lifecycle) {
      return `Could not fetch lifecycle for ${memoryId}. Requires Pro plan.`;
    }

    const lines = [`**Memory Lifecycle: ${memoryId}**`];
    lines.push(`State: ${lifecycle.current_state}`);
    lines.push(`Created: ${lifecycle.created_at}`);
    lines.push(`Observation: ${(lifecycle.observation || '').slice(0, 100)}`);
    lines.push(`Recall Count: ${lifecycle.recall_count || 0}`);

    if (lifecycle.events && lifecycle.events.length > 0) {
      lines.push(`\n**Events:**`);
      for (const ev of lifecycle.events.slice(0, 15)) {
        const ts = new Date(ev.timestamp).toLocaleString();
        lines.push(`  \`${ts}\` ${ev.operation}${ev.detail ? ': ' + ev.detail : ''}`);
      }
    }

    if (lifecycle.links && lifecycle.links.length > 0) {
      lines.push(`\n**Links:** ${lifecycle.links.length} connections`);
    }

    return lines.join('\n');
  }

  async handleDiff(message, sessionId) {
    const args = message.replace('/brain diff', '').trim();

    // Accept relative shorthand: "1h", "24h", "7d"
    let fromTs, toTs;
    const relMatch = args.match(/^(\d+)([hdm])$/i);
    if (relMatch) {
      const amount = parseInt(relMatch[1]);
      const unit = relMatch[2].toLowerCase();
      const ms = unit === 'h' ? amount * 3600000 : unit === 'd' ? amount * 86400000 : amount * 60000;
      fromTs = new Date(Date.now() - ms).toISOString();
      toTs = new Date().toISOString();
    } else if (args.includes(' ')) {
      // Expect "from_ts to_ts"
      const parts = args.split(/\s+/);
      fromTs = parts[0];
      toTs = parts[1];
    } else {
      return "Usage: `/brain diff <timerange>`\n" +
             "Examples:\n" +
             "  `/brain diff 1h` — changes in last hour\n" +
             "  `/brain diff 24h` — changes in last day\n" +
             "  `/brain diff 7d` — changes in last week\n" +
             "  `/brain diff 2026-02-25T00:00:00Z 2026-02-25T12:00:00Z`";
    }

    const diff = await this.replayDiff(fromTs, toTs);
    if (!diff) {
      return "Diff failed. This feature requires Pro plan or above.";
    }

    const lines = [`**Memory Diff**`];
    lines.push(`Period: ${diff.from_timestamp} → ${diff.to_timestamp}`);

    if (diff.added && diff.added.length > 0) {
      lines.push(`\n**Added (${diff.added.length}):**`);
      for (const e of diff.added.slice(0, 5)) {
        lines.push(`  + ${(e.observation || e.memory_id || '').slice(0, 80)}`);
      }
      if (diff.added.length > 5) lines.push(`  ... and ${diff.added.length - 5} more`);
    }

    if (diff.removed && diff.removed.length > 0) {
      lines.push(`\n**Removed (${diff.removed.length}):**`);
      for (const e of diff.removed.slice(0, 5)) {
        lines.push(`  - ${(e.observation || e.memory_id || '').slice(0, 80)}`);
      }
      if (diff.removed.length > 5) lines.push(`  ... and ${diff.removed.length - 5} more`);
    }

    if (diff.modified && diff.modified.length > 0) {
      lines.push(`\n**Modified (${diff.modified.length}):**`);
      for (const e of diff.modified.slice(0, 5)) {
        lines.push(`  ~ ${(e.observation || e.memory_id || '').slice(0, 80)}`);
      }
    }

    if (diff.summary) {
      lines.push(`\n*${diff.summary}*`);
    }

    return lines.join('\n');
  }

  async handleHelp() {
    return "**Project Brain Commands:**\n" +
           "- `/brain status`: Recent project context\n" +
           "- `/brain stats`: Memory usage and tier info\n" +
           "- `/brain recall <topic>`: Semantic search for a topic\n" +
           "- `/brain rewind <time>`: Preview rollback to a point in time (Pro)\n" +
           "- `/brain rewind confirm`: Execute the pending rollback\n" +
           "- `/brain prove <id>`: Full lifecycle of a memory (Pro)\n" +
           "- `/brain diff <range>`: What changed in a time range (Pro)\n" +
           "- `/brain help`: This menu\n" +
           "\nMemories are automatically captured when your responses contain novel information.";
  }

  // ---- Helpers ----

  _parseRelativeTime(input) {
    const now = Date.now();
    // Match patterns like "1 hour ago", "2h", "30 minutes", "1d", "2 days ago"
    const match = input.trim().match(/^(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|d|day|days)\s*(ago)?$/i);
    if (!match) {
      // Try ISO timestamp directly
      const d = new Date(input);
      if (!isNaN(d.getTime())) return d.toISOString();
      return null;
    }
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    let ms;
    if (unit.startsWith('h')) ms = amount * 60 * 60 * 1000;
    else if (unit.startsWith('m')) ms = amount * 60 * 1000;
    else if (unit.startsWith('d')) ms = amount * 24 * 60 * 60 * 1000;
    else return null;
    return new Date(now - ms).toISOString();
  }

  _loadPendingRollback() {
    try {
      const data = fs.readFileSync(this._rollbackFile, 'utf8');
      const parsed = JSON.parse(data);
      // Expire after 5 minutes
      if (Date.now() - parsed.createdAt > 5 * 60 * 1000) {
        fs.unlinkSync(this._rollbackFile);
        return null;
      }
      return parsed;
    } catch { return null; }
  }

  _savePendingRollback(data) {
    try {
      fs.writeFileSync(this._rollbackFile, JSON.stringify({ ...data, createdAt: Date.now() }));
    } catch {}
  }

  _clearPendingRollback() {
    this.pendingRollback = null;
    try { fs.unlinkSync(this._rollbackFile); } catch {}
  }

  async _isNovel(text) {
    if (!text || text.length < 20) return false;

    // Check if similar content already exists
    const existing = await this.recall(text, 1);
    if (existing.length === 0) return true;

    // If the best match score is below threshold, it's novel
    const bestScore = existing[0].score || 0;
    return bestScore < this.noveltyThreshold;
  }

  _handleError(error, action) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data || {};

      if (status === 429) {
        console.warn(`[ProjectBrain] Rate limit during ${action}. Upgrade at novyxlabs.com/pricing`);
      } else if (status === 403) {
        const detail = data.detail || data.error || '';
        const msg = typeof detail === 'object' ? detail.message || JSON.stringify(detail) : detail;
        if (msg.toLowerCase().includes('upgrade') || msg.toLowerCase().includes('pro')) {
          console.warn(`[ProjectBrain] ${msg} — upgrade at novyxlabs.com/pricing`);
        } else {
          console.warn(`[ProjectBrain] Access forbidden during ${action}. Check your API key.`);
        }
      } else {
        console.error(`[ProjectBrain] API Error (${status}) during ${action}:`, data);
      }
    } else if (error.request) {
      console.error(`[ProjectBrain] Network Error during ${action}: ${error.message}`);
    }
  }
}

module.exports = ProjectBrain;
