import mongoose from 'mongoose';
const { Schema } = mongoose;

export interface PokemonInterface {
    twitchName: string;
    pokemonName: string;
    pokemonLevel: number;
    pokemonMoves: string[];
    wins: number;
    losses: number;
}

// Mongo size limit is 4mb per record
export const pokemonSchema = new Schema<PokemonInterface>({
    twitchName: String,
    pokemonName: String,
    pokemonLevel: Number,
    pokemonMoves: [String],
    wins: Number,
    losses: Number
});

// Don't want to export / require models for testing purposes
// It might assume we are creating multiple mongoose instances when imported multiple times
mongoose.model<PokemonInterface>('pokemon', pokemonSchema); // 2 arguments mean load into mongoose, 1 means load out like in passport.js
