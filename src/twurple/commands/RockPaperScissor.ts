import process from 'process';
import { ChatClient } from '@twurple/chat';

interface RPSBattle {
    userStarted: string | undefined;
    userStartedChoice: string | undefined;
    userAccepted: string | undefined;
    userAcceptedChoice: string | undefined;
}
export class RockPaperScissor {
    private _battle: RPSBattle = {
        userStarted: undefined,
        userStartedChoice: undefined,
        userAccepted: undefined,
        userAcceptedChoice: undefined
    };
    private _versusTimer: NodeJS.Timer | undefined;
    private readonly _channel: string; // Twitch channel

    constructor(private _twurpleChatClient: ChatClient) {
        this._channel = process.env.TWITCH_CHANNEL_LISTEN || '';
        this._twurpleChatClient.onWhisper((user, msg) => {
            const choice = msg.toLowerCase();
            // If valid user whispered and they haven't made a choice yet
            if (user === this._battle.userStarted && !this._battle.userStartedChoice) {
                if (choice === 'rock' || choice === 'paper' || choice === 'scissor') {
                    this._battle.userStartedChoice = choice;
                }
            } else if (user === this._battle.userAccepted && !this._battle.userAcceptedChoice) {
                if (choice === 'rock' || choice === 'paper' || choice === 'scissor') {
                    this._battle.userAcceptedChoice = choice;
                }
            }

            if (
                this._battle.userStarted &&
                this._battle.userAccepted &&
                this._battle.userStartedChoice &&
                this._battle.userAcceptedChoice
            ) {
                if (this._battle.userStartedChoice === this._battle.userAcceptedChoice) {
                    this._twurpleChatClient.say(this._channel, `It was a tie with ${this._battle.userStartedChoice}!`);
                } else if (this._battle.userStartedChoice === 'rock') {
                    if (this._battle.userAcceptedChoice === 'paper') {
                        this._twurpleChatClient.say(this._channel, `${this._battle.userAccepted} won with paper!`);
                    } else if (this._battle.userAcceptedChoice === 'scissor') {
                        this._twurpleChatClient.say(this._channel, `${this._battle.userStarted} won with rock!`);
                    }
                } else if (this._battle.userStartedChoice === 'paper') {
                    if (this._battle.userAcceptedChoice === 'rock') {
                        this._twurpleChatClient.say(this._channel, `${this._battle.userStarted} won with paper!`);
                    } else if (this._battle.userAcceptedChoice === 'scissor') {
                        this._twurpleChatClient.say(this._channel, `${this._battle.userAccepted} won with scissor!`);
                    }
                } else if (this._battle.userStartedChoice === 'scissor') {
                    if (this._battle.userAcceptedChoice === 'paper') {
                        this._twurpleChatClient.say(this._channel, `${this._battle.userStarted} won with scissor!`);
                    } else if (this._battle.userAcceptedChoice === 'rock') {
                        this._twurpleChatClient.say(this._channel, `${this._battle.userAccepted} won with rock!`);
                    }
                }
                // Clear pending battle
                if (this._versusTimer) clearInterval(this._versusTimer);
                this._battle = {
                    userStarted: undefined,
                    userStartedChoice: undefined,
                    userAccepted: undefined,
                    userAcceptedChoice: undefined
                };
            }
        });
    }

    async _createBattle(username: string): Promise<void> {
        this._battle.userStarted = username;
        await this._twurpleChatClient.say(
            this._channel,
            `${username} wants to play Rock Paper Scissors. You have 1 minute to accept their challenge, by using the command "!rps" `
        );
        this._versusTimer = setInterval(() => {
            // If timer not cleared yet, then end the pending battle
            if (this._versusTimer) {
                this._twurpleChatClient.say(this._channel, `Ending pending RPS battle for ${this._battle.userStarted}`);
                clearInterval(this._versusTimer);
                this._battle = {
                    userStarted: undefined,
                    userStartedChoice: undefined,
                    userAccepted: undefined,
                    userAcceptedChoice: undefined
                };
            }
        }, 1000 * 60);
    }

    async _acceptBattle(username: string): Promise<void> {
        this._battle.userAccepted = username; // Accept here to stop any other requests
        await this._twurpleChatClient.say(
            this._channel,
            `Commencing RPS battle for ${this._battle.userStarted} and ${this._battle.userAccepted}. Whisper one of these choices to b_robot, "rock", "paper", "scissor"`
        );
    }

    async handleMessage(username: string): Promise<void> {
        // If no user started
        if (!this._battle.userStarted) {
            await this._createBattle(username);
        } else if (this._battle.userStarted === username) {
            await this._twurpleChatClient.say(this._channel, `${username}, you can't battle yourself (ㆆ_ㆆ)`);
        } else if (!this._battle.userAccepted) {
            await this._acceptBattle(username);
        } else {
            await this._twurpleChatClient.say(this._channel, `There is an already pending battle.`);
        }
    }
}
