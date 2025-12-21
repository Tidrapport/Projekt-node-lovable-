export interface TimeEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  project: string;
  activity: string;
  description?: string;
  totalHours: number;
}

export const PROJECT_OPTIONS = [
  "Spårunderhåll",
  "Signalarbete",
  "Elarbete",
  "Kontaktledning",
  "Administration",
  "Utbildning",
  "Annat"
];

export const ACTIVITY_OPTIONS = [
  "Konstruktion",
  "Underhåll",
  "Reparation",
  "Inspektion",
  "Dokumentation",
  "Möte",
  "Resor",
  "Annat"
];
