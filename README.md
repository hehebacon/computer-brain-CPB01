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
