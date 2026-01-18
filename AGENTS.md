# piiRedactor — Agent Configuration

Project: A Cloudflare Workers API for redacting PII (Personally Identifiable Information) from text using regex pattern matching.

## Project Overview

- **Type:** Cloudflare Workers (serverless)
- **Framework:** Hono (lightweight web framework)
- **Language:** JavaScript
- **Main Endpoint:** `POST /redact` — accepts text and returns redacted version with metadata
- **PII Types Detected:** IPv4, Email, SSN (US format), Credit Cards

## Development Standards

### Git & Versioning

1. **Conventional Commits:** Use the format `type(scope): subject` for clarity
   - `feat(redaction): add support for phone numbers`
   - `fix(patterns): improve IPv4 regex accuracy`
   - `docs(readme): update API usage examples`

2. **Before committing:** Run `git log --oneline -5` to check recent history and avoid conflicts

3. **Project Documentation:** Store in `.notes/` directory (excluded from git)
   - Design decisions, research, test cases, architecture notes
   - Keep `README.md` at project root only

### Code Style & Comments

Every function/block follows the **WHAT/WHY/HOW/NOTE** pattern:

```javascript
// =============================================================================
// FUNCTION_NAME
// =============================================================================
// WHAT: Brief description of what this does
// WHY:  Brief explanation of why it's needed
// HOW:  Brief technical explanation of how it works
// NOTE: Any gotchas, alternatives, or reminders
```

Pick 1-3 relevant keywords (don't repeat code). Keep comments brief (1-2 lines per section).

### Regex Patterns

- All PII detection patterns are in the `PATTERNS` object at the top of `src/index.js`
- Patterns are intentionally **simplified for demonstration**—production use requires:
  - More robust validation (Luhn's algorithm for credit cards, proper checksum for SSN)
  - Region-specific formats
  - False-positive mitigation (context awareness)
- Document any changes to patterns with links to RFC or standard references

## Deployment (Cloudflare Workers)

- **Configuration:** `wrangler.toml`
- **Build artifacts:** `.wrangler/` (auto-generated, excluded from git)
- **Deploy command:** `wrangler publish` (or `wrangler deploy` depending on version)
- **Environment:** Add secrets/environment variables via `wrangler secret` CLI

## Testing & Validation

When adding or modifying redaction patterns:

1. Test against known examples (IPv4, email, SSN, credit card formats)
2. Test edge cases: malformed input, partial matches, false positives
3. Verify the `totalRedactions` count is accurate
4. Check response metadata (`original_length`, `redacted_length`) for consistency

## Common Tasks

### Add a new PII pattern

1. Add regex to `PATTERNS` object (top of `src/index.js`)
2. Add test cases to `test/patterns.test.js`
3. Add corresponding `applyRedaction()` call in the `/redact` endpoint
4. Run `node test/patterns.test.js` and verify all pass
5. Document limitations in code comments
6. Update `README.md` with new pattern info
7. Commit with `feat(patterns): add [PII_TYPE] detection`

### Test before deploying

```bash
npm test
wrangler deploy --dry-run
```

### Modify regex accuracy

1. Update pattern in `PATTERNS`
2. Document any improvements or limitations in a comment
3. Test against diverse inputs
4. Commit with `fix(patterns): improve [TYPE] detection accuracy`

### Update error handling

1. Modify validation logic in the `/redact` endpoint (lines 36-57)
2. Return appropriate HTTP status codes (400 for bad input, 500 for server errors)
3. Provide clear error messages in response
4. Commit with `fix(redact): improve error handling for [CASE]`

## End-of-Day Devlog (EOD)

When session ends, save a brief devlog to `.notes/DEVLOG.md`:

```markdown
## [YYYY-MM-DD] [HH:MM - HH:MM]

### What I Did

- [Bullet points of completed work]

### Currently Working On

- [Incomplete work / in-progress tasks]

### Next Steps

- [What to resume with tomorrow]
```

---

**Last updated:** 2026-01-17
