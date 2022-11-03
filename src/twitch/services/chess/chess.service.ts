import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { BotChatService } from 'src/twitch/services/bot-chat/bot-chat.service';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom, Subscription } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';

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
interface LichessBodyConfigReq {
    headers: {
        Authorization: string;
        'Content-Type': string;
        Accept: string;
    };
}

@Injectable()
export class ChessService implements OnModuleDestroy {
    private readonly logger = new Logger(ChessService.name);
    private commandSubscription: Subscription;

    private lichessBodyReq?: LichessBodyReq;
    private readonly lichessBodyConfigReq?: LichessBodyConfigReq;

    constructor(
        private configService: ConfigService,
        private readonly httpService: HttpService,
        private botChatService: BotChatService
    ) {
        this.lichessBodyConfigReq = {
            headers: {
                Authorization: 'Bearer ' + this.configService.get('LICHESS_AUTH_TOKEN'),
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        this.commandSubscription = this.botChatService.commandStream.subscribe(({ username, command }) => {
            if (command.msg === 'chess') {
                this.createNormalGame(username);
            }
        });
    }

    public onModuleDestroy(): any {
        this.commandSubscription.unsubscribe();
    }

    /**
     * Create and fetch a new game from lichess api
     * @param username
     * @private
     */
    private async createNewLichessGame(username: string): Promise<LichessOpenEndedGame> {
        this.lichessBodyReq = {
            rated: false,
            // 'clock.limit': 3600,
            // 'clock.increment': 0, // how many seconds gained after making a move
            variant: 'standard',
            name: `The Illustrious ${username} vs Super Duper Random Pooper!` // Game name
        };

        const { data }: LichessChallengeRes = await firstValueFrom(
            this.httpService
                .post('https://lichess.org/api/challenge/ope2n', this.lichessBodyReq, this.lichessBodyConfigReq)
                .pipe(
                    catchError((err: AxiosError) => {
                        throw err;
                    })
                )
        );

        const { challenge } = data;
        return {
            id: challenge.id,
            url: challenge.url,
            urlWhite: data.urlWhite,
            urlBlack: data.urlBlack,
            color: challenge.color,
            //
            challenger: challenge.challenger,
            destUser: challenge.destUser,
            //
            status: challenge.status,
            speed: challenge.speed,
            rated: challenge.rated
        };
    }

    /**
     * Create an unranked game and send the url to viewers
     * @param username
     * @private
     */
    private async createNormalGame(username: string): Promise<void> {
        try {
            const normalGame = await this.createNewLichessGame(username);
            this.botChatService.clientSay(
                `@${username} wants to play Chess. If you hate yourself too, click the link to challenge them! ${normalGame.url}`
            );
        } catch (err) {
            this.logger.error('Error Creating Lichess Game', err);
            this.botChatService.clientSay(`Uhoh, couldn't fetch Chess URL :(`);
        }
    }
}
