// src/workflows.ts
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";

// Bindings this workflow will use
type Env = {
  AI: Ai;
  VECTORS: VectorizeIndex;
};

// Parameters you'll pass when you start the workflow
type Params = {
  docId: string;
  text: string;
};

// Class name MUST match your wrangler.jsonc "class_name": "ingestWorkflow"
export class ingestWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { docId, text } = event.payload;
    const chunks = chunk(text, 800);

    for (const [i, c] of chunks.entries()) {
      // Do embedding as a retriable step
      const emb = await step.do("embed chunk", async () => {
        return await this.env.AI.run("@cf/baai/bge-large-en-v1.5", { text: c }) as any;
      });

      // Upsert to Vectorize as a separate retriable step
    await step.do("upsert to vectorize", async () => {
        await this.env.VECTORS.upsert([
            {
            id: `${docId}:${i}`,
            values: emb.data[0].embedding,
            metadata: { text: c }
            }
        ]);
    });
    }
  }
}

function chunk(t: string, n: number) {
  const out: string[] = [];
  for (let i = 0; i < t.length; i += n) out.push(t.slice(i, i + n));
  return out;
}