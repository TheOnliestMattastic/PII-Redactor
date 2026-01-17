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
// =============================================================================

// Standard PII Patterns (Regex)
const PATTERNS = {
  // IPv4: 4 groups of 1-3 digits separated by dots
  IPV4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

  // Email: Standard pattern for most common email formats
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,

  // SSN (US): Standard AAA-GG-SSSS format
  SSN_US: /\b\d{3}-\d{2}-\d{4}\b/g,

  // Credit Card (Simple): 13-19 digits, optionally separated by dashes or spaces
  CREDIT_CARD: /\b(?:\d[ -]*?){13,19}\b/g,
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
  const applyRedaction = (pattern, placeholder) => {
    let count = 0;
    redactedText = redactedText.replace(pattern, (match) => {
      count++;
      return placeholder;
    });
    totalRedactions += count;
  };

  //Apply Patterns
  applyRedaction(PATTERNS.IPV4, "[REDACTED_IP]");
  applyRedaction(PATTERNS.EMAIL, "[REDACTED_EMAIL]");
  applyRedaction(PATTERNS.SSN_US, "[REDACTED_SSN]");
  // Simple CC check: replace with a generic tag to avoid leaking card length
  applyRedaction(PATTERNS.CREDIT_CARD, "[REDACTED_CREDIT_CARD]");

  // 3. Construct Response
  return c.json({
    success: true,
    result: redactedText,
    metadata: {
      original_length: text.length,
      redacted_length: redactedText.length,
      redactions_count: totalRedactions,
    },
  });
});

export default app;
