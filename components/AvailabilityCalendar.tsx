
import React from 'react';
import { Room, Preference, Shift, SHIFTS, Pharmacist } from '../types';

interface AvailabilityCalendarProps {
  room: Room;
  setRoom: (room: Room) => void;
  currentUser: string;
}

const PREFERENCE_COLORS: { [key in Preference]: string } = {
  [Preference.Available]: 'bg-green-500 hover:bg-green-600',
  [Preference.PreferredOff]: 'bg-blue-500 hover:bg-blue-600',
  [Preference.Unavailable]: 'bg-red-500 hover:bg-red-600',
};

const PREFERENCE_CYCLE: Preference[] = [Preference.Available, Preference.PreferredOff, Preference.Unavailable];

const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({ room, setRoom, currentUser }) => {
  const dates = [];
  let currentDate = new Date(room.startDate);
  const endDate = new Date(room.endDate);

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const currentPharmacist = room.pharmacists.find(p => p.name === currentUser) || (room.admin.isParticipant && room.admin.name === currentUser ? { name: currentUser, preferences: {}, submitted: false } as Pharmacist : null);

  if (!currentPharmacist) return <p>لا يمكنك تعديل الأوقات.</p>;

  const handlePreferenceChange = (date: Date, shift: Shift) => {
    const dateString = date.toISOString().split('T')[0];
    const currentPref = currentPharmacist.preferences[dateString]?.[shift] || Preference.Available;
    const nextIndex = (PREFERENCE_CYCLE.indexOf(currentPref) + 1) % PREFERENCE_CYCLE.length;
    const nextPref = PREFERENCE_CYCLE[nextIndex];
    
    const updatedPreferences = {
      ...currentPharmacist.preferences,
      [dateString]: {
        ...currentPharmacist.preferences[dateString],
        [shift]: nextPref,
      },
    };

    const updatedPharmacists = room.pharmacists.map(p => 
      p.name === currentUser ? { ...p, preferences: updatedPreferences } : p
    );
    
    setRoom({ ...room, pharmacists: updatedPharmacists });
  };

  const handleSubmit = () => {
     const updatedPharmacists = room.pharmacists.map(p => 
      p.name === currentUser ? { ...p, submitted: true } : p
    );
    setRoom({ ...room, pharmacists: updatedPharmacists });
  };

  return (
    <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">حدد الأوقات المناسبة لك</h2>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-green-500"></span><span>متفرغ</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-blue-500"></span><span>غير مفضل</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-red-500"></span><span>غير متاح</span></div>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
          <div key={day} className="text-center font-bold text-gray-400 p-2">{day}</div>
        ))}
        {dates.map((date, index) => {
          const dateString = date.toISOString().split('T')[0];
          return (
            <div key={date.toISOString()} className="bg-gray-800 rounded-md p-2 flex flex-col justify-between min-h-[120px]">
              <span className="font-bold text-lg text-white">{date.getDate()}</span>
              <div className="space-y-1">
                {SHIFTS.map(shift => {
                  const preference = currentPharmacist.preferences[dateString]?.[shift] || Preference.Available;
                  return (
                    <button
                      key={shift}
                      onClick={() => handlePreferenceChange(date, shift)}
                      className={`w-full text-center text-xs font-bold text-white rounded py-1 transition-colors ${PREFERENCE_COLORS[preference]}`}
                    >
                      {shift}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button 
        onClick={handleSubmit} 
        className="mt-6 w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors">
        تقديم الأوقات المتاحة
      </button>
    </div>
  );
};

export default AvailabilityCalendar;
