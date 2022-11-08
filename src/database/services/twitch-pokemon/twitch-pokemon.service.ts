import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { Prisma, Pokemon } from '@prisma/client';

interface PokemonRedeem {
    pokemon: Prisma.PokemonUncheckedCreateWithoutTeamInput;
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
            // todo need to figure out way to create pokemon without user, and then create team without user
            // todo Disambiguating relations
            // whats prisma connect do
            // just create a user when creating pokemon
            // const test = await this.prisma.pokemon.create({ data: redemption.pokemon });
            // const team = await this.prisma.pokemonTeam.findUnique({
            //     where: { twitchOauthId: authId },
            //     include: { slot: 1 }
            // });
            //
            // if (!team) {
            //     // In case there is already a team with no pokemon
            //     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //
            //     const query: Prisma.PokemonTeamCreateArgs = {
            //         data: {
            //             twitchOauthId: authId,
            //             pokemon: { createMany: { data: [redemption.pokemon, null, redemption.pokemon] } }
            //             // twitchUser: { create: {} }
            //         }
            //     };
            //     const newTeam = await this.prisma.pokemonTeam.create(query);
            //
            //     console.log('New Team === 0', newTeam);
            //     console.log('New Team === 0');
            //     return;
            // }
            //////////////////////////////
            // if (team.pokemon.length < 6) {
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
