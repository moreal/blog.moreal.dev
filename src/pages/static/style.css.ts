import * as sass from "sass";
import source from "../../styles/style.scss?raw";

export function GET() {
  const result = sass.compileString(source, { style: "expanded" });
  return new Response(result.css, {
    headers: { "Content-Type": "text/css; charset=utf-8" },
  });
}
