
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRoom, saveRoom } from '../services/persistenceService';
import { Room, Pharmacist, Preference, Shift, SHIFTS } from '../types';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import AdminPanel from '../components/AdminPanel';
import ScheduleView from '../components/ScheduleView';
import JoinModal from '../components/JoinModal';
import LiveAssistant from '../components/LiveAssistant';

const LoadingIcon = () => (
    <svg className="animate-spin h-12 w-12 text-brand-cyan" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const RoomPage: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const [room, setRoom] = useState<Room | null>(null);
    const [currentUser, setCurrentUser] = useState<string | null>(sessionStorage.getItem('currentUser'));
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);

    const loadRoom = useCallback(() => {
        if (!roomId) {
            navigate('/');
            return;
        }
        const loadedRoom = getRoom(roomId);
        if (!loadedRoom) {
            // In a real app, this might show a "Room not found" page
            // For GitHub pages, we just redirect home.
            navigate('/');
            return;
        }
        setRoom(loadedRoom);
        setIsLoading(false);
    }, [roomId, navigate]);

    useEffect(() => {
        loadRoom();
        const interval = setInterval(loadRoom, 5000); // Poll for changes
        return () => clearInterval(interval);
    }, [loadRoom]);

    const handleUpdateRoom = (updatedRoom: Room) => {
        setIsSaving(true);
        saveRoom(updatedRoom);
        setRoom(updatedRoom);
        setTimeout(() => setIsSaving(false), 1000);
    };

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen"><LoadingIcon /></div>;
    }
    
    if (!room) {
         return <div className="flex items-center justify-center min-h-screen"><p>لم يتم العثور على الغرفة.</p></div>;
    }

    if (!currentUser) {
        return <JoinModal room={room} setRoom={setRoom} setCurrentUser={setCurrentUser} />;
    }

    const currentPharmacist = room.pharmacists.find(p => p.name === currentUser);
    const isAdmin = room.admin.name === currentUser;

    const renderContent = () => {
        switch (room.status) {
            case 'generating':
                return (
                    <div className="flex flex-col items-center justify-center text-center p-8 bg-brand-dark-2 rounded-lg shadow-xl">
                        <LoadingIcon />
                        <h2 className="text-2xl font-bold mt-4 text-brand-light">جارٍ تحليل التفضيلات وحساب الجدول الأمثل...</h2>
                        <p className="text-gray-400 mt-2">قد يستغرق هذا بضع لحظات.</p>
                    </div>
                );
            case 'complete':
                return <ScheduleView room={room} currentUser={currentUser} setRoom={setRoom} />;
            case 'collecting':
            default:
                if (currentPharmacist?.submitted && !isAdmin) {
                    return (
                        <div className="text-center p-8 bg-green-900/50 border border-green-700 rounded-lg">
                            <h2 className="text-2xl font-bold text-green-300">شكراً لك، تم استلام الأوقات التي حددتها.</h2>
                            <p className="text-green-400 mt-2">يرجى انتظار المسؤول لإنشاء الجدول.</p>
                        </div>
                    );
                }
                return (
                    <>
                        {isAdmin && (
                            <div className="mb-6">
                                <button onClick={() => setShowAdminPanel(!showAdminPanel)} className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-lg font-bold transition-colors">
                                    {showAdminPanel ? 'إخفاء لوحة تحكم المسؤول' : 'إظهار لوحة تحكم المسؤول'}
                                </button>
                                {showAdminPanel && <AdminPanel room={room} setRoom={handleUpdateRoom} />}
                            </div>
                        )}
                        <AvailabilityCalendar room={room} setRoom={handleUpdateRoom} currentUser={currentUser} />
                    </>
                );
        }
    };
    
    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
                <div>
                    <h1 className="text-3xl font-bold text-brand-cyan">{room.name}</h1>
                    <p className="text-gray-400">مرحباً, {currentUser}!</p>
                </div>
                <div className="flex items-center gap-4">
                    {isSaving && <span className="text-sm text-gray-500 animate-pulse">جاري الحفظ...</span>}
                    <button onClick={() => { sessionStorage.removeItem('currentUser'); navigate(0); }} className="bg-gray-700 text-gray-300 px-4 py-2 rounded-md hover:bg-red-800 hover:text-white transition-colors">
                        تسجيل الخروج
                    </button>
                </div>
            </header>
            <main>
                {renderContent()}
            </main>
            <LiveAssistant />
        </div>
    );
};

export default RoomPage;
