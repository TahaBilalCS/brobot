/* eslint-disable */
import { Instance } from 'express-ws';
import { ChatClient, PrivateMessage } from '@twurple/chat';
import { OutgoingEvents } from './types/EventsInterface.js';
import process from 'process';

export class ChatBan {
    currentVoteCount: number;
    activateCommandThreshold: number;
    uniqueVotedUsers: Set<string>;
    isListening: boolean; // Is ChatBan listening for more messages?
    readonly twitchBotUsername = 'b_robot';

    constructor() {
        this.isListening = true;
        this.currentVoteCount = 0;
        this.activateCommandThreshold = 2;
        // Add bot so it doesn't respond to itself. This is already handled by Twurple.
        this.uniqueVotedUsers = new Set(this.twitchBotUsername);
    }

    resetUniqueVotedUsers(): void {
        this.isListening = true;
        this.resetCurrentVoteCount();
        this.uniqueVotedUsers.clear();
        this.uniqueVotedUsers.add(this.twitchBotUsername);
        // todo reset intervalo nah
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

export class TwitchInstance {
    ChatBan: ChatBan;
    notifyChatInterval: NodeJS.Timer;

    constructor(public twurpleChatClient: ChatClient, public wsInstance: Instance) {
        console.log('Twitch Chat Handler Initialized');
        // TODO something wrong here, probably shouldnt use this like this heh
        this.twurpleChatClient.onMessage(async (channel, user, message, msg: PrivateMessage) => {
            const userMsg = message.trim().toLowerCase();
            const username = user.trim();
            console.log(`${username}: ${userMsg}`);
            await this.handleMessage(channel, username, userMsg);
        });
        this.ChatBan = new ChatBan();

        // TODO would be nice to separate this and make it not say anything when client not connected
        // Alert chat every half an hour
        const TWITCH_CHANNEL_LISTEN = process.env.TWITCH_CHANNEL_LISTEN || '';
        this.notifyChatInterval = setInterval(() => {
            // Only  notify chat if client connected
            if (this.getListeningClientsOnSocket() > 0) {
                this.twurpleChatClient
                    .say(
                        TWITCH_CHANNEL_LISTEN,
                        `\`Remember to use the command: "!chatban", when ${TWITCH_CHANNEL_LISTEN} gets too emotional\``
                    )
                    .then();
            }
        }, 1000 * 60 * 30);

        // todo handle chatban alert interval function
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

    async handleMessage(channel: string, username: string, message: string): Promise<void> {
        switch (message) {
            case '!ping':
                await this.twurpleChatClient.say(channel, 'pong!');
                break;
            case '!dice':
                const diceRoll = Math.floor(Math.random() * 6) + 1;
                await this.twurpleChatClient.say(channel, `@${username} rolled a ${diceRoll}`);
                break;
            case '!chatban':
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
                                    `Vote Requirements Met. Removing ${process.env.TWITCH_CHANNEL_LISTEN}'s "Enter" key for 5 minutes...`
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
                        `${process.env.TWITCH_CHANNEL_LISTEN} is disconnected. This command won't do sheet`
                    );
                }
        }
    }
}
