import { useState } from "react";
import type { Id } from "../convex/_generated/dataModel";
import Lobby from "./components/Lobby";
import Game from "./components/Game";

export interface GameInfo {
  gameId: Id<"games">;
  code: string;
}

export default function App() {
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);

  if (gameInfo) {
    return (
      <Game
        gameId={gameInfo.gameId}
        code={gameInfo.code}
        onLeave={() => setGameInfo(null)}
      />
    );
  }

  return <Lobby onJoined={setGameInfo} />;
}
