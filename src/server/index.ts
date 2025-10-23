import { z } from 'zod';
import { router, publicProcedure } from './trpc';

const teamIdSchema = z.string().regex(/^\d{2}-\d{4}$/);

export const appRouter = router({
    getTeamScores: publicProcedure.input(z.array(teamIdSchema)).mutation(async (opts) => {
        if(opts.input.length == 0) return {}
        const response = await fetch(`https://scoreboard.uscyberpatriot.org/api/team/scores.php?team[]=${opts.input.join("&team[]=")}`);
        return response.json();
    }),
    getTeamGraphs: publicProcedure.input(z.array(teamIdSchema)).mutation(async (opts) => {
        if(opts.input.length == 0) return {}
        const response = await fetch(`https://scoreboard.uscyberpatriot.org/api/image/chart.php?team[]=${opts.input.join("&team[]=")}`);
        const data = await response.json();

        const organizedData = processData(data, opts.input.length, opts.input);
        return organizedData;
    })
});

type Data = {
    cols: { label: string }[];
    rows: { c: { v: string | number | null }[] }[];
};

type OrganizedData = { [key: string]: { time: string, value: number }[] };

// This is scuffed as hell... WARNING: might lose braincells!
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

    if (numTeams > 1 && !cols[1].label.includes('-')) {
        return teams.reduce((acc, team) => {
            acc[team] = [];
            return acc;
        }, {} as OrganizedData);
    } else {
        const colsRestore = initializeColsRestore(cols);
        const organizedData = initializeOrganizedData(cols, teams);
        
        populateOrganizedData(numTeams, rows, cols, colsRestore, organizedData, teams);

        return organizedData;
    }
}

export type AppRouter = typeof appRouter;
