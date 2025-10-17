import { firstKFulfilled } from "./firstk.js";
import { compareVersion } from "./functions.js";

function strategyFirst(arr) {
  return arr[0];
}

function strategyRandom(arr) {
  const index = Math.floor(Math.random() * arr.length);
  return arr[index];
}

function strategyMaxJussiNumber(arr) {
  return arr.reduce((max, current) =>
    current.jussi_number > max.jussi_number ? current : max,
  );
}

function strategyLatestVersion(arr) {
  return arr.reduce((latest, current) =>
    compareVersion(current.version, latest.version) > 0 ? current : latest,
  );
}

// strategy is a function that takes the array of fulfilled results and returns the chosen one
async function chooseNode(promises, k, strategy) {
  const fulfilled = await firstKFulfilled(promises, k);
  return {
    "selected": strategy(fulfilled),
    "candidates": fulfilled,
  };
}

function getStrategyByName(name) {
  switch (name) {
    case "first":
      return strategyFirst;
    case "random":
      return strategyRandom;
    case "max_jussi_number":
      return strategyMaxJussiNumber;
    case "latest_version":
      return strategyLatestVersion;
    default:
      throw new Error(`Unknown strategy name: ${name}`);
  }
}

export {
  chooseNode,
  getStrategyByName,
  strategyFirst,
  strategyRandom,
  strategyMaxJussiNumber,
  strategyLatestVersion,
};
