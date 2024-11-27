import { cookies } from "next/headers";
import Content from "./Content";

export default async function Home() {
  const cookieStore = await cookies();

  let defaultTeams: {
    teamNum: string;
    teamName: string;
  }[]

  const teamsEncrypted = cookieStore.get("teams");
  const colorHash = cookieStore.get("colorHash");
  const colorHashValue = colorHash ? parseInt(colorHash.value) : undefined;

  if(!teamsEncrypted) {
    defaultTeams = [];
  } else {
    const teams = JSON.parse(atob(teamsEncrypted.value));
    defaultTeams = teams;
  }

  return (
    <div className="flex h-screen p-3">
      <Content defaultTeams={defaultTeams} colorHash={colorHashValue} />
    </div>
  );
}