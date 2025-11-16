import { z } from 'zod';
import { router, publicProcedure } from './trpc';

const teamIdSchema = z.string().regex(/^\d{2}-\d{4}$/);

type TeamScore = {
    team_id: number;
    team_number: string;
    images: number;
    play_time: string;
    score_time: string;
    ccs_score: string;
    location: string;
    division: string;
    tier: string;
    code: string;
};

type TeamScoreWithRankings = TeamScore & {
    national_rank: number;
    state_rank: number;
};

export const appRouter = router({
    getTeamScores: publicProcedure.input(z.array(teamIdSchema)).mutation(async (opts) => {
        if(opts.input.length == 0) return {}
        
        // Fetch all teams to calculate rankings (unfortunately needed for accurate rankings)
        const allTeamsResponse = await fetch('https://scoreboard.uscyberpatriot.org/api/team/scores.php');
        const allTeamsData = await allTeamsResponse.json();
        const allTeams: TeamScore[] = allTeamsData.data || [];
        
        // Group teams by state/location for state rankings
        const teamsByState = new Map<string, TeamScore[]>();
        allTeams.forEach(team => {
            const location = team.location;
            if (!teamsByState.has(location)) {
                teamsByState.set(location, []);
            }
            teamsByState.get(location)!.push(team);
        });
        
        // Filter to only the requested teams and add rankings
        const requestedTeams = allTeams.filter(team => 
            opts.input.includes(team.team_number)
        );
        
        const teamsWithRankings: TeamScoreWithRankings[] = requestedTeams.map(team => {
            // National rank is the index in the sorted array + 1
            const nationalRank = allTeams.findIndex(t => t.team_number === team.team_number) + 1;
            
            // State rank
            const stateTeams = teamsByState.get(team.location) || [];
            const stateRank = stateTeams.findIndex(t => t.team_number === team.team_number) + 1;
            
            return {
                ...team,
                national_rank: nationalRank,
                state_rank: stateRank
            };
        });
        
        return { data: teamsWithRankings };
    }),
    getAllTeamsWithRankings: publicProcedure.query(async () => {
        const response = await fetch('https://scoreboard.uscyberpatriot.org/api/team/scores.php');
        const data = await response.json();
        const teams: TeamScore[] = data.data || [];

        // Add national rankings (teams are already sorted by ccs_score from the API)
        const teamsWithNationalRank = teams.map((team, index) => ({
            ...team,
            national_rank: index + 1
        }));

        // Group teams by state/location for state rankings
        const teamsByState = new Map<string, TeamScore[]>();
        teams.forEach(team => {
            const location = team.location;
            if (!teamsByState.has(location)) {
                teamsByState.set(location, []);
            }
            teamsByState.get(location)!.push(team);
        });

        // Add state rankings
        const teamsWithRankings: TeamScoreWithRankings[] = teamsWithNationalRank.map(team => {
            const stateTeams = teamsByState.get(team.location) || [];
            const stateRank = stateTeams.findIndex(t => t.team_number === team.team_number) + 1;
            
            return {
                ...team,
                state_rank: stateRank
            };
        });

        return {
            data: teamsWithRankings,
            total_teams: teamsWithRankings.length
        };
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
