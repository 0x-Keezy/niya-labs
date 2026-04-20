import { Message } from "./messages";
import { config } from "@/utils/config";

export async function getReasoingEngineChatResponseStream(
  systemPrompt: Message,
  messages: Message[],
) {
  const apiKey = config("reasoning_engine_apikey");
  const model = config("reasoning_engine_model") || "deepseek-reasoner";
  const url = config("reasoning_engine_url");
  
  // Build headers - add API key if provided
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  
  // Format messages for OpenAI-compatible API (DeepSeek uses this format)
  const formattedMessages = [
    { role: "system", content: systemPrompt.content },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];
  
  const response = await fetch(url,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model,
        messages: formattedMessages,
        stream: true,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Reasoning engine responded with status ${response.status}: ${errorText}`,
    );
  }

  const reader = response.body?.getReader();
  if (response.status !== 200 || !reader) {
    throw new Error(`Reasoning engine error (${response.status})`);
  }

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      const decoder = new TextDecoder("utf-8");
      try {
        let combined = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const data = decoder.decode(value);
          const chunks = data
            .split("data:")
            .filter((val) => !!val && val.trim() !== "[DONE]");

          for (const chunk of chunks) {
            if (chunk.length > 0 && chunk[0] === ":") {
              continue;
            }
            combined += chunk;
            try {
              const json = JSON.parse(combined);
              const messagePiece = json.choices?.[0]?.delta?.content;
              combined = "";
              if (!!messagePiece) {
                controller.enqueue(messagePiece);
              }
            } catch (error) {
              // JSON not complete yet, continue combining
            }
          }
        }
      } catch (error) {
        console.error("Reasoning engine stream error:", error);
        controller.error(error);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
    async cancel() {
      await reader?.cancel();
      reader.releaseLock();
    },
  });

  return stream;
}
