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
  getFloorsForCount,
  getRoomsForFloorCount,
  getRoomsInColumn,
  getRoomsOnFloor,
  HOTEL_COLUMNS,
  ROLE_DEFINITIONS,
} from '../src/shared/gameTypes.ts';

export type ProviderChoice = 'groq' | 'gemini' | 'fallback';

export interface BotPersonaTemplate {
  code: string;
  gender: 'M' | 'F';
  archetype: string;
  persona: string;
  speechStyle: string;
  avatarColor: string;
}

export interface BotProfile {
  id: string;
  name: string;
  gender: 'M' | 'F';
  archetype: string;
  persona: string;
  speechStyle: string;
  preferredProvider: 'groq' | 'gemini';
  avatarColor: string;
}

/**
 * 8 Distinct AI Personas (4 Male, 4 Female)
 */
export const BOT_PERSONAS: BotPersonaTemplate[] = [
  {
    code: 'M1',
    gender: 'M',
    archetype: 'ชาย 1 · สายบวกหัวร้อน',
    persona: 'ใจร้อน ชอบเปิดก่อน ใครพูดไม่เข้าหูโหวตทันที พูดจาโผงผาง กู-มึง ไอ้สัส',
    speechStyle: 'โผงผาง ใจร้อน ท้าชนทันที ใช้คำแรงแบบเพื่อนซี้ เช่น ไอ้สัส เฮ้ย เปิดเลยดิ',
    avatarColor: '#B84A39',
  },
  {
    code: 'M2',
    gender: 'M',
    archetype: 'ชาย 2 · สายเนิร์ดวิเคราะห์',
    persona: 'ชอบจดสถิติ คำนวณความน่าจะเป็น พูดจามีเหตุผลแต่แอบกวนตีน',
    speechStyle: 'ไล่เลขชั้น ไล่สถิติ ตัดช้อยส์เป็นเปอร์เซ็นต์ แต่แอบแซะเพื่อนแบบกวนตีนหน้านิ่ง',
    avatarColor: '#4A6FA5',
  },
  {
    code: 'M3',
    gender: 'M',
    archetype: 'ชาย 3 · สายปั่นกวนประสาท',
    persona: 'ชอบพูดจาคลุมเครือ บลัฟเก่ง หลอกล่อให้คนอื่นระแวงกันเอง',
    speechStyle: 'พูดกำกวม ยุให้คนอื่นตีกันเอง ชอบโยนเหยื่อล่อแล้วขำแห้งๆ',
    avatarColor: '#B8863B',
  },
  {
    code: 'M4',
    gender: 'M',
    archetype: 'ชาย 4 · สายนิ่งขรึมสังเกตการณ์',
    persona: 'พูดน้อยต่อยหนัก มักรอให้คนอื่นเถียงกันเสร็จแล้วค่อยสรุปจี้จุดตาย',
    speechStyle: 'สั้น นิ่ง เฉียบ คม จี้ตรงจุดที่คนอื่นพลาดแค่ประโยคเดียวจบ',
    avatarColor: '#5B6D7A',
  },
  {
    code: 'F1',
    gender: 'F',
    archetype: 'หญิง 1 · สายแซ่บปากแจ๋ว',
    persona: 'ปากไว ด่าเจ็บ จับพิรุธเก่ง ใครโกหกโดนจี้จนไปไม่เป็น',
    speechStyle: 'ปากไว ฟาดไม่ยั้ง จับโป๊ะคำพูดเพื่อนแรงๆ แบบตัวแม่วงเหล้า',
    avatarColor: '#A63A5B',
  },
  {
    code: 'F2',
    gender: 'F',
    archetype: 'หญิง 2 · สายแอ๊บใสขี้ระแวง',
    persona: 'ทำตัวเหมือนคนขี้กลัว ชอบถามคนอื่นไปทั่ว แต่แอบเก็บข้อมูลเก่ง',
    speechStyle: 'ทำเสียงตื่นกลัว ถามจี้ทีละคนว่าอยู่ชั้นไหน แต่แอบจำทุกคำตอบไว้เชือดทีหลัง',
    avatarColor: '#7A5C99',
  },
  {
    code: 'F3',
    gender: 'F',
    archetype: 'หญิง 3 · สายลุยเจ้าแผนการ',
    persona: 'ชอบเป็นผู้นำ สั่งการให้คนอื่นเปิดข้อมูลและคุมจังหวะการโหวต',
    speechStyle: 'สั่งการชัดเจน คุมเกม บอกให้ทุกคนเปิดเบาะแสแล้วนัดโหวตไปทางเดียวกัน',
    avatarColor: '#3D828A',
  },
  {
    code: 'F4',
    gender: 'F',
    archetype: 'หญิง 4 · สายติสท์เดาใจยาก',
    persona: 'พูดจาแปลกๆ เหมือนเมาตลอดเวลา ทำให้คนเดาไม่ออกว่าเป็นคนเมาหรือคนดี',
    speechStyle: 'พูดเพี้ยนๆ เหมือนคนเมา ล่องลอย ชวนสับสนจนคนอื่นไม่กล้าฟันธงว่าเป็นคนเมาหรือคนดี',
    avatarColor: '#8C6239',
  },
];

const MALE_THAI_NICKNAMES = [
  'เจมส์',
  'บอส',
  'โอ๊ต',
  'นนท์',
  'บีม',
  'เต้',
  'ภูมิ',
  'กอล์ฟ',
  'แบงค์',
  'วิน',
  'พีท',
  'นิว',
  'แชมป์',
  'มาร์ค',
  'เคน',
  'ต้น',
  'ไนท์',
  'เบียร์',
  'ท็อป',
  'เอิร์ธ',
  'พอร์ช',
  'กันต์',
  'ซัน',
  'แทน',
];

const FEMALE_THAI_NICKNAMES = [
  'แพรว',
  'มายด์',
  'น้ำหวาน',
  'ฝ้าย',
  'เฟิร์น',
  'แนท',
  'พลอย',
  'มิ้นท์',
  'เมย์',
  'เบสท์',
  'กิ๊ฟ',
  'อาย',
  'ข้าวฟ่าง',
  'น้ำผึ้ง',
  'เกรซ',
  'พิม',
  'ใบเฟิร์น',
  'จูน',
  'นุ่น',
  'บิว',
  'แจน',
  'ฟ้า',
  'ปุ๊ก',
  'ไอซ์',
];

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Picks distinct personas (balanced M/F) and fresh random Thai nicknames that:
 * 1) Never duplicate any human player name in the room
 * 2) Never repeat any bot name used in the previous round
 */
export function createRoundBotProfiles(
  count: number,
  excludeHumanNames: Set<string>,
  previousRoundBotNames: Set<string>,
  idGenerator: () => string
): BotProfile[] {
  const malePersonas = shuffleArray(BOT_PERSONAS.filter((p) => p.gender === 'M'));
  const femalePersonas = shuffleArray(BOT_PERSONAS.filter((p) => p.gender === 'F'));

  // Interleave M and F randomly so every room has a balanced male/female mix
  const startWithMale = Math.random() < 0.5;
  const interleaved: BotPersonaTemplate[] = [];
  for (let i = 0; i < 4; i++) {
    if (startWithMale) {
      if (malePersonas[i]) interleaved.push(malePersonas[i]);
      if (femalePersonas[i]) interleaved.push(femalePersonas[i]);
    } else {
      if (femalePersonas[i]) interleaved.push(femalePersonas[i]);
      if (malePersonas[i]) interleaved.push(malePersonas[i]);
    }
  }

  const chosenPersonas = interleaved.slice(0, count);
  const usedNamesLower = new Set<string>(Array.from(excludeHumanNames).map((n) => n.toLowerCase()));
  const prevLower = new Set<string>(Array.from(previousRoundBotNames).map((n) => n.toLowerCase()));

  const pickFreshName = (gender: 'M' | 'F', index: number): string => {
    const basePool = gender === 'M' ? MALE_THAI_NICKNAMES : FEMALE_THAI_NICKNAMES;
    const preferred = shuffleArray(basePool).filter(
      (n) => !usedNamesLower.has(n.toLowerCase()) && !prevLower.has(n.toLowerCase())
    );
    const fallback = shuffleArray(basePool).filter((n) => !usedNamesLower.has(n.toLowerCase()));
    const picked = preferred[0] ?? fallback[0] ?? (gender === 'M' ? `บอล${index + 1}` : `มุก${index + 1}`);
    usedNamesLower.add(picked.toLowerCase());
    return picked;
  };

  return chosenPersonas.map((template, idx) => ({
    id: idGenerator(),
    name: pickFreshName(template.gender, idx),
    gender: template.gender,
    archetype: template.archetype,
    persona: template.persona,
    speechStyle: template.speechStyle,
    preferredProvider: idx % 2 === 0 ? 'groq' : 'gemini',
    avatarColor: template.avatarColor,
  }));
}

const CORE_PERSONA_INSTRUCTION = `คุณกำลังเล่นบอร์ดเกมสืบสวนฆาตกรรม "HOTEL MURDER ปริศนาโรงแรมมรณะ" (โรงแรมมีจำนวนชั้น = จำนวนผู้เล่น - 1 ชั้น × 3 แถวแนวตั้ง, ห้ามย้ายห้องตลอดเกม) กับกลุ่มเพื่อนซี้ในวงเหล้า

กฎเหล็กที่ต้องรู้เสมอ:
1. เมื่อมีคนตาย (ไม่ว่าโดนฆ่ากลางคืนหรือโดนโหวตกลางวัน) จะ **ไม่เปิดเผยบทบาทของผู้ตาย** จนกว่าจะจบเกม! (รู้แค่ชื่อกับเลขห้องที่พบศพ) ห้ามเดาเหมือนรู้บทบาทคนตาย!
2. ระบบปลดล็อกโหวตช่วงกลางวันแบบขั้นบันได (คะแนนสูงสุดชนะ):
   - วันที่ 1 (Day 1): โหวตได้เฉพาะ "เปิด 1 ห้อง (รายห้อง)" เท่านั้น! (ห้ามเสนอปิดชั้นหรือปิดแถวในวันที่ 1 เพราะยังไม่ปลดล็อก!)
   - วันที่ 2 (Day 2): ปลดล็อก "เปิด 1 ห้อง" และ "ปิดตาย 1 ชั้นแนวนอน (Horizontal Floor)" (ยังปิดแถวแนวตั้งไม่ได้ ต้องรอวันที่ 3!)
   - วันที่ 3 และ วันที่ 4 (Day 3 - Day 4): ปลดล็อกเต็มรูปแบบ โหวตได้ครบทั้ง 3 แบบ คือ "รายห้อง", "ปิดตาย 1 ชั้นแนวนอน", และ "ปิดตาย 1 แถวแนวตั้ง (Vertical Column)"!
   * ถ้าปิดพื้นที่แล้วโดน "ฆาตกร" -> ฝ่ายผู้บริสุทธิ์ชนะทันที!
   * ถ้าปิดพื้นที่แล้วโดน "คนเมา" (โดยไม่มีฆาตกร) -> คนเมาชนะเดี่ยวทันที!

กฎการพูดและการสวมบทบาท (บังคับเด็ดขาด):
1. คิดวิเคราะห์เองอย่างอิสระจากประวัติแชทล่าสุด + เบาะแสสกิลส่วนตัว + นิสัยประจำตัวของมึง ห้ามใช้ประโยคซ้ำซากหรือพูดเหมือนหุ่นยนต์
2. ใช้ภาษาไทยแบบภาษาปากเพื่อนสนิท กู-มึง แซว/จี้/โต้เถียงกันตรงไปตรงมาตามบุคลิกของตัวละครมึง
3. ห้ามพูดจาสุภาพเด็ดขาด! ห้ามลงท้ายว่า "ครับ", "ค่ะ", "นะครับ", "นะคะ", "ครับผม", "คุณ", "ผม", "ดิฉัน"
4. พิมพ์สั้น กระชับ 1-2 ประโยค ไม่เกิน 170 ตัวอักษร เหมือนพิมพ์แชทสดๆ ห้ามขึ้นต้นด้วยชื่อตัวเอง ห้ามใส่เครื่องหมายคำพูดครอบประโยค
5. กลยุทธ์ตามบทบาท:
   - ฝ่ายผู้บริสุทธิ์: เอาเบาะแสจริงจากสกิล (แม่บ้าน/ช่างเช็ดกระจก/นักสืบ/พยาน) มาเทียบกับคำพูดเพื่อนในแชทเพื่อหาห้องฆาตกร
   - ฝ่ายฆาตกร (ฆาตกร/ผู้ช่วยฆาตกร): ปั่นเบี่ยงประเด็นถ้าคนกำลังเล็งห้อง/ชั้น/แถวของทีมตัวเอง แต่อย่าทำตัวล่กเกินไป
   - คนเมา (Drunk): ปั่นแชทหรือหลุดเบาะแสห้อง/ชั้น/แถวตัวเองแบบเนียนๆ เพื่อล่อให้คนอื่นโหวตโดนห้อง/ชั้น/แถวของมึง!`;

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
  totalFloors: number;
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

function buildEmergencyOfflineChat(input: BotChatInput): string {
  const activeRooms = getRoomsForFloorCount(input.totalFloors);
  const activeFloors = getFloorsForCount(input.totalFloors);
  const revealedSet = new Set(input.revealedRooms.map((r) => r.room));
  const unrevealed = activeRooms.filter((r) => !revealedSet.has(r) && r !== input.myRoom);
  const sampleRoom = unrevealed[Math.floor(Math.random() * Math.max(1, unrevealed.length))] ?? activeRooms[0];
  const openFloors = activeFloors.filter((f) => !input.lockedFloors.includes(f));
  const openCols = HOTEL_COLUMNS.filter((c) => !input.lockedColumns.includes(c));
  const latestClue = input.privateClues[input.privateClues.length - 1];

  const canFloorLock = input.day >= 2;
  const canColLock = input.day >= 3;
  const otherFloor = openFloors.find((f) => f !== input.myFloor) ?? openFloors[0] ?? 2;
  const otherCol = openCols.find((c) => c !== input.myColumn) ?? openCols[0] ?? 2;

  if (input.role === 'DRUNK') {
    if (canColLock) {
      return `อย่ามายุ่งกับห้อง ${input.myRoom} หรือปิดแถว ${input.myColumn} นะโว้ย กูอยู่เงียบๆ ของกูดีๆ`;
    }
    if (canFloorLock) {
      return `เฮ้ยอย่ามาปิดชั้น ${input.myFloor} นะเว้ย กูไม่ได้ทำอะไรผิดเลย อย่าโหวตโดนชั้นนี้เด็ดขาด`;
    }
    return `ใครกล้าเปิดห้อง ${input.myRoom} มึงมีเรื่องกับกูแน่ กูแค่แขกธรรมดาโว้ย`;
  }

  if (ROLE_DEFINITIONS[input.role].faction === 'GOOD' && latestClue) {
    if (canColLock && latestClue.category === 'GLAZIER') {
      return `${latestClue.detail} — วันนี้ปลดปิดแถวแล้ว ตัดใจโหวตปิดแถวเลยมั้ยพวกมึง`;
    }
    if (canFloorLock && latestClue.category === 'HOUSEKEEPER') {
      return `${latestClue.detail} — วันนี้ปิดชั้นแนวนอนได้แล้วนะเว้ย ลองดูมั้ยว่าจะกวาดชั้นไหน`;
    }
    return `เบาะแสคืนล่าสุดของกู: ${latestClue.detail} ลองเทียบกับแชทเมื่อกี้ดูดิ`;
  }

  if (ROLE_DEFINITIONS[input.role].faction === 'EVIL') {
    const recentText = input.recentChat.slice(-5).map((m) => m.text).join(' ');
    const floorThreatened =
      recentText.includes(`ชั้น ${input.myFloor}`) || recentText.includes(`ชั้น${input.myFloor}`);
    const colThreatened =
      recentText.includes(`แถว ${input.myColumn}`) || recentText.includes(`แถว${input.myColumn}`);
    if (canFloorLock && floorThreatened) {
      return `อย่าไปปิดชั้น ${input.myFloor} มั่วดิ เดี๋ยวคนดีตายฟรีหมด ไปดูชั้น ${otherFloor} ดีกว่าเยอะ`;
    }
    if (canColLock && colThreatened) {
      return `ปิดแถว ${input.myColumn} โคตรเสี่ยงเลยนะเว้ย ไปปิดแถว ${otherCol} หรือเปิดห้อง ${sampleRoom} แทนดิ`;
    }
    if (canColLock) return `เหลือเวลาน้อยแล้ว ลองปิดแถว ${otherCol} หรือปิดชั้น ${otherFloor} วัดใจไปเลยมั้ย`;
    if (canFloorLock) return `วันนี้ปิดชั้นได้แล้ว ลองเช็กชั้น ${otherFloor} หรือเปิดห้อง ${sampleRoom} ดูดิ`;
    return `วันแรกยังปิดชั้นไม่ได้ ลองโหวตเปิดห้อง ${sampleRoom} ตัดช้อยส์ดูก่อนมั้ยพวกมึง`;
  }

  if (input.lastHumanMessage) {
    const target = input.lastHumanMessage.senderName;
    return canFloorLock
      ? `เดี๋ยวนะ ${target} พูดงี้ชักแปลกๆ ว่ะ มึงอยู่ชั้นไหนแน่ ลองเปิดห้อง ${sampleRoom} หรือปิดชั้น ${otherFloor} ดูมั้ย`
      : `เดี๋ยวนะ ${target} พูดงี้โคตรมีพิรุธ วันแรกเปิดห้อง ${sampleRoom} ตัดช้อยส์ก่อนเลยมั้ย`;
  }

  if (canColLock) {
    return `วันที่ ${input.day} ปลดครบทั้งเปิดห้อง ปิดชั้น ปิดแถวแล้ว ใครมีเบาะแสแม่บ้าน/ช่างเช็ดกระจกรีบคายออกมาเลย`;
  }
  if (canFloorLock) {
    return `วันที่ 2 ปิดชั้นแนวนอนได้แล้วนะเว้ย (ปิดแถวรอวันที่ 3) ใครได้เบาะแสชั้นไหนรีบแชร์ด่วน`;
  }
  return `วันแรกโหวตได้เฉพาะเปิดรายห้อง ลองตัดช้อยส์จากห้องศพตั้งต้นแล้วจิ้มห้อง ${sampleRoom} ดูมั้ย`;
}

export async function generateBotChat(
  input: BotChatInput
): Promise<{ text: string; provider: ProviderChoice }> {
  const roleDef = ROLE_DEFINITIONS[input.role];
  const aliveNames = input.players
    .filter((p) => p.alive)
    .map((p) => p.name)
    .join(', ');

  // STRICT NO ROLE REVEAL ON DEATH: Bots only know dead players' name & room, NEVER their role!
  const revealedSummary = input.revealedRooms
    .map((r) =>
      r.kind === 'INITIAL_CRIME'
        ? `${r.room}(ศพตั้งต้น-ว่าง)`
        : r.kind === 'EMPTY_LYNCHED'
          ? `${r.room}(ห้องว่าง)`
          : r.kind === 'LOCKED_EMPTY'
            ? `${r.room}(ปิดตาย-ว่าง)`
            : `${r.room}(พบศพ ${r.occupantName ?? 'ผู้เล่น'}: เสียชีวิต-ไม่เปิดเผยบทบาท)`
    )
    .join(', ');

  const chatHistory = input.recentChat
    .slice(-14)
    .map((m) => (m.isSystem ? `[ระบบ] ${m.text}` : `${m.senderName}: ${m.text}`))
    .join('\n');

  const clueStrings = input.privateClues
    .slice(-6)
    .map((c) => `[คืน ${c.night} - ${c.title}] ${c.detail}`);

  const voteUnlockNote =
    input.day <= 1
      ? 'วันที่ 1: โหวตได้เฉพาะ "เปิด 1 ห้อง (รายห้อง)" เท่านั้น! (ปิดชั้นปลดวันที่ 2, ปิดแถวปลดวันที่ 3)'
      : input.day === 2
        ? 'วันที่ 2: ปลดล็อก "เปิด 1 ห้อง" และ "ปิดตาย 1 ชั้นแนวนอน" แล้ว! (ปิดแถวแนวตั้งยังไม่ปลด ต้องรอวันที่ 3)'
        : `วันที่ ${input.day}: ปลดล็อกเต็มรูปแบบครบทั้ง 3 แบบแล้ว! ("เปิด 1 ห้อง" / "ปิดตาย 1 ชั้นแนวนอน" / "ปิดตาย 1 แถวแนวตั้ง")`;

  const roleMission =
    input.role === 'DRUNK'
      ? `เป้าหมายลับของมึง (คนเมา): มึงต้องปั่นหรือแกล้งหลุดข้อมูลชั้น ${input.myFloor} แถว ${input.myColumn} (ห้อง ${input.myRoom}) แบบเนียนๆ ให้เพื่อนโหวตโดนมึง (ถ้าไม่มีฆาตกรโดนไปด้วย มึงชนะเดี่ยวทันที!)`
      : roleDef.faction === 'EVIL'
        ? `เป้าหมายลับของมึง (ฝ่ายฆาตกร): ห้องมึงอยู่ชั้น ${input.myFloor} แถว ${input.myColumn} เพื่อนร่วมฝ่ายคือ: ${input.evilPartners.join(', ') || 'ไม่มี'} — ถ้าเพื่อนเล็งห้อง/ชั้น/แถวของทีมมึง ให้เบี่ยงประเด็นแบบเนียนตามบุคลิกตัวเอง!`
        : `เป้าหมายลับของมึง (ฝ่ายผู้บริสุทธิ์): เอาเบาะแสสกิลส่วนตัวมาวิเคราะห์ร่วมกับแชทเพื่อนเพื่อจับฆาตกร (ระวังอย่าพาเพื่อนโหวตปิดชั้น ${input.myFloor} หรือแถว ${input.myColumn} ที่มึงอยู่เอง!)`;

  const userPrompt = [
    `ชื่อมึง: "${input.bot.name}" (${input.bot.archetype})`,
    `บุคลิกเฉพาะตัวของมึง: ${input.bot.persona}`,
    `สไตล์การพูดของมึง: ${input.bot.speechStyle}`,
    `โรงแรมรอบนี้มีทั้งหมด ${input.totalFloors} ชั้น (ชั้น 1 ถึง ชั้น ${input.totalFloors}, ชั้นละ 3 ห้อง คือ x01, x02, x03)`,
    `บทบาทลับของมึง: "${roleDef.nameTh}" (${roleDef.nameEn}) | ห้องประจำตัวถาวร: ห้อง ${input.myRoom} (ชั้น ${input.myFloor}, แถวแนวตั้ง ${input.myColumn})`,
    roleMission,
    `สถานะวันและกติกาโหวตวันนี้ (วันที่ ${input.day}/${input.maxDays}): ${voteUnlockNote}`,
    `ชั้นที่ปิดตายไปแล้ว: ${input.lockedFloors.length > 0 ? input.lockedFloors.join(', ') : 'ยังไม่มี'} | แถวที่ปิดตายไปแล้ว: ${input.lockedColumns.length > 0 ? input.lockedColumns.join(', ') : 'ยังไม่มี'}`,
    input.morningHeadline ? `ข่าวเมื่อเช้า: ${input.morningHeadline}` : '',
    `ห้องที่เปิด/ปิดตายแล้ว: ${revealedSummary || 'ไม่มี'}`,
    `ผู้รอดชีวิต: ${aliveNames}`,
    clueStrings.length > 0 ? `สมุดบันทึกเบาะแสสกิลของมึง:\n${clueStrings.join('\n')}` : 'เบาะแสสกิล: ยังไม่มี',
    chatHistory ? `ประวัติแชทล่าสุด:\n${chatHistory}` : 'ประวัติแชทล่าสุด: (ยังไม่มีใครพูด)',
    input.triggerReason === 'HUMAN_REPLY' && input.lastHumanMessage
      ? `เพื่อนชื่อ "${input.lastHumanMessage.senderName}" เพิ่งพิมพ์ว่า: "${input.lastHumanMessage.text}" — จงคิดวิเคราะห์เองและโต้ตอบกลับให้ตรงกับสถานการณ์และบุคลิก "${input.bot.archetype}" ของมึง!`
      : input.triggerReason === 'PRE_READY'
        ? `มึงกำลังจะกดพร้อมโหวต จงสรุปความเห็นหรือทิ้งท้ายตามบุคลิก "${input.bot.archetype}" ของมึง 1 ประโยค`
        : `จงเปิดประเด็นวิเคราะห์/ซักถาม/ปั่นแชทอย่างอิสระจากข้อมูลตรงหน้าตามบุคลิก "${input.bot.archetype}" ของมึง`,
    `ตอบกลับมาแค่ข้อความแชท 1-2 ประโยคสั้นๆ เท่านั้น (ห้ามซ้ำประโยคเดิมในแชท):`,
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
    if (!cleaned) return { text: buildEmergencyOfflineChat(input), provider: 'fallback' };
    return { text: cleaned, provider };
  } catch {
    return { text: buildEmergencyOfflineChat(input), provider: 'fallback' };
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
  totalFloors: number;
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
  const activeFloors = getFloorsForCount(params.totalFloors);

  const fallbackDecision = ():
    | HotelRoomNumber
    | HotelFloorNumber
    | HotelColumnNumber
    | string
    | null => {
    if (params.role === 'MURDERER') {
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
      const floorsWithOpenRooms = activeFloors.filter((f) =>
        getRoomsOnFloor(f).some((r) => params.unrevealedRooms.includes(r))
      );
      const pool = floorsWithOpenRooms.length > 0 ? floorsWithOpenRooms : activeFloors;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    if (params.role === 'GLAZIER') {
      const activeCols = HOTEL_COLUMNS.filter((c) =>
        getRoomsInColumn(c, params.totalFloors).some((r) => params.unrevealedRooms.includes(r))
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
โรงแรมรอบนี้มี ${params.totalFloors} ชั้น คุณมีอิสระเลือกฆ่าได้ทุกห้องที่ยังเปิดอยู่: [${params.unrevealedRooms.filter((r) => r !== params.myRoom).join(', ')}]
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
เลือกตรวจสอบ 1 ชั้นแนวนอน (1 ถึง ${params.totalFloors}) เพื่อรู้จำนวนคนรอดในชั้นนั้น ตอบเป็น JSON เท่านั้น: {"floor": 2}`;
    } else if (params.role === 'WITNESS') {
      prompt = `คุณคือพยาน (${params.bot.name}) คืนที่ ${params.day} เบาะแสเก่า: ${cluesText || 'ไม่มี'}
แชทล่าสุด: ${chatSnippet || '(ไม่มี)'}
เลือกเฝ้าดู 1 ชั้น (1 ถึง ${params.totalFloors}) ที่คาดว่าฆาตกรจะมาฆ่าคนคืนนี้ ตอบเป็น JSON เท่านั้น: {"floor": 2}`;
    } else if (params.role === 'GLAZIER') {
      prompt = `คุณคือช่างเช็ดกระจก (${params.bot.name}) คืนที่ ${params.day} เบาะแสเก่า: ${cluesText || 'ไม่มี'}
เลือกตรวจสอบ 1 แถวแนวตั้ง (1 = ห้องลงท้าย 01, 2 = ลงท้าย 02, 3 = ลงท้าย 03) ตลอด ${params.totalFloors} ชั้น เพื่อรู้จำนวนคนรอดทั้งแถว ตอบเป็น JSON เท่านั้น: {"column": 2}`;
    } else if (params.role === 'DETECTIVE' || params.role === 'ACCOMPLICE') {
      prompt = `คุณคือ ${ROLE_DEFINITIONS[params.role].nameTh} (${params.bot.name}) คืนที่ ${params.day}
คนที่เคยตรวจแล้ว: [${params.alreadyCheckedIds.join(', ')}]
ผู้รอดชีวิต (ห้ามเลือกตัวเอง id:${params.bot.id}):
${aliveSummary}
เลือก id ของผู้เล่น 1 คนเพื่อตรวจว่าพักอยู่ชั้นไหน (1 ถึง ${params.totalFloors}) ตอบเป็น JSON เท่านั้น: {"targetId": "..."}`;
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
      return activeFloors.includes(floorNum) ? floorNum : fallbackDecision();
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

    const canFloorLock = params.day >= 2 && safeFloors.length > 0;
    const canColLock = params.day >= 3 && safeCols.length > 0;

    let optionsBlock = `- เปิด 1 ห้อง ("kind":"ROOM"): [${(safeRooms.length > 0 ? safeRooms : params.unrevealedRooms).join(', ')}]`;
    if (canFloorLock) {
      optionsBlock += `\n- ปิดตาย 1 ชั้นแนวนอน ("kind":"FLOOR"): [${safeFloors.join(', ')}]`;
    }
    if (canColLock) {
      optionsBlock += `\n- ปิดตาย 1 แถวแนวตั้ง ("kind":"COLUMN"): [${safeCols.join(', ')}]`;
    }

    const dayRuleLine =
      params.day <= 1
        ? `วันที่ 1/${params.maxDays} (วันแรกโหวตได้เฉพาะ "เปิด 1 ห้อง" เท่านั้น! ปิดชั้นปลดวันที่ 2, ปิดแถวปลดวันที่ 3)`
        : params.day === 2
          ? `วันที่ 2/${params.maxDays} (ปลดล็อก "เปิด 1 ห้อง" และ "ปิดตาย 1 ชั้นแนวนอน" — ปิดแถวแนวตั้งยังไม่ปลด ต้องรอวันที่ 3!)`
          : `วันที่ ${params.day}/${params.maxDays} (ปลดล็อกครบทั้ง 3 แบบ: เปิด 1 ห้อง / ปิดตายทั้งชั้นแนวนอน / ปิดตายทั้งแถวแนวตั้ง!)`;

    const prompt = `ชื่อมึง: ${params.bot.name} (${params.bot.archetype}) | นิสัย: ${params.bot.persona}
${dayRuleLine}
${strategy}
เบาะแสส่วนตัวของมึง: ${cluesText || 'ไม่มี'}
ตัวเลือกที่โหวตได้ตอนนี้:
${optionsBlock}

แชทล่าสุด:
${chatSnippet || '(ไม่มี)'}

เลือกโหวต 1 รูปแบบจากตัวเลือกที่ปลดล็อกแล้วข้างต้น และพิมพ์คอมเมนต์สั้นๆ ตามนิสัยของมึง (สไตล์เพื่อนซี้กู-มึง ห้ามพูดครับ/ค่ะ) ตอบเป็น JSON เท่านั้น:
ตัวอย่าง: {"kind": "${canFloorLock ? 'FLOOR' : 'ROOM'}", "target": ${canFloorLock ? safeFloors[0] : fallbackRoom}, "comment": "..."}`;

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

    if (kind === 'FLOOR' && params.day >= 2) {
      const f = targetNum as HotelFloorNumber;
      if (safeFloors.includes(f)) {
        return { choice: { kind: 'FLOOR', floor: f }, comment };
      }
    } else if (kind === 'COLUMN' && params.day >= 3) {
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
