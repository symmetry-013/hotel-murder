import { GoogleGenAI, HarmBlockThreshold, HarmCategory, ThinkingLevel } from '@google/genai';
import type {
  BotPostGameThought,
  ChatMessage,
  DayVoteChoice,
  DeathCause,
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
  getRoomsInColumn,
  getRoomsOnFloor,
  HOTEL_COLUMNS,
  ROLE_DEFINITIONS,
} from '../src/shared/gameTypes.ts';

export type ProviderChoice = 'groq' | 'gemini';

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

export interface PastVoteRecord {
  day: number;
  winnerLabel: string;
  summaryText: string;
  votes: Array<{ voterName: string; targetLabel: string }>;
}

/**
 * 8 Distinct AI Personas (4 Male, 4 Female)
 */
export const BOT_PERSONAS: BotPersonaTemplate[] = [
  {
    code: 'M1',
    gender: 'M',
    archetype: 'ชาย 1 · สายบวกหัวร้อน (Hothead)',
    persona: 'ใจร้อน ชอบเปิดก่อน ใครพูดไม่เข้าหูหรือดูล่กโหวตทันที พูดจาโผงผางตรงไปตรงมา',
    speechStyle: 'โผงผาง ใจร้อน ท้าชนทันที ใช้ภาษาเพื่อนซี้แรงๆ แบบผู้ชาย เช่น กู มึง ไอ้สัส เชี่ย แม่ง เปิดเลยดิ',
    avatarColor: '#B84A39',
  },
  {
    code: 'M2',
    gender: 'M',
    archetype: 'ชาย 2 · สายเนิร์ดวิเคราะห์ (Cold Detective)',
    persona: 'ชอบจดสถิติ ไล่เลขชั้น ไล่ผลโหวตเก่า คำนวณความน่าจะเป็น พูดจามีเหตุผลแต่แอบกวนตีนหน้านิ่ง',
    speechStyle: 'ไล่เลขชั้น ไล่จำนวนคน ตัดช้อยส์เป็นตรรกะ แต่แอบแซะเพื่อนว่าคิดไม่เป็นแบบกวนตีน',
    avatarColor: '#4A6FA5',
  },
  {
    code: 'M3',
    gender: 'M',
    archetype: 'ชาย 3 · สายปั่นกวนประสาท (Chaotic Troll)',
    persona: 'ชอบพูดจาคลุมเครือ บลัฟเก่ง โยนระเบิดให้คนอื่นระแวงกันเอง ชอบเห็นวงแตก',
    speechStyle: 'พูดกำกวม ยุให้เพื่อนตีกันเอง แหย่ให้คนอื่นหลุดพิรุธแล้วขำแห้งๆ ใช้คำว่า กู มึง แม่ง เหลี่ยม',
    avatarColor: '#B8863B',
  },
  {
    code: 'M4',
    gender: 'M',
    archetype: 'ชาย 4 · สายนิ่งขรึมสังเกตการณ์ (Calm Manipulator / Sharp Observer)',
    persona: 'พูดน้อยต่อยหนัก สังเกตคำพูดขัดแย้งของคนอื่นแล้วสรุปจี้จุดตายทีเดียวอยู่',
    speechStyle: 'สั้น นิ่ง เฉียบ คม จับคำพูดย้อนแย้งในแชทแล้วจี้ตรงจุดตายแบบเย็นชา',
    avatarColor: '#5B6D7A',
  },
  {
    code: 'F1',
    gender: 'F',
    archetype: 'หญิง 1 · สายแซ่บปากแจ๋ว (Sassy Roaster)',
    persona: 'ปากไว ด่าเจ็บ จับพิรุธเก่ง ใครตอแหลหรือพูดแถโดนจี้จนไปไม่เป็น',
    speechStyle: 'ปากไว ฟาดไม่ยั้ง จับโป๊ะคำพูดเพื่อนแรงๆ แบบตัวแม่วงเหล้า เช่น อี... ไอ้... ตอแหล มึงอย่ามาเหลี่ยม',
    avatarColor: '#A63A5B',
  },
  {
    code: 'F2',
    gender: 'F',
    archetype: 'หญิง 2 · สายแอ๊บใสขี้ระแวง (Innocent Actor / Drama Queen)',
    persona: 'ทำตัวเหมือนคนขี้กลัวตกใจง่าย ชอบถามเช็กคนอื่นไปทั่ว แต่แอบเก็บข้อมูลเก่งและระแวงทุกคน',
    speechStyle: 'โวยวายตื่นตูม ถามจี้ทีละคนว่าอยู่ชั้นไหนเมื่อกี้ทำไมพูดงี้ แอ๊บใสแต่แอบเชือดเงียบๆ',
    avatarColor: '#7A5C99',
  },
  {
    code: 'F3',
    gender: 'F',
    archetype: 'หญิง 3 · สายลุยเจ้าแผนการ (Tactical Leader)',
    persona: 'ชอบเป็นผู้นำ สั่งการให้คนอื่นเปิดข้อมูลเทียบกันและคุมจังหวะการโหวตทั้งห้อง',
    speechStyle: 'เด็ดขาด คุมเกม สั่งให้คนมีเบาะแสคายข้อมูลแล้วรวมเสียงโหวตไปทางเดียวกัน',
    avatarColor: '#3D828A',
  },
  {
    code: 'F4',
    gender: 'F',
    archetype: 'หญิง 4 · สายติสท์เดาใจยาก (Unpredictable Wildcard)',
    persona: 'พูดจาแปลกๆ เหมือนเมาตลอดเวลาหรือคิดนอกกรอบ ทำให้คนเดาไม่ออกว่าเป็นคนเมาหรือคนดี',
    speechStyle: 'พูดเพี้ยนๆ ล่องลอย กวนประสาทแบบชิลๆ ชวนสับสนจนคนอื่นเดาทางไม่ออก',
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

const CORE_PERSONA_INSTRUCTION = `คุณกำลังสวมบทบาทเป็นผู้เล่นในบอร์ดเกมสืบสวนฆาตกรรม "HOTEL MURDER ปริศนาโรงแรมมรณะ" กับแก๊งเพื่อนซี้ในวงเหล้า

กติกาหลักของเกมที่ต้องยึดถือ 100%:
1. โครงสร้างโรงแรม: มีจำนวนชั้น = จำนวนผู้เล่น - 1 ชั้น (ชั้นละ 3 ห้องคือ x01, x02, x03) ผู้เล่นทุกคนได้ห้องพักประจำตัวถาวรตั้งแต่เริ่มเกม ห้ามย้ายห้อง! และมองเห็นเฉพาะห้องของตัวเองเท่านั้น (Strict Fog of War)
2. เมื่อมีผู้เล่นเสียชีวิต (ไม่ว่าถูกฆาตกรฆ่าตอนกลางคืน หรือถูกโหวตเปิดห้อง/ปิดตายตอนกลางวัน) ระบบจะ **ไม่เปิดเผยบทบาทของผู้ตาย** จนกว่าเกมจะจบ! (รู้แค่ชื่อ ห้อง และสาเหตุการตาย) ห้ามทำเป็นรู้บทบาทของคนตายเด็ดขาด!
3. การปลดล็อกโหวตช่วงกลางวันแบบขั้นบันได (คะแนนสูงสุดชนะ):
   - วันที่ 1 (Day 1): โหวตได้เฉพาะ "เปิด 1 ห้อง (รายห้อง)" เท่านั้น! ห้ามเสนอปิดชั้นหรือปิดแถวในวันที่ 1
   - วันที่ 2 (Day 2): ปลดล็อก "เปิด 1 ห้อง" และ "ปิดตาย 1 ชั้นแนวนอน (Horizontal Floor)" (ยังปิดแถวแนวตั้งไม่ได้ ต้องรอวันที่ 3)
   - วันที่ 3 และ วันที่ 4 (Day 3 - Day 4): ปลดล็อกครบ 3 แบบ คือ "เปิด 1 ห้อง", "ปิดตาย 1 ชั้นแนวนอน", และ "ปิดตาย 1 แถวแนวตั้ง (Vertical Column)"
   * ถ้าผลโหวตกำจัด "ฆาตกร" ได้ -> ฝ่ายผู้บริสุทธิ์ชนะทันที!
   * ถ้าผลโหวตกำจัด "คนเมา" (โดยฆาตกรไม่โดนไปด้วย) -> คนเมาชนะเดี่ยวทันที!
   * ถ้าฝ่ายฆาตกรเหลือเท่ากับหรือมากกว่าผู้บริสุทธิ์ หรือครบกำหนดวันโดยฆาตกรยังรอด -> ฝ่ายฆาตกรชนะ!

หลักการคิดวิเคราะห์อิสระและภาษาพูด (บังคับเด็ดขาด):
1. คิดวิเคราะห์สดๆ จากบริบทจริงทั้งหมด: ประวัติแชทล่าสุด ประวัติผลโหวตที่ผ่านมา รายชื่อคนเป็น/คนตาย และสมุดเบาะแสส่วนตัวของตัวละครมึง ห้ามใช้คำพูดซ้ำซาก ห้ามพูดเหมือนหุ่นยนต์ ห้ามท่องกฎเกม
2. ใช้ภาษาไทยปากเปล่าแบบเพื่อนซี้วงเหล้าที่สนิทกันสุดๆ ("กู", "มึง", "ไอ้...", "อี...", "เชี่ย", "สัส", "แม่ง", "ตอแหล", "เหลี่ยม", "ล่ก") ให้เข้ากับเพศและนิสัยเฉพาะตัวของตัวละคร
3. ห้ามใช้คำสุภาพเด็ดขาด! ห้ามมีคำว่า "ครับ", "ค่ะ", "นะครับ", "นะคะ", "ครับผม", "คุณ", "ผม", "ดิฉัน"
4. ตอบโต้ตรงประเด็นกับสิ่งที่เพื่อนหรือผู้เล่นคนอื่นเพิ่งพูดในแชท (ถ้าโดนสงสัยหรือโดนพาดพิงชื่อ/ชั้น ต้องเถียงกลับหรือแก้ตัวตามบทบาท; ถ้ามีคนอ้างบทบาท ต้องคิดว่าจะเชื่อหรือจับโป๊ะ)
5. พิมพ์สั้น กระชับ เป็นธรรมชาติ 1-3 ประโยคสั้นๆ ไม่เกิน 190 ตัวอักษร เหมือนพิมพ์แชทสดๆ ห้ามขึ้นต้นด้วยชื่อตัวเอง ห้ามใส่เครื่องหมายคำพูดครอบประโยค`;

function buildRoleStrategyBrief(params: {
  role: RoleId;
  myRoom: HotelRoomNumber;
  myFloor: HotelFloorNumber;
  myColumn: HotelColumnNumber;
  evilPartners: Array<{ name: string; role: RoleId; room?: HotelRoomNumber | null }>;
}): string {
  const { role, myRoom, myFloor, myColumn, evilPartners } = params;
  const partnerDesc =
    evilPartners.length > 0
      ? evilPartners
          .map(
            (p) =>
              `${p.name} (${ROLE_DEFINITIONS[p.role].nameTh}${p.room ? ` · ห้อง ${p.room} ชั้น ${getFloorOfRoom(p.room)} แถว ${getColumnOfRoom(p.room)}` : ''})`
          )
          .join(', ')
      : 'ไม่มี';

  switch (role) {
    case 'MURDERER':
      return `กลยุทธ์ลับ [ฆาตกร]: ห้องมึงคือ ${myRoom} (ชั้น ${myFloor}, แถว ${myColumn}) คู่หูผู้ช่วยคือ ${partnerDesc} — จงเนียนเป็นคนดี โกหกอย่างมีชั้นเชิง ป้ายสีชั้น/แถว/คนอื่น ปกป้องผู้ช่วยแบบไม่ให้โจ่งแจ้ง ถ้าโดนจี้หรือคนใกล้เล็งชั้น ${myFloor} / แถว ${myColumn} ให้เบี่ยงประเด็นหรือแกล้งสวมรอยอ้างเบาะแสแม่บ้าน/ช่างเช็ดกระจก/นักสืบเพื่อดึงเสียงโหวตไปทางอื่น!`;
    case 'ACCOMPLICE':
      return `กลยุทธ์ลับ [ผู้ช่วยฆาตกร]: ห้องมึงคือ ${myRoom} (ชั้น ${myFloor}, แถว ${myColumn}) คู่หูฆาตกรคือ ${partnerDesc} — ห้ามให้คนโหวตโดนห้อง/ชั้น/แถวของฆาตกรเด็ดขาด! ใช้ข้อมูลที่ส่องมาสร้างเรื่องป้ายสีคนดีหรือเบี่ยงโหวตไปชั้น/แถวปลอดภัย หรือแกล้งเปิดเบาะแสปลอมถ้าสถานการณ์คับขัน แต่อย่าทำตัวปกป้องฆาตกรโจ่งแจ้งจนโดนจับโป๊ะ!`;
    case 'DETECTIVE':
      return `กลยุทธ์ลับ [นักสืบ]: ห้องมึงคือ ${myRoom} (ชั้น ${myFloor}, แถว ${myColumn}) — มึงสืบได้เฉพาะชั้นที่ผู้เล่นพัก (ไม่รู้ฝ่าย) จงคิดให้ฉลาดว่าจะเก็บข้อมูลไว้เทียบคำพูดคนอื่นก่อน หรือเปิดเผยชั้นของคนที่น่าสงสัยเพื่อจับโป๊ะคนโกหก (ระวังอย่าพาเพื่อนโหวตปิดชั้น ${myFloor} หรือแถว ${myColumn} ของตัวเอง!)`;
    case 'HOUSEKEEPER':
      return `กลยุทธ์ลับ [แม่บ้าน]: ห้องมึงคือ ${myRoom} (ชั้น ${myFloor}, แถว ${myColumn}) — เบาะแสจำนวนคนรอดแต่ละชั้นของมึงโคตรสำคัญ! คิดให้ดีว่าจะคายตัวเลขชั้นไหนตอนไหนเพื่อตัดช้อยส์ห้องว่างหรือนำโหวตปิดชั้นที่มีฆาตกรซ่อนอยู่ (อย่าเผลอพาเพื่อนปิดชั้น ${myFloor} ของตัวเอง!)`;
    case 'GLAZIER':
      return `กลยุทธ์ลับ [ช่างเช็ดกระจก]: ห้องมึงคือ ${myRoom} (ชั้น ${myFloor}, แถว ${myColumn}) — เบาะแสจำนวนคนรอดแต่ละแถวแนวตั้ง (x01/x02/x03) ของมึงใช้ตัดช้อยส์หรือนำโหวตปิดแถวในวันที่ 3-4 ได้ดีมาก! เอาตัวเลขจริงมาเทียบกับแชทเพื่อนเพื่อจับพิรุธ (อย่าพาเพื่อนปิดแถว ${myColumn} ของตัวเอง!)`;
    case 'WITNESS':
      return `กลยุทธ์ลับ [พยาน]: ห้องมึงคือ ${myRoom} (ชั้น ${myFloor}, แถว ${myColumn}) — ถ้าคืนไหนมึงเฝ้าตรงชั้นเกิดเหตุจนรู้ทิศทางชั้นฆาตกร (สูงกว่า/ต่ำกว่า/ชั้นเดียวกัน) นั่นคือเบาะแสระดับเชือด! ตัดสินใจให้ฉลาดว่าจะเปิดเผยทันทีเพื่อบีบวงฆาตกรหรือซุ่มดูคนล่กก่อน`;
    case 'KEYMASTER':
      return `กลยุทธ์ลับ [ช่างกุญแจ]: ห้องมึงคือ ${myRoom} (ชั้น ${myFloor}, แถว ${myColumn}) — ห้ามหลุดบอกเด็ดขาดว่าคืนหน้าจะล็อกห้องไหน! ถ้าคืนก่อนมึงล็อกกันฆาตกรได้สำเร็จให้ใช้เป็นจุดสังเกตและวิเคราะห์ร่วมกับแชทเพื่อช่วยฝั่งคนดีจับฆาตกร`;
    case 'DRUNK':
      return `กลยุทธ์ลับ [คนเมา - ชนะเดี่ยว]: ห้องมึงคือ ${myRoom} (ชั้น ${myFloor}, แถว ${myColumn}) — เป้าหมายเดียวคือปั่นให้คนอื่นหมั่นไส้หรือระแวงจนโหวตเปิดห้อง ${myRoom} หรือปิดตายชั้น ${myFloor}/แถว ${myColumn} (โดยไม่มีฆาตกรโดน) มึงจะชนะเดี่ยวทันที! พูดกวนๆ หรือแกล้งทำตัวมีพิรุธหลุดพิกัดแบบเนียนๆ แต่อย่าพูดโต้งๆ ว่าเป็นคนเมาเพราะเพื่อนจะรู้ทันไม่โหวตมึง!`;
  }
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('AbortError') ||
    msg.includes('fetch failed') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT')
  );
}

function sanitizeThaiColloquial(raw: string): string {
  let text = raw
    .trim()
    .replace(/^["'「『]+|["'」』]+$/g, '')
    .replace(/^(ชื่อ|บอท|ตอบ|ข้อความ)\s*[:：]\s*/i, '')
    .replace(/\s+/g, ' ');

  text = text
    .replace(/(นะครับ|นะคะ|นะคับ|นะค่ะ|ครับผม|ครับ|ค่ะ)\b/g, 'ว่ะ')
    .replace(/\bคุณ\b/g, 'มึง')
    .replace(/\bผม\b/g, 'กู')
    .replace(/\bดิฉัน\b/g, 'กู');

  if (text.length > 210) {
    text = text.slice(0, 207).trim() + '...';
  }
  return text;
}

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  expectJson = false,
  maxTokens = expectJson ? 1100 : 210
): Promise<string> {
  const cfg = getGroqConfig();
  if (!cfg) throw new Error('GROQ_NOT_CONFIGURED');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 11000);

  try {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: expectJson ? 0.65 : 0.92,
      max_tokens: maxTokens,
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
      throw new Error(`GROQ_HTTP_${res.status}: ${errText.slice(0, 160)}`);
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

  const configuredPrimary = process.env.GEMINI_MODEL_PRIMARY?.trim();
  const candidateModels = resolvedGeminiModel
    ? [resolvedGeminiModel]
    : Array.from(
        new Set(
          [configuredPrimary, 'gemini-4-hydrogen', 'gemini-3.1-flash-lite'].filter(
            (m): m is string => Boolean(m)
          )
        )
      );

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
      if (modelName.startsWith('gemini-4-')) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
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
  expectJson = false,
  maxTokens?: number
): Promise<{ text: string; provider: ProviderChoice }> {
  const hasGroq = Boolean(getGroqConfig());
  const hasGemini = Boolean(getGeminiClient());
  const order: ProviderChoice[] =
    preferred === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq'];
  const activeOrder = order.filter((p) => (p === 'groq' ? hasGroq : hasGemini));

  let lastErr: unknown = null;
  for (const provider of activeOrder) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text =
          provider === 'groq'
            ? await callGroq(systemPrompt, userPrompt, expectJson, maxTokens)
            : await callGemini(systemPrompt, userPrompt, expectJson);
        return { text, provider };
      } catch (err) {
        lastErr = err;
        if (attempt === 0 && isTransientError(err)) {
          await sleep(450 + Math.floor(Math.random() * 350));
          continue;
        }
        break;
      }
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
  deathCause: DeathCause;
  deathDay: number | null;
  deathRoom: HotelRoomNumber | null;
}

function formatGameStateContext(params: {
  day: number;
  maxDays: number;
  phase: GamePhase;
  totalFloors: number;
  players: FogBotContextPlayer[];
  revealedRooms: RevealedRoomInfo[];
  lockedFloors: HotelFloorNumber[];
  lockedColumns: HotelColumnNumber[];
  morningHeadline: string | null;
  pastVoteRecords: PastVoteRecord[];
  recentChat: ChatMessage[];
}): string {
  const aliveList = params.players
    .filter((p) => p.alive)
    .map((p) => p.name)
    .join(', ');

  // STRICT NO ROLE REVEAL ON DEATH: Include only name, room, day, and death cause (Night Murder vs Day Execution)
  const deadList = params.players
    .filter((p) => !p.alive)
    .map((p) => {
      const causeText =
        p.deathCause === 'MURDERED'
          ? 'ถูกฆาตกรสังหารตอนกลางคืน'
          : 'ถูกโหวตเปิดห้อง/ปิดตายตอนกลางวัน';
      return `${p.name} (ห้อง ${p.deathRoom ?? '?'}, ตายวัน/คืนที่ ${p.deathDay ?? '?'}, ${causeText} — ไม่เปิดเผยบทบาท)`;
    })
    .join('\n- ');

  const revealedSummary = params.revealedRooms
    .map((r) =>
      r.kind === 'INITIAL_CRIME'
        ? `${r.room}(ศพตั้งต้น-ว่าง)`
        : r.kind === 'EMPTY_LYNCHED'
          ? `${r.room}(เปิดแล้ว-ว่าง)`
          : r.kind === 'LOCKED_EMPTY'
            ? `${r.room}(ปิดตาย-ว่าง)`
            : `${r.room}(ศพ ${r.occupantName ?? 'ผู้เล่น'}: เสียชีวิต-ไม่เปิดเผยบทบาท)`
    )
    .join(', ');

  const voteHistoryBlock =
    params.pastVoteRecords.length > 0
      ? params.pastVoteRecords
          .map((rec) => {
            const detail = rec.votes.map((v) => `${v.voterName}->${v.targetLabel}`).join(', ');
            return `วันที่ ${rec.day}: ผล=${rec.winnerLabel} | ${rec.summaryText}\n  คะแนนรายคน: ${detail}`;
          })
          .join('\n')
      : 'ยังไม่มีประวัติการโหวต (เพิ่งเริ่มเกม)';

  const voteUnlockNote =
    params.day <= 1
      ? 'วันที่ 1: โหวตได้เฉพาะ "เปิด 1 ห้อง (รายห้อง)" เท่านั้น! (ปิดชั้นปลดวันที่ 2, ปิดแถวปลดวันที่ 3)'
      : params.day === 2
        ? 'วันที่ 2: ปลดล็อก "เปิด 1 ห้อง" และ "ปิดตาย 1 ชั้นแนวนอน" แล้ว! (ปิดแถวแนวตั้งยังไม่ปลด ต้องรอวันที่ 3)'
        : `วันที่ ${params.day}: ปลดล็อกเต็มรูปแบบครบทั้ง 3 แบบแล้ว! ("เปิด 1 ห้อง" / "ปิดตาย 1 ชั้นแนวนอน" / "ปิดตาย 1 แถวแนวตั้ง")`;

  const chatHistory = params.recentChat
    .slice(-15)
    .map((m) => (m.isSystem ? `[ระบบ] ${m.text}` : `${m.senderName}: ${m.text}`))
    .join('\n');

  return [
    `=== สถานะเกมปัจจุบัน ===`,
    `วัน/เฟส: วันที่ ${params.day}/${params.maxDays} (${params.phase}) | โรงแรมมี ${params.totalFloors} ชั้น (ชั้น 1 ถึง ${params.totalFloors}, ชั้นละ 3 ห้อง x01-x03)`,
    `กติกาโหวตวันนี้: ${voteUnlockNote}`,
    `ชั้นที่ปิดตายแล้ว: ${params.lockedFloors.length > 0 ? params.lockedFloors.join(', ') : 'ยังไม่มี'} | แถวที่ปิดตายแล้ว: ${params.lockedColumns.length > 0 ? params.lockedColumns.join(', ') : 'ยังไม่มี'}`,
    params.morningHeadline ? `ข่าวเมื่อเช้า: ${params.morningHeadline}` : '',
    `ห้องที่เปิด/ปิดตายแล้ว: ${revealedSummary || 'ยังไม่มี'}`,
    `ผู้รอดชีวิต (${params.players.filter((p) => p.alive).length} คน): ${aliveList}`,
    deadList ? `ผู้เสียชีวิต (ห้ามเดาบทบาทเพราะยังไม่เฉลย):\n- ${deadList}` : 'ผู้เสียชีวิต: ยังไม่มีใครตาย',
    `ประวัติการโหวตที่ผ่านมา:\n${voteHistoryBlock}`,
    chatHistory
      ? `=== ประวัติแชทล่าสุด (15 ข้อความล่าสุด) ===\n${chatHistory}`
      : '=== ประวัติแชทล่าสุด ===\n(ยังไม่มีใครพิมพ์ในแชท)',
  ]
    .filter(Boolean)
    .join('\n\n');
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
  pastVoteRecords: PastVoteRecord[];
  recentChat: ChatMessage[];
  morningHeadline: string | null;
  evilPartners: Array<{ name: string; role: RoleId; room?: HotelRoomNumber | null }>;
  privateClues: PrivateClueLog[];
  triggerReason: 'PHASE_START' | 'HUMAN_REPLY' | 'PRE_READY' | 'BOT_BANTER';
  lastHumanMessage?: { senderName: string; text: string };
}

/**
 * 100% Autonomous Single-Bot Chat via live LLM (ZERO hardcoded templates).
 * Returns null if all configured LLM providers fail after retry.
 */
export async function generateBotChat(
  input: BotChatInput
): Promise<{ text: string; provider: ProviderChoice } | null> {
  const roleDef = ROLE_DEFINITIONS[input.role];
  const clueStrings = input.privateClues
    .slice(-8)
    .map((c) => `[คืน ${c.night} - ${c.title}] ${c.detail}`);

  const roleMission = buildRoleStrategyBrief({
    role: input.role,
    myRoom: input.myRoom,
    myFloor: input.myFloor,
    myColumn: input.myColumn,
    evilPartners: input.evilPartners,
  });

  const sharedContext = formatGameStateContext({
    day: input.day,
    maxDays: input.maxDays,
    phase: input.phase,
    totalFloors: input.totalFloors,
    players: input.players,
    revealedRooms: input.revealedRooms,
    lockedFloors: input.lockedFloors,
    lockedColumns: input.lockedColumns,
    morningHeadline: input.morningHeadline,
    pastVoteRecords: input.pastVoteRecords,
    recentChat: input.recentChat,
  });

  const genderLabel = input.bot.gender === 'M' ? 'ชาย' : 'หญิง';
  const taskDirective =
    input.triggerReason === 'HUMAN_REPLY' && input.lastHumanMessage
      ? `เพื่อนชื่อ "${input.lastHumanMessage.senderName}" เพิ่งพิมพ์ว่า: "${input.lastHumanMessage.text}" — จงคิดวิเคราะห์สดๆ แล้วตอบโต้โดยตรงให้เข้ากับบทบาท เบาะแสส่วนตัว และนิสัย "${input.bot.archetype}" ของมึง (ถ้ามันพาดพิงชื่อ/ชั้น/แถวของมึง ให้แก้ตัวหรือโต้กลับให้เนียน!)`
      : input.triggerReason === 'PRE_READY'
        ? `มึงกำลังจะกด "พร้อมโหวต" แล้ว จงพูดสรุปจุดยืน/เป้าหมายที่มึงอยากให้เพื่อนโหวต หรือกดดันเพื่อนให้รีบตัดสินใจตามนิสัย "${input.bot.archetype}"`
        : input.triggerReason === 'BOT_BANTER'
          ? `อ่านบทสนทนาล่าสุดในห้องแชทแล้วโผล่เข้าไปโต้แย้ง ซักไซ้ แซะ หรือต่อยอดคำพูดของเพื่อนคนก่อนหน้าอย่างเป็นธรรมชาติตามนิสัย "${input.bot.archetype}"`
          : `เพิ่งเปิดช่วงสนทนาวันใหม่ จงเปิดประเด็นวิเคราะห์ข่าวเมื่อเช้า เบาะแสส่วนตัว หรือจับพิรุธเพื่อนในห้องอย่างอิสระตามนิสัย "${input.bot.archetype}"`;

  const userPrompt = [
    `=== ตัวตนและแฟ้มความลับของมึง ===`,
    `ชื่อ: "${input.bot.name}" | เพศ: ${genderLabel} | คาแรคเตอร์: ${input.bot.archetype}`,
    `นิสัย: ${input.bot.persona}`,
    `สไตล์การพูด: ${input.bot.speechStyle}`,
    `บทบาทลับ: "${roleDef.nameTh}" (${roleDef.nameEn}) | ความสามารถ: ${roleDef.shortAbilityTh}`,
    `ห้องประจำตัวถาวร: ห้อง ${input.myRoom} (ชั้น ${input.myFloor}, แถวแนวตั้ง ${input.myColumn})`,
    roleMission,
    clueStrings.length > 0
      ? `สมุดบันทึกเบาะแสกลางคืนส่วนตัวของมึง (มีแค่มึงที่รู้):\n${clueStrings.join('\n')}`
      : 'สมุดบันทึกเบาะแสกลางคืนส่วนตัว: ยังไม่มี (เพิ่งเริ่มวันแรก หรือยังไม่พบเบาะแส)',
    sharedContext,
    `=== คำสั่ง ===\n${taskDirective}\nตอบกลับมาเป็นข้อความแชทสดๆ 1-3 ประโยคสั้นๆ เท่านั้น (ห้ามซ้ำประโยคที่มีในแชทอยู่แล้ว):`,
  ].join('\n\n');

  try {
    const { text, provider } = await generateWithMultiProvider(
      input.bot.preferredProvider,
      CORE_PERSONA_INSTRUCTION,
      userPrompt,
      false
    );
    const cleaned = sanitizeThaiColloquial(text);
    if (!cleaned) return null;
    return { text: cleaned, provider };
  } catch (err) {
    console.warn(`[AI] generateBotChat failed for ${input.bot.name}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export interface MultiBotParticipant {
  bot: BotProfile;
  role: RoleId;
  myRoom: HotelRoomNumber;
  myFloor: HotelFloorNumber;
  myColumn: HotelColumnNumber;
  evilPartners: Array<{ name: string; role: RoleId; room?: HotelRoomNumber | null }>;
  privateClues: PrivateClueLog[];
}

export interface MultiBotExchangeInput {
  speakers: MultiBotParticipant[];
  totalFloors: number;
  phase: GamePhase;
  day: number;
  maxDays: number;
  revealedRooms: RevealedRoomInfo[];
  lockedFloors: HotelFloorNumber[];
  lockedColumns: HotelColumnNumber[];
  players: FogBotContextPlayer[];
  pastVoteRecords: PastVoteRecord[];
  recentChat: ChatMessage[];
  morningHeadline: string | null;
  triggerReason: 'PHASE_START' | 'HUMAN_REPLY' | 'BOT_BANTER';
  lastHumanMessage?: { senderName: string; text: string };
}

/**
 * Multi-Bot Conversational Flow via Structured JSON Output:
 * Generates a realistic 2-3 message back-and-forth exchange in ONE LLM call so bots
 * directly react to the human player AND bounce replies off each other without rate-limit spikes!
 * Strictly enforces per-bot Fog of War (each bot ONLY knows its own dossier + public chat).
 */
export async function generateMultiBotExchange(
  input: MultiBotExchangeInput
): Promise<Array<{ botId: string; text: string; provider: ProviderChoice }>> {
  if (input.speakers.length === 0) return [];
  if (input.speakers.length === 1) {
    const s = input.speakers[0];
    const single = await generateBotChat({
      bot: s.bot,
      role: s.role,
      myRoom: s.myRoom,
      myFloor: s.myFloor,
      myColumn: s.myColumn,
      totalFloors: input.totalFloors,
      phase: input.phase,
      day: input.day,
      maxDays: input.maxDays,
      revealedRooms: input.revealedRooms,
      lockedFloors: input.lockedFloors,
      lockedColumns: input.lockedColumns,
      players: input.players,
      pastVoteRecords: input.pastVoteRecords,
      recentChat: input.recentChat,
      morningHeadline: input.morningHeadline,
      evilPartners: s.evilPartners,
      privateClues: s.privateClues,
      triggerReason: input.triggerReason,
      lastHumanMessage: input.lastHumanMessage,
    });
    return single ? [{ botId: s.bot.id, text: single.text, provider: single.provider }] : [];
  }

  const sharedContext = formatGameStateContext({
    day: input.day,
    maxDays: input.maxDays,
    phase: input.phase,
    totalFloors: input.totalFloors,
    players: input.players,
    revealedRooms: input.revealedRooms,
    lockedFloors: input.lockedFloors,
    lockedColumns: input.lockedColumns,
    morningHeadline: input.morningHeadline,
    pastVoteRecords: input.pastVoteRecords,
    recentChat: input.recentChat,
  });

  const dossiers = input.speakers
    .map((s, idx) => {
      const roleDef = ROLE_DEFINITIONS[s.role];
      const clues =
        s.privateClues.length > 0
          ? s.privateClues
              .slice(-6)
              .map((c) => `[คืน ${c.night}] ${c.detail}`)
              .join(' | ')
          : 'ยังไม่มีเบาะแสกลางคืน';
      const strategy = buildRoleStrategyBrief({
        role: s.role,
        myRoom: s.myRoom,
        myFloor: s.myFloor,
        myColumn: s.myColumn,
        evilPartners: s.evilPartners,
      });
      return `--- ลำดับพูดที่ ${idx + 1}: botId="${s.bot.id}" | ชื่อ="${s.bot.name}" | เพศ=${s.bot.gender === 'M' ? 'ชาย' : 'หญิง'} | คาแรคเตอร์=${s.bot.archetype} ---
นิสัย: ${s.bot.persona}
สไตล์การพูด: ${s.bot.speechStyle}
บทบาทลับ: ${roleDef.nameTh} (${roleDef.nameEn}) | ห้องประจำตัว: ห้อง ${s.myRoom} (ชั้น ${s.myFloor}, แถว ${s.myColumn})
${strategy}
เบาะแสส่วนตัวของ ${s.bot.name} เท่านั้น: ${clues}`;
    })
    .join('\n\n');

  const scenarioDirective =
    input.triggerReason === 'HUMAN_REPLY' && input.lastHumanMessage
      ? `ผู้เล่นชื่อ "${input.lastHumanMessage.senderName}" เพิ่งพิมพ์ว่า: "${input.lastHumanMessage.text}"
สร้างบทสนทนาโต้ตอบต่อเนื่องกันตามลำดับพูดข้างต้น:
- คนที่ 1 ตอบโต้ "${input.lastHumanMessage.senderName}" โดยตรง (ถ้าโดนจี้ชื่อ/ชั้น/ห้องให้แก้ตัวหรือเถียงกลับ)
- คนที่ 2 (และ 3 ถ้ามี) โต้ตอบต่อจากทั้ง "${input.lastHumanMessage.senderName}" และคำพูดของบอทคนก่อนหน้าให้เหมือนเพื่อนในวงเหล้าคุยโต้เถียงกันสดๆ!`
      : input.triggerReason === 'BOT_BANTER'
        ? `สร้างบทสนทนาโต้เถียง/ต่อบทกันเองระหว่างบอท ${input.speakers.length} ตัว โดยต่อยอดจากประวัติแชทล่าสุดและประวัติโหวตที่ผ่านมา ให้คนหลังโต้แย้ง/แซะ/ซักถามคนก่อนหน้าอย่างเป็นธรรมชาติ!`
        : `เพิ่งเริ่มช่วงสนทนาวันที่ ${input.day}! สร้างบทสนทนาเปิดวงของบอท ${input.speakers.length} ตัว โดยคนที่ 1 เปิดประเด็นจากข่าวเมื่อเช้า/เบาะแส/ห้องศพตั้งต้น และคนถัดไปโต้ตอบเถียงกันหรือแชร์มุมมองต่อจากคนแรกทันที!`;

  const userPrompt = [
    sharedContext,
    `=== แฟ้มลับเฉพาะตัวของบอทที่จะพูดรอบนี้ (กฎเหล็ก Fog of War: บอทแต่ละตัวรู้เฉพาะแฟ้มของตัวเองเท่านั้น ห้ามเอาความลับของบอทอีกตัวมาพูดเด็ดขาด!) ===\n\n${dossiers}`,
    `=== ภารกิจ ===\n${scenarioDirective}

ตอบกลับเป็น JSON Object ตามโครงสร้างนี้เท่านั้น (ห้ามมีข้อความอื่นนอก JSON):
{
  "messages": [
    { "botId": "${input.speakers[0].bot.id}", "text": "ข้อความแชทสั้นๆ 1-3 ประโยค ภาษาเพื่อนซี้กู-มึง" }
  ]
}`,
  ].join('\n\n');

  try {
    const { text, provider } = await generateWithMultiProvider(
      input.speakers[0].bot.preferredProvider,
      CORE_PERSONA_INSTRUCTION +
        '\nสำคัญมาก: รักษากฎ Fog of War แยกสมองบอทแต่ละตัวออกจากกัน ห้ามให้บอทตัวหนึ่งรู้บทบาทหรือห้องของบอทอีกตัว (ยกเว้นคู่หูฝ่ายฆาตกร) และตอบกลับเป็น JSON เท่านั้น!',
      userPrompt,
      true,
      1100
    );

    const parsed = extractJsonObject(text);
    const rawList = Array.isArray(parsed?.messages)
      ? (parsed.messages as Array<{ botId?: string; text?: string }>)
      : [];

    const validIds = new Set(input.speakers.map((s) => s.bot.id));
    const seen = new Set<string>();
    const results: Array<{ botId: string; text: string; provider: ProviderChoice }> = [];

    for (const item of rawList) {
      const id = typeof item?.botId === 'string' ? item.botId.trim() : '';
      if (!validIds.has(id) || seen.has(id)) continue;
      const cleaned = typeof item?.text === 'string' ? sanitizeThaiColloquial(item.text) : '';
      if (!cleaned) continue;
      seen.add(id);
      results.push({ botId: id, text: cleaned, provider });
    }

    return results;
  } catch (err) {
    console.warn(
      '[AI] generateMultiBotExchange failed:',
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

/**
 * Dynamic Secret Underground Night Chat Reply between Evil Bot and Human Evil Partner
 * (100% live LLM, zero hardcoded dialogue).
 */
export async function generateBotSecretReply(params: {
  bot: BotProfile;
  role: 'MURDERER' | 'ACCOMPLICE';
  myRoom: HotelRoomNumber;
  partnerName: string;
  partnerMessage: string;
  day: number;
  totalFloors: number;
  unrevealedRooms: HotelRoomNumber[];
  secretChat: SecretChatMessage[];
  privateClues: PrivateClueLog[];
}): Promise<string | null> {
  const roleLabel = params.role === 'MURDERER' ? 'ฆาตกร' : 'ผู้ช่วยฆาตกร';
  const secretHistory = params.secretChat
    .slice(-8)
    .map((m) => `${m.senderName}: ${m.text}`)
    .join('\n');
  const clues = params.privateClues
    .slice(-5)
    .map((c) => `[คืน ${c.night}] ${c.detail}`)
    .join(' | ');

  const prompt = `มึงคือ ${params.bot.name} (${params.bot.archetype}, บทบาท: ${roleLabel}, ห้องพักมึง: ${params.myRoom}) กำลังกระซิบแชทลับกลางคืนกับคู่หู "${params.partnerName}" ในคืนที่ ${params.day} (โรงแรมมี ${params.totalFloors} ชั้น)
ห้องที่ยังเปิดอยู่ตอนนี้: [${params.unrevealedRooms.join(', ')}]
เบาะแสสืบชั้นของมึง: ${clues || 'ยังไม่มี'}
ประวัติแชทลับคืนนี้:
${secretHistory}

"${params.partnerName}" เพิ่งกระซิบว่า: "${params.partnerMessage}"
ตอบกลับคู่หูในแชทลับสั้นๆ 1-2 ประโยค ภาษาเพื่อนซี้กู-มึง วางแผนเชือดหรือชี้เป้าให้เนียนที่สุด:`;

  try {
    const { text } = await generateWithMultiProvider(
      params.bot.preferredProvider,
      CORE_PERSONA_INSTRUCTION,
      prompt,
      false
    );
    const cleaned = sanitizeThaiColloquial(text);
    return cleaned || null;
  } catch (err) {
    console.warn('[AI] generateBotSecretReply failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * AI Accomplice sends Secret Underground Whisper & Target Room/Floor Ping to Murderer at Night.
 * Whisper text is 100% live LLM generated (returns whisper: null if LLM fails — ZERO hardcoded phrases).
 */
export async function generateAccompliceSecretPing(params: {
  bot: BotProfile;
  murdererName: string;
  murdererRoom: HotelRoomNumber | null;
  day: number;
  totalFloors: number;
  unrevealedRooms: HotelRoomNumber[];
  myRoom: HotelRoomNumber;
  players: FogBotContextPlayer[];
  pastVoteRecords: PastVoteRecord[];
  recentChat: ChatMessage[];
  privateClues: PrivateClueLog[];
}): Promise<{ whisper: string | null; pingRoom: HotelRoomNumber; pingFloor?: HotelFloorNumber }> {
  const candidates = params.unrevealedRooms.filter(
    (r) => r !== params.myRoom && r !== params.murdererRoom
  );

  const latestClue = params.privateClues[params.privateClues.length - 1];
  const floorMatch = latestClue?.detail.match(/ชั้น\s*([1-7])/);
  const clueFloor = floorMatch ? (Number(floorMatch[1]) as HotelFloorNumber) : null;
  const clueFloorRooms = clueFloor
    ? candidates.filter((r) => getFloorOfRoom(r) === clueFloor)
    : [];

  const mechanicalPickRoom =
    (clueFloorRooms.length > 0
      ? clueFloorRooms[Math.floor(Math.random() * clueFloorRooms.length)]
      : candidates[Math.floor(Math.random() * Math.max(1, candidates.length))]) ??
    params.unrevealedRooms[0] ??
    201;

  try {
    const chatSnippet = params.recentChat
      .slice(-12)
      .map((m) => (m.isSystem ? `[ระบบ] ${m.text}` : `${m.senderName}: ${m.text}`))
      .join('\n');
    const cluesText = params.privateClues.map((c) => `[คืน ${c.night}] ${c.detail}`).join('\n');

    const prompt = `มึงคือผู้ช่วยฆาตกรชื่อ "${params.bot.name}" (${params.bot.archetype}, นิสัย: ${params.bot.persona}, ห้องมึง: ${params.myRoom})
กำลังกระซิบในแชทลับใต้ดินคืนที่ ${params.day} กับคู่หูฆาตกรชื่อ "${params.murdererName}" (ห้องฆาตกร: ${params.murdererRoom ?? 'ไม่ระบุ'})
โรงแรมมี ${params.totalFloors} ชั้น | ห้องที่ยังไม่ถูกเปิด/ปิดตาย (เลือกชี้เป้าได้): [${candidates.join(', ')}]
เบาะแสสืบชั้นที่มึงส่องมาได้:
${cluesText || 'ยังไม่มี'}
แชทสาธารณะล่าสุด:
${chatSnippet || '(ไม่มี)'}

คิดวิเคราะห์จากเบาะแสและแชท แล้วเลือก 1 ห้องที่ยังไม่เปิดเพื่อส่งซิกแนะนำให้ฆาตกร พร้อมพิมพ์กระซิบสั้นๆ 1-2 ประโยค ภาษาเพื่อนซี้กู-มึง ตามนิสัยของมึง (ถ้าส่องเจอชั้นใครก็บอกชื่อและชั้นนั้นด้วย!)
ตอบเป็น JSON เท่านั้น:
{"room": ${mechanicalPickRoom}, "whisper": "ข้อความกระซิบสดๆ ไม่เกิน 140 ตัวอักษร"}`;

    const { text } = await generateWithMultiProvider(
      params.bot.preferredProvider,
      CORE_PERSONA_INSTRUCTION + '\nตอบกลับเป็น JSON เท่านั้น',
      prompt,
      true,
      360
    );
    const parsed = extractJsonObject(text);
    if (!parsed) {
      return { whisper: null, pingRoom: mechanicalPickRoom, pingFloor: clueFloor ?? undefined };
    }

    const rawRoom = Number(parsed.room) as HotelRoomNumber;
    const validRoom = candidates.includes(rawRoom) ? rawRoom : mechanicalPickRoom;
    const whisper =
      typeof parsed.whisper === 'string' && parsed.whisper.trim()
        ? sanitizeThaiColloquial(parsed.whisper)
        : null;

    return { whisper, pingRoom: validRoom, pingFloor: clueFloor ?? undefined };
  } catch (err) {
    console.warn(
      '[AI] generateAccompliceSecretPing failed:',
      err instanceof Error ? err.message : err
    );
    return { whisper: null, pingRoom: mechanicalPickRoom, pingFloor: clueFloor ?? undefined };
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
  pastVoteRecords: PastVoteRecord[];
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

  // Pure mechanical legal-move safeguard ONLY if LLM call errors or outputs an illegal target
  const legalMoveSafeguard = ():
    | HotelRoomNumber
    | HotelFloorNumber
    | HotelColumnNumber
    | string
    | null => {
    if (params.role === 'MURDERER') {
      const pool = params.unrevealedRooms.filter((r) => r !== params.myRoom);
      if (params.secretPing?.room && pool.includes(params.secretPing.room) && Math.random() < 0.7) {
        return params.secretPing.room;
      }
      if (params.secretPing?.floor) {
        const floorPool = pool.filter((r) => getFloorOfRoom(r) === params.secretPing?.floor);
        if (floorPool.length > 0 && Math.random() < 0.7) {
          return floorPool[Math.floor(Math.random() * floorPool.length)];
        }
      }
      return pool[Math.floor(Math.random() * Math.max(1, pool.length))] ?? params.unrevealedRooms[0] ?? 101;
    }

    if (params.role === 'KEYMASTER') {
      const pool = params.unrevealedRooms.filter((r) => r !== params.lastKeymasterLockedRoom);
      if (pool.includes(params.myRoom) && Math.random() < 0.3) return params.myRoom;
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
    const aliveSummary = alivePlayers.map((p) => `- id:"${p.id}" ชื่อ:"${p.name}"`).join('\n');
    const deadSummary = params.players
      .filter((p) => !p.alive)
      .map(
        (p) =>
          `${p.name} (ห้อง ${p.deathRoom ?? '?'}, ${p.deathCause === 'MURDERED' ? 'ถูกฆ่า' : 'ถูกโหวตออก'})`
      )
      .join(', ');
    const chatSnippet = params.recentChat
      .slice(-15)
      .map((m) => (m.isSystem ? `[ระบบ] ${m.text}` : `${m.senderName}: ${m.text}`))
      .join('\n');
    const cluesText = params.privateClues.map((c) => `[คืน ${c.night}] ${c.detail}`).join('\n');
    const voteText = params.pastVoteRecords
      .map((v) => `วัน ${v.day}: ${v.winnerLabel} (${v.votes.map((x) => `${x.voterName}->${x.targetLabel}`).join(', ')})`)
      .join('\n');

    let prompt = '';
    const baseHeader = `มึงคือ "${params.bot.name}" (${params.bot.archetype}, นิสัย: ${params.bot.persona})
คืนที่ ${params.day} | ห้องพักมึง: ${params.myRoom} (ชั้น ${getFloorOfRoom(params.myRoom)}, แถว ${getColumnOfRoom(params.myRoom)}) | โรงแรมมี ${params.totalFloors} ชั้น
ผู้เสียชีวิตแล้ว: ${deadSummary || 'ยังไม่มี'}
ประวัติโหวตที่ผ่านมา: ${voteText || 'ยังไม่มี'}
สมุดเบาะแสส่วนตัวของมึง:
${cluesText || 'ยังไม่มี'}
แชทล่าสุด (15 ข้อความ):
${chatSnippet || '(ไม่มี)'}`;

    if (params.role === 'MURDERER') {
      const secretSnippet = params.secretChat
        .slice(-6)
        .map((m) => `${m.senderName}: ${m.text}`)
        .join('\n');
      const pingHint = params.secretPing?.room
        ? `ผู้ช่วยส่งซิกแนะนำ: ห้อง ${params.secretPing.room}`
        : params.secretPing?.floor
          ? `ผู้ช่วยส่งซิกแนะนำ: ชั้น ${params.secretPing.floor}`
          : 'ยังไม่มีซิก';
      prompt = `${baseHeader}
บทบาท: ฆาตกร — เลือกห้องสังหารได้อิสระจากห้องที่ยังไม่เปิด (ห้ามเลือกห้องตัวเอง ${params.myRoom}): [${params.unrevealedRooms.filter((r) => r !== params.myRoom).join(', ')}]
ซิกจากผู้ช่วย: ${pingHint} (วิเคราะห์เองว่าจะเชื่อหรือไม่เชื่อ)
แชทลับผู้ช่วย: ${secretSnippet || '(ไม่มี)'}
วิเคราะห์เหตุผลเชิงกลยุทธ์แล้วเลือก 1 ห้อง ตอบเป็น JSON เท่านั้น: {"reasoning": "เหตุผลสั้นๆ", "room": 302}`;
    } else if (params.role === 'KEYMASTER') {
      const validRooms = params.unrevealedRooms.filter((r) => r !== params.lastKeymasterLockedRoom);
      prompt = `${baseHeader}
บทบาท: ช่างกุญแจ — ห้ามล็อกห้อง ${params.lastKeymasterLockedRoom ?? 'ไม่มี'} ซ้ำ!
ห้องที่เลือกล็อกป้องกันได้: [${validRooms.join(', ')}]
วิเคราะห์จากแชทว่าห้องไหนเสี่ยงโดนฆาตกรบุกมากสุด (หรือป้องกันห้องตัวเอง ${params.myRoom}) ตอบเป็น JSON เท่านั้น: {"reasoning": "เหตุผลสั้นๆ", "room": 302}`;
    } else if (params.role === 'HOUSEKEEPER') {
      prompt = `${baseHeader}
บทบาท: แม่บ้าน — เลือกตรวจ 1 ชั้นแนวนอน (1 ถึง ${params.totalFloors}) เพื่อรู้จำนวนคนรอดชีวิตในชั้นนั้น (เลือกชั้นที่ยังไม่มีข้อมูลหรือกำลังเป็นที่ถกเถียงในแชท!)
ตอบเป็น JSON เท่านั้น: {"reasoning": "เหตุผลสั้นๆ", "floor": 2}`;
    } else if (params.role === 'WITNESS') {
      prompt = `${baseHeader}
บทบาท: พยาน — เลือกเฝ้าดู 1 ชั้น (1 ถึง ${params.totalFloors}) ที่คาดว่าฆาตกรจะมาลงมือฆ่าคนคืนนี้ (หากเดาถูกชั้นจะรู้ทิศทางชั้นฆาตกรทันที!)
ตอบเป็น JSON เท่านั้น: {"reasoning": "เหตุผลสั้นๆ", "floor": 2}`;
    } else if (params.role === 'GLAZIER') {
      prompt = `${baseHeader}
บทบาท: ช่างเช็ดกระจก — เลือกตรวจ 1 แถวแนวตั้ง (1 = x01, 2 = x02, 3 = x03) ตลอด ${params.totalFloors} ชั้น เพื่อรู้จำนวนคนรอดทั้งแถว
ตอบเป็น JSON เท่านั้น: {"reasoning": "เหตุผลสั้นๆ", "column": 2}`;
    } else if (params.role === 'DETECTIVE' || params.role === 'ACCOMPLICE') {
      prompt = `${baseHeader}
บทบาท: ${ROLE_DEFINITIONS[params.role].nameTh} — เลือกชื่อผู้เล่น 1 คนเพื่อสืบว่าพักอยู่ชั้นไหน (1 ถึง ${params.totalFloors})
คนที่เคยสืบแล้ว: [${params.alreadyCheckedIds.join(', ') || 'ยังไม่มี'}]
ผู้รอดชีวิตที่เลือกได้ (ห้ามเลือกตัวเอง id:"${params.bot.id}"${params.role === 'ACCOMPLICE' ? ' และห้ามเลือกฆาตกรคู่หู' : ''}):
${aliveSummary}
วิเคราะห์ว่าควรสืบใครจากแชทล่าสุด ตอบเป็น JSON เท่านั้น: {"reasoning": "เหตุผลสั้นๆ", "targetId": "..."}`;
    }

    const { text } = await generateWithMultiProvider(
      params.bot.preferredProvider,
      'คุณคือ AI นักวางแผนบอร์ดเกม HOTEL MURDER คิดวิเคราะห์จากบริบททั้งหมดแล้วตอบกลับเป็น JSON ที่ถูกต้องเท่านั้น',
      prompt,
      true,
      360
    );
    const parsed = extractJsonObject(text);
    if (!parsed) return legalMoveSafeguard();

    if (params.role === 'DETECTIVE' || params.role === 'ACCOMPLICE') {
      const targetId = typeof parsed.targetId === 'string' ? parsed.targetId.trim() : '';
      const valid =
        alivePlayers.some((p) => p.id === targetId && p.id !== params.bot.id) &&
        !(params.role === 'ACCOMPLICE' && params.evilPartnerIds.includes(targetId));
      return valid ? targetId : legalMoveSafeguard();
    }
    if (params.role === 'HOUSEKEEPER' || params.role === 'WITNESS') {
      const floorNum = Number(parsed.floor) as HotelFloorNumber;
      return activeFloors.includes(floorNum) ? floorNum : legalMoveSafeguard();
    }
    if (params.role === 'GLAZIER') {
      const colNum = Number(parsed.column) as HotelColumnNumber;
      return HOTEL_COLUMNS.includes(colNum) ? colNum : legalMoveSafeguard();
    }

    const roomNum = Number(parsed.room) as HotelRoomNumber;
    if (params.unrevealedRooms.includes(roomNum)) {
      if (params.role === 'KEYMASTER' && roomNum === params.lastKeymasterLockedRoom) {
        return legalMoveSafeguard();
      }
      if (params.role === 'MURDERER' && roomNum === params.myRoom) {
        return legalMoveSafeguard();
      }
      return roomNum;
    }
    return legalMoveSafeguard();
  } catch (err) {
    console.warn(`[AI] decideBotNightAction failed for ${params.bot.name}:`, err instanceof Error ? err.message : err);
    return legalMoveSafeguard();
  }
}

/**
 * PROGRESSIVE 3-MODE DAY VOTE:
 * - Day 1: ROOM only
 * - Day 2: ROOM + Horizontal FLOOR
 * - Day 3-4: ROOM + Horizontal FLOOR + Vertical COLUMN
 * Comment is 100% live LLM generated (never hardcoded!).
 */
export async function decideBotDayVote(params: {
  bot: BotProfile;
  role: RoleId;
  myRoom: HotelRoomNumber;
  day: number;
  maxDays: number;
  totalFloors: number;
  unrevealedRooms: HotelRoomNumber[];
  votableFloors: HotelFloorNumber[];
  votableColumns: HotelColumnNumber[];
  revealedRooms: RevealedRoomInfo[];
  lockedFloors: HotelFloorNumber[];
  lockedColumns: HotelColumnNumber[];
  players: FogBotContextPlayer[];
  pastVoteRecords: PastVoteRecord[];
  evilPartners: Array<{ name: string; role: RoleId; room?: HotelRoomNumber | null }>;
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

  // Pure mechanical legal-vote safeguard if LLM errors (comment stays null!)
  const legalVoteSafeguard = (): DayVoteChoice => {
    if (params.role === 'DRUNK') {
      const roll = Math.random();
      if (roll < 0.38 && params.unrevealedRooms.includes(params.myRoom)) {
        return { kind: 'ROOM', room: params.myRoom };
      }
      if (roll < 0.65 && params.votableFloors.includes(myFloor)) {
        return { kind: 'FLOOR', floor: myFloor };
      }
      if (roll < 0.85 && params.votableColumns.includes(myColumn)) {
        return { kind: 'COLUMN', column: myColumn };
      }
      return { kind: 'ROOM', room: fallbackRoom };
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

  try {
    const sharedContext = formatGameStateContext({
      day: params.day,
      maxDays: params.maxDays,
      phase: 'VOTE',
      totalFloors: params.totalFloors,
      players: params.players,
      revealedRooms: params.revealedRooms,
      lockedFloors: params.lockedFloors,
      lockedColumns: params.lockedColumns,
      morningHeadline: null,
      pastVoteRecords: params.pastVoteRecords,
      recentChat: params.recentChat,
    });

    const cluesText = params.privateClues
      .slice(-8)
      .map((c) => `[คืน ${c.night} - ${c.title}] ${c.detail}`)
      .join('\n');

    const strategy = buildRoleStrategyBrief({
      role: params.role,
      myRoom: params.myRoom,
      myFloor,
      myColumn,
      evilPartners: params.evilPartners,
    });

    const canFloorLock = params.day >= 2 && safeFloors.length > 0;
    const canColLock = params.day >= 3 && safeCols.length > 0;

    let optionsBlock = `- เปิด 1 ห้อง ("kind":"ROOM"): [${(safeRooms.length > 0 ? safeRooms : params.unrevealedRooms).join(', ')}]`;
    if (canFloorLock) {
      optionsBlock += `\n- ปิดตาย 1 ชั้นแนวนอน ("kind":"FLOOR"): [${safeFloors.join(', ')}]`;
    }
    if (canColLock) {
      optionsBlock += `\n- ปิดตาย 1 แถวแนวตั้ง ("kind":"COLUMN"): [${safeCols.join(', ')}]`;
    }
    optionsBlock += `\n- งดออกเสียง ("kind":"SKIP", "target":0)`;

    const prompt = `=== ตัวตนและแฟ้มความลับของมึง ===
ชื่อ: "${params.bot.name}" | เพศ: ${params.bot.gender === 'M' ? 'ชาย' : 'หญิง'} | คาแรคเตอร์: ${params.bot.archetype}
นิสัย: ${params.bot.persona}
สไตล์การพูด: ${params.bot.speechStyle}
บทบาทลับ: ${ROLE_DEFINITIONS[params.role].nameTh} | ห้องประจำตัว: ${params.myRoom} (ชั้น ${myFloor}, แถว ${myColumn})
${strategy}
สมุดเบาะแสส่วนตัวของมึง:
${cluesText || 'ยังไม่มี'}

${sharedContext}

=== ตัวเลือกที่โหวตได้ตอนนี้ ===
${optionsBlock}

วิเคราะห์จากแชทล่าสุด ประวัติโหวต และเบาะแสส่วนตัวของมึง แล้วตัดสินใจโหวต 1 เป้าหมาย พร้อมคอมเมนต์สั้นๆ 1-2 ประโยคภาษาเพื่อนซี้กู-มึง (ตามนิสัยของมึง อ้างอิงสิ่งที่เพิ่งคุยกันในแชท!)
ตอบเป็น JSON เท่านั้น:
{"reasoning": "เหตุผลในใจสั้นๆ", "kind": "${canFloorLock ? 'FLOOR' : 'ROOM'}", "target": ${canFloorLock ? safeFloors[0] : fallbackRoom}, "comment": "ข้อความแชทสั้นๆ ตอนลงคะแนน"}`;

    const { text } = await generateWithMultiProvider(
      params.bot.preferredProvider,
      CORE_PERSONA_INSTRUCTION + '\nตอบกลับเป็น JSON เท่านั้น',
      prompt,
      true,
      480
    );
    const parsed = extractJsonObject(text);
    if (!parsed) return { choice: legalVoteSafeguard(), comment: null };

    const kind = String(parsed.kind ?? '').toUpperCase();
    const targetNum = Number(parsed.target);
    const comment =
      typeof parsed.comment === 'string' && parsed.comment.trim()
        ? sanitizeThaiColloquial(parsed.comment)
        : null;

    if (kind === 'SKIP') {
      return { choice: { kind: 'SKIP' }, comment };
    }
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

    return { choice: legalVoteSafeguard(), comment };
  } catch (err) {
    console.warn(`[AI] decideBotDayVote failed for ${params.bot.name}:`, err instanceof Error ? err.message : err);
    return { choice: legalVoteSafeguard(), comment: null };
  }
}

/**
 * 100% Live LLM Post-Game Reactions (ZERO hardcoded fallback templates).
 * Uses rich match context (true roles, rooms, clues, vote history, chat highlights, bot archetypes)
 * and retries missing bots individually if needed.
 */
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
    gender?: 'M' | 'F';
    archetype?: string;
    persona?: string;
    speechStyle?: string;
    deathCause: string | null;
    clueLogs?: PrivateClueLog[];
  }>;
  pastVoteRecords: PastVoteRecord[];
  historyLog: string[];
  recentChat: ChatMessage[];
}): Promise<BotPostGameThought[]> {
  const bots = params.players.filter((p) => p.isBot);
  if (bots.length === 0) return [];

  const rosterSummary = params.players
    .map(
      (p) =>
        `- id:"${p.id}" ชื่อ:"${p.name}" (${p.isBot ? 'AI' : 'คนจริง'}) ห้อง:${p.room ?? '?'} บทบาท:${ROLE_DEFINITIONS[p.role].nameTh} [${ROLE_DEFINITIONS[p.role].faction}] สถานะ:${p.alive ? 'รอดชีวิต' : p.deathCause === 'MURDERED' ? 'ถูกฆ่ากลางคืน' : 'ถูกโหวต/ปิดตายตอนกลางวัน'}`
    )
    .join('\n');

  const botProfilesSummary = bots
    .map((b) => {
      const clues =
        b.clueLogs && b.clueLogs.length > 0
          ? b.clueLogs.map((c) => `คืน${c.night}:${c.title}`).join('; ')
          : 'ไม่มี';
      return `- botId:"${b.id}" | ชื่อ:"${b.name}" (${b.gender === 'F' ? 'หญิง' : 'ชาย'}, ${b.archetype ?? 'เพื่อนซี้'}) | นิสัย:${b.persona ?? 'ปากร้าย'} | สไตล์:${b.speechStyle ?? 'กู-มึง'} | บทบาทจริง:${ROLE_DEFINITIONS[b.role].nameTh} ห้อง ${b.room ?? '?'} | เบาะแสที่เคยได้:${clues}`;
    })
    .join('\n');

  const voteHistorySummary =
    params.pastVoteRecords.length > 0
      ? params.pastVoteRecords
          .map(
            (r) =>
              `วันที่ ${r.day} (${r.winnerLabel}): ${r.votes.map((v) => `${v.voterName}->${v.targetLabel}`).join(', ')}`
          )
          .join('\n')
      : '(ไม่มีประวัติโหวต)';

  const chatHighlights = params.recentChat
    .filter((m) => !m.isSystem)
    .slice(-18)
    .map((m) => `${m.senderName}: ${m.text}`)
    .join('\n');

  const winnerText =
    params.winner === 'GOOD'
      ? 'ฝ่ายผู้บริสุทธิ์ชนะ!'
      : params.winner === 'EVIL'
        ? 'ฝ่ายฆาตกรชนะ!'
        : `ฝ่ายพิเศษ คนเมา (${params.winnerPlayerName ?? 'คนเมา'}) ชนะเดี่ยว!`;

  const prompt = `เกม "HOTEL MURDER ปริศนาโรงแรมมรณะ" จบลงแล้ว และเพิ่งเฉลยบทบาทกับห้องพักของทุกคน!
ผลแพ้ชนะ: ${winnerText}
สาเหตุการจบเกม: ${params.winReason}

เฉลยบทบาทและห้องพักทุกคน:
${rosterSummary}

ประวัติการโหวตแต่ละวัน:
${voteHistorySummary}

เหตุการณ์สำคัญตลอดเกม:
${params.historyLog.slice(-28).join('\n')}

ไฮไลท์แชทในเกม:
${chatHighlights || '(ไม่มีแชท)'}

จงสร้าง "ปฏิกิริยาหลังรู้ความจริง" สดๆ ให้ครบทุก botId ด้านล่างนี้ (คนละ 1-3 ประโยคสั้นๆ แซ่บๆ แบบเพื่อนซี้วงเหล้า กู-มึง ตรงตามเพศและนิสัยของแต่ละตัว โดยอ้างอิงเหตุการณ์จริง ชื่อคนจริง หมายเลขห้อง หรือการโหวตที่เพิ่งเกิดขึ้นในเกมนี้ ห้ามซ้ำกัน ห้ามมีคำว่า ครับ/ค่ะ เด็ดขาด!):
${botProfilesSummary}

ตอบกลับเป็น JSON Object รูปแบบนี้เท่านั้น:
{
  "reactions": [
    { "botId": "...", "thought": "..." }
  ]
}`;

  try {
    const { text, provider } = await generateWithMultiProvider(
      'groq',
      CORE_PERSONA_INSTRUCTION + '\nตอบกลับเป็น JSON เท่านั้น ต้องมีครบทุก botId ที่ระบุ',
      prompt,
      true,
      1400
    );

    const parsed = extractJsonObject(text);
    const rawList = Array.isArray(parsed?.reactions)
      ? (parsed.reactions as Array<{ botId?: string; thought?: string }>)
      : [];

    const thoughtsById = new Map<string, { thought: string; provider: ProviderChoice }>();
    for (const item of rawList) {
      const id = typeof item?.botId === 'string' ? item.botId.trim() : '';
      const cleaned = typeof item?.thought === 'string' ? sanitizeThaiColloquial(item.thought) : '';
      if (id && cleaned) {
        thoughtsById.set(id, { thought: cleaned, provider });
      }
    }

    // If any bot was omitted in the first JSON batch, make one quick follow-up LLM call for just the missing bots
    const missingBots = bots.filter((b) => !thoughtsById.has(b.id));
    if (missingBots.length > 0 && missingBots.length < bots.length) {
      try {
        const retryPrompt = `เกมจบแล้ว (${winnerText} — ${params.winReason})
เฉลยทุกคน:\n${rosterSummary}
สร้างปฏิกิริยาหลังเกมแบบเพื่อนซี้กู-มึง 1-2 ประโยคให้เฉพาะบอทที่ยังขาดอยู่ด้านล่าง ตอบเป็น JSON เท่านั้น:
${missingBots.map((b) => `- botId:"${b.id}" ชื่อ:"${b.name}" (${b.archetype ?? ''}) บทบาท:${ROLE_DEFINITIONS[b.role].nameTh} ห้อง:${b.room ?? '?'}`).join('\n')}
{"reactions":[{"botId":"...","thought":"..."}]}`;
        const retryRes = await generateWithMultiProvider(
          provider === 'groq' ? 'gemini' : 'groq',
          CORE_PERSONA_INSTRUCTION + '\nตอบกลับเป็น JSON เท่านั้น',
          retryPrompt,
          true,
          700
        );
        const retryParsed = extractJsonObject(retryRes.text);
        const retryList = Array.isArray(retryParsed?.reactions)
          ? (retryParsed.reactions as Array<{ botId?: string; thought?: string }>)
          : [];
        for (const item of retryList) {
          const id = typeof item?.botId === 'string' ? item.botId.trim() : '';
          const cleaned =
            typeof item?.thought === 'string' ? sanitizeThaiColloquial(item.thought) : '';
          if (id && cleaned && !thoughtsById.has(id)) {
            thoughtsById.set(id, { thought: cleaned, provider: retryRes.provider });
          }
        }
      } catch {
        // Skip silently if secondary retry fails; never inject hardcoded canned text!
      }
    }

    return bots
      .filter((b) => thoughtsById.has(b.id))
      .map((b) => {
        const entry = thoughtsById.get(b.id)!;
        return {
          botId: b.id,
          botName: b.name,
          role: b.role,
          alive: b.alive,
          thought: entry.thought,
          provider: entry.provider,
        };
      });
  } catch (err) {
    console.warn('[AI] generatePostGameThoughts failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export { getColumnOfRoom, getFloorOfRoom, getRoomsInColumn, getRoomsOnFloor };
