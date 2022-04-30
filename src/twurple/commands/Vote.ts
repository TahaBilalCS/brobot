import { appenv } from '../../config/appenv.js';
import { twurpleInstance } from '../TwurpleInstance.js';
import { expressSocket } from '../../ws/ExpressSocket.js';
import { OutgoingEvents } from '../types/EventsInterface.js';
import { logger } from '../../utils/LoggerUtil.js';

/**
 * Only implements public properties (from getter)
 */
interface VoteInterface {
    resetUniqueVotedUsers: () => void;
}

/**
 * Handles commands related to Voting
 */
export class Vote implements VoteInterface {
    /**
     * Twitch channel to broadcast messages on
     * @private
     */
    private readonly _channel: string;

    /**
     * Take a wild guess
     * @private
     */
    private _currentVoteCount: number;

    /**
     * Map of all usernames used to avoid duplicate votes
     * @private
     */
    private _uniqueVotedUsers: Set<string>;

    /**
     * Is voting bot listening for more votes?
     * @private true while vote count does not meet threshold
     */
    private _isListening: boolean;

    /**
     *
     * @param _activateVoteThreshold Number of votes needed to activate vote
     * @param _socketEvent ws event to emit on client socket
     * @param _voteMessage message to display when vote requirements met
     */
    constructor(
        private readonly _activateVoteThreshold: number,
        private readonly _socketEvent: OutgoingEvents,
        private readonly _voteMessage: string
    ) {
        this._channel = appenv.TWITCH_CHANNEL_LISTEN;
        this._currentVoteCount = 0;
        this._uniqueVotedUsers = new Set();
        this._isListening = true;
    }

    /**
     * Reset vote count and clear map of users
     */
    public resetUniqueVotedUsers(): void {
        this._resetCurrentVoteCount();
        this._uniqueVotedUsers.clear();
        this._isListening = true;
    }

    /**
     * Increment current vote
     * @private
     */
    private _incrementCurrentVoteCount(): void {
        this._currentVoteCount++;
    }

    /**
     * Reset vote count to 0
     * @private
     */
    private _resetCurrentVoteCount(): void {
        this._currentVoteCount = 0;
    }

    /**
     * Add a unique user to the users map
     * @param username
     * @private
     */
    private _addUniqueUser(username: string): void {
        this._uniqueVotedUsers.add(username);
    }

    /**
     * Check if new user is unique
     * @param username
     * @private true if user unique
     */
    private _isUserUnique(username: string): boolean {
        return !this._uniqueVotedUsers.has(username);
    }

    /**
     * Handle voting bot commands in Twitch chat (chatban or voiceban)
     * @param username
     */
    public async handleMessage(username: string): Promise<void> {
        // Always have to reset ongoing events like this when client closes connection (ExpressSocket)
        // Only do something if client is listening
        if (expressSocket.getListeningClientsOnSocket() > 0) {
            // If still listening for ChatBan votes
            if (this._isListening) {
                // Handle unique/non-unique user votes
                // If unique user
                if (this._isUserUnique(username)) {
                    this._addUniqueUser(username);
                    this._incrementCurrentVoteCount();
                    await twurpleInstance.botChatClient?.say(
                        this._channel,
                        `Your vote is ${this._currentVoteCount} of ${this._activateVoteThreshold} >:)`
                    );
                } else {
                    await twurpleInstance.botChatClient?.say(this._channel, `You already voted, @${username}`);
                }
                // If vote meets threshold
                if (this._currentVoteCount >= this._activateVoteThreshold) {
                    // Stop listening to new votes
                    this._isListening = false;
                    // Send ChatBan ws event to client
                    expressSocket.wsInstance.getWss().clients.forEach(localClient => {
                        // TODO: if client === trama (already authenticated though)
                        logger.info('Sending VoiceBan event to Client');
                        localClient.send(this._socketEvent);
                        void twurpleInstance.botChatClient?.say(
                            this._channel,
                            `Vote Requirements Met. ${this._voteMessage}`
                        );
                    });
                }
            } else {
                await twurpleInstance.botChatClient?.say(
                    this._channel,
                    `${this._channel} is already caged. Wait until they are free again.`
                );
            }
        } else {
            await twurpleInstance.botChatClient?.say(
                this._channel,
                `${this._channel} is disconnected. Voting won't do sheet`
            );
        }
    }
}
