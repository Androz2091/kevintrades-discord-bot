import { ApplicationCommandOptionType, CommandInteractionOptionResolver, PermissionsBitField } from "discord.js";
import { CheckingStatus, Postgres } from "../database";
import { SlashCommandRunFunction } from "../handlers/commands";

export const commands = [
    {
        name: "resume",
        description: "Forces the bot to resume checking"
    }
];

export const run: SlashCommandRunFunction = async (interaction) => {
    
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
        return void interaction.reply({
            content: "You do not have permission to use this command",
            ephemeral: true
        });
    }

    await Postgres.getRepository(CheckingStatus).update({}, {
        cancelled: true
    });


    await interaction.reply({
        content: `Database updated. The bot is now enabled again and will work on regular times.`,
        ephemeral: true
    });
    
}