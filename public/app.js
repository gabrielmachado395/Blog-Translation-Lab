const state = {
  config: null,
  locale: "pt-BR",
  view: "blog",
  blogSource: "crud",
  posts: [],
  staticPosts: []
};

const elements = {
  providerName: document.querySelector("#providerName"),
  providerStatus: document.querySelector("#providerStatus"),
  localeControl: document.querySelector("#localeControl"),
  viewTitle: document.querySelector("#viewTitle"),
  blogPosts: document.querySelector("#blogPosts"),
  postForm: document.querySelector("#postForm"),
  postId: document.querySelector("#postId"),
  composerTitle: document.querySelector("#composerTitle"),
  submitPost: document.querySelector("#submitPost"),
  title: document.querySelector("#title"),
  summary: document.querySelector("#summary"),
  body: document.querySelector("#body"),
  blogSource: document.querySelector("#blogSource"),
  openComposer: document.querySelector("#openComposer"),
  closeComposer: document.querySelector("#closeComposer"),
  composerModal: document.querySelector("#composerModal"),
  toast: document.querySelector("#toast")
};

function localeLabel(locale) {
  const labels = {
    "pt-BR": "PT-BR",
    en: "EN",
    es: "ES"
  };

  return labels[locale] || locale.toUpperCase();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 3200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Falha na chamada da API.");
  }

  return payload;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMarkdown(value) {
  const escaped = escapeHtml(value || "");
  const codeBlocks = [];
  const protectedText = escaped.replace(/```([\s\S]*?)```/g, (_, code) => {
    const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
    return token;
  });

  let html = protectedText
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br />");

  html = `<p>${html}</p>`;

  codeBlocks.forEach((block, index) => {
    html = html.replace(`@@CODE_BLOCK_${index}@@`, block);
  });

  return html;
}

function statusPill(status) {
  const variants = {
    translated: "ok",
    published: "ok",
    stale: "warn",
    failed: "error",
    draft: "warn",
    completed: "ok",
    running: "warn"
  };

  return `<span class="pill ${variants[status] || ""}">${escapeHtml(status)}</span>`;
}

function getTranslation(post, locale) {
  return post.translations?.find((translation) => translation.locale === locale);
}

function iconSvg(name) {
  const paths = {
    edit: `
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    `,
    trash: `
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m6 6 1 14h10l1-14" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    `
  };

  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      ${paths[name] || ""}
    </svg>
  `;
}

function renderLocaleTabs() {
  const locales = [state.config.defaultLocale, ...state.config.targetLocales];
  elements.localeControl.innerHTML = locales
    .map(
      (locale) => `
        <button class="locale-tab ${locale === state.locale ? "is-active" : ""}" data-locale="${locale}">
          ${localeLabel(locale)}
        </button>
      `
    )
    .join("");

  elements.localeControl.querySelectorAll("[data-locale]").forEach((button) => {
    button.addEventListener("click", () => {
      state.locale = button.dataset.locale;
      refreshCurrentView();
    });
  });
}

function renderPostCard(post, options = {}) {
  const display = post.display || post;
  const translation = getTranslation(post, state.locale);
  const isSource = state.locale === post.sourceLocale;
  const needsTranslation =
    !isSource &&
    (!translation || ["stale", "failed"].includes(translation.translationStatus));
  const status = isSource
    ? "source"
    : translation?.translationStatus || "missing";

  return `
    <article class="post-card" data-id="${post.id || post.slug}">
      <div class="post-card-inner">
        ${
          options.kind === "crud"
            ? `
              <div class="post-card-tools">
                <button class="icon-action" data-action="edit-crud" data-id="${post.id}" type="button" aria-label="Editar artigo" title="Editar artigo">
                  ${iconSvg("edit")}
                </button>
                <button class="icon-action danger" data-action="delete-crud" data-id="${post.id}" type="button" aria-label="Excluir artigo" title="Excluir artigo">
                  ${iconSvg("trash")}
                </button>
              </div>
            `
            : ""
        }
        <h3>${escapeHtml(display.title)}</h3>
        <p class="summary">${escapeHtml(display.summary || "")}</p>
        <div class="translation-meta">
          ${statusPill(post.status || display.locale || post.sourceLocale)}
          ${statusPill(status)}
          <span class="pill">${escapeHtml(display.locale || state.locale)}</span>
        </div>
        <div class="markdown">${renderMarkdown(display.body)}</div>
        <div class="card-actions">
          ${
            options.kind === "crud" && !isSource
              ? `<button class="button secondary" data-action="translate-crud" data-id="${post.id}" data-locale="${state.locale}">
                  ${needsTranslation ? "Traduzir" : "Retraduzir"}
                </button>`
              : ""
          }
          ${
            options.kind === "static" && state.locale !== post.sourceLocale
              ? `<button class="button secondary" data-action="translate-static" data-slug="${post.slug}" data-locale="${state.locale}">
                  ${display.translated ? "Retraduzir" : "Traduzir"}
                </button>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderEmpty(target, message) {
  target.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

async function loadBlog() {
  if (state.blogSource === "crud") {
    const payload = await api(`/api/posts?locale=${encodeURIComponent(state.locale)}`);
    state.posts = payload.posts;

    if (!state.posts.length) {
      renderEmpty(elements.blogPosts, "Nenhum artigo publicado ainda.");
      return;
    }

    elements.blogPosts.innerHTML = state.posts
      .map((post) => renderPostCard(post, { kind: "crud" }))
      .join("");
    bindCardActions(elements.blogPosts);
    return;
  }

  const payload = await api(
    `/api/static-posts?locale=${encodeURIComponent(state.locale)}`
  );
  state.staticPosts = payload.posts;

  if (!state.staticPosts.length) {
    renderEmpty(elements.blogPosts, "Nenhum Markdown encontrado em content/posts.");
    return;
  }

  elements.blogPosts.innerHTML = state.staticPosts
    .map((post) => renderPostCard(post, { kind: "static" }))
    .join("");
  bindCardActions(elements.blogPosts);
}

async function refreshCurrentView() {
  renderLocaleTabs();

  if (state.view === "blog") {
    elements.viewTitle.textContent = "Blog";
    await loadBlog();
  }
}

function setBusy(button, isBusy) {
  if (!button) {
    return;
  }

  button.disabled = isBusy;
}

async function translateCrud(button) {
  setBusy(button, true);

  try {
    await api(`/api/posts/${button.dataset.id}/translate`, {
      method: "POST",
      body: JSON.stringify({ targetLocale: button.dataset.locale })
    });
    showToast("Traducao concluida.");
    await refreshCurrentView();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(button, false);
  }
}

async function translateStatic(button) {
  setBusy(button, true);

  try {
    await api(`/api/static-posts/${button.dataset.slug}/translate`, {
      method: "POST",
      body: JSON.stringify({ targetLocale: button.dataset.locale })
    });
    showToast("Arquivo traduzido.");
    await refreshCurrentView();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(button, false);
  }
}

function openEditor(post) {
  elements.postId.value = post.id;
  elements.title.value = post.title;
  elements.summary.value = post.summary || "";
  elements.body.value = post.body;
  elements.composerTitle.textContent = "Editar artigo";
  elements.submitPost.textContent = "Atualizar";
  elements.composerModal.classList.add("is-open");
  elements.composerModal.setAttribute("aria-hidden", "false");
  elements.title.focus();
}

function editCrud(button) {
  const post = state.posts.find((item) => item.id === button.dataset.id);

  if (!post) {
    showToast("Artigo nao encontrado na tela atual.");
    return;
  }

  openEditor(post);
}

async function deleteCrud(button) {
  const post = state.posts.find((item) => item.id === button.dataset.id);
  const title = post?.title || "este artigo";

  if (!window.confirm(`Excluir "${title}"?`)) {
    return;
  }

  setBusy(button, true);

  try {
    await api(`/api/posts/${button.dataset.id}`, { method: "DELETE" });
    await loadBlog();
    showToast("Artigo excluido.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(button, false);
  }
}

function bindCardActions(root) {
  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;

      if (action === "translate-crud") {
        await translateCrud(button);
      }

      if (action === "translate-static") {
        await translateStatic(button);
      }

      if (action === "edit-crud") {
        editCrud(button);
      }

      if (action === "delete-crud") {
        await deleteCrud(button);
      }
    });
  });
}

function resetForm() {
  elements.postId.value = "";
  elements.title.value = "";
  elements.summary.value = "";
  elements.body.value = "";
  elements.composerTitle.textContent = "Novo artigo";
  elements.submitPost.textContent = "Publicar";
}

function openComposer() {
  resetForm();
  elements.composerModal.classList.add("is-open");
  elements.composerModal.setAttribute("aria-hidden", "false");
  elements.title.focus();
}

function closeComposer() {
  elements.composerModal.classList.remove("is-open");
  elements.composerModal.setAttribute("aria-hidden", "true");
}

async function savePost(status) {
  const payload = {
    title: elements.title.value,
    summary: elements.summary.value,
    body: elements.body.value,
    sourceLocale: "pt-BR",
    status
  };

  const postId = elements.postId.value;

  if (postId) {
    await api(`/api/posts/${postId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    if (status === "published") {
      await api(`/api/posts/${postId}/publish`, {
        method: "POST",
        body: JSON.stringify({})
      });
    }
  } else {
    await api("/api/posts", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  resetForm();
  closeComposer();
  state.blogSource = "crud";
  elements.blogSource.value = "crud";

  if (status === "published") {
    state.locale = state.config.targetLocales[0] || state.config.defaultLocale;
  }

  await loadBlog();
  renderLocaleTabs();
  showToast(
    status === "published"
      ? `Publicado e traduzido para ${localeLabel(state.locale)}.`
      : "Rascunho salvo."
  );
}

function bindChrome() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", async () => {
      state.view = button.dataset.view;
      document
        .querySelectorAll(".nav-item")
        .forEach((item) => item.classList.toggle("is-active", item === button));
      document
        .querySelectorAll(".view")
        .forEach((view) =>
          view.classList.toggle("is-visible", view.id === `view-${state.view}`)
        );
      await refreshCurrentView();
    });
  });

  elements.blogSource.addEventListener("change", async () => {
    state.blogSource = elements.blogSource.value;
    await loadBlog();
  });

  document.querySelector("#refreshBlog").addEventListener("click", loadBlog);
  document.querySelector("#resetForm").addEventListener("click", resetForm);
  elements.openComposer.addEventListener("click", openComposer);
  elements.closeComposer.addEventListener("click", closeComposer);
  elements.composerModal.addEventListener("click", (event) => {
    if (event.target === elements.composerModal) {
      closeComposer();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.composerModal.classList.contains("is-open")) {
      closeComposer();
    }
  });

  elements.postForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await savePost("published");
  });
}

async function init() {
  state.config = await api("/api/config");
  state.locale = state.config.defaultLocale;

  elements.providerName.textContent = state.config.provider;
  elements.providerStatus.textContent =
    state.config.provider === "azure"
      ? state.config.azureConfigured
        ? "Azure configurado"
        : "Azure sem chave"
      : "Mock local";

  bindChrome();
  await refreshCurrentView();
}

init().catch((error) => {
  showToast(error.message);
});
