import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const contentDir = path.join(process.cwd(), "content", "posts");
const translatedDir = path.join(process.cwd(), "data", "translated-static");

function parseFrontmatter(fileContent) {
  if (!fileContent.startsWith("---")) {
    return { attributes: {}, body: fileContent };
  }

  const end = fileContent.indexOf("\n---", 3);

  if (end === -1) {
    return { attributes: {}, body: fileContent };
  }

  const raw = fileContent.slice(3, end).trim();
  const body = fileContent.slice(end + 4).trimStart();
  const attributes = {};

  for (const line of raw.split(/\r?\n/)) {
    const index = line.indexOf(":");

    if (index === -1) {
      continue;
    }

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    attributes[key] = value;
  }

  return { attributes, body };
}

function toFrontmatter(attributes, body) {
  const lines = Object.entries(attributes).map(([key, value]) => {
    const escaped = String(value).replace(/"/g, '\\"');
    return `${key}: "${escaped}"`;
  });

  return `---\n${lines.join("\n")}\n---\n\n${body.trim()}\n`;
}

function hashText(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function ensureContentDirs() {
  fs.mkdirSync(contentDir, { recursive: true });
  fs.mkdirSync(translatedDir, { recursive: true });
}

export function listStaticPosts() {
  ensureContentDirs();

  const files = fs
    .readdirSync(contentDir)
    .filter((fileName) => fileName.endsWith(".md"));

  return files.map((fileName) => {
    const filePath = path.join(contentDir, fileName);
    const content = fs.readFileSync(filePath, "utf8");
    const { attributes, body } = parseFrontmatter(content);
    const slug = fileName.replace(/\.md$/, "").replace(/\.pt-BR$/, "");
    const sourceLocale = attributes.locale || "pt-BR";

    return {
      id: slug,
      slug,
      fileName,
      sourceLocale,
      title: attributes.title || slug,
      summary: attributes.summary || "",
      body,
      sourceHash: hashText(content)
    };
  });
}

export function getStaticPost(slug) {
  return listStaticPosts().find((post) => post.slug === slug) || null;
}

export function getStaticTranslation(slug, locale) {
  ensureContentDirs();

  const filePath = path.join(translatedDir, `${slug}.${locale}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const { attributes, body } = parseFrontmatter(content);

  return {
    slug,
    locale,
    title: attributes.title || slug,
    summary: attributes.summary || "",
    body,
    provider: attributes.provider || "unknown",
    translatedAt: attributes.translatedAt || null,
    sourceHash: attributes.sourceHash || null
  };
}

export function saveStaticTranslation(sourcePost, locale, translated, provider) {
  ensureContentDirs();

  const filePath = path.join(translatedDir, `${sourcePost.slug}.${locale}.md`);
  const content = toFrontmatter(
    {
      title: translated.title,
      summary: translated.summary,
      locale,
      sourceLocale: sourcePost.sourceLocale,
      sourceHash: sourcePost.sourceHash,
      provider,
      translatedAt: new Date().toISOString()
    },
    translated.body
  );

  fs.writeFileSync(filePath, content);

  return getStaticTranslation(sourcePost.slug, locale);
}
