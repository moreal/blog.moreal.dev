import { NIGHT_INIT } from "../lib/night";
import { PROJECT_SECTIONS } from "../lib/projects";
import { NAV, SITE } from "../lib/site";
import AuthorMeta from "./AuthorMeta";

export default function ProjectsPage() {
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script innerHTML={NIGHT_INIT} />
        <title>{`작업 — ${SITE.title}`}</title>
        <link rel="shortcut icon" href="/static/logo.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/static/style.css" />
        <meta name="description" content="만들고 고친 것들. 지금 집중하는 것과 분야별로 모은 것들." />
        <AuthorMeta />
      </head>
      <body class="list projects">
        <header>
          <h1>{SITE.title}</h1>
          <nav class="tab-nav">
            {NAV.map((link) =>
              link.id === "projects"
                ? (
                  <span class="tab-current" aria-current="page">
                    {link.label}
                  </span>
                )
                : <a href={link.href}>{link.label}</a>
            )}
          </nav>
        </header>
        <main>
          <p class="lede">
            만들고 고친 것들입니다. <a href="https://github.com/moreal">GitHub</a>에 더 있습니다.
          </p>
          {PROJECT_SECTIONS.map((section) => (
            <section class="project-section">
              <h2>{section.title}</h2>
              <ul>
                {section.projects.map((project) => (
                  <li>
                    <a href={project.href}>{project.name}</a>
                    <p>{project.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </main>
        <footer>
          <p>&copy; 2025 moreal</p>
        </footer>
      </body>
    </html>
  );
}
