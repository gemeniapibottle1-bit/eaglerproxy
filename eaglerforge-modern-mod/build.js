import fs from 'fs';
import path from 'path';

const registryPath = path.resolve('../eagler-compat-registry/ModernDataRegistry.js');
const outputPath = path.resolve('./index.js');

// Read registry contents
let registryContent = fs.readFileSync(registryPath, 'utf8');

// Extract the ModernDataRegistry object string
// Find everything inside const ModernDataRegistry = { ... };
const match = registryContent.match(/export const ModernDataRegistry = ([\s\S]+)/);
if (!match) {
  console.error("Could not find ModernDataRegistry in " + registryPath);
  process.exit(1);
}
const registryObjectStr = match[1].trim().replace(/;$/, '');

// The mod template code
const template = `(function ModernCompatMod() {
    ModAPI.meta.title("Modern Compatibility Mod");
    ModAPI.meta.version("v1.0");
    ModAPI.meta.description("Brings modern blocks and items to life visually!");
    ModAPI.meta.credits("Advanced Agentic Coding");

    // Unified Data Registry (Bridges 1.8.9 fallback IDs and Modern IDs)
    const ModernDataRegistry = ${registryObjectStr};

    // State mappings
    const worldBlocks = {};
    const slotModernItems = {};
    const modernItemStacks = new Map();

    // Helper: Decode base64 to ArrayBuffer
    function base64ToArrayBuffer(base64) {
        var binary_string = window.atob(base64);
        var len = binary_string.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Helper: Parse packet payload defensively
    function getPayload(event) {
        let rawData = null;
        if (event.data && typeof event.data === 'string') {
            rawData = event.data;
        } else if (event.data && (event.data instanceof Uint8Array || Array.isArray(event.data) || event.data.buffer)) {
            rawData = new TextDecoder('utf-8').decode(event.data);
        } else if (event.bytes) {
            rawData = new TextDecoder('utf-8').decode(event.bytes);
        } else if (event.payload) {
            rawData = typeof event.payload === 'string' ? event.payload : new TextDecoder('utf-8').decode(event.payload);
        } else if (typeof event === 'string') {
            rawData = event;
        }
        
        if (rawData) {
            try {
                return JSON.parse(rawData);
            } catch(e) {
                if (typeof rawData === 'object') return rawData;
            }
        }
        try {
            if (typeof event.message === 'string') return JSON.parse(event.message);
        } catch(e) {}
        return null;
    }

    // Helper: Extract trueItemId of ItemStack
    function getTrueItemIdOfStack(stack) {
        if (!stack) return null;
        try {
            if (stack.$stackTagCompound) {
                const trueItemTag = stack.$stackTagCompound.$getString(ModAPI.util.str("trueItemId"));
                if (trueItemTag) {
                    const id = ModAPI.util.jclStrToJsStr(trueItemTag);
                    if (id) return id;
                }
            }
        } catch(e) {}
        const ref = stack.getRef();
        if (modernItemStacks.has(ref)) {
            return modernItemStacks.get(ref);
        }
        return null;
    }

    // Class Definitions and prototype stacked dummy items/blocks
    const BlockClass = ModAPI.reflect.getClassById("net.minecraft.block.Block");
    const ItemClass = ModAPI.reflect.getClassById("net.minecraft.item.Item");
    const blockSuper = ModAPI.reflect.getSuper(BlockClass, (x) => x.length === 2);
    const itemSuper = ModAPI.reflect.getSuper(ItemClass, (x) => x.length === 1);

    const creativeBlockTab = ModAPI.reflect.getClassById("net.minecraft.creativetab.CreativeTabs").staticVariables.tabBlock;
    const creativeMiscTab = ModAPI.reflect.getClassById("net.minecraft.creativetab.CreativeTabs").staticVariables.tabMisc;

    function ModernCompatBlock() {
        blockSuper(this, ModAPI.materials.rock.getRef());
        this.$defaultBlockState = this.$blockState.$getBaseState();
        this.$setCreativeTab(creativeBlockTab);
    }
    ModAPI.reflect.prototypeStack(BlockClass, ModernCompatBlock);

    function ModernCompatItem() {
        itemSuper(this);
        this.$setCreativeTab(creativeMiscTab);
    }
    ModAPI.reflect.prototypeStack(ItemClass, ModernCompatItem);

    const registeredBlocks = {};
    const registeredItems = {};

    function registerDummyBlocksAndItems() {
        // Register Blocks
        Object.keys(ModernDataRegistry.blocks).forEach(blockId => {
            const shortName = blockId.replace("minecraft:", "");
            const blockInstance = (new ModernCompatBlock())
                .$setHardness(3.0)
                .$setStepSound(BlockClass.staticVariables.soundTypePiston)
                .$setUnlocalizedName(ModAPI.util.str(shortName));
            BlockClass.staticMethods.registerBlock0.method(
                ModAPI.keygen.block(shortName),
                ModAPI.util.str(shortName),
                blockInstance
            );
            ItemClass.staticMethods.registerItemBlock0.method(blockInstance);
            registeredBlocks[blockId] = blockInstance;
            ModAPI.blocks[shortName] = blockInstance;
        });

        // Register Items
        Object.keys(ModernDataRegistry.items).forEach(itemId => {
            const shortName = itemId.replace("minecraft:", "");
            const itemInstance = (new ModernCompatItem()).$setUnlocalizedName(ModAPI.util.str(shortName));
            ItemClass.staticMethods.registerItem.method(
                ModAPI.keygen.item(shortName),
                ModAPI.util.str(shortName),
                itemInstance
            );
            registeredItems[itemId] = itemInstance;
            ModAPI.items[shortName] = itemInstance;
        });

        // Fixup block states mapping
        var blockRegistry = ModAPI.util.wrap(BlockClass.staticVariables.blockRegistry).getCorrective();
        var BLOCK_STATE_IDS = ModAPI.util.wrap(BlockClass.staticVariables.BLOCK_STATE_IDS).getCorrective();
        blockRegistry.registryObjects.hashTableKToV.forEach(entry => {
            if (entry) {
                var block = entry.value;
                var validStates = block.getBlockState().getValidStates();
                var stateArray = validStates.array || [validStates.element];
                stateArray.forEach(iblockstate => {
                    var i = blockRegistry.getIDForObject(block.getRef()) << 4 | block.getMetaFromState(iblockstate.getRef());
                    BLOCK_STATE_IDS.put(iblockstate.getRef(), i);
                });
            }
        });
    }

    // Check if ModAPI has already loaded materials (client-side)
    if (ModAPI.materials) {
        registerDummyBlocksAndItems();
    } else {
        ModAPI.addEventListener("bootstrap", registerDummyBlocksAndItems);
    }

    // Register blocks and items on server side thread
    function registerServerSideCode() {
        const blockNames = [
            "netherite_block", "ancient_debris", "crying_obsidian", "respawn_anchor",
            "lodestone", "purpur_block", "purpur_pillar", "purpur_stairs", "purpur_slab",
            "end_stone_bricks", "basalt", "polished_basalt", "blackstone", "copper_block",
            "exposed_copper", "weathered_copper", "oxidized_copper", "cut_copper"
        ];
        const itemNames = [
            "netherite_sword", "netherite_shovel", "netherite_pickaxe", "netherite_axe",
            "netherite_hoe", "netherite_helmet", "netherite_chestplate", "netherite_leggings",
            "netherite_boots", "netherite_ingot", "netherite_scrap", "totem_of_undying", "elytra"
        ];
        
        function fixupBlockIds() {
            var blockRegistry = ModAPI.util.wrap(ModAPI.reflect.getClassById("net.minecraft.block.Block").staticVariables.blockRegistry).getCorrective();
            var BLOCK_STATE_IDS = ModAPI.util.wrap(ModAPI.reflect.getClassById("net.minecraft.block.Block").staticVariables.BLOCK_STATE_IDS).getCorrective();
            blockRegistry.registryObjects.hashTableKToV.forEach(entry => {
                if (entry) {
                    var block = entry.value;
                    var validStates = block.getBlockState().getValidStates();
                    var stateArray = validStates.array || [validStates.element];
                    stateArray.forEach(iblockstate => {
                        var i = blockRegistry.getIDForObject(block.getRef()) << 4 | block.getMetaFromState(iblockstate.getRef());
                        BLOCK_STATE_IDS.put(iblockstate.getRef(), i);
                    });
                }
            });
        }

        var creativeBlockTab = ModAPI.reflect.getClassById("net.minecraft.creativetab.CreativeTabs").staticVariables.tabBlock;
        var creativeMiscTab = ModAPI.reflect.getClassById("net.minecraft.creativetab.CreativeTabs").staticVariables.tabMisc;
        var blockClass = ModAPI.reflect.getClassById("net.minecraft.block.Block");
        var itemClass = ModAPI.reflect.getClassById("net.minecraft.item.Item");
        
        var blockSuper = ModAPI.reflect.getSuper(blockClass, (x) => x.length === 2);
        function ModernCompatBlock() {
            blockSuper(this, ModAPI.materials.rock.getRef());
            this.$defaultBlockState = this.$blockState.$getBaseState();
            this.$setCreativeTab(creativeBlockTab);
        }
        ModAPI.reflect.prototypeStack(blockClass, ModernCompatBlock);

        var itemSuper = ModAPI.reflect.getSuper(itemClass, (x) => x.length === 1);
        function ModernCompatItem() {
            itemSuper(this);
            this.$setCreativeTab(creativeMiscTab);
        }
        ModAPI.reflect.prototypeStack(itemClass, ModernCompatItem);

        ModAPI.addEventListener("bootstrap", () => {
            blockNames.forEach(shortName => {
                var blockInstance = (new ModernCompatBlock())
                    .$setHardness(3.0)
                    .$setStepSound(blockClass.staticVariables.soundTypePiston)
                    .$setUnlocalizedName(ModAPI.util.str(shortName));
                blockClass.staticMethods.registerBlock0.method(
                    ModAPI.keygen.block(shortName),
                    ModAPI.util.str(shortName),
                    blockInstance
                );
                itemClass.staticMethods.registerItemBlock0.method(blockInstance);
            });

            itemNames.forEach(shortName => {
                var itemInstance = (new ModernCompatItem()).$setUnlocalizedName(ModAPI.util.str(shortName));
                itemClass.staticMethods.registerItem.method(
                    ModAPI.keygen.item(shortName),
                    ModAPI.util.str(shortName),
                    itemInstance
                );
            });

            fixupBlockIds();
        });
    }
    ModAPI.dedicatedServer.appendCode(registerServerSideCode);

    // Write base64 PNGs and JSON models to AsyncSink resource packs
    ModAPI.addEventListener("lib:asyncsink", async () => {
        ModAPI.addEventListener("lib:asyncsink:registeritems", (renderItem) => {
            Object.keys(ModernDataRegistry.blocks).forEach(blockId => {
                const shortName = blockId.replace("minecraft:", "");
                const instance = registeredBlocks[blockId];
                if (instance) renderItem.registerBlock(instance, ModAPI.util.str(shortName));
            });
            Object.keys(ModernDataRegistry.items).forEach(itemId => {
                const shortName = itemId.replace("minecraft:", "");
                const instance = registeredItems[itemId];
                if (instance) renderItem.registerItem(instance, ModAPI.util.str(shortName));
            });
        });

        // Set block files
        for (const [blockId, data] of Object.entries(ModernDataRegistry.blocks)) {
            const shortName = blockId.replace("minecraft:", "");
            const texturePath = "resourcepacks/AsyncSinkLib/assets/minecraft/textures/blocks/" + shortName + ".png";
            AsyncSink.setFile(texturePath, base64ToArrayBuffer(data.texture.split(",")[1] || data.texture));

            AsyncSink.setFile("resourcepacks/AsyncSinkLib/assets/minecraft/blockstates/" + shortName + ".json", JSON.stringify({
                "variants": { "normal": [{ "model": shortName }] }
            }));
            AsyncSink.setFile("resourcepacks/AsyncSinkLib/assets/minecraft/models/block/" + shortName + ".json", JSON.stringify({
                "parent": "block/cube_all", "textures": { "all": "blocks/" + shortName }
            }));
            AsyncSink.setFile("resourcepacks/AsyncSinkLib/assets/minecraft/models/item/" + shortName + ".json", JSON.stringify({
                "parent": "block/" + shortName,
                "display": { "thirdperson": { "rotation": [10, -45, 170], "translation": [0, 1.5, -2.75], "scale": [0.375, 0.375, 0.375] } }
            }));
            
            AsyncSink.L10N.set("tile." + shortName + ".name", shortName.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
        }

        // Set item files
        for (const [itemId, data] of Object.entries(ModernDataRegistry.items)) {
            const shortName = itemId.replace("minecraft:", "");
            const texturePath = "resourcepacks/AsyncSinkLib/assets/minecraft/textures/items/" + shortName + ".png";
            AsyncSink.setFile(texturePath, base64ToArrayBuffer(data.texture.split(",")[1] || data.texture));

            AsyncSink.setFile("resourcepacks/AsyncSinkLib/assets/minecraft/models/item/" + shortName + ".json", JSON.stringify({
                "parent": "builtin/generated", "textures": { "layer0": "items/" + shortName },
                "display": {
                    "thirdperson": { "rotation": [-90, 0, 0], "translation": [0, 1, -3], "scale": [0.55, 0.55, 0.55] },
                    "firstperson": { "rotation": [0, -135, 25], "translation": [0, 4, 2], "scale": [1.7, 1.7, 1.7] }
                }
            }));
            
            AsyncSink.L10N.set("item." + shortName + ".name", data.defaultName);
        }
    });

    // Helper: Get modern block sprite in atlas
    function getModernBlockSprite(trueBlockId) {
        const textureName = trueBlockId.replace("minecraft:", "blocks/");
        const TextureMapClass = ModAPI.reflect.getClassById("net.minecraft.client.renderer.texture.TextureMap");
        const locationBlocksTexture = TextureMapClass.staticVariables.locationBlocksTexture;
        const textureMap = ModAPI.mc.getTextureManager().mapTextureObjects.get(locationBlocksTexture.getRef());
        if (textureMap) {
            const wrappedMap = ModAPI.util.wrap(textureMap);
            var sprite = wrappedMap.getAtlasSprite(ModAPI.util.str("minecraft:" + textureName));
            return sprite;
        }
        return null;
    }

    // Helper: Create dummy stack of registered item
    function createDummyStack(item, size, damage) {
        const ItemStackClass = ModAPI.reflect.getClassById("net.minecraft.item.ItemStack");
        const constructor = ItemStackClass.constructors.find(c => c.length === 3);
        const rawStack = constructor(item.getRef(), size, damage);
        return ModAPI.util.wrap(rawStack);
    }

    // Hook Block.getIcon(IBlockAccess, BlockPos, EnumFacing)
    function getIconMethodKey() {
        const BlockClass = ModAPI.reflect.getClassById("net.minecraft.block.Block");
        for (const [key, value] of Object.entries(BlockClass.methods)) {
            if (value.methodNameShort === "getIcon" && value.signature && value.signature.includes("IBlockAccess")) {
                return key;
            }
        }
        return null;
    }

    const iconMethodKey = getIconMethodKey();
    if (iconMethodKey) {
        const originalGetIcon = ModAPI.hooks.methods[iconMethodKey];
        ModAPI.hooks.methods[iconMethodKey] = function ($this, $worldIn, $blockPos, $enumFacing) {
            try {
                var blockPos = ModAPI.util.wrap($blockPos);
                var x = blockPos.getX();
                var y = blockPos.getY();
                var z = blockPos.getZ();
                var key = \`\${x},\${y},\${z}\`;
                if (worldBlocks[key]) {
                    var trueBlockId = worldBlocks[key];
                    var sprite = getModernBlockSprite(trueBlockId);
                    if (sprite) {
                        return sprite.getRef();
                    }
                }
            } catch(e) {
                // ignore
            }
            return originalGetIcon.call(this, $this, $worldIn, $blockPos, $enumFacing);
        };
    }

    // Hook RenderItem.renderItem(ItemStack, IBakedModel)
    function getRenderItemMethodKey() {
        const RenderItemClass = ModAPI.reflect.getClassById("net.minecraft.client.renderer.entity.RenderItem");
        for (const [key, value] of Object.entries(RenderItemClass.methods)) {
            if (value.methodNameShort === "renderItem" && value.signature && value.signature.includes("IBakedModel")) {
                return key;
            }
        }
        return null;
    }

    const renderItemKey = getRenderItemMethodKey();
    if (renderItemKey) {
        const originalRenderItem = ModAPI.hooks.methods[renderItemKey];
        ModAPI.hooks.methods[renderItemKey] = function ($this, $stack, $model) {
            try {
                if ($stack) {
                    var stack = ModAPI.util.wrap($stack);
                    var trueItemId = getTrueItemIdOfStack(stack);
                    if (trueItemId && registeredItems[trueItemId]) {
                        var dummyItem = registeredItems[trueItemId];
                        var dummyStack = createDummyStack(dummyItem, stack.stackSize || 1, stack.itemDamage || 0);
                        var itemModelMesher = ModAPI.mc.renderItem.itemModelMesher;
                        var dummyModel = itemModelMesher.getItemModel(dummyStack.getRef());
                        if (dummyModel) {
                            return originalRenderItem.call(this, $this, dummyStack.getRef(), dummyModel);
                        }
                    }
                }
            } catch(e) {
                // ignore
            }
            return originalRenderItem.call(this, $this, $stack, $model);
        };
    }

    // Hook ItemStack.getTooltip
    function getTooltipMethodKey() {
        const ItemStackClass = ModAPI.reflect.getClassById("net.minecraft.item.ItemStack");
        for (const [key, value] of Object.entries(ItemStackClass.methods)) {
            if (value.methodNameShort === "getTooltip") {
                return key;
            }
        }
        return null;
    }

    const tooltipKey = getTooltipMethodKey();
    if (tooltipKey) {
        const originalGetTooltip = ModAPI.hooks.methods[tooltipKey];
        ModAPI.hooks.methods[tooltipKey] = function ($this, $player, $advanced) {
            var list = originalGetTooltip.call(this, $this, $player, $advanced);
            try {
                var stack = ModAPI.util.wrap($this);
                var trueItemId = getTrueItemIdOfStack(stack);
                if (trueItemId) {
                    var wrappedList = ModAPI.util.wrap(list);
                    updateModernTooltip(wrappedList, trueItemId);
                }
            } catch(e) {
                // ignore
            }
            return list;
        };
    }

    function updateModernTooltip(wrappedList, trueItemId) {
        const tooltips = {
            "minecraft:netherite_sword": ["§7When in main hand:", "§2+8 Attack Damage", "§21.6 Attack Speed"],
            "minecraft:netherite_pickaxe": ["§7When in main hand:", "§2+6 Attack Damage", "§21.2 Attack Speed"],
            "minecraft:netherite_axe": ["§7When in main hand:", "§2+10 Attack Damage", "§21.0 Attack Speed"],
            "minecraft:netherite_shovel": ["§7When in main hand:", "§2+5.5 Attack Damage", "§21.0 Attack Speed"],
            "minecraft:netherite_hoe": ["§7When in main hand:", "§2+1 Attack Damage", "§24.0 Attack Speed"],
            "minecraft:netherite_helmet": ["§7When on head:", "§2+3 Armor", "§2+3 Armor Toughness", "§2+1 Knockback Resistance"],
            "minecraft:netherite_chestplate": ["§7When on body:", "§2+8 Armor", "§2+3 Armor Toughness", "§2+1 Knockback Resistance"],
            "minecraft:netherite_leggings": ["§7When on legs:", "§2+6 Armor", "§2+3 Armor Toughness", "§2+1 Knockback Resistance"],
            "minecraft:netherite_boots": ["§7When on feet:", "§2+3 Armor", "§2+3 Armor Toughness", "§2+1 Knockback Resistance"],
            "minecraft:totem_of_undying": ["§7Reverts death when held in hand"],
            "minecraft:elytra": ["§7When on body:", "§2Provides flight capability"],
            "minecraft:crying_obsidian": ["§7A sad variant of obsidian"],
            "minecraft:respawn_anchor": ["§7Used to respawn in the Nether"],
            "minecraft:lodestone": ["§7Used to align compasses"],
            "minecraft:ancient_debris": ["§7Contains trace amounts of netherite"]
        };
        
        if (tooltips[trueItemId]) {
            const name = wrappedList.get(0);
            wrappedList.clear();
            wrappedList.add(name);
            tooltips[trueItemId].forEach(line => {
                wrappedList.add(ModAPI.util.str(line));
            });
        }
    }

    // Packet Handling for "eagler:moderncompat"
    function mapSlotImmediately(slotIdx, trueItemId) {
        try {
            const player = ModAPI.player;
            if (!player) return;
            const container = player.openContainer || player.inventoryContainer;
            if (container) {
                const slots = container.inventorySlots;
                if (slots) {
                    const wrappedSlots = ModAPI.util.wrap(slots);
                    const slot = wrappedSlots.get(slotIdx);
                    if (slot) {
                        const wrappedSlot = ModAPI.util.wrap(slot);
                        const stack = wrappedSlot.getStack();
                        if (stack) {
                            modernItemStacks.set(stack.getRef(), trueItemId);
                        }
                    }
                }
            }
        } catch(e) {}
    }

    function handleModernCompatPayload(payload) {
        if (payload.packetId === "BLOCK_MAP") {
            const key = \`\${payload.x},\${payload.y},\${payload.z}\`;
            worldBlocks[key] = payload.trueBlockId;
        } else if (payload.packetId === "ITEM_MAP") {
            slotModernItems[payload.slot] = payload.trueItemId;
            mapSlotImmediately(payload.slot, payload.trueItemId);
        }
    }

    ModAPI.addEventListener("packet", (event) => {
        try {
            let channel = event.channel || event.channelName || (event.data && event.data.channel) || event.tag;
            if (channel === "eagler:moderncompat") {
                let payload = getPayload(event);
                if (payload) {
                    handleModernCompatPayload(payload);
                }
            }
        } catch(e) {
            console.error("[ModernCompat] Error handling packet event:", e);
        }
    });

    // Fallback: Hook handleCustomPayload in NetHandlerPlayClient
    let processedPackets = new Set();
    function initFallbackHook() {
        try {
            const className = "net.minecraft.client.network.NetHandlerPlayClient";
            const methodName = "handleCustomPayload";
            const methodKey = ModAPI.util.getMethodFromPackage(className, methodName);
            if (methodKey && ModAPI.hooks.methods[methodKey]) {
                const originalMethod = ModAPI.hooks.methods[methodKey];
                ModAPI.hooks.methods[methodKey] = function ($this, $packet) {
                    try {
                        const packet = ModAPI.util.wrap($packet);
                        let channel = "";
                        if (packet.getChannelName) {
                            channel = ModAPI.util.ustr(packet.getChannelName());
                        } else if (packet.$getChannelName) {
                            channel = ModAPI.util.ustr(packet.$getChannelName());
                        }
                        
                        if (channel === "eagler:moderncompat") {
                            let dataBuffer = null;
                            if (packet.getBufferData) {
                                dataBuffer = packet.getBufferData();
                            } else if (packet.$getBufferData) {
                                dataBuffer = packet.$getBufferData();
                            }
                            
                            if (dataBuffer) {
                                let dataStr = "";
                                const wrappedBuffer = ModAPI.util.wrap(dataBuffer);
                                if (wrappedBuffer.array) {
                                    const bytes = wrappedBuffer.array();
                                    dataStr = new TextDecoder('utf-8').decode(bytes);
                                } else if (wrappedBuffer.array$array) {
                                    const bytes = wrappedBuffer.array$array();
                                    dataStr = new TextDecoder('utf-8').decode(bytes);
                                }
                                if (dataStr && !processedPackets.has(dataStr)) {
                                    processedPackets.add(dataStr);
                                    if (processedPackets.size > 200) {
                                        processedPackets.clear();
                                    }
                                    try {
                                        let payload = JSON.parse(dataStr);
                                        if (payload) {
                                            handleModernCompatPayload(payload);
                                        }
                                    } catch(ex) {}
                                }
                            }
                        }
                    } catch (e) {
                        console.error("[ModernCompat] Error in handleCustomPayload hook:", e);
                    }
                    return originalMethod.call(this, $this, $packet);
                };
                console.log("[ModernCompat] Hooked handleCustomPayload fallback successfully!");
            }
        } catch (e) {
            console.error("[ModernCompat] Fallback hook init failed:", e);
        }
    }
    initFallbackHook();

    // Container changed slot cleaner and slot reference mapper update
    function updateSlotItemStacks() {
        try {
            const player = ModAPI.player;
            if (!player) return;
            const invContainer = player.inventoryContainer;
            if (invContainer) {
                const slots = invContainer.inventorySlots;
                if (slots) {
                    const wrappedSlots = ModAPI.util.wrap(slots);
                    const size = wrappedSlots.size();
                    for (let i = 0; i < size; i++) {
                        const slot = wrappedSlots.get(i);
                        if (slot) {
                            const wrappedSlot = ModAPI.util.wrap(slot);
                            const stack = wrappedSlot.getStack();
                            if (stack) {
                                const trueItemId = slotModernItems[i];
                                if (trueItemId) {
                                    modernItemStacks.set(stack.getRef(), trueItemId);
                                }
                            }
                        }
                    }
                }
            }
            const openContainer = player.openContainer;
            if (openContainer && openContainer !== invContainer) {
                const slots = openContainer.inventorySlots;
                if (slots) {
                    const wrappedSlots = ModAPI.util.wrap(slots);
                    const size = wrappedSlots.size();
                    for (let i = 0; i < size; i++) {
                        const slot = wrappedSlots.get(i);
                        if (slot) {
                            const wrappedSlot = ModAPI.util.wrap(slot);
                            const stack = wrappedSlot.getStack();
                            if (stack) {
                                const trueItemId = slotModernItems[i];
                                if (trueItemId) {
                                    modernItemStacks.set(stack.getRef(), trueItemId);
                                }
                            }
                        }
                    }
                }
            }
        } catch(e) {}
    }

    let lastOpenContainerRef = null;
    ModAPI.addEventListener("update", () => {
        try {
            const player = ModAPI.player;
            if (player) {
                const currentContainer = player.openContainer;
                const currentContainerRef = currentContainer ? currentContainer.getRef() : null;
                if (currentContainerRef !== lastOpenContainerRef) {
                    for (var prop in slotModernItems) {
                        delete slotModernItems[prop];
                    }
                    lastOpenContainerRef = currentContainerRef;
                }
                updateSlotItemStacks();
            }
        } catch(e) {}
    });

})();`;

fs.writeFileSync(outputPath, template);
console.log("Successfully compiled index.js mod!");
