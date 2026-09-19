export type PaneId = "textarea" | "contenteditable" | "plaintext-only" | "codemirror";

export interface Pane {
  id: PaneId;
  title: string;
  note: string;
}

export const PANES: Pane[] = [
  {
    id: "textarea",
    title: "textarea",
    note: "보장된 기준선 · 폴백 엔진",
  },
  {
    id: "contenteditable",
    title: "contenteditable",
    note: "CM6이 올라선 바닥",
  },
  {
    id: "plaintext-only",
    title: 'contenteditable="plaintext-only"',
    note: "macOS에서 다르게 동작",
  },
  {
    id: "codemirror",
    title: "CodeMirror 6",
    note: "실제 설정 그대로 · autocomplete 없음",
  },
];

export const SEED = "한자 대한민국 국한문";

export const VERDICTS = ["후보창 뜸", "후보 선택됨", "텍스트 치환됨", "Esc로 복구"];

export function verdictKey(pane: PaneId, verdictIndex: number): string {
  return `${pane}:${verdictIndex}`;
}

export const EVENT_TYPES = [
  "keydown",
  "keyup",
  "beforeinput",
  "input",
  "compositionstart",
  "compositionupdate",
  "compositionend",
  "cm-update",
] as const;

export interface LogEntry {
  seq: number;
  t: number;
  pane: PaneId;
  source: "capture" | "cm-handler" | "cm-update";
  type: string;
  detail: Record<string, unknown>;
  value: string;
}

