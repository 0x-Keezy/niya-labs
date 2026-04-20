import { Message } from './messages';

/**
 * Streaming chat adapter for the Niya Companion (VTuber).
 *
 * This adapter used to call DGrid directly with a NEXT_PUBLIC_ API key that
 * Next.js inlined into the browser bundle — an easy credit-burn target for
 * anyone with DevTools open. The adapter is now a thin client that POSTs to
 * `/api/companion/chat`, a server-side proxy that holds the real key in
 * `process.env.DGRID_API_KEY` and streams the upstream SSE response back
 * unchanged. The OpenAI-compatible parser below is identical to the version
 * that previously spoke to DGrid directly.
 *
 * Server endpoint: `src/pages/api/companion/chat.ts`
 * Upstream docs:   https://docs.dgrid.ai/AI-Gateway-Integrations
 */
export async function getDGridChatResponseStream(
  messages: Message[],
): Promise<ReadableStream> {
  const response = await fetch('/api/companion/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
      stream: true,
    }),
  });

  const reader = response.body?.getReader();
  if (!response.ok || !reader) {
    // Try to extract a structured error, fall back to raw text.
    let errorMessage = `Companion chat request failed with status ${response.status}`;
    try {
      const err = await response.json();
      if (err?.error) {
        errorMessage = `Companion chat error: ${err.error}`;
      }
    } catch {
      /* ignore — keep the status-code message */
    }
    throw new Error(errorMessage);
  }

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      const decoder = new TextDecoder('utf-8');
      try {
        // The server proxies SSE from DGrid/xAI verbatim, so the chunks arrive
        // in OpenAI's `data: {...}\n\n` format. Accumulate across reads to
        // survive JSON payloads split across chunk boundaries (same pattern
        // used by the OpenRouter / xAI adapters in this repo).
        let combined = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const data = decoder.decode(value);
          const chunks = data
            .split('data:')
            .filter((val) => !!val && val.trim() !== '[DONE]');

          for (const chunk of chunks) {
            if (chunk.length > 0 && chunk[0] === ':') {
              continue; // ignore SSE comments
            }
            combined += chunk;
            try {
              const json = JSON.parse(combined);
              const piece = json.choices?.[0]?.delta?.content;
              combined = '';
              if (piece) {
                controller.enqueue(piece);
              }
            } catch {
              // Partial JSON — wait for the next chunk and retry.
            }
          }
        }
      } catch (error) {
        console.error(error);
        controller.error(error);
      } finally {
        reader?.releaseLock();
        controller.close();
      }
    },
    async cancel() {
      await reader?.cancel();
      reader?.releaseLock();
    },
  });

  return stream;
}
