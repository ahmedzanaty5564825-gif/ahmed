
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';

// Base64 encoding/decoding functions
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


const LiveAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [transcripts, setTranscripts] = useState<{ user: string, model: string }[]>([]);
    const [currentInterim, setCurrentInterim] = useState({ user: '', model: '' });

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

    const cleanup = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        setIsConnected(false);
        setIsConnecting(false);
    }, []);
    
    const startConversation = async () => {
        if (isConnected || isConnecting) return;
        
        setIsConnecting(true);
        setTranscripts([]);
        setCurrentInterim({ user: '', model: '' });

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            let nextStartTime = 0;
            const sources = new Set<AudioBufferSourceNode>();

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: async () => {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        mediaStreamRef.current = stream;
                        
                        const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        audioContextRef.current = inputAudioContext;
                        
                        const source = inputAudioContext.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(new Int16Array(inputData.map(f => f * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
                        
                        setIsConnecting(false);
                        setIsConnected(true);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            setCurrentInterim(prev => ({ ...prev, user: message.serverContent!.inputTranscription!.text! }));
                        }
                        if (message.serverContent?.outputTranscription) {
                            setCurrentInterim(prev => ({ ...prev, model: message.serverContent!.outputTranscription!.text! }));
                        }
                        if (message.serverContent?.turnComplete) {
                            setTranscripts(prev => [...prev, currentInterim]);
                            setCurrentInterim({ user: '', model: '' });
                        }
                        
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData) {
                            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
                            const source = outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContext.destination);
                            source.addEventListener('ended', () => sources.delete(source));
                            source.start(nextStartTime);
                            nextStartTime += audioBuffer.duration;
                            sources.add(source);
                        }
                        
                         if (message.serverContent?.interrupted) {
                            for (const source of sources.values()) {
                                source.stop();
                            }
                            sources.clear();
                            nextStartTime = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live API Error:', e);
                        alert(`حدث خطأ في الاتصال: ${e.message}`);
                        cleanup();
                    },
                    onclose: () => {
                        cleanup();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                },
            });
            sessionPromiseRef.current = sessionPromise;

        } catch (error) {
            console.error("Failed to start conversation:", error);
            alert("لم نتمكن من الوصول للميكروفون. يرجى التأكد من السماح بالوصول.");
            cleanup();
        }
    };
    
    useEffect(() => {
        return () => cleanup();
    }, [cleanup]);

    if (!isOpen) {
        return (
            <button onClick={() => setIsOpen(true)} className="fixed bottom-6 left-6 bg-brand-cyan text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center transform hover:scale-110 transition-transform z-40">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm5 8a1 1 0 10-2 0v1.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L12 13.586V12z" clipRule="evenodd" /></svg>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-brand-dark-2 w-full max-w-2xl h-[80vh] rounded-lg shadow-xl flex flex-col p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-brand-cyan">المساعد الصوتي</h3>
                    <button onClick={() => { cleanup(); setIsOpen(false); }} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <div className="flex-grow bg-gray-900/50 rounded-lg p-4 overflow-y-auto space-y-4">
                   {transcripts.map((t, i) => (
                       <div key={i}>
                           <p><strong className="text-blue-400">أنت:</strong> {t.user}</p>
                           <p><strong className="text-cyan-400">المساعد:</strong> {t.model}</p>
                       </div>
                   ))}
                    {currentInterim.user && <p className="text-blue-400/70">أنت: {currentInterim.user}</p>}
                    {currentInterim.model && <p className="text-cyan-400/70">المساعد: {currentInterim.model}</p>}
                </div>
                <div className="pt-6 text-center">
                    {!isConnected && !isConnecting && (
                        <button onClick={startConversation} className="bg-green-600 text-white font-bold py-3 px-6 rounded-full hover:bg-green-700 transition-colors">
                            بدء المحادثة
                        </button>
                    )}
                    {isConnecting && <p className="text-yellow-400">جاري الاتصال...</p>}
                    {isConnected && (
                        <button onClick={cleanup} className="bg-red-600 text-white font-bold py-3 px-6 rounded-full hover:bg-red-700 transition-colors">
                            إنهاء المحادثة
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


export default LiveAssistant;
