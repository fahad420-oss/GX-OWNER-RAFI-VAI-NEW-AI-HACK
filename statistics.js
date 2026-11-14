/**
 * GX 444 — Statistical Analysis Engine
 * Computes real metrics strictly from stored demo results.
 */
(function (global) {
  "use strict";

  const GX444 = (global.GX444 = global.GX444 || {});

  function calculate(records) {
    const list = Array.isArray(records) ? records : [];
    const total = list.length;

    let bigCount = 0;
    let smallCount = 0;
    const numberCounts = new Array(10).fill(0);

    for (let i = 0; i < total; i += 1) {
      const rec = list[i];
      if (rec.classification === "BIG") {
        bigCount += 1;
      } else if (rec.classification === "SMALL") {
        smallCount += 1;
      }
      if (rec.number >= 0 && rec.number <= 9) {
        numberCounts[rec.number] += 1;
      }
    }

    const bigPct = total > 0 ? Math.round((bigCount / total) * 100) : 0;
    const smallPct = total > 0 ? Math.round((smallCount / total) * 100) : 0;
    const maxNumberCount = Math.max(1, ...numberCounts);

    // Recent 10 & Recent 50 (records are stored newest-first)
    const recent10 = list.slice(0, 10);
    const recent50 = list.slice(0, 50);

    let r50Big = 0;
    let r50Small = 0;
    for (let i = 0; i < recent50.length; i += 1) {
      if (recent50[i].classification === "BIG") r50Big += 1;
      else r50Small += 1;
    }

    const r50Total = recent50.length;
    const r50BigPct = r50Total > 0 ? Math.round((r50Big / r50Total) * 100) : 0;
    const r50SmallPct = r50Total > 0 ? Math.round((r50Small / r50Total) * 100) : 0;

    // Longest streaks (chronological order: oldest -> newest)
    let longestBigStreak = 0;
    let longestSmallStreak = 0;
    let runningType = null;
    let runningCount = 0;

    for (let i = total - 1; i >= 0; i -= 1) {
      const cls = list[i].classification;
      if (cls === runningType) {
        runningCount += 1;
      } else {
        runningType = cls;
        runningCount = 1;
      }

      if (cls === "BIG" && runningCount > longestBigStreak) {
        longestBigStreak = runningCount;
      } else if (cls === "SMALL" && runningCount > longestSmallStreak) {
        longestSmallStreak = runningCount;
      }
    }

    const currentStreak =
      total > 0
        ? { type: runningType, count: runningCount }
        : { type: null, count: 0 };

    return {
      total,
      bigCount,
      smallCount,
      bigPct,
      smallPct,
      numberCounts,
      maxNumberCount,
      recent10,
      recent50: {
        total: r50Total,
        bigCount: r50Big,
        smallCount: r50Small,
        bigPct: r50BigPct,
        smallPct: r50SmallPct
      },
      longestBigStreak,
      longestSmallStreak,
      currentStreak
    };
  }

  GX444.Statistics = {
    calculate
  };
})(window);