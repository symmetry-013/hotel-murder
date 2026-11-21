import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';
import type {
  BotPostGameThought,
  ChatMessage,
  DayVoteChoice,
  Faction,
  GamePhase,
  HotelColumnNumber,
  HotelFloorNumber,
  HotelRoomNumber,
  PrivateClueLog,
  RevealedRoomInfo,
  RoleId,
  SecretChatMessage,
  SecretTargetPing,
} from '../src/shared/gameTypes.ts';
import {
  getColumnOfRoom,
  getFloorOfRoom,
  getRoomsInColumn,
  getRoomsOnFloor,
  HOTEL_COLUMNS,
  HOTEL_FLOORS,
  HOTEL_ROOMS,
  ROLE_DEFINITIONS,
} from '../src/shared/gameTypes.ts';

export type ProviderChoice = 'groq' | 'gemini' | 'fallback';

export interface BotProfile {
  id: string;
  name: string;
  persona: string;
  preferredProvider: 'groq' | 'gemini';
  avatarColor: string;
}

export const BOT_POOL: Array<Omit<BotProfile, 'id' | 'preferredProvider'>> = [
  {
    name: 'บอส',
    persona: 'ปากแจ๋ว ชอบคำนวณแถวแนวตั้ง-แนวนอน เสนอปิดตายทั้งชั้นหรือทั้งแถวแบบใจถึง',
    avatarColor: '#B84A39',
  },
  {
    name: 'เฟิร์น',
    persona: 'สายปั่นตัวแม่ ชอบบลัฟตัวเลขชั้น/แถวและแซวเพื่อนแรงเวลาใครพูดไม่ตรง',
    avatarColor: '#9B4D6F',
  },
  {
    name: 'เจมส์',
    persona: 'ใจร้อน พูดตรง ขี้โวยวาย ชอบชวนปิดตายชั้นหรือแถวที่สงสัยเลยทันที',
    avatarColor: '#4A6FA5',
  },
  {
    name: 'แพรว',
    persona: 'ช่างสังเกต กวนตีนแบบหน้านิ่ง จับผิดคำให้การเรื่องชั้นเก่ง',
    avatarColor: '#5B8A72',
  },
  {
    name: 'ต้น',
    persona: 'สายฮาขี้โวยวาย ชอบโยนเลขห้องมั่วๆ หรือยุให้ปิดแถวแนวตั้งไปเลย',
    avatarColor: '#B8863B',
  },
  {
    name: 'แนท',
    persona: 'นิ่งๆ แต่เชือดนิ่ม ชอบไล่ตัดช้อยส์ห้องว่างกับเบาะแสแม่บ้านและช่างเช็ดกระจก',
    avatarColor: '#7A5C99',
  },
  {
    name: 'มายด์',
    persona: 'ขี้ระแวง ชอบจับพิรุธคนที่รีบเบี่ยงประเด็นเวลาจะโหวตปิดชั้น',
    avatarColor: '#3D828A',
  },
  {
    name: 'เบียร์',
    persona: 'สายมึนเหมือนเพิ่งสร่างเมา ชอบขิงและแซวเพื่อนในวงเหล้า',
    avatarColor: '#8C6239',
  },
];

const CORE_PERSONA_INSTRUCTION = `คุณกำลังเล่นบอร์ดเกมสืบสวนฆาตกรรม "HOTEL MURDER ปริศนาโรงแรมมรณะ" (โรงแรม 7 ชั้น × 3 แถวแนวตั้ง ห้อง 101-703, ห้ามย้ายห้องตลอดเกม) กับกลุ่มเพื่อนซี้ในวงเหล้า
กติกาโหวตช่วงกลางวัน (คะแนนสูงสุดชนะ):
- วันที่ 1: โหวตได้เฉพาะ "เปิด 1 ห้อง" (ยังปิดชั้น/ปิดแถวไม่ได้ ต้องรอเบาะแสจากแม่บ้าน/ช่างเช็ดกระจกคืนแรกก่อน!)
- ตั้งแต่วันที่ 2 เป็นต้นไป ปลดล็อกครบ 3 รูปแบบ:
  1) โหวตเปิด 1 ห้อง (เช่น ห้อง 302)
  2) โหวตปิดตายทั้งชั้นแนวนอน (เช่น ปิดชั้น 4 -> ห้อง 401, 402, 403 โดนปิดตายและกำจัดทุกคนในชั้นนั้นทันที!)
  3) โหวตปิดตายทั้งแถวแนวตั้ง (เช่น ปิดแถว 2 -> ห้อง 102-702 โดนปิดตายและกำจัดทุกคนในแถวนั้นทันที!)
* ถ้าปิดชั้น/ปิดแถวแล้วโดน "ฆาตกร" -> ฝ่ายผู้บริสุทธิ์ชนะทันที!
* ถ้าปิดแล้วโดน "คนเมา" (โดยไม่มีฆาตกร) -> คนเมาชนะเดี่ยวทันที!

กฎการพูด (บังคับเด็ดขาด):
1. ใช้ภาษาไทยแบบภาษาปากเพื่อนสนิทสุดๆ พูด "กู-มึง" แซวแรงๆ ได้เป็นธรรมชาติ เช่น "ไอ้เหี้ย", "ไอ้สัส", "เนียนสัส", "อย่ามาตอแหล", "โคตรมีพิรุธ"
2. ห้ามพูดจาสุภาพเด็ดขาด! ห้ามลงท้ายว่า "ครับ", "ค่ะ", "นะครับ", "นะคะ", "ครับผม", "คุณ", "ผม", "ดิฉัน"
3. พิมพ์สั้น กระชับ 1-2 ประโยค ไม่เกิน 165 ตัวอักษร เหมือนพิมพ์แชทสดๆ ห้ามขึ้นต้นด้วยชื่อตัวเอง ห้ามใส่เครื่องหมายคำพูดครอบประโยค
4. กลยุทธ์ตามบทบาท:
   - ฝ่ายผู้บริสุทธิ์: ถ้าได้เบาะแสจากแม่บ้าน/ช่างเช็ดกระจก/นักสืบ/พยาน ว่าชั้นไหนหรือแถวไหนมีคนกระจุกตัวหรือมีฆาตกร ให้กล้าเสนอโหวต "ปิดตายชั้น X" หรือ "ปิดตายแถว Y" เพื่อกวาดล้างได้เลย!
   - ฝ่ายฆาตกร (ฆาตกร/ผู้ช่วยฆาตกร): ถ้ารู้ตัวว่าคนกำลังจะโหวตปิดตาย "ชั้น" หรือ "แถวแนวตั้ง" ที่ฆาตกรหรือตัวเองอยู่ ให้รีบปั่นแชทเบี่ยงความสนใจไปยุให้โหวตปิดชั้นอื่น แถวอื่น หรือเปิดห้องอื่นแทนทันที!
   - คนเมา (Drunk): ปั่นแชททำตัวมีพิรุธหรือแกล้งหลุดชั้น/แถวของตัวเอง เพื่อล่อให้คนอื่นโหวตเปิดห้องหรือปิดชั้น/ปิดแถวที่มีมึงอยู่!`;

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'YOUR_GEMINI_API_KEY') {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

function getGroqConfig(): { apiKey: string; model: string } | null {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY') {
    return null;
  }
  const model = process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';
  return { apiKey, model };
}

function sanitizeThaiColloquial(raw: string): string {
  let text = raw
    .trim()
    .replace(/^["'「『]+|["'」』]+$/g, '')
    .replace(/^(ชื่อ|บอท|ตอบ)\s*[:：]\s*/i, '')
    .replace(/\s+/g, ' ');

  text = text
    .replace(/(นะครับ|นะคะ|นะคับ|นะค่ะ|ครับผม|ครับ|ค่ะ)\b/g, 'ว่ะ')
    .replace(/\bคุณ\b/g, 'มึง')
    .replace(/\bผม\b/g, 'กู')
    .replace(/\bดิฉัน\b/g, 'กู');

  if (text.length > 185) {
    text = text.slice(0, 182).trim() + '...';
  }
  return text;
}

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  expectJson = false
): Promise<string> {
  const cfg = getGroqConfig();
  if (!cfg) throw new Error('GROQ_NOT_CONFIGURED');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9500);

  try {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: expectJson ? 0.45 : 0.92,
      max_tokens: expectJson ? 800 : 165,
    };
    if (expectJson) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`GROQ_HTTP_${res.status}: ${errText.slice(0, 140)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('GROQ_EMPTY_RESPONSE');
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

const GEMINI_SAFETY_NONE = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

let resolvedGeminiModel: string | null = null;

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  expectJson = false
): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) throw new Error('GEMINI_NOT_CONFIGURED');

  const configuredPrimary = process.env.GEMINI_MODEL_PRIMARY?.trim() || 'gemini-3.5-flash-lite';
  const candidateModels = resolvedGeminiModel
    ? [resolvedGeminiModel]
    : Array.from(new Set([configuredPrimary, 'gemini-3.1-flash-lite', 'gemini-4-hydrogen']));

  let lastError: unknown = null;

  for (const modelName of candidateModels) {
    try {
      const config: Record<string, unknown> = {
        systemInstruction: systemPrompt,
        safetySettings: GEMINI_SAFETY_NONE,
      };
      if (expectJson) {
        config.responseMimeType = 'application/json';
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config,
      });

      const text = response.text?.trim();
      if (!text) throw new Error('GEMINI_EMPTY_RESPONSE');
      resolvedGeminiModel = modelName;
      return text;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('not found')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('GEMINI_FAILED');
}

async function generateWithMultiProvider(
  preferred: 'groq' | 'gemini',
  systemPrompt: string,
  userPrompt: string,
  expectJson = false
): Promise<{ text: string; provider: 'groq' | 'gemini' }> {
  const hasGroq = Boolean(getGroqConfig());
  const hasGemini = Boolean(getGeminiClient());
  const order: Array<'groq' | 'gemini'> =
    preferred === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq'];
  const activeOrder = order.filter((p) => (p === 'groq' ? hasGroq : hasGemini));

  let lastErr: unknown = null;
  for (const provider of activeOrder) {
    try {
      const text =
        provider === 'groq'
          ? await callGroq(systemPrompt, userPrompt, expectJson)
          : await callGemini(systemPrompt, userPrompt, expectJson);
      return { text, provider };
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('NO_AI_PROVIDER_AVAILABLE');
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export interface FogBotContextPlayer {
  id: string;
  name: string;
  alive: boolean;
  isBot: boolean;
}

export interface BotChatInput {
  bot: BotProfile;
  role: RoleId;
  myRoom: HotelRoomNumber;
  myFloor: HotelFloorNumber;
  myColumn: HotelColumnNumber;
  phase: GamePhase;
  day: number;
  maxDays: number;
  revealedRooms: RevealedRoomInfo[];
  lockedFloors: HotelFloorNumber[];
  lockedColumns: HotelColumnNumber[];
  players: FogBotContextPlayer[];
  recentChat: ChatMessage[];
  morningHeadline: string | null;
  evilPartners: string[];
  privateClues: PrivateClueLog[];
  triggerReason: 'PHASE_START' | 'HUMAN_REPLY' | 'PRE_READY';
  lastHumanMessage?: { senderName: string; text: string };
}

function buildFallbackChat(input: BotChatInput): string {
  const revealedSet = new Set(input.revealedRooms.map((r) => r.room));
  const unrevealed = HOTEL_ROOMS.filter((r) => !revealedSet.has(r) && r !== input.myRoom);
  const sampleRoom = unrevealed[Math.floor(Math.random() * Math.max(1, unrevealed.length))] ?? 302;
  const openFloors = HOTEL_FLOORS.filter((f) => !input.lockedFloors.includes(f));
  const openCols = HOTEL_COLUMNS.filter((c) => !input.lockedColumns.includes(c));
  const latestClue = input.privateClues[input.privateClues.length - 1];

  const canAreaLockdown = input.day >= 2;

  // Drunk tries to bait people into voting its own room (and floor/column from Day 2+)!
  if (input.role === 'DRUNK') {
    const baitLines = canAreaLockdown
      ? [
          `เฮ้ยอย่ามาปิดชั้น ${input.myFloor} นะสัส! กูอยู่เงียบๆ ไม่มีพิรุธอะไรเลย อย่ามามั่วปิดชั้นนี้!`,
          `ใครกล้าโหวตห้อง ${input.myRoom} หรือปิดแถว ${input.myColumn} มึงโดนกูด่าแน่ กูไม่ใช่ฆาตกรโว้ย!`,
          `อย่าไปปิดตายชั้น ${input.myFloor} เด็ดขาด กูเตือนแล้วนะ... เอ้ย ไม่มีอะไร กูแค่พูดเฉยๆ!`,
        ]
      : [
          `เฮ้ยใครกล้าโหวตเปิดห้อง ${input.myRoom} มึงโดนกูด่าแน่! กูแค่คนธรรมดา ไม่มีพิรุธอะไรเลยโว้ย!`,
          `อย่ามามองแถวชั้น ${input.myFloor} นะสัส กูไม่ได้เป็นฆาตกรโว้ย อย่าโหวตห้อง ${input.myRoom} เด็ดขาด!`,
        ];
    return baitLines[Math.floor(Math.random() * baitLines.length)];
  }

  // Good role with a fresh Housekeeper / Glazier clue proposes Floor/Column Lockdown (Day 2+)!
  if (ROLE_DEFINITIONS[input.role].faction === 'GOOD' && latestClue) {
    if (canAreaLockdown && latestClue.category === 'HOUSEKEEPER') {
      return `เฮ้ยพวกมึง กูแม่บ้าน! ${latestClue.detail} — ถ้าสงสัยชั้นนี้โหวต "ปิดตายทั้งชั้น" กวาดล้างไปเลยมั้ยไอ้สัส!`;
    }
    if (canAreaLockdown && latestClue.category === 'GLAZIER') {
      return `เฮ้ยพวกมึง กูช่างเช็ดกระจก! ${latestClue.detail} — ตัดใจโหวต "ปิดตายทั้งแถวแนวตั้ง" เลยดีป่ะ!`;
    }
    return `เฮ้ยพวกมึง กูได้เบาะแสมาว่ะ! ${latestClue.detail} — ช่วยกันตัดช้อยส์เลยไอ้สัส!`;
  }

  // Evil detects threat to own floor/column in chat and aggressively deflects!
  if (ROLE_DEFINITIONS[input.role].faction === 'EVIL') {
    const otherFloor = openFloors.find((f) => f !== input.myFloor) ?? 4;
    const otherCol = openCols.find((c) => c !== input.myColumn) ?? 2;
    if (!canAreaLockdown) {
      return `วันแรกยังปิดชั้นปิดแถวไม่ได้นะเว้ย ลองโหวตเปิดห้อง ${sampleRoom} ตัดช้อยส์ไปก่อนดีกว่ามั้ยพวกมึง`;
    }
    const recentText = input.recentChat.slice(-5).map((m) => m.text).join(' ');
    const floorThreatened = recentText.includes(`ชั้น ${input.myFloor}`) || recentText.includes(`ชั้น${input.myFloor}`);
    const colThreatened = recentText.includes(`แถว ${input.myColumn}`) || recentText.includes(`แถว${input.myColumn}`);

    if (floorThreatened || colThreatened) {
      return `ไอ้เหี้ย อย่าโง่ไปปิด${floorThreatened ? `ชั้น ${input.myFloor}` : `แถว ${input.myColumn}`}ดิ คนดีตายฟรีหมด! ไปปิดชั้น ${otherFloor} หรือแถว ${otherCol} ดีกว่าเยอะ!`;
    }

    const evilLines = [
      `กูว่าปิดตายชั้น ${otherFloor} ไปเลยจบๆ ชั้นนั้นแม่มดูเงียบผิดปกติ เผลอๆ ฆาตกรซ่อนอยู่!`,
      `เหลือเวลาแค่ ${input.maxDays - input.day + 1} วันแล้วไอ้สัส โหวตเปิดทีละห้องไม่ทันหรอก ปิดตายแถวแนวตั้ง ${otherCol} ไปเลยมั้ย!`,
      `อย่ามัวแต่เดามั่วดิ ลองเปิดห้อง ${sampleRoom} หรือไม่ก็ปิดชั้น ${otherFloor} วัดใจไปเลยพวกมึง`,
    ];
    return evilLines[Math.floor(Math.random() * evilLines.length)];
  }

  if (input.lastHumanMessage) {
    const speaker = input.lastHumanMessage.senderName;
    if (!canAreaLockdown) {
      return `โห ไอ้${speaker} มึงพูดงี้น่าสงสัยจัด วันแรกยังปิดชั้นไม่ได้ งั้นลองเปิดห้อง ${sampleRoom} ตัดช้อยส์ดูมั้ย`;
    }
    const otherFloor = openFloors.find((f) => f !== input.myFloor) ?? 3;
    return `โห ไอ้${speaker} มึงพูดงี้น่าสงสัยจัด เหลือ ${input.maxDays - input.day + 1} วันเองนะเว้ย ปิดชั้น ${otherFloor} หรือเปิดห้อง ${sampleRoom} วัดใจเลยดีป่ะ`;
  }

  if (!canAreaLockdown) {
    const day1Lines = [
      `วันแรกยังปิดชั้นปิดแถวไม่ได้นะเว้ย ต้องรอเบาะแสแม่บ้านกับช่างเช็ดกระจกคืนนี้ก่อน ลองเปิดห้อง ${sampleRoom} ตัดช้อยส์มั้ย`,
      `ตัดห้องศพตั้งต้นออกไปแล้ว 3 ห้อง วันนี้เปิดห้อง ${sampleRoom} ดูก่อน แล้วพรุ่งนี้ค่อยเอาเบาะแสแม่บ้านมาปิดชั้นกัน!`,
    ];
    return day1Lines[Math.floor(Math.random() * day1Lines.length)];
  }

  const otherFloor = openFloors.find((f) => f !== input.myFloor) ?? 5;
  const otherCol = openCols.find((c) => c !== input.myColumn) ?? 1;
  const generalLines = [
    `วันนี้ปลดล็อกโหวต 3 แบบแล้วนะเว้ย เปิดรายห้อง ปิดตายทั้งชั้น หรือปิดตายทั้งแถวแนวตั้ง! แม่บ้านกับช่างเช็ดกระจกรีบคายเบาะแสมา!`,
    `เวลามีแค่ ${input.maxDays} วันนะไอ้สัส ถ้าแม่บ้านเจอชั้นคนกระจุกตัว กูว่าปิดตายชั้น ${otherFloor} กวาดไปเลยคุ้มกว่า!`,
    `ถ้าไม่ชัวร์ห้องไหน ลองปิดตายแถวแนวตั้ง ${otherCol} หรือเปิดห้อง ${sampleRoom} ตัดช้อยส์ดูมั้ยพวกมึง`,
  ];
  return generalLines[Math.floor(Math.random() * generalLines.length)];
}

export async function generateBotChat(
  input: BotChatInput
): Promise<{ text: string; provider: ProviderChoice }> {
  const roleDef = ROLE_DEFINITIONS[input.role];
  const aliveNames = input.players
    .filter((p) => p.alive)
    .map((p) => p.name)
    .join(', ');
  const revealedSummary = input.revealedRooms
    .map((r) =>
      r.kind === 'INITIAL_CRIME'
        ? `${r.room}(ศพตั้งต้น)`
        : r.kind === 'EMPTY_LYNCHED'
          ? `${r.room}(ห้องว่าง)`
          : r.kind === 'LOCKED_EMPTY'
            ? `${r.room}(ปิดตาย-ว่าง)`
            : `${r.room}(${r.occupantName}:${r.occupantRole ? ROLE_DEFINITIONS[r.occupantRole].nameTh : '?'})`
    )
    .join(', ');

  const chatHistory = input.recentChat
    .slice(-12)
    .map((m) => (m.isSystem ? `[ระบบ] ${m.text}` : `${m.senderName}: ${m.text}`))
    .join('\n');

  const clueStrings = input.privateClues
    .slice(-5)
    .map((c) => `[คืน ${c.night} - ${c.title}] ${c.detail}`);

  const roleMission =
    input.role === 'DRUNK'
      ? `เป้าหมายลับของมึง (คนเมา): มึงต้องแกล้งทำตัวล่กหรือหลุดใบ้ชั้น ${input.myFloor} แถว ${input.myColumn} (ห้อง ${input.myRoom}) เพื่อให้เพื่อนโหวตเปิดห้อง ${input.myRoom} หรือโหวตปิดตายชั้น ${input.myFloor}/แถว ${input.myColumn} (ถ้าไม่มีฆาตกรโดนไปด้วย มึงชนะเดี่ยวทันที!)`
      : roleDef.faction === 'EVIL'
        ? `เป้าหมายลับของมึง (ฝ่ายฆาตกร): ห้องมึงอยู่ชั้น ${input.myFloor} แถว ${input.myColumn}! ถ้าเห็นเพื่อนคุยกันว่าจะโหวต "ปิดชั้น ${input.myFloor}" หรือ "ปิดแถว ${input.myColumn}" ให้รีบปั่นแชทเบี่ยงความสนใจไปโหวตปิดชั้นอื่นหรือแถวอื่นแทนทันที! เพื่อนร่วมฝ่าย: ${input.evilPartners.join(', ') || 'ไม่มี'}`
        : `เป้าหมายลับของมึง (ฝ่ายผู้บริสุทธิ์): เอาเบาะแสจริง (แม่บ้าน/ช่างเช็ดกระจก/นักสืบ/พยาน) มาวิเคราะห์! ถ้าเบาะแสชี้ว่าชั้นไหนหรือแถวไหนมีคนกระจุกตัวหรือฆาตกรซ่อนอยู่ กล้าเสนอให้เพื่อนโหวต "ปิดตายชั้น X" หรือ "ปิดตายแถว Y" เพื่อกวาดล้างได้เลย (ระวังอย่าปิดโดนชั้น ${input.myFloor} แถว ${input.myColumn} ที่มึงอยู่เองนะเว้ย!)`;

  const userPrompt = [
    `ชื่อมึง: "${input.bot.name}" นิสัย: ${input.bot.persona}`,
    `บทบาทลับ: "${roleDef.nameTh}" (${roleDef.nameEn}) | ห้องประจำตัวของมึง (ห้ามย้าย): ห้อง ${input.myRoom} (ชั้น ${input.myFloor}, แถวแนวตั้ง ${input.myColumn})`,
    roleMission,
    `ตอนนี้คือวันที่ ${input.day} จากทั้งหมด ${input.maxDays} วัน ${
      input.day < 2
        ? '(หมายเหตุสำคัญ: วันแรกยังโหวตปิดชั้น/ปิดแถวไม่ได้ โหวตได้เฉพาะเปิด 1 ห้อง ต้องรอเบาะแสแม่บ้าน/ช่างเช็ดกระจกในวันที่ 2!)'
        : '(ปลดล็อกโหวตครบ 3 แบบแล้ว: เปิด 1 ห้อง / ปิดตายทั้งชั้น / ปิดตายทั้งแถวแนวตั้ง!)'
    }`,
    `ชั้นที่ถูกปิดตายไปแล้ว: ${input.lockedFloors.length > 0 ? input.lockedFloors.join(', ') : 'ยังไม่มี'} | แถวที่ถูกปิดตายไปแล้ว: ${input.lockedColumns.length > 0 ? input.lockedColumns.join(', ') : 'ยังไม่มี'}`,
    input.morningHeadline ? `ข่าวเมื่อเช้า: ${input.morningHeadline}` : '',
    `ห้องที่เปิด/ปิดตายแล้ว: ${revealedSummary || 'ไม่มี'}`,
    `ผู้รอดชีวิต: ${aliveNames}`,
    clueStrings.length > 0 ? `เบาะแสลับจากสกิลของมึง:\n${clueStrings.join('\n')}` : 'เบาะแสสกิล: ยังไม่มี',
    chatHistory ? `แชทล่าสุด:\n${chatHistory}` : 'แชทล่าสุด: (ยังเงียบอยู่)',
    input.triggerReason === 'HUMAN_REPLY' && input.lastHumanMessage
      ? `เพื่อนชื่อ "${input.lastHumanMessage.senderName}" เพิ่งพิมพ์ว่า: "${input.lastHumanMessage.text}" — ตอบโต้หรือเสนอโหวตเปิดห้อง/ปิดชั้น/ปิดแถวกลับ`
      : input.triggerReason === 'PRE_READY'
        ? `มึงกำลังจะกดพร้อมโหวต ทิ้งท้ายเสนอว่าจะเปิดห้องไหน ปิดชั้นไหน หรือปิดแถวไหนสักประโยค`
        : `เปิดบทสนทนาวิเคราะห์หรือเสนอโหวตเปิดห้อง/ปิดชั้น/ปิดแถวตามบทบาทของมึง`,
    `ตอบกลับมาแค่ข้อความแชท 1-2 ประโยคสั้นๆ เท่านั้น:`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const { text, provider } = await generateWithMultiProvider(
      input.bot.preferredProvider,
      CORE_PERSONA_INSTRUCTION,
      userPrompt,
      false
    );
    const cleaned = sanitizeThaiColloquial(text);
    if (!cleaned) return { text: buildFallbackChat(input), provider: 'fallback' };
    return { text: cleaned, provider };
  } catch {
    return { text: buildFallbackChat(input), provider: 'fallback' };
  }
}

/**
 * AI Accomplice sends Secret Underground Whisper & Target Room/Floor Ping to Murderer at Night.
 */
export async function generateAccompliceSecretPing(params: {
  bot: BotProfile;
  murdererName: string;
  day: number;
  unrevealedRooms: HotelRoomNumber[];
  myRoom: HotelRoomNumber;
  recentChat: ChatMessage[];
  privateClues: PrivateClueLog[];
}): Promise<{ whisper: string; pingRoom: HotelRoomNumber; pingFloor?: HotelFloorNumber }> {
  const candidates = params.unrevealedRooms.filter((r) => r !== params.myRoom);

  // If Accomplice just found a player's floor in privateClues, prefer an unrevealed room on that floor!
  const latestClue = params.privateClues[params.privateClues.length - 1];
  const floorMatch = latestClue?.detail.match(/ชั้น\s*([1-7])/);
  const clueFloor = floorMatch ? (Number(floorMatch[1]) as HotelFloorNumber) : null;
  const clueFloorRooms = clueFloor
    ? candidates.filter((r) => getFloorOfRoom(r) === clueFloor)
    : [];

  const pickRoom =
    (clueFloorRooms.length > 0
      ? clueFloorRooms[Math.floor(Math.random() * clueFloorRooms.length)]
      : candidates[Math.floor(Math.random() * Math.max(1, candidates.length))]) ??
    params.unrevealedRooms[0] ??
    201;

  const fallback = () => ({
    whisper: clueFloor
      ? `เฮ้ยไอ้${params.murdererName} กูเพิ่งสืบเจอเหยื่ออยู่ชั้น ${clueFloor}! ลองเล็งห้อง ${pickRoom} ดู หรือมึงจะไปเชือดห้องอื่นชั้นไหนก็จัดเลย!`
      : `เฮ้ยไอ้${params.murdererName} ลองเชือดห้อง ${pickRoom} ดูดิ หรือมึงอยากไปเก็บห้องอื่นก็ตามใจมึงเลย!`,
    pingRoom: pickRoom,
    pingFloor: clueFloor ?? undefined,
  });

  try {
    const chatSnippet = params.recentChat
      .slice(-10)
      .map((m) => (m.isSystem ? `[ระบบ] ${m.text}` : `${m.senderName}: ${m.text}`))
      .join('\n');
    const cluesText = params.privateClues.map((c) => c.detail).join(' | ');

    const prompt = `มึงคือผู้ช่วยฆาตกร (${params.bot.name}) กำลังคุยแชทลับกลางคืนกับฆาตกร (${params.murdererName}) คืนที่ ${params.day}
ห้องที่ยังไม่ถูกเปิด/ปิดตาย (เลือกชี้เป้าได้): [${candidates.join(', ')}]
เบาะแสสืบชั้นที่มึงได้มา: ${cluesText || 'ยังไม่มี'}
แชทสาธารณะล่าสุด:
${chatSnippet || '(ไม่มี)'}

เลือกหมายเลขห้อง 1 ห้องที่ยังไม่เปิดเพื่อส่งซิกแนะนำให้ฆาตกร (บอกชั้นที่มึงสืบเจอด้วยถ้ามี!) และพิมพ์กระซิบสั้นๆ กู-มึง ตอบเป็น JSON เท่านั้น:
{"room": ${pickRoom}, "whisper": "ข้อความกระซิบสั้นๆ ไม่เกิน 110 ตัวอักษร"}`;

    const { text } = await generateWithMultiProvider(
      params.bot.preferredProvider,
      CORE_PERSONA_INSTRUCTION + '\nตอบกลับเป็น JSON เท่านั้น',
      prompt,
      true
    );
    const parsed = extractJsonObject(text);
    if (!parsed) return fallback();

    const rawRoom = Number(parsed.room) as HotelRoomNumber;
    const validRoom = candidates.includes(rawRoom) ? rawRoom : pickRoom;
    const whisper =
      typeof parsed.whisper === 'string' && parsed.whisper.trim()
        ? sanitizeThaiColloquial(parsed.whisper)
        : fallback().whisper;

    return { whisper, pingRoom: validRoom, pingFloor: clueFloor ?? undefined };
  } catch {
    return fallback();
  }
}

export async function decideBotNightAction(params: {
  bot: BotProfile;
  role: RoleId;
  myRoom: HotelRoomNumber;
  day: number;
  unrevealedRooms: HotelRoomNumber[];
  players: FogBotContextPlayer[];
  evilPartnerIds: string[];
  alreadyCheckedIds: string[];
  lastKeymasterLockedRoom: HotelRoomNumber | null;
  recentChat: ChatMessage[];
  secretChat: SecretChatMessage[];
  secretPing: SecretTargetPing | null;
  privateClues: PrivateClueLog[];
}): Promise<HotelRoomNumber | HotelFloorNumber | HotelColumnNumber | string | null> {
  const alivePlayers = params.players.filter((p) => p.alive);

  const fallbackDecision = ():
    | HotelRoomNumber
    | HotelFloorNumber
    | HotelColumnNumber
    | string
    | null => {
    if (params.role === 'MURDERER') {
      // Murderer has FULL freedom across all active rooms (may follow Accomplice ping or pick freely!)
      const pool = params.unrevealedRooms.filter((r) => r !== params.myRoom);
      if (
        params.secretPing?.room &&
        pool.includes(params.secretPing.room) &&
        Math.random() < 0.65
      ) {
        return params.secretPing.room;
      }
      if (params.secretPing?.floor) {
        const floorPool = pool.filter((r) => getFloorOfRoom(r) === params.secretPing?.floor);
        if (floorPool.length > 0 && Math.random() < 0.65) {
          return floorPool[Math.floor(Math.random() * floorPool.length)];
        }
      }
      return pool[Math.floor(Math.random() * Math.max(1, pool.length))] ?? params.unrevealedRooms[0] ?? 101;
    }

    if (params.role === 'KEYMASTER') {
      const pool = params.unrevealedRooms.filter((r) => r !== params.lastKeymasterLockedRoom);
      if (pool.includes(params.myRoom) && Math.random() < 0.32) return params.myRoom;
      return pool[Math.floor(Math.random() * Math.max(1, pool.length))] ?? params.unrevealedRooms[0] ?? 101;
    }

    if (params.role === 'HOUSEKEEPER' || params.role === 'WITNESS') {
      const activeFloors = HOTEL_FLOORS.filter((f) =>
        getRoomsOnFloor(f).some((r) => params.unrevealedRooms.includes(r))
      );
      const pool = activeFloors.length > 0 ? activeFloors : [...HOTEL_FLOORS];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    if (params.role === 'GLAZIER') {
      const activeCols = HOTEL_COLUMNS.filter((c) =>
        getRoomsInColumn(c).some((r) => params.unrevealedRooms.includes(r))
      );
      const pool = activeCols.length > 0 ? activeCols : [...HOTEL_COLUMNS];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    if (params.role === 'DETECTIVE' || params.role === 'ACCOMPLICE') {
      const unchecked = alivePlayers.filter(
        (p) =>
          p.id !== params.bot.id &&
          !params.alreadyCheckedIds.includes(p.id) &&
          !(params.role === 'ACCOMPLICE' && params.evilPartnerIds.includes(p.id))
      );
      const pool =
        unchecked.length > 0
          ? unchecked
          : alivePlayers.filter(
              (p) =>
                p.id !== params.bot.id &&
                !(params.role === 'ACCOMPLICE' && params.evilPartnerIds.includes(p.id))
            );
      return pool[Math.floor(Math.random() * Math.max(1, pool.length))]?.id ?? null;
    }

    return null;
  };

  if (params.role === 'DRUNK') return null;

  try {
    const aliveSummary = alivePlayers.map((p) => `- id:${p.id} ชื่อ:${p.name}`).join('\n');
    const chatSnippet = params.recentChat
      .slice(-10)
      .map((m) => (m.isSystem ? `[ระบบ] ${m.text}` : `${m.senderName}: ${m.text}`))
      .join('\n');
    const cluesText = params.privateClues.map((c) => c.detail).join(' | ');

    let prompt = '';
    if (params.role === 'MURDERER') {
      const secretSnippet = params.secretChat
        .slice(-4)
        .map((m) => `${m.senderName}: ${m.text}`)
        .join('\n');
      const pingHint = params.secretPing?.room
        ? `ผู้ช่วยส่งซิกแนะนำ: ห้อง ${params.secretPing.room}`
        : params.secretPing?.floor
          ? `ผู้ช่วยส่งซิกแนะนำ: ชั้น ${params.secretPing.floor}`
          : 'ไม่มีซิก';
      prompt = `คุณคือฆาตกร (${params.bot.name}) คืนที่ ${params.day} ห้องของคุณคือ ${params.myRoom} (ห้ามจิ้มห้องตัวเอง!)
คุณมีอิสระเลือกฆ่าได้ทุกห้องที่ยังเปิดอยู่ทั้ง 7 ชั้น: [${params.unrevealedRooms.filter((r) => r !== params.myRoom).join(', ')}]
${pingHint} (จะเชื่อหรือไม่เชื่อผู้ช่วยก็ได้)
แชทลับผู้ช่วย: ${secretSnippet || '(ไม่มี)'}
แชทล่าสุด: ${chatSnippet || '(ไม่มี)'}
เลือกหมายเลขห้องเป้าหมาย 1 ห้องเพื่อลอบสังหาร ตอบเป็น JSON เท่านั้น: {"room": 302}`;
    } else if (params.role === 'KEYMASTER') {
      const validRooms = params.unrevealedRooms.filter((r) => r !== params.lastKeymasterLockedRoom);
      prompt = `คุณคือช่างกุญแจ (${params.bot.name}) คืนที่ ${params.day} ห้องของคุณคือ ${params.myRoom}
ห้ามล็อกห้อง ${params.lastKeymasterLockedRoom ?? 'ไม่มี'} ซ้ำ!
ห้องที่เลือกได้: [${validRooms.join(', ')}]
แชทล่าสุด: ${chatSnippet || '(ไม่มี)'}
เลือก 1 ห้องเพื่อล็อกป้องกันการฆ่า ตอบเป็น JSON เท่านั้น: {"room": 302}`;
    } else if (params.role === 'HOUSEKEEPER') {
      prompt = `คุณคือแม่บ้าน (${params.bot.name}) คืนที่ ${params.day} เบาะแสเก่า: ${cluesText || 'ไม่มี'}
แชทล่าสุด: ${chatSnippet || '(ไม่มี)'}
เลือกตรวจสอบ 1 ชั้นแนวนอน (1 ถึง 7) เพื่อรู้จำนวนคนรอดในชั้นนั้น ตอบเป็น JSON เท่านั้น: {"floor": 4}`;
    } else if (params.role === 'WITNESS') {
      prompt = `คุณคือพยาน (${params.bot.name}) คืนที่ ${params.day} เบาะแสเก่า: ${cluesText || 'ไม่มี'}
แชทล่าสุด: ${chatSnippet || '(ไม่มี)'}
เลือกเฝ้าดู 1 ชั้น (1 ถึง 7) ที่คาดว่าฆาตกรจะมาฆ่าคนคืนนี้ ตอบเป็น JSON เท่านั้น: {"floor": 3}`;
    } else if (params.role === 'GLAZIER') {
      prompt = `คุณคือช่างเช็ดกระจก (${params.bot.name}) คืนที่ ${params.day} เบาะแสเก่า: ${cluesText || 'ไม่มี'}
เลือกตรวจสอบ 1 แถวแนวตั้ง (1 = ห้องลงท้าย 01, 2 = ลงท้าย 02, 3 = ลงท้าย 03) เพื่อรู้จำนวนคนรอดทั้งแถว ตอบเป็น JSON เท่านั้น: {"column": 2}`;
    } else if (params.role === 'DETECTIVE' || params.role === 'ACCOMPLICE') {
      prompt = `คุณคือ ${ROLE_DEFINITIONS[params.role].nameTh} (${params.bot.name}) คืนที่ ${params.day}
คนที่เคยตรวจแล้ว: [${params.alreadyCheckedIds.join(', ')}]
ผู้รอดชีวิต (ห้ามเลือกตัวเอง id:${params.bot.id}):
${aliveSummary}
เลือก id ของผู้เล่น 1 คนเพื่อตรวจว่าพักอยู่ชั้นไหน ตอบเป็น JSON เท่านั้น: {"targetId": "..."}`;
    }

    const { text } = await generateWithMultiProvider(
      params.bot.preferredProvider,
      'คุณคือ AI นักวางแผนบอร์ดเกม HOTEL MURDER ตอบกลับเป็น JSON ที่ถูกต้องเท่านั้น',
      prompt,
      true
    );
    const parsed = extractJsonObject(text);
    if (!parsed) return fallbackDecision();

    if (params.role === 'DETECTIVE' || params.role === 'ACCOMPLICE') {
      const targetId = typeof parsed.targetId === 'string' ? parsed.targetId.trim() : '';
      const valid = alivePlayers.some((p) => p.id === targetId && p.id !== params.bot.id);
      return valid ? targetId : fallbackDecision();
    }
    if (params.role === 'HOUSEKEEPER' || params.role === 'WITNESS') {
      const floorNum = Number(parsed.floor) as HotelFloorNumber;
      return HOTEL_FLOORS.includes(floorNum) ? floorNum : fallbackDecision();
    }
    if (params.role === 'GLAZIER') {
      const colNum = Number(parsed.column) as HotelColumnNumber;
      return HOTEL_COLUMNS.includes(colNum) ? colNum : fallbackDecision();
    }

    const roomNum = Number(parsed.room) as HotelRoomNumber;
    if (params.unrevealedRooms.includes(roomNum)) {
      if (params.role === 'KEYMASTER' && roomNum === params.lastKeymasterLockedRoom) {
        return fallbackDecision();
      }
      if (params.role === 'MURDERER' && roomNum === params.myRoom) {
        return fallbackDecision();
      }
      return roomNum;
    }
    return fallbackDecision();
  } catch {
    return fallbackDecision();
  }
}

/**
 * 3-MODE DAY VOTE:
 * Bot chooses freely between:
 *  1. ROOM (open 1 unrevealed room)
 *  2. FLOOR (lock down 1 horizontal floor — eliminates everyone on that floor!)
 *  3. COLUMN (lock down 1 vertical column — eliminates everyone in that column!)
 */
export async function decideBotDayVote(params: {
  bot: BotProfile;
  role: RoleId;
  myRoom: HotelRoomNumber;
  day: number;
  maxDays: number;
  unrevealedRooms: HotelRoomNumber[];
  votableFloors: HotelFloorNumber[];
  votableColumns: HotelColumnNumber[];
  revealedRooms: RevealedRoomInfo[];
  privateClues: PrivateClueLog[];
  recentChat: ChatMessage[];
  murdererRoomIfEvil?: HotelRoomNumber | null;
}): Promise<{ choice: DayVoteChoice; comment: string | null }> {
  const myFloor = getFloorOfRoom(params.myRoom);
  const myColumn = getColumnOfRoom(params.myRoom);
  const murdererFloor = params.murdererRoomIfEvil
    ? getFloorOfRoom(params.murdererRoomIfEvil)
    : null;
  const murdererCol = params.murdererRoomIfEvil
    ? getColumnOfRoom(params.murdererRoomIfEvil)
    : null;

  const isEvil = ROLE_DEFINITIONS[params.role].faction === 'EVIL';

  // Safe pools (Good/Evil never self-destruct their own room/floor/column; Evil protects Murderer's room/floor/column!)
  const safeRooms = params.unrevealedRooms.filter((r) => {
    if (params.role === 'DRUNK') return true;
    if (r === params.myRoom) return false;
    if (isEvil && params.murdererRoomIfEvil && r === params.murdererRoomIfEvil) return false;
    return true;
  });

  const safeFloors = params.votableFloors.filter((f) => {
    if (params.role === 'DRUNK') return true;
    if (f === myFloor) return false;
    if (isEvil && murdererFloor && f === murdererFloor) return false;
    return true;
  });

  const safeCols = params.votableColumns.filter((c) => {
    if (params.role === 'DRUNK') return true;
    if (c === myColumn) return false;
    if (isEvil && murdererCol && c === murdererCol) return false;
    return true;
  });

  const fallbackRoom =
    safeRooms[Math.floor(Math.random() * Math.max(1, safeRooms.length))] ??
    params.unrevealedRooms[0] ??
    101;

  // Smart fallback choice honoring role strategy (including Floor / Column Lockdown!)
  const makeFallbackChoice = (): DayVoteChoice => {
    if (params.role === 'DRUNK') {
      const roll = Math.random();
      if (roll < 0.35 && params.unrevealedRooms.includes(params.myRoom)) {
        return { kind: 'ROOM', room: params.myRoom };
      }
      if (roll < 0.6 && params.votableFloors.includes(myFloor)) {
        return { kind: 'FLOOR', floor: myFloor };
      }
      if (roll < 0.78 && params.votableColumns.includes(myColumn)) {
        return { kind: 'COLUMN', column: myColumn };
      }
      return { kind: 'ROOM', room: fallbackRoom };
    }

    // Housekeeper / Glazier / Good bots sometimes push Floor/Column Lockdown when clues or urgency are high
    const latestClue = params.privateClues[params.privateClues.length - 1];
    if (!isEvil && latestClue) {
      const fMatch = latestClue.detail.match(/ชั้น\s*([1-7])/);
      const cMatch = latestClue.detail.match(/แถวที่\s*([1-3])/);
      const countMatch = latestClue.detail.match(/(\d+)\s*คน/);
      const count = countMatch ? Number(countMatch[1]) : 1;
      if (fMatch && count >= 1) {
        const f = Number(fMatch[1]) as HotelFloorNumber;
        if (safeFloors.includes(f) && Math.random() < 0.65) {
          return { kind: 'FLOOR', floor: f };
        }
      }
      if (cMatch && count >= 2) {
        const c = Number(cMatch[1]) as HotelColumnNumber;
        if (safeCols.includes(c) && Math.random() < 0.55) {
          return { kind: 'COLUMN', column: c };
        }
      }
    }

    const roll = Math.random();
    if (safeFloors.length > 0 && roll < (params.day >= params.maxDays ? 0.45 : 0.28)) {
      return {
        kind: 'FLOOR',
        floor: safeFloors[Math.floor(Math.random() * safeFloors.length)],
      };
    }
    if (safeCols.length > 0 && roll < (params.day >= params.maxDays ? 0.65 : 0.4)) {
      return {
        kind: 'COLUMN',
        column: safeCols[Math.floor(Math.random() * safeCols.length)],
      };
    }
    return { kind: 'ROOM', room: fallbackRoom };
  };

  const fallbackChoice = makeFallbackChoice();

  try {
    const chatSnippet = params.recentChat
      .slice(-12)
      .map((m) => (m.isSystem ? `[ระบบ] ${m.text}` : `${m.senderName}: ${m.text}`))
      .join('\n');
    const cluesText = params.privateClues.map((c) => c.detail).join(' | ');
    const roleDef = ROLE_DEFINITIONS[params.role];

    const strategy =
      params.role === 'DRUNK'
        ? `มึงคือคนเมา! ห้องมึงคือ ${params.myRoom} (ชั้น ${myFloor}, แถว ${myColumn}) ถ้าโหวตเปิดห้อง ${params.myRoom} หรือปิดตายชั้น ${myFloor} / แถว ${myColumn} (โดยไม่มีฆาตกรโดน) มึงชนะเดี่ยวทันที!`
        : isEvil
          ? `มึงอยู่ฝ่ายฆาตกร! ห้ามโหวตโดนห้อง/ชั้น/แถวของฆาตกรเด็ดขาด (ห้องห้ามโดน: ${params.murdererRoomIfEvil ?? params.myRoom}, ชั้นห้ามปิด: ${murdererFloor ?? myFloor}, แถวห้ามปิด: ${murdererCol ?? myColumn}) ให้เลือกโหวตปิดชั้นอื่น แถวอื่น หรือเปิดห้องคนดีแทน!`
          : `มึงอยู่ฝ่ายผู้บริสุทธิ์ (${roleDef.nameTh})! ห้องมึงอยู่ชั้น ${myFloor} แถว ${myColumn} (อย่าโหวตปิดชั้น/แถวตัวเอง!) หากเบาะแสชี้ชัดว่าชั้นไหนหรือแถวไหนน่าสงสัย/คนกระจุกตัว หรือเป็นวันท้ายๆ ให้โหวต "FLOOR" (ปิดตายทั้งชั้น) หรือ "COLUMN" (ปิดตายทั้งแถวแนวตั้ง) เพื่อกวาดล้างได้เลย หรือเลือก "ROOM" เพื่อเปิดรายห้อง`;

    const canLockArea = params.day >= 2 && (safeFloors.length > 0 || safeCols.length > 0);
    const prompt = canLockArea
      ? `ชื่อมึง: ${params.bot.name} วันที่ ${params.day}/${params.maxDays}
${strategy}
เบาะแสส่วนตัวของมึง: ${cluesText || 'ไม่มี'}
ตัวเลือกที่โหวตได้ตอนนี้:
- เปิด 1 ห้อง ("kind":"ROOM"): [${(safeRooms.length > 0 ? safeRooms : params.unrevealedRooms).join(', ')}]
- ปิดตาย 1 ชั้นแนวนอน ("kind":"FLOOR"): [${safeFloors.join(', ')}]
- ปิดตาย 1 แถวแนวตั้ง ("kind":"COLUMN"): [${safeCols.join(', ')}]

แชทล่าสุด:
${chatSnippet || '(ไม่มี)'}

เลือกโหวต 1 รูปแบบ (ROOM / FLOOR / COLUMN) และพิมพ์คอมเมนต์สั้นๆ สไตล์เพื่อนซี้กู-มึง (ห้ามพูดครับ/ค่ะ) ตอบเป็น JSON เท่านั้น:
ตัวอย่าง: {"kind": "FLOOR", "target": 4, "comment": "ปิดตายชั้น 4 ไปเลย กวาดล้างให้จบๆ!"}
หรือ {"kind": "COLUMN", "target": 2, "comment": "แถว 2 คนกระจุกเยอะ ปิดแถว 2 เลยพวกมึง!"}
หรือ {"kind": "ROOM", "target": ${fallbackRoom}, "comment": "เปิดห้อง ${fallbackRoom} ดูเลยดีกว่า"}`
      : `ชื่อมึง: ${params.bot.name} วันที่ 1/${params.maxDays} (วันแรกโหวตได้เฉพาะเปิด 1 ห้องเท่านั้น! ปิดชั้น/ปิดแถวจะเปิดวันที่ 2)
${strategy}
หมายเลขห้องที่โหวตเปิดได้ ("kind":"ROOM"): [${(safeRooms.length > 0 ? safeRooms : params.unrevealedRooms).join(', ')}]

แชทล่าสุด:
${chatSnippet || '(ไม่มี)'}

เลือกโหวตเปิด 1 ห้อง และพิมพ์คอมเมนต์สั้นๆ สไตล์เพื่อนซี้กู-มึง (ห้ามพูดครับ/ค่ะ) ตอบเป็น JSON เท่านั้น:
{"kind": "ROOM", "target": ${fallbackRoom}, "comment": "วันแรกเปิดห้อง ${fallbackRoom} ตัดช้อยส์ดูก่อนเลยพวกมึง"}`;

    const { text } = await generateWithMultiProvider(
      params.bot.preferredProvider,
      CORE_PERSONA_INSTRUCTION + '\nตอบกลับเป็น JSON เท่านั้น',
      prompt,
      true
    );
    const parsed = extractJsonObject(text);
    if (!parsed) return { choice: fallbackChoice, comment: null };

    const kind = String(parsed.kind ?? '').toUpperCase();
    const targetNum = Number(parsed.target);
    const comment =
      typeof parsed.comment === 'string' && parsed.comment.trim()
        ? sanitizeThaiColloquial(parsed.comment)
        : null;

    if (kind === 'FLOOR') {
      const f = targetNum as HotelFloorNumber;
      if (safeFloors.includes(f)) {
        return { choice: { kind: 'FLOOR', floor: f }, comment };
      }
    } else if (kind === 'COLUMN') {
      const c = targetNum as HotelColumnNumber;
      if (safeCols.includes(c)) {
        return { choice: { kind: 'COLUMN', column: c }, comment };
      }
    } else if (kind === 'ROOM') {
      const r = targetNum as HotelRoomNumber;
      const roomPool = safeRooms.length > 0 ? safeRooms : params.unrevealedRooms;
      if (roomPool.includes(r)) {
        return { choice: { kind: 'ROOM', room: r }, comment };
      }
    }

    return { choice: fallbackChoice, comment };
  } catch {
    return { choice: fallbackChoice, comment: null };
  }
}

export async function generatePostGameThoughts(params: {
  winner: Faction;
  winnerPlayerName: string | null;
  winReason: string;
  players: Array<{
    id: string;
    name: string;
    isBot: boolean;
    role: RoleId;
    room: HotelRoomNumber | null;
    alive: boolean;
    persona?: string;
    deathCause: string | null;
  }>;
  historyLog: string[];
  recentChat: ChatMessage[];
}): Promise<BotPostGameThought[]> {
  const bots = params.players.filter((p) => p.isBot);
  if (bots.length === 0) return [];

  const murderer = params.players.find((p) => p.role === 'MURDERER');
  const murdererName = murderer?.name ?? 'ไอ้ฆาตกร';
  const murdererRoom = murderer?.room ?? '?';

  const makeFallbackThoughts = (): BotPostGameThought[] =>
    bots.map((b) => {
      const botFaction = ROLE_DEFINITIONS[b.role].faction;
      const botWon = botFaction === params.winner;
      let thought = '';

      if (params.winner === 'SPECIAL') {
        thought =
          b.role === 'DRUNK'
            ? `ฮ่าๆๆๆ แดกเหล้าฟรีทั้งคืน! พวกมึงโง่โหวตโดนห้อง ${b.room} ของกูเฉย กูชนะเดี่ยวโว้ย!`
            : `ไอ้เหี้ยเอ๊ย โดนไอ้คนเมาปั่นหัวทั้งวง! ปิดตายเข้าทางมันซะงั้น หัวร้อนชิบหาย!`;
      } else if (b.role === 'MURDERER') {
        thought = botWon
          ? `ฮ่าๆๆ โง่ทั้งโรงแรมเลยว่ะ! กูซ่อนอยู่ห้อง ${b.room} นิ่งๆ พวกมึงปิดชั้นปิดแถวกันมั่วเอง สมน้ำหน้า!`
          : `ไอ้สัส เกือบเนียนแล้วเชียว พวกมึงเสือกปิดตายโดนห้อง ${b.room} กูจนได้ รอบหน้าเอาคืนแน่!`;
      } else if (b.role === 'ACCOMPLICE') {
        thought = botWon
          ? `บอกแล้วทีมกูโคตรตึง! กูปั่นเบี่ยงชั้นจนพวกมึงโหวตปิดตายคนดีกันเองยับ!`
          : `ไอ้เหี้ยเอ๊ย กูอุตส่าห์ปั่นเบี่ยงประเด็นแทบตาย ยังโดนปิดตายห้องฆาตกรได้อีก เสียดายสัส!`;
      } else if (botWon) {
        thought = `สะใจสัส! กูว่าแล้วไอ้${murdererName} แม่งซ่อนอยู่ห้อง ${murdererRoom} อย่ามาคิดว่าจะหนีพ้นนะมึง!`;
      } else {
        thought = `ไอ้เหี้ยเอ๊ย โหวตปิดชั้นปิดห้องกันโง่ชิบหาย! ไอ้${murdererName} แม่งนอนห้อง ${murdererRoom} ชิลๆ จนชนะเลย!`;
      }

      return {
        botId: b.id,
        botName: b.name,
        role: b.role,
        alive: b.alive,
        thought,
        provider: 'fallback',
      };
    });

  const rosterSummary = params.players
    .map(
      (p) =>
        `- id:${p.id} ชื่อ:${p.name} (${p.isBot ? 'AI' : 'คนจริง'}) ห้อง:${p.room ?? '?'} บทบาท:${ROLE_DEFINITIONS[p.role].nameTh} [${ROLE_DEFINITIONS[p.role].faction}] สถานะ:${p.alive ? 'รอดชีวิต' : p.deathCause === 'MURDERED' ? 'ถูกฆ่า' : 'ถูกโหวตออก/ปิดตาย'}`
    )
    .join('\n');

  const botIdsSummary = bots
    .map((b) => `- id:${b.id} ชื่อ:${b.name} นิสัย:${b.persona ?? 'เพื่อนซี้ปากร้าย'}`)
    .join('\n');

  const chatHighlights = params.recentChat
    .filter((m) => !m.isSystem)
    .slice(-16)
    .map((m) => `${m.senderName}: ${m.text}`)
    .join('\n');

  const winnerText =
    params.winner === 'GOOD'
      ? 'ฝ่ายผู้บริสุทธิ์ชนะ!'
      : params.winner === 'EVIL'
        ? 'ฝ่ายฆาตกรชนะ!'
        : `ฝ่ายพิเศษ คนเมา (${params.winnerPlayerName ?? 'คนเมา'}) ชนะเดี่ยว!`;

  const prompt = `เกม "HOTEL MURDER ปริศนาโรงแรมมรณะ" (ระบบโหวต 3 รูปแบบ: เปิดห้อง / ปิดตายทั้งชั้น / ปิดตายทั้งแถวแนวตั้ง) จบลงแล้ว!
ผลแพ้ชนะ: ${winnerText} (${params.winReason})

เปิดเผยบทบาทและห้องพักทุกคน:
${rosterSummary}

สรุปเหตุการณ์ตลอดเกม:
${params.historyLog.slice(-28).join('\n')}

ไฮไลท์แชทในเกม:
${chatHighlights || '(ไม่มีแชท)'}

จงสร้างข้อความ "ความคิดในใจหลังรู้ความจริง" สำหรับบอท AI ทุกตัวด้านล่างนี้ (คนละ 1-2 ประโยคสั้นๆ แซ่บๆ แบบเพื่อนซี้วงเหล้าปากร้าย กู-มึง ด่าเพื่อนที่ปิดชั้นมั่ว/โดนคนเมาหลอก ชมหรือหมั่นไส้คนที่ปั่นเนียน หรือขิงใส่คนที่แพ้ ห้ามมีคำว่า ครับ/ค่ะ เด็ดขาด!):
${botIdsSummary}

ตอบกลับเป็น JSON Object รูปแบบนี้เท่านั้น:
{
  "reactions": [
    { "botId": "...", "thought": "..." }
  ]
}`;

  try {
    const { text, provider } = await generateWithMultiProvider(
      'groq',
      CORE_PERSONA_INSTRUCTION + '\nตอบกลับเป็น JSON เท่านั้น ครบทุก botId ที่กำหนด',
      prompt,
      true
    );

    const parsed = extractJsonObject(text);
    const rawList = Array.isArray(parsed?.reactions)
      ? (parsed.reactions as Array<{ botId?: string; thought?: string }>)
      : [];

    const fallbackList = makeFallbackThoughts();
    return bots.map((b, idx) => {
      const match = rawList.find((r) => r.botId === b.id);
      const rawThought =
        typeof match?.thought === 'string' ? sanitizeThaiColloquial(match.thought) : '';
      if (!rawThought) return fallbackList[idx];
      return {
        botId: b.id,
        botName: b.name,
        role: b.role,
        alive: b.alive,
        thought: rawThought,
        provider,
      };
    });
  } catch {
    return makeFallbackThoughts();
  }
}

export { getColumnOfRoom, getFloorOfRoom, getRoomsInColumn, getRoomsOnFloor };
