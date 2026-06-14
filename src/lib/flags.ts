// Converts ISO-3166 alpha-2 country codes into flag emoji.
// A few "home nations" don't have alpha-2 codes, so we hardcode their
// official flag emoji sequences.
const SPECIAL_FLAGS: Record<string, string> = {
  "GB-ENG": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", // England
  "GB-SCT": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}", // Scotland
  "GB-WLS": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}", // Wales
};

export function flagEmoji(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (SPECIAL_FLAGS[code]) return SPECIAL_FLAGS[code];
  if (code.length !== 2) return "\u{1F3F3}\u{FE0F}"; // white flag fallback
  const codePoints = code
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
