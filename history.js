/**
 * GX 444 — History Manager
 * Persists demo results in localStorage, displays latest 100 records,
 * supports search, BIG/SMALL filters, and safe CSV export.
 */
(function (global) {
  "use strict";

  const GX444 = (global.GX444 = global.GX444 || {});

  const STORAGE_KEY = "gx444_demo_history_v1";
  const MAX_STORED_RECORDS = 500;
  const DISPLAY_LIMIT = 100;

  let records = [];

  function load() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        records = [];
        return records;
      }
      const parsed = JSON.parse(raw);
      records = Array.isArray(parsed) ? parsed.filter(isValidRecord) : [];
    } catch (err) {
      console.error("GX 444: Failed to load history from localStorage.", err);
      records = [];
    }
    return records;
  }

  function isValidRecord(item) {
    return (
      item &&
      typeof item.number === "number" &&
      item.number >= 0 &&
      item.number <= 9 &&
      (item.classification === "BIG" || item.classification === "SMALL") &&
      typeof item.timestamp === "string"
    );
  }

  function save() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (err) {
      console.error("GX 444: Failed to save history to localStorage.", err);
    }
  }

  function add(record) {
    if (!isValidRecord(record)) return;
    records.unshift(record);
    if (records.length > MAX_STORED_RECORDS) {
      records = records.slice(0, MAX_STORED_RECORDS);
    }
    save();
  }

  function getAll() {
    return records.slice();
  }

  function getLatest(limit = DISPLAY_LIMIT) {
    return records.slice(0, limit);
  }

  function filter({ query = "", type = "ALL" } = {}) {
    const q = String(query).trim().toLowerCase();
    const latest = getLatest(DISPLAY_LIMIT);

    return latest.filter((item) => {
      const matchesType = type === "ALL" || item.classification === type;
      if (!matchesType) return false;
      if (!q) return true;

      return (
        String(item.number).includes(q) ||
        item.classification.toLowerCase().includes(q) ||
        item.timestamp.toLowerCase().includes(q)
      );
    });
  }

  function clear() {
    records = [];
    try {
      global.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("GX 444: Failed to clear history from localStorage.", err);
    }
  }

  function escapeCsvCell(value) {
    const str = String(value ?? "");
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function exportCSV() {
    const dataset = getLatest(DISPLAY_LIMIT);
    if (dataset.length === 0) {
      return { ok: false, reason: "EMPTY" };
    }

    const header = ["Index", "Number", "Classification", "Timestamp", "ISO_Timestamp", "Source"];
    const rows = dataset.map((item, idx) => [
      idx + 1,
      item.number,
      item.classification,
      item.timestamp,
      item.isoTimestamp || "",
      "GX_444_DEMO_RNG"
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

    link.href = url;
    link.download = `gx444-demo-history-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, count: dataset.length };
  }

  load();

  GX444.History = {
    DISPLAY_LIMIT,
    load,
    add,
    getAll,
    getLatest,
    filter,
    clear,
    exportCSV
  };
})(window);