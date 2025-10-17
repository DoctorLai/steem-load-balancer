async function firstKFulfilled(promises, k) {
  return new Promise((resolve) => {
    const fulfilled = [];
    let settledCount = 0;
    const total = promises.length;

    if (k <= 0) {
      return resolve([]);
    }
    if (total === 0) {
      return resolve([]);
    }

    promises.forEach((p) => {
      Promise.resolve(p)
        .then((value) => {
          fulfilled.push(value);
          if (fulfilled.length === k) {
            resolve(fulfilled); // early resolve once k succeeded
          }
        })
        .catch(() => {})
        .finally(() => {
          settledCount++;
          // if everything has settled and we never reached k
          if (settledCount === total && fulfilled.length < k) {
            resolve(fulfilled);
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
