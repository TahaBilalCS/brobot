/* eslint-disable */
import { Instance } from 'express-ws';
import { ChatClient, PrivateMessage } from '@twurple/chat';
import { OutgoingEvents } from './types/EventsInterface.js';
import process from 'process';
import axios from 'axios';

export interface LichessChallengerUser {
    id: string;
    name: string;
    online: boolean;
    provisional: boolean;
    rating: number;
    title: string;
}

export interface LichessOpenEndedGame {
    id: string;
    url: string;
    urlWhite: string;
    urlBlack: string;
    color: string;

    challenger: LichessChallengerUser;
    destUser: LichessChallengerUser;

    status: string;
    speed: string;
    rated: boolean;
}

export interface LichessCurrentGameStatusRes {
    id: string;
    rated: boolean;
    createdAt: number;
    status: string;
    winner?: string;
}

export interface LichessChallengeRes {
    data: {
        challenge: LichessOpenEndedGame;
        urlWhite: string;
        urlBlack: string;
    };
}

export interface LichessAssignedPlayer {
    user: string;
    url: string;
}

// todo count how many times you lost to a user lichess
export class ChatBan {
    currentVoteCount: number;
    activateCommandThreshold: number;
    uniqueVotedUsers: Set<string>;
    isListening: boolean; // Is ChatBan listening for more messages?
    readonly twitchBotUsername = 'b_robot';

    constructor() {
        // Add bot so it doesn't respond to itself. This is already handled by Twurple.
        this.uniqueVotedUsers = new Set(this.twitchBotUsername);
        this.isListening = true;
        this.currentVoteCount = 0;
        this.activateCommandThreshold = 5;
    }

    resetUniqueVotedUsers(): void {
        this.isListening = true;
        this.resetCurrentVoteCount();
        this.uniqueVotedUsers.clear();
        this.uniqueVotedUsers.add(this.twitchBotUsername);
    }

    getIsListening(): boolean {
        return this.isListening;
    }

    setIsListening(isListening: boolean) {
        this.isListening = isListening;
    }

    incrementCurrentVoteCount(): void {
        this.currentVoteCount++;
    }

    resetCurrentVoteCount(): void {
        this.currentVoteCount = 0;
    }

    getCurrentVoteCount(): number {
        return this.currentVoteCount;
    }

    getActivateCommandThreshold(): number {
        return this.activateCommandThreshold;
    }

    addUniqueUser(username: string): void {
        this.uniqueVotedUsers.add(username);
    }

    isUserUnique(username: string): boolean {
        return !this.uniqueVotedUsers.has(username);
    }
}

export interface LichessGameStatus {
    refreshGameCheckInterval: NodeJS.Timer;
    game: LichessOpenEndedGame;
    cancel?: boolean;
}
export class LichessBot {
    // CONSTS
    private REFRESH_GAME_TIMER;
    channel: string;
    lichessBodyReq: any;
    lichessConfigReq?: any;
    // OTHERS
    player?: LichessAssignedPlayer;
    challenger?: LichessAssignedPlayer;
    // TRANKED
    uniqueCurrentTrankedUsers: Set<string>;
    mapTrankedUserToGameStage: Map<string, LichessGameStatus>;

    constructor(public twurpleChatClient: ChatClient) {
        this.REFRESH_GAME_TIMER = 5000; // todo 1 minute, 60000
        this.channel = process.env.TWITCH_CHANNEL_LISTEN || '';

        this.lichessConfigReq = {
            headers: {
                Authorization: 'Bearer ' + process.env.LICHESS_AUTH_TOKEN,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };

        this.uniqueCurrentTrankedUsers = new Set();
        this.mapTrankedUserToGameStage = new Map();
    }

    async createNewLichessGame(username: string): Promise<LichessOpenEndedGame | undefined> {
        this.lichessBodyReq = {
            rated: false,
            // 'clock.limit': 3600, // todo ask ali // save this var
            // 'clock.increment': 0, // how many seconds gained after making a move
            variant: 'standard',
            name: `The Illustrious ${username} vs Super Duper Random Pooper!` // Game name
        };
        try {
            const res: LichessChallengeRes = await axios.post(
                'https://lichess.org/api/challenge/open',
                this.lichessBodyReq,
                this.lichessConfigReq
            );
            const challenge: LichessOpenEndedGame = res?.data.challenge as LichessOpenEndedGame;
            return {
                id: challenge.id,
                url: challenge.url,
                urlWhite: res.data.urlWhite,
                urlBlack: res.data.urlBlack,
                color: challenge.color,
                //
                challenger: challenge.challenger,
                destUser: challenge.destUser,
                //
                status: challenge.status,
                speed: challenge.speed,
                rated: challenge.rated
            };
        } catch (err) {
            console.log("COULDN'T CREATE LICHESS GAME");
            return undefined;
        }
    }

    async createNormalGame(username: string) {
        let normalGame = await this.createNewLichessGame(username);
        // console.log('Normal Game', normalGame);

        if (normalGame) {
            await this.twurpleChatClient.say(
                this.channel,
                `${username} wants to play Chess. If you hate yourself too, click the link to challenge them! ${normalGame.url}`
            );
        } else {
            await this.twurpleChatClient.say(this.channel, `Uhoh, something broke :(`);
        }
    }
    async createTrankedGame(username: string) {
        // todo check if user not already in game
        let trankedGame = await this.createNewLichessGame(username);
        console.log('Tranked Game', trankedGame);

        if (trankedGame) {
            if (Math.round(Math.random())) {
                this.player = {
                    user: username,
                    url: trankedGame.urlWhite
                };
                this.challenger = {
                    user: 'Random',
                    url: trankedGame.urlBlack
                };
            } else {
                this.player = {
                    user: username,
                    url: trankedGame.urlBlack
                };
                this.challenger = {
                    user: 'Random',
                    url: trankedGame.urlWhite
                };
            }

            await this.twurpleChatClient.say(
                this.channel,
                `/me You know the rules, and so do I. ${username}, click THIS  ${this.player.url}`
            );
            await this.twurpleChatClient.say(
                this.channel,
                `Anyone can click THIS link to challenge ${username}. Beating them will lower their Trank :O ${this.challenger.url}`
            );
        } else {
            await this.twurpleChatClient.say(this.channel, `Uhoh, another thing broke :(`);
        }

        // todo add game and interval into one object, and return that object. also append to list of similar objects
        // setInterval(() => {
        //     const config = {
        //         headers: {
        //             Authorization: 'Bearer ' + process.env.LICHESS_AUTH_TOKEN,
        //             'Content-Type': 'application/json',
        //             Accept: 'application/json'
        //         }
        //     };
        //
        //     console.log('id', id);
        //     axios
        //         .get(`https://lichess.org/game/export/${id}`, config)
        //         .then(res => {
        //             const data = res.data as LichessCurrentGameStatusRes;
        //             if (data.status === 'started') {
        //                 console.log('game started', data);
        //             } else if (data.status === 'draw') {
        //                 console.log('draw');
        //             } else if (data.status === 'mate') {
        //                 console.log('mate', data.winner);
        //             } else if (data.status === 'resign') {
        //                 console.log('resign', data.winner);
        //             } else if (data.status === 'outoftime') {
        //                 console.log('resign', data.winner);
        //             } else {
        //                 console.log('Unknown status: ', data);
        //                 // todo check if winner is present
        //                 // if so update winner
        //                 // if not output error in chat
        //             }
        //         })
        //         .catch(err => {
        //             // todo try get request again it already does with interval once set
        //             console.log('Game not started' /*, err*/);
        //         });
        // }, this.REFRESH_GAME_TIMER); // todo increase chess refresh time
    }
}

export class TwitchInstance {
    angeeCount: number;
    ChatBan: ChatBan;
    LichessBot: LichessBot;
    notifyChatInterval?: NodeJS.Timer;
    prizeRickRollInterval?: NodeJS.Timer;
    TWITCH_CHANNEL_LISTEN = process.env.TWITCH_CHANNEL_LISTEN || '';

    constructor(public twurpleChatClient: ChatClient, public wsInstance: Instance) {
        this.angeeCount = 0;

        console.log('Twitch Chat Handler Initialized');
        // TODO something wrong here, probably shouldnt use this like this heh
        this.twurpleChatClient.onMessage(async (channel, user, message, msg: PrivateMessage) => {
            // Trim whitespace on ends of strings
            const userMsg = message.trim();
            const username = user.trim();
            // Handle commands
            await this.handleCommand(channel, username, userMsg);
            // Handle messages
            await this.handleLulu(channel, username, userMsg);
        });

        // todo nice try bot catch phrase and responsd
        // Chatban
        this.ChatBan = new ChatBan();
        // Lichess
        this.LichessBot = new LichessBot(this.twurpleChatClient);
        // Alert chat every half an hour
        this.notifyChatInterval = this.setChatNotifyInterval();
        // Rick roll
        this.prizeRickRollInterval = this.setPrizeRickRollInterval();
    }

    async handleLulu(channel: string, username: string, message: string): Promise<void> {
        // Lulu ban, replace whitespace with none
        if (message.toLowerCase().replace(/\s+/g, '').indexOf('lulu') !== -1) {
            if (this.angeeCount === 0) {
                await this.twurpleChatClient.say(channel, `/me Lulu is not allowed on this channel`);
                this.angeeCount++;
            } else if (this.angeeCount === 1) {
                await this.twurpleChatClient.say(channel, `/me Next person to say Lulu gets timed out`);
                this.angeeCount++;
            } else if (this.angeeCount === 2) {
                await this.twurpleChatClient.say(channel, `/me Look what you've done, ${username}`);
                await this.twurpleChatClient.timeout(channel, username, 300, 'Lulu'); // todo 5 minutes
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
                    .say(
                        this.TWITCH_CHANNEL_LISTEN,
                        `/me OFFICIAL TRAMADC PRIZE DROP ALERT?! https://tinyurl.com/tramaDCPrizeNow`
                    )
                    .then(() => {
                        this.twurpleChatClient
                            .say(
                                this.TWITCH_CHANNEL_LISTEN,
                                `/me OFFICIAL TRAMADC PRIZE DROP ALERT?! https://tinyurl.com/tramaDCPrizeNow`
                            )
                            .then();
                    });
            }
        }, 1000 * 60 * 60 * 24 * 2);
    }
    setChatNotifyInterval(): NodeJS.Timer {
        return setInterval(() => {
            // Only  notify chat if client connected
            if (this.getListeningClientsOnSocket() > 0) {
                this.twurpleChatClient
                    .say(
                        this.TWITCH_CHANNEL_LISTEN,
                        `Remember to use the command: "!chatban", when Trama gets too emotional` // TODO OVERRIDDEN BY TRAMA
                    )
                    .then();
            }
            console.log(`Clients On Socket: ${this.getListeningClientsOnSocket()}`);
        }, 1000 * 60 * 40);
    }

    getListeningClientsOnSocket(): number {
        return this.wsInstance.getWss().clients.size;
    }

    getChatBan(): ChatBan {
        return this.ChatBan;
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
            case 'chess':
                await this.LichessBot.createNormalGame(username);
                // if (args.length === 0) {
                //     console.log('RULES');
                // } else if (args[0] === 'start') {
                //     await this.LichessBot.createNormalGame(username);
                // } else if (args[0] === 'trank') {
                //     // TODO find better way to async init - Stop Gap
                //     await this.LichessBot.createTrankedGame(username); // todo move this to !chess opponent
                // } else if (args[0] === 'cancel') {
                //     console.log('CANCEL');
                // } else if (args[0] === 'stats') {
                //     console.log('STATS');
                // } else {
                //     console.log("Couldn't Parse Chess Args", args);
                // }
                break;
            case 'ping':
                await this.twurpleChatClient.say(channel, 'pong!');
                break;
            case 'dice':
                const diceRoll = Math.floor(Math.random() * 6) + 1;
                await this.twurpleChatClient.say(channel, `@${username} rolled a ${diceRoll}`);
                break;
            case 'chatban':
                // Always have to reset ongoing events like this when client closes connection (brobotsocket)
                // Only do something if client is listening
                if (this.getListeningClientsOnSocket() > 0) {
                    // If still listening for chatban messages
                    if (this.ChatBan.getIsListening()) {
                        // If unique user
                        if (this.ChatBan.isUserUnique(username)) {
                            this.ChatBan.addUniqueUser(username);
                            this.ChatBan.incrementCurrentVoteCount();
                            await this.twurpleChatClient.say(
                                channel,
                                `Your vote is ${this.ChatBan.getCurrentVoteCount()} of ${this.ChatBan.getActivateCommandThreshold()} >:)`
                            );
                        } else {
                            await this.twurpleChatClient.say(channel, `You already voted, ${username}`);
                        }
                        if (this.ChatBan.getCurrentVoteCount() >= this.ChatBan.getActivateCommandThreshold()) {
                            this.ChatBan.setIsListening(false);
                            // Send CHATBAN event to client
                            this.wsInstance.getWss().clients.forEach(localClient => {
                                // TODO if client === trama
                                localClient.send(OutgoingEvents.CHATBAN);
                                this.twurpleChatClient.say(
                                    channel,
                                    `Vote Requirements Met. Removing ${this.TWITCH_CHANNEL_LISTEN}'s "Enter" key for 5 minutes...`
                                );
                            });
                        }
                    } else {
                        await this.twurpleChatClient.say(
                            channel,
                            'Trama is already caged. Wait until she is free again.'
                        );
                    }
                } else {
                    await this.twurpleChatClient.say(
                        channel,
                        `${this.TWITCH_CHANNEL_LISTEN} is disconnected. This command won't do sheet`
                    );
                }
        }
    }
}
