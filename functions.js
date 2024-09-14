
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

  module.exports = {
    shuffle,
    log
  }