import { AbortController } from "abort-controller";
const fetch = (...args) =>
  import("node-fetch").then((module) => module.default(...args));

// Shuffle function
function shuffle(array) {
  let currentIndex = array.length;
  let temporaryValue, randomIndex;
  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

function log(...messages) {
  // Get the current timestamp
  const timestamp = new Date().toISOString();

  // Format the messages with the timestamp
  console.log(`[${timestamp}]`, ...messages);
}

function compareVersion(version1, version2) {
  const v1 = version1.split(".").map(Number);
  const v2 = version2.split(".").map(Number);

  const len = Math.max(v1.length, v2.length);

  for (let i = 0; i < len; i++) {
    const num1 = v1[i] || 0; // Treat missing parts as 0
    const num2 = v2[i] || 0;

    if (num1 > num2) {
      return 1;
    } else if (num1 < num2) {
      return -1;
    }
  }

  return 0; // Versions are equal
}

function limitStringMaxLength(s, len) {
  if (s.length <= len) {
    return s;
  }
  return s.slice(0, len) + "...";
}

function secondsToTimeDict(seconds) {
  const timeDict = {};

  // Define time unit conversions
  const SECONDS_IN_MINUTE = 60;
  const SECONDS_IN_HOUR = 3600;
  const SECONDS_IN_DAY = 86400;
  const SECONDS_IN_MONTH = 2592000; // 30 days
  const SECONDS_IN_YEAR = 31536000; // 365 days

  // Calculate each time unit
  timeDict.years = Math.floor(seconds / SECONDS_IN_YEAR);
  seconds %= SECONDS_IN_YEAR;

  timeDict.months = Math.floor(seconds / SECONDS_IN_MONTH);
  seconds %= SECONDS_IN_MONTH;

  timeDict.days = Math.floor(seconds / SECONDS_IN_DAY);
  seconds %= SECONDS_IN_DAY;

  timeDict.hours = Math.floor(seconds / SECONDS_IN_HOUR);
  seconds %= SECONDS_IN_HOUR;

  timeDict.minutes = Math.floor(seconds / SECONDS_IN_MINUTE);
  timeDict.seconds = seconds % SECONDS_IN_MINUTE;

  return timeDict;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isObjectEmptyOrNullOrUndefined(obj) {
  return (
    obj == null || (typeof obj === "object" && Object.keys(obj).length === 0)
  );
}

async function fetchWithTimeout(url, options = {}, timeout = 3000) {
  const controller = new AbortController();
  const signal = controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId); // Clear timeout if request completes successfully
    return response;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Fetch request to ${url} timed out after ${timeout} ms`);
    }
    throw error;
  }
}

async function firstKFulfilled(promises, k) {
  return new Promise((resolve) => {
    const fulfilled = [];
    let settledCount = 0;
    const total = promises.length;

    if (k <= 0) return resolve([]);
    if (total === 0) return resolve([]);

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

export {
  shuffle,
  log,
  compareVersion,
  limitStringMaxLength,
  secondsToTimeDict,
  sleep,
  isObjectEmptyOrNullOrUndefined,
  fetchWithTimeout,
  firstKFulfilled,
  delay,
};
