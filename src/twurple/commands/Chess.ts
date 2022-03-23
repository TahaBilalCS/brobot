import { appenv } from '../../config/appenv';
import axios from 'axios';
import { twurpleInstance } from '../TwurpleInstance';
import { logger } from '../../utils/logger';

/**
 * A user on the Lichess website
 */
export interface LichessUser {
    id: string;
    name: string;
    online: boolean;
    provisional: boolean;
    rating: number;
    title: string;
}

/**
 * Lichess open ended game request
 */
export interface LichessOpenEndedGame {
    id: string;
    url: string;
    urlWhite: string;
    urlBlack: string;
    color: string;

    challenger: LichessUser;
    destUser: LichessUser;

    status: string;
    speed: string;
    rated: boolean;
}

/**
 * Response creating Lichess challenge
 */
export interface LichessChallengeRes {
    data: {
        challenge: LichessOpenEndedGame;
        urlWhite: string;
        urlBlack: string;
    };
}

/**
 * Designated player type (challenger or player)
 */
export interface LichessAssignedPlayer {
    user: string;
    url: string;
}

/**
 * Status of a lichess game
 */
export interface LichessGameStatus {
    refreshGameCheckInterval: NodeJS.Timer;
    game: LichessOpenEndedGame;
    cancel?: boolean;
}

/**
 * Lichess body request
 */
interface LichessBodyReq {
    rated: boolean;
    // 'clock.limit': 3600,
    // 'clock.increment': 0, // how many seconds gained after making a move
    variant: string;
    name: string;
}

/**
 * Lichess config for request
 */
interface LichessConfigReq {
    headers: {
        Authorization: string;
        'Content-Type': string;
        Accept: string;
    };
}

/**
 * Handles Chess related commands
 */
export class Chess {
    /**
     * Interval (millisecond) for getting game state
     * @private
     */
    private REFRESH_GAME_TIMER;

    /**
     * Streamer channel to broadcast messages to
     * @private
     */
    private readonly _channel: string;

    /**
     * Body request
     */
    private _lichessBodyReq?: LichessBodyReq;

    /**
     * Body request config
     */
    private readonly _lichessConfigReq?: LichessConfigReq;

    /**
     * User who is being challenged
     */
    // private _player?: LichessAssignedPlayer;

    /**
     * User who is challenging another user
     */
    // private _challenger?: LichessAssignedPlayer;

    /**
     * TODO: Use for later ranked matches
     */
    // private _uniqueCurrentTrankedUsers: Set<string>;
    // private _mapTrankedUserToGameStage: Map<string, LichessGameStatus>;

    constructor() {
        this.REFRESH_GAME_TIMER = 5000; // todo 1 minute, 60000. Implement with later changes
        this._channel = appenv.TWITCH_CHANNEL_LISTEN;

        this._lichessConfigReq = {
            headers: {
                Authorization: 'Bearer ' + appenv.LICHESS_AUTH_TOKEN,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };

        // this._uniqueCurrentTrankedUsers = new Set();
        // this._mapTrankedUserToGameStage = new Map();
    }

    async _createNewLichessGame(username: string): Promise<LichessOpenEndedGame | undefined> {
        this._lichessBodyReq = {
            rated: false,
            // 'clock.limit': 3600,
            // 'clock.increment': 0, // how many seconds gained after making a move
            variant: 'standard',
            name: `The Illustrious ${username} vs Super Duper Random Pooper!` // Game name
        };
        try {
            const res: LichessChallengeRes = await axios.post(
                'https://lichess.org/api/challenge/open',
                this._lichessBodyReq,
                this._lichessConfigReq
            );
            const challenge: LichessOpenEndedGame = res?.data.challenge;
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
            logger.error('Error Creating Lichess Game');
            logger.error(err);
            return undefined;
        }
    }

    async _createNormalGame(username: string): Promise<void> {
        const normalGame = await this._createNewLichessGame(username);

        if (normalGame) {
            await twurpleInstance.botChatClient?.say(
                this._channel,
                `@${username} wants to play Chess. If you hate yourself too, click the link to challenge them! ${normalGame.url}`
            );
        } else {
            await twurpleInstance.botChatClient?.say(this._channel, `Uhoh, something broke :(`);
        }
    }

    async handleMessage(username: string): Promise<void> {
        await this._createNormalGame(username);

        // TODO: Will implement more chess commands when Twitch extension is created
        // if (args.length === 0) {
        //     logger.info('RULES');
        // } else if (args[0] === 'start') {
        //     await this.LichessBot.createNormalGame(username);
        // } else if (args[0] === 'trank') {
        //     // TODO find better way to async init - Stop Gap
        //     await this.LichessBot.createTrankedGame(username); // todo move this to !chess opponent
        // } else if (args[0] === 'cancel') {
        //     logger.info('CANCEL');
        // } else if (args[0] === 'stats') {
        //    logger.info('STATS');
        // } else {
        //    logger.info("Couldn't Parse Chess Args", args);
        // }
    }
}
