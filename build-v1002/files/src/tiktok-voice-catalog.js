'use strict';

const RAW_TIKTOK_VOICES = [
  ['es_mx_002', 'Warm / Español MX', 'es-MX', 'Español'],
  ['es_002', 'Español España', 'es-ES', 'Español'],
  ['en_us_002', 'Jessie', 'en-US', 'TikTok'],
  ['en_male_jomboy', 'Game On', 'en-US', 'TikTok'],
  ['en_male_funny', 'Wacky', 'en-US', 'TikTok'],
  ['en_female_samc', 'Empathetic', 'en-US', 'TikTok'],
  ['en_male_cody', 'Serious', 'en-US', 'TikTok'],
  ['en_female_makeup', 'Beauty Guru', 'en-US', 'TikTok'],
  ['en_female_richgirl', 'Bestie', 'en-US', 'TikTok'],
  ['en_male_grinch', 'Trickster', 'en-US', 'TikTok'],
  ['en_us_006', 'Joey', 'en-US', 'TikTok'],
  ['en_male_narration', 'Story Teller', 'en-US', 'TikTok'],
  ['en_male_deadpool', 'Mr. GoodGuy', 'en-US', 'TikTok'],
  ['en_uk_001', 'Narrator', 'en-GB', 'TikTok'],
  ['en_uk_003', 'English UK', 'en-GB', 'TikTok'],
  ['en_au_001', 'Metro', 'en-AU', 'TikTok'],
  ['en_au_002', 'Smooth', 'en-AU', 'TikTok'],
  ['en_male_jarvis', 'Alfred', 'en-US', 'TikTok'],
  ['en_male_ashmagic', 'Ashmagic', 'en-GB', 'TikTok'],
  ['en_male_olantekkers', 'Olantekkers', 'en-GB', 'TikTok'],
  ['en_male_ukneighbor', 'Lord Cringe', 'en-GB', 'TikTok'],
  ['en_male_ukbutler', 'Mr. Meticulous', 'en-GB', 'TikTok'],
  ['en_female_shenna', 'Debutante', 'en-US', 'TikTok'],
  ['en_female_pansino', 'Varsity', 'en-US', 'TikTok'],
  ['en_male_trevor', 'Marty', 'en-US', 'TikTok'],
  ['en_female_betty', 'Bae', 'en-US', 'TikTok'],
  ['en_male_cupid', 'Cupid', 'en-US', 'TikTok'],
  ['en_female_grandma', 'Granny', 'en-US', 'TikTok'],
  ['en_male_m2_xhxs_m03_christmas', 'Cozy', 'en-US', 'TikTok'],
  ['en_male_santa_narration', 'Author', 'en-US', 'TikTok'],
  ['en_male_santa_effect', 'Santa', 'en-US', 'TikTok'],
  ['en_male_wizard', 'Magician', 'en-US', 'TikTok'],
  ['en_female_emotional', 'Peaceful', 'en-US', 'TikTok'],
  ['en_us_007', 'Professor', 'en-US', 'TikTok'],
  ['en_us_009', 'Scientist', 'en-US', 'TikTok'],
  ['en_us_010', 'Confidence', 'en-US', 'TikTok'],
  ['en_us_ghostface', 'Ghost Face', 'en-US', 'Personajes'],
  ['en_us_chewbacca', 'Chewbacca', 'en-US', 'Personajes'],
  ['en_us_c3po', 'C3PO', 'en-US', 'Personajes'],
  ['en_us_stitch', 'Stitch', 'en-US', 'Personajes'],
  ['en_us_stormtrooper', 'Stormtrooper', 'en-US', 'Personajes'],
  ['en_us_rocket', 'Rocket', 'en-US', 'Personajes'],
  ['en_female_madam_leota', 'Madame Leota', 'en-US', 'Personajes'],
  ['en_male_ghosthost', 'Ghost Host', 'en-US', 'Personajes'],
  ['en_male_pirate', 'Pirate', 'en-US', 'Personajes'],
  ['en_female_f08_twinkle', 'Pop Lullaby', 'en-US', 'Canto'],
  ['en_male_m03_classical', 'Classic Electric', 'en-US', 'Canto'],
  ['en_male_sing_deep_jingle', 'Caroler', 'en-US', 'Canto'],
  ['en_female_ht_f08_newyear', 'NYE 2023', 'en-US', 'Canto'],
  ['en_female_ht_f08_halloween', 'Opera', 'en-US', 'Canto'],
  ['en_female_ht_f08_glorious', 'Euphoric', 'en-US', 'Canto'],
  ['en_male_sing_funny_it_goes_up', 'Hypetrain', 'en-US', 'Canto'],
  ['en_female_ht_f08_wonderful_world', 'Melodrama', 'en-US', 'Canto'],
  ['en_male_m2_xhxs_m03_silly', 'Quirky Time', 'en-US', 'Canto'],
  ['en_male_m03_sunshine_soon', 'Toon Beat', 'en-US', 'Canto'],
  ['en_female_f08_warmy_breeze', 'Open Mic', 'en-US', 'Canto'],
  ['en_male_m03_lobby', 'Jingle', 'en-US', 'Canto'],
  ['en_male_sing_funny_thanksgiving', 'Thanksgiving', 'en-US', 'Canto'],
  ['en_female_f08_salut_damour', 'Cottagecore', 'en-US', 'Canto'],
  ['fr_001', 'Francés 1', 'fr-FR', 'Idiomas'],
  ['fr_002', 'Francés 2', 'fr-FR', 'Idiomas'],
  ['de_001', 'Alemán femenina', 'de-DE', 'Idiomas'],
  ['de_002', 'Alemán masculina', 'de-DE', 'Idiomas'],
  ['br_001', 'Portugués BR 1', 'pt-BR', 'Idiomas'],
  ['br_003', 'Portugués BR 2', 'pt-BR', 'Idiomas'],
  ['br_004', 'Portugués BR 3', 'pt-BR', 'Idiomas'],
  ['br_005', 'Portugués BR masculino', 'pt-BR', 'Idiomas'],
  ['bp_female_ivete', 'Ivete', 'pt-BR', 'Idiomas'],
  ['bp_female_ludmilla', 'Ludmilla', 'pt-BR', 'Idiomas'],
  ['pt_female_lhays', 'Lhays', 'pt-BR', 'Idiomas'],
  ['pt_female_laizza', 'Laizza', 'pt-BR', 'Idiomas'],
  ['pt_male_bueno', 'Galvão', 'pt-BR', 'Idiomas'],
  ['id_001', 'Indonesio', 'id-ID', 'Idiomas'],
  ['BV074_streaming', 'Vietnamita femenina', 'vi-VN', 'Idiomas'],
  ['BV075_streaming', 'Vietnamita masculina', 'vi-VN', 'Idiomas']
];

const TIKTOK_VOICES = RAW_TIKTOK_VOICES.map(([id, name, locale, category]) => ({ id, name, locale, category }));
const TIKTOK_VOICE_IDS = new Set(TIKTOK_VOICES.map((voice) => voice.id));

function isTikTokVoiceId(value) {
  return TIKTOK_VOICE_IDS.has(String(value || ''));
}

function getTikTokVoice(value) {
  const id = String(value || '');
  return TIKTOK_VOICES.find((voice) => voice.id === id) || null;
}

module.exports = { TIKTOK_VOICES, TIKTOK_VOICE_IDS, getTikTokVoice, isTikTokVoiceId };
