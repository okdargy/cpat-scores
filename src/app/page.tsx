import { cookies } from "next/headers";
import Content from "./Content";

export default async function Home() {
  const cookieStore = await cookies();

  let defaultTeams: {
    teamNum: string;
    teamName: string;
    color: string | null;
  }[]

  const teamsEncrypted = cookieStore.get("teams");

  if(!teamsEncrypted) {
    defaultTeams = [];
  } else {
    const teams = JSON.parse(atob(teamsEncrypted.value));
    defaultTeams = teams;
  }

  return (
    <div className="flex h-screen p-3">
      <Content defaultTeams={defaultTeams} />
    </div>
  );
}