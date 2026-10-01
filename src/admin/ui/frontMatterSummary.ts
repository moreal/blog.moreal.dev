import type { FrontMatterForm } from "../lib/types.ts";
import { datetimeLocalValue } from "../shared/dates.ts";
import { POST_KIND_LABELS } from "./postKinds.ts";

export function frontMatterSummary(form: FrontMatterForm): string[] {
  const published = datetimeLocalValue(form.published).replace("T", " ");
  return [
    published === "" ? "발행일 없음" : `${published} 발행`,
    POST_KIND_LABELS[form.type ?? "regular"],
    ...(form.draft === true ? ["초안"] : []),
    ...(form.dark === true ? ["불 끔"] : []),
    ...(form.book?.title ? [`『${form.book.title}』`] : []),
  ];
}
