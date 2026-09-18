import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "blog-db.json");

const initialStore = {
  posts: [],
  translations: [],
  jobs: []
};

export function ensureDataStore() {
  fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(initialStore, null, 2));
  }
}

export function readStore() {
  ensureDataStore();

  const content = fs.readFileSync(dbPath, "utf8");
  return JSON.parse(content);
}

export function writeStore(store) {
  ensureDataStore();
  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2));
}

export function newId() {
  return crypto.randomUUID();
}

export function contentHash(post) {
  return crypto
    .createHash("sha256")
    .update([post.title, post.summary, post.body, post.sourceLocale].join("\n"))
    .digest("hex");
}

export function nowIso() {
  return new Date().toISOString();
}

export function slugify(value) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `post-${Date.now()}`;
}

export function uniqueSlug(store, title, postIdToIgnore = null) {
  const base = slugify(title);
  let slug = base;
  let suffix = 2;

  while (
    store.posts.some((post) => post.slug === slug && post.id !== postIdToIgnore)
  ) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export function markTranslationsStale(store, post) {
  const hash = contentHash(post);

  for (const translation of store.translations) {
    if (translation.postId === post.id && translation.sourceHash !== hash) {
      translation.translationStatus = "stale";
    }
  }
}
