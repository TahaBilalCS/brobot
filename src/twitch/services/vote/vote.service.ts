import { forwardRef, Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotChatService } from 'src/twitch/services/bot-chat/bot-chat.service';
import { StreamerGateway } from 'src/twitch/gateways/streamer/streamer.gateway';
import { Subscription } from 'rxjs';
import { OutgoingEvents } from 'src/twitch/gateways/streamer/IEvents';

@Injectable()
export class VoteService implements OnModuleDestroy {
    private readonly logger = new Logger(VoteService.name);

    /**
     * Take a wild guess
     * @private
     */
    private currentVoteCount: number;

    /**
     * Map of all usernames used to avoid duplicate votes
     * @private
     */
    private uniqueVoters: Set<string>;

    /**
     * Is voting bot listening for more votes?
     * @private true while vote count does not meet threshold
     */
    private isOn: boolean;

    private isCaged: boolean;

    private commandSubscription: Subscription;

    constructor(
        private configService: ConfigService,
        private botChatService: BotChatService,
        // @Inject(forwardRef(() => StreamerGateway))
        private streamerGateway: StreamerGateway,
        private voteType: string,
        private activateVoteThreshold: number
    ) {
        console.log('VoteService constructor');
        this.currentVoteCount = 0;
        this.uniqueVoters = new Set();
        this.isOn = true;
        this.isCaged = false;
        this.commandSubscription = this.botChatService.commandStream.subscribe(({ username, command }) => {
            if (command.msg === `${this.voteType}`) {
                const userFormatted = username.trim().toLowerCase();
                this.handleMessage(userFormatted);
            }
        });
    }

    public onModuleDestroy(): void {
        this.commandSubscription.unsubscribe();
    }

    private isNewVoter(username: string): boolean {
        return !this.uniqueVoters.has(username);
    }
    /**
     * Reset vote count and clear map of users
     */
    public resetUniqueVotedUsers(isOn = true): void {
        this.currentVoteCount = 0;
        this.uniqueVoters.clear();
        this.isOn = isOn;
        this.isCaged = false;
    }

    public async handleMessage(username: string): Promise<void> {
        // Always have to reset ongoing events like this when client closes connection (ExpressSocket)
        // Only do something if client is listening
        if (this.streamerGateway.getCurrentClientsOnSocket <= 0) {
            this.botChatService.clientSay(
                `${this.configService.get('TWITCH_STREAMER_CHANNEL_LISTEN')} is disconnected. Voting won't do sheet`
            );
            return;
        }
        if (!this.isOn) {
            if (this.voteType === OutgoingEvents.CHATBAN) {
                this.botChatService.clientSay(`!chatban is turned off`);
            } else if (this.voteType === OutgoingEvents.VOICEBAN) {
                this.botChatService.clientSay(`!voiceban is turned off`);
            }
            return;
        }
        if (this.isCaged) {
            this.botChatService.clientSay(
                `${this.configService.get(
                    'TWITCH_STREAMER_CHANNEL_LISTEN'
                )} is already caged. Wait until they are free again`
            );
            return;
        }
        if (this.isNewVoter(username)) {
            this.uniqueVoters.add(username);
            this.currentVoteCount++;
            this.botChatService.clientSay(`Your vote is ${this.currentVoteCount} of ${this.activateVoteThreshold} >:)`);
        } else {
            this.botChatService.clientSay(`You already voted, @${username}`);
        }
        if (this.currentVoteCount >= this.activateVoteThreshold) {
            this.isCaged = true;
            this.streamerGateway.server.clients.forEach((client: any) => {
                this.logger.log(`Sending ${this.voteType} to ${client}`);
                const wsEvent = JSON.stringify({ event: `${this.voteType}`, data: null });
                client.send(wsEvent);
            });
            if (this.voteType === OutgoingEvents.CHATBAN) {
                this.botChatService.clientSay(
                    `Removing ${this.configService.get(
                        'TWITCH_STREAMER_CHANNEL_LISTEN'
                    )}'s "Enter" key for 5 minutes...`
                );
            } else if (this.voteType === OutgoingEvents.VOICEBAN) {
                this.botChatService.clientSay(
                    `Removing ${this.configService.get('TWITCH_STREAMER_CHANNEL_LISTEN')}'s voice for 30 seconds...`
                );
            }
        }
    }
}
