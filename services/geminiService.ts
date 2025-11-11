import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Room, Schedule, Shift } from '../types';

const formatPreferencesForPrompt = (room: Room): string => {
    let preferenceString = "Here are the preferences for each pharmacist:\n";
    
    // Combine admin if they are a participant
    const allParticipants = [...room.pharmacists];
    if (room.admin.isParticipant && !allParticipants.some(p => p.name === room.admin.name)) {
        // Find the admin's entry in the pharmacists array to get their preferences
        const adminAsPharmacist = room.pharmacists.find(p => p.name === room.admin.name) || {
            name: room.admin.name,
            preferences: {},
            submitted: true, // Assume submitted as their data is part of the generation trigger
        };
        allParticipants.push(adminAsPharmacist);
    }


    allParticipants.forEach(p => {
        preferenceString += `Pharmacist: ${p.name}\n`;
        if (Object.keys(p.preferences).length === 0) {
            preferenceString += `- No specific preferences submitted.\n`;
        } else {
            Object.entries(p.preferences).forEach(([date, shifts]) => {
                const shiftPrefs = Object.entries(shifts).map(([shift, pref]) => `${shift}: ${pref}`).join(', ');
                preferenceString += `- ${date}: ${shiftPrefs}\n`;
            });
        }
    });
    return preferenceString;
};

const formatConstraintsForPrompt = (room: Room): string => {
    let constraintString = "The following number of pharmacists are required for each shift:\n";
    Object.entries(room.constraints).forEach(([date, constraint]) => {
        if (constraint.isHoliday) {
            constraintString += `- ${date}: Holiday (no shifts)\n`;
        } else {
            const shiftReqs = Object.entries(constraint.shifts).map(([shift, count]) => `${shift} (min: ${count.min}, max: ${count.max})`).join(', ');
            constraintString += `- ${date}: ${shiftReqs}\n`;
        }
    });
    return constraintString;
};


export const generateSchedule = async (room: Room): Promise<{schedule: Schedule, aiNotes: string}> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const model = 'gemini-2.5-pro';
    
    const prompt = `
        You are an expert scheduler for a hospital pharmacy. Your goal is to create the most fair and optimal schedule possible.

        **CRITICAL INSTRUCTIONS:**
        1.  You MUST return ONLY a valid JSON object. Do not include any text before or after the JSON object. Do not use markdown backticks like \`\`\`json.
        2.  The JSON object must have two top-level keys: "schedule" and "notes".
        3.  The "schedule" key must be an object where each key is a pharmacist's name, and the value is another object. This inner object's keys are dates (YYYY-MM-DD), and values are the assigned shift ('ص', 'ن', 'م') or null if they are off.
        4.  The "notes" key must be a string containing your observations in Arabic, like fairness assessments or any unfulfilled requirements.

        **SCHEDULING RULES:**
        -   **Staffing Levels:** For each shift, you are given a minimum (min) and maximum (max) number of required staff. You **MUST** schedule at least the minimum number of pharmacists. If possible, schedule up to the maximum number, but do not exceed it. Meeting the minimum is the highest priority.
        -   **Availability:** Strictly respect all 'unavailable' preferences. A pharmacist cannot be scheduled if they are unavailable.
        -   **Preferences:** Try to respect 'preferred_off' preferences, but prioritize filling all *minimum* required slots. It's better to schedule someone on a 'preferred_off' day than to leave a shift understaffed.
        -   **Fairness:**
            - Distribute total shifts as evenly as possible among all pharmacists.
            - Distribute evening shifts ('م') as evenly as possible.
            - Avoid scheduling anyone for more than 5 consecutive days.
        
        **INPUT DATA:**

        **Pharmacists:**
        ${[...room.pharmacists.map(p => p.name), ...(room.admin.isParticipant && !room.pharmacists.some(p => p.name === room.admin.name) ? [room.admin.name] : [])].join(', ')}

        **Schedule Period:**
        From ${room.startDate.split('T')[0]} to ${room.endDate.split('T')[0]}

        **Shift Requirements (min/max) & Holidays:**
        ${formatConstraintsForPrompt(room)}

        **Pharmacist Preferences:**
        ${formatPreferencesForPrompt(room)}

        Now, generate the schedule based on all the above information. Ensure your output is ONLY the JSON object.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
                responseMimeType: "application/json",
            }
        });
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        return {
            schedule: result.schedule as Schedule,
            aiNotes: result.notes as string,
        };

    } catch (error) {
        console.error("Gemini API Error:", error);
        console.error("Failed Prompt:", prompt);
        throw new Error("Failed to parse schedule from Gemini API.");
    }
};

export const analyzeScheduleFairness = async (schedule: Schedule): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const model = 'gemini-2.5-pro';
    const prompt = `
      Analyze the following pharmacy schedule for fairness. 
      Provide a concise summary in Arabic.
      Consider the following metrics for each person:
      1. Total number of shifts.
      2. Number of evening shifts (م).
      3. Longest streak of consecutive workdays.
      
      Conclude with an overall fairness assessment.

      Schedule Data:
      ${JSON.stringify(schedule, null, 2)}
    `;

    const response = await ai.models.generateContent({model, contents: prompt, config: { thinkingConfig: { thinkingBudget: 32768 }}});
    return response.text;
};

export const suggestSwap = async (room: Room, pharmacistName: string, date: string, shift: Shift): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const model = 'gemini-2.5-flash';
    const prompt = `
      Pharmacist '${pharmacistName}' wants to swap their '${shift}' shift on ${date}.
      Based on the complete schedule and everyone's original availability preferences, who is the best person to swap with?
      
      - A good candidate would be someone who was 'available' on that day and has fewer total shifts or evening shifts.
      - Do not suggest anyone who was 'unavailable'.
      - If no one is suitable, explain why (e.g., everyone else is unavailable or already working).
      - Provide a concise recommendation in Arabic.

      Current Schedule:
      ${JSON.stringify(room.schedule, null, 2)}

      Original Preferences:
      ${formatPreferencesForPrompt(room)}
    `;
    
    const response = await ai.models.generateContent({model, contents: prompt});
    return response.text;
};

export const getSchedulingTips = async (): Promise<{ text: string, groundingChunks: any[] | undefined }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const model = 'gemini-2.5-flash';
    const prompt = `
        Provide some tips in Arabic for creating fair and effective pharmacy shift schedules.
        Focus on:
        -   Minimizing burnout.
        -   Ensuring adequate coverage.
        -   Handling last-minute changes.
        -   Fairly distributing unpopular shifts.
        
        The response should be helpful for a pharmacy manager in a hospital setting.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

        return {
            text: response.text,
            groundingChunks,
        };

    } catch (error) {
        console.error("Gemini API Error in getSchedulingTips:", error);
        throw new Error("Failed to get scheduling tips from Gemini API.");
    }
};
