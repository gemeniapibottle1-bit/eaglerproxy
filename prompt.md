Role: Backend Network Engineer / Node.js & TypeScript Expert
Task: Update 'eaglerproxy' and implement a custom downstream translation network layer.

Context:
You are working in isolation on a Node.js TypeScript project (https://github.com/WorldEditAxe/eaglerproxy). This proxy bridges a 1.8.9 Eaglercraft client to a modern vanilla Minecraft server. You cannot see the client-side mod code. You must implement a strict network contract using the custom PluginChannel "eagler:moderncompat".

Instructions:
1. Protocol Dependency Bump: Locate 'package.json' and network parsing files in 'src/'. Update the underlying Minecraft protocol parsing libraries to support modern server packets. Ensure 'npm run build' or 'tsc' compiles with zero errors.
2. Build the Fallback Engine: Implement a packet interceptor. When the modern server sends a block update, item update, or chunk data packet containing modern IDs (e.g., 'minecraft:netherite_block' or 'minecraft:netherite_sword'), rewrite that packet's ID to a safe 1.8.9 fallback ID (e.g., 49 for Obsidian, 276 for Diamond Sword) before sending it to the client to prevent client crashes.
3. Implement Custom Payload Injection: Every time you rewrite a modern block or item packet into a 1.8.9 fallback, simultaneously inject a custom PluginChannel packet named "eagler:moderncompat" containing the true modern ID and metadata.
4. Output Packet Specifications:
- For blocks, send: {"packetId": "BLOCK_MAP", "x": number, "y": number, "z": number, "trueBlockId": string, "fallbackId": number}
- For items, send: {"packetId": "ITEM_MAP", "slot": number, "trueItemId": string, "fallbackId": number, "displayName": string}

Write clean, modular TypeScript code to handle this packet rewriting layer.