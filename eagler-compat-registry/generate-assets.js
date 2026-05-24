import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Directory mappings
const registryDir = '/home/runner/workspace/eagler-compat-registry';

// Translation dictionaries matching TranslationHelper.ts exactly
const BLOCK_MAP = {
  "minecraft:netherite_block": { fallbackId: 49 },
  "minecraft:ancient_debris": { fallbackId: 49 },
  "minecraft:crying_obsidian": { fallbackId: 49 },
  "minecraft:respawn_anchor": { fallbackId: 49 },
  "minecraft:lodestone": { fallbackId: 98 },
  "minecraft:purpur_block": { fallbackId: 98 },
  "minecraft:purpur_pillar": { fallbackId: 98 },
  "minecraft:purpur_stairs": { fallbackId: 109 },
  "minecraft:purpur_slab": { fallbackId: 44, metadata: 5 },
  "minecraft:end_stone_bricks": { fallbackId: 121 },
  "minecraft:basalt": { fallbackId: 1 },
  "minecraft:polished_basalt": { fallbackId: 1 },
  "minecraft:blackstone": { fallbackId: 98 },
  "minecraft:copper_block": { fallbackId: 41 },
  "minecraft:exposed_copper": { fallbackId: 41 },
  "minecraft:weathered_copper": { fallbackId: 41 },
  "minecraft:oxidized_copper": { fallbackId: 41 },
  "minecraft:cut_copper": { fallbackId: 41 }
};

const ITEM_MAP = {
  "minecraft:netherite_sword": { fallbackId: 276, defaultName: "§5Netherite Sword" },
  "minecraft:netherite_shovel": { fallbackId: 277, defaultName: "§5Netherite Shovel" },
  "minecraft:netherite_pickaxe": { fallbackId: 278, defaultName: "§5Netherite Pickaxe" },
  "minecraft:netherite_axe": { fallbackId: 279, defaultName: "§5Netherite Axe" },
  "minecraft:netherite_hoe": { fallbackId: 293, defaultName: "§5Netherite Hoe" },
  "minecraft:netherite_helmet": { fallbackId: 310, defaultName: "§5Netherite Helmet" },
  "minecraft:netherite_chestplate": { fallbackId: 311, defaultName: "§5Netherite Chestplate" },
  "minecraft:netherite_leggings": { fallbackId: 312, defaultName: "§5Netherite Leggings" },
  "minecraft:netherite_boots": { fallbackId: 313, defaultName: "§5Netherite Boots" },
  "minecraft:netherite_ingot": { fallbackId: 266, defaultName: "§5Netherite Ingot" },
  "minecraft:netherite_scrap": { fallbackId: 336, defaultName: "§5Netherite Scrap" },
  "minecraft:totem_of_undying": { fallbackId: 322, metadata: 1, defaultName: "§6Totem of Undying" },
  "minecraft:elytra": { fallbackId: 307, defaultName: "§aElytra" }
};

// Programmatic pixel-art drawing canvas
function createCanvas() {
  const buf = Buffer.alloc(16 * 16 * 4); // 16x16 RGBA
  
  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
    const idx = (y * 16 + x) * 4;
    buf[idx] = r;
    buf[idx+1] = g;
    buf[idx+2] = b;
    buf[idx+3] = a;
  }
  
  function fill(r, g, b, a = 255) {
    for (let i = 0; i < 256; i++) {
      buf[i*4] = r;
      buf[i*4+1] = g;
      buf[i*4+2] = b;
      buf[i*4+3] = a;
    }
  }

  function addNoise(factor = 18) {
    for (let i = 0; i < 256; i++) {
      if (buf[i*4+3] === 0) continue;
      const noise = (Math.random() - 0.5) * factor;
      buf[i*4] = Math.min(255, Math.max(0, buf[i*4] + noise));
      buf[i*4+1] = Math.min(255, Math.max(0, buf[i*4+1] + noise));
      buf[i*4+2] = Math.min(255, Math.max(0, buf[i*4+2] + noise));
    }
  }

  function drawLine(x1, y1, x2, y2, r, g, b, a = 255) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1;
    let y = y1;

    while (true) {
      setPixel(x, y, r, g, b, a);
      if (x === x2 && y === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  function border(r, g, b, a = 255) {
    for (let i = 0; i < 16; i++) {
      setPixel(i, 0, r, g, b, a);
      setPixel(i, 15, r, g, b, a);
      setPixel(0, i, r, g, b, a);
      setPixel(15, i, r, g, b, a);
    }
  }

  async function toBase64() {
    const pngBuffer = await sharp(buf, {
      raw: {
        width: 16,
        height: 16,
        channels: 4
      }
    }).png().toBuffer();
    return `data:image/png;base64,${pngBuffer.toString('base64')}`;
  }

  return { buf, setPixel, fill, addNoise, drawLine, border, toBase64 };
}

// Procedural texture drawing routines
async function generateTexture(name) {
  const canvas = createCanvas();

  switch (name) {
    case "minecraft:netherite_block":
      canvas.fill(42, 38, 44);
      canvas.border(24, 20, 26);
      // Inner highlight border
      for (let i = 2; i < 14; i++) {
        canvas.setPixel(i, 2, 70, 65, 75);
        canvas.setPixel(i, 13, 70, 65, 75);
        canvas.setPixel(2, i, 70, 65, 75);
        canvas.setPixel(13, i, 70, 65, 75);
      }
      canvas.addNoise(25);
      break;

    case "minecraft:ancient_debris":
      canvas.fill(82, 60, 48);
      // Layered circular pattern
      canvas.drawLine(3, 3, 12, 3, 110, 85, 70);
      canvas.drawLine(12, 3, 12, 12, 110, 85, 70);
      canvas.drawLine(12, 12, 3, 12, 110, 85, 70);
      canvas.drawLine(3, 12, 3, 3, 110, 85, 70);
      canvas.addNoise(20);
      break;

    case "minecraft:crying_obsidian":
      canvas.fill(16, 8, 24);
      canvas.addNoise(15);
      // Glowing purple/cyan veins
      canvas.drawLine(2, 2, 13, 13, 138, 43, 226);
      canvas.drawLine(13, 2, 2, 13, 0, 191, 255);
      canvas.setPixel(7, 7, 255, 0, 255);
      break;

    case "minecraft:respawn_anchor":
      canvas.fill(24, 8, 36);
      canvas.border(154, 90, 20); // Gold borders
      // Amber core
      for (let y = 6; y <= 9; y++) {
        for (let x = 6; x <= 9; x++) {
          canvas.setPixel(x, y, 255, 140, 0);
        }
      }
      canvas.addNoise(12);
      break;

    case "minecraft:lodestone":
      canvas.fill(130, 130, 135);
      canvas.border(90, 90, 95);
      // Carved square runes
      canvas.drawLine(4, 4, 11, 4, 60, 60, 65);
      canvas.drawLine(4, 11, 11, 11, 60, 60, 65);
      canvas.drawLine(4, 4, 4, 11, 60, 60, 65);
      canvas.drawLine(11, 4, 11, 11, 60, 60, 65);
      canvas.addNoise(15);
      break;

    case "minecraft:purpur_block":
    case "minecraft:purpur_stairs":
    case "minecraft:purpur_slab":
      canvas.fill(170, 110, 170);
      canvas.border(135, 75, 135);
      canvas.addNoise(12);
      break;

    case "minecraft:purpur_pillar":
      canvas.fill(170, 110, 170);
      // Vertical pillars stripes
      for (let x = 3; x < 16; x += 4) {
        canvas.drawLine(x, 0, x, 15, 135, 75, 135);
      }
      canvas.addNoise(10);
      break;

    case "minecraft:end_stone_bricks":
      canvas.fill(235, 235, 180);
      // Bricks layout
      canvas.drawLine(0, 5, 15, 5, 200, 200, 140);
      canvas.drawLine(0, 10, 15, 10, 200, 200, 140);
      canvas.drawLine(4, 0, 4, 5, 200, 200, 140);
      canvas.drawLine(10, 5, 10, 10, 200, 200, 140);
      canvas.addNoise(14);
      break;

    case "minecraft:basalt":
      canvas.fill(80, 80, 85);
      // Parallel vertical lines
      canvas.drawLine(4, 0, 4, 15, 50, 50, 55);
      canvas.drawLine(11, 0, 11, 15, 50, 50, 55);
      canvas.addNoise(18);
      break;

    case "minecraft:polished_basalt":
      canvas.fill(100, 100, 105);
      canvas.border(70, 70, 75);
      canvas.addNoise(12);
      break;

    case "minecraft:blackstone":
      canvas.fill(30, 28, 34);
      canvas.border(15, 12, 18);
      canvas.addNoise(20);
      break;

    case "minecraft:copper_block":
    case "minecraft:cut_copper":
      canvas.fill(186, 110, 64);
      canvas.border(140, 75, 40);
      canvas.addNoise(15);
      break;

    case "minecraft:exposed_copper":
      canvas.fill(186, 110, 64);
      canvas.border(140, 75, 40);
      canvas.addNoise(15);
      // Green oxidation specs
      canvas.setPixel(3, 4, 75, 145, 120);
      canvas.setPixel(10, 11, 75, 145, 120);
      canvas.setPixel(12, 3, 75, 145, 120);
      break;

    case "minecraft:weathered_copper":
      canvas.fill(95, 140, 120);
      canvas.border(60, 105, 85);
      canvas.addNoise(15);
      // Copper specs
      canvas.setPixel(2, 6, 186, 110, 64);
      canvas.setPixel(11, 9, 186, 110, 64);
      break;

    case "minecraft:oxidized_copper":
      canvas.fill(75, 145, 120);
      canvas.border(50, 115, 90);
      canvas.addNoise(15);
      break;

    // --- Items ---
    case "minecraft:netherite_sword":
      // Stick / Handle
      canvas.drawLine(2, 13, 5, 10, 101, 67, 33);
      // Crossguard
      canvas.setPixel(5, 10, 140, 100, 20);
      canvas.setPixel(4, 9, 140, 100, 20);
      canvas.setPixel(6, 11, 140, 100, 20);
      // Blade
      canvas.drawLine(6, 9, 13, 2, 42, 38, 44);
      canvas.drawLine(7, 8, 14, 1, 60, 56, 62); // Blade highlight
      break;

    case "minecraft:netherite_shovel":
      canvas.drawLine(2, 13, 9, 6, 101, 67, 33); // Handle
      // Shovel head
      canvas.setPixel(9, 6, 42, 38, 44);
      canvas.setPixel(10, 5, 60, 56, 62);
      canvas.setPixel(11, 4, 42, 38, 44);
      canvas.setPixel(10, 3, 42, 38, 44);
      canvas.setPixel(9, 4, 42, 38, 44);
      break;

    case "minecraft:netherite_pickaxe":
      canvas.drawLine(2, 13, 9, 6, 101, 67, 33); // Handle
      // Pickaxe head arch
      canvas.drawLine(7, 4, 12, 2, 42, 38, 44);
      canvas.drawLine(10, 7, 12, 2, 42, 38, 44);
      canvas.setPixel(12, 2, 80, 76, 82); // Pickaxe tip highlight
      break;

    case "minecraft:netherite_axe":
      canvas.drawLine(2, 13, 9, 6, 101, 67, 33); // Handle
      // Axe head
      canvas.drawLine(8, 3, 11, 3, 42, 38, 44);
      canvas.drawLine(9, 4, 12, 4, 60, 56, 62);
      canvas.drawLine(8, 5, 10, 5, 42, 38, 44);
      break;

    case "minecraft:netherite_hoe":
      canvas.drawLine(2, 13, 9, 6, 101, 67, 33); // Handle
      // Hoe tip
      canvas.drawLine(9, 4, 12, 3, 42, 38, 44);
      canvas.setPixel(12, 3, 60, 56, 62);
      break;

    case "minecraft:netherite_helmet":
      // Helmet shape
      for (let x = 4; x <= 11; x++) {
        canvas.drawLine(x, 4, x, 10, 42, 38, 44);
      }
      // Eyes cutout/visor
      canvas.drawLine(5, 7, 10, 7, 0, 0, 0, 0);
      canvas.addNoise(20);
      break;

    case "minecraft:netherite_chestplate":
      // Chestplate shape
      for (let x = 3; x <= 12; x++) {
        canvas.drawLine(x, 4, x, 12, 42, 38, 44);
      }
      // Head cutout
      canvas.drawLine(6, 4, 9, 4, 0, 0, 0, 0);
      canvas.drawLine(7, 5, 8, 5, 0, 0, 0, 0);
      canvas.addNoise(20);
      break;

    case "minecraft:netherite_leggings":
      // Pants shape
      for (let x = 4; x <= 11; x++) {
        canvas.drawLine(x, 4, x, 12, 42, 38, 44);
      }
      // Middle leg split
      canvas.drawLine(7, 8, 8, 8, 0, 0, 0, 0);
      canvas.drawLine(7, 9, 8, 12, 0, 0, 0, 0);
      canvas.addNoise(20);
      break;

    case "minecraft:netherite_boots":
      // Boots
      for (let x = 3; x <= 6; x++) canvas.drawLine(x, 9, x, 12, 42, 38, 44);
      for (let x = 9; x <= 12; x++) canvas.drawLine(x, 9, x, 12, 42, 38, 44);
      canvas.addNoise(20);
      break;

    case "minecraft:netherite_ingot":
      // Diagonal ingot shape
      canvas.drawLine(3, 11, 11, 3, 42, 38, 44);
      canvas.drawLine(4, 12, 12, 4, 30, 26, 32);
      canvas.drawLine(2, 10, 10, 2, 60, 56, 62);
      break;

    case "minecraft:netherite_scrap":
      // Irregular dark scrap shape
      canvas.drawLine(4, 4, 9, 11, 82, 60, 48);
      canvas.drawLine(5, 3, 11, 9, 42, 38, 44);
      canvas.addNoise(15);
      break;

    case "minecraft:totem_of_undying":
      // Golden figure shape with emerald eyes
      canvas.drawLine(6, 3, 9, 3, 230, 170, 0);
      canvas.drawLine(5, 4, 10, 4, 230, 170, 0);
      canvas.drawLine(5, 5, 10, 5, 230, 170, 0);
      canvas.drawLine(4, 6, 11, 6, 230, 170, 0); // Arms spread
      canvas.drawLine(6, 7, 9, 12, 230, 170, 0);  // Body
      // Emerald eyes
      canvas.setPixel(6, 4, 0, 200, 50);
      canvas.setPixel(9, 4, 0, 200, 50);
      // Eyes highlight
      canvas.setPixel(5, 4, 255, 215, 0);
      canvas.setPixel(10, 4, 255, 215, 0);
      break;

    case "minecraft:elytra":
      // Angled wing lines (metallic wings)
      canvas.drawLine(3, 3, 6, 12, 160, 160, 170);
      canvas.drawLine(12, 3, 9, 12, 160, 160, 170);
      canvas.drawLine(4, 4, 7, 10, 120, 120, 130);
      canvas.drawLine(11, 4, 8, 10, 120, 120, 130);
      break;

    default:
      // Stone fallback grid
      canvas.fill(128, 128, 128);
      canvas.border(64, 64, 64);
      canvas.addNoise(20);
  }

  return await canvas.toBase64();
}

async function main() {
  console.log("Starting Eaglercraft Modern Compatibility Registry generation...");
  
  if (!fs.existsSync(registryDir)) {
    fs.mkdirSync(registryDir, { recursive: true });
    console.log(`Created workspace folder: ${registryDir}`);
  }

  const outputRegistry = {
    blocks: {},
    items: {}
  };

  // Compile blocks
  for (const blockName of Object.keys(BLOCK_MAP)) {
    console.log(`Generating texture for block: ${blockName}...`);
    const textureBase64 = await generateTexture(blockName);
    outputRegistry.blocks[blockName] = {
      fallbackId: BLOCK_MAP[blockName].fallbackId,
      texture: textureBase64
    };
  }

  // Compile items
  for (const itemName of Object.keys(ITEM_MAP)) {
    console.log(`Generating texture for item: ${itemName}...`);
    const textureBase64 = await generateTexture(itemName);
    outputRegistry.items[itemName] = {
      fallbackId: ITEM_MAP[itemName].fallbackId,
      defaultName: ITEM_MAP[itemName].defaultName,
      texture: textureBase64
    };
  }

  // Create code contents matching ES module layout
  const codeContent = `// Standalone frozen visual translation asset registry for EaglerProxy & Client Mod
// Generated on ${new Date().toISOString()}

export const ModernDataRegistry = ${JSON.stringify(outputRegistry, null, 2)};
`;

  const destFile = path.join(registryDir, 'ModernDataRegistry.js');
  fs.writeFileSync(destFile, codeContent, 'utf8');
  console.log(`\nSuccessfully compiled final artifact: ${destFile}`);
}

main().catch(err => {
  console.error("Fatal error during registry compilation:", err);
  process.exit(1);
});
