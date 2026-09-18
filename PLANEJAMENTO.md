# Planejamento do Projeto: Blog para Estudo de Servicos de Traducao

## Objetivo

Criar um projeto pessoal, simples e evolutivo, para entender como servicos de traducao funcionam na pratica, especialmente Azure Translator, cobrindo dois cenarios importantes:

- Traducao de arquivos estaticos, como posts em Markdown.
- Traducao de conteudo dinamico via CRUD, como posts criados/editados pela interface.

A ideia nao e criar um produto complexo agora. O foco e montar um laboratorio claro, com codigo organizado, onde seja facil comparar estrategias, medir limites, entender fluxo de traducao, lidar com idiomas e perceber o que muda entre conteudo estatico e conteudo salvo em banco.

## Produto Exemplo

O projeto sera um blog multilanguage local.

Ele tera:

- Posts estaticos em arquivos Markdown.
- Posts dinamicos criados por CRUD.
- Interface para listar, criar, editar, excluir e traduzir posts.
- Paginas publicas por idioma, por exemplo `/pt`, `/en`, `/es`.
- Painel simples para acionar traducao manualmente.
- Botao de publicar que salva o artigo e dispara a traducao automaticamente.
- Botao de traducao nas telas de listagem/admin e tambem na pagina publica do blog.
- Camada de traducao substituivel: primeiro mock local, depois Azure Translator.

## Por Que Um Blog

Um blog e um bom exemplo porque mistura dois tipos reais de conteudo:

- Conteudo estatico: artigos versionados junto ao codigo, bons para estudar build, pre-processamento, arquivos traduzidos e publicacao.
- Conteudo CRUD: artigos salvos localmente, bons para estudar eventos de criacao/edicao, invalidacao de traducoes, jobs, cache, status e retraducao.

Isso permite comparar decisoes comuns em projetos reais:

- Traduzir antes do build ou em tempo de execucao.
- Salvar traducoes prontas ou traduzir sob demanda.
- Traduzir o documento inteiro ou campos separados.
- Manter controle humano antes de publicar uma traducao.
- Usar glossario para padronizar termos.

## Stack Recomendada

### Aplicacao

- Next.js com App Router.
- TypeScript.
- React para interface.
- SQLite local para dados CRUD.
- Drizzle ORM ou Prisma para acesso ao banco.
- Markdown/MDX para posts estaticos.
- Zod para validacao de entradas, payloads e respostas internas.

### Traducao

- Primeiro: `MockTranslationProvider`, sem dependencia externa.
- Depois: `AzureTextTranslationProvider`, para textos e campos do CRUD.
- Depois: `AzureDocumentTranslationProvider`, para arquivos/documentos inteiros.

### Por Que Essa Stack

- Next.js permite juntar paginas, rotas de API, processamento local e frontend em um unico projeto.
- SQLite mantem o CRUD simples e local.
- Markdown representa bem conteudo estatico.
- TypeScript ajuda a modelar contratos de traducao.
- Uma interface `TranslationProvider` evita prender o projeto ao Azure desde o inicio.

## Conceitos Que O Projeto Deve Ensinar

### 1. Traducao de Texto

Usada para campos menores ou conteudo salvo no banco:

- Titulo.
- Resumo.
- Corpo do post.
- Tags.
- Metadados.

Esse fluxo ajuda a entender:

- Deteccao de idioma.
- Idioma de origem e destino.
- Separacao de texto em segmentos.
- Preservacao de HTML/Markdown.
- Cache de resultado traduzido.
- Retraducao quando o texto original muda.

### 2. Traducao de Documento

Usada para arquivos estaticos ou documentos inteiros:

- Markdown.
- DOCX, PDF ou outros formatos futuramente.
- Lotes de arquivos.

Esse fluxo ajuda a entender:

- Traducao sincrona de um unico arquivo.
- Traducao assincrona em lote.
- Uso de storage quando o provedor exige entrada/saida por arquivos.
- Status de jobs.
- Preservacao de estrutura e formatacao.

Segundo a documentacao atual da Microsoft, Azure Document Translation oferece traducao sincrona para arquivo unico e traducao assincrona em lote. Para lotes assincronos, o fluxo normalmente usa Azure Blob Storage com containers de origem e destino.

### 3. Glossario

O projeto deve prever glossarios desde cedo, mesmo que a primeira versao use apenas mock.

Exemplos:

- "post" sempre virar "artigo" em portugues.
- Nome de produto nunca ser traduzido.
- Termos tecnicos manterem consistencia.

Isso ajuda a estudar um ponto importante: traducao automatica nao e apenas converter palavras, mas preservar contexto, terminologia e estilo.

## Arquitetura Proposta

```text
app/
  [locale]/
    page.tsx
    posts/
      [slug]/
        page.tsx
  admin/
    posts/
      page.tsx
    translations/
      page.tsx
  api/
    posts/
      route.ts
    posts/[id]/
      route.ts
    translations/
      route.ts

content/
  posts/
    meu-primeiro-post.pt.md
    exemplo-estatico.pt.md

src/
  db/
    schema.ts
    client.ts
  content/
    markdown.ts
    static-posts.ts
  translation/
    types.ts
    providers/
      mock-provider.ts
      azure-text-provider.ts
      azure-document-provider.ts
    jobs.ts
    segmentation.ts
    glossary.ts
  blog/
    posts-service.ts
    translations-service.ts

data/
  local.db
  translated-static/

scripts/
  translate-static-posts.ts
  seed.ts
```

## Modelo de Dados Inicial

### `posts`

Representa posts criados via CRUD.

Campos sugeridos:

- `id`
- `slug`
- `sourceLocale`
- `title`
- `summary`
- `body`
- `status`: `draft`, `published`, `archived`
- `createdAt`
- `updatedAt`

### `post_translations`

Guarda traducoes dos posts dinamicos.

Campos sugeridos:

- `id`
- `postId`
- `locale`
- `title`
- `summary`
- `body`
- `provider`
- `translationStatus`: `pending`, `translated`, `failed`, `stale`
- `sourceHash`
- `translatedAt`
- `errorMessage`

### `translation_jobs`

Permite estudar fluxo assincrono.

Campos sugeridos:

- `id`
- `type`: `text`, `document`, `static-file`, `crud-post`
- `provider`
- `sourceLocale`
- `targetLocale`
- `status`: `queued`, `running`, `completed`, `failed`, `cancelled`
- `inputRef`
- `outputRef`
- `errorMessage`
- `createdAt`
- `updatedAt`

### `glossary_terms`

Campos sugeridos:

- `id`
- `sourceLocale`
- `targetLocale`
- `sourceTerm`
- `targetTerm`
- `notes`
- `caseSensitive`

## Interface de Traducao

O ponto mais importante do projeto e isolar o provedor.

```ts
export type TranslationInput = {
  sourceLocale?: string;
  targetLocale: string;
  text: string;
  format?: "plain" | "html" | "markdown";
  glossaryId?: string;
};

export type TranslationOutput = {
  sourceLocale: string;
  targetLocale: string;
  text: string;
  provider: string;
  characterCount: number;
};

export interface TranslationProvider {
  name: string;
  translateText(input: TranslationInput): Promise<TranslationOutput>;
  detectLanguage?(text: string): Promise<string>;
}
```

Com isso, a aplicacao pode comecar com:

- `mock`: retorna texto com prefixo `[en]`, `[es]`, etc.
- `azure-text`: chama a API de traducao de texto.
- `azure-document`: chama fluxo especifico para documentos.

## Fluxo Para Arquivos Estaticos

### Primeira Versao

1. Criar posts em `content/posts/*.pt.md`.
2. Ler frontmatter e corpo do Markdown.
3. Traduzir titulo, resumo e corpo para idiomas configurados.
4. Salvar resultado em `data/translated-static/`.
5. Exibir posts estaticos traduzidos nas rotas publicas.

### Exemplo

```text
content/posts/azure-translator.pt.md
data/translated-static/azure-translator.en.md
data/translated-static/azure-translator.es.md
```

### O Que Observar

- O Markdown traduzido preservou links?
- Blocos de codigo foram traduzidos indevidamente?
- O frontmatter foi preservado?
- A traducao ficou melhor por campo ou por documento inteiro?
- Vale salvar arquivo traduzido ou traduzir no build?

## Fluxo Para CRUD

### Primeira Versao

1. Usuario cria post em portugues pelo painel.
2. Usuario clica em "publicar".
3. Frontend chama a API interna do projeto, por exemplo `POST /api/posts`.
4. Backend salva o post em SQLite com status `published`.
5. Backend cria jobs de traducao para os idiomas configurados.
6. Provider traduz titulo, resumo e corpo.
7. Resultado vai para `post_translations`.
8. Pagina publica busca a versao do idioma solicitado.

Importante: o frontend nunca deve chamar Azure Translator diretamente. O clique em "publicar" chama uma rota interna do projeto, e essa rota chama o provider de traducao no servidor.

### Botao de Traducao Manual

Mesmo com traducao automatica ao publicar, o projeto deve ter botoes para acionar traducao manualmente.

Na tela de administracao/listagem de artigos:

- Botao "Traduzir" quando ainda nao existe traducao.
- Botao "Retraduzir" quando a traducao esta `stale`.
- Botao "Ver traducao" quando a traducao existe.

Na tela publica do blog:

- Botao ou seletor de idioma para trocar entre `pt-BR`, `en` e `es`.
- Se a traducao nao existir, mostrar opcao de solicitar/gerar traducao.
- Em ambiente local de estudo, esse botao pode chamar a API e gerar a traducao na hora.

Em um produto real, a geracao de traducao pela tela publica exigiria controle de permissao, limite de uso e protecao contra chamadas excessivas. Neste projeto pessoal, ela pode ser mantida simples para fins de aprendizado.

### Quando Um Post For Editado

Ao editar o post original:

- Calcular novo hash do conteudo original.
- Marcar traducoes antigas como `stale`.
- Permitir retraducao manual.

Isso ensina um problema real: traducoes derivam de uma versao especifica do conteudo original.

## Estrategia de Idiomas

Comecar com:

- `pt-BR` como idioma fonte.
- `en` como primeiro destino.
- `es` como segundo destino opcional.

Configuracao sugerida:

```ts
export const locales = ["pt-BR", "en", "es"] as const;
export const defaultLocale = "pt-BR";
```

## Fases de Implementacao

### Fase 1: Base do Blog Local

Objetivo: ter o blog funcionando sem Azure.

Entregas:

- Criar projeto Next.js.
- Configurar TypeScript.
- Criar layout publico.
- Ler posts estaticos em Markdown.
- Criar banco SQLite.
- Criar CRUD local de posts.
- Criar rotas por idioma.

Resultado esperado:

- Blog abre localmente.
- Posts estaticos aparecem.
- Posts CRUD podem ser criados, editados e excluidos.

### Fase 2: Mock de Traducao

Objetivo: validar arquitetura sem gastar API.

Entregas:

- Criar `TranslationProvider`.
- Implementar `MockTranslationProvider`.
- Criar tabela de traducoes.
- Criar painel de traducao.
- Marcar traducoes como `stale` quando o original muda.

Resultado esperado:

- Usuario consegue simular traducao.
- Fluxo de status ja fica pronto para Azure.

### Fase 3: Azure Text Translation

Objetivo: traduzir conteudo CRUD com API real.

Entregas:

- Configurar variaveis de ambiente.
- Implementar provider do Azure para texto.
- Traduzir titulo, resumo e corpo.
- Registrar erros e contagem de caracteres.
- Adicionar retry simples.

Variaveis esperadas:

```env
AZURE_TRANSLATOR_KEY=
AZURE_TRANSLATOR_ENDPOINT=
AZURE_TRANSLATOR_REGION=
AZURE_TRANSLATOR_API_VERSION=
```

Observacao: a documentacao atual da Microsoft indica a versao GA `2026-06-06` para Text Translation, com schema atualizado, selecao de modelo NMT/LLM em cenarios suportados e operacoes como `languages`, `translate` e `transliterate`.

### Fase 4: Traducao de Arquivos Estaticos

Objetivo: comparar traducao por campos contra traducao por documento.

Entregas:

- Script `translate-static-posts`.
- Opcao A: traduzir frontmatter e corpo como texto/Markdown.
- Opcao B: usar Document Translation para arquivo inteiro.
- Salvar arquivos traduzidos localmente.
- Registrar metadados do job.

Resultado esperado:

- Posts Markdown em portugues geram versoes traduzidas.
- Fica claro quando usar Text Translation e quando usar Document Translation.

### Fase 5: Jobs e Observabilidade

Objetivo: visualizar o ciclo de vida da traducao.

Entregas:

- Tabela de jobs.
- Tela de jobs com status.
- Logs basicos.
- Tempo de execucao.
- Contagem de caracteres.
- Erros por provider.

Resultado esperado:

- O projeto mostra o que aconteceu em cada traducao.
- Facilita entender custo, falhas e gargalos.

### Fase 6: Glossario e Controle Editorial

Objetivo: estudar qualidade e consistencia.

Entregas:

- CRUD de termos de glossario.
- Aplicacao de glossario no mock.
- Integracao posterior com recurso de glossario/document translation, quando aplicavel.
- Status editorial: `machine_translated`, `reviewed`, `published`.

Resultado esperado:

- Traducoes podem ser revisadas.
- Termos importantes ficam consistentes.

## Decisoes Tecnicas Importantes

### Salvar Traducao Ou Traduzir Sob Demanda?

Para este projeto, salvar traducao e melhor.

Motivos:

- Facilita estudar estado, cache e retraducao.
- Evita chamadas repetidas.
- Permite comparar resultado antes/depois.
- Permite revisao humana.

### Traduzir Campo A Campo Ou Documento Inteiro?

Usar os dois, para aprendizado.

Campo a campo:

- Melhor para CRUD.
- Mais controle sobre titulo, resumo e corpo.
- Mais facil de salvar no banco.

Documento inteiro:

- Melhor para estudar arquivos.
- Mais proximo de cenarios com DOCX, PDF e lotes.
- Ajuda a entender preservacao de estrutura.

### Sincrono Ou Assincrono?

Comecar sincrono no mock e em traducoes pequenas.

Depois adicionar jobs para simular/estudar assincronia:

- `queued`
- `running`
- `completed`
- `failed`

Isso prepara o projeto para Document Translation em lote, que costuma ter natureza assincrona.

## Pontos de Atencao Com Azure Translator

- Separar Text Translation de Document Translation.
- Nao expor chave da Azure no frontend.
- Fazer chamadas sempre no backend.
- Guardar endpoint, chave e regiao em `.env.local`.
- Controlar numero de caracteres enviados.
- Evitar traduzir blocos de codigo.
- Preservar links, imagens e metadados.
- Salvar erros de API para diagnostico.
- Pensar em glossario cedo.
- Medir quando usar NMT padrao e quando usar LLM, caso o recurso esteja disponivel na conta.

## Telas Sugeridas

### Blog Publico

- Lista de posts.
- Filtro por idioma.
- Pagina individual do post.
- Botao/seletor para traduzir ou alternar idioma.
- Aviso discreto quando a traducao ainda nao existe.

### Admin de Posts

- Lista CRUD.
- Criar post.
- Editar post.
- Excluir post.
- Publicar post.
- Disparar traducao automatica ao publicar.
- Ver status das traducoes por idioma.
- Botao de traduzir/retraduzir por idioma.

### Admin de Traducao

- Selecionar post.
- Selecionar idioma destino.
- Rodar traducao.
- Ver resultado.
- Ver erro, se houver.
- Marcar traducao como revisada.

### Admin de Arquivos Estaticos

- Listar arquivos fonte.
- Ver quais idiomas ja foram gerados.
- Rodar traducao de um arquivo.
- Rodar traducao em lote.

## Scripts Uteis

```json
{
  "dev": "next dev",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "seed": "tsx scripts/seed.ts",
  "translate:static": "tsx scripts/translate-static-posts.ts"
}
```

## Estrategia de Testes

### Testes Unitarios

- `TranslationProvider`.
- Segmentacao de Markdown.
- Hash de conteudo original.
- Marcacao de traducao `stale`.
- Aplicacao de glossario.

### Testes de Integracao

- Criar post.
- Traduzir post com mock.
- Editar original.
- Confirmar que traducao ficou `stale`.
- Retraduzir.

### Testes Manuais

- Criar post com links.
- Criar post com bloco de codigo.
- Criar post com termos de glossario.
- Traduzir para ingles e espanhol.
- Comparar resultado salvo no banco e em arquivo.

## Ordem Recomendada Para Comecar

1. Criar app Next.js com TypeScript.
2. Implementar posts estaticos em Markdown.
3. Implementar CRUD local com SQLite.
4. Criar interface `TranslationProvider`.
5. Implementar mock de traducao.
6. Salvar traducoes no banco.
7. Criar script de traducao de arquivos estaticos.
8. Integrar Azure Text Translation.
9. Integrar Azure Document Translation.
10. Adicionar glossario e revisao editorial.

## Primeira Implementacao Local

A primeira implementacao do projeto foi criada de forma enxuta, sem dependencias externas, usando Node.js puro, frontend estatico e persistencia em JSON local.

Essa decisao ajuda no aprendizado inicial porque:

- Evita complexidade de framework antes de entender o fluxo de traducao.
- Permite testar Azure Translator rapidamente.
- Mantem o CRUD local e facil de inspecionar.
- Deixa clara a separacao entre frontend, API interna e provider de traducao.

Estrutura inicial implementada:

```text
src/
  server.js
  env.js
  db.js
  content.js
  translation.js

public/
  index.html
  styles.css
  app.js

content/
  posts/
    azure-translator.pt-BR.md

data/
  blog-db.json
  translated-static/
```

Fluxo do botao "Publicar":

1. Frontend envia o artigo para `POST /api/posts`.
2. Backend salva o artigo como `published`.
3. Backend cria jobs locais de traducao.
4. Backend chama `TranslationProvider`.
5. Com `TRANSLATION_PROVIDER=azure`, a chamada vai para Azure Translator.
6. Com `TRANSLATION_PROVIDER=mock`, a traducao e simulada localmente.
7. Resultado e salvo em `post_translations` dentro de `data/blog-db.json`.

Variaveis locais:

```env
TRANSLATION_PROVIDER=azure
AZURE_TRANSLATOR_KEY=
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
AZURE_TRANSLATOR_REGION=
AZURE_TRANSLATOR_API_VERSION=3.0
TARGET_LOCALES=en,es
PORT=3000
```

O frontend nunca deve receber a chave da Azure. Ele chama apenas a API local do projeto.

## Resultado Final Esperado

Ao final, o projeto deve responder perguntas praticas como:

- Como eu traduzo conteudo estatico?
- Como eu traduzo dados vindos de CRUD?
- Quando faz sentido salvar traducoes?
- Como detectar que uma traducao ficou desatualizada?
- Como separar logica do app da logica do provedor?
- Qual e a diferenca pratica entre Text Translation e Document Translation?
- Como usar glossario para melhorar consistencia?
- Como preparar uma arquitetura simples para trocar de provedor depois?

## Referencias Oficiais

- Azure Translator overview: https://learn.microsoft.com/en-us/azure/ai-services/translator/overview
- Azure Text Translation overview: https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/overview
- Azure Text Translation REST API: https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/reference/rest-api-guide
- Azure Text Translation REST API 2026-06-06: https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/2026-06-06/rest-api-guide
- Azure Document Translation REST API 2026-03-01: https://learn.microsoft.com/en-us/azure/ai-services/translator/document-translation/latest/rest-api/guide-overview
- Azure Document Translation quickstart: https://learn.microsoft.com/en-us/azure/ai-services/translator/document-translation/quickstarts/rest-api
- Azure Document Translation com REST: https://learn.microsoft.com/en-us/azure/ai-services/translator/document-translation/how-to-guides/use-rest-api-programmatically
- Azure Document Translation glossarios: https://learn.microsoft.com/en-us/azure/ai-services/translator/document-translation/how-to-guides/create-use-glossaries

## Nota Sobre Versoes

Este planejamento considera a documentacao consultada em 2026-09-03. Para implementacao real com Azure, confirmar novamente a versao da API, disponibilidade do recurso na conta, limites, precos e requisitos de storage antes de codar a integracao final.
