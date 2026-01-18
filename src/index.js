import { Hono } from "hono";

const app = new Hono();

// =============================================================================
// VALIDATION
// -----------------------------------------------------------------------------
// WHAT: Enfore input constraints to prevent DoS and memory exhaustion
// WHY: Cludflare Workers have memory/execution limits; unbounded input is a vector
// HOW: Check string length, reject oversized payloads early
// NOTE: 1MB limit is reasonable for edge compute; adjust based on CF tier
// =============================================================================

const MAX_INPUT_LENGTH = 1_048_576; // 1MB
const RATE_LIMIT_WINDOW = 60_000; // 60 seconds
const MAX_REQUESTS_PER_MINUTE = 100; // per IP/key

// =============================================================================
// CONFIGURATION
// -----------------------------------------------------------------------------
// NOTE: Pattern Limitations:
// Patterns are intentionally conservative for production use. However, they
// have known limitations and false-positive rates:
//
// - IPv4: Matches valid-format IPs but doesn't geolocate or check active status
// - EMAIL: Matches RFC-like emails; false positives on obfuscated emails (e.g., user [at] domain.com)
// - SSN: Excludes reserved ranges; still may match non-US patterns
// - CREDIT_CARD: Luhn-validated; avoids most order numbers but may match valid card patterns in test data
//
// For critical applications, combine with secondary validation or context-aware filtering.
// =============================================================================

// Standard PII Patterns (Regex)
const PATTERNS = {
  // IPv4: 4 groups of 1-3 digits separated by dots
  IPV4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,

  // Email: Standard pattern for most common email formats
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,

  // SSN (US): Standard AAA-GG-SSSS format
  // NOTE: This pattern rejects known-invalid SSN ranges (000, 666, 900-999)
  SSN_US: /\b(?!000|666|9\d{2})-?\d{3}-(?!00)-?\d{2}-(?!0000)-?\d{4}\b/g,

  // Credit Card (Simple): 13-19 digits, optionally separated by dashes or spaces
  CREDIT_CARD: /\b(?:\d[ -]*?){13,19}\b/g,

  // Phone: US formats (10 digits in various formats)
  PHONE_US:
    /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
};
// =============================================================================
// POST /redact ENDPOINT
// -----------------------------------------------------------------------------
// WHAT: Accepts text and replaces sensitive PII patterns with placeholders.
// WHY:  To sanitize logs or data streams before they are stored or analyzed.
// HOW:  Iteratively applies regex replacements to the input string.
// =============================================================================

app.post("/redact", async (c) => {
  // ---------------------------------------------------------------------------
  // 1. Input Parsing & Validation
  // ---------------------------------------------------------------------------

  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json(
      {
        success: false,
        error: "Invalid or missing JSON body",
        code: "INVALID_BODY",
        hint: 'Ensure request body is valid JSON with a \'text\' property: {"text": "Your text here"}',
      },
      400,
    );
  }

  const { text } = body;

  if (!text || typeof text !== "string") {
    return c.json(
      {
        success: false,
        error: "Missing or invalid 'text'. Expected a non-empty string.",
        code: "INVALID_INPUT",
      },
      400,
    );
  }

  // Input size validation
  if (text.length > MAX_INPUT_LENGTH) {
    return c.json(
      {
        success: false,
        error: `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters.`,
        code: "INPUT_TOO_LARGE",
        max_length: MAX_INPUT_LENGTH,
        received_length: text.length,
      },
      413, // Payload too large
    );
  }

  // ---------------------------------------------------------------------------
  // 2. The Redaction Pipe
  // ---------------------------------------------------------------------------

  let redactedText = text;
  let totalRedactions = 0;

  // Helper function to count and perform replacements
  const applyRedaction = (pattern, placeholder, type, validator) => {
    let count = 0;
    redactedText = redactedText.replace(pattern, (match) => {
      if (validator && !validator(match)) return match; // invalid
      count++;
      return placeholder;
    });
    redactionMap[type] = (redactionMap[type] || 0) + count;
    totalRedactions += count;
  };

  // Helper with Luhn checksum validation
  const isValidCreditCard = (number) => {
    // Remove spaces and dashes
    const digits = number.replace(/[\s-]/g, "");

    // check length
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += 2;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  };

  //Apply Patterns
  const redactionMap = {}; // Track replacements for audit
  applyRedaction(PATTERNS.IPV4, "[REDACTED]", "ipv4");
  applyRedaction(PATTERNS.EMAIL, "[REDACTED]", "email");
  applyRedaction(PATTERNS.SSN_US, "[REDACTED]", "ssn_us");
  applyRedaction(PATTERNS.PHONE_US, "[REDACTED]", "phone_us");
  applyRedaction(
    PATTERNS.CREDIT_CARD,
    "[REDACTED]",
    "credit_card",
    isValidCreditCard,
  );

  // 3. Construct Response
  return c.json({
    success: true,
    result: redactedText,
    metadata: {
      redactions_count: totalRedactions,
      redactions_by_type: redactionMap,
    },
  });
});

app.get("/stats", (c) => {
  // Return aggregated stats (never specific PII)
  return c.json({
    service: "piiRedactor",
    version: "1.0.0",
    patterns_supported: ["ipv4", "email", "ssn_us", "credit_card", "phone_us"],
    limitations:
      "See https://github.com/TheOnliestMattastic/piiRedactor#limitations",
  });
});

export default app;
