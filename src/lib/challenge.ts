export interface ChallengeQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer?: string;
}

export const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}.${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

export const getCountryFlag = (country: string) => {
  const flags: Record<string, string> = {
    Nigeria: "🇳🇬",
    "United States": "🇺🇸",
    "United Kingdom": "🇬🇧",
    India: "🇮🇳",
    Ghana: "🇬🇭",
    Kenya: "🇰🇪",
    "South Africa": "🇿🇦",
    Canada: "🇨🇦",
    Germany: "🇩🇪",
    France: "🇫🇷",
    Brazil: "🇧🇷",
    Japan: "🇯🇵",
    China: "🇨🇳",
    Australia: "🇦🇺",
    Egypt: "🇪🇬",
    Tanzania: "🇹🇿",
    Global: "🌍",
  };

  return flags[country] || "🏳️";
};

const nextSeed = (seed: number) => (seed * 1664525 + 1013904223) >>> 0;

const seedFromString = (value: string) => {
  let seed = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    seed ^= value.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
};

export const pickChallengeQuestions = <T>(items: T[], seedSource: string, count = 10) => {
  const shuffled = [...items];
  let seed = seedFromString(seedSource);

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    seed = nextSeed(seed);
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
};