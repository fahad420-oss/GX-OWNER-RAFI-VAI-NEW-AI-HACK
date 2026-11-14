/**
 * GX 444 — Random Number Engine
 * Transparent educational RNG using Web Crypto API (crypto.getRandomValues).
 * No Period IDs, no external prediction APIs, no hardcoded sequences.
 */
(function (global) {
  "use strict";

  const GX444 = (global.GX444 = global.GX444 || {});

  const RANGE = 10; // Digits 0–9
  // Largest multiple of 10 within 2^32 to prevent modulo bias via rejection sampling.
  const MAX_UNBIASED_UINT32 = Math.floor(0x100000000 / RANGE) * RANGE;

  function isCryptoAvailable() {
    return Boolean(global.crypto && typeof global.crypto.getRandomValues === "function");
  }

  function generateDigit() {
    if (!isCryptoAvailable()) {
      throw new Error("Web Crypto API (crypto.getRandomValues) is unavailable in this browser.");
    }

    const buffer = new Uint32Array(1);
    let value = 0;

    do {
      global.crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= MAX_UNBIASED_UINT32);

    return value % RANGE;
  }

  function classify(digit) {
    return digit >= 5 ? "BIG" : "SMALL";
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function generateDemoResult() {
    const now = new Date();
    const number = generateDigit();
    const classification = classify(number);

    return {
      id: `${now.getTime()}-${Math.floor(Math.random() * 1e6)}`,
      number,
      classification,
      timestamp: formatTime(now),
      dateTime: now.toLocaleString(),
      isoTimestamp: now.toISOString(),
      isDemo: true
    };
  }

  GX444.RandomEngine = {
    isCryptoAvailable,
    classify,
    generateDemoResult
  };
})(window);