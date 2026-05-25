import EventEmitter from "events";
import pkg, { Client, ClientOptions, createClient, states } from "minecraft-protocol";
import { WebSocket } from "ws";
import { Logger } from "../logger.js";
import { Chat } from "./Chat.js";
import { Enums } from "./Enums.js";
import Packet from "./Packet.js";
import SCDisconnectPacket from "./packets/SCDisconnectPacket.js";
import { MineProtocol } from "./Protocol.js";
import { EaglerSkins } from "./skins/EaglerSkins.js";
import { Util } from "./Util.js";
import { BungeeUtil } from "./BungeeUtil.js";
import { IncomingMessage } from "http";
import { Socket } from "net";
import { TranslationHelper } from "./TranslationHelper.js";
import { SCChannelMessagePacket } from "./packets/channel/SCChannelMessage.js";

const { createSerializer, createDeserializer } = pkg;

export class Player extends EventEmitter {
  public ws: WebSocket & { httpRequest: IncomingMessage; _socket: Socket };
  public username?: string;
  public skin?: EaglerSkins.EaglerSkin;
  public uuid?: string;
  public state?: Enums.ClientState = Enums.ClientState.PRE_HANDSHAKE;
  public serverConnection?: Client;

  private _switchingServers: boolean = false;
  private _logger: Logger;
  private _alreadyConnected: boolean = false;

  public translator?: BungeeUtil.PacketUUIDTranslator;
  public translationHelper?: TranslationHelper;
  public serverSerializer: any;
  public clientSerializer: any;
  public serverDeserializer: any;
  public clientDeserializer: any;
  private _kickMessage: string;

  constructor(ws: WebSocket & { httpRequest: IncomingMessage }, playerName?: string, serverConnection?: Client) {
    super();
    this._logger = new Logger(`PlayerHandler-${playerName}`);
    this.ws = ws as any;
    this.username = playerName;
    this.serverConnection = serverConnection;
    if (this.username != null) this.uuid = Util.generateUUIDFromPlayer(this.username);
    this.serverSerializer = createSerializer({
      state: states.PLAY,
      isServer: true,
      version: "1.21.1",
      customPackets: null,
    });
    this.clientSerializer = createSerializer({
      state: states.PLAY,
      isServer: false,
      version: "1.21.1",
      customPackets: null,
    });
    this.serverDeserializer = createDeserializer({
      state: states.PLAY,
      isServer: true,
      version: "1.21.1",
      customPackets: null,
    });
    this.clientDeserializer = createSerializer({
      state: states.PLAY,
      isServer: true,
      version: "1.21.1",
      customPackets: null,
    });
  }

  public initListeners() {
    this.ws.on("close", () => {
      this.state = Enums.ClientState.DISCONNECTED;
      if (this.serverConnection) this.serverConnection.end();
      this.emit("disconnect", this);
    });
    this.ws.on("message", (msg: Buffer) => {
      if (msg instanceof Buffer == false) return;
      const decoder = PACKET_REGISTRY.get(msg[0]);
      if (decoder && decoder.sentAfterHandshake) {
        if (!decoder && this.state != Enums.ClientState.POST_HANDSHAKE && msg.length >= 1) {
          this._logger.warn(`Packet with ID 0x${Buffer.from([msg[0]]).toString("hex")} is missing a corresponding packet handler! Processing for this packet will be skipped.`);
        } else {
          let parsed: Packet, err: boolean;
          try {
            parsed = new decoder.class();
            parsed.deserialize(msg);
          } catch (err) {
            if (this.state != Enums.ClientState.POST_HANDSHAKE) this._logger.warn(`Packet ID 0x${Buffer.from([msg[0]]).toString("hex")} failed to parse! The packet will be skipped.`);
            err = true;
          }
          if (!err) {
            this.emit("proxyPacket", parsed, this);
            return;
          }
        }
      } else {
        try {
          const parsed = this.serverDeserializer.parsePacketBuffer(msg)?.data,
            translated = this.translator.translatePacketClient(parsed.params, parsed),
            packetData = {
              name: translated[0],
              params: translated[1],
              cancel: false,
            };
          this.emit("vanillaPacket", packetData, "CLIENT", this);
          if (!packetData.cancel) {
            (this as any)._sendPacketToServer(
              this.clientSerializer.createPacketBuffer({
                name: packetData.name,
                params: packetData.params,
              })
            );
          }
        } catch (err) {
          this._logger.debug(`Client ${this.username!} sent an unrecognized packet that could not be parsed!\n${err.stack ?? err}`);
        }
      }
    });
  }

  public write(packet: Packet) {
    this.ws.send(packet.serialize());
  }

  public async read(packetId?: Enums.PacketId, filter?: (packet: Packet) => boolean): Promise<Packet> {
    let res;
    await Util.awaitPacket(this.ws, (packet) => {
      if ((packetId != null && packetId == packet[0]) || packetId == null) {
        const decoder = PACKET_REGISTRY.get(packet[0]);
        if (decoder != null && decoder.packetId == packet[0] && (this.state == Enums.ClientState.PRE_HANDSHAKE || decoder.sentAfterHandshake) && decoder.boundTo == Enums.PacketBounds.S) {
          let parsed: Packet,
            err = false;
          try {
            parsed = new decoder.class();
            parsed.deserialize(packet);
          } catch (_err) {
            err = true;
          }
          if (!err) {
            if (filter && filter(parsed)) {
              res = parsed;
              return true;
            } else if (filter == null) {
              res = parsed;
              return true;
            }
          }
        }
      }
      return false;
    });
    return res;
  }

  public disconnect(message: Chat.Chat | string) {
    if (this.state == Enums.ClientState.POST_HANDSHAKE) {
      this.ws.send(Buffer.concat([[0x40], MineProtocol.writeString(typeof message == "string" ? message : JSON.stringify(message))].map((arr) => (arr instanceof Uint8Array ? arr : Buffer.from(arr)))));
      this.ws.close();
    } else {
      const packet = new SCDisconnectPacket();
      packet.reason = message;
      this.ws.send(packet.serialize());
      this.ws.close();
    }
  }

  public async connect(options: ClientOptions) {
    if (this._alreadyConnected) throw new Error(`Invalid state: Player has already been connected to a server, and .connect() was just called. Please use switchServers() instead.`);
    this._alreadyConnected = true;
    this.serverConnection = createClient(
      Object.assign(
        {
          version: false,
          keepAlive: false,
          hideErrors: false,
        },
        options
      )
    );
    await this._bindListenersMineClient(this.serverConnection);
  }

  public switchServers(options: ClientOptions) {
    if (!this._alreadyConnected)
      throw new Error(
        `Invalid state: Player hasn't already been connected to a server, and .switchServers() has been called. Please use .connect() when initially connecting to a server, and only use .switchServers() if you want to switch servers.`
      );
    return new Promise<void | never>(async (res, rej) => {
      const oldConnection = this.serverConnection;
      this._switchingServers = true;

      this.ws.send(
        this.serverSerializer.createPacketBuffer({
          name: "chat",
          params: {
            message: `${Enums.ChatColor.GRAY}Switching servers...`,
            position: 1,
          },
        })
      );
      this.ws.send(
        this.serverSerializer.createPacketBuffer({
          name: "playerlist_header",
          params: {
            header: JSON.stringify({
              text: "",
            }),
            footer: JSON.stringify({
              text: "",
            }),
          },
        })
      );

      this.serverConnection = createClient(
        Object.assign(
          {
            version: false,
            keepAlive: false,
            hideErrors: false,
          },
          options
        )
      );

      await this._bindListenersMineClient(this.serverConnection, true, () => oldConnection.end())
        .then(() => {
          this.emit("switchServer", this.serverConnection, this);
          res();
        })
        .catch((err) => {
          this.serverConnection = oldConnection;
          rej(err);
        });
    });
  }

  private async _bindListenersMineClient(client: Client, switchingServers?: boolean, onSwitch?: Function) {
    return new Promise((res, rej) => {
      let stream = false,
        uuid;
      const listener = (msg) => {
          if (stream) {
            client.writeRaw(msg);
          }
        },
        errListener = (err) => {
          if (!stream) {
            rej(err);
          } else {
            this.disconnect(`${Enums.ChatColor.RED}Something went wrong: ${err.stack ?? err}`);
          }
        };
      setTimeout(() => {
        if (!stream && this.state != Enums.ClientState.DISCONNECTED) {
          client.end("Timed out waiting for server connection.");
          this.disconnect(Enums.ChatColor.RED + "Timed out waiting for server connection!");
          throw new Error("Timed out waiting for server connection!");
        }
      }, 30000);
      client.on("error", errListener);
      client.on("end", (reason) => {
        if (!this._switchingServers && !switchingServers) {
          this.disconnect(this._kickMessage ?? reason);
        }
        this.ws.removeListener("message", listener);
      });
      client.once("connect", () => {
        this.emit("joinServer", client, this);
      });
      client.on("packet", (packet, meta) => {
        if (meta.name == "kick_disconnect") {
          let json;
          try {
            json = JSON.parse(packet.reason);
          } catch {}
          if (json != null) {
            this._kickMessage = Chat.chatToPlainString(json);
          } else this._kickMessage = packet.reason;
          this._switchingServers = false;
          this.disconnect(this._kickMessage);
        } else if (meta.name == "disconnect") {
          let json;
          try {
            json = JSON.parse(packet.reason);
          } catch {}
          if (json != null) {
            this._kickMessage = Chat.chatToPlainString(json);
          } else this._kickMessage = packet.reason;
          this._switchingServers = false;
          this.disconnect(this._kickMessage);
        }
        if (!stream) {
          if (switchingServers) {
            if (meta.name == "login" && meta.state == states.PLAY && uuid) {
              this.translator = new BungeeUtil.PacketUUIDTranslator(client.uuid, this.uuid);
              this.clientSerializer = createSerializer({
                state: states.PLAY,
                isServer: false,
                version: client.version,
                customPackets: null,
              });
              this.translationHelper = new TranslationHelper(client.version);

              const pckSeq = BungeeUtil.getRespawnSequence(packet, this.serverSerializer);
              this.ws.send(
                this.serverSerializer.createPacketBuffer({
                  name: "login",
                  params: packet,
                })
              );
              pckSeq.forEach((p) => this.ws.send(p));
              stream = true;
              if (onSwitch) onSwitch();
              res(null);
            } else if (meta.name == "success" && meta.state == states.LOGIN && !uuid) {
              uuid = packet.uuid;
            }
          } else {
            if (meta.name == "login" && meta.state == states.PLAY && uuid) {
              this.translator = new BungeeUtil.PacketUUIDTranslator(client.uuid, this.uuid);
              this.clientSerializer = createSerializer({
                state: states.PLAY,
                isServer: false,
                version: client.version,
                customPackets: null,
              });
              this.translationHelper = new TranslationHelper(client.version);

              this.ws.send(
                this.serverSerializer.createPacketBuffer({
                  name: "login",
                  params: packet,
                })
              );
              stream = true;
              if (onSwitch) onSwitch();
              res(null);
            } else if (meta.name == "success" && meta.state == states.LOGIN && !uuid) {
              uuid = packet.uuid;
            }
          }
        } else {
          let translated = this.translator!.translatePacketServer(packet, meta);
          const eventData = {
            name: translated[0],
            params: translated[1],
            cancel: false,
          };

          if (this.translationHelper) {
            try {
              const params = eventData.params as any;
              if (eventData.name === "block_change") {
                const blockType = params.type;
                const blockTrans = this.translationHelper.translateBlock(blockType);
                params.type = (blockTrans.id << 4) | (blockTrans.metadata & 0xf);

                if (blockTrans.wasRewritten && params.location) {
                  const payload = {
                    packetId: "BLOCK_MAP",
                    x: params.location.x,
                    y: params.location.y,
                    z: params.location.z,
                    trueBlockId: blockTrans.name,
                    fallbackId: blockTrans.id
                  };
                  const channelPacket = new SCChannelMessagePacket();
                  channelPacket.channel = "eagler:moderncompat";
                  channelPacket.data = Buffer.from(JSON.stringify(payload), 'utf8');
                  this.write(channelPacket);
                }
              } else if (eventData.name === "multi_block_change") {
                const chunkX = params.chunkCoordinates?.x ?? params.chunkX;
                const chunkZ = params.chunkCoordinates?.z ?? params.chunkZ;
                const sectionY = params.chunkCoordinates?.y ?? 0;
                const records18: any[] = [];

                if (Array.isArray(params.records)) {
                  for (const record of params.records) {
                    let localX: number, localZ: number, localY: number, blockStateId: number;
                    if (typeof record === 'number' || typeof record === 'bigint') {
                      const recNum = Number(record);
                      localX = (recNum >> 8) & 0xF;
                      localZ = (recNum >> 4) & 0xF;
                      localY = recNum & 0xF;
                      blockStateId = recNum >> 12;
                    } else {
                      localX = (record.horizontalPos >> 4) & 0xF;
                      localZ = record.horizontalPos & 0xF;
                      localY = record.y ?? 0;
                      blockStateId = record.blockId;
                    }

                    const absoluteX = chunkX * 16 + localX;
                    const absoluteY = sectionY * 16 + localY;
                    const absoluteZ = chunkZ * 16 + localZ;

                    if (absoluteY >= 0 && absoluteY < 256) {
                      const blockTrans = this.translationHelper.translateBlock(blockStateId);
                      const blockId18 = (blockTrans.id << 4) | (blockTrans.metadata & 0xf);
                      records18.push({
                        horizontalPos: (localX << 4) | localZ,
                        y: absoluteY,
                        blockId: blockId18
                      });

                      if (blockTrans.wasRewritten) {
                        const payload = {
                          packetId: "BLOCK_MAP",
                          x: absoluteX,
                          y: absoluteY,
                          z: absoluteZ,
                          trueBlockId: blockTrans.name,
                          fallbackId: blockTrans.id
                        };
                        const channelPacket = new SCChannelMessagePacket();
                        channelPacket.channel = "eagler:moderncompat";
                        channelPacket.data = Buffer.from(JSON.stringify(payload), 'utf8');
                        this.write(channelPacket);
                      }
                    }
                  }
                }

                eventData.name = "multi_block_change";
                eventData.params = {
                  chunkX,
                  chunkZ,
                  records: records18
                };
              } else if (eventData.name === "set_slot") {
                const slotIdx = params.slot;
                const translatedItem = this.translationHelper.translateItem(params.item);
                
                eventData.name = "set_slot";
                eventData.params = {
                  windowId: params.windowId,
                  slot: slotIdx,
                  item: translatedItem.item18
                };

                if (translatedItem.wasRewritten) {
                  const payload = {
                    packetId: "ITEM_MAP",
                    slot: slotIdx,
                    trueItemId: translatedItem.trueItemId,
                    fallbackId: translatedItem.fallbackId,
                    displayName: translatedItem.displayName
                  };
                  const channelPacket = new SCChannelMessagePacket();
                  channelPacket.channel = "eagler:moderncompat";
                  channelPacket.data = Buffer.from(JSON.stringify(payload), 'utf8');
                  this.write(channelPacket);
                }
              } else if (eventData.name === "window_items") {
                const items18: any[] = [];
                if (Array.isArray(params.items)) {
                  params.items.forEach((item: any, slotIdx: number) => {
                    const translatedItem = this.translationHelper.translateItem(item);
                    items18.push(translatedItem.item18);

                    if (translatedItem.wasRewritten) {
                      const payload = {
                        packetId: "ITEM_MAP",
                        slot: slotIdx,
                        trueItemId: translatedItem.trueItemId,
                        fallbackId: translatedItem.fallbackId,
                        displayName: translatedItem.displayName
                      };
                      const channelPacket = new SCChannelMessagePacket();
                      channelPacket.channel = "eagler:moderncompat";
                      channelPacket.data = Buffer.from(JSON.stringify(payload), 'utf8');
                      this.write(channelPacket);
                    }
                  });
                }

                eventData.name = "window_items";
                eventData.params = {
                  windowId: params.windowId,
                  items: items18
                };
              } else if (eventData.name === "map_chunk") {
                const chunkX = params.x;
                const chunkZ = params.z;
                const chunkTrans = this.translationHelper.translateChunk(chunkX, chunkZ, params.chunkData);
                
                eventData.name = "map_chunk";
                eventData.params = {
                  x: chunkX,
                  z: chunkZ,
                  groundUp: params.groundUp ?? true,
                  bitMap: params.bitMap ?? 0xffff,
                  chunkData: chunkTrans.chunkBuffer
                };

                const chunkBuffer = this.serverSerializer.createPacketBuffer({
                  name: eventData.name,
                  params: eventData.params
                });
                this.ws.send(chunkBuffer);
                eventData.cancel = true;

                for (const block of chunkTrans.rewrittenBlocks) {
                  const payload = {
                    packetId: "BLOCK_MAP",
                    x: block.x,
                    y: block.y,
                    z: block.z,
                    trueBlockId: block.trueBlockId,
                    fallbackId: block.fallbackId
                  };
                  const channelPacket = new SCChannelMessagePacket();
                  channelPacket.channel = "eagler:moderncompat";
                  channelPacket.data = Buffer.from(JSON.stringify(payload), 'utf8');
                  this.write(channelPacket);
                }
              }
            } catch (err) {
              this._logger.error(`Error translating modern packet ${eventData.name}: ${err.stack ?? err}`);
            }
          }

          if (!eventData.cancel) {
            this.ws.send(
              this.serverSerializer.createPacketBuffer({
                name: eventData.name,
                params: eventData.params,
              })
            );
          }
        }
      });
      (this as any)._sendPacketToServer = listener;
    });
  }
}

interface PlayerEvents {
  switchServer: (connection: Client, player: Player) => void;
  joinServer: (connection: Client, player: Player) => void;
  // for vanilla game packets, bind to connection object instead
  proxyPacket: (packet: Packet, player: Player) => void;
  vanillaPacket: (
    packet: {
      name: string;
      params: any;
      cancel: boolean;
    },
    origin: "CLIENT" | "SERVER",
    player: Player
  ) => void;
  disconnect: (player: Player) => void;
}

export declare interface Player {
  on<U extends keyof PlayerEvents>(event: U, listener: PlayerEvents[U]): this;
  once<U extends keyof PlayerEvents>(event: U, listener: PlayerEvents[U]): this;

  emit<U extends keyof PlayerEvents>(event: U, ...args: Parameters<PlayerEvents[U]>): boolean;
}
