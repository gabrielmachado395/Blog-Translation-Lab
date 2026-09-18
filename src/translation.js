import crypto from "node:crypto";

function characterCount(values) {
  return values.reduce((total, value) => total + [...value].length, 0);
}

function splitMarkdownByCodeBlocks(markdown) {
  const parts = [];
  const pattern = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: markdown.slice(lastIndex, match.index) });
    }

    parts.push({ type: "code", value: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < markdown.length) {
    parts.push({ type: "text", value: markdown.slice(lastIndex) });
  }

  return parts;
}

function normalizeEndpoint(endpoint) {
  return endpoint.replace(/\/+$/, "");
}

function azureTranslatePath(endpoint) {
  const normalized = normalizeEndpoint(endpoint);

  if (normalized.includes("/translator/text/v3.0")) {
    return `${normalized}/translate`;
  }

  if (normalized.includes("cognitiveservices.azure.com")) {
    return `${normalized}/translator/text/v3.0/translate`;
  }

  return `${normalized}/translate`;
}

async function translateWithAzure(config, input) {
  const key = config.azure.key;

  if (!key) {
    throw new Error("AZURE_TRANSLATOR_KEY nao foi configurada.");
  }

  const url = new URL(azureTranslatePath(config.azure.endpoint));
  url.searchParams.set("api-version", config.azure.apiVersion);
  url.searchParams.append("to", input.targetLocale);

  if (input.sourceLocale) {
    url.searchParams.set("from", input.sourceLocale);
  }

  if (input.format === "html") {
    url.searchParams.set("textType", "html");
  }

  const headers = {
    "Ocp-Apim-Subscription-Key": key,
    "Content-Type": "application/json",
    "X-ClientTraceId": crypto.randomUUID()
  };

  const region = config.azure.region.trim();

  if (region && region.toLowerCase() !== "global") {
    headers["Ocp-Apim-Subscription-Region"] = region;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify([{ Text: input.text }])
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Azure Translator retornou HTTP ${response.status}.`;
    throw new Error(message);
  }

  const first = payload?.[0];
  const translation = first?.translations?.[0];

  if (!translation?.text) {
    throw new Error("Resposta inesperada do Azure Translator.");
  }

  return {
    sourceLocale:
      first?.detectedLanguage?.language || input.sourceLocale || "auto",
    targetLocale: input.targetLocale,
    text: translation.text,
    provider: "azure",
    characterCount: characterCount([input.text])
  };
}

async function translateWithMock(input) {
  const dictionaries = {
    en: {
      "Meu primeiro artigo": "My first article",
      "Resumo": "Summary",
      "traducao": "translation",
      "servico": "service",
      "blog": "blog"
    },
    es: {
      "Meu primeiro artigo": "Mi primer articulo",
      "Resumo": "Resumen",
      "traducao": "traduccion",
      "servico": "servicio",
      "blog": "blog"
    }
  };

  let text = input.text;
  const dictionary = dictionaries[input.targetLocale] || {};

  for (const [source, target] of Object.entries(dictionary)) {
    text = text.replaceAll(source, target);
  }

  return {
    sourceLocale: input.sourceLocale || "pt-BR",
    targetLocale: input.targetLocale,
    text: `[${input.targetLocale}] ${text}`,
    provider: "mock",
    characterCount: characterCount([input.text])
  };
}

export async function translateText(config, input) {
  if (!input.text.trim()) {
    return {
      sourceLocale: input.sourceLocale || "pt-BR",
      targetLocale: input.targetLocale,
      text: "",
      provider: config.provider,
      characterCount: 0
    };
  }

  if (config.provider === "azure") {
    return translateWithAzure(config, input);
  }

  return translateWithMock(input);
}

export async function translateMarkdown(config, input) {
  const parts = splitMarkdownByCodeBlocks(input.text);
  const translatedParts = [];
  let count = 0;
  let provider = config.provider;
  let sourceLocale = input.sourceLocale || "pt-BR";

  for (const part of parts) {
    if (part.type === "code" || !part.value.trim()) {
      translatedParts.push(part.value);
      continue;
    }

    const output = await translateText(config, {
      ...input,
      text: part.value,
      format: "plain"
    });

    provider = output.provider;
    sourceLocale = output.sourceLocale;
    count += output.characterCount;
    translatedParts.push(output.text);
  }

  return {
    sourceLocale,
    targetLocale: input.targetLocale,
    text: translatedParts.join(""),
    provider,
    characterCount: count
  };
}

export async function translatePost(config, post, targetLocale) {
  const [title, summary, body] = await Promise.all([
    translateText(config, {
      sourceLocale: post.sourceLocale,
      targetLocale,
      text: post.title,
      format: "plain"
    }),
    translateText(config, {
      sourceLocale: post.sourceLocale,
      targetLocale,
      text: post.summary,
      format: "plain"
    }),
    translateMarkdown(config, {
      sourceLocale: post.sourceLocale,
      targetLocale,
      text: post.body,
      format: "markdown"
    })
  ]);

  return {
    title: title.text,
    summary: summary.text,
    body: body.text,
    provider: body.provider,
    characterCount:
      title.characterCount + summary.characterCount + body.characterCount
  };
}
