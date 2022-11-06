import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { Prisma, Pokemon } from '@prisma/client';
import PokemonTeamCreateInput = Prisma.PokemonTeamCreateInput;

interface PokemonRedeem {
    pokemon: any;
    slot: 0 | 1 | 2 | 3 | 4 | 5;
}
@Injectable()
export class TwitchPokemonService {
    constructor(private readonly prisma: PrismaService) {}

    async upsertPokemon(
        where: Prisma.PokemonWhereUniqueInput,
        update: Prisma.PokemonUpdateInput,
        create: Prisma.PokemonCreateInput
    ): Promise<Pokemon> {
        return this.prisma.pokemon.upsert({
            where,
            update,
            create
        });
    }

    async redeemPokemon(redemption: PokemonRedeem, authId: string): Promise<any> {
        return this.prisma.$transaction(async (tx: any) => {
            // const currentPokemonCount = await this.prisma.pokemon.count({ where: { twitchOauthId: authId } });

            const team = await this.prisma.pokemonTeam.findUnique({
                where: { twitchOauthId: authId },
                include: { slot1: true }
            });

            if (!team) {
                // // In case there is already a team with no pokemon
                // const query = {
                //     data: {
                //         twitchOauthId: authId,
                //         slot1: { create: redemption.pokemon }
                //     }
                // };
                // const newTeam = await this.prisma.pokemonTeam.create(query);
                // console.log('New Team === 0', newTeam);
                // return;
            }
            //
            // if (currentPokemonCount < 6) {
            //     const currentTeam = team.pokemon.map(({ id, teamId, ...rest }) => rest);
            //     currentTeam.unshift(redemption.pokemon);
            //
            //     const query: Prisma.PokemonTeamUpdateArgs = {
            //         where: { twitchOauthId: authId },
            //         data: { pokemon: { deleteMany: {}, createMany: { data: currentTeam } } },
            //         include: { pokemon: true }
            //     };
            //
            //     const newTeam = await this.prisma.pokemonTeam.update(query);
            //     console.log('New Team <=6', newTeam);
            //
            //     // console.log('Adding to team', team?.id);
            //     // console.log('Slot', currentPokemonCount + 1);
            //     // // todo problem, cant identify unique pokemon. If i want to update starter in slot 1
            //     // // another problem, if every new pokemon becomes the starter, need to update slots for all other pokemon
            //     // // Make new starter in slot 1
            //     // await this.prisma.pokemon.create({
            //     //     data: { ...pokemon, slot: 1, teamId: team?.id }
            //     // });
            //     return;
            // }
            //
            // const currentTeam = team.pokemon.map(({ id, teamId, ...rest }) => rest);
            // currentTeam[0] = redemption.pokemon;
            //
            // const query: Prisma.PokemonTeamUpdateArgs = {
            //     where: { twitchOauthId: authId },
            //     data: { pokemon: { deleteMany: {}, createMany: { data: currentTeam } } },
            //     include: { pokemon: true }
            // };
            //
            // const newTeam = await this.prisma.pokemonTeam.update(query);
            // console.log('New Team >6', newTeam);
        });
    }
}
