import { ModernDataRegistry } from '../eagler-compat-registry/ModernDataRegistry.js';

console.log("Starting asset verification test...");

function checkPngBase64(name, dataUri) {
  if (!dataUri.startsWith('data:image/png;base64,')) {
    throw new Error(`${name} does not start with correct Data URI prefix!`);
  }
  const base64Data = dataUri.substring('data:image/png;base64,'.length);
  const buffer = Buffer.from(base64Data, 'base64');
  
  // PNG signature is 89 50 4E 47 0D 0A 1A 0A
  const isPng = buffer[0] === 0x89 &&
                buffer[1] === 0x50 &&
                buffer[2] === 0x4E &&
                buffer[3] === 0x47 &&
                buffer[4] === 0x0D &&
                buffer[5] === 0x0A &&
                buffer[6] === 0x1A &&
                buffer[7] === 0x0A;
  
  if (!isPng) {
    throw new Error(`${name} is not a valid PNG buffer!`);
  }
  
  console.log(`✓ Verified ${name} (Buffer length: ${buffer.length} bytes)`);
}

// Check some sample blocks
checkPngBase64('netherite_block', ModernDataRegistry.blocks['minecraft:netherite_block'].texture);
checkPngBase64('oxidized_copper', ModernDataRegistry.blocks['minecraft:oxidized_copper'].texture);

// Check some sample items
checkPngBase64('netherite_sword', ModernDataRegistry.items['minecraft:netherite_sword'].texture);
checkPngBase64('totem_of_undying', ModernDataRegistry.items['minecraft:totem_of_undying'].texture);

console.log("\nAll tested PNGs are 100% valid and verified successfully!");
