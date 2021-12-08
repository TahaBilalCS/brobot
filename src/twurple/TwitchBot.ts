/* eslint-disable */
import process from 'process';
import { Instance } from 'express-ws';
import { ChatClient, PrivateMessage } from '@twurple/chat';
import { ChatBan } from './commands/ChatBan.js';
import { Chess } from './commands/Chess.js';
import { VoiceBan } from './commands/VoiceBan.js';
import { Pokemon } from './commands/Pokemon.js';
import { RockPaperScissor } from './commands/RockPaperScissor.js';

export class TwitchBot {
    angeeCount: number;
    ChatBan: ChatBan;
    Chess: Chess;
    VoiceBan: VoiceBan;
    Pokemon: Pokemon;
    RPS: RockPaperScissor;

    notifyChatInterval?: NodeJS.Timer;
    prizeRickRollInterval?: NodeJS.Timer;
    private readonly _channel: string;

    constructor(public twurpleChatClient: ChatClient, public wsInstance: Instance) {
        this.angeeCount = 0;
        this._channel = process.env.TWITCH_CHANNEL_LISTEN || '';
        // TODO something wrong here, probably shouldnt use this like this heh
        this.twurpleChatClient.onMessage(async (channel, user, message, msg: PrivateMessage) => {
            // Trim whitespace on ends of strings
            const userMsg = message.trim();
            const username = user.trim().toLowerCase();
            // Handle commands
            await this.handleCommand(channel, username, userMsg);
            // Handle messages
            await this.handleLulu(username, userMsg);
        });

        // Rock, Paper, Scissors
        this.RPS = new RockPaperScissor(this.twurpleChatClient);
        //Pokemon
        this.Pokemon = new Pokemon(this.twurpleChatClient, this.wsInstance);
        // Chatban
        this.ChatBan = new ChatBan(this.twurpleChatClient, this.wsInstance);
        // Lichess
        this.Chess = new Chess(this.twurpleChatClient);
        // Voice Ban
        this.VoiceBan = new VoiceBan(this.twurpleChatClient, this.wsInstance);
        // Alert chat every half an hour
        this.notifyChatInterval = this.setChatNotifyInterval();
        // Rick roll
        this.prizeRickRollInterval = this.setPrizeRickRollInterval();
    }

    async init() {
        // Initialize all asynchronous tasks for twitchbot
        this.twurpleChatClient.onRegister(async () => {
            // TODO async on event register is eh.
            // TODO need to make this stop the bot from going past Twurple.init in index.ts
            console.log('Twitch Bot Initializing');
            // TODO Init async bot operations
            // Example: await this.Pokemon.init();
        });
    }

    async handleLulu(username: string, message: string): Promise<void> {
        // Lulu ban, replace whitespace with none
        if (message.toLowerCase().replace(/\s+/g, '').indexOf('lulu') !== -1) {
            if (this.angeeCount === 0) {
                await this.twurpleChatClient.say(this._channel, `/me Lulu is not allowed on this channel`);
                this.angeeCount++;
            } else if (this.angeeCount === 1) {
                await this.twurpleChatClient.say(
                    this._channel,
                    `/me Next person to say Lulu gets timed out (unless you're a mod -/_-)`
                );
                this.angeeCount++;
            } else if (this.angeeCount === 2) {
                await this.twurpleChatClient.say(this._channel, `/me Look what you've done, ${username}`);
                await this.twurpleChatClient.timeout(this._channel, username, 30, 'Lulu');
                this.angeeCount = 0;
            } else {
                // how did we get here
                this.angeeCount = 0;
            }
        }
    }

    setPrizeRickRollInterval(): NodeJS.Timer {
        return setInterval(() => {
            // todo test if reconnecting will make interval work still: Only  notify chat if client connected
            // todo put production fix database with tokens
            if (this.getListeningClientsOnSocket() > 0) {
                this.twurpleChatClient
                    .say(this._channel, `/me OFFICIAL TRAMADC PRIZE DROP ALERT?! https://tinyurl.com/tramaDCPrizeNow`)
                    .then(() => {
                        void this.twurpleChatClient.say(
                            this._channel,
                            `/me OFFICIAL TRAMADC PRIZE DROP ALERT?! https://tinyurl.com/tramaDCPrizeNow`
                        );
                    });
            }
        }, 1000 * 60 * 60 * 24 * 2);
    }
    setChatNotifyInterval(): NodeJS.Timer {
        return setInterval(() => {
            // Only  notify chat if client connected
            if (this.getListeningClientsOnSocket() > 0) {
                void this.twurpleChatClient.say(
                    this._channel,
                    `Remember to use the commands: "!chatban" or "!voiceban", when Trama gets too emotional. Also rock, paper, scissor: !rps. Also pokemon: https://imgur.com/a/2u62OUh` // TODO OVERRIDDEN BY TRAMA
                );
            }
            console.log(`Clients On Socket: ${this.getListeningClientsOnSocket()}: ${new Date().toLocaleString()}`);
        }, 1000 * 60 * 40);
    }

    getListeningClientsOnSocket(): number {
        return this.wsInstance.getWss().clients.size;
    }

    getChatBan(): ChatBan {
        return this.ChatBan;
    }

    getVoiceBan(): VoiceBan {
        return this.VoiceBan;
    }

    getTwurpleChatClient(): ChatClient {
        return this.twurpleChatClient;
    }

    async handleCommand(channel: string, username: string, message: string): Promise<void> {
        if (!message.startsWith('!')) return;
        const args = message.slice(1).split(' '); // Remove ! and parse arguments after command
        const command = args.shift()?.toLowerCase(); // Only get command

        // STRING = !chess stats
        // COMMAND = chess
        // ARGS = ['stats', ...]
        console.log(`${username}: ${message}`);

        switch (command) {
            case 'pokemon':
                await this.Pokemon.handleMessage(username, args);
                break;
            case 'chess':
                await this.Chess.handleMessage(username);
                break;
            case 'ping':
                await this.twurpleChatClient.say(channel, 'pong!');
                break;
            case 'dice':
                const diceRoll = Math.floor(Math.random() * 6) + 1;
                await this.twurpleChatClient.say(channel, `@${username} rolled a ${diceRoll}`);
                break;
            case 'chatban':
                await this.ChatBan.handleMessage(username);
                break;
            case 'voiceban':
                await this.VoiceBan.handleMessage(username);
                break;
            case 'rps':
                await this.RPS.handleMessage(username);
                break;
        }
    }
}
