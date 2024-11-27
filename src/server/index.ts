import { z } from 'zod';
import { router, publicProcedure } from './trpc';

const teamIdSchema = z.string().regex(/^\d{2}-\d{4}$/);

export const appRouter = router({
    getTeamScores: publicProcedure.input(z.array(teamIdSchema)).mutation(async (opts) => {
        const response = await fetch(`https://scoreboard.uscyberpatriot.org/api/team/scores.php?team[]=${opts.input.join("&team[]=")}`);
        console.log(response.url);
        return response.json();
    }),
    getTeamGraphs: publicProcedure.input(z.array(teamIdSchema)).mutation(async (opts) => {
        const numTeams = opts.input.length;
        const response = await fetch(`https://scoreboard.uscyberpatriot.org/api/image/chart.php?team[]=${opts.input.join("&team[]=")}`);
        const data = await response.json();

        console.log(response.url);
        const organizedData = processData(data, numTeams, opts.input);
        return organizedData;
    })
});

type Data = {
    cols: { label: string }[];
    rows: { c: { v: string | number | null }[] }[];
};

type OrganizedData = { [key: string]: { time: string, value: number }[] };

function initializeColsRestore(cols: { label: string }[]): { [key: string]: number } {
    return cols
        .filter(col => col.label !== "Time")
        .reduce((acc, col) => {
            acc[col.label] = 0;
            return acc;
        }, {} as { [key: string]: number });
}

function initializeOrganizedData(cols: { label: string }[], teams: string[]): OrganizedData {
    if(teams.length === 1) return { [teams[0]]: [] };

    const organizedData: OrganizedData = {};
    cols.slice(1).forEach(col => {
        const teamNumber = col.label.split('_')[0];
        if (!organizedData[teamNumber]) {
            organizedData[teamNumber] = [];
        }
    });
    return organizedData;
}

function populateOrganizedData(numTeams: number, rows: { c: { v: string | number | null }[] }[], cols: { label: string }[], colsRestore: { [key: string]: number }, organizedData: OrganizedData, teams: string[]): void {
    rows.forEach(row => {
        const time = row.c[0].v as string;
        row.c.slice(1).forEach((cell, index) => {
            let value = cell.v;

            if (cell.v === "null") {
                const p = colsRestore[cols[index + 1].label];
                if (p) {
                    value = p;
                } else {
                    return;
                }
            }

            const teamLabel = cols[index + 1].label;
            const teamNumber = numTeams === 1 ? teams[0] : teamLabel.split('_')[0];

            console.log(teamNumber, time, value);

            colsRestore[teamLabel] = value as number;
            const existingDataPoint = organizedData[teamNumber].find(dataPoint => dataPoint.time === time);

            if (existingDataPoint) {
                if (typeof value === 'number' && value !== null) {
                    existingDataPoint.value += value;
                }
            } else {
                if (typeof value === 'number') {
                    organizedData[teamNumber].push({ time, value });
                }
            }
        });
    });
}

function processData(data: Data, numTeams: number, teams: string[]): OrganizedData {
    const { cols, rows } = data;
    const colsRestore = initializeColsRestore(cols);
    const organizedData = initializeOrganizedData(cols, teams);
    
    console.log(colsRestore, organizedData);
    populateOrganizedData(numTeams, rows, cols, colsRestore, organizedData, teams);
    return organizedData;
}

export type AppRouter = typeof appRouter;
