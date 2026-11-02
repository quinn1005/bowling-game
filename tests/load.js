// Loads the game's logic modules (no DOM) into globalThis.GK for Node tests.
const path = require('path');
for (const f of ['version', 'core', 'data', 'content', 'physics', 'scoring', 'meta', 'run', 'frame']) require(path.join(__dirname, '..', 'game', 'js', f + '.js'));
module.exports = globalThis.GK;
