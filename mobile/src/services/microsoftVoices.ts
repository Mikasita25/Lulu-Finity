export type MicrosoftVoice = {
  identifier: string;
  name: string;
  language: string;
  quality: 'Microsoft Neural';
  gender: 'female' | 'male';
};

export const MICROSOFT_VOICES: readonly MicrosoftVoice[] = [
  { identifier: 'es-MX-DaliaNeural', name: 'Dalia · Microsoft', language: 'es-MX', quality: 'Microsoft Neural', gender: 'female' },
  { identifier: 'es-MX-JorgeNeural', name: 'Jorge · Microsoft', language: 'es-MX', quality: 'Microsoft Neural', gender: 'male' },
  { identifier: 'es-MX-CandelaNeural', name: 'Candela · Microsoft', language: 'es-MX', quality: 'Microsoft Neural', gender: 'female' },
  { identifier: 'es-MX-GerardoNeural', name: 'Gerardo · Microsoft', language: 'es-MX', quality: 'Microsoft Neural', gender: 'male' },
  { identifier: 'es-MX-MarinaNeural', name: 'Marina · Microsoft', language: 'es-MX', quality: 'Microsoft Neural', gender: 'female' },
  { identifier: 'es-ES-ElviraNeural', name: 'Elvira · Microsoft', language: 'es-ES', quality: 'Microsoft Neural', gender: 'female' },
  { identifier: 'es-ES-AlvaroNeural', name: 'Álvaro · Microsoft', language: 'es-ES', quality: 'Microsoft Neural', gender: 'male' },
  { identifier: 'es-US-PalomaNeural', name: 'Paloma · Microsoft', language: 'es-US', quality: 'Microsoft Neural', gender: 'female' },
  { identifier: 'es-US-AlonsoNeural', name: 'Alonso · Microsoft', language: 'es-US', quality: 'Microsoft Neural', gender: 'male' },
  { identifier: 'es-AR-ElenaNeural', name: 'Elena · Microsoft', language: 'es-AR', quality: 'Microsoft Neural', gender: 'female' },
  { identifier: 'es-AR-TomasNeural', name: 'Tomás · Microsoft', language: 'es-AR', quality: 'Microsoft Neural', gender: 'male' },
  { identifier: 'en-US-AriaNeural', name: 'Aria · Microsoft', language: 'en-US', quality: 'Microsoft Neural', gender: 'female' },
  { identifier: 'en-US-GuyNeural', name: 'Guy · Microsoft', language: 'en-US', quality: 'Microsoft Neural', gender: 'male' },
] as const;

const voiceIds = new Set(MICROSOFT_VOICES.map((voice) => voice.identifier));

export function defaultMicrosoftVoice(language = 'es-MX') {
  if (language === 'en-US') return 'en-US-AriaNeural';
  if (language === 'es-ES') return 'es-ES-ElviraNeural';
  return 'es-MX-DaliaNeural';
}

export function normalizeMicrosoftVoice(voice: string | undefined, language = 'es-MX') {
  return voice && voiceIds.has(voice) ? voice : defaultMicrosoftVoice(language);
}
