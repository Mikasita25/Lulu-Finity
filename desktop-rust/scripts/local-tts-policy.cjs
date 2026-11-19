'use strict';

const MAX_SEGMENT = 72;

function voiceSegments(text) {
  const characters = [...text.trim()];
  const segments = [];
  while (characters.length > MAX_SEGMENT) {
    const prefix = characters.slice(0, MAX_SEGMENT);
    const sentenceBreak = prefix.findLastIndex(character => /[.!?,;:。！？、]/u.test(character)) + 1;
    const wordBreak = prefix.findLastIndex(character => /\s/u.test(character)) + 1;
    const split = sentenceBreak >= MAX_SEGMENT / 2 ? sentenceBreak : wordBreak || MAX_SEGMENT;
    const segment = characters.splice(0, split).join('').trim();
    if (segment) segments.push(segment);
  }
  const last = characters.join('').trim();
  if (last) segments.push(last);
  return segments;
}

module.exports = { voiceSegments };
