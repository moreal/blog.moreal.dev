export const SITE = {
  title: "잡다한 블로그",
  description: "개발과 기술에 대한 블로그",
  author: "Moreal (Lee Dogeon)",
  fediverseCreator: "moreal@hackers.pub",
  relMe: ["https://social.silicon.moe/@moreal", "https://hackers.pub/@moreal"],
} as const;

export const NAV = [
  { id: "all", href: "/", label: "전체" },
  { id: "daily", href: "/daily/", label: "일상" },
  { id: "reading", href: "/reading/", label: "독후감" },
  { id: "projects", href: "/projects/", label: "작업" },
] as const;

const LANG_LABELS: Record<string, string> = {
  "ko-Hang": "한국어",
  "ko-Kore": "國漢文",
  en: "English",
};

export function languageLabel(lang: string): string {
  return LANG_LABELS[lang] ?? lang;
}
