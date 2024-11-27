export interface ScoreResponse {
    data: Team[]
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
