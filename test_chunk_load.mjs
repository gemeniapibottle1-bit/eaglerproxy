import pmRegistry from 'prismarine-registry';
import pmChunk from 'prismarine-chunk';

const registry = pmRegistry('1.8');
const Chunk = pmChunk(registry);
const chunk = new Chunk();

console.log('load 1.8 signature:', Chunk.prototype.load.toString());
console.log('dump 1.8 signature:', Chunk.prototype.dump.toString());
