import { Queue } from "typescript-collections";
import { Message, Role, Screenplay, Talk, textsToScreenplay } from "./messages";
import { Viewer } from "@/features/vrmViewer/viewer";
import { Alert } from "@/features/alert/alert";
import { broadcastManager } from "@/features/broadcast/broadcastManager";

import { getEchoChatResponseStream } from "./echoChat";
import {
  getArbiusChatResponseStream,
} from "./arbiusChat";
import {
  getOpenAiChatResponseStream,
  getOpenAiVisionChatResponse,
} from "./openAiChat";
import {
  getLlamaCppChatResponseStream,
  getLlavaCppChatResponse,
} from "./llamaCppChat";
import { getWindowAiChatResponseStream } from "./windowAiChat";
import {
  getOllamaChatResponseStream,
  getOllamaVisionChatResponse,
} from "./ollamaChat";
import { getKoboldAiChatResponseStream } from "./koboldAiChat";
import { getReasoingEngineChatResponseStream } from "./reasoiningEngineChat";

import { rvc } from "@/features/rvc/rvc";
import { coquiLocal } from "@/features/coquiLocal/coquiLocal";
import { piper } from "@/features/piper/piper";
import { elevenlabs } from "@/features/elevenlabs/elevenlabs";
import { speecht5 } from "@/features/speecht5/speecht5";
import { openaiTTS } from "@/features/openaiTTS/openaiTTS";
import { localXTTSTTS } from "@/features/localXTTS/localXTTS";
import { kokoro } from "../kokoro/kokoro";
import { ttsCache, ttsRateLimiter } from "@/features/tts/ttsCache";

import { config, updateConfig } from "@/utils/config";
import { cleanTalk } from "@/utils/cleanTalk";
import { processResponse } from "@/utils/processResponse";
import { wait } from "@/utils/wait";
import isDev from '@/utils/isDev';

import { isCharacterIdle, characterIdleTime, resetIdleTimer } from "@/utils/isIdle";
import { getOpenRouterChatResponseStream } from './openRouterChat';
import { getDGridChatResponseStream } from './dgridChat';
import { handleUserInput } from '../externalAPI/externalAPI';
import { loadVRMAnimation } from '@/lib/VRMAnimation/loadVRMAnimation';
import { subtitleEvents } from '@/features/streaming/subtitleEvents';

type Speak = {
  audioBuffer: ArrayBuffer | null;
  screenplay: Screenplay;
  streamIdx: number;
};

type TTSJob = {
  screenplay: Screenplay;
  streamIdx: number;
  role: Role; // Only 'assistant' messages should be sent to TTS
};

export class Chat {
  public initialized: boolean;

  public viewer?: Viewer;
  public alert?: Alert;

  public setChatLog?: (messageLog: Message[]) => void;
  public setUserMessage?: (message: string) => void;
  public setAssistantMessage?: (message: string) => void;
  public setShownMessage?: (role: Role) => void;
  public setChatProcessing?: (processing: boolean) => void;
  public setChatSpeaking?: (speaking: boolean) => void;
  public setThoughtMessage?: (message: string) => void;

  // the message from the user that is currently being processed
  // it can be reset
  public stream: ReadableStream<Uint8Array> | null;
  public streams: ReadableStream<Uint8Array>[];
  public reader: ReadableStreamDefaultReader<Uint8Array> | null;
  public readers: ReadableStreamDefaultReader<Uint8Array>[];

  // process these immediately as they come in and add to audioToPlay
  public ttsJobs: Queue<TTSJob>;

  // this should be read as soon as they exist
  // and then deleted from the queue
  public speakJobs: Queue<Speak>;

  private currentAssistantMessage: string;
  private currentUserMessage: string;
  private thoughtMessage: string;
  
  // Store the complete response for synchronized subtitles across all clients
  private lastCompleteResponse: string;

  private lastAwake: number;

  public messageList: Message[];

  public currentStreamIdx: number;

  private eventSource: EventSource | null = null
  
  private readyForSubtitles: boolean;

  constructor() {
    this.initialized = false;
    this.readyForSubtitles = false;

    this.stream = null;
    this.reader = null;
    this.streams = [];
    this.readers = [];

    this.ttsJobs = new Queue<TTSJob>();
    this.speakJobs = new Queue<Speak>();

    this.currentAssistantMessage = "";
    this.currentUserMessage = "";
    this.thoughtMessage = "";
    this.lastCompleteResponse = "";

    this.messageList = [];
    this.currentStreamIdx = 0;

    this.lastAwake = 0;
  }

  public initialize(
    viewer: Viewer,
    alert: Alert,
    setChatLog: (messageLog: Message[]) => void,
    setUserMessage: (message: string) => void,
    setAssistantMessage: (message: string) => void,
    setThoughtMessage: (message: string) => void,
    setShownMessage: (role: Role) => void,
    setChatProcessing: (processing: boolean) => void,
    setChatSpeaking: (speaking: boolean) => void,
  ) {
    this.viewer = viewer;
    this.alert = alert;
    this.setChatLog = setChatLog;
    this.setUserMessage = setUserMessage;
    this.setAssistantMessage = setAssistantMessage;
    this.setShownMessage = setShownMessage;
    this.setThoughtMessage = setThoughtMessage;
    this.setChatProcessing = setChatProcessing;
    this.setChatSpeaking = setChatSpeaking;

    // these will run forever
    this.processTtsJobs();
    this.processSpeakJobs();

    this.updateAwake();
    this.initialized = true;

    this.initSSE();
    
    // Enable subtitles after a microtask to avoid replaying any historical messages
    // that might be loaded synchronously during initialization
    queueMicrotask(() => {
      this.readyForSubtitles = true;
      console.log("[Chat] Ready for subtitles - new messages will now display");
    });

    // Listen for broadcast audio (for viewers who are not the host)
    // When the host broadcasts audio, all viewers receive it and play it locally
    this.initBroadcastAudioListener();
  }

  private initBroadcastAudioListener(): void {
    broadcastManager.subscribe((data) => {
      // SERVER-BASED BROADCAST (Option B): ALL clients receive and play audio
      // There is no distinction between host/viewer - everyone is equal
      // The server generates TTS and broadcasts to all connected clients
      
      if (data.type === 'init') {
        console.log('[Chat] Received INIT event - restoring state', {
          speaking: data.speaking,
          subtitle: data.subtitle,
          recentCount: data.recentBroadcasts?.length || 0
        });
        
        // Restore current subtitle state for late-joiners
        // Check both 'speaking' (from handleMessage) and 'currentSpeaking' (from server)
        const isSpeaking = data.speaking || data.currentSpeaking;
        const currentSubtitle = data.subtitle || data.currentSubtitle || '';
        
        if (currentSubtitle && isSpeaking) {
          subtitleEvents.emit(currentSubtitle);
          this.setChatSpeaking?.(true);
        }
        
        // NOTE: Late-joiner audio catch-up is handled by app.tsx to avoid duplicate playback
        // app.tsx handles the 'init' event and plays the most recent broadcast if needed
        // We only handle subtitle/speaking state here
      }
      
      if (data.type === 'sync' && data.audioBase64) {
        // Audio playback is handled by app.tsx to avoid duplicate audio
        // Only set speaking state here for UI consistency
        console.log('[Chat] Received SYNC event from server - audio handled by app.tsx');
        this.setChatSpeaking?.(true);
        if (data.subtitleText) {
          subtitleEvents.emit(data.subtitleText);
        }
      }
      
      // Handle subtitle-only updates from polling (ensures all clients show same subtitle)
      if (data.type === 'subtitle' && data.text) {
        console.log('[Chat] Received SUBTITLE event from polling');
        subtitleEvents.emit(data.text);
        this.setChatSpeaking?.(data.speaking);
      }
      
      // Handle sync-end to clear speaking state (server-controlled timing)
      if (data.type === 'sync-end') {
        console.log('[Chat] Received SYNC-END event from server');
        this.setChatSpeaking?.(false);
        // Clear subtitles when speaking ends
        subtitleEvents.clear();
      }
    });
  }

  private broadcastSpeakingState(speaking: boolean, text?: string): void {
    // Broadcast speaking state AND text to ALL connected clients
    // This ensures all viewers see the same subtitles when Niya speaks
    // Only the host can broadcast - viewers receive via SSE
    if (typeof window !== 'undefined' && broadcastManager.isHost()) {
      broadcastManager.broadcastSubtitle(text || '', speaking);
    }
  }

  private async broadcastAudio(audioBuffer: ArrayBuffer, emotion?: string): Promise<void> {
    // Only the host broadcasts audio to all viewers
    if (typeof window !== 'undefined' && broadcastManager.isHost()) {
      await broadcastManager.broadcastAudio(audioBuffer, emotion);
    }
  }

  private async playAudioFromBase64(audioBase64: string, emotion?: string, subtitleText?: string): Promise<void> {
    // Convert base64 back to ArrayBuffer
    try {
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBuffer = bytes.buffer;

      console.log('[Audio] Received server broadcast audio, size:', audioBuffer.byteLength, 'bytes');

      // Set speaking state
      this.setChatSpeaking?.(true);
      
      // Show subtitle if provided
      if (subtitleText) {
        subtitleEvents.emit(subtitleText);
      }

      // Try to play with model lip sync first
      if (this.viewer?.model?.speak) {
        const screenplay: Screenplay = {
          talk: {
            style: 'talk' as any,
            message: subtitleText || '',
          },
          expression: (emotion as any) || 'neutral',
          text: subtitleText || '',
        };
        await this.viewer.model.speak(audioBuffer, screenplay);
      } else {
        // Fallback: play directly via AudioContext
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        const audioBufferDecoded = await audioContext.decodeAudioData(audioBuffer.slice(0));
        const source = audioContext.createBufferSource();
        source.buffer = audioBufferDecoded;
        source.connect(audioContext.destination);
        source.start(0);
        await new Promise(resolve => {
          source.onended = resolve;
        });
        await audioContext.close();
      }
      
      // Audio finished locally - server controls sync-end timing
      // Do not call serverSpeakEnd() to avoid race conditions
      console.log('[Audio] Local playback finished - waiting for server sync-end');
      
      // Trigger LiveChat refresh after audio
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('livechat-refresh'));
      }
    } catch (e) {
      console.error('[Audio] Failed to play broadcast audio:', e);
    }
  }
  
  public isHostBroadcaster(): boolean {
    return broadcastManager.isHost();
  }

  public setMessageList(messages: Message[]) {
    this.messageList = messages;
    this.currentAssistantMessage = "";
    this.currentUserMessage = "";
    this.setChatLog!(this.messageList!);
    this.setAssistantMessage!(this.currentAssistantMessage);
    this.setUserMessage!(this.currentAssistantMessage);
    this.currentStreamIdx++;
  }

  public async handleRvc(audio: any) {
    const rvcModelName = config("rvc_model_name");
    const rvcIndexPath = config("rvc_index_path");
    const rvcF0upKey = parseInt(config("rvc_f0_upkey"));
    const rvcF0Method = config("rvc_f0_method");
    const rvcIndexRate = config("rvc_index_rate");
    const rvcFilterRadius = parseInt(config("rvc_filter_radius"));
    const rvcResampleSr = parseInt(config("rvc_resample_sr"));
    const rvcRmsMixRate = parseInt(config("rvc_rms_mix_rate"));
    const rvcProtect = parseInt(config("rvc_protect"));

    const voice = await rvc(
      audio,
      rvcModelName,
      rvcIndexPath,
      rvcF0upKey,
      rvcF0Method,
      rvcIndexRate,
      rvcFilterRadius,
      rvcResampleSr,
      rvcRmsMixRate,
      rvcProtect,
    );

    return voice.audio;
  }

  public idleTime(): number {
    return characterIdleTime(this.lastAwake);
  }

  public isAwake() {
    return !isCharacterIdle(this.lastAwake);
  }

  public updateAwake() {
    this.lastAwake = new Date().getTime();
    resetIdleTimer();
  }

  // Prefetch cache for parallel TTS processing - stores promises by message text
  private ttsPrefetchCache: Map<string, Promise<ArrayBuffer | null>> = new Map();
  // Buffer to collect jobs and prefetch multiple at once
  private pendingJobsBuffer: TTSJob[] = [];
  
  public async processTtsJobs() {
    while (true) {
      // Collect all available jobs first (non-blocking)
      while (this.ttsJobs.size() > 0) {
        const job = this.ttsJobs.dequeue();
        if (job) {
          this.pendingJobsBuffer.push(job);
        }
      }
      
      // Start prefetch for ALL valid jobs in buffer (parallel)
      for (const job of this.pendingJobsBuffer) {
        if (job.streamIdx === this.currentStreamIdx && 
            job.role === "assistant" &&
            !this.ttsPrefetchCache.has(job.screenplay.talk.message)) {
          const promise = this.fetchAudio(job.screenplay.talk);
          this.ttsPrefetchCache.set(job.screenplay.talk.message, promise);
        }
      }
      
      // Process jobs one by one (but audio is already being fetched in parallel)
      while (this.pendingJobsBuffer.length > 0) {
        const ttsJob = this.pendingJobsBuffer.shift()!;
        const messageKey = ttsJob.screenplay.talk.message;
        
        if (ttsJob.streamIdx !== this.currentStreamIdx) {
          console.log("skipping tts for streamIdx");
          // Clean up any prefetched audio for skipped job
          this.ttsPrefetchCache.delete(messageKey);
          continue;
        }

        if (ttsJob.role !== "assistant") {
          console.log("skipping tts for non-assistant message");
          // Clean up any prefetched audio for skipped job
          this.ttsPrefetchCache.delete(messageKey);
          continue;
        }
        
        // Get the prefetched promise or start a new one
        let audioPromise = this.ttsPrefetchCache.get(messageKey);
        if (!audioPromise) {
          audioPromise = this.fetchAudio(ttsJob.screenplay.talk);
        }
        
        // Wait for this audio to complete
        const audioBuffer = await audioPromise;
        
        // Clean up this entry from cache
        this.ttsPrefetchCache.delete(messageKey);
        
        this.speakJobs.enqueue({
          audioBuffer,
          screenplay: ttsJob.screenplay,
          streamIdx: ttsJob.streamIdx,
        });
        
        // Check for new jobs that arrived while we were waiting
        while (this.ttsJobs.size() > 0) {
          const newJob = this.ttsJobs.dequeue();
          if (newJob) {
            this.pendingJobsBuffer.push(newJob);
            // Start prefetch for new job immediately
            if (newJob.streamIdx === this.currentStreamIdx && 
                newJob.role === "assistant" &&
                !this.ttsPrefetchCache.has(newJob.screenplay.talk.message)) {
              const promise = this.fetchAudio(newJob.screenplay.talk);
              this.ttsPrefetchCache.set(newJob.screenplay.talk.message, promise);
            }
          }
        }
      }
      
      await wait(50);
    }
  }

  public async processSpeakJobs() {
    while (true) {
      do {
        const speak = this.speakJobs.dequeue();
        if (!speak) {
          break;
        }
        if (speak.streamIdx !== this.currentStreamIdx) {
          console.log("skipping speak for streamIdx");
          continue;
        }

        if ((window as any).chatvrm_latency_tracker) {
          if ((window as any).chatvrm_latency_tracker.active) {
            const ms =
              +new Date() - (window as any).chatvrm_latency_tracker.start;
            console.log("performance_latency", ms);
            (window as any).chatvrm_latency_tracker.active = false;
          }
        }

        this.bubbleMessage("assistant", speak.screenplay.talk.message);

        // Use the complete response for subtitles
        const subtitleText = this.lastCompleteResponse || speak.screenplay.talk.message;
        const cleanSubtitleText = subtitleText.replace(/\[[a-zA-Z]+\]/g, '').trim();
        
        // Skip if TTS is muted or no text
        if (config("tts_muted") === "true" || !cleanSubtitleText) {
          continue;
        }

        // Save to liveshow database FIRST to get the stable ID
        let dbId = await this.saveToLiveshow(cleanSubtitleText);
        if (dbId === null) {
          console.warn('[Chat] First save attempt failed, retrying...');
          await wait(100);
          dbId = await this.saveToLiveshow(cleanSubtitleText);
        }
        
        const chatMessage = dbId !== null ? {
          id: dbId,
          role: 'assistant',
          content: cleanSubtitleText,
        } : undefined;

        // SERVER-BASED BROADCAST (Option B):
        // Call the server to generate TTS and broadcast to ALL clients
        // The server handles caching and sends sync event to everyone
        console.log('[Chat] Requesting server-side TTS and broadcast...');
        
        const result = await broadcastManager.serverSpeak({
          text: cleanSubtitleText,
          voiceId: config("elevenlabs_voiceid") || undefined,
          emotion: speak.screenplay.expression,
          subtitleText: cleanSubtitleText,
          chatMessage,
        });
        
        if (!result.success) {
          console.error('[Chat] Server speak failed:', result.error);
        } else {
          console.log('[Chat] Server speak success, from cache:', result.fromCache);
          // Audio will be received via SSE sync event and played by initBroadcastAudioListener
          // Wait a bit for the audio to finish playing on all clients
          // The sync-end event will be sent by the server or we can trigger it here
        }
        
        // Clear lastCompleteResponse after finished speaking
        this.lastCompleteResponse = "";
        this.isAwake() ? this.updateAwake() : null;
        
      } while (this.speakJobs.size() > 0);
      await wait(50);
    }
  }

  public thoughtBubbleMessage(isThinking: boolean, thought: string) {
    // if not thinking, we should clear the thought bubble 
    if (!isThinking) {
      this.thoughtMessage = "";
      this.setThoughtMessage!("");
      return;
    }

    if (this.thoughtMessage !== "") {
      this.thoughtMessage += " ";
    }
    this.thoughtMessage += thought;
    this.setThoughtMessage!(this.thoughtMessage);
  }

  public bubbleMessage(role: Role, text: string) {
    // Strip any emotion tags from the text before displaying
    const cleanText = text.replace(/\[[a-zA-Z]+\]/g, '').trim();
    
    if (role === "user") {
      // add space if there is already a partial message
      if (this.currentUserMessage !== "") {
        this.currentUserMessage += " ";
      }
      this.currentUserMessage += cleanText;
      this.setUserMessage!(this.currentUserMessage);
      this.setAssistantMessage!("");

      if (this.currentAssistantMessage !== "") {
        this.messageList!.push({
          role: "assistant",
          content: this.currentAssistantMessage,
        });

        this.currentAssistantMessage = "";
      }

      this.setChatLog!([
        ...this.messageList!,
        { role: "user", content: this.currentUserMessage },
      ]);
    }

    if (role === "assistant") {
      if (
        this.currentAssistantMessage != "" &&
        !this.isAwake() &&
        config("niya_life_enabled") === "true"
      ) {
        this.messageList!.push({
          role: "assistant",
          content: this.currentAssistantMessage,
        });

        this.currentAssistantMessage = cleanText;
        this.setAssistantMessage!(this.currentAssistantMessage);
      } else if (config("chatbot_backend") === "moshi") {
        if (this.currentAssistantMessage !== "") {
          this.messageList!.push({
            role: "assistant",
            content: this.currentAssistantMessage,
          });
        }
        this.currentAssistantMessage = cleanText;
        this.setAssistantMessage!(this.currentAssistantMessage);
        this.setUserMessage!("");

      } else {
        this.currentAssistantMessage += cleanText;
        this.setUserMessage!("");
        this.setAssistantMessage!(this.currentAssistantMessage);
      }

      // DISABLED: Do not emit subtitles during streaming
      // Subtitles will be shown synchronized with audio in processSpeakJobs
      // Streaming subtitles cause desync because they appear before audio is ready
      // if (this.readyForSubtitles) {
      //   subtitleEvents.emit(this.currentAssistantMessage);
      // }

      if (this.currentUserMessage !== "") {
        this.messageList!.push({
          role: "user",
          content: this.currentUserMessage,
        });

        this.currentUserMessage = "";
      }

      this.setChatLog!([
        ...this.messageList!,
        { role: "assistant", content: this.currentAssistantMessage },
      ]);
    }

    this.setShownMessage!(role);
  }

  // Speak directly as a monologue - no fake user message, just Niya talking
  // These monologues are NOT added to messageList to prevent self-conversation loops
  // This is intentional per user request to prevent AI responding to its own messages
  public async speakDirectly(text: string) {
    if (!text || text.trim() === "") {
      return;
    }

    // Create screenplay for the text
    const screenplays = textsToScreenplay([text]);
    if (screenplays.length === 0) return;

    const screenplay = screenplays[0];
    
    // Clean the text from emotion tags
    const cleanText = screenplay.talk.message.replace(/\[[a-zA-Z]+\]/g, '').trim();
    
    // Commit any existing assistant message before replacing
    if (this.currentAssistantMessage !== "" && this.currentAssistantMessage !== cleanText) {
      // Don't add monologues to messageList - intentionally prevents self-loop
      this.currentAssistantMessage = "";
    }
    
    // Display message WITHOUT adding to messageList (to prevent self-loop)
    this.currentAssistantMessage = cleanText;
    this.setAssistantMessage!(cleanText);
    this.setShownMessage!("assistant");
    
    // SERVER-BASED BROADCAST (Option B):
    // Call the server to generate TTS and broadcast to ALL clients
    // The server handles caching and sends sync event to everyone (including this client)
    console.log('[Chat] speakDirectly: Requesting server-side TTS and broadcast...');
    
    const result = await broadcastManager.serverSpeak({
      text: cleanText,
      voiceId: config("elevenlabs_voiceid") || undefined,
      emotion: screenplay.expression,
      subtitleText: cleanText,
      chatMessage: undefined, // Monologues don't add to chat list
    });
    
    if (!result.success) {
      console.error('[Chat] speakDirectly: Server speak failed:', result.error);
    } else {
      console.log('[Chat] speakDirectly: Server speak success, from cache:', result.fromCache);
      // Audio will be received via SSE sync event and played by initBroadcastAudioListener
    }
    
    this.updateAwake();
    
    // Clear after speaking so next real conversation starts fresh
    this.currentAssistantMessage = "";
  }

  public async interrupt() {
    this.currentStreamIdx++;
    try {
      if (this.reader) {
        console.debug("cancelling");
        if (!this.reader?.closed) {
          await this.reader?.cancel();
        }
        // this.reader = null;
        // this.stream = null;
        console.debug("finished cancelling");
      }
    } catch (e: any) {
      console.error(e.toString());
    }

    // TODO if llm type is llama.cpp, we can send /stop message here
    this.ttsJobs.clear();
    this.speakJobs.clear();
    
    // Clear prefetch cache and pending buffer on interrupt to avoid memory leaks
    this.ttsPrefetchCache.clear();
    this.pendingJobsBuffer = [];
    
    // Clear current messages to prevent concatenation with next response
    // This is critical for multi-user scenarios where new messages arrive while previous is still processing
    // Only save to messageList if bot is fully initialized (avoids database access during server startup)
    if (this.initialized && this.currentAssistantMessage !== "" && this.messageList) {
      // Save the current response to messageList before clearing (if it was a real response)
      this.messageList.push({
        role: "assistant",
        content: this.currentAssistantMessage,
      });
    }
    this.currentAssistantMessage = "";
    this.setAssistantMessage?.("");
    
    if (this.initialized && this.currentUserMessage !== "" && this.messageList) {
      this.messageList.push({
        role: "user", 
        content: this.currentUserMessage,
      });
    }
    this.currentUserMessage = "";
    this.setUserMessage?.("");
    
    // TODO stop viewer from speaking
  }

  // Helper function to save assistant response to liveshow for public display
  // Returns the database ID of the saved message for use in synchronized broadcasts
  // Note: User messages are already saved by queue.ts when saveUserMessage is true
  private async saveToLiveshow(assistantResponse: string): Promise<number | null> {
    try {
      // Strip all emotion tags like [happy], [neutral], [curious], etc. from the response
      const cleanedResponse = assistantResponse.replace(/\[[a-zA-Z]+\]/g, '').trim();
      
      if (!cleanedResponse) {
        console.log("[Chat] Empty response, skipping save to liveshow");
        return null;
      }
      
      // Only save assistant response - user message is already saved by /api/liveshow/queue
      const res = await fetch("/api/liveshow/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantResponse: cleanedResponse,
        }),
      });
      
      if (!res.ok) {
        console.error("[Chat] Failed to save to liveshow:", res.status);
        return null;
      }
      
      const data = await res.json();
      // API returns array of saved messages - get the ID from the assistant message
      const savedMessage = Array.isArray(data) ? data[0] : data;
      const dbId = savedMessage?.id || null;
      
      console.log("[Chat] Response saved to liveshow with ID:", dbId);
      return dbId;
    } catch (e) {
      console.error("Failed to save to liveshow:", e);
      return null;
    }
  }

  // this happens either from text or from voice / whisper completion
  public async receiveMessageFromUser(message: string, amicaLife: boolean) {
    if (message === null || message === "") {
      console.warn("[Chat] Received empty message, ignoring");
      return;
    }

    console.log("[Chat] ===== USER MESSAGE RECEIVED =====");
    console.log("[Chat] Message:", message);
    console.log("[Chat] AmicaLife:", amicaLife);

    console.time("performance_interrupting");
    console.debug("interrupting...");
    await this.interrupt();
    console.timeEnd("performance_interrupting");
    await wait(0);
    console.debug("wait complete");

    // Store original message without emotion tag for display
    const originalMessage = message;

    if (!amicaLife) {
      console.log("[Chat] Processing user message:", message);

      // For external API
      await handleUserInput(message);

      this.updateAwake();
      // Display original message to user (without emotion tag)
      this.bubbleMessage("user", originalMessage);
    }

    // Get max history from config and apply sliding window
    const maxHistory = parseInt(config("max_history_messages")) || 20;
    const recentMessages = this.messageList!.slice(-maxHistory);

    // Build message for LLM - user message goes without emotion prefix
    const userContent = amicaLife ? message : originalMessage;

    // make new stream with limited history
    const messages: Message[] = [
      { role: "system", content: config("system_prompt") },
      ...recentMessages,
      { role: "user", content: userContent },
    ];
    // console.debug('messages', messages);

    const aiResponse = await this.makeAndHandleStream(messages);
    
    // Store complete response for synchronized subtitles across all clients
    if (aiResponse && typeof aiResponse === 'string' && aiResponse.trim()) {
      // Clean the response from emotion tags for subtitle display
      this.lastCompleteResponse = aiResponse.replace(/\[[a-zA-Z]+\]/g, '').trim();
    }
    
    // Note: Saving to liveshow is now done in processSpeakJobs() right before broadcast
    // This ensures the DB ID is available for synchronized broadcast to all viewers
  }

  public initSSE() {
    if (!isDev || config("external_api_enabled") !== "true") {
      return;
    }  
    // Close existing SSE connection if it exists
    this.closeSSE();

    this.eventSource = new EventSource('/api/amicaHandler');

    // Listen for incoming messages from the server
    this.eventSource.onmessage = async (event) => {
      try {
        // Parse the incoming JSON message
        const message = JSON.parse(event.data);

        console.log(message);

        // Destructure to get the message type and data
        const { type, data } = message;

        // Handle the message based on its type
        switch (type) {
          case 'normal':
            console.log('Normal message received:', data);
            const messages: Message[] = [
              { role: "system", content: config("system_prompt") },
              ...this.messageList!,
              { role: "user", content: data},
            ];
            let stream = await getEchoChatResponseStream(messages);
            this.streams.push(stream);
            this.handleChatResponseStream();
            break;
          
          case 'animation':
            console.log('Animation data received:', data);
            const animation = await loadVRMAnimation(`/animations/${data}`);
            if (!animation) {
              throw new Error("Loading animation failed");
            }
            this.viewer?.model?.playAnimation(animation,data);
            requestAnimationFrame(() => { this.viewer?.resetCameraLerp(); });
            break;

          case 'playback':
            console.log('Playback flag received:', data);
            this.viewer?.startRecording();
            // Automatically stop recording after 10 seconds
            setTimeout(() => {
              this.viewer?.stopRecording((videoBlob) => {
                // Log video blob to console
                console.log("Video recording finished", videoBlob);

                // Create a download link for the video file
                const url = URL.createObjectURL(videoBlob!);
                const a = document.createElement("a");
                a.href = url;
                a.download = "recording.webm"; // Set the file name for download
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Revoke the URL to free up memory
                URL.revokeObjectURL(url);
              });
            }, data); // Stop recording after 10 seconds
            break;

          case 'systemPrompt':
            console.log('System Prompt data received:', data);
            updateConfig("system_prompt",data);
            break;

          default:
            console.warn('Unknown message type:', type);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };


    this.eventSource.addEventListener('end', () => {
      console.log('SSE session ended');
      this.eventSource?.close();
    });

    this.eventSource.onerror = () => {
      // SSE connection errors are expected during navigation/reload - silently reconnect
      this.eventSource?.close();
      setTimeout(() => this.initSSE(), 500);
    };
  }

  public closeSSE() {
    if (this.eventSource) {
        console.log("Closing existing SSE connection...");
        this.eventSource.close();
        this.eventSource = null;
    }
}

  public async makeAndHandleStream(messages: Message[]) {
    console.log("[Chat] makeAndHandleStream called with", messages.length, "messages");
    console.log("[Chat] Chatbot backend:", config("chatbot_backend"));
    try {
      const stream = await this.getChatResponseStream(messages);
      console.log("[Chat] Got stream:", stream ? "success" : "null");
      this.streams.push(stream);
    } catch (e: any) {
      const errMsg = e.toString();
      console.error("[Chat] Failed to get chat response:", errMsg);
      this.alert?.error("Failed to get chat response", errMsg);
      return errMsg;
    }

    if (this.streams[this.streams.length - 1] == null) {
      const errMsg = "Error: Null stream encountered.";
      console.error("[Chat]", errMsg);
      this.alert?.error("Null stream encountered", errMsg);
      return errMsg;
    }

    return await this.handleChatResponseStream();
  }

  public async handleChatResponseStream() {
    if (this.streams.length === 0) {
      console.log("no stream!");
      return;
    }

    this.currentStreamIdx++;
    const streamIdx = this.currentStreamIdx;
    this.setChatProcessing!(true);

    console.time("chat stream processing");
    let reader = this.streams[this.streams.length - 1].getReader();
    this.readers.push(reader);
    let sentences = new Array<string>(); // Keep stateful for processResponse

    let aiTextLog = "";
    let tag = "";
    let isThinking = false;
    let rolePlay = "";
    let receivedMessage = "";
    let fullResponseText = ""; // Accumulate complete response for single TTS

    let firstTokenEncountered = false;
    console.time("performance_time_to_first_token");

    try {
      // Read entire stream and accumulate the complete response
      while (true) {
        if (this.currentStreamIdx !== streamIdx) {
          console.log("wrong stream idx");
          break;
        }
        const { done, value } = await reader.read();
        if (!firstTokenEncountered) {
          console.timeEnd("performance_time_to_first_token");
          firstTokenEncountered = true;
        }
        if (done) break;

        receivedMessage += value;
        receivedMessage = receivedMessage.trimStart();

        // Parse for thinking tags and rolePlay but DON'T send to TTS yet
        const proc = processResponse({
          sentences, // Keep stateful to accumulate properly
          aiTextLog,
          receivedMessage,
          tag,
          isThinking,
          rolePlay,
          callback: (aiTalks: Screenplay[]): boolean => {
            if (streamIdx !== this.currentStreamIdx) {
              return true; // should break
            }

            // Accumulate text for final TTS (don't send to ttsJobs yet)
            if (!isThinking && aiTalks[0]?.text) {
              fullResponseText += aiTalks[0].text + " ";
            }

            // Show thinking bubble for thoughts
            this.thoughtBubbleMessage(isThinking, aiTalks[0].text);

            return false;
          },
        });

        sentences = proc.sentences; // Update sentences state
        aiTextLog = proc.aiTextLog;
        receivedMessage = proc.receivedMessage;
        tag = proc.tag;
        isThinking = proc.isThinking;
        rolePlay = proc.rolePlay;
        if (proc.shouldBreak) {
          break;
        }
      }

      // Stream complete - now send the FULL response as ONE TTS job
      fullResponseText = fullResponseText.trim();
      if (fullResponseText && streamIdx === this.currentStreamIdx) {
        console.log("[TTS] Sending complete response as single audio:", fullResponseText.substring(0, 100) + "...");
        
        // Create a single screenplay for the complete response
        const fullScreenplays = textsToScreenplay([fullResponseText]);
        if (fullScreenplays.length > 0) {
          this.ttsJobs.enqueue({
            screenplay: fullScreenplays[0],
            streamIdx: streamIdx,
            role: "assistant",
          });
        }
      }
    } catch (e: any) {
      const errMsg = e.toString();
      this.bubbleMessage!("assistant", errMsg);
      console.error(errMsg);
    } finally {
      if (!reader.closed) {
        reader.releaseLock();
      }
      console.timeEnd("chat stream processing");
      if (streamIdx === this.currentStreamIdx) {
        this.setChatProcessing!(false);
      }
    }

    return aiTextLog;
  }

  async fetchAudio(talk: Talk): Promise<ArrayBuffer | null> {
    talk = cleanTalk(talk);
    if (talk.message.trim() === "" || config("tts_muted") === "true") {
      return null;
    }

    const ttsBackend = config("tts_backend");
    if (ttsBackend === "none") {
      return null;
    }

    const rvcEnabled = config("rvc_enabled") === "true";
    const voiceId = config("elevenlabs_voiceid") || "default";

    // Check cache first for ElevenLabs (main cost saver)
    if (ttsBackend === "elevenlabs") {
      const cached = ttsCache.get(talk.message, voiceId);
      if (cached) {
        console.log('[TTS Cache] Hit - reusing cached audio');
        if (rvcEnabled) {
          return await this.handleRvc(cached);
        }
        return cached;
      }

      // Apply rate limiting for ElevenLabs to prevent excessive API calls
      const canProceed = await ttsRateLimiter.acquire();
      if (!canProceed) {
        console.log('[TTS Rate Limiter] Request dropped - queue full');
        return null;
      }
    }

    try {
      let audio: ArrayBuffer | null = null;

      switch (ttsBackend) {
        case "elevenlabs": {
          const voice = await elevenlabs(talk.message, voiceId, talk.style);
          audio = voice.audio;
          if (audio) {
            ttsCache.set(talk.message, voiceId, audio);
            console.log('[TTS Cache] Stored new audio');
          }
          break;
        }
        case "speecht5": {
          const speakerEmbeddingUrl = config("speecht5_speaker_embedding_url");
          const voice = await speecht5(talk.message, speakerEmbeddingUrl);
          audio = voice.audio;
          break;
        }
        case "openai_tts": {
          const voice = await openaiTTS(talk.message);
          audio = voice.audio;
          break;
        }
        case "localXTTS": {
          const voice = await localXTTSTTS(talk.message);
          audio = voice.audio;
          break;
        }
        case "piper": {
          const voice = await piper(talk.message);
          audio = voice.audio;
          break;
        }
        case "coquiLocal": {
          const voice = await coquiLocal(talk.message);
          audio = voice.audio;
          break;
        }
        case "kokoro": {
          const voice = await kokoro(talk.message);
          audio = voice.audio;
          break;
        }
      }

      if (audio && rvcEnabled) {
        return await this.handleRvc(audio);
      }
      return audio;
    } catch (e: any) {
      console.error(e.toString());
      this.alert?.error("Failed to get TTS response", e.toString());
      return null;
    } finally {
      if (ttsBackend === "elevenlabs") {
        ttsRateLimiter.release();
      }
    }
  }

  public async getChatResponseStream(messages: Message[]) {
    console.log("[Chat] getChatResponseStream called");
    const chatbotBackend = config("chatbot_backend");
    console.log("[Chat] Using chatbot backend:", chatbotBackend);

    // Extract the system prompt and convo messages
    const systemPrompt = messages.find((msg) => msg.role === "system")!;
    const conversationMessages = messages.filter((msg) => msg.role !== "system");

    if (config("reasoning_engine_enabled") === "true") {
      return getReasoingEngineChatResponseStream(systemPrompt, conversationMessages)
    } 

    switch (chatbotBackend) {
      case "arbius_llm":
        return getArbiusChatResponseStream(messages);
      case "chatgpt":
      case "openai":
        return getOpenAiChatResponseStream(messages);
      case "llamacpp":
        return getLlamaCppChatResponseStream(messages);
      case "windowai":
        return getWindowAiChatResponseStream(messages);
      case "ollama":
        return getOllamaChatResponseStream(messages);
      case "koboldai":
        return getKoboldAiChatResponseStream(messages);
      case 'openrouter':
        return getOpenRouterChatResponseStream(messages);
      case 'dgrid':
        // DGrid AI Gateway — unified access to 200+ LLMs via one API.
        // https://dgrid.ai · https://docs.dgrid.ai/AI-Gateway-Integrations
        return getDGridChatResponseStream(messages);
    }

    return getEchoChatResponseStream(messages);
  }

  public async getVisionResponse(imageData: string) {
    try {
      const visionBackend = config("vision_backend");

      console.debug("vision_backend", visionBackend);

      let res = "";
      if (visionBackend === "vision_llamacpp") {
        const messages: Message[] = [
          { role: "system", content: config("vision_system_prompt") },
          ...this.messageList!,
          {
            role: "user",
            content: "Describe the image as accurately as possible",
          },
        ];

        res = await getLlavaCppChatResponse(messages, imageData);
      } else if (visionBackend === "vision_ollama") {
        const messages: Message[] = [
          { role: "system", content: config("vision_system_prompt") },
          ...this.messageList!,
          {
            role: "user",
            content: "Describe the image as accurately as possible",
          },
        ];

        res = await getOllamaVisionChatResponse(messages, imageData);
      } else if (visionBackend === "vision_openai") {
        const messages: Message[] = [
          { role: "user", content: config("vision_system_prompt") },
          ...this.messageList! as any[],
          {
            role: "user",
            // @ts-ignore normally this is a string
            content: [
              {
                type: "text",
                text: "Describe the image as accurately as possible",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageData}`,
                },
              },
            ],
          },
        ];

        res = await getOpenAiVisionChatResponse(messages);
      } else {
        console.warn("vision_backend not supported", visionBackend);
        return;
      }

      await this.makeAndHandleStream([
        { role: "system", content: config("system_prompt") },
        ...this.messageList!,
        {
          role: "user",
          content: `This is a picture I just took from my webcam (described between [[ and ]] ): [[${res}]] Please respond accordingly and as if it were just sent and as though you can see it.`,
        },
      ]);
    } catch (e: any) {
      console.error("getVisionResponse", e.toString());
      this.alert?.error("Failed to get vision response", e.toString());
    }
  }
}
