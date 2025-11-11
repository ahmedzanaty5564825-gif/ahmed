export enum Shift {
  Morning = 'ص',
  Noon = 'ن',
  Evening = 'م',
}

export const SHIFTS = [Shift.Morning, Shift.Noon, Shift.Evening];

export enum Preference {
  Available = 'available',
  PreferredOff = 'preferred_off',
  Unavailable = 'unavailable',
}

export interface PharmacistPreference {
  [date: string]: {
    [key in Shift]?: Preference;
  };
}

export interface Pharmacist {
  name: string;
  preferences: PharmacistPreference;
  submitted: boolean;
}

// Fix: A mapped type cannot be an interface. Changed to 'type'.
// FIX: Changed ShiftConstraint to be an object with min and max, to align with usage in AdminPanel and geminiService.
export type ShiftConstraint = {
  [key in Shift]: {
    min: number;
    max: number;
  };
};

export interface DayConstraint {
  shifts: ShiftConstraint;
  isHoliday: boolean;
}

export interface RoomConstraints {
  [date: string]: DayConstraint;
}

export interface Schedule {
  [pharmacistName: string]: {
    [date: string]: Shift | null;
  };
}

export interface Room {
  id: string;
  name: string;
  password?: string;
  admin: {
    name: string;
    passwordHash: string;
    isParticipant: boolean;
  };
  startDate: string;
  endDate: string;
  pharmacists: Pharmacist[];
  constraints: RoomConstraints;
  status: 'collecting' | 'generating' | 'complete';
  schedule: Schedule | null;
  aiNotes: string | null;
}