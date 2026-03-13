import { htmlRedirector, intoMultiView } from "jikji/multiview";
import {
  footnote,
  frontMatter,
  markdown,
  MarkdownIt,
  title,
} from "jikji/markdown";
import { renderListTemplate, renderTemplate } from "jikji/ejs";
import { sass } from "jikji/sass";
import { detectLanguage } from "jikji/path";
import {
  anyRepresentations,
  ContentKey,
  havingExtension,
  intoDirectory,
  LanguageTag,
  Pipeline,
  rebase,
  replaceBasename,
  Resource,
  scanFiles,
  setupConsoleLog,
  when,
} from "jikji";
import * as YAML from "@std/yaml";
import { writeFiles } from "jikji/file";

import { type Configuration, HanjaRenderingOption, transform } from "seonbi";

import { parseArgs } from "@std/cli/parse-args";
import { serveDir } from "@std/http/file-server";
import { info } from "@std/log";
import { join } from "@std/path";

// Makes logs show up in the console:
await setupConsoleLog();

function createSeonbiConfiguration(
  hanjaRendering: HanjaRenderingOption,
): Configuration {
  return {
    contentType: "text/markdown",
    quote: "CurvedQuotes",
    cite: "AngleQuotes",
    arrow: {
      bidirArrow: true,
      doubleArrow: true,
    },
    ellipsis: true,
    emDash: true,
    stop: "Horizontal",
    hanja: {
      rendering: hanjaRendering,
      reading: {
        initialSoundLaw: true,
        useDictionaries: ["kr-stdict"],
      },
    },
  } as const;
}

function transformKoKore(markdown: string) {
  return transform(createSeonbiConfiguration("HanjaInRuby"), markdown);
}

function transformKoHangulOnly(markdown: string) {
  return transform(createSeonbiConfiguration("HangulOnly"), markdown);
}

// Takes CLI arguments & options:
const args = parseArgs(Deno.args, {
  boolean: ["help", "remove", "watch", "serve", "php"],
  string: ["out-dir", "base-url", "host", "port"],
  default: {
    help: false,
    "out-dir": "public_html",
    "base-url": null,
    remove: false,
    watch: false,
    serve: false,
    host: "127.0.0.1",
    port: "8080",
  },
  alias: {
    h: "help",
    o: "out-dir",
    u: "base-url",
    r: "remove",
    w: "watch",
    s: "serve",
    server: "serve",
    p: "port",
    H: "host",
  },
  unknown: (opt: string) => {
    console.error(`Unknown option: ${opt}.`);
    Deno.exit(1);
  },
});

// If -h/--help is requested, print it and exit:
if (args.help) {
  console.log("Usage: main.ts [options] [SRC=.]");
  console.log("\nOptions:");
  console.log("  -h, --help:     Show this help message and exit.");
  console.log("  -o, --out-dir:  Output directory.  [public_html]");
  console.log("  -u, --base-url: Base URL.  [http://127.0.0.1:8080/]");
  console.log("  -r, --remove:   Empty the output directory first.");
  console.log("  -s, --serve:    Run an HTTP server.");
  console.log(
    "  -H, --host:     " + "Hostname to listen HTTP requests.  [127.0.0.1]",
  );
  console.log("  -p, --port:     Port number to listen HTTP requests.  [8080]");
  console.log(
    "      --php:      " +
      "Build PHP files for server-side content negotiation.",
  );
  console.log("  -w, --watch:    Watch the SRC directory for changes.");
  Deno.exit(0);
}

if (!args.port.match(/^\d+$/) || parseInt(args.port) > 65535) {
  console.error("Error: -p/--port: Invalid port number.");
  Deno.exit(1);
}

if (args.php && args.serve) {
  console.error("Error: --php and -s/--serve options are mutually exclusive.");
  console.error("       Try php's built-in web server instead (`php -S`).");
  Deno.exit(1);
}

// The path of the input directory:
const srcDir: string = args._.length > 0 ? args._[0].toString() : ".";

// The path of the output directory:
const outDir: string = args["out-dir"];

// The base URL for permalinks:
const baseUrl: URL = new URL(
  args["base-url"] ?? `http://${args.host}:${args.port}/`,
);

const site = YAML.parse(
  await Deno.readTextFile(join(srcDir, "site.yaml")),
) as Record<string, unknown>;

const pipeline = scanFiles(["2*/**/*", "static/**/*"], { root: srcDir })
  .move(rebase("./", baseUrl))
  .map(detectLanguage({ from: "pathname", strip: true }))
  .move(when(havingExtension("md"), intoDirectory()))
  .transform(sass(), { type: "text/x-scss" })
  .move(replaceBasename(/\.s[ac]ss/, ".css"))
  .transform(frontMatter, { type: "text/markdown" })
  .diversify(
    (xs) =>
      xs.replace({
        async body() {
          const body = await xs.getBody();
          const decoder = new TextDecoder();
          const text = typeof body === "string" ? body : decoder.decode(body);
          return transformKoHangulOnly(text);
        },
        language: "ko-Hang",
      }),
    { type: "text/markdown", language: "ko-Kore" },
  )
  .transform(
    (xs) =>
      xs.replace({
        async body() {
          const body = await xs.getBody();
          const decoder = new TextDecoder();
          const text = typeof body === "string" ? body : decoder.decode(body);
          return transformKoKore(text);
        },
      }),
    { type: "text/markdown", language: "ko-Kore" },
  )
  .transform(markdown(getMarkdownIt()), { type: "text/markdown" })
  .divide(
    intoMultiView({
      negotiator: htmlRedirector,
      defaultContentKey: ContentKey.get("text/markdown", "ko"),
    }),
    (r: Resource) => r.path.href.endsWith("/") && r.size > 1,
  )
  .transform(renderTemplate("templates/post.ejs", { baseUrl, site }), {
    negate: true,
    language: null,
  })
  .transform(renderTemplate("templates/list.ejs", { site }), {
    exactType: "text/html; list=1",
  })
  .addSummaries(async function* (p: Pipeline) {
    const posts = p.filter(
      anyRepresentations({
        type: ["text/html"],
        language: LanguageTag.get("ko", "Hang"),
      }),
    );
    yield new Resource(baseUrl, [
      await renderListTemplate("templates/list.ejs", posts, { baseUrl, site }),
    ]);
  });

function getMarkdownIt() {
  return MarkdownIt("commonmark", { html: true, xhtmlOut: false })
    .use(title)
    .use(footnote)
    .enable("strikethrough");
}

if (args.remove) {
  // Empty the output directory (public_html/) first:
  try {
    await Deno.remove(outDir, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      throw e;
    }
  }
}

// Generates the static site files:
async function build(): Promise<void> {
  if (args.watch) {
    // Writes the files to the output directory (public_html/) and watches
    // the input files for changes (^C to stop):
    info(`Watching ${outDir} for changes...`);
    await pipeline.forEachWithReloading(writeFiles(outDir, baseUrl));
  } else {
    // Writes the files to the output directory (public_html/):
    await pipeline.forEach(writeFiles(outDir, baseUrl));
  }
}

// Runs an HTTP server:
async function runServer(): Promise<void> {
  const server = Deno.serve(
    {
      port: parseInt(args.port),
      hostname: args.host,
      onListen({ port, hostname }) {
        info(`Listening on http://${hostname}:${port}/`);
      },
    },
    (req: Request) => serveDir(req, { fsRoot: outDir, showDirListing: true }),
  );
  await server.finished;
}

await Promise.all(args.serve ? [build(), runServer()] : [build()]);
