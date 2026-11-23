# CPB-01 — Independent Brain

CPB-01 is an experimental deterministic symbolic-computation prototype with a browser chat interface and a modular AllPlus input-ingestion pipeline.

## Scope and honest limitations

- The current kernel and input pipeline use local JavaScript; no LLM, hosted AI model, or AI API generates replies.
- Input auto-detection covers common text formats, source-code extensions, and selected binary signatures.
- Text decoding supports UTF-8 and UTF-16 BOMs. Text normalization preserves the raw input in the processing result and produces an NFC-normalized representation.
- JSON is parsed with the native JSON parser. XML/SVG use the browser DOM parser when available. CSV/TSV handling is lightweight and does not implement the full quoted-field specification.
- PDF, DOCX, images, audio, video, and archive files can be identified, but their content is **not yet extracted**. Dedicated PDF/OOXML, OCR/vision, speech-recognition, and video adapters are future work. The system reports this limitation rather than claiming it read the file.
- Automatic language identification is not yet a full multilingual NLP system. Unicode normalization does not translate text or guarantee correct interpretation.
- This is an early engineering prototype, not human-like intelligence or AGI.

## Run

Open `index.html` in a modern browser, or run:

```bash
bash build.sh
python3 -m http.server 8000 -d dist
```

Then open http://localhost:8000.

For Cloudflare Pages:
- Build command: `bash build.sh`
- Build output directory: `dist`
- Root directory: `/`

## Input pipeline

```
Raw input / uploaded file
        |
        v
Format detection and byte-signature inspection
        |
        v
Text decoding (UTF-8 / UTF-16 BOM) and conservative normalization
        |
        +---- Text formats -> format-specific structural analysis
        |
        +---- Binary formats -> identification + explicit adapter-needed status
        |
        v
Normalized content / structured analysis
        |
        v
Current symbolic kernel (limited rules and fact memory)
```

### Modules

- `input/format-detector.js`: extension and content-based format detection.
- `input/text-normalizer.js`: BOM-aware decoding and NFC normalization.
- `input/universal-input.js`: text/file ingestion and lightweight format-specific analysis.
- `brain.js`: existing deterministic kernel and local fact memory.
- `index.html`: chat UI, file picker, and pipeline integration.

## Current kernel examples

Teach a fact:

```
Ghi nhớ: Trái Đất | là | hành tinh
```

Query:

```
Trái Đất là gì?
```

Other supported inputs include `Bạn là ai?`, `Bạn có nhớ gì?`, and `tính 12 * 8`.

Unknown inputs are reported as unknown. The kernel does not invent answers.

## Build

`bash build.sh` validates the entry files and copies the UI, kernel, and `input/` modules to `dist/`.

## Privacy

The prototype processes files locally in the browser and does not upload their contents. Existing fact memory is stored in browser localStorage. Clearing browser site data also clears that local memory.

## Next engineering milestones

1. Add robust streaming/large-file handling and explicit size limits.
2. Implement real PDF and DOCX text extraction adapters.
3. Add optional OCR and speech transcription adapters with clear local/remote privacy controls.
4. Add language identification and multilingual tokenization as separate, testable modules.
5. Convert parser outputs into a versioned Universal Representation schema.
6. Connect that representation to memory and reasoning only after validation tests pass.
7. Add regression tests for encodings, malformed inputs, binary signatures, and parser edge cases.
