
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
    const v1 = version1.split('.').map(Number);
    const v2 = version2.split('.').map(Number);

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

  module.exports = {
    shuffle,
    log,
    compareVersion
  }