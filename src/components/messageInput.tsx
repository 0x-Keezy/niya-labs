import * as ort from "onnxruntime-web"
ort.env.wasm.wasmPaths = '/_next/static/chunks/'

import { useContext, useEffect, useRef, useState } from "react";
import { useMicVAD } from "@ricky0123/vad-react"
import { IconButton } from "./iconButton";
import { useTranscriber } from "@/hooks/useTranscriber";
import { cleanTranscript, cleanFromPunctuation, cleanFromWakeWord } from "@/utils/stringProcessing";
import { hasOnScreenKeyboard } from "@/utils/hasOnScreenKeyboard";
import { AlertContext } from "@/features/alert/alertContext";
import { ChatContext } from "@/features/chat/chatContext";
import { openaiWhisper  } from "@/features/openaiWhisper/openaiWhisper";
import { whispercpp  } from "@/features/whispercpp/whispercpp";
import { config } from "@/utils/config";
import { WaveFile } from "wavefile";
import { AudioControlsContext } from "@/features/moshi/components/audioControlsContext";


export default function MessageInput({
  userMessage,
  setUserMessage,
  isChatProcessing,
  onChangeUserMessage,
}: {
  userMessage: string;
  setUserMessage: (message: string) => void;
  isChatProcessing: boolean;
  onChangeUserMessage: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
}) {
  const transcriber = useTranscriber();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [whisperOpenAIOutput, setWhisperOpenAIOutput] = useState<any | null>(null);
  const [whisperCppOutput, setWhisperCppOutput] = useState<any | null>(null);
  const { chat: bot } = useContext(ChatContext);
  const { alert } = useContext(AlertContext);
  const { audioControls: moshi } = useContext(AudioControlsContext);
  const [ moshiMuted, setMoshiMuted] = useState(moshi.isMuted());

  const vad = useMicVAD({
    startOnLoad: false,
    workletURL: '/_next/static/chunks/vad.worklet.bundle.min.js',
    modelURL: '/_next/static/chunks/silero_vad.onnx',
    onSpeechStart: () => {
      console.log('[VAD] Speech started');
      console.time('performance_speech');
    },
    onSpeechEnd: (audio: Float32Array) => {
      console.debug('vad', 'on_speech_end');
      console.timeEnd('performance_speech');
      console.time('performance_transcribe');
      (window as any).chatvrm_latency_tracker = {
        start: +Date.now(),
        active: true,
      };

      try {
        switch (config("stt_backend")) {
          case 'whisper_browser': {
            console.debug('whisper_browser attempt');
            // since VAD sample rate is same as whisper we do nothing here
            // both are 16000
            const audioCtx = new AudioContext();
            const buffer = audioCtx.createBuffer(1, audio.length, 16000);
            buffer.copyToChannel(new Float32Array(audio.buffer) as Float32Array<ArrayBuffer>, 0, 0);
            transcriber.start(buffer);
            break;
          }
          case 'whisper_openai': {
            console.debug('whisper_openai attempt');
            const wav = new WaveFile();
            wav.fromScratch(1, 16000, '32f', audio);
            const wavBuffer = wav.toBuffer();
            const file = new File([wavBuffer as unknown as BlobPart], "input.wav", { type: "audio/wav" });

            let prompt;
            // TODO load prompt if it exists

            (async () => {
              try {
                const transcript = await openaiWhisper(file, prompt);
                setWhisperOpenAIOutput(transcript);
              } catch (e: any) {
                console.error('whisper_openai error', e);
                alert.error('whisper_openai error', e.toString());
              }
            })();
            break;
          }
          case 'whispercpp': {
            console.debug('whispercpp attempt');
            const wav = new WaveFile();
            wav.fromScratch(1, 16000, '32f', audio);
            wav.toBitDepth('16');
            const wavBuffer2 = wav.toBuffer();
            const file = new File([wavBuffer2 as unknown as BlobPart], "input.wav", { type: "audio/wav" });

            let prompt;
            // TODO load prompt if it exists

            (async () => {
              try {
                const transcript = await whispercpp(file, prompt);
                setWhisperCppOutput(transcript);
              } catch (e: any) {
                console.error('whispercpp error', e);
                alert.error('whispercpp error', e.toString());
              }
            })();
            break;
          }
        }
      } catch (e: any) {
        console.error('stt_backend error', e);
        alert.error('STT backend error', e.toString());
      }
    },
  });

  useEffect(() => {
    console.log('[VAD] State changed:', {
      listening: vad.listening,
      loading: vad.loading,
      errored: vad.errored,
      userSpeaking: vad.userSpeaking
    });
  }, [vad.listening, vad.loading, vad.errored, vad.userSpeaking]);

  if (vad.errored) {
    console.error('[VAD] Error:', vad.errored);
  }

  function handleTranscriptionResult(preprocessed: string) {
    const cleanText = cleanTranscript(preprocessed);
    const wakeWordEnabled = config("wake_word_enabled") === 'true';
    const textStartsWithWakeWord = wakeWordEnabled && cleanFromPunctuation(cleanText).startsWith(cleanFromPunctuation(config("wake_word")));
    const text = wakeWordEnabled && textStartsWithWakeWord ? cleanFromWakeWord(cleanText, config("wake_word")) : cleanText;

    if (wakeWordEnabled) {
      if (textStartsWithWakeWord) {
        bot.updateAwake();
      } else {
        if (!bot.isAwake()) {
          bot.updateAwake();
        }
      }
    } else {
      bot.updateAwake();
    }

    if (text === "") {
      return;
    }

    if (config("autosend_from_mic") === 'true') {
      if (!wakeWordEnabled || bot.isAwake()) {
        bot.receiveMessageFromUser(text, false);
      } 
    } else {
      setUserMessage(text);
    }
    console.timeEnd('performance_transcribe');
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    onChangeUserMessage(event); 
    bot.updateAwake();
  }

  // for whisper_browser
  useEffect(() => {
    if (transcriber.output && ! transcriber.isBusy) {
      const output = transcriber.output?.text;
      handleTranscriptionResult(output);
    }
  }, [transcriber]);

  // for whisper_openai
  useEffect(() => {
    if (whisperOpenAIOutput) {
      const output = whisperOpenAIOutput?.text;
      handleTranscriptionResult(output);
    }
  }, [whisperOpenAIOutput]);

  // for whispercpp
  useEffect(() => {
    if (whisperCppOutput) {
      const output = whisperCppOutput?.text;
      handleTranscriptionResult(output);
    }
  }, [whisperCppOutput]);

  function clickedSendButton() {
    bot.receiveMessageFromUser(userMessage,false);
    // only if we are using non-VAD mode should we focus on the input
    if (! vad.listening) {
      if (! hasOnScreenKeyboard()) {
        inputRef.current?.focus();
      }
    }
    setUserMessage("");
  }

  return (
    <div className="fixed bottom-2 z-20 w-full">
      <div className="mx-auto max-w-4xl p-2 backdrop-blur-lg border-0 rounded-lg">
        <div className="grid grid-flow-col grid-cols-[min-content_1fr_min-content] gap-[8px]">
          <div>
            <div className='flex flex-col justify-center items-center'>
              {config("chatbot_backend") === "moshi" ? (
                <IconButton
                iconName={!moshiMuted ? "24/PauseAlt" : "24/Microphone"}
                className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled"
                isProcessing={moshiMuted && moshi.getRecorder() != null}
                disabled={!moshi.getRecorder()}
                onClick={() => {
                  moshi.toggleMute();
                  setMoshiMuted(!moshiMuted);
                }}
              />
              ) : (
                <IconButton
                iconName={vad.listening ? "24/PauseAlt" : "24/Microphone"}
                className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled"
                isProcessing={vad.userSpeaking}
                disabled={config('stt_backend') === 'none' || vad.loading || Boolean(vad.errored)}
                onClick={() => {
                  console.log('[VAD] Toggle clicked. State:', {
                    listening: vad.listening,
                    loading: vad.loading,
                    errored: vad.errored,
                    stt_backend: config('stt_backend')
                  });
                  vad.toggle();
                }}
              />
              )}
            </div>
          </div>

          <textarea
            ref={inputRef}
            placeholder={config("chatbot_backend") === "moshi" ? "Disabled in moshi chatbot" : "Write message here..."}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (hasOnScreenKeyboard()) {
                  (inputRef.current as HTMLTextAreaElement)?.blur();
                }

                if (userMessage === "") {
                  return false;
                }

                clickedSendButton();
              }
            }}
            disabled={config("chatbot_backend") === "moshi"}
            className="disabled block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-gray-400 sm:text-sm sm:leading-6 resize-none max-h-32 overflow-y-auto"
            value={userMessage}
            autoComplete="off"
            rows={1}
            style={{ minHeight: '38px' }}
          />

          <div className='flex flex-col justify-center items-center'>
            <IconButton
              iconName="24/Send"
              className="ml-2 bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled"
              isProcessing={isChatProcessing || transcriber.isBusy}
              disabled={isChatProcessing || !userMessage || transcriber.isModelLoading || config("chatbot_backend") === "moshi"}
              onClick={clickedSendButton}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
