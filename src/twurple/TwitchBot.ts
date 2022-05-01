import { logger } from '../utils/LoggerUtil.js';
import { appenv } from '../config/appenv.js';
import { expressSocket } from '../ws/ExpressSocket.js';
import { twurpleInstance } from './TwurpleInstance.js';
import { Chess } from './commands/Chess.js';
import { Pokemon } from './commands/Pokemon.js';
import { Vote } from './commands/Vote.js';
import { OutgoingEvents } from './types/EventsInterface.js';
import { ChatUser, PrivateMessage } from '@twurple/chat';

/**
 * Responds to incoming Twitch chat messages and sets up handlers
 */
export class TwitchBot {
    /**
     * Command used to ban streamer from using their enter key
     * @private
     */
    private readonly _chatBan: Vote;

    /**
     * Command used to ban streamer from using their mic
     * @private
     */
    private readonly _voiceBan: Vote;

    /**
     * Command used to create a Chess url for viewers to play on
     * @private
     */
    private readonly _chess: Chess;

    /**
     * Handles all pokemon related commands
     * @private
     */
    private readonly _pokemon: Pokemon;

    /**
     * Counter for number of times the bot was angered using certain keywords (Lulu)
     * @private
     */
    private _angeeCount: number;

    /**
     * Timed broadcast that sends a message to viewers
     * @private
     */
    private _notifyChatInterval?: NodeJS.Timer;

    /**
     * Timed broadcast that redirects users to a Rick Roll
     * @private
     */
    private _prizeRickRollInterval?: NodeJS.Timer;

    /**
     * Twitch streamer's channel name
     * @private
     */
    private readonly _channel: string;

    /** Getters */
    public get pokemon(): Pokemon {
        return this._pokemon;
    }

    public get chatBan(): Vote {
        return this._chatBan;
    }

    public get voiceBan(): Vote {
        return this._voiceBan;
    }

    constructor() {
        // Init Consts
        this._angeeCount = 0; // Start count at 0
        this._channel = appenv.TWITCH_CHANNEL_LISTEN;
        // Init Bot Commands
        this._pokemon = new Pokemon();
        this._chatBan = new Vote(4, OutgoingEvents.CHATBAN, `Removing ${this._channel}'s "Enter" key for 5 minutes...`);
        this._voiceBan = new Vote(4, OutgoingEvents.VOICEBAN, `Removing ${this._channel}'s voice for 30 seconds...`);
        this._chess = new Chess();
        // Init intervals
        this._notifyChatInterval = this._setChatNotifyInterval(); // Alert chat every half an hour
        this._prizeRickRollInterval = this._setPrizeRickRollInterval(); // Rick roll every 3 days
        // Init onMessage handler
        twurpleInstance.botChatClient?.onMessage((channel, user, message, msg: PrivateMessage) => {
            // Trim whitespace on ends of strings
            const username = user.trim().toLowerCase();
            const userMsg = message.trim();
            const userInfo = msg.userInfo;
            // Funky syntax to handle linting error: i.e: no-misused-promises
            void this._handleCommand(username, userMsg, userInfo).then(() => {
                // Handle messages
                void this._handleLulu(username, userMsg);
                return null;
            });
        });
    }

    /**
     * Initialize asynchronous tasks
     */
    public async init(): Promise<void> {
        // Insert Async Init Operations Here. Example: await this.Pokemon.init();
    }

    /**
     * Parse any combination of the keyword "lulu" and proceed to timeout users who say it frequently
     * @param username
     * @param message
     */
    private async _handleLulu(username: string, message: string): Promise<void> {
        // TODO: Handle case where clever users use an uppercase I for lulu
        // Replace whitespace and parse string for lulu
        if (message.toLowerCase().replace(/\s+/g, '').indexOf('lulu') !== -1) {
            switch (this._angeeCount) {
                case 0:
                    await twurpleInstance.botChatClient?.say(this._channel, `/me Lulu is not allowed on this channel`);
                    this._angeeCount++;
                    break;
                case 1:
                    await twurpleInstance.botChatClient?.say(
                        this._channel,
                        `/me Next person to say Lulu gets timed out (unless modded -/_-)`
                    );
                    this._angeeCount++;
                    break;
                case 2:
                    await twurpleInstance.botChatClient?.say(this._channel, `/me Look what you've done, @${username}`);
                    try {
                        await twurpleInstance.botChatClient?.timeout(this._channel, username, 30, 'Lulu');
                    } catch (err) {
                        logger.error('Error Timing Out (Possibly Modded) User');
                        logger.error(err);
                    }
                    this._angeeCount = 0;
                    break;
                default:
                    logger.error(`How did we get here? Count: ${this._angeeCount}`);
                    this._angeeCount = 0;
            }
        }
    }

    /**
     * Timer that reveals a "prize" url that redirects users to a Rick Roll (every 3 days)
     */
    private _setPrizeRickRollInterval(): NodeJS.Timer {
        return setInterval(() => {
            // TODO: Check for specific client (Trama)
            // Only notify chat if client connected
            if (expressSocket.getListeningClientsOnSocket() > 0) {
                void twurpleInstance.botChatClient?.say(
                    this._channel,
                    `/me OFFICIAL TRAMADC PRIZE DROP ALERT?! https://tinyurl.com/tramaDCPrizeNow`
                );
                void twurpleInstance.botChatClient?.say(
                    this._channel,
                    `/me OFFICIAL TRAMADC PRIZE DROP ALERT?! https://tinyurl.com/tramaDCPrizeNow`
                );
            }
        }, 1000 * 60 * 60 * 24 * 2); // Every 3 days
    }

    /**
     * Timer that notifies viewers of the available bot commands (every 40 minutes)
     */
    private _setChatNotifyInterval(): NodeJS.Timer {
        return setInterval(() => {
            // TODO: Check for specific client (Trama)
            // Only  notify chat if client connected
            if (expressSocket.getListeningClientsOnSocket() > 0) {
                // TODO: Create a commands cheatsheet and link that instead of listing all commands in this message
                void twurpleInstance.botChatClient?.say(
                    this._channel,
                    `Remember to use the commands: "!chatban" or "!voiceban", when Trama gets too emotional. Also rock, paper, scissor: !rps. Also pokemon: https://imgur.com/a/2u62OUh` // TODO: OVERRIDDEN BY TRAMA
                );
            }
            logger.warn(`Clients On Socket: ${expressSocket.getListeningClientsOnSocket()}`);
        }, 1000 * 60 * 40); // Every 40 minutes
    }

    /**
     * Create and send a Rock, Paper, Scissor url for viewers
     * @param username
     * @private
     */
    private async _createRPSUrl(username: string): Promise<void> {
        const randomNum = Math.floor(Math.random() * 100000); // Assign random id to url
        await twurpleInstance.botChatClient?.say(
            this._channel,
            `@${username} wants to play Rock Paper Scissors. https://www.rpsgame.org/room?id=turbosux${randomNum}`
        );
    }

    /**
     * Parse a user message and execute a command if possible
     * No need to worry about bot responding to its' own messages. This is handled by Twurple
     * @param username
     * @param message
     * @param userInfo
     * @private
     */
    private async _handleCommand(username: string, message: string, userInfo: ChatUser): Promise<void> {
        /**
         * Ex:
         * STRING = !chess stats
         * ARGS = ['stats', ...]
         * COMMAND = chess
         */
        if (!message.startsWith('!')) return; // Do nothing if message doesn't start with "!"
        const args = message.slice(1).split(' '); // Remove ! and parse arguments after command
        const command = args.shift()?.toLowerCase(); // Only get command and modify args in place to exclude command

        logger.info(`@${username}: ${message}`);

        switch (command) {
            case 'pokemon':
                await this._pokemon.handleMessage(username, args, userInfo.userId);
                break;
            case 'chess':
                await this._chess.handleMessage(username);
                break;
            case 'ping':
                await twurpleInstance.botChatClient?.say(this._channel, 'pong!');
                break;
            case 'dice': {
                const diceRoll = Math.floor(Math.random() * 6) + 1;
                await twurpleInstance.botChatClient?.say(this._channel, `@${username} rolled a ${diceRoll}`);
                break;
            }
            case 'chatban':
                await this._chatBan.handleMessage(username);
                break;
            case 'voiceban':
                await this._voiceBan.handleMessage(username);
                logger.warn(`Clients On Socket: ${expressSocket.getListeningClientsOnSocket()}`);
                break;
            case 'rps':
                await this._createRPSUrl(username);
                break;
            case 'rpsturbo':
                await this._createRPSUrl(username);
                break;
        }
    }
}
