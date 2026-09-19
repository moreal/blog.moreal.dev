import { PANES, VERDICTS, type LogEntry } from "./imeLabModel.ts";

export function formatImeReport(
  log: readonly LogEntry[],
  verdicts: Readonly<Record<string, boolean>>,
  userAgent: string,
): string {
  const lines: string[] = [
    "## IME 한자 변환(⌥⏎) 검증 결과",
    "",
    `- 브라우저: ${userAgent}`,
    `- 이벤트 수: ${log.length}`,
    "",
    "| 패널 | " + VERDICTS.join(" | ") + " |",
    "|---|" + VERDICTS.map(() => "---").join("|") + "|",
  ];
  for (const pane of PANES) {
    const marks = VERDICTS.map((_, i) =>
      verdicts[`${pane.id}:${i}`] ? "✅" : "❌"
    );
    lines.push(`| ${pane.title} | ${marks.join(" | ")} |`);
  }

  lines.push("", "### 패널별 관측된 inputType", "");
  for (const pane of PANES) {
    const inputTypes = new Set<string>();
    for (const entry of log) {
      if (entry.pane !== pane.id) continue;
      const inputType = entry.detail["inputType"];
      if (typeof inputType === "string") inputTypes.add(inputType);
    }
    lines.push(`- **${pane.title}**: ${[...inputTypes].join(", ") || "(없음)"}`);
  }

  lines.push("", "### 마지막 ⌥⏎ 이후 이벤트 시퀀스", "");
  for (const pane of PANES) {
    const paneEntries = log.filter((entry) => entry.pane === pane.id);
    let start = -1;
    for (let i = paneEntries.length - 1; i >= 0; i--) {
      const entry = paneEntries[i]!;
      if (entry.type === "keydown" && entry.detail["altKey"] === true) {
        start = i;
        break;
      }
    }
    lines.push(`**${pane.title}**`, "");
    if (start < 0) {
      lines.push("```", "(⌥⏎ 관측 안 됨)", "```", "");
      continue;
    }
    lines.push("~~~~");
    for (const entry of paneEntries.slice(start, start + 30)) {
      lines.push(`${entry.type} ${JSON.stringify(entry.detail)}`);
    }
    lines.push("~~~~", `최종 값: \`${paneEntries.at(-1)?.value ?? ""}\``, "");
  }
  return lines.join("\n");
}
