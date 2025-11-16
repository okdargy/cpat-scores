export interface ScoreResponse {
    data: TeamWithRankings[]
}

export interface Team {
    team_id: number
    team_number: string
    images: number
    play_time: string
    score_time: string
    ccs_score: string
    location: string
    division: string
    tier: string
    code: string
}

export interface TeamWithRankings extends Team {
    national_rank: number
    state_rank: number
}

export interface AllTeamsResponse {
    data: TeamWithRankings[]
    total_teams: number
}
