// Test data (non-real PII, but realistic formats)
const testCases = {
  ipv4: [
    { input: "Server at 192.168.1.1 is down", expected_count: 1 },
    { input: "Invalid IP 999.999.999.999", expected_count: 0 }, // Should NOT match
    { input: "Multiple IPs: 10.0.0.1 and 172.16.0.1", expected_count: 2 },
  ],
  email: [
    { input: "Contact user@example.com", expected_count: 1 },
    { input: "user..name@domain.com should not match", expected_count: 0 }, // Malformed
    { input: "Email: john.doe+tag@company.co.uk", expected_count: 1 },
  ],
  ssn: [
    { input: "SSN 123-45-6789", expected_count: 1 },
    { input: "Invalid SSN 000-00-0000", expected_count: 0 },
  ],
  credit_card: [
    { input: "Card 4532-1234-5678-9010", expected_count: 1 },
    { input: "Order number 1234567890123 is different", expected_count: 0 }, // Should fail Luhn
  ],
  phone_us: [
    { input: "Phone num (555) 123-4567", expected_count: 1 },
    {
      input: "Multiple phone num w/variations 555-123-4567 and +1-555-123-4567",
      expected_count: 2,
    },
    {
      input: "Not phone num (555) 123456 and +1-555-123-45678",
      expected_count: 0,
    },
  ],
};

// Test function
const runTests = () => {
  let passed = 0,
    failed = 0;

  for (const [type, cases] of Object.entries(testCases)) {
    cases.forEach(({ input, expected_count }) => {
      const pattern = PATTERNS[type.toUpperCase().replace("_", "")];
      const actual_count = (input.match(pattern) || []).length;

      if (actual_count === expected_count) {
        console.log(
          `✓ ${type}: "${input.substring(0, 30)}"... [${actual_count}]`,
        );
        passed++;
      } else {
        console.error(
          `✗ ${type}: Expected ${expected_count}, got ${actual_count} for "${input}"`,
        );
        failed++;
      }
    });
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
};
