import assert from "node:assert/strict";
import test from "node:test";
import type { ImageNameContext } from "../config.ts";
import { imageNameContext, suggestImageName } from "./image-name.ts";

const context: ImageNameContext = {
  year: "2026",
  month: "08",
  day: "07",
  slug: "a-post",
  lang: "ko-Hang",
  postPath: "2026/08/a-post",
  originalName: null,
  ext: ".png",
  existing: [],
};

function suggest(overrides: Partial<ImageNameContext>, pattern = "{slug}-{index}"): string {
  return suggestImageName({ ...context, ...overrides }, { imageNamePattern: pattern });
}

function withMachineTimeZone(timeZone: string, body: () => void): void {
  const machineTimeZone = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    body();
  } finally {
    if (machineTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = machineTimeZone;
  }
}

test("a dragged-in file keeps its descriptive name as a slug without the extension, the convention existing images follow", () => {
  assert.equal(suggest({ originalName: "container-insight-network-rx.png" }), "container-insight-network-rx");
  assert.equal(suggest({ originalName: "  Container Insight — Network RX .PNG" }), "container-insight-network-rx");
  assert.equal(suggest({ originalName: "Café Menu.jpg" }), "cafe-menu");
  assert.equal(suggest({ originalName: "diagram" }), "diagram");
});

test("descriptive names are cut to 60 characters", () => {
  assert.equal(suggest({ originalName: `${"a".repeat(70)}.png` }), "a".repeat(60));
});

test("a clipboard screenshot, which macOS names image.png, falls back to the pattern", () => {
  for (const originalName of ["image.png", "Screen Shot.png", "스크린샷.png", "Untitled.gif", "photo.jpeg", null, ""]) {
    assert.equal(suggest({ originalName }), "a-post-1", String(originalName));
  }
});

test("camera, screenshot and date-only names fall back to the pattern", () => {
  for (const originalName of [
    "Screenshot 2026-08-07 at 23.05.11.png",
    "스크린샷 2026-08-07 오후 11.05.11.png",
    "IMG_1234.JPG",
    "DSC-0001.jpg",
    "PXL 20260807.jpg",
    "2026-08-07.png",
    "20260807 230511.png",
  ]) {
    assert.equal(suggest({ originalName }), "a-post-1", originalName);
  }
});

test("a name with nothing left after slugifying, such as one written in Hangul, falls back to the pattern", () => {
  assert.equal(suggest({ originalName: "배포 흐름.png" }), "a-post-1");
  assert.equal(suggest({ originalName: "!!!.png" }), "a-post-1");
});

test("{original} is the original file name's own slug, and only a name that says nothing keeps image", () => {
  assert.equal(suggest({ originalName: "IMG_1234.JPG" }, "{original}-{index}"), "img-1234-1");
  assert.equal(suggest({ originalName: "2026-08-07.png" }, "{original}-{index}"), "2026-08-07-1");
  assert.equal(
    suggest({ originalName: "Screenshot 2026-08-07 at 23.05.11.png" }, "{original}"),
    "screenshot-2026-08-07-at-23-05-11",
  );
  for (const originalName of ["image.png", "Untitled.gif", "스크린샷.png", "배포 흐름.png", "!!!.png", null, ""]) {
    assert.equal(suggest({ originalName }, "{original}-{index}"), "image-1", String(originalName));
  }
});

test("{index} counts past names already in the asset directory, ignoring their extension and case", () => {
  assert.equal(suggest({ existing: ["a-post-1.png", "A-POST-2.JPG"] }), "a-post-3");
  assert.equal(suggest({ existing: ["a-post-2.png"] }), "a-post-1");
});

test("a descriptive name already in the directory gets the first free numeric suffix", () => {
  assert.equal(suggest({ originalName: "diagram.png", existing: ["diagram.png"] }), "diagram-2");
  assert.equal(suggest({ originalName: "diagram.png", existing: ["Diagram.jpg", "diagram-2.png"] }), "diagram-3");
});

test("a pattern without {index} that is taken gets a numeric suffix instead", () => {
  assert.equal(suggest({ existing: ["a-post.png"] }, "{slug}"), "a-post-2");
});

test("the search for a free {index} carries on past the limit it starts with, rather than suffixing a free name", () => {
  const existing = Array.from({ length: 999 }, (_, index) => `a-post-${index + 1}.png`);
  assert.equal(suggest({ existing }), "a-post-1000");
  assert.equal(suggest({ existing: [...existing, "a-post-1000.png"] }), "a-post-1001");
});

test("pattern tokens take their values from the post, and unknown tokens are left for the slug to flatten", () => {
  assert.equal(
    suggest({ originalName: "image.png" }, "{year}-{month}-{day}-{lang}-{original}-{nope}"),
    "2026-08-07-ko-hang-image-nope",
  );
  assert.match(suggest({}, "shot-{hhmmss}"), /^shot-\d{6}$/);
});

test("a configured override wins, is slugified, and is ignored when it returns an empty name", () => {
  const override = (name: string) => ({
    imageNamePattern: "{slug}-{index}",
    suggestImageName: () => name,
  });
  assert.equal(suggestImageName({ ...context, existing: ["my-name.png"] }, override("My Name!")), "my-name");
  assert.equal(suggestImageName({ ...context, originalName: "diagram.png" }, override("")), "diagram");
});

const post = { year: "2026", month: "08", slug: "a-post", lang: "ko-Hang", postPath: "2026/08/a-post" } as const;

test("the naming context takes the post's location and the incoming image as they are", () => {
  const image = { originalName: "diagram.png", ext: ".png", existing: ["a-post-1.png"] };
  assert.deepEqual(imageNameContext(post, image, new Date("2026-08-07T12:00:00Z")), {
    year: "2026",
    month: "08",
    day: "07",
    slug: "a-post",
    lang: "ko-Hang",
    postPath: "2026/08/a-post",
    originalName: "diagram.png",
    ext: ".png",
    existing: ["a-post-1.png"],
  });
});

test("{day} is today's day of the month in Korea, where the posts are dated", () => {
  const image = { originalName: null, ext: ".png", existing: [] };
  const earlyMorningInKorea = new Date("2026-08-08T08:30:00+09:00");
  assert.equal(imageNameContext(post, image, earlyMorningInKorea).day, "08");
  assert.equal(imageNameContext(post, image, new Date("2026-08-07T23:59:59+09:00")).day, "07");
});

test("{hhmmss} reads the same Seoul wall clock as {day}, whatever time zone the machine keeps", () => {
  const image = { originalName: null, ext: ".png", existing: [] };
  const earlyMorningInKorea = new Date("2026-08-08T08:30:05+09:00");
  const ctx = imageNameContext(post, image, earlyMorningInKorea);
  for (const machineTimeZone of ["UTC", "America/New_York", "Asia/Seoul"]) {
    withMachineTimeZone(machineTimeZone, () => {
      assert.equal(
        suggestImageName(ctx, { imageNamePattern: "{day}-{hhmmss}" }, earlyMorningInKorea),
        "08-083005",
        machineTimeZone,
      );
    });
  }
});
