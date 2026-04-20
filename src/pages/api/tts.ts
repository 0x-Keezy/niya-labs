import type { NextApiRequest, NextApiResponse } from "next";
import { enforceRateLimit } from "@/features/auth/rateLimit";

// Hard cap on message length so a single caller can't ask for a huge TTS
// clip and burn quota faster than the rate limit window.
const MAX_MESSAGE_CHARS = 1000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate limit: 30 synth requests / minute / IP. ElevenLabs bills per
  // character, so unauthenticated bursts are the main abuse risk.
  const rl = await enforceRateLimit(req, res, {
    endpoint: "tts",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) return;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("[TTS API] ELEVENLABS_API_KEY not found in environment");
    return res.status(500).json({ error: "ElevenLabs API key not configured" });
  }

  const { message, voiceId, model } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return res
      .status(413)
      .json({ error: `Message too long (max ${MAX_MESSAGE_CHARS} chars)` });
  }

  const voice = voiceId || "JTlYtJrcTzPC71hMLOxo";
  const modelId = model || "eleven_multilingual_v2";

  try {
    const body = {
      text: message,
      model_id: modelId,
      voice_settings: {
        stability: 0.35,
        similarity_boost: 0.80,
        style: 0.65,
        use_speaker_boost: true
      }
    };

    const elevenlabsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?optimize_streaming_latency=4&output_format=mp3_22050_32`,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
          "xi-api-key": apiKey,
        },
      }
    );

    if (!elevenlabsRes.ok) {
      const errText = await elevenlabsRes.text();
      console.error("[TTS API] ElevenLabs error:", elevenlabsRes.status, errText);
      return res.status(elevenlabsRes.status).json({
        error: `ElevenLabs API Error (${elevenlabsRes.status}): ${errText.substring(0, 100)}`
      });
    }

    const audioBuffer = await elevenlabsRes.arrayBuffer();
    
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.byteLength);
    res.send(Buffer.from(audioBuffer));
  } catch (e: any) {
    console.error("TTS error:", e);
    return res.status(500).json({ error: e.message });
  }
}
