/* eslint-disable */
import { appenv } from '../../config/appenv.js';
import axios from 'axios';
import { twurpleInstance } from '../TwurpleInstance.js';

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

export interface LichessGameStatus {
    refreshGameCheckInterval: NodeJS.Timer;
    game: LichessOpenEndedGame;
    cancel?: boolean;
}

export class Chess {
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

    constructor() {
        this.REFRESH_GAME_TIMER = 5000; // todo 1 minute, 60000
        this.channel = appenv.TWITCH_CHANNEL_LISTEN;

        this.lichessConfigReq = {
            headers: {
                Authorization: 'Bearer ' + appenv.LICHESS_AUTH_TOKEN,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };

        this.uniqueCurrentTrankedUsers = new Set();
        this.mapTrankedUserToGameStage = new Map();
    }

    async _createNewLichessGame(username: string): Promise<LichessOpenEndedGame | undefined> {
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

    async _createNormalGame(username: string): Promise<void> {
        const normalGame = await this._createNewLichessGame(username);
        // console.log('Normal Game', normalGame);

        if (normalGame) {
            await twurpleInstance.botChatClient?.say(
                this.channel,
                `${username} wants to play Chess. If you hate yourself too, click the link to challenge them! ${normalGame.url}`
            );
        } else {
            await twurpleInstance.botChatClient?.say(this.channel, `Uhoh, something broke :(`);
        }
    }

    async handleMessage(username: string): Promise<void> {
        await this._createNormalGame(username);

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
    }
}

// export interface LichessCurrentGameStatusRes {
//     id: string;
//     rated: boolean;
//     createdAt: number;
//     status: string;
//     winner?: string;
// }

//     async createTrankedGame(username: string): Promise<void> {
//         // todo check if user not already in game
//         let trankedGame = await this.createNewLichessGame(username);
//         console.log('Tranked Game', trankedGame);
//
//         if (trankedGame) {
//             if (Math.round(Math.random())) {
//                 this.player = {
//                     user: username,
//                     url: trankedGame.urlWhite
//                 };
//                 this.challenger = {
//                     user: 'Random',
//                     url: trankedGame.urlBlack
//                 };
//             } else {
//                 this.player = {
//                     user: username,
//                     url: trankedGame.urlBlack
//                 };
//                 this.challenger = {
//                     user: 'Random',
//                     url: trankedGame.urlWhite
//                 };
//             }
//
//             await this.twurpleChatClient.say(
//                 this.channel,
//                 `/me You know the rules, and so do I. ${username}, click THIS  ${this.player.url}`
//             );
//             await this.twurpleChatClient.say(
//                 this.channel,
//                 `Anyone can click THIS link to challenge ${username}. Beating them will lower their Trank :O ${this.challenger.url}`
//             );
//         } else {
//             await this.twurpleChatClient.say(this.channel, `Uhoh, another thing broke :(`);
//         }
//
//         // todo add game and interval into one object, and return that object. also append to list of similar objects
//         setInterval(() => {
//             const config = {
//                 headers: {
//                     Authorization: 'Bearer ' + process.env.LICHESS_AUTH_TOKEN,
//                     'Content-Type': 'application/json',
//                     Accept: 'application/json'
//                 }
//             };
//
//             console.log('id', id);
//             axios
//                 .get(`https://lichess.org/game/export/${id}`, config)
//                 .then(res => {
//                     const data = res.data as LichessCurrentGameStatusRes;
//                     if (data.status === 'started') {
//                         console.log('game started', data);
//                     } else if (data.status === 'draw') {
//                         console.log('draw');
//                     } else if (data.status === 'mate') {
//                         console.log('mate', data.winner);
//                     } else if (data.status === 'resign') {
//                         console.log('resign', data.winner);
//                     } else if (data.status === 'outoftime') {
//                         console.log('resign', data.winner);
//                     } else {
//                         console.log('Unknown status: ', data);
//                         // todo check if winner is present
//                         // if so update winner
//                         // if not output error in chat
//                     }
//                 })
//                 .catch(err => {
//                     // todo try get request again it already does with interval once set
//                     console.log('Game not started' /*, err*/);
//                 });
//         }, this.REFRESH_GAME_TIMER); // todo increase chess refresh time
//     }
