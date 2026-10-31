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

// Organize image-score history for Recharts. With several teams, image columns
// are summed per team and timestamp. With one team, each image category gets
// its own series so users can inspect the individual image scores.
function processData(data: Data, numTeams: number, teams: string[]): OrganizedData {
    const cols = data?.cols ?? [];
    const rows = data?.rows ?? [];
    if (cols.length < 2 || teams.length === 0) return {};

    // The upstream API sometimes returns a non-team table for multi-team
    // requests. Preserve the existing empty-series behavior for that response.
    if (numTeams > 1 && cols[1] && !cols[1].label.includes('-')) {
        return teams.reduce((acc, team) => {
            acc[team] = [];
            return acc;
        }, {} as OrganizedData);
    }

    const singleTeam = numTeams === 1;
    const lastValueByColumn: Record<string, number> = {};
    const seriesKeys = cols.slice(1).map((col) => {
        if (!singleTeam) return col.label.split('_')[0];

        let category = col.label;
        const teamNum = teams[0];
        if (category.startsWith(teamNum)) {
            category = category.slice(teamNum.length).replace(/^[_\-\s]+/, '');
        }
        category = category.replace(/_/g, ' ').trim();
        return `${teamNum} | ${category || 'Image score'}`;
    });

    const organizedData: OrganizedData = {};
    seriesKeys.forEach((key) => {
        if (!organizedData[key]) organizedData[key] = [];
    });

    rows.forEach((row) => {
        const time = String(row.c?.[0]?.v ?? '');
        row.c.slice(1).forEach((cell, index) => {
            const columnLabel = cols[index + 1]?.label;
            const seriesKey = seriesKeys[index];
            if (!columnLabel || !seriesKey || !time) return;

            let rawValue: string | number | null = cell.v;
            if (rawValue === 'null' || rawValue === null) {
                const previousValue = lastValueByColumn[columnLabel];
                if (previousValue === undefined) return;
                rawValue = previousValue;
            }

            const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
            if (!Number.isFinite(value)) return;
            lastValueByColumn[columnLabel] = value;

            const series = organizedData[seriesKey];
            const existingPoint = series.find((point) => point.time === time);
            if (existingPoint) existingPoint.value += value;
            else series.push({ time, value });
        });
    });

    return organizedData;
}

export type AppRouter = typeof appRouter;
