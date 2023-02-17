import { ApplicationCommandOptionType, CommandInteractionOptionResolver, PermissionsBitField } from "discord.js";
import { CheckingStatus, Postgres } from "../database";
import { SlashCommandRunFunction } from "../handlers/commands";

export const commands = [
    {
        name: "pause",
        description: "Pause the detecting bot for X hours",
        options: [
            {
                name: "hours",
                description: "How many hours to pause the bot for",
                type: ApplicationCommandOptionType.Integer,
                required: true
            }
        ]
    }
];

export const run: SlashCommandRunFunction = async (interaction) => {
    
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
        return void interaction.reply({
            content: "You do not have permission to use this command",
            ephemeral: true
        });
    }

    const hours = (interaction.options as CommandInteractionOptionResolver).getInteger("hours", true);

    await Postgres.getRepository(CheckingStatus).update({}, {
        cancelled: true
    });
    
    const disabledUntil = new Date(Date.now() + (hours * 60 * 60 * 1000));

    await Postgres.getRepository(CheckingStatus).insert({
        cancelled: false,
        disabledUntil
    });

    await interaction.reply({
        content: `Database updated. The bot will automatically be re-enabled at ${disabledUntil.toLocaleString('en-US', { timeZone: 'America/New_York' })}.`,
        ephemeral: true
    });
    
}