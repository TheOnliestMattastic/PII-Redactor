#!/bin/bash

# =============================================================================
# PII REDACTOR TEST SUITE
# =============================================================================
# WHAT: Validates the /redact endpoint for accuracy, edge cases, and security
# WHY:  Ensures regex priorities are correct and no PII leaks through
# HOW:  POSTs to localhost:8787/redact and verifies JSON output matches expectations
# =============================================================================

set -e

BASE_URL="http://localhost:8787"
PASSED=0
FAILED=0
TOTAL=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =============================================================================
# TEST HELPER FUNCTIONS
# =============================================================================

test_redaction() {
  local name="$1"
  local input_text="$2"
  local expected_substr="$3" # A string that MUST exist in the result

  TOTAL=$((TOTAL + 1))

  # Construct JSON safely
  json_payload=$(jq -n --arg txt "$input_text" '{text: $txt}')

  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/redact" \
    -H "Content-Type: application/json" \
    -d "$json_payload")

  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  result_text=$(echo "$body" | jq -r '.result' 2>/dev/null)

  # Check if status is 200 AND result contains the expected redacted tag
  if [ "$status" = "200" ] && [[ "$result_text" == *"$expected_substr"* ]]; then
    echo -e "${GREEN}✓ PASS${NC}: $name"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $name"
    echo "  Expected HTTP 200 containing: '$expected_substr'"
    echo "  Got HTTP $status: $result_text"
    FAILED=$((FAILED + 1))
  fi
}

test_error() {
  local name="$1"
  local payload="$2"
  local expected_code="$3"
  local expected_status="${4:-400}"

  TOTAL=$((TOTAL + 1))

  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/redact" \
    -H "Content-Type: application/json" \
    -d "$payload")

  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  code=$(echo "$body" | jq -r '.code' 2>/dev/null)

  if [ "$status" = "$expected_status" ] && [ "$code" = "$expected_code" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $name (Code: $expected_code)"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $name"
    echo "  Expected $expected_status/$expected_code"
    echo "  Got $status/$code"
    FAILED=$((FAILED + 1))
  fi
}

# =============================================================================
# SECTION 1: BASIC PATTERN MATCHING
# =============================================================================
echo -e "${YELLOW}=== 1. Basic Patterns ===${NC}"

test_redaction "IPv4 Redaction" \
  "Server is at 192.168.1.55 connected." \
  "[REDACTED_IPV4]"

test_redaction "Email Redaction" \
  "Contact admin@example.com for support." \
  "[REDACTED_EMAIL]"

test_redaction "SSN Redaction" \
  "User ID: 123-45-6789 verified." \
  "[REDACTED_SSN_US]"

test_redaction "Credit Card (Luhn Valid)" \
  "Card: 4231 9001 6469 0061 expires 10/25" \
  "[REDACTED_CREDIT_CARD]"

# =============================================================================
# SECTION 2: ORDER OF OPERATIONS (CRITICAL)
# =============================================================================
echo -e "\n${YELLOW}=== 2. Regex Priority Checks ===${NC}"

# If Credit Card runs before SSN, it might eat the SSN.
test_redaction "SSN vs Credit Card Priority" \
  "My SSN is 123-45-6789." \
  "[REDACTED_SSN_US]"

# If Credit Card runs before Phone, it matches 10 digits easily.
test_redaction "Phone vs Credit Card Priority" \
  "Call me at 555-019-2834." \
  "[REDACTED_PHONE_US]"

# =============================================================================
# SECTION 3: ERROR HANDLING
# =============================================================================
echo -e "\n${YELLOW}=== 3. Error Handling ===${NC}"

test_error "Missing Body" "{\"\"}" "INVALID_BODY" 400
test_error "Missing Text Field" '{"other": "value"}' "INVALID_INPUT" 400
test_error "Text is not String" '{"text": 12345}' "INVALID_INPUT" 400
test_error "Malformed JSON" '{invalid-json' "INVALID_BODY" 400

# =============================================================================
# SECTION 4: LUHN ALGORITHM CHECK
# =============================================================================
echo -e "\n${YELLOW}=== 4. Luhn Validation Logic ===${NC}"

# A random sequence of 16 digits that FAILS Luhn check should NOT be redacted
# 4532 0151 1283 0360 (Last digit changed to invalid checksum 0)
TOTAL=$((TOTAL + 1))
input="Invalid Card: 4532 0151 1283 0360"
response=$(curl -s -X POST "$BASE_URL/redact" -H "Content-Type: application/json" -d "{\"text\": \"$input\"}")
result=$(echo "$response" | jq -r '.result')

if [[ "$result" == *"4532 0151 1283 0360"* ]]; then
  echo -e "${GREEN}✓ PASS${NC}: Invalid Luhn number was NOT redacted (Correct behavior)"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC}: Invalid Luhn number WAS redacted (False Positive)"
  echo "Result: $result"
  FAILED=$((FAILED + 1))
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo -e "\n${YELLOW}=== SUMMARY ===${NC}"
echo "Total:  $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
  exit 0
else
  exit 1
fi
