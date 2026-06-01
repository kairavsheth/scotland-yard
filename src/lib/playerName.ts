const NAME_KEY = "scotland-yard-name";

export function getPlayerName(): string | null {
  return localStorage.getItem(NAME_KEY);
}

export function savePlayerName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim());
}
