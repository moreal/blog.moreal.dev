export interface Project {
  name: string;
  description: string;
  href: string;
}

export interface ProjectSection {
  id: "focus" | "activitypub" | "interpreter" | "translation" | "misc";
  title: string;
  projects: readonly Project[];
}

export const PROJECT_SECTIONS: readonly ProjectSection[] = [
  {
    id: "focus",
    title: "지금 집중하는 것",
    projects: [
      {
        name: "finds.team",
        description: "Flex, Greeting, Ninehire의 채용 공고를 한곳에서 찾을 수 있습니다.",
        href: "https://github.com/moreal/finds.team",
      },
      {
        name: "jandibat.org",
        description: "GitHub뿐 아니라 여러 곳의 활동 기록을 모아 잔디밭으로 보여 줍니다.",
        href: "https://github.com/moreal/jandibat.org",
      },
      {
        name: "역자(譯者)",
        description: "영어로 된 공개 문서를 번역해서, 원문에서 바로 빌드할 수 있게 합니다.",
        href: "https://yeokja.moreal.dev/",
      },
      {
        name: "rss2.pub",
        description: "RSS나 Atom 피드를 ActivityPub으로 바꿔 페디버스에서 구독할 수 있게 합니다.",
        href: "https://beta.rss2.pub/",
      },
      {
        name: "RustPython",
        description: "Rust로 만든 Python 인터프리터입니다. 주로 기여하고 리뷰합니다.",
        href: "https://github.com/RustPython/RustPython",
      },
    ],
  },
  {
    id: "activitypub",
    title: "ActivityPub",
    projects: [
      {
        name: "rss2.pub",
        description: "RSS나 Atom 피드를 ActivityPub으로 바꿔 페디버스에서 구독할 수 있게 합니다.",
        href: "https://beta.rss2.pub/",
      },
      {
        name: "kimino",
        description: "ActivityPub C2S를 쓰는 클라이언트입니다. 타임라인을 읽고 글을 씁니다.",
        href: "https://github.com/moreal/kimino",
      },
      {
        name: "ap-thread-reader",
        description: "페디버스에서 자기 답글로 이어진 스레드를 한 편의 글처럼 모아 보여 줍니다.",
        href: "https://ap-thread-reader.fly.dev/",
      },
    ],
  },
  {
    id: "interpreter",
    title: "Interpreter / Compiler",
    projects: [
      {
        name: "RustPython",
        description: "Rust로 만든 Python 인터프리터입니다. 주로 기여하고 리뷰합니다.",
        href: "https://github.com/RustPython/RustPython",
      },
      {
        name: "rxui",
        description: "프론트엔드를 Lean으로 작성하면 JavaScript로 컴파일해 줍니다.",
        href: "https://github.com/moreal/rxui",
      },
    ],
  },
  {
    id: "translation",
    title: "번역",
    projects: [
      {
        name: "역자(譯者)",
        description: "영어로 된 공개 문서를 번역해서, 원문에서 바로 빌드할 수 있게 합니다.",
        href: "https://yeokja.moreal.dev/",
      },
      {
        name: "clig.kr",
        description: "clig.dev를 한국어로 번역한 사이트입니다.",
        href: "https://clig.kr/",
      },
    ],
  },
  {
    id: "misc",
    title: "그 외",
    projects: [
      {
        name: "gif2webp.com",
        description: "브라우저 안에서 GIF를 WebP로 바꿔 주는 웹앱입니다. 파일이 서버로 나가지 않습니다.",
        href: "https://gif2webp.com/",
      },
      {
        name: "애자일 이야기",
        description: "agile.egloos.com을 비공식적으로 되살린 사이트입니다.",
        href: "https://agilestory.blog/",
      },
      {
        name: "gitify-native",
        description: "GitHub 알림 앱인 Gitify를 macOS 네이티브로 포팅했습니다.",
        href: "https://github.com/moreal/gitify-native",
      },
      {
        name: "한국어 워들 솔버",
        description: "카카오톡 단어 맞추기 게임의 힌트를 주는 도구입니다. 핵심 로직은 Lean으로 작성했습니다.",
        href: "https://moreal.github.io/lean-korean-wordle-solver/",
      },
      {
        name: "bencodex-rs",
        description: "Bencodex 포맷을 Rust로 구현했습니다.",
        href: "https://github.com/moreal/bencodex-rs",
      },
      {
        name: "pystructs",
        description: "Django의 스타일을 빌려, 바이너리를 파싱하는 Python 라이브러리입니다.",
        href: "https://github.com/moreal/pystructs",
      },
      {
        name: "seonbi-rs",
        description: "한글 맞춤법 검사기 선비를 Rust로 다시 구현했습니다.",
        href: "https://github.com/moreal/seonbi-rs",
      },
    ],
  },
];