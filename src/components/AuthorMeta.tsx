import { SITE } from "../lib/site";

export default function AuthorMeta() {
  return (
    <>
      <meta name="author" content={SITE.author} />
      <meta name="fediverse:creator" content={SITE.fediverseCreator} />
      {SITE.relMe.map((url) => <link rel="me" href={url} />)}
    </>
  );
}
