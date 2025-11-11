import React, { useState } from 'react';
import { Room, Shift } from '../types';
import { analyzeScheduleFairness, suggestSwap, getSchedulingTips } from '../services/geminiService';

interface ScheduleViewProps {
  room: Room;
  currentUser: string;
  setRoom: (room: Room) => void;
}

const LoadingModal: React.FC<{ message: string }> = ({ message }) => (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-brand-dark-2 p-8 rounded-lg flex flex-col items-center gap-4">
            <svg className="animate-spin h-8 w-8 text-brand-cyan" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg">{message}</p>
        </div>
    </div>
);

const AnalysisModal: React.FC<{ title: string; content: string; sources?: any[]; onClose: () => void }> = ({ title, content, sources, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div className="bg-brand-dark-2 border border-gray-700 max-w-2xl w-full p-6 rounded-lg flex flex-col">
            <h3 className="text-2xl font-bold text-brand-cyan mb-4">{title}</h3>
            <div className="bg-gray-800 p-4 rounded-md max-h-[60vh] overflow-y-auto">
                <p className="whitespace-pre-wrap">{content}</p>
                {sources && sources.length > 0 && (
                    <div className="mt-6 border-t border-gray-600 pt-4">
                        <h4 className="text-lg font-semibold text-gray-300 mb-2">المصادر:</h4>
                        <ul className="list-disc list-inside space-y-2">
                            {sources.map((source, index) => source.web && (
                                <li key={index}>
                                    <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:underline">
                                        {source.web.title || source.web.uri}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            <button onClick={onClose} className="mt-6 w-full bg-brand-cyan text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-cyan-hover">
                إغلاق
            </button>
        </div>
    </div>
);


const ScheduleView: React.FC<ScheduleViewProps> = ({ room, currentUser, setRoom }) => {
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [analysisResult, setAnalysisResult] = useState<{ title: string; content: string; sources?: any[] } | null>(null);

    const dates = [];
    let currentDate = new Date(room.startDate);
    const endDate = new Date(room.endDate);
    while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    const allPersonnel = room.admin.isParticipant ? [room.admin.name, ...room.pharmacists.map(p => p.name)] : room.pharmacists.map(p => p.name);

    const handleFairnessAnalysis = async () => {
        setIsLoadingAI(true);
        setLoadingMessage('جاري تحليل عدالة الجدول...');
        const result = await analyzeScheduleFairness(room.schedule!);
        setAnalysisResult({ title: "تحليل عدالة الجدول", content: result });
        setIsLoadingAI(false);
    };

    const handleSwapRequest = async (pharmacistName: string, date: Date, shift: Shift) => {
        setIsLoadingAI(true);
        setLoadingMessage('جاري البحث عن تبديل مناسب...');
        const result = await suggestSwap(room, pharmacistName, date.toISOString().split('T')[0], shift);
        setAnalysisResult({ title: `اقتراح تبديل لوردية يوم ${date.toLocaleDateString('ar-EG-u-nu-latn')}`, content: result });
        setIsLoadingAI(false);
    };

    const handleGetTips = async () => {
        setIsLoadingAI(true);
        setLoadingMessage('جاري البحث عن نصائح...');
        try {
            const result = await getSchedulingTips();
            setAnalysisResult({ title: "نصائح للجدولة", content: result.text, sources: result.groundingChunks });
        } catch (error) {
            console.error("Failed to get tips:", error);
            setAnalysisResult({ title: "خطأ", content: "لم نتمكن من جلب النصائح. يرجى المحاولة مرة أخرى." });
        }
        setIsLoadingAI(false);
    };
    
    const handleRestart = () => {
        if(window.confirm("هل أنت متأكد؟ سيتم حذف الجدول بالكامل ويعود الجميع إلى شاشة إدخال التفضيلات.")){
            const updatedRoom = {
                ...room,
                status: 'collecting',
                schedule: null,
                aiNotes: null,
                pharmacists: room.pharmacists.map(p => ({...p, submitted: false}))
            };
            setRoom(updatedRoom);
        }
    }

    const isAdmin = room.admin.name === currentUser;

    return (
        <div className="bg-brand-dark-2 p-4 sm:p-6 rounded-lg border border-gray-700">
            {isLoadingAI && <LoadingModal message={loadingMessage}/>}
            {analysisResult && <AnalysisModal title={analysisResult.title} content={analysisResult.content} sources={analysisResult.sources} onClose={() => setAnalysisResult(null)} />}

            <h2 className="text-3xl font-bold text-center text-white mb-6">الجدول النهائي</h2>
            
            <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse">
                    <thead>
                        <tr className="bg-gray-800">
                            <th className="p-3 text-right sticky right-0 bg-gray-800 z-10 border-l border-gray-700">الصيدلي</th>
                            {dates.map(date => (
                                <th key={date.toISOString()} className="p-2 border-l border-b border-gray-700">
                                    <div className="font-normal text-sm">{date.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'short' })}</div>
                                    <div className="font-bold">{date.getDate()}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {allPersonnel.map(name => (
                            <tr key={name} className="border-b border-gray-700 hover:bg-gray-800/50">
                                <td className="p-3 font-semibold text-right sticky right-0 bg-brand-dark-2 z-10 border-l border-gray-700">{name}</td>
                                {dates.map(date => {
                                    const dateString = date.toISOString().split('T')[0];
                                    const shift = room.schedule?.[name]?.[dateString] || null;
                                    const isCurrentUserShift = name === currentUser && shift;

                                    return (
                                        <td key={date.toISOString()} className={`text-center font-mono font-bold border-l border-gray-700 p-0`}>
                                            {isCurrentUserShift ? (
                                                 <button 
                                                    onClick={() => handleSwapRequest(name, date, shift)}
                                                    className="w-full h-full p-3 group relative bg-brand-dark-2 hover:bg-blue-800 transition-colors">
                                                    <span className={`${shift === Shift.Evening ? 'text-yellow-400' : 'text-brand-light'}`}>{shift || '-'}</span>
                                                    <span className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                                        طلب تبديل
                                                    </span>
                                                </button>
                                            ) : (
                                                 <div className={`p-3 ${shift === Shift.Evening ? 'text-yellow-400' : 'text-brand-light'}`}>{shift || '-'}</div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {room.aiNotes && (
                <div className="mt-8">
                    <h3 className="text-xl font-bold text-white mb-2">ملاحظات واقتراحات الذكاء الاصطناعي</h3>
                    <div className="bg-gray-800 p-4 rounded-md">
                        <p className="text-gray-300 whitespace-pre-wrap">{room.aiNotes}</p>
                    </div>
                </div>
            )}

            {isAdmin && (
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                    <button onClick={handleFairnessAnalysis} className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                        تحليل عدالة الجدول
                    </button>
                    <button onClick={handleGetTips} className="flex-1 bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors">
                        نصائح للجدولة
                    </button>
                    <button onClick={handleRestart} className="flex-1 bg-yellow-600 text-black font-bold py-3 px-4 rounded-lg hover:bg-yellow-700 transition-colors">
                        البدء من جديد
                    </button>
                </div>
            )}
        </div>
    );
};

export default ScheduleView;