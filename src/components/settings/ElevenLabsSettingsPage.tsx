import { useTranslation } from 'react-i18next';
import { useState } from 'react';

import { BasicPage, FormRow, NotUsingAlert } from './common';
import { TextInput } from "@/components/textInput";
import { SecretTextInput } from "@/components/secretTextInput";
import { config, updateConfig } from "@/utils/config";

const PRESET_VOICES = [
  { id: 'custom', name: 'Custom Voice ID', description: 'Enter your own voice ID' },
  { id: 'JTlYtJrcTzPC71hMLOxo', name: 'Yuki (Anime)', description: 'Japanese anime-style female voice' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily (English)', description: 'English female voice' },
  { id: 'FMgBdHe1YV2Xi0B9anXW', name: 'Hideo (Japanese)', description: 'Japanese male accent' },
];

export function ElevenLabsSettingsPage({
  elevenlabsApiKey,
  setElevenlabsApiKey,
  elevenlabsVoiceId,
  setElevenlabsVoiceId,
  setSettingsUpdated,
}: {
  elevenlabsApiKey: string;
  setElevenlabsApiKey: (key: string) => void;
  elevenlabsVoiceId: string;
  setElevenlabsVoiceId: (id: string) => void;
  setSettingsUpdated: (updated: boolean) => void;
}) {
  const { t } = useTranslation();
  const [selectedPreset, setSelectedPreset] = useState(
    PRESET_VOICES.find(v => v.id === elevenlabsVoiceId)?.id || 'custom'
  );

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    if (presetId !== 'custom') {
      setElevenlabsVoiceId(presetId);
      updateConfig("elevenlabs_voiceid", presetId);
      setSettingsUpdated(true);
    }
  };

  return (
    <BasicPage
      title={t("ElevenLabs") + " "+ t("Settings")}
      description={t("elevenLabs_desc", "Configure ElevenLabs TTS. For Japanese/anime voices, browse the ElevenLabs Voice Library and copy your preferred voice ID.")}
    >
      { config("tts_backend") !== "elevenlabs" && (
        <NotUsingAlert>
          {t("not_using_alert", "You are not currently using {{name}} as your {{what}} backend. These settings will not be used.", {name: t("ElevenLabs"), what: t("TTS")})}
        </NotUsingAlert>
      ) }
      <ul role="list" className="divide-y divide-gray-100 max-w-xs">
        <li className="py-4">
          <FormRow label={t("API Key")}>
            <SecretTextInput
              value={elevenlabsApiKey}
              onChange={(event: React.ChangeEvent<any>) => {
                setElevenlabsApiKey(event.target.value);
                updateConfig("elevenlabs_apikey", event.target.value);
                setSettingsUpdated(true);
              }}
            />
          </FormRow>
        </li>
        <li className="py-4">
          <FormRow label={t("Voice Preset")}>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
              data-testid="select-voice-preset"
            >
              {PRESET_VOICES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} - {voice.description}
                </option>
              ))}
            </select>
          </FormRow>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            For Japanese waifu voices, browse{' '}
            <a 
              href="https://elevenlabs.io/voice-library/anime" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              ElevenLabs Anime Voices
            </a>
            {' '}and copy the voice ID.
          </p>
        </li>
        <li className="py-4">
          <FormRow label={t("Voice ID")}>
            <TextInput
              value={elevenlabsVoiceId}
              onChange={(event: React.ChangeEvent<any>) => {
                setElevenlabsVoiceId(event.target.value);
                updateConfig("elevenlabs_voiceid", event.target.value);
                setSelectedPreset('custom');
                setSettingsUpdated(true);
              }}
            />
          </FormRow>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Current model: eleven_multilingual_v2 (best for Japanese accent)
          </p>
        </li>
      </ul>
    </BasicPage>
  );
}
