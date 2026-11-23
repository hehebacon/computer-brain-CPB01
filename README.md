# CPB-01 — Independent Brain

CPB-01 is a small, deterministic symbolic-computation prototype with a browser chat interface.

## Important scope
- No LLM, hosted AI model, AI API, or network request is used to generate replies.
- The brain kernel is ordinary JavaScript: explicit parsing rules, a small fact store, deterministic arithmetic, and explicit fallback behavior.
- Facts are stored in the browser's localStorage. They remain on that browser profile.
- This is an early rule-based cognitive-system experiment, not human-like intelligence or AGI.

## Run
Open `index.html` in a modern browser. For local development, you can also run a static server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Teach and query
Teach a fact using this exact form:

```
Ghi nhớ: Trái Đất | là | hành tinh
```

Then ask:

```
Trái Đất là gì?
```

Other supported inputs include:
- `Bạn là ai?`
- `Bạn có nhớ gì?`
- `tính 12 * 8`

Unknown inputs are explicitly reported as unknown. The kernel does not invent answers.

## Architecture
- `brain.js`: deterministic kernel, parser, local fact memory, explicit reasoning/query rules.
- `index.html`: chat UI and local interaction.
- No backend is required for this first prototype.

## Next research steps
1. Add a formal fact and relation schema.
2. Add provenance and contradiction handling.
3. Add test cases for parsing, memory persistence, and inference.
4. Define measurable benchmarks before claiming novel cognitive capabilities.

## Privacy
The prototype does not transmit chat content to a server. Clearing browser site data also clears its local memory.
