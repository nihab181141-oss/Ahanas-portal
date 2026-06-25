import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON body parsing with high limit for audio base64 uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Lazy-load Gemini client to prevent crashes if key is not set immediately
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not configured in the application environment.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// 1. API: Get Firebase Configuration
app.get('/api/firebase-config', (req, res) => {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const rawData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(rawData);
      res.json({ success: true, config });
    } else {
      res.status(404).json({ success: false, error: 'Firebase configuration file not found.' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. API: Audio Transcription Endpoint (using gemini-3.5-flash)
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio) {
      return res.status(400).json({ success: false, error: 'No audio data provided' });
    }

    const ai = getAI();
    
    // Call Gemini with the audio data and request transcription
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: audio, // base64 string
                mimeType: mimeType || 'audio/webm'
              }
            },
            {
              text: "You are a professional audio transcription assistant. Listen to the user's voice message carefully. Transcribe exactly what they say in English or Bengali (or a blend of both, e.g. 'I spent 500 taka on dress'). Output ONLY the plain text transcription, and absolutely nothing else. If there is only silence or background noise, output a blank string."
            }
          ]
        }
      ]
    });

    res.json({ success: true, transcript: response.text?.trim() || '' });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. API: Voice Intent Parsing Endpoint
app.post('/api/parse-voice', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ success: false, error: 'No transcript provided' });
    }

    const ai = getAI();

    const systemInstruction = `
    You are an intelligent natural language parsing companion for "Ahana's Portal" (a luxury, feminine personal finance and lifestyle operating system).
    Your task is to analyze the user's spoken transcription and translate it into a structured database action.
    
    The currency symbol used is "৳" (taka / Bangladeshi Taka), but the user might speak in any currency terms (e.g., 'taka', 'taka spend', 'dollars'). Extract numbers as numerical values.
    
    Available actions are:
    1. CREATE_EXPENSE:
       - amount (number)
       - category (MUST be one of: "Food & Dining", "Shopping", "Transport", "Bills & Utilities", "Entertainment", "Others")
       - description (string, e.g., "coffee", "skincare", "taxi ride")
    
    2. CREATE_INCOME:
       - amount (number)
       - category (MUST be one of: "Salary", "Freelance", "Business", "Others")
       - description (string, e.g., "monthly paycheck", "consulting", "clothing sale")
    
    3. CREATE_BUDGET:
       - category (one of the expense categories listed above)
       - amount (number)
    
    4. CREATE_SAVINGS_GOAL:
       - title (string, e.g., "Europe Trip", "Chanel Bag", "Emergency Fund")
       - targetAmount (number)
    
    5. CREATE_WISHLIST:
       - title (string, e.g., "Dior Lipstick", "Weekend Spa Trip")
       - price (number)
       - priority (MUST be "High Priority" or "Medium Priority")
    
    6. CREATE_NOTE:
       - title (string)
       - content (string)
    
    7. GENERAL_CHAT:
       - reply (string, a beautiful, empathetic, luxury-oriented conversational reply to what they said, answering financial questions, or suggesting lifestyle tips)

    Analyze the user instruction: "${transcript}".
    Based on this, return ONLY a structured JSON block matching this interface:
    {
      "action": "CREATE_EXPENSE" | "CREATE_INCOME" | "CREATE_BUDGET" | "CREATE_SAVINGS_GOAL" | "CREATE_WISHLIST" | "CREATE_NOTE" | "GENERAL_CHAT",
      "data": { ... properties ... },
      "explanation": "A gentle, luxurious, and soft message explaining what you did, starting with a warm, elegant tone."
    }
    
    Be smart about parsing!
    - "I spent 500 taka on coffee" -> CREATE_EXPENSE, amount: 500, category: "Food & Dining", description: "Coffee"
    - "I received 10000 taka salary" -> CREATE_INCOME, amount: 10000, category: "Salary", description: "Salary paycheck"
    - "Create a budget of 15000 for shopping" -> CREATE_BUDGET, category: "Shopping", amount: 15000
    - "Add a savings goal for Europe Trip of 80000" -> CREATE_SAVINGS_GOAL, title: "Europe Trip", targetAmount: 80000
    - "Add a note about my skincare expenses: Dior cleanser costs 5000" -> CREATE_NOTE, title: "Skincare Expenses", content: "Dior cleanser costs 5000"
    - "I want to buy a Chanel purse for 25000" -> CREATE_WISHLIST, title: "Chanel Purse", price: 25000, priority: "High Priority"
    - "How is my spending today?" -> GENERAL_CHAT, reply: "I would love to help you analyze your spending once we review your latest diary entries. Your financial wellness is a journey we are writing beautifully together."
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: transcript,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const parsedData = JSON.parse(response.text?.trim() || '{}');
    res.json({ success: true, parsed: parsedData });
  } catch (error: any) {
    console.error('Parsing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Multimodal Receipt Scanning Endpoint (using gemini-3.5-flash)
app.post('/api/scan-receipt', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: 'No receipt image provided.' });
    }

    const ai = getAI();

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: image, // base64 representation of image
                mimeType: mimeType || 'image/jpeg'
              }
            },
            {
              text: "Analyze this receipt image. Extract the total cost amount as a number, identify the venue/shop name as description, and choose the most appropriate category strictly from: ['Food & Dining', 'Shopping', 'Transport', 'Bills & Utilities', 'Entertainment', 'Others']. Return ONLY a raw JSON matching this format: {\"amount\": number, \"category\": string, \"description\": string}. Do not add any markdown blocks."
            }
          ]
        }
      ]
    });

    const rawText = response.text?.trim() || '{}';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsedData = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);

    res.json({ success: true, parsed: parsedData });
  } catch (error: any) {
    console.error('Receipt scan error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. API: AI Assistant Chat (with Thinking Mode Toggle)
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, history, useThinking } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'No prompt provided' });
    }

    const ai = getAI();

    const systemInstruction = `
    You are the heart of "Ahana's Portal": a supportive, intelligent, extremely elegant, and warm AI personal finance and lifestyle companion. 
    Your tone is ultra-premium, feminine, soft, calming, and highly encouraging. Speak with professional refinement, like a private concierge or a sophisticated best friend.
    Avoid dry, technical terminology or listless financial jargon. Frame suggestions as lifestyle refinements, acts of self-care, and elegant planning.
    Always refer to the currency as ৳ (taka) unless another currency is requested.
    
    If the user asks complex questions or asks for data analysis, analyze thoughtfully.
    If 'useThinking' is true, the user is expecting a deep-thinking, highly logical reasoning process behind your response (handled by gemini-3.1-pro-preview). Make sure to match their expectation with thorough, deeply reasoned, and exquisitely presented insights.
    `;

    // Map history to Google GenAI format: { role, parts: [{ text }] }
    const formattedHistory = (history || []).map((h: any) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));

    let response;
    if (useThinking) {
      // Must use gemini-3.1-pro-preview with ThinkingLevel.HIGH for thinking mode
      response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [
          ...formattedHistory,
          { role: 'user', parts: [{ text: prompt }] }
        ],
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH
          }
        }
      });
    } else {
      // Use gemini-3.5-flash for standard, fast general chat
      response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          ...formattedHistory,
          { role: 'user', parts: [{ text: prompt }] }
        ],
        config: {
          systemInstruction
        }
      });
    }

    res.json({ success: true, reply: response.text });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Integrate Vite in Dev, Serve Static in Prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ahana's Portal server running on http://localhost:${PORT}`);
  });
}

startServer();
