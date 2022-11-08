import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwitchBotAuthService } from 'src/database/services/twitch-bot-auth/twitch-bot-auth.service';
import { AccessToken, RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { TwitchPrivateMessage } from '@twurple/chat/lib/commands/TwitchPrivateMessage';
import { Subject, Subscription } from 'rxjs';
import { StreamerGateway } from 'src/twitch/gateways/streamer/streamer.gateway';
import { CronJob, CronTime } from 'cron';
import { StreamerApiService } from 'src/twitch/services/streamer-api/streamer-api.service';
import { HelixBanUserRequest } from '@twurple/api/lib/api/helix/moderation/HelixModerationApi';
import { TwitchUserWithRegisteredBot } from 'src/database/services/twitch-user/twitch-user.service';

export interface CommandStream extends MessageStream {
    command: {
        args: string[];
        msg?: string;
    };
}

export interface MessageStream {
    channel: string;
    username: string;
    message: string;
    pvtMessage: TwitchPrivateMessage;
}

@Injectable()
export class BotChatService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(BotChatService.name);

    private readonly channel: string;
    private botOauthId: string;

    private notifyChatInterval: NodeJS.Timer;
    private prizeRickRollCron: CronJob;
    private luluCount = 0;

    private commandSubscription: Subscription;
    private messageSubscription: Subscription;

    public commandStream = new Subject<CommandStream>();
    public msgStream = new Subject<MessageStream>();

    public client?: ChatClient;

    constructor(
        private configService: ConfigService,
        private twitchBotAuthService: TwitchBotAuthService,
        // @Inject(forwardRef(() => StreamerGateway))
        private streamerGateway: StreamerGateway,
        private streamerApiService: StreamerApiService // TODO Need another chat service for banning lulu
    ) {
        this.channel = this.configService.get('TWITCH_STREAMER_CHANNEL_LISTEN') ?? '';
        this.botOauthId = this.configService.get('TWITCH_BOT_OAUTH_ID') ?? '';
        this.notifyChatInterval = this.createChatNotifyInterval();
        this.prizeRickRollCron = this.createPrizeRickRollCron();

        this.commandSubscription = this.commandStream.subscribe(async (stream: CommandStream) => {
            await this.handleCommand(stream);
        });
        this.messageSubscription = this.msgStream.subscribe(async (stream: MessageStream) => {
            await this.handleMessage(stream);
        });
        console.log('BotChatService Constructor');
    }

    onModuleInit(): any {
        console.log('MODULE INIT BotChatService');
    }

    onModuleDestroy(): any {
        this.commandSubscription.unsubscribe();
        this.messageSubscription.unsubscribe();
    }

    public async clientSay(msg: string) {
        if (!this.client) {
            this.logger.error('Client Not Initialized', msg);
            return;
        }
        await this.client.say(this.channel, msg);
    }

    async init() {
        this.logger.log('BotChatService Async Init');
        await this.initChatClient();
        this.logger.log('BotChatService Done Init');
    }

    private async initChatClient() {
        const twitchUserBotAuth = await this.getTwurpleOptions(this.botOauthId);
        if (!twitchUserBotAuth) {
            this.logger.error('No Bot Auth, BotChatClient cannot be created');
            return;
        }

        const refreshingAuthProvider = this.createTwurpleRefreshingAuthProvider(twitchUserBotAuth);
        if (!refreshingAuthProvider) {
            this.logger.error('No RefreshingAuthProvider, BotChatClient cannot be created');
            return;
        }

        this.client = await this.createChatBotClientAndWaitForConnection(refreshingAuthProvider);
        this.client.onMessage((channel, username, message, pvtMessage: TwitchPrivateMessage) => {
            this.logger.log(`@${username}: ${message}`);

            const formattedMsg = message.trim();

            if (formattedMsg.startsWith('!')) {
                const args = formattedMsg.slice(1).split(' '); // Remove ! and parse arguments after command
                const command = {
                    args,
                    msg: args.shift()?.toLowerCase() // Only get command and modify args in place to exclude command
                };
                this.commandStream.next({ channel, username, message, command, pvtMessage });
            }

            this.msgStream.next({ channel, username, message, pvtMessage });
        });
    }

    private async createChatBotClientAndWaitForConnection(authProvider: RefreshingAuthProvider): Promise<ChatClient> {
        const botChatClient = new ChatClient({
            authProvider,
            isAlwaysMod: true, // https://twurple.js.org/reference/chat/interfaces/ChatClientOptions.html#isAlwaysMod
            channels: [this.channel]
        });

        // 100 requests per 30 seconds
        this.logger.warn('Connecting To Twurple Bot Chat Client...');
        // connect just makes the WSS connection, registration logs you in
        await botChatClient.connect();

        // return botChatClient;
        // Don't return until chat client is registered and connected.
        //  TODO: Very dangerous eh? This blocks the entire app if it can't connect
        return new Promise<ChatClient>(resolve => {
            botChatClient.on(botChatClient.onRegister, () => {
                this.logger.warn('Twitch Bot Registered');
                resolve(botChatClient);
            });
        });
    }

    private createTwurpleRefreshingAuthProvider(
        twitchUserBotAuth: TwitchUserWithRegisteredBot
    ): RefreshingAuthProvider | null {
        if (!twitchUserBotAuth.registeredBotAuth) {
            this.logger.log('No Registered Bot Auth for User', twitchUserBotAuth);
            return null;
        }

        const currentAccessToken: AccessToken = {
            accessToken: twitchUserBotAuth.registeredBotAuth.accessToken,
            refreshToken: twitchUserBotAuth.registeredBotAuth.refreshToken,
            scope: twitchUserBotAuth.registeredBotAuth.scope,
            expiresIn: twitchUserBotAuth.registeredBotAuth.expirySeconds,
            obtainmentTimestamp: twitchUserBotAuth.registeredBotAuth.obtainmentEpoch
        };

        return new RefreshingAuthProvider(
            {
                clientId: this.configService.get('TWITCH_CLIENT_ID') ?? '',
                clientSecret: this.configService.get('TWITCH_CLIENT_SECRET') ?? '',
                onRefresh: async (newTokenData: AccessToken) => {
                    this.logger.warn('New Bot Access Token', newTokenData.accessToken, newTokenData.scope);
                    try {
                        const user = await this.twitchBotAuthService.upsertUserBotAuth(
                            twitchUserBotAuth.oauthId,
                            newTokenData
                        );
                        if (!user) {
                            this.logger.error('Could Not Update User Bot Auth');
                            return;
                        }
                        const botAuth = user.registeredBotAuth;
                        this.logger.warn(
                            `Success Update Twurple Options DB Bot: ${botAuth?.accessToken} - ${botAuth?.expirySeconds} - ${botAuth?.scope}`
                        );
                    } catch (err) {
                        this.logger.error('Error Upserting User Bot Auth', err);
                    }
                }
            },
            currentAccessToken
        );
    }

    private async getTwurpleOptions(oauthId: string): Promise<TwitchUserWithRegisteredBot | null> {
        try {
            const twitchUserBotAuth = await this.twitchBotAuthService.getUniqueTwitchUserWithBotAuth(oauthId);

            if (!twitchUserBotAuth) {
                this.logger.error('No User Found For Bot Auth', twitchUserBotAuth);
                return null;
            }
            if (!twitchUserBotAuth?.registeredBotAuth) {
                this.logger.error('No Registered Bot Auth for User', oauthId);
                return null;
            }

            return twitchUserBotAuth;
        } catch (err) {
            this.logger.error('Error Getting Bot Options From DB', err);
        }

        return null;
    }

    ////////////////////////////////////////////
    ////////////////////////////////////////////
    // TODO Should be in own messaging service

    private randomIntFromInterval(min: number, max: number): number {
        // min and max included
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    private createPrizeRickRollCron(): CronJob {
        // https://crontab.cronhub.io/ second minute hour day of month, months, day of week
        // At 11pm every 2 days, after which, becomes random time
        const cronJob = new CronJob(
            '0 0 23 */2 * *',
            () => {
                if (this.streamerGateway.getCurrentClientsOnSocket > 0) {
                    this.clientSay(`/me OFFICIAL TRAMADC PRIZE DROP ALERT?! https://tinyurl.com/tramaDCPrizeNow`);
                    this.clientSay(`/me OFFICIAL TRAMADC PRIZE DROP ALERT?! https://tinyurl.com/tramaDCPrizeNow`);
                }
                const randomHour = this.randomIntFromInterval(0, 23);
                this.logger.log('New Rick Roll Time', randomHour);
                cronJob.setTime(new CronTime(`0 0 ${randomHour} */2 * *`, 'America/New_York'));
            },
            null,
            true,
            'America/New_York'
        );
        // cronJob.start(); Only if false set for start in new CronJob({})
        return cronJob;
    }

    private createChatNotifyInterval(): NodeJS.Timer {
        return setInterval(() => {
            if (this.streamerGateway.getCurrentClientsOnSocket > 0) {
                this.clientSay(
                    `Remember to use the commands: "!chatban" or "!voiceban", when ${this.channel} gets too emotional. Also rock, paper, scissor: !rps. Also pokemon: https://imgur.com/a/2u62OUh`
                );
            }
        }, 1000 * 60 * 40); // Every 40 minutes
    }
    /**
     * Create and send a Rock, Paper, Scissor url for viewers
     * @param username
     * @private
     */
    private async createRPSUrl(username: string): Promise<void> {
        const randomNum = Math.floor(Math.random() * 100000); // Assign random id to url
        this.clientSay(
            `@${username} wants to play Rock Paper Scissors. https://www.rpsgame.org/room?id=turbosux${randomNum}`
        );
    }

    private async handleCommand(stream: CommandStream) {
        switch (stream.command.msg) {
            case 'ping':
                this.clientSay('pong');
                break;
            case 'dice': {
                const diceRoll = Math.floor(Math.random() * 6) + 1;
                this.clientSay(`@${stream.username} rolled a ${diceRoll}`);
                break;
            }
            case 'rps':
                await this.createRPSUrl(stream.username);
                break;
        }
    }

    private async handleLulu(stream: MessageStream) {
        // Replace whitespace and parse string for lulu
        if (stream.message.toLowerCase().replace(/\s+/g, '').indexOf('lulu') !== -1) {
            switch (this.luluCount) {
                case 0:
                    this.clientSay(`/me Lulu is not allowed on this channel`);
                    this.luluCount++;
                    break;
                case 1:
                    this.clientSay(`/me Next person to say Lulu gets timed out`);
                    this.luluCount++;
                    break;
                case 2:
                    this.clientSay(`/me Look what you've done, @${stream.username}`);
                    try {
                        // Need to use another way to ban from streamer
                        const broadcasterId = this.configService.get('TWITCH_STREAMER_OAUTH_ID') || '';
                        const moderatorId = this.configService.get('TWITCH_STREAMER_OAUTH_ID') || '';
                        const helixBan: HelixBanUserRequest = {
                            duration: 30,
                            reason: 'lulu',
                            userId: stream.pvtMessage.userInfo.userId
                        };
                        this.streamerApiService.client?.moderation
                            .banUser(broadcasterId, moderatorId, helixBan)
                            .catch(err => {
                                this.logger.error('Error banning user', err);
                            });
                        // this.client
                        //     ?.timeout(this.channel, stream.username, 30, 'Lulu')
                        //     .then(sum => {
                        //         console.log('LULU BAN', sum);
                        //     })
                        //     .catch(err => {
                        //         this.logger.error('Error Lulu Ban', err);
                        //     });
                    } catch (err) {
                        this.logger.error('Error Timing Out (Possibly Modded) User');
                        this.logger.error(err);
                    }
                    this.luluCount = 0;
                    break;
                default:
                    this.logger.error(`How did we get here? Count: ${this.luluCount}`);
                    this.luluCount = 0;
            }
        }
    }

    private async handleMessage(msgStream: MessageStream) {
        await this.handleLulu(msgStream);
    }
}
//
