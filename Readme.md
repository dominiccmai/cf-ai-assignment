# cf_ai_chat_agent

An AI-powered chat application built with Cloudflare’s developer platform.

**Live demo:** [https://cf-ai-assignment.dlmai-ai.workers.dev](https://cf-ai-assignment.dlmai-ai.workers.dev)

<img width="938" height="894" alt="image" src="https://github.com/user-attachments/assets/b10a8477-bc56-4b22-94ca-1518612938e4" />

---

## Features
- **LLM** – Uses Cloudflare Workers AI  
  - `@cf/meta/llama-3.3-70b-instruct-fp8-fast` for chat  
  - `@cf/baai/bge-large-en-v1.5` for embeddings
- **State & Memory** – Durable Object + SQLite for short-term memory, Vectorize for long-term memory
- **Coordination** – Workflows for ingesting new documents into memory
- **Real-time UI** – WebSocket chat interface served via Workers Pages

---

## Run Locally

```bash
# Install dependencies
npm install

# Deploy to Cloudflare
npx wrangler deploy

# Create Vectorize index
npx wrangler vectorize create mem-index --preset @cf/baai/bge-large-en-v1.5

# Trigger workflow to add memory
npx wrangler workflows trigger ingest-workflow \
  '{"docId":"demo","text":"Cloudflare Workers let you run code near users."}'

# Then open your deployed Worker URL:
https://<your-subdomain>.workers.dev
