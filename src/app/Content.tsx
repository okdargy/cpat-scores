"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Minus, Pencil, Plus, RefreshCcw, FileText, Cog, Grid3x3, StretchHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { setCookie } from "cookies-next";
import { useEffect, useRef, useState } from "react";
import { trpc } from "./_trpc/client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Payload } from "recharts/types/component/DefaultTooltipContent";
import Link from "next/link";
import { ColorPicker } from "@/components/ui/color-picker";
import { TRPCClientError } from "@trpc/client";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface TeamStats {
    teamNum: string;
    score: number;
    state: string;
    division: string;
    nationalRank: number;
    stateRank: number;
}

interface TeamHistoricalStats {
    date: string;
    [key: string]: number | string;
};

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
        return (
            <Card className="bg-card/50">
                <CardHeader>
                    <CardTitle>{new Date(label).toLocaleTimeString()}</CardTitle>
                </CardHeader>
                <CardContent>
                    {payload.map((p: Payload<number, string>) => (
                        <CardDescription key={p.dataKey}>
                            <span style={{ color: p.color }}>{p.dataKey}</span>: {p.value}
                        </CardDescription>
                    ))}
                </CardContent>
            </Card>
        );
    }

    return null;
}

const DEFAULT_COLORS = [
    "#ffadad",
    "#ffd6a5",
    "#caffbf",
    "#9bf6ff",
    "#a0c4ff",
    "#ffc6ff",
];

export default function Content({ defaultTeams }: {
    defaultTeams: {
        teamNum: string;
        teamName: string;
        color: string | null; // from migration
    }[]
}) {
    const [settings, setSettings] = useState<{
        display: "vertical" | "horizontal",
        showLegend: boolean,
        hideButtons: boolean
    }>(() => {
        return {
            display: "vertical",
            showLegend: true,
            hideButtons: false
        };
    });
    const [openSettings, setOpenSettings] = useState(false);
    const [openEdit, setOpenEdit] = useState(false);
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [teams, setTeams] = useState<{ teamNum: string, teamName: string, color: string }[]>(defaultTeams.map(team => ({ ...team, color: team.color || '#fff' })));
    const [teamInputs, setTeamInputs] = useState<{ id: number, teamNum: string, teamName: string, color: string }[]>(defaultTeams.map(team => ({ ...team, color: team.color || '#fff', id: Math.random() })));
    const [teamStats, setTeamStats] = useState<TeamStats[]>(teams.map(team => ({ teamNum: team.teamNum, teamName: team.teamName, score: 0, state: "Unknown", division: "Unknown", nationalRank: 0, stateRank: 0 })));
    const [historicalStats, setHistoricalStats] = useState<TeamHistoricalStats[]>([]);
    const [bulkImportText, setBulkImportText] = useState("");
    const { toast } = useToast();

    const handleColorChange = (id: number, color: string) => {
        setTeamInputs(teamInputs.map((team) => team.id === id ? { ...team, color } : team));
    };

    const handleInputChange = (index: number, field: string, value: string) => {
        const newTeamInputs = [...teamInputs];
        newTeamInputs[index] = { ...newTeamInputs[index], [field]: value };
        setTeamInputs(newTeamInputs);
    };

    const handleRemoveInput = (index: number) => {
        const newTeamInputs = teamInputs.filter((_, i) => i !== index);
        setTeamInputs(newTeamInputs);
    };

    const handleAddInput = () => {
        setTeamInputs([...teamInputs, { id: Math.random(), teamNum: "", teamName: "", color: DEFAULT_COLORS[teamInputs.length % DEFAULT_COLORS.length] }]);
    };

    const handleBulkImport = () => {
        const lines = bulkImportText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const newTeams = lines.map((teamStr, index) => {
            const [teamNum, teamName] = teamStr.split(',').map(part => part.trim());

            if (!teamName) {
                return {
                    id: Math.random(),
                    teamNum: teamNum,
                    teamName: `Team ${teamNum}`,
                    color: DEFAULT_COLORS[(teamInputs.length + index) % DEFAULT_COLORS.length]
                }
            } else {
                return {
                    id: Math.random(),
                    teamNum: teamNum,
                    teamName: teamName,
                    color: DEFAULT_COLORS[(teamInputs.length + index) % DEFAULT_COLORS.length]
                }
            }
        });

        setTeamInputs([...teamInputs, ...newTeams]);
        setBulkImportText("");
        setShowBulkImport(false);
        toast({
            title: "Teams imported",
            description: `Successfully imported ${newTeams.length} team(s)`
        });
    };

    const handleBulkExport = () => {
        const exportText = teamInputs.map(team => `${team.teamNum},${team.teamName}`).join('\n');
        setBulkImportText(exportText);
        toast({
            title: "Teams exported",
            description: `Exported ${teamInputs.length} team(s) to text area`
        });
    };
    
    const saveTeams = (teamsToSave: { teamNum: string, teamName: string, color: string }[]) => {
        if (teamsToSave.some((team) => team.teamNum === "" || team.teamName === "")) {
            toast({
                title: "Invalid team",
                description: "Please make sure all teams have a team number and name"
            });
            return false;
        }

        if (teamsToSave.some((team) => !/^\d{2}-\d{4}$/.test(team.teamNum))) {
            toast({
                title: "Invalid team number",
                description: "Please make sure all team numbers are in the format: xx-xxxx"
            });
            return false;
        }
        
        setCookie("teams", btoa(JSON.stringify(teamsToSave)));
        setTeams(teamsToSave);
        return true;
    };

    const isTeamInputsSame = () => {
        if (teamInputs.length !== teams.length) return false;
        return teamInputs.every((team, index) => team.teamNum === teams[index].teamNum && team.teamName === teams[index].teamName && team.color === teams[index].color);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const filteredTeams = teamInputs.filter((team, index) => teamInputs.findIndex((t) => t.teamNum === team.teamNum) === index);

        if (saveTeams(filteredTeams)) {
            toast({
                title: "Teams saved",
                description: filteredTeams.length === 0 ? "All teams have been removed" : "Teams have been saved successfully"
            });
            
            setOpenEdit(false);
            setTeamStats(filteredTeams.map(team => ({ teamNum: team.teamNum, score: 0, state: "Unknown", division: "Unknown", nationalRank: 0, stateRank: 0 })));
            setHistoricalStats([]);
        }
    };

    const getTeamStats = trpc.getTeamScores.useMutation({
        onSuccess: (response) => {
            if(!response || !('data' in response) || response.data.length === 0) return;
            const filteredData = response.data.filter((team) => teams.map((t) => t.teamNum).includes(team.team_number));

            const tStats = filteredData.map((team) => ({
                teamNum: team.team_number,
                score: parseInt(team.ccs_score),
                state: team.location,
                division: team.division,
                nationalRank: team.national_rank,
                stateRank: team.state_rank,
            }));

            const missingTeamStats = teams.filter((team) => !tStats.map((t) => t.teamNum).includes(team.teamNum)).map((team) => ({
                teamNum: team.teamNum,
                score: 0,
                state: "Unknown",
                division: "Unknown",
                nationalRank: 0,
                stateRank: 0,
            }));

            setTeamStats([...tStats, ...missingTeamStats]);
        }, onError: (error) => {
            toast({
                title: "There was an error fetching the stats for the teams",
                description: "Please try again later.",
            });

            if(error instanceof TRPCClientError) {
                console.log(error.message);
            } else {
                console.log(error);
            }
        }
    })

    const getTeamGraphs = trpc.getTeamGraphs.useMutation({
        onSuccess: (data) => {
            if(Object.keys(data).length === 0) return
            const combinedData: { [key: string]: { date: string, [key: string]: number | string } } = {};

            Object.entries(data).forEach(([team, stats]) => {
                stats.forEach((stat) => {
                    const [datePart, timePart] = stat.time.split(' ');
                    const [month, day] = datePart.split('/');
                    const formattedDate = new Date(`${new Date().getFullYear()}-${month}-${day}T${timePart}:00`).toISOString();

                    if (!combinedData[formattedDate]) combinedData[formattedDate] = { date: formattedDate };
                    combinedData[formattedDate][team] = stat.value;
                });
            });

            const historicalStats = Object.values(combinedData);

            setHistoricalStats(historicalStats);
            console.log('refreshed with', teams.length, 'teams and', historicalStats.length, 'data points as well as', teamStats.length, 'team stats at', new Date().toLocaleTimeString());
            console.log('historical stats', historicalStats);
        }, onError: (error) => {
            toast({
                title: "There was an error fetching data for the graph",
                description: "Are you sure you entered the correct team numbers?",
            });

            if(error instanceof TRPCClientError) {
                console.log(error.message);
            } else {
                console.log(error);
            }
        }
    });

    const getTeamScores = async () => {
        return getTeamStats.mutate(teams.map((team) => team.teamNum));
    }

    const getGraphScores = async () => {
        return getTeamGraphs.mutate(teams.map((team) => team.teamNum));
    }

    const intervalId = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if(teams.length > 0) {
            getTeamScores();
            getGraphScores();

            console.log('loaded with', teams.length, 'teams and', historicalStats.length, 'data points as well as', teamStats.length, 'team stats at', new Date().toLocaleTimeString());
        }

        if (intervalId.current) clearInterval(intervalId.current);
        intervalId.current = setInterval(() => {
            if(teams.length > 0) {
                getTeamScores();
                getGraphScores();
            }
        }, 1000 * 60); // 5 minutes

        return () => {
            if(intervalId.current) clearInterval(intervalId.current);
        };
    }, [teams])

    return (
        <div className="w-full h-full flex">
            {teams.length > 0 ? (
                settings.display === "horizontal" ? (
                    <ResizablePanelGroup
                        key={'main'}
                        direction="horizontal"
                        className="w-full h-full"
                    >
                        <ResizablePanel defaultValue={25} maxSize={50} minSize={25}>
                            <div className="flex flex-col gap-y-2 h-full divide-y min-w-full overflow-y-auto">
                                {teamStats.map((teamStat) => {
                                    const teamName =
                                        teams.find((team) => team.teamNum === teamStat.teamNum)?.teamName || "-";

                                    return (
                                        <Link
                                            href={`https://scoreboard.uscyberpatriot.org/team.php?team=${teamStat.teamNum}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            key={teamStat.teamNum}
                                            className="flex flex-col justify-center h-full my-auto px-5"
                                        >
                                        <div className="flex flex-col gap-y-1">
                                            <div className="flex justify-between items-center gap-x-2">
                                                <div>
                                                    <h3
                                                        className="text-lg font-semibold text-neutral-200 truncate"
                                                        title={teamName}
                                                    >
                                                        {teamName}
                                                    </h3>
                                                    <h1 className="text-5xl font-semibold text-neutral-100 truncate">
                                                        {teamStat.teamNum}
                                                    </h1>
                                                </div>
                                                <div
                                                    className="w-5 h-5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: teams.find((team) => team.teamNum === teamStat.teamNum)?.color }}
                                                />
                                            </div>
                                            {teamStat.state !== "Unknown" ? (
                                                <div className="flex justify-between items-center gap-x-3">
                                                    <h2>
                                                        {teamStat.score}{" "}
                                                        <span className="text-neutral-500 truncate">
                                                            - from {teamStat.state} ({teamStat.division})
                                                        </span>
                                                    </h2>
                                                    <h3 className="text-sm text-neutral-400 whitespace-nowrap">
                                                        #{teamStat.nationalRank} <span className="text-neutral-500">/ #{teamStat.stateRank}</span>
                                                    </h3>
                                                </div>
                                            ) : (
                                                <h2 className="text-neutral-500 truncate">
                                                    Waiting to start...
                                                </h2>
                                            )}
                                        </div> 
                                        </Link>
                                    );
                                })}
                            </div>
                        </ResizablePanel>
                        <ResizableHandle />
                        <ResizablePanel defaultSize={75} minSize={50} maxSize={75} className="p-5 my-auto">
                            <div className="w-full h-full">
                                {(historicalStats.length > 0) ? (
                                    <ResponsiveContainer width={'100%'} height={400}>
                                        <LineChart
                                            data={historicalStats.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())}
                                            margin={{
                                                left: 24,
                                                right: 24,
                                                top: 24,
                                            }}
                                        >
                                            <CartesianGrid vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                tickLine={false}
                                                axisLine={false}
                                                tickMargin={8}
                                                tickFormatter={(date: Date) => new Date(date).toLocaleTimeString()}
                                            />
                                            {
                                                settings.hideButtons ? null : (
                                                    <Tooltip content={<CustomTooltip />} />
                                                )
                                            }
                                            <YAxis tickLine={false} axisLine={false} />
                                            {teams.map((team) => (
                                                <Line
                                                    key={team.teamNum}
                                                    dataKey={team.teamNum}
                                                    fill={team.color}
                                                    type="monotone"
                                                    stroke={team.color}
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex flex-col gap-y-3.5 h-full justify-center items-center text-neutral-400">
                                        <LoaderCircle className="animate-spin" />
                                        <div className="m-auto text-center max-w-lg">
                                            <h1 className="text-neutral-500 font-semibold tracking-wide">
                                                No data to display
                                            </h1>
                                            <h2 className="text-neutral-400 text-sm">
                                                Waiting for more than 1 team to start their round...
                                            </h2>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ResizablePanel>
                    </ResizablePanelGroup>
                ) : (
                    <div className="grid grid-rows-1 w-full gap-y-5 p-3">
                        <div className="w-full h-full">
                            {(historicalStats.length > 0) ? (
                                <ResponsiveContainer width={'100%'} height={'100%'} >
                                    <LineChart
                                        data={historicalStats.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())}
                                        margin={{
                                            left: 0,
                                            right: 0,
                                            top: 0,
                                        }}
                                    >
                                        <CartesianGrid vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                            tickFormatter={(date: Date) => new Date(date).toLocaleTimeString()}
                                        />
                                        {
                                            settings.hideButtons ? null : (
                                                <Tooltip content={<CustomTooltip />} />
                                            )
                                        }
                                        <YAxis tickLine={false} axisLine={false} />
                                        {teams.map((team) => (
                                            <Line
                                                key={team.teamNum}
                                                dataKey={team.teamNum}
                                                fill={team.color}
                                                type="monotone"
                                                stroke={team.color}
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex flex-col gap-y-3.5 h-full justify-center items-center text-neutral-400">
                                    <LoaderCircle className="animate-spin" />
                                    <div className="text-center max-w-lg">
                                        <h1 className="text-neutral-500 font-semibold tracking-wide">
                                            No data to display
                                        </h1>
                                        <h2 className="text-neutral-400 text-sm">
                                            Waiting for more than 1 team to start their round...
                                        </h2>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-x-5 overflow-x-auto no-scrollbar">
                            {teamStats.map((teamStat) => {
                                const teamName =
                                    teams.find((team) => team.teamNum === teamStat.teamNum)?.teamName || "-";

                                return (
                                    <Link
                                        href={`https://scoreboard.uscyberpatriot.org/team.php?team=${teamStat.teamNum}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        key={teamStat.teamNum}
                                        className="border flex flex-col justify-center h-full my-auto px-5 py-3 rounded-lg"
                                        style={{ borderColor: teams.find((team) => team.teamNum === teamStat.teamNum)?.color }}
                                    >
                                        <div className="flex flex-col gap-y-2">
                                            <div className="flex justify-between items-center gap-x-5 min-w-64">
                                                <div>
                                                    <h3
                                                        className="text-lg font-semibold text-neutral-200 truncate"
                                                        title={teamName}
                                                    >
                                                        {teamName}
                                                    </h3>
                                                    <h1 className="text-5xl font-semibold text-neutral-100 truncate">
                                                        {teamStat.teamNum}
                                                    </h1>
                                                </div>

                                            </div>
                                            {teamStat.state !== "Unknown" ? (
                                                <div className="flex justify-between items-center gap-x-4 whitespace-nowrap">
                                                    <h2 className="truncate">
                                                        {teamStat.score}{" "}
                                                        <span className="text-neutral-500">
                                                            - from {teamStat.state} ({teamStat.division})
                                                        </span>
                                                    </h2>
                                                    <h3 className="text-sm text-neutral-400 flex-shrink-0">
                                                        #{teamStat.nationalRank} <span className="text-neutral-500">/ #{teamStat.stateRank}</span>
                                                    </h3>
                                                </div>
                                            ) : (
                                                <h2 className="text-neutral-500 truncate">
                                                    Waiting to start...
                                                </h2>
                                            )}
                                        </div> 
                                    </Link>
                                );
                            })}
                        </div>
                        {settings.showLegend && (
                            <div className="flex gap-x-5">
                                {teamStats.map((teamStat) => {
                                    return (
                                        <div key={teamStat.teamNum + 'legend'} className="flex items-center gap-x-3">
                                            <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: teams.find((team) => team.teamNum === teamStat.teamNum)?.color }}
                                            />
                                            <span className="text-sm text-neutral-300 truncate">{teams.find((team) => team.teamNum === teamStat.teamNum)?.teamName || teamStat.teamNum}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )
            ) : (
                <div className="m-auto text-center max-w-lg space-y-3.5">
                    <div className="space-y-0.5">
                        <h1 className="text-neutral-500 font-semibold tracking-wide">
                            No teams to track
                        </h1>
                        <h2 className="text-neutral-400 text-sm">
                            Add some teams by clicking on the &quot;Edit Teams&quot; button or the pencil icon in the bottom right to get started
                        </h2>
                    </div>
                    <div className="flex gap-x-2 justify-center">
                        <Button onClick={() => setOpenEdit(true)} variant={"outline"}>Edit Teams</Button>
                        <Link href="https://github.com/okdargy/cpat-scores">
                            <Button variant={"outline"}>Star on GitHub</Button>
                        </Link>
                    </div>
                </div>
            )}
            <div className={"absolute bottom-3 right-3 space-x-2 transition-opacity " + (settings.hideButtons ? "opacity-0 hover:opacity-100" : "opacity-50 hover:opacity-100")}>
                <Button variant="outline" className="opacity-50 hover:opacity-100 transition-opacity" onClick={getTeamScores}>
                    <RefreshCcw />
                    Refresh
                </Button>

                <Dialog open={openSettings} onOpenChange={setOpenSettings}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="opacity-50 hover:opacity-100 transition-opacity">
                            <Cog />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogTitle>
                            Settings
                        </DialogTitle>
                        <DialogDescription>
                            Customize how you view team scores and statistics
                        </DialogDescription>
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium">Display Mode</h3>
                                <div className="flex gap-x-2">
                                    <Button
                                        variant={settings.display === "vertical" ? "default" : "outline"}
                                        onClick={() => setSettings({ ...settings, display: "vertical" })}
                                        className="flex-1"
                                    >
                                        <Grid3x3 className="mr-2 h-4 w-4" />
                                        Vertical
                                    </Button>
                                    <Button
                                        variant={settings.display === "horizontal" ? "default" : "outline"}
                                        onClick={() => setSettings({ ...settings, display: "horizontal" })}
                                        className="flex-1"
                                    >
                                        <StretchHorizontal className="mr-2 h-4 w-4" />
                                        Horizontal
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-medium">Display Options</h3>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="showLegend"
                                        checked={settings.showLegend}
                                        onCheckedChange={(checked) => setSettings({ ...settings, showLegend: checked as boolean })}
                                    />
                                    <Label htmlFor="showLegend" className="cursor-pointer">
                                        Show legend below chart
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="hideButtons"
                                        checked={settings.hideButtons}
                                        onCheckedChange={(checked) => setSettings({ ...settings, hideButtons: checked as boolean })}
                                    />
                                    <Label htmlFor="hideButtons" className="cursor-pointer">
                                        Hide control buttons
                                    </Label>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={openEdit} onOpenChange={setOpenEdit}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="opacity-50 hover:opacity-100 transition-opacity">
                            <Pencil />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogTitle>
                            Edit Teams
                        </DialogTitle>
                        <DialogDescription>
                            Enter the teams you want to track below. Customize their names and colors to your preference!
                        </DialogDescription>
                        <div>
                            <div className="space-y-4">
                                {showBulkImport && (
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium">Bulk Import/Export</h3>
                                        <div className="flex gap-x-2">
                                            <Textarea
                                                placeholder={`18-0001,Team Name\n18-0002,Another Team`}
                                                value={bulkImportText}
                                                onChange={(e) => setBulkImportText(e.target.value)}
                                                className="flex-1"
                                            />
                                            <div className="flex flex-col gap-y-2">
                                                <Button 
                                                    type="button" 
                                                    onClick={handleBulkImport} 
                                                    variant={"outline"}
                                                    disabled={!bulkImportText.trim()}
                                                >
                                                    Import
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    onClick={handleBulkExport} 
                                                    variant={"outline"}
                                                    disabled={teamInputs.length === 0}
                                                >
                                                    Export
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <form className="flex flex-col gap-y-3" onSubmit={handleSubmit}>
                                    {teamInputs.map((team, index) => (
                                        <div key={index} className="flex gap-x-3">
                                            <ColorPicker color={team.color} onChange={(color) => handleColorChange(team.id, color)} />
                                            <div className="flex gap-x-2">
                                                <Input
                                                    type="text"
                                                    placeholder="Team Number"
                                                    value={team.teamNum}
                                                    onChange={(e) => handleInputChange(index, "teamNum", e.target.value)}
                                                />
                                                <Input
                                                    type="text"
                                                    placeholder="Team Name"
                                                    value={team.teamName}
                                                    onChange={(e) => handleInputChange(index, "teamName", e.target.value)}
                                                />
                                                <Button type="button" onClick={() => handleRemoveInput(index)} variant={"outline"}>
                                                    <Minus />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex gap-x-2 w-full">
                                        <Button className="w-full" type="submit" variant={"outline"} disabled={isTeamInputsSame()}>
                                            Save Teams
                                        </Button>
                                        <Button type="button" onClick={handleAddInput} variant={"outline"}>
                                            <Plus />
                                        </Button>
                                        <Button 
                                            type="button" 
                                            onClick={() => setShowBulkImport(!showBulkImport)} 
                                            variant={showBulkImport ? "secondary" : "outline"}
                                            title="Toggle bulk import"
                                        >
                                            <FileText />
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
};