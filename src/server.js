import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  contentHash,
  ensureDataStore,
  markTranslationsStale,
  newId,
  nowIso,
  readStore,
  uniqueSlug,
  writeStore
} from "./db.js";
import { getConfig, loadLocalEnv } from "./env.js";
import {
  getStaticPost,
  getStaticTranslation,
  listStaticPosts,
  saveStaticTranslation
} from "./content.js";
import { translatePost } from "./translation.js";

loadLocalEnv();
ensureDataStore();

const config = getConfig();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");

      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON invalido."));
      }
    });
  });
}

function publicConfig() {
  return {
    provider: config.provider,
    azureConfigured: Boolean(config.azure.key),
    defaultLocale: config.defaultLocale,
    targetLocales: config.targetLocales
  };
}

function sanitizePostInput(input) {
  const title = String(input.title || "").trim();
  const summary = String(input.summary || "").trim();
  const body = String(input.body || "").trim();
  const sourceLocale = String(input.sourceLocale || "pt-BR").trim();
  const status = input.status === "published" ? "published" : "draft";

  if (!title) {
    throw new Error("Titulo e obrigatorio.");
  }

  if (!body) {
    throw new Error("Corpo do artigo e obrigatorio.");
  }

  return { title, summary, body, sourceLocale, status };
}

async function upsertPostTranslations(store, post, locales) {
  const results = [];
  const sourceHash = contentHash(post);

  for (const targetLocale of locales) {
    const job = {
      id: newId(),
      type: "crud-post",
      postId: post.id,
      provider: config.provider,
      sourceLocale: post.sourceLocale,
      targetLocale,
      status: "running",
      inputRef: post.slug,
      outputRef: null,
      errorMessage: null,
      characterCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    store.jobs.unshift(job);

    try {
      const translated = await translatePost(config, post, targetLocale);
      const existing = store.translations.find(
        (translation) =>
          translation.postId === post.id && translation.locale === targetLocale
      );
      const now = nowIso();
      const record = {
        id: existing?.id || newId(),
        postId: post.id,
        locale: targetLocale,
        title: translated.title,
        summary: translated.summary,
        body: translated.body,
        provider: translated.provider,
        translationStatus: "translated",
        sourceHash,
        characterCount: translated.characterCount,
        translatedAt: now,
        errorMessage: null
      };

      if (existing) {
        Object.assign(existing, record);
      } else {
        store.translations.unshift(record);
      }

      job.status = "completed";
      job.outputRef = record.id;
      job.characterCount = translated.characterCount;
      job.updatedAt = nowIso();
      results.push(record);
    } catch (error) {
      const existing = store.translations.find(
        (translation) =>
          translation.postId === post.id && translation.locale === targetLocale
      );

      if (existing) {
        existing.translationStatus = "failed";
        existing.errorMessage = error.message;
      }

      job.status = "failed";
      job.errorMessage = error.message;
      job.updatedAt = nowIso();
      results.push({
        postId: post.id,
        locale: targetLocale,
        translationStatus: "failed",
        errorMessage: error.message
      });
    }
  }

  return results;
}

function serializePost(store, post, locale = null) {
  const translations = store.translations.filter(
    (translation) => translation.postId === post.id
  );
  const selected = locale
    ? translations.find(
        (translation) =>
          translation.locale === locale &&
          translation.translationStatus === "translated"
      )
    : null;

  return {
    ...post,
    display: selected
      ? {
          locale,
          title: selected.title,
          summary: selected.summary,
          body: selected.body,
          translated: true,
          translationStatus: selected.translationStatus
        }
      : {
          locale: post.sourceLocale,
          title: post.title,
          summary: post.summary,
          body: post.body,
          translated: false,
          translationStatus: "source"
        },
    translations
  };
}

async function handleApi(request, response, url) {
  const store = readStore();
  const segments = url.pathname.split("/").filter(Boolean);

  if (request.method === "GET" && url.pathname === "/api/config") {
    sendJson(response, 200, publicConfig());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/posts") {
    const locale = url.searchParams.get("locale");
    const includeDrafts = url.searchParams.get("includeDrafts") === "true";
    const posts = store.posts
      .filter((post) => includeDrafts || post.status === "published")
      .map((post) => serializePost(store, post, locale));

    sendJson(response, 200, { posts });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/posts") {
    try {
      const body = await readBody(request);
      const input = sanitizePostInput(body);
      const now = nowIso();
      const post = {
        id: newId(),
        slug: uniqueSlug(store, input.title),
        sourceLocale: input.sourceLocale,
        title: input.title,
        summary: input.summary,
        body: input.body,
        status: input.status,
        createdAt: now,
        updatedAt: now
      };

      store.posts.unshift(post);

      let translations = [];

      if (post.status === "published") {
        const locales = Array.isArray(body.targetLocales)
          ? body.targetLocales
          : config.targetLocales;
        translations = await upsertPostTranslations(store, post, locales);
      }

      writeStore(store);
      sendJson(response, 201, { post: serializePost(store, post), translations });
    } catch (error) {
      sendError(response, 400, error.message);
    }

    return;
  }

  if (segments[0] === "api" && segments[1] === "posts" && segments[2]) {
    const post = store.posts.find((item) => item.id === segments[2]);

    if (!post) {
      sendError(response, 404, "Artigo nao encontrado.");
      return;
    }

    if (request.method === "GET" && segments.length === 3) {
      sendJson(response, 200, { post: serializePost(store, post) });
      return;
    }

    if (request.method === "PUT" && segments.length === 3) {
      try {
        const body = await readBody(request);
        const input = sanitizePostInput({ ...post, ...body });

        Object.assign(post, {
          ...input,
          slug: body.slug ? String(body.slug).trim() : uniqueSlug(store, input.title, post.id),
          updatedAt: nowIso()
        });

        markTranslationsStale(store, post);
        writeStore(store);
        sendJson(response, 200, { post: serializePost(store, post) });
      } catch (error) {
        sendError(response, 400, error.message);
      }

      return;
    }

    if (request.method === "DELETE" && segments.length === 3) {
      const nextStore = {
        ...store,
        posts: store.posts.filter((item) => item.id !== post.id),
        translations: store.translations.filter(
          (translation) => translation.postId !== post.id
        )
      };

      writeStore(nextStore);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (
      request.method === "POST" &&
      segments.length === 4 &&
      segments[3] === "publish"
    ) {
      try {
        const body = await readBody(request);
        const locales = Array.isArray(body.targetLocales)
          ? body.targetLocales
          : config.targetLocales;

        post.status = "published";
        post.updatedAt = nowIso();

        const translations = await upsertPostTranslations(store, post, locales);

        writeStore(store);
        sendJson(response, 200, { post: serializePost(store, post), translations });
      } catch (error) {
        sendError(response, 400, error.message);
      }

      return;
    }

    if (
      request.method === "POST" &&
      segments.length === 4 &&
      segments[3] === "translate"
    ) {
      try {
        const body = await readBody(request);
        const locales = body.targetLocale ? [body.targetLocale] : config.targetLocales;
        const translations = await upsertPostTranslations(store, post, locales);

        writeStore(store);
        sendJson(response, 200, { post: serializePost(store, post), translations });
      } catch (error) {
        sendError(response, 400, error.message);
      }

      return;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/jobs") {
    sendJson(response, 200, { jobs: store.jobs.slice(0, 100) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/static-posts") {
    const locale = url.searchParams.get("locale");
    const posts = listStaticPosts().map((post) => {
      const translation = locale ? getStaticTranslation(post.slug, locale) : null;

      return {
        ...post,
        display:
          translation && translation.sourceHash === post.sourceHash
            ? { ...translation, translated: true }
            : {
                locale: post.sourceLocale,
                title: post.title,
                summary: post.summary,
                body: post.body,
                translated: false
              }
      };
    });

    sendJson(response, 200, { posts });
    return;
  }

  if (
    request.method === "POST" &&
    segments[0] === "api" &&
    segments[1] === "static-posts" &&
    segments[2] &&
    segments[3] === "translate"
  ) {
    try {
      const body = await readBody(request);
      const targetLocale = body.targetLocale || config.targetLocales[0];
      const sourcePost = getStaticPost(segments[2]);

      if (!sourcePost) {
        sendError(response, 404, "Arquivo estatico nao encontrado.");
        return;
      }

      const job = {
        id: newId(),
        type: "static-file",
        postId: null,
        provider: config.provider,
        sourceLocale: sourcePost.sourceLocale,
        targetLocale,
        status: "running",
        inputRef: sourcePost.fileName,
        outputRef: null,
        errorMessage: null,
        characterCount: 0,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };

      store.jobs.unshift(job);

      const translated = await translatePost(config, sourcePost, targetLocale);
      const saved = saveStaticTranslation(
        sourcePost,
        targetLocale,
        translated,
        translated.provider
      );

      job.status = "completed";
      job.provider = translated.provider;
      job.outputRef = `${sourcePost.slug}.${targetLocale}.md`;
      job.characterCount = translated.characterCount;
      job.updatedAt = nowIso();

      writeStore(store);
      sendJson(response, 200, { translation: saved });
    } catch (error) {
      store.jobs.unshift({
        id: newId(),
        type: "static-file",
        postId: null,
        provider: config.provider,
        sourceLocale: config.defaultLocale,
        targetLocale: "unknown",
        status: "failed",
        inputRef: segments[2],
        outputRef: null,
        errorMessage: error.message,
        characterCount: 0,
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
      writeStore(store);
      sendError(response, 400, error.message);
    }

    return;
  }

  sendError(response, 404, "Rota nao encontrada.");
}

function serveStatic(response, requestPath) {
  const safePath =
    requestPath === "/" ? "/index.html" : decodeURIComponent(requestPath);
  const filePath = path.normalize(path.join(publicDir, safePath));
  const relativePath = path.relative(publicDir, filePath);
  const pathSegments = relativePath.split(path.sep);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    pathSegments.some((segment) => segment.startsWith("."))
  ) {
    sendError(response, 403, "Acesso negado.");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (path.extname(filePath)) {
      sendError(response, 404, "Arquivo nao encontrado.");
      return;
    }

    const indexPath = path.join(publicDir, "index.html");
    response.writeHead(200, { "Content-Type": mimeTypes[".html"] });
    response.end(fs.readFileSync(indexPath));
    return;
  }

  const extension = path.extname(filePath);
  response.writeHead(200, {
    "Content-Type": mimeTypes[extension] || "application/octet-stream"
  });
  response.end(fs.readFileSync(filePath));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    serveStatic(response, url.pathname);
  } catch (error) {
    sendError(response, 500, error.message);
  }
});

server.listen(config.port, () => {
  console.log(`Blog de traducao rodando em http://localhost:${config.port}`);
  console.log(`Provider de traducao: ${config.provider}`);
});
