# PII Redactor

**Industrial-grade PII (Personally Identifiable Information) redaction for serverless environments.**

A stateless, high-performance API that detects and redacts sensitive data from text using pattern matching. Built for CI/CD pipelines, log sanitization, and secure data processing.

Deployed on **Cloudflare Workers** for global edge performance. Available on **RapidAPI** for easy integration.

## Features

- **Zero-Persistence Design** — In-memory processing only. Your data never touches a disk.
- **Multi-Pattern Detection** — IPv4 addresses, email addresses, US SSNs, credit cards, phone numbers
- **Privacy-First Redaction** — Generic `[REDACTED]` tokens (no type leakage) and no metadata inference
- **High Performance** — Sub-100ms response times via Cloudflare's global edge network
- **Semantic Errors** — Detailed error codes and hints for integration debugging
- **Validation-Integrated** — Luhn-checksummed credit cards, range-validated IPv4 addresses, reserved SSN range filtering

## Quick Start

### Installation

```bash
npm install
```

### Local Development

```bash
npm run dev
# Server runs at http://localhost:8787
```

### Testing

```bash
npm test
# Runs pattern validation suite
```

## API Reference

### POST /redact

Detects and redacts PII from input text.

#### Request

```json
{
  "text": "Contact me at john.doe@example.com or call (555) 123-4567"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "result": "Contact me at [REDACTED] or call [REDACTED]",
  "metadata": {
    "redactions_count": 2,
    "redactions_by_type": {
      "email": 1,
      "phone_us": 1
    }
  }
}
```

#### Response (400 Bad Request)

```json
{
  "success": false,
  "error": "Missing or invalid 'text'. Expected a non-empty string.",
  "code": "INVALID_INPUT",
  "hint": "Ensure request body is valid JSON with a 'text' property."
}
```

#### Error Codes

| Code                  | HTTP | Meaning                                             |
| --------------------- | ---- | --------------------------------------------------- |
| `INVALID_BODY`        | 400  | Request body is not valid JSON                      |
| `INVALID_INPUT`       | 400  | `text` field is missing or not a string             |
| `INPUT_TOO_LARGE`     | 413  | Input exceeds 1MB limit                             |
| `RATE_LIMIT_EXCEEDED` | 429  | Too many requests (subscription tier limit reached) |

## Supported PII Patterns

| Pattern         | Format           | Examples                                            | Validation                                   |
| --------------- | ---------------- | --------------------------------------------------- | -------------------------------------------- |
| **IPv4**        | `x.x.x.x`        | `192.168.1.1`, `10.0.0.1`                           | Range-checked (0-255 per octet)              |
| **Email**       | RFC-like format  | `user@example.com`, `john.doe+tag@company.co.uk`    | Basic RFC validation                         |
| **SSN (US)**    | `XXX-XX-XXXX`    | `123-45-6789`                                       | Excludes reserved ranges (000, 666, 900-999) |
| **Credit Card** | 13-19 digits     | `4532-1234-5678-9010`, `4532 1234 5678 9010`        | Luhn algorithm validated                     |
| **Phone (US)**  | 10-digit formats | `(555) 123-4567`, `555-123-4567`, `+1-555-123-4567` | US format only                               |

## Limitations & Caveats

- **Format-Based Detection Only** — Patterns match based on format, not real-time validation (e.g., we can't verify if an IP is actually allocated or if an email is registered)
- **No Context Awareness** — May redact PII-like patterns in code, test data, or documentation
- **False Positives** — Credit card and SSN patterns may match valid-format numbers that aren't actually PII
- **False Negatives** — Obfuscated PII (e.g., `user [at] domain.com`) will not be caught
- **US-Centric** — SSN and phone patterns are US-specific; international formats are not supported
- **No Audit Logging** — This API does not log what was redacted (privacy by design)

**Production Use:** For security-critical applications, combine this API with secondary validation, context-aware filtering, or human review.

## Usage Examples

### Basic Redaction

```javascript
const response = await fetch("https://pii-redactor-api.p.rapidapi.com/redact", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-RapidAPI-Key": "YOUR_API_KEY",
    "X-RapidAPI-Host": "pii-redactor-api.p.rapidapi.com",
  },
  body: JSON.stringify({
    text: "Log entry: User john.doe@company.com logged in from 192.168.1.100",
  }),
});

const data = await response.json();
console.log(data.result); // "Log entry: User [REDACTED] logged in from [REDACTED]"
```

### Bulk Processing (Streaming)

```bash
# Process a file line-by-line
cat logs.txt | while read line; do
  curl -X POST https://pii-redactor-api.p.rapidapi.com/redact \
    -H "Content-Type: application/json" \
    -H "X-RapidAPI-Key: YOUR_API_KEY" \
    -d "{\"text\": \"$line\"}" | jq .result
done > logs_redacted.txt
```

### CI/CD Pipeline Integration

```yaml
# Example GitHub Actions workflow
- name: Redact PII from logs
  run: |
    npm install pii-redactor-sdk
    node scripts/redact-logs.js --input=build.log --output=build_safe.log
```

## Subscription Tiers

Available on RapidAPI with tiered pricing:

| Tier      | Requests/Month | Max Input Size | Rate Limit    |
| --------- | -------------- | -------------- | ------------- |
| **BASIC** | 10,000         | 1 MB           | 100 req/min   |
| **PRO**   | 100,000        | 10 MB          | 1,000 req/min |
| **ULTRA** | 1,000,000      | 50 MB          | 5,000 req/min |
| **MEGA**  | Unlimited      | Unlimited      | Unlimited     |

[View Pricing](https://rapidapi.com/TheOnliestMattastic/api/pii-redactor/pricing)

## Architecture

```
Client (App/CLI)
    │
    ├─> HTTPS Request (POST /redact)
    │
    ├─> Cloudflare Worker (Edge)
    │   ├─ Input Validation (size, format)
    │   ├─ Pattern Matching (regex engine)
    │   ├─ Redaction & Counting
    │   └─ Response Serialization
    │
    └─> JSON Response (redacted text + metadata)
```

**No Database.** No Logging.\*\* Zero Data Persistence.

## Roadmap

- [ ] **Multi-Language PII** — International phone numbers, postal codes, passport numbers
- [ ] **Context-Aware Filtering** — Reduce false positives by analyzing surrounding text
- [ ] **Custom Patterns** — Allow users to define regex patterns per subscription tier
- [ ] **Redaction Formats** — Options like `[***]`, `XXXX-XXXX-XXXX-XXXX`, masking, hashing
- [ ] **Batch Endpoint** — Process multiple texts in a single request
- [ ] **Analytics Dashboard** — View redaction metrics and patterns (RapidAPI)

## Security & Privacy

- **No Data Retention** — Text is processed in-memory and discarded immediately
- **No Logging** — We don't log request contents or redaction patterns
- **Open Source** — Code is transparent; security by design, not obscurity
- **TLS/HTTPS Only** — All communication is encrypted in transit
- **GDPR Compliant** — No personal data is stored or shared

## Contributing

We welcome bug reports, feature requests, and pull requests.

### Development Workflow

1. Clone the repo
2. `npm install`
3. Make changes
4. `npm test` — Ensure all pattern tests pass
5. Commit with conventional format: `type(scope): subject`
6. Submit PR

See [AGENTS.md](AGENTS.md) for detailed development standards.

## License

MIT — See [LICENSE](LICENSE) for details.

## Support

- **Issues & Bug Reports** — [GitHub Issues](https://github.com/TheOnliestMattastic/piiRedactor/issues)
- **API Discussions** — [RapidAPI Discussions](https://rapidapi.com/TheOnliestMattastic/api/pii-redactor/discussions)
- **Enterprise/Custom Tiers** — [Contact Provider](https://github.com/TheOnliestMattastic)

## Related Projects

- **[ConfigAlchemy](https://github.com/TheOnliestMattastic/ConfigAlchemy)** — Industrial-grade configuration format conversion (JSON, YAML, TOML, Lua)

---

**Built with ❤️ by TheOnliestMattastic**  
**Deployed on Cloudflare Workers | Available on RapidAPI**
