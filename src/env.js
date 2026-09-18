import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const index = trimmed.indexOf("=");

  if (index === -1) {
    return null;
  }

  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(rootDir, fileName);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);

      if (!parsed) {
        continue;
      }

      const [key, value] = parsed;

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

export function getConfig() {
  const targetLocales = (process.env.TARGET_LOCALES || "en,es")
    .split(",")
    .map((locale) => locale.trim())
    .filter(Boolean);

  return {
    port: Number(process.env.PORT || 3000),
    provider: process.env.TRANSLATION_PROVIDER || "mock",
    defaultLocale: "pt-BR",
    targetLocales,
    azure: {
      key: process.env.AZURE_TRANSLATOR_KEY || "",
      endpoint:
        process.env.AZURE_TRANSLATOR_ENDPOINT ||
        "https://api.cognitive.microsofttranslator.com",
      region: process.env.AZURE_TRANSLATOR_REGION || "",
      apiVersion: process.env.AZURE_TRANSLATOR_API_VERSION || "3.0"
    }
  };
}
