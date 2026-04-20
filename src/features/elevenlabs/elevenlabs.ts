import { TalkStyle } from "@/features/chat/messages";
import { config } from '@/utils/config';

export async function elevenlabs(
  message: string,
  voiceId: string,
  style: TalkStyle,
) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      voiceId: voiceId || config("elevenlabs_voiceid"),
      model: config("elevenlabs_model"),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `ElevenLabs API Error (${res.status})`);
  }

  const data = await res.arrayBuffer();
  return { audio: data };
}
