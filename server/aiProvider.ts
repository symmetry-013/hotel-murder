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
  getRoomsForFloorCount,
  getRoomsInColumn,
  getRoomsOnFloor,
  HOTEL_COLUMNS,
  ROLE_DEFINITIONS,
} from '../src/shared/gameTypes.ts';

export type ProviderChoice = 'groq' | 'gemini' | 'bank';

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
  code: string;
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
    archetype: 'ชาย 1 · สายบวกหัวร้อน',
    persona: 'ใจร้อน ชอบเปิดก่อน ใครพูดไม่เข้าหูโหวตทันที โผงผาง กู-มึง ไอ้สัส',
    speechStyle: 'โผงผาง ท้าชนทันที กู-มึง ไอ้สัส เปิดเลยดิ',
    avatarColor: '#B84A39',
  },
  {
    code: 'M2',
    gender: 'M',
    archetype: 'ชาย 2 · สายเนิร์ดวิเคราะห์',
    persona: 'ชอบจดสถิติ คำนวณความน่าจะเป็น มีเหตุผลแต่แอบกวนตีนหน้านิ่ง',
    speechStyle: 'ไล่เลขชั้น ไล่สถิติ ตัดช้อยส์เป็นตรรกะ แซะเพื่อนกวนตีน',
    avatarColor: '#4A6FA5',
  },
  {
    code: 'M3',
    gender: 'M',
    archetype: 'ชาย 3 · สายปั่นกวนประสาท',
    persona: 'พูดจาคลุมเครือ บลัฟเก่ง โยนระเบิดให้คนอื่นระแวงกันเอง',
    speechStyle: 'พูดกำกวม ยุให้เพื่อนตีกันเอง เหลี่ยมจัด',
    avatarColor: '#B8863B',
  },
  {
    code: 'M4',
    gender: 'M',
    archetype: 'ชาย 4 · สายนิ่งขรึมสังเกตการณ์',
    persona: 'พูดน้อยต่อยหนัก สังเกตพิรุธแล้วสรุปจี้จุดตายประโยคเดียวจบ',
    speechStyle: 'สั้น นิ่ง เฉียบ คม จี้จุดที่คนอื่นหลุด',
    avatarColor: '#5B6D7A',
  },
  {
    code: 'F1',
    gender: 'F',
    archetype: 'หญิง 1 · สายแซ่บปากแจ๋ว',
    persona: 'ปากไว ด่าเจ็บ จับพิรุธเก่ง ใครตอแหลโดนจี้จนไปไม่เป็น',
    speechStyle: 'ปากไว ฟาดไม่ยั้ง ตัวแม่วงเหล้า อี.../ไอ้... ตอแหล',
    avatarColor: '#A63A5B',
  },
  {
    code: 'F2',
    gender: 'F',
    archetype: 'หญิง 2 · สายแอ๊บใสขี้ระแวง',
    persona: 'ทำตัวขี้กลัวตกใจง่าย ชอบถามเช็กทุกคน แต่แอบเก็บข้อมูลเก่ง',
    speechStyle: 'ตื่นตูม ถามจี้ทีละคนว่าอยู่ชั้นไหน แอ๊บใสแต่ระแวงจัด',
    avatarColor: '#7A5C99',
  },
  {
    code: 'F3',
    gender: 'F',
    archetype: 'หญิง 3 · สายลุยเจ้าแผนการ',
    persona: 'ชอบเป็นผู้นำ สั่งให้คนอื่นเปิดข้อมูลและคุมจังหวะโหวต',
    speechStyle: 'เด็ดขาด คุมเกม สั่งให้เปิดเบาะแสแล้วนัดโหวต',
    avatarColor: '#3D828A',
  },
  {
    code: 'F4',
    gender: 'F',
    archetype: 'หญิง 4 · สายติสท์เดาใจยาก',
    persona: 'พูดจาแปลกๆ เหมือนเมาตลอดเวลา เดาไม่ออกว่าเป็นคนเมาหรือคนดี',
    speechStyle: 'พูดเพี้ยนๆ ล่องลอย ชวนสับสนจนคนอื่นเดาทางไม่ถูก',
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

/**
 * 8-Persona Hybrid Bank:
 * 1) Used on Day 1 (0 Token!) to save API quota for Day 2-4
 * 2) Used as instant Auto-Fallback if BOTH Groq & Gemini hit 429 / 8s timeout so the queue NEVER hangs
 */
const PERSONA_DAY1_BANK: Record<string, string[]> = {
  M1: [
    'เฮ้ยวันแรกยังไม่มีเหี้ยไรเลย เงียบทำซากไรกันวะ เปิดห้องสุ่มตัดช้อยส์เลยดิ!',
    'ไอ้สัส ใครเงียบสุดในห้องนี้น่าสงสัยชิบหาย วันแรกจิ้มห้องวัดดวงไปเลยมั้ย!',
    'แม่งเข้าโรงแรมมาเจอศพตั้ง 3 ห้อง กูไม่รอนานนะเว้ย ใครเหลี่ยมเดี๋ยวกูเปิดก่อน!',
    'เอ้าคุยกันหน่อยดิวะ นั่งจ้องจอกันเงียบกริบ เดี๋ยวกูสุ่มจิ้มห้องแม่งเลย!',
    'วันแรกยังปิดชั้นไม่ได้ กูขอจิ้มห้องตัดช้อยส์ก่อน ใครล่กเตรียมตัวโดน!',
    'เห้ย อย่ามัวแต่นั่งแอ๊บกันดิวะ เดี๋ยวคืนนี้มีคนนอนจมกองเลือดแน่ไอ้สัส!',
  ],
  M2: [
    'วันแรกยังไม่มีเบาะแสสกิล โอกาสเปิดห้องเจอฆาตกรตรงๆ ยังต่ำอยู่ แต่มันช่วยตัดห้องว่างให้แม่บ้านกับช่างเช็ดกระจกคืนนี้ได้นะ',
    'ตามสถิติแล้ววันแรกคนเงียบมักมีพิรุธ ลองเช็กดูดิว่าห้องศพตั้งต้น 3 ห้องมันกระจุกอยู่ชั้นไหนบ้าง',
    'อย่าเพิ่งโหวตมั่วดิวะ วันแรกเก็บข้อมูลพฤติกรรมก่อน คืนนี้รอแม่บ้านกับนักสืบทำงานค่อยปิดชั้นพรุ่งนี้',
    'กูจดเลขห้องว่างตั้งต้นไว้หมดละ วันนี้เปิดตัดช้อยส์สักห้องนึงก็ลดความน่าจะเป็นไปได้เยอะเลยนะมึง',
    'ใครเริ่มโวยวายตั้งแต่วันแรกนี่เปอร์เซ็นต์เป็นคนเมากับฆาตกรสูงพอๆ กันเลยนะ กูเตือนไว้ก่อน',
    'คิดเป็นตรรกะหน่อยพวกมึง วันแรกเปิดห้องสุ่มไปก่อน หรือถ้าไม่มั่นใจก็คุยดูทรงคนล่กก่อนกดพร้อม',
  ],
  M3: [
    'ฮั่นแน่ วันแรกทำเป็นนิ่งกันหมดเลยนะ ระวังคืนนี้ฆาตกรมันแอบยิ้มอยู่ข้างห้องมึงอ่ะดิ ฮ่าๆ',
    'เอ๊ะ ทำไมกูรู้สึกว่าแถวนี้มีคนแอบล่กตั้งแต่วันแรกวะ ใครเป็นฆาตกรยกมือดิ กูไม่โหวตหรอกเชื่อกู',
    'วันแรกยังปิดชั้นไม่ได้ งั้นมาวัดดวงเปิดห้องกันสนุกๆ มั้ย เผื่อแจ็กพอตโดนคนเมาวงแตกตั้งแต่ไก่โห่!',
    'พวกมึงอย่าไว้ใจกันเองมากนะ บางทีคนที่ทำตัวเป็นผู้นำวันแรกนั่นแหละตัวตึงฝั่งฆาตกร!',
    'กูว่าห้องแถวกลางๆ แม่งดูมีพลังงานบางอย่างว่ะ หรือใครอยู่แถวกลางลองสะดุ้งให้ดูหน่อยดิ',
    'แหม เงียบกันจังเลยนะ หรือกำลังแอบมองตาคู่หูกันอยู่วะพวกมึง ฮ่าๆ',
  ],
  M4: [
    'วันแรกยังไม่มีข้อมูล กูขอดูทรงคนพูดก่อน ใครพูดเยอะผิดปกติระวังโดนเพ่งเล็ง',
    'ศพตั้งต้นเปิดไป 3 ห้องแล้ว วันนี้เปิดตัดช้อยส์เพิ่มอีกห้องก็พอ ค่อยไปเอาจริงพรุ่งนี้',
    'เงียบไว้ก่อนดีกว่าพูดมั่ว รอดูว่าใครจะรีบชงให้เปิดห้องไหนตั้งแต่วันแรก',
    'คืนนี้สายสืบอย่าพลาดก็พอ วันแรกใครล่กเกินเหตุ กูจำชื่อไว้หมดแล้วนะ',
    'เปิดห้องสุ่มตัดช้อยส์ไปก่อน ยังไงวันแรกก็ปิดชั้นไม่ได้อยู่แล้ว ไม่ต้องรีบตีกันเอง',
    'สังเกตดีๆ คนที่รีบเปลี่ยนเรื่องตั้งแต่วันแรก มักจะมีอะไรปิดบังอยู่เสมอแหละ',
  ],
  F1: [
    'อีพวกนี้เงียบอะไรกันยะ เข้าโรงแรมมาศพโผล่ตั้ง 3 ห้องแล้ว ยังจะมานั่งอมพะนำกันอยู่อีก!',
    'แหม ทำเป็นเนียนกันหมดเลยนะพวกมึง ใครเป็นฆาตกรอย่าให้กูจับโป๊ะได้นะ กูฟาดยับแน่!',
    'วันแรกยังปิดชั้นไม่ได้ก็จริง แต่ถ้าใครพูดจาตอแหลตั้งแต่ตอนนี้ กูจี้ไม่ปล่อยแน่บอกเลย!',
    'เอ้า ไหนใครมีพิรุธรีบคายมาซะดีๆ นั่งเงียบกันงี้ดูออกนะว่ามีคนแอบเหลี่ยมอยู่!',
    'เปิดห้องตัดช้อยส์ไปสักห้องเถอะพวกมึง มานั่งจ้องตากันแบบนี้เดี๋ยวคืนนี้ก็ตายฟรีกันหมด!',
    'ใครทำตัวแอ๊บใสตั้งแต่วันแรกนี่ตัวดีเลยนะ กูจับตามองทุกคนอยู่ อย่ามาเหลี่ยมใส่กู!',
  ],
  F2: [
    'เฮ้ยพวกมึง กูกลัวอ่ะ ศพโผล่ตั้ง 3 ห้องตั้งแต่ยังไม่ทันนอนเลย คืนนี้ช่างกุญแจล็อกดีๆ นะเว้ย!',
    'เดี๋ยวนะ ทำไมทุกคนเงียบกันหมดเลยอ่ะ กูระแวงไปหมดแล้วนะเนี่ย มีใครอยู่ชั้นเดียวกับศพมั้ยอ่ะ?',
    'วันแรกยังไม่มีเบาะแสเลยอ่ะ แล้วพวกเราจะรู้ได้ไงว่าใครเป็นฆาตกร กูเสียวสันหลังวาบเลยมึง!',
    'เอ่อ วันนี้เราเปิดห้องไหนดีอ่ะ กูกลัวเปิดไปโดนห้องคนดีหรือโดนคนเมาจังเลยพวกมึง!',
    'ใครก็ได้พูดอะไรหน่อยสิ เงียบแบบนี้กูยิ่งระแวงนะเว้ย รู้สึกเหมือนฆาตกรกำลังจ้องอยู่เลยอ่ะ!',
    'คืนนี้พยานกับนักสืบอย่าเพิ่งรีบตายนะเว้ย กูฝากความหวังไว้กับพวกมึงแล้วนะ อย่าทิ้งกู!',
  ],
  F3: [
    'โอเคฟังกูนะ วันแรกยังไม่มีเบาะแสสกิล เราโหวตเปิดห้องตัดช้อยส์ไปก่อน 1 ห้อง แล้วคืนนี้สายสืบทุกคนรีบเก็บข้อมูล!',
    'ทุกคนอย่าเพิ่งแตกแถว วันนี้เปิดห้องว่างตัดพื้นที่ให้แม่บ้านกับช่างเช็ดกระจกทำงานง่ายขึ้น พรุ่งนี้ปลดปิดชั้นค่อยลุยจริง!',
    'ใครเป็นคนดีตั้งสติดีๆ วันแรกอย่าเพิ่งหลุดบอกห้องตัวเองเด็ดขาด เดี๋ยวฆาตกรเก็บคืนแรก!',
    'ตามแผนนะพวกมึง วันนี้กดพร้อมแล้วโหวตเปิดห้องตัดช้อยส์ ใครมีเบาะแสคืนนี้ พรุ่งนี้เช้าคายมาให้หมด!',
    'อย่ามัวแต่เถียงกันไร้สาระวันแรก รีบเคลียร์รอบแรกแล้วไปเอาข้อมูลกลางคืนมาชนกันพรุ่งนี้ดีกว่า!',
    'จำไว้นะวันแรกโหวตได้แค่รายห้อง อย่าไปเผลอหลุดชั้นตัวเองให้ฝ่ายฆาตกรรู้เด็ดขาด กดพร้อมกันเลยมั้ย?',
  ],
  F4: [
    'เอ๊ะ โรงแรมนี้แอร์เย็นแปลกๆ นะ หรือว่าผีในห้องศพมันเดินผ่านหน้าห้องกูวะ ฮิๆ',
    'วันแรกกูยังงงอยู่เลยว่าห้องกูอยู่ฝั่งไหน แต่ถ้าพวกมึงอยากเปิดห้องไหนก็จิ้มไปเถอะ กูชิลๆ',
    'กูว่าคืนนี้ต้องมีคนฝันร้ายแน่เลยอ่ะ ลองเปิดห้องเลขสวยๆ ดูมั้ย เผื่อเจออะไรสนุกๆ',
    'พวกมึงซีเรียสกันจังเลยอ่ะ กูนั่งจิบน้ำเงียบๆ ดูพวกมึงระแวงกันเองโคตรเพลินเลยรู้ปะ',
    'บางทีฆาตกรอาจจะไม่ได้อยู่ชั้นสูงก็ได้นะ หรืออาจจะอยู่ใต้เตียงพวกมึงตอนนี้ก็ได้ ใครจะไปรู้~',
    'วันแรกกูขอลอยตัวเหนือดราม่าแป๊บ ใครอยากเปิดห้องไหนก็ว่ามา เดี๋ยวกูตามน้ำเองมั้งนะ',
  ],
};

const PERSONA_EMERGENCY_FALLBACK_BANK: Record<string, string[]> = {
  M1: [
    'ไอ้สัส คุยกันวนไปวนมาอยู่ได้ ใครมีเบาะแสจริงรีบคายมาดิ เดี๋ยวกูเปิดโหวตก่อนเลย!',
    'กูเริ่มหมดความอดทนละนะ ใครเงียบหรือพูดวกไปวนมากูสงสัยแม่งหมดอ่ะ!',
  ],
  M2: [
    'ลองเอาเลขห้องที่เปิดไปแล้วมาเทียบกับเบาะแสในแชทดูดิ อย่าโหวตตามอารมณ์กันนะมึง',
    'ข้อมูลเริ่มแคบลงแล้ว ตัดชั้นกับห้องที่เปิดไปแล้วออก จะเห็นชัดขึ้นว่าควรเล็งตรงไหน',
  ],
  M3: [
    'แหม พูดกันมั่นใจจังเลยนะ ระวังโดนหลอกให้โหวตปิดตายพวกเดียวกันเองนะมึง ฮ่าๆ',
    'กูดูทรงละรอบนี้มีคนกำลังปั่นเนียนๆ อยู่แน่นอน พวกมึงระวังโดนเหลี่ยมนะเว้ย!',
  ],
  M4: [
    'จับสังเกตคำพูดเมื่อกี้ให้ดี มีคนกำลังเบี่ยงประเด็นอยู่ชัดๆ กูรอดูตอนโหวตเลย',
    'ไม่ต้องพูดเยอะ ใครมีเบาะแสจริงก็โยนมาเลย จะได้จบๆ ไม่เสียเวลา',
  ],
  F1: [
    'โอ๊ย เลิกตอแหลกันได้แล้วพวกมึง ใครรู้ชั้นไหนแถวไหนก็พูดมาตรงๆ สิยะ!',
    'ทำไมบางคนดูล่กแปลกๆ วะ พูดมาให้เคลียร์เลยนะ อย่ามาเหลี่ยมใส่กู!',
  ],
  F2: [
    'เฮ้ย กูยิ่งฟังยิ่งงงแล้วนะเนี่ย สรุปใครพูดจริงใครโกหกอ่ะ กูระแวงไปหมดแล้ว!',
    'เดี๋ยวนะพวกมึง เอาให้ชัวร์ก่อนโหวตนะ กูกลัวปิดพลาดโดนคนดีหรือโดนคนเมาอ่ะ!',
  ],
  F3: [
    'ตั้งสติแล้วรวมเสียงกันหน่อย ใครได้เบาะแสเมื่อคืนรีบสรุปมา เราจะได้โหวตไปทางเดียวกัน!',
    'อย่าเสียงแตกนะพวกมึง เลือกเป้าที่ชัวร์ที่สุดแล้วกดพร้อมโหวตเลย!',
  ],
  F4: [
    'เอ๊ะ หรือว่าพวกเรากำลังโดนใครสักคนจูงจมูกอยู่กันแน่นะ กูว่ากลิ่นมันแปลกๆ ว่ะ',
    'เอาที่พวกมึงสบายใจเลยจ้า แต่ระวังหวยไปออกห้องที่คาดไม่ถึงละกันนะ~',
  ],
};

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
    code: template.code,
    name: pickFreshName(template.gender, idx),
    gender: template.gender,
    archetype: template.archetype,
    persona: template.persona,
    speechStyle: template.speechStyle,
    preferredProvider: 'groq',
    avatarColor: template.avatarColor,
  }));
}

// Ultra-compact System Prompt (~110 tokens) to keep total request ~500 tokens!
const COMPACT_CHAT_SYSTEM_PROMPT = `มึงกำลังเล่นบอร์ดเกม "HOTEL MURDER" กับเพื่อนซี้วงเหล้า
กฎเหล็ก:
- ห้ามเดาหรืออ้างบทบาทคนตาย (คนตายไม่เฉลยบทบาทจนจบเกม)
- กฎโหวต: วัน1เปิดได้แค่รายห้อง | วัน2ปลดปิดชั้นแนวนอน | วัน3-4ปลดปิดแถวแนวตั้ง
- ฝ่ายคนดีเอาเบาะแสจริงวิเคราะห์จับฆาตกร | ฝ่ายฆาตกรโกหกเบี่ยงประเด็น | คนเมาปั่นเนียนๆ ล่อให้โดนโหวต
- พูดภาษาเพื่อนซี้ห้วนๆ กู-มึง ไอ้/อี แซวแรงๆ ตามนิสัย ห้ามพูดครับ/ค่ะ/ผม/คุณ
- ตอบสั้นกระชับไม่เกิน 1-2 ประโยค ห้ามใส่ชื่อตัวเองนำหน้า ห้ามใส่เครื่องหมายคำพูด`;

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
    .replace(/^(ชื่อ|บอท|ตอบ|ข้อความ)\s*[:：]\s*/i, '')
    .replace(/\s+/g, ' ');

  text = text
    .replace(/(นะครับ|นะคะ|นะคับ|นะค่ะ|ครับผม|ครับ|ค่ะ)\b/g, 'ว่ะ')
    .replace(/\bคุณ\b/g, 'มึง')
    .replace(/\bผม\b/g, 'กู')
    .replace(/\bดิฉัน\b/g, 'กู');

  if (text.length > 175) {
    text = text.slice(0, 172).trim() + '...';
  }
  return text;
}

/**
 * Calls GROQ_MODEL with configurable timeout (default 8,000ms for chat) and max_tokens.
 * Immediately throws on timeout or HTTP 429 so caller fails over to GEMINI_MODEL_PRIMARY.
 */
async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  expectJson = false,
  maxTokens = expectJson ? 320 : 100,
  timeoutMs = 8000
): Promise<string> {
  const cfg = getGroqConfig();
  if (!cfg) throw new Error('GROQ_NOT_CONFIGURED');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: expectJson ? 0.55 : 0.9,
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
      throw new Error(`GROQ_HTTP_${res.status}: ${errText.slice(0, 120)}`);
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
  expectJson = false,
  timeoutMs = 8500
): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) throw new Error('GEMINI_NOT_CONFIGURED');

  const configuredPrimary = process.env.GEMINI_MODEL_PRIMARY?.trim();
  const baseCandidates = Array.from(
    new Set(
      [configuredPrimary, 'gemini-4-hydrogen', 'gemini-3.1-flash-lite'].filter(
        (m): m is string => Boolean(m)
      )
    )
  );
  const candidateModels = resolvedGeminiModel
    ? Array.from(new Set([resolvedGeminiModel, ...baseCandidates]))
    : baseCandidates;

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

      const timeoutPromise = new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error(`GEMINI_TIMEOUT_${timeoutMs}MS`)), timeoutMs)
      );

      const response = await Promise.race([
        ai.models.generateContent({
          model: modelName,
          contents: userPrompt,
          config,
        }),
        timeoutPromise,
      ]);

      const text = response.text?.trim();
      if (!text) throw new Error('GEMINI_EMPTY_RESPONSE');
      resolvedGeminiModel = modelName;
      return text;
    } catch (err) {
      lastError = err;
      if (resolvedGeminiModel === modelName) {
        resolvedGeminiModel = null;
      }
      const msg = err instanceof Error ? err.message : String(err);
      const isModelRecoverable =
        msg.includes('404') ||
        msg.includes('NOT_FOUND') ||
        msg.includes('not found') ||
        msg.includes('400') ||
        msg.includes('INVALID_ARGUMENT') ||
        msg.includes('not supported') ||
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('GEMINI_EMPTY_RESPONSE') ||
        msg.includes('GEMINI_TIMEOUT');
      if (isModelRecoverable) {
        console.warn(`[AI] Gemini model "${modelName}" failed (${msg.slice(0, 120)}), trying next candidate...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('GEMINI_FAILED');
}

/**
 * Auto-Fallback LLM Runner:
 * 1) Tries GROQ_MODEL first (strict timeout; immediate failover on 429 or timeout)
 * 2) Automatically switches to GEMINI_MODEL_PRIMARY (and active fallbacks) if Groq fails / times out / hits 429
 * 3) Throws descriptive error if BOTH fail
 */
async function callAIWithAutoFallback(
  systemPrompt: string,
  userPrompt: string,
  expectJson = false,
  maxTokens = expectJson ? 320 : 100,
  timeoutMs = 8000
): Promise<{ text: string; provider: 'groq' | 'gemini' }> {
  const hasGroq = Boolean(getGroqConfig());
  const hasGemini = Boolean(getGeminiClient());
  const errors: string[] = [];

  if (hasGroq) {
    try {
      const text = await callGroq(systemPrompt, userPrompt, expectJson, maxTokens, timeoutMs);
      return { text, provider: 'groq' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Groq: ${msg}`);
      console.warn(`[AI] Groq failed/429/timeout, switching to Gemini:`, msg);
    }
  }

  if (hasGemini) {
    try {
      const text = await callGemini(
        systemPrompt,
        userPrompt,
        expectJson,
        Math.max(timeoutMs + 1000, 8500)
      );
      return { text, provider: 'gemini' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Gemini: ${msg}`);
      console.warn(`[AI] Gemini fallback failed:`, msg);
    }
  }

  if (!hasGroq && !hasGemini) {
    throw new Error('ยังไม่ได้ตั้งค่า GROQ_API_KEY หรือ GEMINI_API_KEY บนเซิร์ฟเวอร์');
  }
  throw new Error(errors.join(' | ') || 'ALL_AI_PROVIDERS_UNAVAILABLE');
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
  usedBankLines?: Set<string>;
}

/**
 * Picks a non-repeating persona-accurate Thai line from the 8-persona bank
 * (used on Day 1 for 0 Token quota savings, or as emergency fallback if BOTH Groq & Gemini hit rate limits).
 */
export function pickPersonaBankLine(
  input: Pick<BotChatInput, 'bot' | 'role' | 'myRoom' | 'myFloor' | 'day' | 'usedBankLines'>,
  mode: 'DAY1' | 'FALLBACK'
): string {
  const code = input.bot.code || 'M1';
  const bank = mode === 'DAY1' ? PERSONA_DAY1_BANK : PERSONA_EMERGENCY_FALLBACK_BANK;
  const pool = bank[code] ?? bank.M1;
  const used = input.usedBankLines;

  // Subtle Drunk flavor on Day 1 without exposing role directly
  if (mode === 'DAY1' && input.role === 'DRUNK' && Math.random() < 0.45) {
    const drunkLine = `เฮ้ย วันแรกอย่าเพิ่งมายุ่งกับชั้น ${input.myFloor} นะเว้ย กูแค่แขกธรรมดา อย่าเผลอมาเปิดห้อง ${input.myRoom} ล่ะ!`;
    if (!used || !used.has(drunkLine)) {
      used?.add(drunkLine);
      return drunkLine;
    }
  }

  const unused = used ? pool.filter((line) => !used.has(line)) : pool;
  const candidates = unused.length > 0 ? unused : pool;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  used?.add(picked);
  return picked;
}

/**
 * Ultra-Compact Bot Chat (~500 Tokens/request):
 * - Day 1: 0-Token Hybrid Bank (saves quota strictly for Day 2–4)
 * - Day 2–4: 1-line table status + 1-2 line bot profile/clues + last 8–10 chat messages + max_tokens: 100
 * - Auto-Fallback: Groq (8s timeout / 429) -> Gemini Primary -> 8-Persona Bank (never hangs!)
 */
export async function generateBotChat(
  input: BotChatInput
): Promise<{ text: string; provider: ProviderChoice }> {
  // HYBRID MODE: Day 1 has no night skill clues yet -> 0 Token persona bank!
  if (input.day <= 1) {
    return {
      text: pickPersonaBankLine(input, 'DAY1'),
      provider: 'bank',
    };
  }

  const roleDef = ROLE_DEFINITIONS[input.role];

  // 1-Line Compact Table Status (STRICTLY NO DEAD ROLES!)
  const aliveNames = input.players
    .filter((p) => p.alive)
    .map((p) => p.name)
    .join(',');
  const deadRoomsOnly =
    input.players
      .filter((p) => !p.alive)
      .map((p) => `${p.name}(ห้อง${p.deathRoom ?? '?'})`)
      .join(',') || 'ไม่มี';
  const lockedParts: string[] = [];
  if (input.lockedFloors.length > 0) lockedParts.push(`ชั้น${input.lockedFloors.join(',')}`);
  if (input.lockedColumns.length > 0) lockedParts.push(`แถว${input.lockedColumns.join(',')}`);
  const openEmptyRooms = input.revealedRooms
    .filter((r) => r.kind === 'INITIAL_CRIME' || r.kind === 'EMPTY_LYNCHED')
    .map((r) => r.room);
  if (openEmptyRooms.length > 0) lockedParts.push(`ว่าง:${openEmptyRooms.join(',')}`);
  const lockedAreas = lockedParts.join(';') || 'ไม่มี';

  const tableLine = `วัน:${input.day}/${input.maxDays}(โรงแรม${input.totalFloors}ชั้น) | รอด:${aliveNames} | ตาย:${deadRoomsOnly} | ปิด:${lockedAreas}`;

  // 1-2 Line Compact Bot Personal Info + Private Clues
  const evilPartnerStr =
    input.evilPartners.length > 0
      ? `| คู่หู:${input.evilPartners.map((p) => `${p.name}(${ROLE_DEFINITIONS[p.role].nameTh}${p.room ? ` ห้อง${p.room}` : ''})`).join(',')}`
      : '';
  const botInfoLine = `มึง:${input.bot.name}(${input.bot.gender === 'M' ? 'ช' : 'ญ'},${input.bot.archetype}) | บท:${roleDef.nameTh} ห้อง${input.myRoom}(ชั้น${input.myFloor}/แถว${input.myColumn}) ${evilPartnerStr} | นิสัย:${input.bot.persona}`;

  const cluesCompact =
    input.privateClues
      .slice(-4)
      .map((c) => `ค${c.night}:${c.title}(${c.detail})`)
      .join(' ; ') || 'ไม่มี';

  // Trim chat strictly to last 8–10 messages ONLY!
  const recentChatLines = input.recentChat
    .slice(-10)
    .map((m) => (m.isSystem ? `[ระบบ]${m.text}` : `${m.senderName}:${m.text}`))
    .join('\n');

  const directive =
    input.triggerReason === 'HUMAN_REPLY' && input.lastHumanMessage
      ? `ตอบโต้ "${input.lastHumanMessage.senderName}" ที่เพิ่งพิมพ์ว่า "${input.lastHumanMessage.text}"`
      : input.triggerReason === 'PRE_READY'
        ? 'สรุปเป้าหมายโหวตสั้นๆ ก่อนกดพร้อม'
        : 'วิเคราะห์เบาะแส/แซะเพื่อนในแชทสั้นๆ';

  const userPrompt = [
    tableLine,
    botInfoLine,
    `เบาะแสส่วนตัว:${cluesCompact}`,
    recentChatLines ? `แชทล่าสุด:\n${recentChatLines}` : 'แชทล่าสุด:(ว่าง)',
    `คำสั่ง:${directive} (ตอบ 1-2 ประโยคสั้นๆ กู-มึง ห้ามซ้ำแชทเดิม):`,
  ].join('\n');

  try {
    const { text, provider } = await callAIWithAutoFallback(
      COMPACT_CHAT_SYSTEM_PROMPT,
      userPrompt,
      false,
      100
    );
    const cleaned = sanitizeThaiColloquial(text);
    if (!cleaned) {
      return { text: pickPersonaBankLine(input, 'FALLBACK'), provider: 'bank' };
    }
    return { text: cleaned, provider };
  } catch {
    return { text: pickPersonaBankLine(input, 'FALLBACK'), provider: 'bank' };
  }
}

/**
 * Dynamic Secret Underground Night Chat Reply between Evil Bot and Human Evil Partner
 */
export async function generateBotSecretReply(params: {
  bot: BotProfile;
  role: 'MURDERER' | 'ACCOMPLICE';
  myRoom: HotelRoomNumber;
  partnerName: string;
  partnerRoom?: HotelRoomNumber | null;
  partnerMessage: string;
  day: number;
  totalFloors: number;
  unrevealedRooms: HotelRoomNumber[];
  secretChat: SecretChatMessage[];
  privateClues: PrivateClueLog[];
}): Promise<string | null> {
  const roleLabel = params.role === 'MURDERER' ? 'ฆาตกร' : 'ผู้ช่วยฆาตกร';
  const partnerRoleLabel = params.role === 'MURDERER' ? 'ผู้ช่วยฆาตกร' : 'ฆาตกร';
  const secretHistory = params.secretChat
    .slice(-6)
    .map((m) => `${m.senderName}:${m.text}`)
    .join('\n');
  const clues =
    params.privateClues
      .slice(-3)
      .map((c) => `ค${c.night}:${c.detail}`)
      .join(' ; ') || 'ไม่มี';

  const prompt = `มึง:${params.bot.name}(${roleLabel},ห้อง${params.myRoom},${params.bot.archetype}) | คู่หู:${params.partnerName}(${partnerRoleLabel},ห้อง${params.partnerRoom ?? '?'}) คืน${params.day}/${params.totalFloors}ชั้น
ห้องเปิดได้:[${params.unrevealedRooms.join(',')}] | เบาะแส:${clues}
แชทลับ:\n${secretHistory}
ตอบ "${params.partnerName}" สั้นๆ 1-2 ประโยคกู-มึงเพื่อวางแผนคืนนี้:`;

  try {
    const { text } = await callAIWithAutoFallback(COMPACT_CHAT_SYSTEM_PROMPT, prompt, false, 100);
    const cleaned = sanitizeThaiColloquial(text);
    return cleaned || null;
  } catch {
    return null;
  }
}

/**
 * AI Accomplice sends Secret Underground Whisper & Target Room/Floor Ping to Murderer at Night.
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
      .slice(-8)
      .map((m) => (m.isSystem ? `[ระบบ]${m.text}` : `${m.senderName}:${m.text}`))
      .join('\n');
    const cluesText = params.privateClues
      .slice(-3)
      .map((c) => c.detail)
      .join(' ; ');

    const prompt = `มึง:${params.bot.name}(ผู้ช่วยฆาตกร,ห้อง${params.myRoom}) คุยลับคืน${params.day}กับฆาตกร:${params.murdererName}(ห้อง${params.murdererRoom ?? '?'})
ห้องชี้เป้าได้:[${candidates.join(',')}] | เบาะแส:${cluesText || 'ไม่มี'}
แชทล่าสุด:\n${chatSnippet || '(ว่าง)'}
เลือก 1 ห้องและกระซิบสั้นๆ กู-มึง ตอบ JSON เท่านั้น: {"room":${mechanicalPickRoom},"whisper":"..."}`;

    const { text } = await callAIWithAutoFallback(
      COMPACT_CHAT_SYSTEM_PROMPT + '\nตอบ JSON เท่านั้น',
      prompt,
      true,
      140
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
  } catch {
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
  evilPartnerRooms?: HotelRoomNumber[];
  alreadyCheckedIds: string[];
  lastKeymasterLockedRoom: HotelRoomNumber | null;
  recentChat: ChatMessage[];
  secretChat: SecretChatMessage[];
  secretPing: SecretTargetPing | null;
  privateClues: PrivateClueLog[];
}): Promise<HotelRoomNumber | HotelFloorNumber | HotelColumnNumber | string | null> {
  const alivePlayers = params.players.filter((p) => p.alive);
  const activeFloors = getFloorsForCount(params.totalFloors);
  const partnerRooms = params.evilPartnerRooms ?? [];

  const legalMoveSafeguard = ():
    | HotelRoomNumber
    | HotelFloorNumber
    | HotelColumnNumber
    | string
    | null => {
    if (params.role === 'MURDERER') {
      const safePool = params.unrevealedRooms.filter(
        (r) => r !== params.myRoom && !partnerRooms.includes(r)
      );
      const pool =
        safePool.length > 0
          ? safePool
          : params.unrevealedRooms.filter((r) => r !== params.myRoom);
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
    const aliveSummary = alivePlayers.map((p) => `${p.id}:${p.name}`).join(', ');
    const chatSnippet = params.recentChat
      .slice(-8)
      .map((m) => (m.isSystem ? `[ระบบ]${m.text}` : `${m.senderName}:${m.text}`))
      .join('\n');
    const cluesText = params.privateClues
      .slice(-3)
      .map((c) => c.detail)
      .join(' ; ');

    let prompt = '';
    const header = `มึง:${params.bot.name}(${ROLE_DEFINITIONS[params.role].nameTh},ห้อง${params.myRoom}) คืน${params.day}/${params.totalFloors}ชั้น | เบาะแส:${cluesText || 'ไม่มี'}\nแชทล่าสุด:\n${chatSnippet || '(ว่าง)'}`;

    if (params.role === 'MURDERER') {
      const pingHint = params.secretPing?.room
        ? `ซิกผู้ช่วย:ห้อง${params.secretPing.room}`
        : params.secretPing?.floor
          ? `ซิกผู้ช่วย:ชั้น${params.secretPing.floor}`
          : 'ไม่มีซิก';
      const safeKillRooms = params.unrevealedRooms.filter(
        (r) => r !== params.myRoom && !partnerRooms.includes(r)
      );
      const killCandidates =
        safeKillRooms.length > 0
          ? safeKillRooms
          : params.unrevealedRooms.filter((r) => r !== params.myRoom);
      const partnerHint =
        partnerRooms.length > 0 ? ` | ห้องผู้ช่วย(ห้ามฆ่า):[${partnerRooms.join(',')}]` : '';
      prompt = `${header}\n${pingHint}${partnerHint} | ห้องฆ่าได้:[${killCandidates.join(',')}]\nเลือก1ห้องฆ่า JSON เท่านั้น: {"room":${killCandidates[0] ?? 302}}`;
    } else if (params.role === 'KEYMASTER') {
      const validRooms = params.unrevealedRooms.filter((r) => r !== params.lastKeymasterLockedRoom);
      prompt = `${header}\nห้ามซ้ำห้อง:${params.lastKeymasterLockedRoom ?? 'ไม่มี'} | ห้องล็อกได้:[${validRooms.join(',')}]\nเลือก1ห้องล็อก JSON เท่านั้น: {"room":302}`;
    } else if (params.role === 'HOUSEKEEPER') {
      prompt = `${header}\nเลือกตรวจ1ชั้นแนวนอน(1-${params.totalFloors}) JSON เท่านั้น: {"floor":2}`;
    } else if (params.role === 'WITNESS') {
      prompt = `${header}\nเลือกเฝ้า1ชั้น(1-${params.totalFloors}) JSON เท่านั้น: {"floor":2}`;
    } else if (params.role === 'GLAZIER') {
      prompt = `${header}\nเลือกตรวจ1แถวแนวตั้ง(1-3) JSON เท่านั้น: {"column":2}`;
    } else if (params.role === 'DETECTIVE' || params.role === 'ACCOMPLICE') {
      prompt = `${header}\nเคยตรวจ:[${params.alreadyCheckedIds.join(',')}] | รอด(ห้ามเลือก ${params.bot.id}): ${aliveSummary}\nเลือกtargetId 1คน JSON เท่านั้น: {"targetId":"..."}`;
    }

    const { text } = await callAIWithAutoFallback(
      'AI เล่นเกม HOTEL MURDER ตอบ JSON สั้นๆ เท่านั้น',
      prompt,
      true,
      100
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
      if (
        params.role === 'MURDERER' &&
        (roomNum === params.myRoom ||
          (partnerRooms.includes(roomNum) &&
            params.unrevealedRooms.some((r) => r !== params.myRoom && !partnerRooms.includes(r))))
      ) {
        return legalMoveSafeguard();
      }
      return roomNum;
    }
    return legalMoveSafeguard();
  } catch {
    return legalMoveSafeguard();
  }
}

/**
 * PROGRESSIVE 3-MODE DAY VOTE (Compact ~450 tokens, Auto-Fallback safe)
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
  const partnerRooms = isEvil
    ? params.evilPartners
        .map((p) => p.room)
        .filter((r): r is HotelRoomNumber => r !== null && r !== undefined)
    : [];
  const partnerFloors = partnerRooms.map((r) => getFloorOfRoom(r));
  const partnerCols = partnerRooms.map((r) => getColumnOfRoom(r));

  const safeRooms = params.unrevealedRooms.filter((r) => {
    if (params.role === 'DRUNK') return true;
    if (r === params.myRoom) return false;
    if (isEvil && params.murdererRoomIfEvil && r === params.murdererRoomIfEvil) return false;
    if (isEvil && partnerRooms.includes(r)) return false;
    return true;
  });

  const safeFloors = params.votableFloors.filter((f) => {
    if (params.role === 'DRUNK') return true;
    if (f === myFloor) return false;
    if (isEvil && murdererFloor && f === murdererFloor) return false;
    if (isEvil && partnerFloors.includes(f)) return false;
    return true;
  });

  const safeCols = params.votableColumns.filter((c) => {
    if (params.role === 'DRUNK') return true;
    if (c === myColumn) return false;
    if (isEvil && murdererCol && c === murdererCol) return false;
    if (isEvil && partnerCols.includes(c)) return false;
    return true;
  });

  const fallbackRoom =
    safeRooms[Math.floor(Math.random() * Math.max(1, safeRooms.length))] ??
    params.unrevealedRooms[0] ??
    101;

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

  // Day 1 Hybrid Quota Saver: Day 1 has no night skill clues yet -> fast legal room vote (0 Token!)
  if (params.day <= 1) {
    return { choice: legalVoteSafeguard(), comment: null };
  }

  try {
    const aliveNames = params.players
      .filter((p) => p.alive)
      .map((p) => p.name)
      .join(',');
    const deadRoomsOnly =
      params.players
        .filter((p) => !p.alive)
        .map((p) => `${p.name}(ห้อง${p.deathRoom ?? '?'})`)
        .join(',') || 'ไม่มี';
    const chatSnippet = params.recentChat
      .slice(-8)
      .map((m) => (m.isSystem ? `[ระบบ]${m.text}` : `${m.senderName}:${m.text}`))
      .join('\n');
    const cluesText =
      params.privateClues
        .slice(-3)
        .map((c) => `ค${c.night}:${c.detail}`)
        .join(' ; ') || 'ไม่มี';

    const canFloorLock = params.day >= 2 && safeFloors.length > 0;
    const canColLock = params.day >= 3 && safeCols.length > 0;

    let options = `ROOM:[${(safeRooms.length > 0 ? safeRooms : params.unrevealedRooms).join(',')}]`;
    if (canFloorLock) options += ` | FLOOR:[${safeFloors.join(',')}]`;
    if (canColLock) options += ` | COLUMN:[${safeCols.join(',')}]`;
    options += ` | SKIP:0`;

    const evilPartnerInfo =
      isEvil && params.evilPartners.length > 0
        ? ` | คู่หู:${params.evilPartners.map((p) => `${p.name}(${ROLE_DEFINITIONS[p.role].nameTh}${p.room ? ` ห้อง${p.room}` : ''})`).join(',')}`
        : '';

    const prompt = `วัน:${params.day}/${params.maxDays} | รอด:${aliveNames} | ตาย:${deadRoomsOnly}
มึง:${params.bot.name}(${ROLE_DEFINITIONS[params.role].nameTh},ห้อง${params.myRoom},${params.bot.persona})${evilPartnerInfo} | เบาะแส:${cluesText}
ตัวเลือกโหวต: ${options}
แชทล่าสุด:\n${chatSnippet || '(ว่าง)'}
เลือกโหวต1อย่าง+คอมเมนต์สั้น1ประโยค กู-มึง ตอบ JSON เท่านั้น: {"kind":"${canFloorLock ? 'FLOOR' : 'ROOM'}","target":${canFloorLock ? safeFloors[0] : fallbackRoom},"comment":"..."}`;

    const { text } = await callAIWithAutoFallback(
      COMPACT_CHAT_SYSTEM_PROMPT + '\nตอบ JSON เท่านั้น',
      prompt,
      true,
      140
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
      if (safeFloors.includes(f)) return { choice: { kind: 'FLOOR', floor: f }, comment };
    } else if (kind === 'COLUMN' && params.day >= 3) {
      const c = targetNum as HotelColumnNumber;
      if (safeCols.includes(c)) return { choice: { kind: 'COLUMN', column: c }, comment };
    } else if (kind === 'ROOM') {
      const r = targetNum as HotelRoomNumber;
      const roomPool = safeRooms.length > 0 ? safeRooms : params.unrevealedRooms;
      if (roomPool.includes(r)) return { choice: { kind: 'ROOM', room: r }, comment };
    }

    return { choice: legalVoteSafeguard(), comment };
  } catch {
    return { choice: legalVoteSafeguard(), comment: null };
  }
}

type PostGameBotInput = {
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
};

function parsePostGameReactions(
  rawText: string,
  targetBots: PostGameBotInput[]
): Map<string, string> {
  const thoughtsById = new Map<string, string>();
  const cleanedRaw = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let items: Array<Record<string, unknown>> = [];

  // 1. Try standard object or top-level array parse
  try {
    const direct = JSON.parse(cleanedRaw) as unknown;
    if (Array.isArray(direct)) {
      items = direct.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'));
    } else if (direct && typeof direct === 'object') {
      const obj = direct as Record<string, unknown>;
      const arr = obj.reactions ?? obj.thoughts ?? obj.bots ?? obj.results ?? obj.items;
      if (Array.isArray(arr)) {
        items = arr.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'));
      }
    }
  } catch {
    // 2. Try extracting JSON object or array substring
    const parsedObj = extractJsonObject(cleanedRaw);
    if (parsedObj) {
      const arr =
        parsedObj.reactions ??
        parsedObj.thoughts ??
        parsedObj.bots ??
        parsedObj.results ??
        parsedObj.items;
      if (Array.isArray(arr)) {
        items = arr.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'));
      }
    }
    // 3. Truncated JSON recovery: extract every complete {...} item containing a thought/text field
    if (items.length === 0) {
      const objMatches = cleanedRaw.match(/\{[^{}]+\}/g) ?? [];
      for (const m of objMatches) {
        try {
          const parsedItem = JSON.parse(m) as Record<string, unknown>;
          if (parsedItem && typeof parsedItem === 'object') {
            items.push(parsedItem);
          }
        } catch {
          // ignore malformed fragment
        }
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rawThought =
      item.thought ?? item.text ?? item.message ?? item.comment ?? item.reaction ?? '';
    const cleanedThought =
      typeof rawThought === 'string' ? sanitizeThaiColloquial(rawThought) : '';
    if (!cleanedThought) continue;

    let matchedBot: PostGameBotInput | undefined;

    // Match 1: simple 1-based numeric index ("index": 1..N)
    const idxNum = Number(item.index ?? item.num ?? item.no);
    if (Number.isInteger(idxNum) && idxNum >= 1 && idxNum <= targetBots.length) {
      matchedBot = targetBots[idxNum - 1];
    }

    // Match 2: exact botId / id
    if (!matchedBot) {
      const rawId = String(item.botId ?? item.id ?? '').trim();
      if (rawId) {
        matchedBot = targetBots.find((b) => b.id === rawId);
        // Also check if LLM put 1-based index or name inside botId
        if (!matchedBot) {
          const idAsNum = Number(rawId);
          if (Number.isInteger(idAsNum) && idAsNum >= 1 && idAsNum <= targetBots.length) {
            matchedBot = targetBots[idAsNum - 1];
          } else {
            matchedBot = targetBots.find((b) => b.name.toLowerCase() === rawId.toLowerCase());
          }
        }
      }
    }

    // Match 3: botName / name
    if (!matchedBot) {
      const rawName = String(item.name ?? item.botName ?? '').trim().toLowerCase();
      if (rawName) {
        matchedBot = targetBots.find(
          (b) =>
            b.name.toLowerCase() === rawName ||
            rawName.includes(b.name.toLowerCase()) ||
            b.name.toLowerCase().includes(rawName)
        );
      }
    }

    // Match 4: positional fallback if not already matched
    if (!matchedBot && targetBots[i] && !thoughtsById.has(targetBots[i].id)) {
      matchedBot = targetBots[i];
    }

    if (matchedBot && !thoughtsById.has(matchedBot.id)) {
      thoughtsById.set(matchedBot.id, cleanedThought);
    }
  }

  return thoughtsById;
}

/**
 * Post-Game Reactions:
 * - Uses generous 18s timeout & 1,600 max_tokens so 7 Thai bots NEVER truncate mid-JSON
 * - Uses simple numeric index + name matching so LLM responses always map reliably to bots
 * - Automatically retries missing bots in smaller chunks after a short cooldown if transient 429/timeout occurs
 */
export async function generatePostGameThoughts(params: {
  winner: Faction;
  winnerPlayerName: string | null;
  winReason: string;
  players: PostGameBotInput[];
  pastVoteRecords: PastVoteRecord[];
  historyLog: string[];
  recentChat: ChatMessage[];
}): Promise<{ thoughts: BotPostGameThought[]; error: string | null }> {
  const bots = params.players.filter((p) => p.isBot);
  if (bots.length === 0) return { thoughts: [], error: null };

  const rosterSummary = params.players
    .map(
      (p) =>
        `${p.name}|ห้อง${p.room ?? '?'}|${ROLE_DEFINITIONS[p.role].nameTh}|${p.alive ? 'รอด' : 'ตาย'}`
    )
    .join('\n');

  const chatHighlights = params.recentChat
    .filter((m) => !m.isSystem)
    .slice(-8)
    .map((m) => `${m.senderName}:${m.text}`)
    .join('\n');

  const collected = new Map<string, { thought: string; provider: 'groq' | 'gemini' }>();
  let lastErrorMsg: string | null = null;

  const requestBatch = async (
    targetBots: PostGameBotInput[],
    maxTokens: number,
    timeoutMs: number
  ): Promise<void> => {
    const botList = targetBots
      .map(
        (b, idx) =>
          `${idx + 1}. ${b.name} (${b.archetype ?? 'เพื่อนซี้'}, บท:${ROLE_DEFINITIONS[b.role].nameTh}, ห้อง${b.room ?? '?'}, ${b.alive ? 'รอด' : 'ตาย'})`
      )
      .join('\n');

    const prompt = `จบเกม HOTEL MURDER! ผู้ชนะ:${params.winner} (${params.winReason})
เฉลยทุกคน:\n${rosterSummary}
แชทเด่น:\n${chatHighlights || '(ว่าง)'}
เขียนความเห็นหลังจบเกมสั้นๆ 1-2 ประโยค กู-มึง แซ่บๆ ตามนิสัยให้ครบทั้ง ${targetBots.length} คนนี้:
${botList}
ตอบ JSON เท่านั้น: {"reactions":[{"index":1,"name":"${targetBots[0].name}","thought":"..."}]}`;

    try {
      const { text, provider } = await callAIWithAutoFallback(
        COMPACT_CHAT_SYSTEM_PROMPT + '\nตอบ JSON Object เท่านั้น ห้ามมีข้อความอื่นนอก JSON',
        prompt,
        true,
        maxTokens,
        timeoutMs
      );
      const mapped = parsePostGameReactions(text, targetBots);
      for (const [botId, thought] of mapped.entries()) {
        collected.set(botId, { thought, provider });
      }
      if (mapped.size === 0) {
        lastErrorMsg = `AI ส่งรูปแบบข้อความผิดพลาด (${provider})`;
        console.warn('[AI] Post-game parsed 0 reactions from raw output:', text.slice(0, 300));
      }
    } catch (err) {
      lastErrorMsg = err instanceof Error ? err.message : String(err);
      console.warn('[AI] Post-game thoughts batch error:', lastErrorMsg);
    }
  };

  // Attempt 1: Full batch with generous token budget (1,600) & 18s timeout
  await requestBatch(bots, 1600, 18000);

  // Attempt 2: If some or all bots missed (e.g. transient 429 right after final vote), pause 2.2s and retry in small chunks of 3–4 bots
  const missingBots = bots.filter((b) => !collected.has(b.id));
  if (missingBots.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 2200));
    const chunkSize = 4;
    for (let i = 0; i < missingBots.length; i += chunkSize) {
      const chunk = missingBots.slice(i, i + chunkSize);
      await requestBatch(chunk, 1000, 15000);
      if (i + chunkSize < missingBots.length) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  const thoughts: BotPostGameThought[] = bots
    .filter((b) => collected.has(b.id))
    .map((b) => {
      const entry = collected.get(b.id)!;
      return {
        botId: b.id,
        botName: b.name,
        role: b.role,
        alive: b.alive,
        thought: entry.thought,
        provider: entry.provider,
      };
    });

  return {
    thoughts,
    error: thoughts.length > 0 ? null : lastErrorMsg,
  };
}

export { getColumnOfRoom, getFloorOfRoom, getRoomsForFloorCount, getRoomsInColumn, getRoomsOnFloor };
