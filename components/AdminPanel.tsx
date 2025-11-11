import React from 'react';
import { Room, Shift, DayConstraint, SHIFTS } from '../types';
import { generateSchedule } from '../services/geminiService';

interface AdminPanelProps {
  room: Room;
  setRoom: (room: Room) => void;
}

const getDefaultShiftConstraint = () => ({
    [Shift.Morning]: { min: 1, max: 1 },
    [Shift.Noon]: { min: 1, max: 1 },
    [Shift.Evening]: { min: 1, max: 1 },
});


const AdminPanel: React.FC<AdminPanelProps> = ({ room, setRoom }) => {
    const dates = [];
    let currentDate = new Date(room.startDate);
    const endDate = new Date(room.endDate);
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

  const handleConstraintChange = (date: Date, shift: Shift, type: 'min' | 'max', value: number) => {
    const dateString = date.toISOString().split('T')[0];
    const newConstraints = { ...room.constraints };
    if (!newConstraints[dateString]) {
      newConstraints[dateString] = { shifts: getDefaultShiftConstraint(), isHoliday: false };
    }
    // Ensure max is always >= min
    if (type === 'min' && value > newConstraints[dateString].shifts[shift].max) {
        newConstraints[dateString].shifts[shift].max = value;
    }
    newConstraints[dateString].shifts[shift][type] = value < 0 ? 0 : value;
    setRoom({ ...room, constraints: newConstraints });
  };

  const toggleHoliday = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    const newConstraints = { ...room.constraints };
    if (!newConstraints[dateString]) {
      newConstraints[dateString] = { shifts: getDefaultShiftConstraint(), isHoliday: false };
    }
    newConstraints[dateString].isHoliday = !newConstraints[dateString].isHoliday;
    setRoom({ ...room, constraints: newConstraints });
  };
  
  const handleGenerateSchedule = async () => {
    setRoom({...room, status: 'generating'});
    try {
        const { schedule, aiNotes } = await generateSchedule(room);
        setRoom({ ...room, schedule, aiNotes, status: 'complete' });
    } catch(error) {
        console.error("Failed to generate schedule:", error);
        alert("حدث خطأ أثناء إنشاء الجدول. يرجى المحاولة مرة أخرى.");
        setRoom({...room, status: 'collecting'});
    }
  };

  const allSubmitted = room.pharmacists.every(p => p.submitted);
  
  return (
    <div className="bg-brand-dark-2 p-6 mt-4 rounded-lg border border-gray-700 space-y-6">
      <section>
        <h3 className="text-xl font-bold text-white mb-4">تحديد عدد الموظفين والإجازات</h3>
        <div className="overflow-x-auto">
          <div className="flex space-x-2 p-2">
            {dates.map(date => {
              const dateString = date.toISOString().split('T')[0];
              const constraint: DayConstraint = room.constraints[dateString] || { shifts: getDefaultShiftConstraint(), isHoliday: false };
              return (
                <div key={dateString} className={`min-w-[160px] p-3 rounded-lg ${constraint.isHoliday ? 'bg-red-900/50' : 'bg-gray-800'}`}>
                  <p className="font-bold text-center">{date.toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' })}</p>
                  <p className="text-xs text-gray-400 text-center mb-2">{date.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'short' })}</p>
                  {!constraint.isHoliday && (
                    <div className="space-y-2">
                      {SHIFTS.map(shift => (
                        <div key={shift} className="flex items-center justify-between text-sm">
                          <label className="font-bold">{shift}</label>
                          <div className="flex items-center gap-1">
                            <input title="الحد الأدنى" type="number" min="0" value={constraint.shifts[shift].min} onChange={(e) => handleConstraintChange(date, shift, 'min', parseInt(e.target.value))} className="w-10 bg-gray-700 text-center rounded" />
                            <span className="text-gray-400">-</span>
                            <input title="الحد الأقصى" type="number" min="0" value={constraint.shifts[shift].max} onChange={(e) => handleConstraintChange(date, shift, 'max', parseInt(e.target.value))} className="w-10 bg-gray-700 text-center rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => toggleHoliday(date)} className={`mt-2 w-full text-xs py-1 rounded ${constraint.isHoliday ? 'bg-green-600' : 'bg-red-600'}`}>
                    {constraint.isHoliday ? 'عمل' : 'إجازة'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-bold text-white mb-4">حالة المستخدمين</h3>
        <ul className="space-y-2">
          {room.pharmacists.map(p => (
            <li key={p.name} className="flex justify-between items-center bg-gray-800 p-3 rounded-md">
              <span className="font-semibold">{p.name}</span>
              <span className={`px-3 py-1 text-sm font-bold rounded-full ${p.submitted ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black'}`}>
                {p.submitted ? 'تم التقديم' : 'قيد الانتظار'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <button 
            onClick={handleGenerateSchedule}
            disabled={!allSubmitted}
            className="w-full bg-brand-cyan text-white font-bold py-3 px-4 rounded-lg hover:bg-brand-cyan-hover transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
          إنشاء الجدول الآن
        </button>
        {!allSubmitted && <p className="text-yellow-400 text-center text-sm mt-2">يجب أن يقوم جميع المستخدمين بتقديم الأوقات المتاحة لهم أولاً.</p>}
      </section>
    </div>
  );
};

export default AdminPanel;