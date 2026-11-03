// Loads the game's logic modules (no DOM) into globalThis.GK for Node tests.
const path = require('path');
for (const f of ['version', 'core', 'data', 'content', 'payoffs', 'physics', 'scoring', 'meta', 'run', 'frame', 'surprises', 'progress', 'endless', 'content2']) require(path.join(__dirname, '..', 'game', 'js', f + '.js'));
module.exports = globalThis.GK;
