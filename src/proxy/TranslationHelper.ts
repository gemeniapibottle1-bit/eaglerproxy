import pmRegistry from "prismarine-registry";
import pmChunk from "prismarine-chunk";
import vec3 from "vec3";

const { Vec3 } = vec3 as any;

const registry18 = pmRegistry("1.8");
const Chunk18 = pmChunk(registry18);

const COLORS = [
  "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"
];

const WOOD_TYPES = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak"];

const BLOCK_FALLBACKS: Record<string, { id: number; metadata: number }> = {
  "netherite_block": { id: 49, metadata: 0 },
  "ancient_debris": { id: 49, metadata: 0 },
  "crying_obsidian": { id: 49, metadata: 0 },
  "respawn_anchor": { id: 49, metadata: 0 },
  "lodestone": { id: 98, metadata: 0 },
  "purpur_block": { id: 98, metadata: 0 },
  "purpur_pillar": { id: 98, metadata: 0 },
  "purpur_stairs": { id: 109, metadata: 0 },
  "purpur_slab": { id: 44, metadata: 5 },
  "end_stone_bricks": { id: 121, metadata: 0 },
  "basalt": { id: 1, metadata: 5 },
  "polished_basalt": { id: 1, metadata: 6 },
  "blackstone": { id: 98, metadata: 0 },
  "copper_block": { id: 41, metadata: 0 },
  "exposed_copper": { id: 41, metadata: 0 },
  "weathered_copper": { id: 41, metadata: 0 },
  "oxidized_copper": { id: 41, metadata: 0 },
  "cut_copper": { id: 41, metadata: 0 }
};

const ITEM_FALLBACKS: Record<string, { id: number; metadata: number; displayName: string }> = {
  "netherite_sword": { id: 276, metadata: 0, displayName: "§5Netherite Sword" },
  "netherite_shovel": { id: 277, metadata: 0, displayName: "§5Netherite Shovel" },
  "netherite_pickaxe": { id: 278, metadata: 0, displayName: "§5Netherite Pickaxe" },
  "netherite_axe": { id: 279, metadata: 0, displayName: "§5Netherite Axe" },
  "netherite_hoe": { id: 293, metadata: 0, displayName: "§5Netherite Hoe" },
  "netherite_helmet": { id: 310, metadata: 0, displayName: "§5Netherite Helmet" },
  "netherite_chestplate": { id: 311, metadata: 0, displayName: "§5Netherite Chestplate" },
  "netherite_leggings": { id: 312, metadata: 0, displayName: "§5Netherite Leggings" },
  "netherite_boots": { id: 313, metadata: 0, displayName: "§5Netherite Boots" },
  "netherite_ingot": { id: 266, metadata: 0, displayName: "§5Netherite Ingot" },
  "netherite_scrap": { id: 336, metadata: 0, displayName: "§5Netherite Scrap" },
  "totem_of_undying": { id: 322, metadata: 1, displayName: "§6Totem of Undying" },
  "elytra": { id: 307, metadata: 0, displayName: "§aElytra" }
};

export class TranslationHelper {
  public registryServer: any;
  public registryClient: any;
  public ChunkServerClass: any;
  public ChunkClientClass: any;
  public minY: number = 0;
  public worldHeight: number = 256;

  constructor(serverVersion: string) {
    try {
      this.registryServer = pmRegistry(serverVersion);
    } catch (e) {
      this.registryServer = pmRegistry("1.20.4");
    }
    this.registryClient = registry18;
    this.ChunkServerClass = pmChunk(this.registryServer);
    this.ChunkClientClass = Chunk18;

    const versionStr = this.registryServer.version.version;
    const majorVersion = this.registryServer.version.majorVersion;
    if (majorVersion >= 18 || (versionStr && parseFloat(versionStr) >= 1.18)) {
      this.minY = -64;
      this.worldHeight = 384;
    } else {
      this.minY = 0;
      this.worldHeight = 256;
    }
  }

  // Translates a modern block state ID to a 1.8 block state ID.
  // Returns the 1.8 block ID, metadata, block name, and whether it was rewritten as a modern fallback.
  public translateBlock(stateId: number): { id: number; metadata: number; name: string; wasRewritten: boolean } {
    const block = this.registryServer.blocksByStateId[stateId];
    if (!block) {
      return { id: 0, metadata: 0, name: "minecraft:air", wasRewritten: false };
    }

    let name = block.name;
    const trueBlockId = name.startsWith("minecraft:") ? name : `minecraft:${name}`;
    name = name.startsWith("minecraft:") ? name.substring(10) : name;

    // 1. Direct fallback map
    if (BLOCK_FALLBACKS[name]) {
      const fb = BLOCK_FALLBACKS[name];
      return { id: fb.id, metadata: fb.metadata, name: trueBlockId, wasRewritten: true };
    }

    // 2. Colored blocks mapping
    for (const color of COLORS) {
      if (name.startsWith(color + "_")) {
        const baseType = name.substring(color.length + 1);
        const colorIdx = COLORS.indexOf(color);
        if (baseType === "wool") {
          return { id: 35, metadata: colorIdx, name: trueBlockId, wasRewritten: false };
        } else if (baseType === "carpet") {
          return { id: 171, metadata: colorIdx, name: trueBlockId, wasRewritten: false };
        } else if (baseType === "stained_glass") {
          return { id: 95, metadata: colorIdx, name: trueBlockId, wasRewritten: false };
        } else if (baseType === "stained_glass_pane") {
          return { id: 160, metadata: colorIdx, name: trueBlockId, wasRewritten: false };
        } else if (baseType === "terracotta" || baseType === "glazed_terracotta" || baseType === "concrete" || baseType === "concrete_powder") {
          return { id: 159, metadata: colorIdx, name: trueBlockId, wasRewritten: baseType === "concrete" || baseType === "concrete_powder" };
        }
      }
    }

    // 3. Wood types mapping
    for (const type of WOOD_TYPES) {
      if (name.startsWith(type + "_")) {
        const baseType = name.substring(type.length + 1);
        const woodIdx = WOOD_TYPES.indexOf(type);
        if (baseType === "planks") {
          return { id: 5, metadata: woodIdx, name: trueBlockId, wasRewritten: false };
        } else if (baseType === "sapling") {
          return { id: 6, metadata: woodIdx, name: trueBlockId, wasRewritten: false };
        } else if (baseType === "log" || baseType === "wood") {
          if (woodIdx < 4) {
            return { id: 17, metadata: woodIdx, name: trueBlockId, wasRewritten: false };
          } else {
            return { id: 162, metadata: woodIdx - 4, name: trueBlockId, wasRewritten: false };
          }
        } else if (baseType === "leaves") {
          if (woodIdx < 4) {
            return { id: 18, metadata: woodIdx, name: trueBlockId, wasRewritten: false };
          } else {
            return { id: 161, metadata: woodIdx - 4, name: trueBlockId, wasRewritten: false };
          }
        } else if (baseType === "door") {
          return { id: 64, metadata: 0, name: trueBlockId, wasRewritten: false };
        } else if (baseType === "fence") {
          return { id: 85, metadata: 0, name: trueBlockId, wasRewritten: false };
        } else if (baseType === "fence_gate") {
          return { id: 107, metadata: 0, name: trueBlockId, wasRewritten: false };
        } else if (baseType === "stairs") {
          return { id: 53, metadata: 0, name: trueBlockId, wasRewritten: false };
        } else if (baseType === "slab") {
          return { id: 126, metadata: 0, name: trueBlockId, wasRewritten: false };
        }
      }
    }

    // 4. Try standard 1.8 block name lookup
    const clientBlock = this.registryClient.blocksByName[name];
    if (clientBlock) {
      return { id: clientBlock.id, metadata: 0, name: trueBlockId, wasRewritten: false };
    }

    // 5. Fallback for unknown block
    return { id: 1, metadata: 0, name: trueBlockId, wasRewritten: true }; // Stone
  }

  // Translates a modern item packet structure to 1.8.9 slot item structure.
  // Sets wasRewritten, trueItemId, fallbackId, and displayName if it was rewritten.
  public translateItem(item: any): { item18: any; wasRewritten: boolean; trueItemId?: string; fallbackId?: number; displayName?: string } {
    if (!item || item.present === false || item.itemId === undefined || item.itemId === null || item.itemId === -1) {
      return { item18: { blockId: -1 }, wasRewritten: false };
    }

    const itemObj = this.registryServer.items[item.itemId];
    if (!itemObj) {
      return { item18: { blockId: -1 }, wasRewritten: false };
    }

    let name = itemObj.name;
    const trueItemId = name.startsWith("minecraft:") ? name : `minecraft:${name}`;
    name = name.startsWith("minecraft:") ? name.substring(10) : name;

    // Check direct item fallback map
    if (ITEM_FALLBACKS[name]) {
      const fb = ITEM_FALLBACKS[name];
      const newItem = {
        blockId: fb.id,
        itemCount: item.itemCount,
        itemDamage: fb.metadata,
        nbtData: item.nbtData ? JSON.parse(JSON.stringify(item.nbtData)) : undefined
      };
      
      // Inject display name and trueItemId into NBT to make tooltip and client mod look correct
      if (!newItem.nbtData) {
        newItem.nbtData = { type: "compound", name: "", value: {} };
      }
      if (!newItem.nbtData.value.display) {
        newItem.nbtData.value.display = { type: "compound", value: {} };
      }
      newItem.nbtData.value.display.value.Name = { type: "string", value: fb.displayName };
      newItem.nbtData.value.trueItemId = { type: "string", value: trueItemId };

      return {
        item18: newItem,
        wasRewritten: true,
        trueItemId,
        fallbackId: fb.id,
        displayName: fb.displayName
      };
    }

    // Check if the item exists in client registry
    const clientItem = this.registryClient.itemsByName[name] || this.registryClient.blocksByName[name];
    if (clientItem) {
      return {
        item18: {
          blockId: clientItem.id,
          itemCount: item.itemCount,
          itemDamage: 0,
          nbtData: item.nbtData
        },
        wasRewritten: false
      };
    }

    // Default fallback for unknown items
    const fbId = 276; // Diamond Sword fallback
    const dispName = `§5${name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`;
    const newItem = {
      blockId: fbId,
      itemCount: item.itemCount,
      itemDamage: 0,
      nbtData: item.nbtData ? JSON.parse(JSON.stringify(item.nbtData)) : undefined
    };

    if (!newItem.nbtData) {
      newItem.nbtData = { type: "compound", name: "", value: {} };
    }
    if (!newItem.nbtData.value.display) {
      newItem.nbtData.value.display = { type: "compound", value: {} };
    }
    newItem.nbtData.value.display.value.Name = { type: "string", value: dispName };
    newItem.nbtData.value.trueItemId = { type: "string", value: trueItemId };

    return {
      item18: newItem,
      wasRewritten: true,
      trueItemId,
      fallbackId: fbId,
      displayName: dispName
    };
  }

  // Translates a modern level chunk packet payload to 1.8.9 format.
  // Collects and returns coordinates of rewritten blocks.
  public translateChunk(
    chunkX: number,
    chunkZ: number,
    chunkData: Buffer
  ): { chunkBuffer: Buffer; rewrittenBlocks: Array<{ x: number; y: number; z: number; trueBlockId: string; fallbackId: number }> } {
    const serverChunk = new this.ChunkServerClass({ minY: this.minY, worldHeight: this.worldHeight });
    serverChunk.load(chunkData);

    const clientChunk = new this.ChunkClientClass();
    const rewrittenBlocks: Array<{ x: number; y: number; z: number; trueBlockId: string; fallbackId: number }> = [];

    const numSections = this.worldHeight / 16;
    for (let sectionIdx = 0; sectionIdx < numSections; sectionIdx++) {
      const section = serverChunk.sections[sectionIdx];
      if (!section) continue;

      const sectionMinY = this.minY + sectionIdx * 16;
      // Skip sections that fall outside 1.8 build height (0 to 255)
      if (sectionMinY < 0 || sectionMinY >= 256) continue;

      for (let ly = 0; ly < 16; ly++) {
        const y = sectionMinY + ly;
        for (let lx = 0; lx < 16; lx++) {
          for (let lz = 0; lz < 16; lz++) {
            const pos = new Vec3(lx, y, lz);
            const stateId = serverChunk.getBlockStateId(pos);
            if (stateId === 0) continue; // Air or empty block state ID

            const translated = this.translateBlock(stateId);
            const clientStateId = (translated.id << 4) | translated.metadata;
            clientChunk.setBlockStateId(pos, clientStateId);

            if (translated.wasRewritten) {
              rewrittenBlocks.push({
                x: chunkX * 16 + lx,
                y,
                z: chunkZ * 16 + lz,
                trueBlockId: translated.name,
                fallbackId: translated.id
              });
            }
          }
        }
      }
    }

    const chunkBuffer = clientChunk.dump();
    return { chunkBuffer, rewrittenBlocks };
  }
}
