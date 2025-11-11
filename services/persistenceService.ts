
import { Room } from '../types';

const getRoomKey = (roomId: string) => `pharmacy-schedule-room-${roomId}`;

export const saveRoom = (room: Room): void => {
  try {
    const roomJson = JSON.stringify(room);
    localStorage.setItem(getRoomKey(room.id), roomJson);
  } catch (error) {
    console.error('Failed to save room to localStorage', error);
  }
};

export const getRoom = (roomId: string): Room | null => {
  try {
    const roomJson = localStorage.getItem(getRoomKey(roomId));
    if (!roomJson) {
      return null;
    }
    return JSON.parse(roomJson) as Room;
  } catch (error) {
    console.error('Failed to get room from localStorage', error);
    return null;
  }
};
