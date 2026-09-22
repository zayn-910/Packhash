// merkle.js - Simple Merkle tree implementation using SHA-256
const crypto = require("crypto");

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// Combine two hashes into a parent hash (sorted, so order of pairing doesn't matter)
function hashPair(a, b) {
  const combined = [a, b].sort().join("");
  return sha256(combined);
}

// Build the full tree, level by level, starting from leaf hashes
// Returns an array of levels: levels[0] = leaves, levels[last] = [root]
function buildTree(leafHashes) {
  let currentLevel = leafHashes.slice(); // copy
  const levels = [currentLevel];

  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        nextLevel.push(hashPair(currentLevel[i], currentLevel[i + 1]));
      } else {
        // Odd one out — carry it up unchanged
        nextLevel.push(currentLevel[i]);
      }
    }
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  return levels;
}

function getRoot(leafHashes) {
  if (leafHashes.length === 0) return null;
  const levels = buildTree(leafHashes);
  return levels[levels.length - 1][0];
}

module.exports = { sha256, hashPair, buildTree, getRoot };
