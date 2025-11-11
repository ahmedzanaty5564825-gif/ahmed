
import React, { useState } from 'react';
import { Room, Pharmacist, Preference } from '../types';
import { saveRoom } from '../services/persistenceService';

interface JoinModalProps {
    room: Room;
    setRoom: (room: Room) => void;
    setCurrentUser: (name: string) => void;
}

const JoinModal: React.FC<JoinModalProps> = ({ room, setRoom, setCurrentUser }) => {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleJoin = () => {
        if (!name) {
            setError('الرجاء إدخال اسم المستخدم.');
            return;
        }
        if (room.password && password !== room.password) {
            setError('كلمة سر الغرفة غير صحيحة.');
            return;
        }

        const existingPharmacist = room.pharmacists.find(p => p.name === name);
        const isAdmin = room.admin.name === name;

        if (isAdmin) {
             // Logic for admin login would go here, maybe ask for admin pass.
             // For now, we assume admin might rejoin.
             sessionStorage.setItem('currentUser', name);
             setCurrentUser(name);
             return;
        }

        if (existingPharmacist) {
            sessionStorage.setItem('currentUser', name);
            setCurrentUser(name);
        } else {
            const newPharmacist: Pharmacist = {
                name,
                preferences: {},
                submitted: false,
            };
            const updatedRoom = { ...room, pharmacists: [...room.pharmacists, newPharmacist] };
            saveRoom(updatedRoom);
            setRoom(updatedRoom);
            sessionStorage.setItem('currentUser', name);
            setCurrentUser(name);
        }
    };

    return (
        <div className="fixed inset-0 bg-brand-dark bg-opacity-90 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-brand-dark-2 border border-gray-700 rounded-lg shadow-xl p-8 space-y-6">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-white">مرحباً بك في غرفة <span className="text-brand-cyan">{room.name}</span></h2>
                    <p className="text-gray-400 mt-2">انضم كعضو جديد أو سجل الدخول إذا كان لديك حساب.</p>
                </div>
                
                <div className="space-y-4">
                    <input
                        type="text"
                        placeholder="اسم المستخدم"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-brand-cyan focus:outline-none"
                    />
                    {room.password && (
                        <input
                            type="password"
                            placeholder="كلمة مرور الغرفة"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-brand-cyan focus:outline-none"
                        />
                    )}
                </div>

                {error && <p className="text-red-400 text-center">{error}</p>}

                <button
                    onClick={handleJoin}
                    className="w-full bg-brand-cyan text-white font-bold py-3 px-4 rounded-lg hover:bg-brand-cyan-hover transition-transform transform hover:scale-105"
                >
                    دخول
                </button>
            </div>
        </div>
    );
};

export default JoinModal;
