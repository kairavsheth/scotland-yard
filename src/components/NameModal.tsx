import { useState } from "react";
import { savePlayerName } from "../lib/playerName";

interface Props {
  onSaved: (name: string) => void;
}

export default function NameModal({ onSaved }: Props) {
  const [name, setName] = useState("");
  const [shake, setShake] = useState(false);

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    savePlayerName(trimmed);
    onSaved(trimmed);
  }

  return (
    <div className="name-modal-overlay">
      <div className="name-modal">
        <img src="/favicon.png" alt="Scotland Yard" className="name-modal-logo" />
        <div className="name-modal-title">
          <h1>Scotland Yard</h1>
          <p>The hidden movement deduction game</p>
        </div>
        <div className="form-group">
          <label htmlFor="player-name">What should we call you?</label>
          <input
            id="player-name"
            type="text"
            placeholder="Enter your name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className={shake ? "input-shake" : ""}
          />
        </div>
        <button className="btn btn-primary btn-full" onClick={handleSubmit}>
          Let's Play →
        </button>
      </div>
    </div>
  );
}
