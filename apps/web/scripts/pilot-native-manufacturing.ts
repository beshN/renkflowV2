// The aggregate-only 012 pilot cannot represent physical profile lots.
// Stop before any write; the isolated production pilot exercises the current platform.
console.error('012 üretim pilotu arşivlendi. Fiziksel profil, mal kabul ve kalite akışını ayrı test veritabanında doğrulamak için npm run test:production kullanın. Rehber: docs/production-platform.md');
process.exitCode = 1;
