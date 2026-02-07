# project-brain

**Your AI Coding Partner's Permanent Memory.**
This OpenClaw skill turns your assistant into a true technical partner that remembers your stack decisions, bug fixes, and architectural choices across sessions.

## 🚀 Features
- **Auto-Memory:** Automatically detects and saves key technical context (stack choices, bugs, fixes).
- **Semantic Recall:** "Why did we pick Postgres?" -> Recalls the exact conversation from 2 weeks ago.
- **Project Awareness:** Knows the current project context without re-prompting.

## 🛠 Commands
- `/brain status`: Shows the top recent memories and current project context.
- `/brain recall <topic>`: Deep semantic search for a specific topic (e.g., "auth bug").
- `/brain stats`: Check your memory usage (e.g., "1,247 / 10,000 memories used").

## 📦 Installation
1.  Clone this repo into your OpenClaw skills directory.
2.  Run `npm install`.
3.  Add your `NOVYX_API_KEY` to `.env`.
4.  Restart OpenClaw.

## 💡 Usage
Just chat naturally about your code. The skill will silently index important decisions.
When you need to remember something, ask naturally or use `/brain recall`.
