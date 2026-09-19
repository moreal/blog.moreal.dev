import { PANES, VERDICTS, verdictKey, type LogEntry, type Pane } from "./imeLabModel.ts";

const SEQUENCE_LENGTH = 30;

type Verdicts = Readonly<Record<string, boolean>>;

function verdictTable(verdicts: Verdicts): string[] {
  const rows = PANES.map((pane) => {
    const marks = VERDICTS.map((_, index) => (verdicts[verdictKey(pane.id, index)] ? "✅" : "❌"));
    return `| ${pane.title} | ${marks.join(" | ")} |`;
  });
  return [
    "| 패널 | " + VERDICTS.join(" | ") + " |",
    "|---|" + VERDICTS.map(() => "---").join("|") + "|",
    ...rows,
  ];
}

function entriesOf(log: readonly LogEntry[], pane: Pane): LogEntry[] {
  return log.filter((entry) => entry.pane === pane.id);
}

function observedInputTypes(log: readonly LogEntry[]): string[] {
  return PANES.map((pane) => {
    const inputTypes = new Set<string>();
    for (const entry of entriesOf(log, pane)) {
      const inputType = entry.detail["inputType"];
      if (typeof inputType === "string") inputTypes.add(inputType);
    }
    return `- **${pane.title}**: ${[...inputTypes].join(", ") || "(없음)"}`;
  });
}

function isAltKeydown(entry: LogEntry): boolean {
  return entry.type === "keydown" && entry.detail["altKey"] === true;
}

function sequenceSinceLastAltKey(paneEntries: LogEntry[]): string[] {
  const start = paneEntries.findLastIndex(isAltKeydown);
  if (start < 0) return ["```", "(⌥⏎ 관측 안 됨)", "```", ""];
  return [
    "~~~~",
    ...paneEntries
      .slice(start, start + SEQUENCE_LENGTH)
      .map((entry) => `${entry.type} ${JSON.stringify(entry.detail)}`),
    "~~~~",
    `최종 값: \`${paneEntries.at(-1)?.value ?? ""}\``,
    "",
  ];
}

function sequencesSinceLastAltKey(log: readonly LogEntry[]): string[] {
  return PANES.flatMap((pane) => [
    `**${pane.title}**`,
    "",
    ...sequenceSinceLastAltKey(entriesOf(log, pane)),
  ]);
}

export function formatImeReport(
  log: readonly LogEntry[],
  verdicts: Verdicts,
  userAgent: string,
): string {
  return [
    "## IME 한자 변환(⌥⏎) 검증 결과",
    "",
    `- 브라우저: ${userAgent}`,
    `- 이벤트 수: ${log.length}`,
    "",
    ...verdictTable(verdicts),
    "",
    "### 패널별 관측된 inputType",
    "",
    ...observedInputTypes(log),
    "",
    "### 마지막 ⌥⏎ 이후 이벤트 시퀀스",
    "",
    ...sequencesSinceLastAltKey(log),
  ].join("\n");
}
