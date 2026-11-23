# CPB-01 — Independent Brain

CPB-01 is a local-first deterministic cognitive-system prototype. It does not use an LLM, hosted AI model, AI API, or network request to generate responses.

## AllPlus input architecture (v0.2)

The Universal Input Engine automatically classifies text and files. It creates a Universal Input Representation (schema cpb01.uir/1), preserving the original source and reporting uncertainty and limitations.

### Core recognition and extraction
- Natural text: raw text preservation, NFC-normalized companion text, token and segment offsets, approximate word/sentence/paragraph counts, script and heuristic language hints. UTF-8 and BOM-marked UTF-16 decoding for text files.
- Structured text: JSON parsing, basic XML/HTML structural detection, Markdown structure detection, CSV/TSV row parsing.
- Source code: extension/signature heuristics and basic source metrics; not a compiler or security analyzer.
- Images: PNG, JPEG, GIF, WebP, BMP, TIFF, AVIF, HEIC signature recognition and image dimensions where browser decoding is available.
- Audio: WAV, MP3, OGG, FLAC, AAC, M4A recognition and browser-readable media metadata.
- Video: MP4, WebM, MKV recognition and browser-readable media metadata.
- Documents: PDF, DOCX/XLSX/PPTX, ODT/ODS/ODP and legacy Office container recognition.

### Capability boundary
Recognition is not semantic understanding. The core does not yet perform OCR/visual interpretation, speech-to-text, video scene understanding, PDF text extraction, or Office document extraction. Those require explicit adapters registered through CPB01.registerAdapter(type, handler). Missing adapters are reported as recognized-needs-adapter; the engine never claims to have read content it did not extract. Archive contents are not executed or automatically unpacked.

Reserved adapter types:
- image-ocr-or-vision
- audio-transcription
- video-analysis
- pdf-text-extraction
- office-document-extraction

No adapter is bundled by default. Adapters can later be implemented with audited, self-hosted parsers/models if needed.

## Architecture
- index.html: browser chat and file-input UI.
- brain.js: deterministic kernel, memory, and public CPB01 interface.
- input-engine.js: automatic format detection, text decoding, file signatures, and adapter routing.
- universal-representation.js: versioned, loss-aware UIR with raw/normalized content, token spans, segments, provenance, limitations, and explicit interpretation status.
- tests/input-engine.test.mjs: Node.js tests for core text and file detection.
- build.sh: static deployment helper; output directory is dist/.

## Run locally

Use a local static server because the project uses ES modules:

    python3 -m http.server 8000

Open http://localhost:8000.

Run tests with Node.js 18+:

    node --test tests/input-engine.test.mjs

## Build

    bash build.sh

For Cloudflare Pages, use build command bash build.sh and output directory dist.

## Memory and privacy
Facts are stored in this browser profile's localStorage. Uploaded files are processed in the browser and are not uploaded by this core. File contents are not stored in long-term memory. Clearing browser site data also clears local memory.

## Scope
This is an experimental deterministic prototype, not human-like intelligence or AGI. Input classification and language detection are heuristic and can be wrong. Reasoning remains limited to explicitly implemented rules.


## Universal Representation (UIR) v1.0

All text and recognized binary-file paths now produce a versioned intermediate representation defined in `universal-representation.js`.

Core fields:
- `schema`, `id`, `createdAt`: schema identity and record identity.
- `source`: source name, MIME type, extension, size, encoding, and modification time when available.
- `content.raw` and `content.normalized`: preserve the original text alongside a normalized working copy.
- `segments` and `tokens`: paragraph/sentence and Unicode-aware word spans with offsets into normalized content.
- `language` and `scripts`: heuristic language/script observations with confidence, not guaranteed translation or understanding.
- `structure`: format-specific attributes such as JSON root type, table preview, source-code language, or text counts. Common attributes remain at the top level for compatibility.
- `interpretation`: explicitly separates syntactic analysis from semantic understanding. The current engine sets this to `not-performed`.
- `provenance`: records processing stages and transformations.
- `limitations` and `diagnostics`: make uncertainty and unsupported extraction visible.

Binary formats receive the same outer schema but have null text content and an explicit adapter-required status until a decoder is installed. The representation is descriptive data, not proof that the Brain understands the input.

Validate the schema and run regression tests with:

```bash
npm test
bash build.sh
```


## Cognitive Core v0.1

The current chat kernel delegates to `cognitive-core.js`, which introduces an inspectable, bounded cognitive cycle:

```
Input representation
    -> Perception / working-state update
    -> Associative memory retrieval
    -> Relation-based inference
    -> Confidence and uncertainty estimate
    -> Natural-language response
    -> Episode / memory update
```

### Current capabilities

- Persistent semantic facts and bounded episodic records in browser localStorage.
- Associative retrieval using overlapping Unicode-aware terms.
- Explicitly labeled two-link relation inference for a small supported relation pattern.
- A safe arithmetic expression parser supporting +, -, *, /, %, powers, parentheses, unary signs, and division-by-zero checks. It does not use JavaScript `eval`.
- A small working state tracking recent turns, current focus, and coarse conversational tone estimates. These are computational signals, not subjective feelings.
- A reasoning trace and confidence value returned by the kernel for inspection.

### Important limits

This is an early symbolic cognitive architecture, not a human mind and not general intelligence. It does not yet have broad world knowledge, robust language understanding, grounded perception, autonomous learning from arbitrary documents, or human-like common-sense reasoning. It only infers within explicit stored relationships and reports uncertainty when evidence is missing.

The design keeps capabilities bounded: no unrestricted self-modification, self-replication, shell access, or autonomous external actions. New capabilities should be added as testable, permission-limited subsystems.

Run all tests with `npm test`.

## Human Cognitive Systems (HCS) v0.2

The cognitive kernel now includes a broader, inspectable HCS layer:

- **Emotion cues:** heuristic signals for joy, sadness, anger, fear, surprise, confusion, gratitude, curiosity, compliments, and insults. Punctuation and phrase matching are only weak context clues; quotes, sarcasm, slang, and who a phrase refers to can still cause mistakes.
- **Affective state meter:** a bounded score from -100 to +100. Zero is the neutral baseline. Positive and negative text cues move the score in either direction; later neutral turns gradually bring it back toward zero. The sidebar includes a manual slider and a reset-to-neutral control. This is a simulated software state, not a claim of subjective feeling.
- **Question/dialogue recognition:** common question types and dialogue acts across a set of built-in languages.
- **Language hints:** built-in lexical hints for Vietnamese, English, Spanish, French, German, Portuguese, Italian, Russian, Arabic, Chinese, Japanese, Korean, and Hindi. Script hints additionally cover Bengali, Tamil, Telugu, Greek, Hebrew, Thai, Khmer, Ethiopic, Armenian, and Georgian.
- **Extensible language packs:** additional vocabulary, emotion cues, compliments, insults, question prefixes, and dialogue-act phrases can be registered at runtime.

Example browser API:

```js
CPB01.setAffect(35);       // Manually set the simulated state.
CPB01.resetAffect();       // Return the meter to neutral.
CPB01.registerLanguagePack({
  code: "xx",
  cues: ["example-language-cue"],
  emotions: { joy: ["example-positive-phrase"] },
  praise: ["example-compliment"],
  insults: ["example-insult"],
  questions: [{ phrase: "example-why", type: "cause" }],
  dialogueActs: { thanks: ["example-thanks"] }
});
```

The familiarity model continues to count local interaction turns; it does not represent affection or a real relationship. HCS output includes confidence and uncertainty, but recognition remains heuristic. Script detection is not translation, and a list of language patterns does **not** mean the core can fully understand every language, dialect, or context. Full multilingual understanding needs substantially broader language resources and/or audited translation or language-model adapters. HCS is a functional software model, not evidence of consciousness or subjective feelings.


## Dual affect, personalization, and public search (v0.3)

### Separate affect models

- **User Affect** estimates the emotional tone of the current user's text and maintains a local score from -100 to +100. It is an uncertain text estimate, not a verified statement about the person.
- **Agent Affect** is a separate simulated internal operating state. It changes after each cognitive cycle based on the kernel's confidence, whether it handled a question, and whether evidence was found. It is not copied from the user's score and is not a claim that CPB-01 has subjective feelings.
- The response policy can choose a supportive, clarifying, language-aware, or direct presentation mode. These modes may change wording, but must not change evidence or confidence.
- Both states are visible and can be adjusted/reset in the sidebar. Values are saved in local browser storage.

### Personalization and evidence synthesis

The personalization profile stores explicit presentation choices only: response detail (concise/balanced/detailed), tone (casual/neutral/formal), output language (auto/Vietnamese/English for search synthesis), and example preference. A user can also say things such as "trả lời ngắn gọn" or "giải thích chi tiết hơn". These settings are local and do not attempt to infer sensitive traits.

`answer-synthesizer.js` ranks returned search snippets by overlap with the question, shows source links, identifies shared query terms, and may add relevant local facts that were already stored in CPB-01. Local memory is combined in the browser and is **not included in the external search request**. Lexical overlap is not proof of truth or source agreement. The synthesizer has read only the returned title/snippet, not the full page.

### Public search Worker

The browser does not contain the provider API key. `worker/search-worker.js` is a separate Cloudflare Worker proxy, configured by `wrangler.toml`. It calls the [Brave Search Web API](https://api-dashboard.search.brave.com/api-reference/web/search/get) with the `X-Subscription-Token` header and `safesearch=strict`. See the provider's [authentication guidance](https://api-dashboard.search.brave.com/documentation/guides/authentication).

Deploy the Worker separately from the Cloudflare Pages static site:

1. Install/use Wrangler and authenticate to the Cloudflare account.
2. From the repository root, add the API key as a Worker secret (never as a committed `vars` entry):

   ```sh
   npx wrangler secret put BRAVE_SEARCH_API_KEY
   ```

3. In the Worker settings, add a plain configuration variable named `ALLOWED_ORIGINS` with the exact origin of the deployed Pages site, for example `https://your-project.pages.dev`. Multiple exact origins can be comma-separated. Local development at `http://localhost:8000` is allowed.
4. Deploy the Worker:

   ```sh
   npx wrangler deploy
   ```

5. Copy the Worker endpoint (for example, `https://cpb01-public-search.<your-subdomain>.workers.dev`) into the "Địa chỉ Search Worker" field in the CPB-01 sidebar and save it.

The Worker optionally accepts a Cloudflare rate-limit binding named `SEARCH_RATE_LIMITER`; configure that binding in Cloudflare if you want an enforced per-client limit. The Worker also caps query/body sizes and returns a small number of results.

The social mode is **search-engine discovery of public, indexed pages only** (currently constrained to selected public community/video/social domains). It is not an authenticated social-network API: it cannot see private accounts, private posts, direct messages, or content that the search index does not expose. It does not log in, bypass access controls, or scrape private areas.

Search sends the typed query to the external search provider. Do not put passwords, private messages, personal contact details, or other sensitive information into a search query. Local CPB-01 memories are not sent with it. Search/API usage may require an active provider plan and may have usage costs; check the provider's current terms and pricing before enabling it.

### Current capability limits

CPB-01 remains a deterministic prototype. Its search answerer is extractive/rule-based: it ranks snippets and summarizes the evidence available in those snippets. It does not independently verify source accuracy, resolve contradictions reliably, translate every language, or understand every social post. Important answers should be checked against the linked source pages. Neither affect model establishes consciousness or real subjective feelings.

## HCS v0.4 — elapsed-time mood and long-term trust

- **User Mood** and **Agent Mood** are separate short-term state variables. Both use a 90-minute half-life and recover from elapsed wall-clock time through `Date.now()`. An eight-hour pause therefore normally returns a high starting score to neutral.
- Each Mood stores `lastUpdatedAt` in the HCS export, which is persisted with the other local browser state. Recovery is calculated when the app opens, reads the state, or processes the next interaction; no neutral messages are required.
- **Trust / Bond** is independent of Mood and does not decay with the short-term mood timer. It is a non-negative, practically unbounded reliability score (bounded by JavaScript's safe integer range). Explicit praise, thanks, directed rapport signals (for example, “nói chuyện với bạn vui”), or externally confirmed success adds small increments, capped at +2 per day. Unrelated positive mood statements are not counted as rapport. An explicit correction or confirmed failed task causes a larger loss and adds trust debt.
- Repeated identical corrections within five minutes are deduplicated. Bond is a measure of interaction quality and reliability, not affection, friendship, attachment, or a real relationship.
- The public API exposes `CPB01.recordTaskOutcome(true|false, severity)` so another testable subsystem can record an independently confirmed task result. The kernel does not treat its own confidence score as proof of success.

## Symbolic Reasoning Engine

`reasoning-engine.js` adds bounded and inspectable reasoning primitives:

- Explicit IF/ELSE branch evaluation with three-valued logic: **true**, **false with explicit contradictory evidence**, and **unknown**. Missing facts are not automatically treated as false, so an unknown condition returns an undetermined branch instead of inventing an answer.
- Compound `all`, `any`, and `not` conditions, plus a small allowlist of context comparisons. Rules are registered with `CPB01.registerRule(...)` and persisted locally.
- Forward chaining from stored facts and registered rules, with a maximum inference depth, step count, and fact count. Derived facts keep rule IDs, premise references, confidence, and provenance.
- This is explainable symbolic rule execution, not open-ended human reasoning. A wrong premise or incomplete rule can still produce a wrong conclusion, so derived results remain labeled and confidence-aware.

Example rule:

```js
CPB01.registerRule({
  id: "mammal-is-animal",
  if: { subject: "Milo", relation: "là", object: "động vật có vú" },
  then: { subject: "Milo", relation: "là", object: "động vật" },
  confidence: 0.8
});
const result = CPB01.reason("Milo");
```

## Local Code Workbench and sandbox

`code-workbench.js` creates Markdown artifacts, a rendered Markdown preview, syntax-highlighted code blocks, and starter templates for HTML, JavaScript, Python, CSS, and README files.

- HTML preview is **static-only**. Script elements, inline event handlers, embedded frames, forms, and other active content are stripped; the iframe uses an opaque sandbox and restrictive CSP. It does not execute uploaded HTML scripts.
- JavaScript snippets run in a DOM-less Web Worker. Common network and persistence APIs (fetch, XMLHttpRequest, WebSocket, IndexedDB, etc.) are disabled where supported; console output is capped and the Worker is terminated after a configurable 250–8000 ms wall-clock timeout.
- Local source files (.html, .css, .js/.mjs/.cjs, .py, .json, .md, .txt) can be loaded into the workbench from the user's device. The browser refuses files above 160 KB and does not run them automatically; the user must inspect the contents and explicitly choose preview or run.
- JSON is syntax-checked with the browser's JSON parser. Python is formatted and previewed as Markdown only; no Python runtime is bundled. CSS can be previewed inside a static HTML shell.
- This is a browser-level execution boundary, not a hardened operating-system/container sandbox. Do not use it as a substitute for reviewing untrusted code, and do not paste secrets into snippets. No shell, package installation, or host filesystem access is provided.

## Direct search without Worker or model tokens

`direct-search.js` offers an optional browser-side adapter for Wikipedia's public MediaWiki search API. It requires no Cloudflare Worker, API key, or language-model call, and reports zero model-token usage. Search requests still leave the browser and go to Wikipedia; this is not offline search and the provider can apply its own rate limits.

Public social-search links for Reddit, YouTube, X, Threads, and TikTok are constructed locally. They open each platform's public search page; they do not scrape content or access private posts, accounts, or messages. This direct route does not automatically retrieve or summarize social posts. The separate Brave-backed Cloudflare Worker remains an optional broader web/social search route and may have provider usage costs. A Worker proxy itself does not consume model tokens; only a separate model API call would.

## End-to-end validation

Run `npm test` and `bash build.sh`. The added `tests/end-to-end.test.mjs` covers elapsed-time recovery, separate Mood and Bond state, explicit corrections, task outcomes, IF/ELSE and multi-step forward chaining, Markdown rendering, sandbox policy/size limits, Worker timeout termination, direct public search, and social search-link generation.
