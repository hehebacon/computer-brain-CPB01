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

## Human Cognitive Systems (HCS) v0.1

The kernel now includes a separate, inspectable HCS layer:
- Emotion Perception: heuristic multi-label estimates for joy, sadness, anger, fear, surprise, confusion, gratitude, and curiosity. Estimates include confidence, intensity, and an explicit uncertainty caveat.
- Familiarity Model: counts local interaction turns, estimates a coarse familiarity tier, and tracks broad communication style. It does not represent affection, identity, or a real personal relationship.
- Intent & Question Recognition: identifies question forms such as definition, cause, location, time, method, quantity, and yes/no.
- Dialogue Act Recognition: greeting, thanks, apology, request, disagreement, question, or statement.
- Attention Signals: extracts a small set of salient terms for the current turn.
- Self-Monitoring: exposes uncertainty and clarification signals.

HCS state is persisted in the same browser-local memory record. All recognition is heuristic and language coverage is incomplete. Emotion estimates must not be treated as verified facts about a speaker. HCS is a functional software model, not evidence of consciousness or subjective feelings.
