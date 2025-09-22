import { Agent, routeAgentRequest, type AgentNamespace, type Connection, type WSMessage } from "agents";
export { ingestWorkflow } from "./workflows";

// ---- Env bindings from wrangler.jsonc
interface Env {
  AI: Ai;
  VECTORS: VectorizeIndex;             // <- matches your "VECTORS" binding
  AppAgent: AgentNamespace<AppAgent>;  // <- DO binding/class
}

// ---- Helper to parse WS payloads safely
function safeParse(msg: WSMessage): { text: string } {
  try {
    return JSON.parse(typeof msg === "string" ? msg : (msg as any));
  } catch {
    return { text: String(msg) };
  }
}

type Turn = { role: "user" | "assistant"; content: string };
type Msg = { role: "system" | "user" | "assistant"; content: string };

async function getRecentTurns(agent: AppAgent, limit = 12): Promise<Turn[]> {
  // newest first
  const rows = await agent.sql`
    SELECT role, content FROM chat_log
    ORDER BY id DESC LIMIT ${limit}
  `;
  // convert to oldest-first for the LLM
  return rows.reverse().map((r: any) => ({ role: r.role, content: r.content }));
}

// ---- Extract text from different AI response shapes
function extractText(resp: any): string {
  if (!resp) return "⚠️ empty response from model";
  if (typeof resp === "string") return resp;
  if (typeof resp.response === "string") return resp.response;
  if (resp?.result?.output_text) return resp.result.output_text;
  if (Array.isArray(resp.output)) {
    const t = resp.output
      .map((o: any) => o?.text ?? o?.content ?? o?.output_text)
      .filter(Boolean)
      .join("\n");
    if (t) return t;
  }
  return typeof resp === "object" ? JSON.stringify(resp) : String(resp);
}

export class AppAgent extends Agent<Env> {
  // Ensure our table exists (safe to run repeatedly)
  private async ensureSchema() {
    await this.sql`
      CREATE TABLE IF NOT EXISTS chat_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        ts INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `;
  }

  async onConnect(conn: Connection) {
    conn.send(JSON.stringify({ type: "chat", text: "👋 How can I help?" }));
  }

  async onMessage(conn: Connection, message: WSMessage) {
  const { text } = safeParse(message);

  try {
    await this.ensureSchema();
    await this.sql`INSERT INTO chat_log (role, content) VALUES ('user', ${text})`;

    // --- Vectorize memory (non-fatal)
    let memory = "";
    try {
      const emb: any = await this.env.AI.run("@cf/baai/bge-large-en-v1.5", { text });
      const vector: number[] = emb.data[0].embedding;
      const result = await this.env.VECTORS.query(vector, { topK: 4, returnMetadata: true });
      memory = (result.matches ?? [])
        .map((m: any) => m.metadata?.text)
        .filter(Boolean)
        .join("\n---\n");
    } catch { /* ignore */ }

    // --- Pull recent turns so the model has continuity
    const turns = await getRecentTurns(this, 12); // ~6 last exchanges

    // --- System + (optional) memory primer
    const system = `You are a helpful Cloudflare app assistant.
Keep answers concise. If relevant memory is provided, use it briefly.`;

    // Convert our stored turns to model messages
    const historyMsgs: Msg[] = turns.map(t => ({ role: t.role, content: t.content }));

    // Append a short “memory” note only if we have it
    const memoryMsg: Msg[] = memory
    ? [{ role: "system", content: `Relevant memory:\n${memory}` }]
    : [];

    const messages: Msg[] = [
        { role: "system", content: system },
        ...historyMsgs,
        ...memoryMsg,
    ];

    const raw = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages }) as any;
    const reply = extractText(raw);

    await this.sql`INSERT INTO chat_log (role, content) VALUES ('assistant', ${reply})`;
    this.setState({ lastReply: reply });     // state-sync (client ignores it)
    conn.send(JSON.stringify({ type: "chat", text: reply })); // explicit chat frame
  } catch (err) {
    const msg = "Sorry — I hit an error and couldn’t answer. Try again.";
    this.setState({ lastReply: msg });
    conn.send(JSON.stringify({ type: "chat", text: msg }));
  }
}

  // Optional helper you can hit via an HTTP route if you want summaries
  async summarize(): Promise<string> {
    await this.ensureSchema();
    const rows = await this.sql`
      SELECT role, content FROM chat_log ORDER BY id DESC LIMIT 50
    `;
    const transcript = rows.map((r: any) => `${r.role}: ${r.content}`).join("\n");

    const raw = (await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        { role: "system", content: "Summarize briefly in bullet points." },
        { role: "user", content: transcript },
      ],
    })) as any;

    return extractText(raw);
  }
}

// ---- Worker front door: routes HTTP + WebSocket to the Agent
export default {
  async fetch(req: Request, env: Env) {
    return (await routeAgentRequest(req, env)) ??
      new Response("Agent not found", { status: 404 });
  },
};