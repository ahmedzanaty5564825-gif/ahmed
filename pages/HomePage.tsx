import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Room, Pharmacist } from '../types';
import { saveRoom } from '../services/persistenceService';

// A simple hashing function for demonstration. 
// In a real app, use a proper library like bcrypt on a server.
const simpleHash = async (text: string) => {
  const buffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// FIX: Refactored to use React.FC to resolve a misleading error about a missing 'children' prop.
interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
}

const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onClick, children }) => (
    <button type="button" onClick={onClick} className={`w-1/2 py-2 text-sm rounded-md transition-colors duration-200 ${active ? 'bg-brand-cyan text-white' : 'bg-brand-dark-2 text-gray-300 hover:bg-gray-700'}`}>
      {children}
    </button>
  );

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isParticipant, setIsParticipant] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const handleCreateRoom = async () => {
    if (!roomName || !adminName || !adminPassword) {
      setError('الرجاء ملء اسم الغرفة، واسم المستخدم وكلمة المرور للمسؤول.');
      return;
    }
    setError('');
    setIsCreating(true);

    const adminPasswordHash = await simpleHash(adminPassword);
    const roomId = Math.random().toString(36).substring(2, 9);
    
    const start = new Date(month + '-01');
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

    const initialPharmacists: Pharmacist[] = [];
    if (isParticipant) {
        initialPharmacists.push({
            name: adminName,
            preferences: {},
            submitted: false,
        });
    }
    
    const newRoom: Room = {
      id: roomId,
      name: roomName,
      password: roomPassword || undefined,
      admin: {
        name: adminName,
        passwordHash: adminPasswordHash,
        isParticipant
      },
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      pharmacists: initialPharmacists,
      constraints: {},
      status: 'collecting',
      schedule: null,
      aiNotes: null
    };

    saveRoom(newRoom);
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-brand-dark">
      <div className="w-full max-w-2xl bg-brand-dark-2 border border-gray-700/50 rounded-lg shadow-lg p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-brand-cyan">منظم جدول الصيدلية</h1>
          <p className="text-gray-400 mt-2">أنشئ غرفة جديدة وادعُ زملائك لتنظيم جدول العمل بسهولة.</p>
        </div>

        <div className="space-y-6">
          {/* Room Details */}
          <fieldset className="border border-gray-600/50 rounded-lg p-4">
            <legend className="px-2 text-gray-300">تفاصيل الغرفة</legend>
            <div className="space-y-4">
              <input type="text" placeholder="مثال: صيدلية الأمل" value={roomName} onChange={(e) => setRoomName(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
              <input type="password" placeholder="كلمة سر للغرفة (اختياري)" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
            </div>
          </fieldset>

          {/* Admin Account */}
          <fieldset className="border border-gray-600/50 rounded-lg p-4">
            <legend className="px-2 text-gray-300">حساب المسؤول (أنت)</legend>
            <div className="space-y-4">
                <input type="text" placeholder="اسمك الذي سيظهر للجميع" value={adminName} onChange={(e) => setAdminName(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
                <input type="password" placeholder="كلمة المرور الخاصة بك" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
                <div>
                    <label className="text-sm text-gray-400 mb-2 block">هل ستكون ضمن طاقم العمل في الجدول؟</label>
                    <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-600">
                        <ToggleButton active={isParticipant} onClick={() => setIsParticipant(true)}>نعم، سأسجل أوقاتي</ToggleButton>
                        <ToggleButton active={!isParticipant} onClick={() => setIsParticipant(false)}>لا، أنا منظم فقط</ToggleButton>
                    </div>
                </div>
            </div>
          </fieldset>
          
          {/* Schedule Range */}
          <fieldset className="border border-gray-600/50 rounded-lg p-4">
             <legend className="px-2 text-gray-300">تحديد شهر الجدول</legend>
             <div className="space-y-4">
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full bg-brand-dark-2 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
             </div>
          </fieldset>
        </div>
        
        {error && <p className="text-red-400 text-center">{error}</p>}

        <button 
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="w-full bg-brand-cyan text-white font-bold py-3 px-4 rounded-lg hover:bg-brand-cyan-hover transform hover:scale-105 transition-all duration-300 disabled:bg-gray-600 disabled:scale-100"
        >
          {isCreating ? 'جاري الإنشاء...' : 'إنشاء غرفة جديدة'}
        </button>
      </div>
    </div>
  );
};

export default HomePage;