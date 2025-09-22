# PROMPTS.md

---

## 1. Initial Setup
**Prompt:**  
> Help me set up a Cloudflare Worker project with an AI-powered chat interface.  
> I need to use Llama 3.3 from Workers AI, and I want to store conversation state using Durable Objects.

---

## 2. Debugging Deployment
**Prompt:**  
> I'm getting a Wrangler error when deploying my Worker.  
> It says `Your Worker depends on the following Workflows, which are not exported in your entrypoint file`.  
> How do I fix this?

---

## 3. Memory Integration
**Prompt:**  
> Show me how to integrate Cloudflare Vectorize into my Worker.  
> I need to store embeddings and query them with a `topK` search to provide long-term memory for my assistant.

---

## 4. Workflow Triggering
**Prompt:**  
> I need to create a Cloudflare Workflow called `ingest-workflow` that splits a document into chunks,  
> generates embeddings, and upserts them into Vectorize.  
> Can you write this code for me?

---

## 5. Fixing Double Messages
**Prompt:**  
> My AI chat app is sometimes sending duplicate responses.  
> How can I fix my `agent.ts` code so each user message is only processed once?

---

## 6. UI Cleanup
**Prompt:**  
> The current chat UI looks bad.  
> Please help me make it cleaner with proper Markdown formatting and a modern look.

---
