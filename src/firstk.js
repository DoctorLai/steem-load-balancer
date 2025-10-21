async function firstKFulfilled(promises, k) {
  return new Promise((resolve) => {
    const fulfilled = [];
    let settledCount = 0;
    const total = promises.length;
    const startTimes = new Map();

    if (k <= 0) return resolve([]);
    if (total === 0) return resolve([]);

    promises.forEach((p, index) => {
      const start = performance.now();
      startTimes.set(index, start);

      Promise.resolve(p)
        .then((value) => {
          const latency = performance.now() - start;
          fulfilled.push({ value, latency });
          if (fulfilled.length === k) {
            // Sort the first k by latency before resolving
            const sorted = fulfilled
              .sort((a, b) => a.latency - b.latency)
              .map((x) => x.value);
            resolve(sorted);
          }
        })
        .catch(() => {})
        .finally(() => {
          settledCount++;
          if (settledCount === total && fulfilled.length < k) {
            // Fewer than k succeeded; still return sorted
            const sorted = fulfilled
              .sort((a, b) => a.latency - b.latency)
              .map((x) => x.value);
            resolve(sorted);
          }
        });
    });
  });
}

function delay(value, ms, shouldReject = false) {
  return new Promise((resolve, reject) =>
    setTimeout(() => (shouldReject ? reject(value) : resolve(value)), ms),
  );
}

export { firstKFulfilled, delay };
