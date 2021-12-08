import process from 'process';
import { ChatClient } from '@twurple/chat';
import { Instance } from 'express-ws';
import { BattleStreams, Dex, RandomPlayerAI, Teams } from '@pkmn/sim';
import { TeamGenerators } from '@pkmn/randoms';
import mongoose, { QueryOptions } from 'mongoose';
import { PokemonInterface } from '../../models/Pokemon.js';
import { pokedexArr, pokeRoarActions } from './pokemon/pokeInfo.js';
import { OutgoingEvents } from '../types/EventsInterface.js';

enum BattleStatus {
    STOPPED = 'STOPPED',
    PENDING = 'PENDING',
    STARTED = 'STARTED'
}

interface PokemonBattle {
    userStarted?: string;
    userAccepted?: string;
    battleTimer?: NodeJS.Timer;
    battleStatus?: BattleStatus;
}

// todo count how many times you lost to a user lichess
export class Pokemon {
    private _dbPokemon: mongoose.Model<PokemonInterface> = mongoose.model<PokemonInterface>('pokemon');
    private readonly _channel: string = process.env.TWITCH_CHANNEL_LISTEN || ''; // Twitch channel
    private readonly _pokedex: string[] = pokedexArr; // Array of all pokemon strings
    private _battle: PokemonBattle = {};
    private _pokeRoarActionList = pokeRoarActions;

    constructor(private _twurpleChatClient: ChatClient, private _wsInstance: Instance) {
        // test pokemon
        // const pokemon = Dex.forGen(3).species.get('Salamence');
        // console.log(pokemon.randomBattleMoves);
    }
    // todo pokemon lvl up, pokemon battle, pokemon roar (only once an hour)
    async createOrChangePokemon(username: string) {
        // Random int from 0 - 385
        const randomPokeIndex = Math.floor(Math.random() * 385);
        // Convert to pokemon species object to ensure pokemon is usable
        const pokemon = Dex.forGen(3).species.get(this._pokedex[randomPokeIndex]);

        let moves: string[] = [];
        if (!pokemon.randomBattleMoves) {
            moves = ['hyperbeam', 'splash'];
        } else {
            // Need to convert readonly ID moves array into string array
            pokemon.randomBattleMoves.forEach((move, idx) => {
                moves[idx] = move;
            });
        }
        // New pokemon doc update
        const newUserPokemon = {
            twitchName: username,
            pokemonName: pokemon.name,
            pokemonLevel: 1,
            pokemonMoves: moves,
            wins: 0,
            losses: 0
        };

        // upsert will create a doc if not found, new will ensure newPokeDoc contains the newest db obj
        const options: QueryOptions = { upsert: true, new: true };
        const newPokeDoc = await this._dbPokemon
            .findOneAndUpdate({ twitchName: username }, newUserPokemon, options)
            .catch(err => {
                console.log('Error Changing Pokemon\n', err);
            });

        if (newPokeDoc) {
            const randomRoar = this.pickRandomRoar();
            await this._twurpleChatClient.say(
                this._channel,
                `/me ${username}'s Level 1 ${newPokeDoc.pokemonName} roared ${randomRoar}`
            );
            // If the new pokemon has no moves, notify user
            if (!pokemon.randomBattleMoves) {
                await this._twurpleChatClient.say(
                    this._channel,
                    `${username}, your pokemon can only use 'Hyperbeam' & 'Splash'... Details: https://imgur.com/a/2u62OUh`
                );
            }
        } else {
            await this._twurpleChatClient.say(
                this._channel,
                `This wasn't supposed to happen. ${username} failed to change pokemon. The refund police will be notified.`
            );
        }
    }

    pickRandomRoar(): string {
        const randomRoadIndex = Math.floor(Math.random() * (this._pokeRoarActionList.length - 1));
        return this._pokeRoarActionList[randomRoadIndex];
    }

    async handleMessage(username: string, args: string[]): Promise<void> {
        switch (args[0]) {
            // case 'create': // todo refund and remove
            //     await this.createOrChangePokemon(username);
            //     break;
            case 'battle':
                // todo cooldown on battles?
                if (!this._battle.userStarted) await this.createBattle(username);
                // If no user started, create battle
                else if (this._battle.userStarted === username)
                    await this._twurpleChatClient.say(this._channel, `You can't battle yourself, ${username}`);
                else if (!this._battle.userAccepted) await this.acceptBattle(username);
                // If we somehow entered this state
                else
                    await this._twurpleChatClient.say(
                        this._channel,
                        `How unlucky, ${username}. Things might have gotten spammy. Try again later`
                    );
                break;
            // case 'level': // todo refund and remove
            //     await this.levelUpUserPokemon(username);
            //     break;
            // case 'roar': // todo refund and remove
            //     await this.roarUserPokemon(username);
            //     break;
            default:
                await this._twurpleChatClient.say(this._channel, `Pokemon Info: https://imgur.com/a/2u62OUh`);
                break;
        }
    }

    // todo refund police
    async levelUpUserPokemon(username: string) {
        // Level up winner's pokemon
        const res = await this._dbPokemon
            .findOneAndUpdate({ twitchName: username }, { $inc: { pokemonLevel: 1 } })
            .catch(err => {
                console.log('Error Leveling Pokemon\n', err);
            });
        // If level up updated inDB
        if (res) {
            // Note: The response is not the updated document for 'findOneAndUpdate'
            await this._twurpleChatClient.say(
                this._channel,
                `${username}'s ${res.pokemonName} leveled up to ${res.pokemonLevel + 1}!`
            );
        } else {
            await this._twurpleChatClient.say(
                this._channel,
                `${username}, you either don't have a pokemon, or something exploded. The refund police will be notified.`
            );
        }
    }

    async roarUserPokemon(username: string) {
        const userPokeDoc = await this._dbPokemon.findOne({ twitchName: username }).catch(err => {
            console.log('Error Fetching Your Pokemon\n', err);
        });
        if (userPokeDoc) {
            const randomRoar = this.pickRandomRoar();
            this._wsInstance.getWss().clients.forEach(localClient => {
                // TODO if client === trama
                console.log('Send Roar Websocket');
                localClient.send(
                    JSON.stringify({ event: OutgoingEvents.POKEMON_ROAR, pokemonName: userPokeDoc.pokemonName })
                );
            });
            await this._twurpleChatClient.say(
                this._channel,
                `/me ${username}'s Level ${userPokeDoc.pokemonLevel} ${userPokeDoc.pokemonName} roared ${randomRoar}`
            );
        } else {
            await this._twurpleChatClient.say(
                this._channel,
                `${username}, you either don't have a pokemon, or something exploded. As they say, git gud`
            );
        }
    }

    async createBattle(username: string) {
        this._battle.userStarted = username;

        const userPokeDoc = await this._dbPokemon.findOne({ twitchName: username }).catch(err => {
            console.log('Error Fetching Your Pokemon\n', err);
        });

        // If user has pokemon in DB
        if (userPokeDoc) {
            await this._twurpleChatClient.say(
                this._channel,
                `${username}'s Level ${userPokeDoc.pokemonLevel} ${userPokeDoc.pokemonName} wants to start a pokemon battle! You have 1 minute to accept their challenge, by using the command "!pokemon battle"`
            );
            this._battle.battleTimer = setInterval(() => {
                // If timer not cleared yet, then end the pending battle
                if (this._battle.battleTimer) {
                    this._twurpleChatClient.say(
                        this._channel,
                        `Ending pending pokemon battle for ${this._battle.userStarted}. You're just too intimidating man`
                    );
                    clearInterval(this._battle.battleTimer);
                    this._battle = {};
                }
            }, 1000 * 60);
        } else {
            this._battle.userStarted = undefined;
            await this._twurpleChatClient.say(
                this._channel,
                `${username}, you either don't have a pokemon, or something exploded. As they say, git gud`
            );
        }
    }

    async init() {}

    async acceptBattle(username: string) {
        this._battle.userAccepted = username; // Accept here to stop any other requests

        const userStartedPokeDoc = await this._dbPokemon
            .findOne({ twitchName: this._battle.userStarted })
            .catch(err => {
                console.log('Error Fetching Your Pokemon\n', err);
            });
        const userAcceptedPokeDoc = await this._dbPokemon
            .findOne({ twitchName: this._battle.userAccepted })
            .catch(err => {
                console.log('Error Fetching Your Pokemon\n', err);
            });

        if (!userStartedPokeDoc) {
            this._battle.userAccepted = undefined;
            await this._twurpleChatClient.say(
                this._channel,
                `${this._battle.userStarted}, I have failed you. Something went wrong retrieving your stats. Try accepting this battle again.`
            );
        }

        if (!userAcceptedPokeDoc) {
            this._battle.userAccepted = undefined;
            await this._twurpleChatClient.say(
                this._channel,
                `${username}, you tryna fight with your bare hands? Get a pokemon first`
            );
        }

        try {
            if (userStartedPokeDoc && userAcceptedPokeDoc && this._battle.userStarted && this._battle.userAccepted) {
                let winnerName = '';
                let winnerPokeLevel = 0;
                let winnerPokeName = '';

                let noMoveString = '';
                let winningMoveString = '';

                let loserName = '';
                let loserPokeLevel = 0;
                let loserPokeName = '';

                const randomMoveList = [
                    'completely obliterated',
                    'absolutely brutalized',
                    'thoroughly whooped',
                    'downright annihilated',
                    'unreservedly decimated',
                    'utterly devastated',
                    'totally eradicated',
                    'perfectly liquidated',
                    'unconditionally demolished'
                ];

                // Initialize teams and pokemon battle stream
                Teams.setGeneratorFactory(TeamGenerators);
                const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());
                const spec = { formatid: 'gen3customgame' };

                const teamStarted = [
                    {
                        name: userStartedPokeDoc.pokemonName,
                        species: userStartedPokeDoc.pokemonName,
                        gender: '',
                        moves: userStartedPokeDoc.pokemonMoves,
                        ability: '',
                        evs: {},
                        ivs: {},
                        item: '',
                        level: userStartedPokeDoc.pokemonLevel,
                        shiny: false
                    }
                ];

                const teamAccepted = [
                    {
                        name: userAcceptedPokeDoc.pokemonName,
                        species: userAcceptedPokeDoc.pokemonName,
                        gender: '',
                        moves: userAcceptedPokeDoc.pokemonMoves,
                        ability: '',
                        evs: {},
                        ivs: {},
                        item: '',
                        level: userAcceptedPokeDoc.pokemonLevel,
                        shiny: false
                    }
                ];

                // @ts-ignore
                const p1spec = { name: this._battle.userStarted, team: Teams.pack(teamStarted) };
                // @ts-ignore
                const p2spec = { name: this._battle.userAccepted, team: Teams.pack(teamAccepted) };

                const p1 = new RandomPlayerAI(streams.p1);
                const p2 = new RandomPlayerAI(streams.p2);

                // Recommended usage in docs
                // A little weird but using await here will prevent the server from continuing.
                // Seems the way this library works is it initializes some things asynchronously and then
                // lets the stream handle future inputs
                void p1.start().then();
                void p2.start().then();

                void (async () => {
                    let turnCount = 0;
                    let turnChunk = '';
                    for await (turnChunk of streams.omniscient) {
                        // Count total number of turns in simulation
                        if (turnChunk.includes('|turn|')) {
                            turnCount++;
                        }
                    }

                    const indexOfMove = turnChunk.lastIndexOf('|move|');
                    // If winning move found
                    if (indexOfMove !== -1) {
                        const moveUnparsed = turnChunk.substr(indexOfMove);
                        const move = moveUnparsed.split('\n')[0];
                        const winnerMove = move.split('|');
                        winningMoveString = 'used ' + winnerMove[3] + ' and'; // Ice Beam
                    } else {
                        noMoveString = 'mysteriously';
                    }

                    const indexOfWin = turnChunk.lastIndexOf('|win|');
                    // If won
                    if (indexOfWin !== -1) {
                        const winString = turnChunk.substr(indexOfWin);
                        const winner = winString.split('|win|')[1];
                        // Make winner
                        if (winner === this._battle.userStarted) {
                            winnerName = userStartedPokeDoc.twitchName;
                            winnerPokeLevel = userStartedPokeDoc.pokemonLevel;
                            winnerPokeName = userStartedPokeDoc.pokemonName;

                            loserName = userAcceptedPokeDoc.twitchName;
                            loserPokeLevel = userAcceptedPokeDoc.pokemonLevel;
                            loserPokeName = userAcceptedPokeDoc.pokemonName;

                            const randomMoveIndex = Math.floor(Math.random() * (randomMoveList.length - 1));
                            const randomMoveString = randomMoveList[randomMoveIndex];

                            const moveString = noMoveString + winningMoveString; // One or the other is empty
                            await this._twurpleChatClient.say(
                                this._channel,
                                `On turn ${turnCount}, ${winnerName}'s Level ${winnerPokeLevel} ${winnerPokeName} ${moveString} ${randomMoveString} ${loserName}'s Level ${loserPokeLevel} ${loserPokeName}`
                            );

                            let levelUpWinner = true;
                            if (winnerPokeLevel - loserPokeLevel > 20) {
                                levelUpWinner = false;
                                await this._twurpleChatClient.say(
                                    this._channel,
                                    `${winnerName}, your pokemon is over 20 levels higher than your opponents'. You ain't gonna level up from this one`
                                );
                            }

                            if (levelUpWinner) {
                                // Level up winner's pokemon
                                const res = await this._dbPokemon
                                    .findOneAndUpdate(
                                        { twitchName: this._battle.userStarted },
                                        { pokemonLevel: userStartedPokeDoc.pokemonLevel + 1 }
                                    )
                                    .catch(err => {
                                        console.log('Error Leveling Pokemon\n', err);
                                    });
                                // If level up updated inDB
                                if (res) {
                                    await this._twurpleChatClient.say(
                                        this._channel,
                                        `${winnerName}'s ${winnerPokeName} leveled up to ${
                                            userStartedPokeDoc.pokemonLevel + 1
                                        }!`
                                    );
                                }
                            }
                        } else if (winner === this._battle.userAccepted) {
                            winnerName = userAcceptedPokeDoc.twitchName;
                            winnerPokeLevel = userAcceptedPokeDoc.pokemonLevel;
                            winnerPokeName = userAcceptedPokeDoc.pokemonName;

                            loserName = userStartedPokeDoc.twitchName;
                            loserPokeLevel = userStartedPokeDoc.pokemonLevel;
                            loserPokeName = userStartedPokeDoc.pokemonName;

                            const randomMoveIndex = Math.floor(Math.random() * (randomMoveList.length - 1));
                            const randomMoveString = randomMoveList[randomMoveIndex];

                            const moveString = noMoveString + winningMoveString; // One or the other is empty
                            await this._twurpleChatClient.say(
                                this._channel,
                                `On turn ${turnCount}, ${winnerName}'s Level ${winnerPokeLevel} ${winnerPokeName} ${moveString} ${randomMoveString} ${loserName}'s Level ${loserPokeLevel} ${loserPokeName}`
                            );

                            let levelUpWinner = true;
                            if (winnerPokeLevel - loserPokeLevel > 20) {
                                levelUpWinner = false;
                                await this._twurpleChatClient.say(
                                    this._channel,
                                    `${winnerName}, your pokemon is over 20 levels higher than your opponents'. You ain't gonna level up from this one`
                                );
                            }

                            if (levelUpWinner) {
                                // Level up winner's pokemon
                                const res = await this._dbPokemon
                                    .findOneAndUpdate(
                                        { twitchName: this._battle.userAccepted },
                                        { pokemonLevel: userAcceptedPokeDoc.pokemonLevel + 1 }
                                    )
                                    .catch(err => {
                                        console.log('Error Leveling Pokemon\n', err);
                                    });
                                // If level up updated inDB
                                if (res) {
                                    await this._twurpleChatClient.say(
                                        this._channel,
                                        `${winnerName}'s ${winnerPokeName} leveled up to ${
                                            userAcceptedPokeDoc.pokemonLevel + 1
                                        }!`
                                    );
                                }
                            }
                        } else {
                            console.log('winner', winner);
                            console.log('battle', this._battle);
                            await this._twurpleChatClient.say(
                                this._channel,
                                `Oof, could not determine winner. Try again next time or report to the indie police`
                            );
                        }
                    } else {
                        // Assuming the last line contains the tie string
                        const lastNewLineIndex = turnChunk.lastIndexOf('\n');
                        const lastLineString = turnChunk.substr(lastNewLineIndex);
                        if (lastLineString.includes('tie')) {
                            await this._twurpleChatClient.say(this._channel, `It was a...tie?`);
                        } else {
                            // Log this too
                            console.log(`Didn't win and didn't draw? Wtf happened: ${lastLineString}`);
                            await this._twurpleChatClient.say(
                                this._channel,
                                `Didn't win and didn't draw? Wtf happened: ${lastLineString}`
                            );
                        }
                    }
                    // Empty battle regardless of outcome
                    if (this._battle.battleTimer) clearInterval(this._battle.battleTimer);
                    this._battle = {};
                })().then();

                // Write streams but will jump to logic above
                streams.omniscient.write(`>start ${JSON.stringify(spec)}`);
                streams.omniscient.write(`>player p1 ${JSON.stringify(p1spec)}`);
                streams.omniscient.write(`>player p2 ${JSON.stringify(p2spec)}`);
            }
        } catch (err) {
            // Empty battle regardless of outcome
            if (this._battle.battleTimer) clearInterval(this._battle.battleTimer);
            this._battle = {};
            console.log('Error During Pokemon Battle:', err);
            await this._twurpleChatClient.say(this._channel, `Unknown Error During Pokemon Battle. Ending`);
        }
    }
}
