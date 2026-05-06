import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { getSessionId } from "./lib/session";
import Lobby from "./components/Lobby";
import Game from "./components/Game";

export interface GameInfo {
  gameId: Id<"games">;
  code: string;
}

const STORAGE_KEY = "scotland-yard-game";

function loadStoredGame(): GameInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameInfo;
  } catch {
    return null;
  }
}

function saveGame(info: GameInfo) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
}

function clearGame() {
  localStorage.removeItem(STORAGE_KEY);
}

// Inner component that verifies the stored game is still active before showing it
function AppInner({ stored, onVerified, onFailed }: {
  stored: GameInfo;
  onVerified: (info: GameInfo) => void;
  onFailed: () => void;
}) {
  const sessionId = getSessionId();
  const active = useQuery(api.games.getActiveGameForSession, { sessionId });

  useEffect(() => {
    if (active === undefined) return; // still loading
    if (active && active.gameId === stored.gameId) {
      onVerified(stored);
    } else if (active) {
      // Player is in a different game (edge case)
      onVerified({ gameId: active.gameId, code: active.code });
    } else {
      onFailed();
    }
  }, [active]);

  return <div className="loading">Rejoining game…</div>;
}

export default function App() {
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [verifying, setVerifying] = useState<GameInfo | null>(() => loadStoredGame());

  function handleJoined(info: GameInfo) {
    saveGame(info);
    setGameInfo(info);
    setVerifying(null);
  }

  function handleLeave() {
    clearGame();
    setGameInfo(null);
  }

  // Verifying stored session
  if (verifying && !gameInfo) {
    return (
      <AppInner
        stored={verifying}
        onVerified={(info) => {
          setVerifying(null);
          setGameInfo(info);
        }}
        onFailed={() => {
          clearGame();
          setVerifying(null);
        }}
      />
    );
  }

  if (gameInfo) {
    return (
      <Game
        gameId={gameInfo.gameId}
        code={gameInfo.code}
        onLeave={handleLeave}
      />
    );
  }

  return <Lobby onJoined={handleJoined} />;
}
