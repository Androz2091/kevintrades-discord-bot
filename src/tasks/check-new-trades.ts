import { EmbedBuilder } from "@discordjs/builders";
import { Colors, TextChannel } from "discord.js";
import fetch from "node-fetch";
import { MoreThan } from "typeorm";
import { client } from "..";
import { CheckingStatus, DetectedTrade, Postgres } from "../database";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const systemIds = process.env.SYSTEM_IDS!.split(',');

export const crons = [
    `*/${Math.max(5, systemIds.length * 2)} * * * * *`
];

function formatAMPM (date: Date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const formattedMinutes = minutes < 10 ? '0'+minutes : minutes;
    var strTime = hours + ':' + formattedMinutes + ' ' + ampm;
    return strTime;
}

export const run = async () => {

    // the bot should not work on weekends and have a clear daily working times between 9:30 est and 16:00 est

    const status = await Postgres.getRepository(CheckingStatus).findOne({
        where: {
            cancelled: false,
            disabledUntil: MoreThan(new Date())
        }
    });
    if (status) {
        return void console.log(`Paused: ${status.disabledUntil.toLocaleString()}`);
    }

    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();

    const isPauseDay = day === 0 || day === 6;
    const isPauseHour = hour === 9 && minute < 30 || hour === 16 && minute > 0;
    const isPauseTime = isPauseDay || isPauseHour;
    if (isPauseTime) {
        return void console.log(`Paused: ${isPauseDay ? 'Day' : 'Hour'}`);
    }

    if (!Postgres.isInitialized) return;

    for (const systemId of systemIds) {
    
        const res = await (await fetch('https://api.collective2.com/world/apiv3/retrieveSignalsAll', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "systemid": systemId,
                "apikey": process.env.C2_API_KEY
            })
        })).json();

        const detectedTrades = await Postgres.getRepository(DetectedTrade).find({});

        const newClosedTrades = res?.response?.filter((trade: any) => trade.action === 'STC' && !detectedTrades.find((detectedTrade) => detectedTrade.tradeId === `traded-${trade.signal_id}`));
        const newOpenedTrades = res?.response?.filter((trade: any) => trade.action === 'BTO' && !detectedTrades.find((detectedTrade) => detectedTrade.tradeId === `working-${trade.signal_id}`));

        const tradeDescription = (trade: any) => {
            const time = trade.traded_time_unix ? new Date(trade.traded_time_unix * 1000) : new Date(trade.posted_time_unix * 1000);
            return `${trade?.quant || 0} ${trade.action} ${trade.underlying} ${trade.strike} ${trade.putcall} ${trade.expiration} at $${Math.round((trade.traded_price || trade.isLimitOrder || 0) * 100) / 100} at ${formatAMPM(time)} (EST)`;
        };

        const logs = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID!) as TextChannel;

        for (const newClosedTrade of newClosedTrades) {
            await Postgres.getRepository(DetectedTrade).insert({
                systemId,
                tradeId: `traded-${newClosedTrade.signal_id}`,
                description: tradeDescription(newClosedTrade)
            });

            const embed = new EmbedBuilder()
                .setColor(Colors.DarkRed)
                .setAuthor({
                    name: `Kevin closed`,
                    iconURL: client.user!.displayAvatarURL()
                })
                .setDescription(tradeDescription(newClosedTrade));

            logs.send({ embeds: [embed] });
            
            console.log(newClosedTrade)
        }

        for (const newOpenedTrade of newOpenedTrades) {
            await Postgres.getRepository(DetectedTrade).insert({
                systemId,
                tradeId: `working-${newOpenedTrade.signal_id}`,
                description: tradeDescription(newOpenedTrade)
            });

            const embed = new EmbedBuilder()
                .setColor(Colors.DarkGreen)
                .setAuthor({
                    name: `Kevin opened`,
                    iconURL: client.user!.displayAvatarURL()
                })
                .setDescription(tradeDescription(newOpenedTrade));
            
            logs.send({ embeds: [embed] });

            console.log(newOpenedTrade)
        }


        await sleep(1000);

    }

};