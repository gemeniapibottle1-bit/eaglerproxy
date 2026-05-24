import mcData from 'minecraft-data';

const data18 = mcData('1.8.9');
const data20 = mcData('1.20.4');

console.log("=== 1.8.9 Slot Type ===");
console.log(JSON.stringify(data18.protocol.types.slot, null, 2));

console.log("\n=== 1.20.4 Slot Type ===");
console.log(JSON.stringify(data20.protocol.types.slot, null, 2));
