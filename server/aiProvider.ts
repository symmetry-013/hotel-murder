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

export type BotPolitenessGroup = 'CASUAL' | 'POLITE' | 'SENIOR' | 'JUNIOR';

export interface BotPersonaTemplate {
  code: string;
  gender: 'M' | 'F';
  age: number;
  politenessGroup: BotPolitenessGroup;
  selfPronoun: string;
  otherPronoun: string;
  endingParticle: string;
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
  age: number;
  politenessGroup: BotPolitenessGroup;
  selfPronoun: string;
  otherPronoun: string;
  endingParticle: string;
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
    age: 25,
    politenessGroup: 'CASUAL',
    selfPronoun: 'กู',
    otherPronoun: 'มึง หรือเรียกชื่อเพื่อน',
    endingParticle: 'ว่ะ / ดิ / เว้ย',
    archetype: 'ชาย 1 (25 ปี) · สายบวกหัวร้อน',
    persona: 'ใจร้อน ชอบเปิดก่อน พูดจาโผงผาง ใครพูดไม่เข้าหูพร้อมโหวตทันที',
    speechStyle: 'แทนตัวว่า "กู" เรียกเพื่อนว่า "มึง" พูดห้วนๆ ตรงๆ แบบเพื่อนซี้เถียงกัน',
    avatarColor: '#B84A39',
  },
  {
    code: 'M2',
    gender: 'M',
    age: 24,
    politenessGroup: 'CASUAL',
    selfPronoun: 'กู',
    otherPronoun: 'มึง หรือเรียกชื่อเพื่อน',
    endingParticle: 'ว่ะ / นะเว้ย / อะ',
    archetype: 'ชาย 2 (24 ปี) · สายปั่นกวนประสาท',
    persona: 'ชอบแซว ชอบโยนขี้และบลัฟให้เพื่อนระแวงกันเอง เหลี่ยมจัด',
    speechStyle: 'แทนตัวว่า "กู" เรียกเพื่อนว่า "มึง" กวนประสาท ชวนเพื่อนตีกันเอง',
    avatarColor: '#B8863B',
  },
  {
    code: 'M3',
    gender: 'M',
    age: 27,
    politenessGroup: 'POLITE',
    selfPronoun: 'ผม',
    otherPronoun: 'คุณ หรือเรียกชื่อ',
    endingParticle: 'ครับ',
    archetype: 'ชาย 3 (27 ปี) · สายเนิร์ดสุภาพ',
    persona: 'สุภาพ มีเหตุผล ชอบวิเคราะห์ตัวเลข ไล่ตัดช้อยส์ตามตรรกะและสถิติ',
    speechStyle: 'แทนตัวว่า "ผม" เรียกคนอื่นว่า "คุณ" หรือชื่อ และลงท้ายด้วย "ครับ" เสมอ',
    avatarColor: '#4A6FA5',
  },
  {
    code: 'M4',
    gender: 'M',
    age: 32,
    politenessGroup: 'SENIOR',
    selfPronoun: 'พี่',
    otherPronoun: 'น้อง หรือเรียกชื่อ',
    endingParticle: 'ครับ',
    archetype: 'ชาย 4 (32 ปี) · รุ่นพี่สุขุม',
    persona: 'สุขุม นิ่งๆ น่าเชื่อถือ อบอุ่นปนขี้เล่น คอยคุมจังหวะเกมและสรุปประเด็น',
    speechStyle: 'แทนตัวว่า "พี่" เรียกคนอื่นว่า "น้อง" หรือชื่อ ลงท้ายด้วย "ครับ" แบบรุ่นพี่ใจเย็น',
    avatarColor: '#5B6D7A',
  },
  {
    code: 'M5',
    gender: 'M',
    age: 26,
    politenessGroup: 'CASUAL',
    selfPronoun: 'กู',
    otherPronoun: 'มึง หรือเรียกชื่อเพื่อน',
    endingParticle: 'ห้วนๆ สั้นๆ',
    archetype: 'ชาย 5 (26 ปี) · สายนิ่งขรึมพูดน้อย',
    persona: 'พูดน้อยต่อยหนัก สังเกตพิรุธเงียบๆ แล้วจี้ตรงจุดตายประโยคเดียวจบ',
    speechStyle: 'แทนตัวว่า "กู" เรียกเพื่อนว่า "มึง" พูดสั้น ห้วน ตรงประเด็น ไม่อ้อมค้อม',
    avatarColor: '#3B7A57',
  },
  {
    code: 'F1',
    gender: 'F',
    age: 25,
    politenessGroup: 'CASUAL',
    selfPronoun: 'กู',
    otherPronoun: 'มึง หรือเรียกชื่อเพื่อน',
    endingParticle: 'ยะ / ว่ะ / ดิ',
    archetype: 'หญิง 1 (25 ปี) · สายแซ่บปากแจ๋ว',
    persona: 'ปากไว ด่าเจ็บ จับผิดเก่ง ไม่อ่อนข้อให้ใคร ใครโป๊ะแตกโดนฟาดไม่ยั้ง',
    speechStyle: 'แทนตัวว่า "กู" เรียกเพื่อนว่า "มึง" ปากแจ๋ว ฟาดตรงๆ แบบตัวแม่วงเหล้า',
    avatarColor: '#A63A5B',
  },
  {
    code: 'F2',
    gender: 'F',
    age: 24,
    politenessGroup: 'CASUAL',
    selfPronoun: 'กู',
    otherPronoun: 'มึง หรือเรียกชื่อเพื่อน',
    endingParticle: 'อ่ะ / ว่ะ / นะ',
    archetype: 'หญิง 2 (24 ปี) · สายติสท์กวนๆ',
    persona: 'พูดจาแปลกๆ เดาใจยาก เหมือนคนเมาตลอดเวลา ปั่นให้คนอื่นจับทางไม่ถูก',
    speechStyle: 'แทนตัวว่า "กู" เรียกเพื่อนว่า "มึง" พูดล่องลอย กวนๆ ชวนสับสน',
    avatarColor: '#8C6239',
  },
  {
    code: 'F3',
    gender: 'F',
    age: 26,
    politenessGroup: 'POLITE',
    selfPronoun: 'ฉัน',
    otherPronoun: 'คุณ หรือเรียกชื่อ',
    endingParticle: 'ค่ะ / คะ',
    archetype: 'หญิง 3 (26 ปี) · สายคุณหนูสุภาพ',
    persona: 'พูดจาไพเราะอ่อนหวาน สุภาพเรียบร้อยแต่แอบจิกกัดเชือดเฉือนอย่างมีชั้นเชิง',
    speechStyle: 'แทนตัวว่า "ฉัน" เรียกคนอื่นว่า "คุณ" หรือชื่อ ลงท้าย "ค่ะ/คะ" ให้ถูกกาลเทศะเสมอ',
    avatarColor: '#7A5C99',
  },
  {
    code: 'F4',
    gender: 'F',
    age: 30,
    politenessGroup: 'SENIOR',
    selfPronoun: 'พี่',
    otherPronoun: 'น้อง หรือเรียกชื่อ',
    endingParticle: 'ค่ะ / คะ',
    archetype: 'หญิง 4 (30 ปี) · พี่สาวใจดีเจ้าแผนการ',
    persona: 'อบอุ่น เป็นผู้นำ ชอบคุมเกมและหลอกถามข้อมูลจากคนอื่นอย่างแนบเนียน',
    speechStyle: 'แทนตัวว่า "พี่" เรียกคนอื่นว่า "น้อง" หรือชื่อ ลงท้าย "ค่ะ/คะ" แบบพี่สาวใจดี',
    avatarColor: '#3D828A',
  },
  {
    code: 'F5',
    gender: 'F',
    age: 20,
    politenessGroup: 'JUNIOR',
    selfPronoun: 'หนู',
    otherPronoun: 'พี่',
    endingParticle: 'ค่ะ / คะ',
    archetype: 'หญิง 5 (20 ปี) · น้องเล็กขี้ระแวง',
    persona: 'อายุน้อยสุด ใสซื่อ ขี้กลัว ตกใจง่าย ชอบอ้อนขอความเห็นใจแต่แอบสังเกตเก่ง',
    speechStyle: 'แทนตัวว่า "หนู" เรียกทุกคนว่า "พี่" (เช่น พี่เจมส์คะ) ลงท้าย "ค่ะ/คะ" เสมอ',
    avatarColor: '#6D4C9E',
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
    'เฮ้ย วันแรกยังไม่มีเบาะแสเลย เงียบทำไมกันวะ เปิดห้องสุ่มตัดช้อยส์ไปเลยดิ!',
    'ใครเงียบสุดในวงนี้น่าสงสัยฉิบหาย วันแรกกูขอจิ้มห้องวัดดวงก่อนเลยนะเว้ย!',
    'เข้าโรงแรมมาเจอศพตั้งแต่เช้ามืด กูไม่รอนานนะ ใครมีพิรุธเดี๋ยวกูเปิดก่อนเลย!',
    'คุยกันหน่อยดิวะ นั่งจ้องจอกันเงียบกริบ เดี๋ยวกูสุ่มเปิดห้องตัดทางฆาตกรก่อนเลย!',
  ],
  M2: [
    'อ้าว เงียบกันหมดแบบนี้ ฆาตกรมันกำลังนั่งยิ้มอยู่แน่ๆ เลยเว้ย กูว่ามีคนแอบล่กอยู่นะ',
    'วันแรกยังไม่มีใครสารภาพ งั้นมึงลองทายดิว่าใครหน้าตาดูเหลี่ยมสุดในห้องนี้',
    'กูว่าคนที่รีบชวนเปิดห้องมั่วๆ นี่แหละน่าสงสัย หรือมึงกลัวโดนจับได้วะ?',
    'เข้าโรงแรมมาวันแรกก็วุ่นวายแล้ว เดี๋ยวกูรอดูว่าใครจะเผลอหลุดปากก่อนกัน!',
  ],
  M3: [
    'วันแรกยังไม่มีข้อมูลจากสกิลกลางคืนครับ ผมแนะนำให้โหวตเปิดห้องว่างตัดตัวเลือกก่อนจะคุ้มที่สุดครับ',
    'ตามความน่าจะเป็นแล้ว วันแรกเรายังไม่ควรเดาตัวคนครับ ลองเปิดห้องสุ่มเพื่อช่วยแม่บ้านคืนนี้ดีกว่าครับ',
    'ผมขอเก็บข้อมูลการพูดคุยของทุกคนไว้ก่อนนะครับ ใครที่มีเหตุผลขัดแย้งกันเดี๋ยวพรุ่งนี้รู้เรื่องครับ',
    'วันแรกโหวตได้เฉพาะรายห้องครับ ผมว่าลองเลือกห้องที่อยู่ชั้นกลางๆ เพื่อลดขอบเขตก่อนดีไหมครับ',
  ],
  M4: [
    'ใจเย็นๆ กันก่อนนะครับทุกคน วันแรกยังไม่มีเบาะแส พี่ว่าเราค่อยๆ เปิดห้องตัดช้อยส์ไปก่อนดีกว่าครับ',
    'พี่สังเกตดูหลายคนยังเงียบอยู่นะครับ ลองแสดงความเห็นกันหน่อย จะได้ช่วยกันจับพิรุธครับ',
    'วันแรกยังไม่รู้ว่าใครเป็นใคร พี่แนะนำให้เก็บข้อมูลไว้เทียบกับผลสกิลพรุ่งนี้นะครับ',
    'น้องๆ อย่าเพิ่งรีบหัวร้อนใส่กันนะครับ วันแรกเปิดห้องสุ่มเช็กทางไปก่อน เดี๋ยวคืนนี้เบาะแสก็มาแล้วครับ',
  ],
  M5: [
    'วันแรกยังไม่มีข้อมูล กูขอเปิดห้องตัดช้อยส์ก่อน',
    'ใครพูดเยอะเกินไป กูเริ่มสงสัยมึงแล้วนะ',
    'เงียบไว้ก่อน เดี๋ยวคืนนี้มีเบาะแสค่อยไล่เช็กทีละชั้น',
    'ไม่ต้องเถียงกันเยอะ เปิดสักห้องแล้วรอดูพรุ่งนี้',
  ],
  F1: [
    'เอ้า เงียบกันทำไมยะ ใครเป็นฆาตกรก็รีบแสดงพิรุธออกมาดิ กูรอดูอยู่นะ!',
    'วันแรกยังไม่มีเบาะแสก็จริง แต่ใครทำตัวล่กๆ ระวังกูจับโหวตก่อนเพื่อนเลยนะเว้ย!',
    'มึงอย่ามานั่งแอ๊บใสกันเลย เปิดห้องสุ่มตัดช้อยส์ไปก่อน เดี๋ยวพรุ่งนี้กูจะไล่บี้ทีละคน!',
    'ทรงนี้มีคนตอแหลอยู่ในวงนี้แน่ๆ วันแรกเปิดห้องลองเชิงไปก่อนละกัน!',
  ],
  F2: [
    'เอ๊ะ โรงแรมนี้บรรยากาศหลอนๆ ดีเนอะ กูว่าชั้นบนๆ มันดูแปลกๆ ยังไงไม่รู้อ่ะ',
    'วันแรกมึงจะโหวตห้องไหนกันอ่ะ กูขอหลับตาจิ้มตามอารมณ์ได้ป่ะ ฮ่าๆ',
    'กูรู้สึกเหมือนมีคนแอบมองอยู่เลยว่ะ หรือวันนี้เราจะลองเปิดห้องสุ่มกันขำๆ ดีนะ',
    'อย่าเพิ่งเครียดดิ วันแรกยังไม่มีใครตายเพิ่มเลย เดี๋ยวคืนนี้ค่อยมาลุ้นกันใหม่เนอะ',
  ],
  F3: [
    'สวัสดีค่ะทุกคน วันแรกยังไม่มีเบาะแสชัดเจน ฉันว่าเราลองโหวตเปิดห้องสุ่มก่อนดีไหมคะ',
    'บรรยากาศในโรงแรมน่ากลัวจังเลยนะคะ แต่ฉันสังเกตว่าบางคนดูเงียบผิดปกตินะคะ',
    'วันแรกเรายังไม่ควรรีบกล่าวหากันค่ะ ฉันแนะนำให้ช่วยกันเปิดห้องว่างเพื่อลดตัวเลือกก่อนค่ะ',
    'ฉันขอฟังความเห็นของคุณทุกคนก่อนนะคะ เผื่อจะจับสังเกตได้ว่าใครพูดไม่ตรงไปตรงมาค่ะ',
  ],
  F4: [
    'สวัสดีค่ะน้องๆ วันแรกยังไม่มีผลสกิล พี่ว่าเรามาช่วยกันวางแผนเปิดห้องตัดช้อยส์กันก่อนนะคะ',
    'พี่ขอถามทุกคนหน่อยค่ะ ว่าวันนี้อยากลองเปิดห้องแถวไหนกันบ้าง จะได้ช่วยกันกระจายข้อมูลค่ะ',
    'อย่าเพิ่งรีบทะเลาะกันนะคะ พี่ว่าเก็บแรงไว้จับผิดฆาตกรพรุ่งนี้ตอนมีเบาะแสจะดีกว่าค่ะ',
    'วันแรกโหวตได้แค่รายห้องนะคะ พี่ว่าเลือกเปิดห้องที่ยังไม่มีข้อมูลเลยน่าจะช่วยฝั่งเราได้เยอะค่ะ',
  ],
  F5: [
    'พี่ๆ คะ หนูกลัวจังเลยค่ะ เข้าโรงแรมมาก็เจอศพแล้ว วันนี้เราจะโหวตเปิดห้องไหนกันดีคะ?',
    'หนูยังไม่มีเบาะแสอะไรเลยค่ะ พี่ๆ ช่วยกันคิดหน่อยนะคะ หนูไม่กล้าเดามั่วเลยค่ะ',
    'พี่ๆ อย่าเพิ่งสงสัยหนูนะคะ หนูแค่ตื่นเต้นเองค่ะ วันแรกหนูขอโหวตตามพี่ๆ นะคะ',
    'ทำไมเงียบกันจังเลยคะพี่ๆ หนูระแวงไปหมดแล้วนะ วันนี้ลองเปิดห้องสุ่มกันก่อนไหมคะ?',
  ],
};

const PERSONA_EMERGENCY_FALLBACK_BANK: Record<string, string[]> = {
  M1: [
    'เห้ย ใครมีเบาะแสก็รีบคายออกมาดิ กูจะรีบโหวตแล้วนะเว้ย!',
    'ทรงนี้ฆาตกรเนียนเงียบแน่นอน กูว่าต้องรีบปิดพื้นที่แล้วว่ะ!',
  ],
  M2: [
    'กูว่าวงนี้มีคนโกหกชัวร์ มึงลองดูดีๆ ดิว่าใครตอบไม่ตรงคำถาม!',
    'เอ้า โยนกันไปโยนกันมาแบบนี้ เดี๋ยวกูจิ้มปิดชั้นแม่งเลยนะเว้ย!',
  ],
  M3: [
    'จากข้อมูลที่มีตอนนี้ ผมว่าเราควรเทียบจำนวนคนในแต่ละชั้นกับแถวให้ดีก่อนโหวตนะครับ',
    'ผมยังเห็นจุดที่น่าสงสัยอยู่ครับ ลองทวนเบาะแสเมื่อคืนกันอีกครั้งดีไหมครับ',
  ],
  M4: [
    'พี่ว่าข้อมูลเริ่มชัดขึ้นแล้วนะครับทุกคน ลองช่วยกันตัดห้องที่ปลอดภัยออกไปก่อนครับ',
    'ใจเย็นๆ นะครับ พี่ขอฟังเบาะแสจากทุกคนให้ครบก่อนตัดสินใจโหวตครับ',
  ],
  M5: [
    'ข้อมูลเริ่มขัดกันแล้ว กูว่ามีคนโกหกในแชทนี้',
    'ไม่ต้องพูดเยอะ เอาเบาะแสจริงมาชนกันแล้วโหวตเลย',
  ],
  F1: [
    'หยุดแถได้แล้วยะ ใครมีข้อมูลอะไรก็รีบเปิดมาให้หมด กูไม่เชื่อคนเงียบหรอก!',
    'มึงอย่ามาเบี่ยงประเด็นนะ กูจับตาดูอยู่ว่าใครพูดไม่เคลียร์!',
  ],
  F2: [
    'เอ๊ะ ทำไมข้อมูลมันดูมั่วๆ ไปหมดเลยอ่ะ กูเริ่มงงแล้วนะเนี่ยว่าใครพูดจริง',
    'กูว่าวันนี้ต้องมีคนโดนแจ็กพอตแน่ๆ เลยอ่ะ มึงลองเล็งดีๆ นะ',
  ],
  F3: [
    'ฉันว่าเรื่องนี้มีพิรุธหลายจุดเลยนะคะ ลองตรวจสอบคำพูดของแต่ละคนให้ดีก่อนโหวตค่ะ',
    'ฉันขอรอดูเบาะแสเพิ่มเติมก่อนตัดสินใจนะคะ ไม่อยากโหวตพลาดไปโดนคนบริสุทธิ์ค่ะ',
  ],
  F4: [
    'พี่ว่าตอนนี้เราใกล้จับทางฆาตกรได้แล้วนะคะ น้องๆ คนไหนมีเบาะแสช่วยกันแชร์เลยค่ะ',
    'ลองเช็กชั้นกับแถวที่ยังไม่ถูกปิดดีๆ นะคะ พี่ว่าฆาตกรซ่อนอยู่ไม่ไกลแล้วค่ะ',
  ],
  F5: [
    'พี่ๆ คะ หนูเริ่มสับสนแล้วค่ะ ว่าตกลงใครพูดความจริงกันแน่คะเนี่ย?',
    'หนูกลัวโหวตผิดจังเลยค่ะ พี่ๆ ช่วยสรุปให้หนูหน่อยได้ไหมคะว่าจะโหวตตรงไหนดี?',
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
  for (let i = 0; i < 5; i++) {
    if (startWithMale) {
      if (malePersonas[i]) interleaved.push(malePersonas[i]);
      if (femalePersonas[i]) interleaved.push(femalePersonas[i]);
    } else {
      if (femalePersonas[i]) interleaved.push(femalePersonas[i]);
      if (malePersonas[i]) interleaved.push(malePersonas[i]);
    }
  }

  const chosenPersonas: BotPersonaTemplate[] = [];
  for (let i = 0; i < count; i++) {
    chosenPersonas.push(interleaved[i % interleaved.length]);
  }
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
    age: template.age,
    politenessGroup: template.politenessGroup,
    selfPronoun: template.selfPronoun,
    otherPronoun: template.otherPronoun,
    endingParticle: template.endingParticle,
    archetype: template.archetype,
    persona: template.persona,
    speechStyle: template.speechStyle,
    preferredProvider: 'groq',
    avatarColor: template.avatarColor,
  }));
}

// Base System Prompt (for JSON / non-chat helpers)
const COMPACT_CHAT_SYSTEM_PROMPT = `คุณกำลังเล่นบอร์ดเกมสืบสวน "HOTEL MURDER ปริศนาโรงแรมมรณะ" กับผู้เล่นคนอื่น
กฎเหล็ก:
- ห้ามเดาหรืออ้างบทบาทคนตาย (คนตายไม่เฉลยบทบาทจนจบเกม)
- กฎโหวต: วัน 1 เปิดได้แค่รายห้อง | วัน 2 ปลดปิดชั้นแนวนอน | วัน 3-4 ปลดปิดแถวแนวตั้ง
- ฝ่ายคนดีใช้เบาะแสจริงวิเคราะห์จับฆาตกร | ฝ่ายฆาตกรโกหกเบี่ยงประเด็น | คนเมาปั่นเนียนๆ ล่อให้โดนโหวต
- ห้ามเขียนคำว่า "กู-มึง" ติดกันเป็นคำสร้อย ให้พูดเหมือนคนไทยพิมพ์แชทจริงๆ ตามบุคลิก อายุ และความสุภาพของตัวละคร
- ตอบสั้นกระชับไม่เกิน 1-2 ประโยค ห้ามใส่ชื่อตัวเองนำหน้า ห้ามใส่เครื่องหมายคำพูด`;

function buildBotChatSystemPrompt(bot: BotProfile, role: RoleId): string {
  let toneRule = '';
  if (bot.politenessGroup === 'CASUAL') {
    toneRule =
      'กฎการใช้ภาษา (สายห้าว/เพื่อนซี้): แทนตัวเองว่า "กู" และเรียกเพื่อนว่า "มึง" หรือเรียกชื่อเพื่อน ห้ามเขียนคำว่า "กู-มึง" ติดกัน ห้ามใช้คำสุภาพอย่าง "ครับ/ค่ะ/ผม/คุณ" พิมพ์เถียงกันแบบคนไทยคุยแชทจริงๆ';
  } else if (bot.politenessGroup === 'POLITE') {
    toneRule =
      bot.gender === 'M'
        ? 'กฎการใช้ภาษา (สายสุภาพชาย): แทนตัวเองว่า "ผม" เรียกคนอื่นว่า "คุณ" หรือชื่อ และลงท้ายประโยคด้วย "ครับ" เสมอ ห้ามใช้คำหยาบเด็ดขาด'
        : 'กฎการใช้ภาษา (สายสุภาพหญิง): แทนตัวเองว่า "ฉัน" เรียกคนอื่นว่า "คุณ" หรือชื่อ และลงท้ายประโยคด้วย "ค่ะ/คะ" ให้ถูกกาลเทศะเสมอ ห้ามใช้คำหยาบเด็ดขาด';
  } else if (bot.politenessGroup === 'SENIOR') {
    toneRule =
      bot.gender === 'M'
        ? 'กฎการใช้ภาษา (รุ่นพี่ชาย): แทนตัวเองว่า "พี่" เรียกคนอื่นว่า "น้อง" หรือชื่อ และลงท้ายประโยคด้วย "ครับ" พูดจาอบอุ่น สุขุม น่าเชื่อถือ ห้ามใช้คำหยาบ'
        : 'กฎการใช้ภาษา (รุ่นพี่หญิง): แทนตัวเองว่า "พี่" เรียกคนอื่นว่า "น้อง" หรือชื่อ และลงท้ายประโยคด้วย "ค่ะ/คะ" พูดจาอบอุ่น เป็นผู้นำ ห้ามใช้คำหยาบ';
  } else {
    toneRule =
      'กฎการใช้ภาษา (รุ่นน้องหญิงอายุน้อย): แทนตัวเองว่า "หนู" เรียกทุกคนว่า "พี่" (เช่น พี่เจมส์คะ) และลงท้ายด้วย "ค่ะ/คะ" เสมอ พูดจาน่ารัก ขี้ระแวง ห้ามใช้คำหยาบ';
  }

  const noSelfLeakRule =
    role === 'DRUNK'
      ? 'กลยุทธ์คนเมา (Drunk): ปั่นเนียนๆ ล่อให้คนอื่นสงสัยและโหวตห้อง/ชั้น/แถวที่คุณอยู่ (แต่อย่าพูดตรงๆ ว่าเป็นคนเมา)'
      : 'กฎเหล็กห้ามหลุดความลับ: ห้ามพิมพ์บอกหมายเลขห้องพักของตัวเองในแชทเด็ดขาด! (เช่น ห้ามพูดว่าอยู่ห้องไหน) เพราะจะทำให้ฆาตกรรู้ตำแหน่งและตามมาฆ่าทันที ให้พูดถึงแค่เบาะแสที่สืบได้หรือตั้งข้อสงสัยเรื่องชั้น/แถวเท่านั้น';

  return `คุณกำลังเล่นบอร์ดเกมสืบสวน "HOTEL MURDER ปริศนาโรงแรมมรณะ"
ตัวตนของคุณ: ชื่อ "${bot.name}" เพศ${bot.gender === 'M' ? 'ชาย' : 'หญิง'} อายุ ${bot.age} ปี (${bot.archetype})
นิสัย: ${bot.persona}
${toneRule}
${noSelfLeakRule}
กฎเกม:
- ห้ามเดาหรืออ้างบทบาทคนตาย (คนตายไม่เฉลยบทบาทจนจบเกม)
- วัน 1 เปิดได้แค่รายห้อง | วัน 2 ปลดปิดชั้นแนวนอน | วัน 3-4 ปลดปิดแถวแนวตั้ง
- ตอบสั้นกระชับ 1-2 ประโยคเหมือนคนไทยพิมพ์แชทจริงๆ ห้ามใส่ชื่อตัวเองนำหน้า ห้ามใส่เครื่องหมายคำพูด`;
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

const DEPRECATED_GROQ_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'qwen/qwen3-32b',
  'qwen/qwen3.6-27b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
]);

function getProviderOrder(): Array<'groq' | 'gemini'> {
  const raw = process.env.AI_PROVIDER_ORDER?.trim() || 'groq,gemini';
  const parsed = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is 'groq' | 'gemini' => s === 'groq' || s === 'gemini');
  return parsed.length > 0 ? Array.from(new Set(parsed)) : ['groq', 'gemini'];
}

function getGroqConfig(): { apiKey: string; models: string[] } | null {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY') {
    return null;
  }
  const envModel = process.env.GROQ_MODEL?.trim();
  const primary =
    envModel && !DEPRECATED_GROQ_MODELS.has(envModel) ? envModel : 'openai/gpt-oss-20b';
  const models = Array.from(
    new Set([primary, 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'])
  );
  return { apiKey, models };
}

function sanitizeThaiColloquial(
  raw: string,
  bot?: Pick<BotProfile, 'politenessGroup' | 'gender'>,
  role?: RoleId,
  myRoom?: HotelRoomNumber | null
): string {
  let text = raw
    .trim()
    .replace(/^["'「『]+|["'」』]+$/g, '')
    .replace(/^(ชื่อ|บอท|ตอบ|ข้อความ)\s*[:：]\s*/i, '')
    .replace(/กู\s*-\s*มึง/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Only normalize polite words for CASUAL bots; strictly preserve ครับ/ค่ะ/ผม/ฉัน/พี่/หนู for POLITE/SENIOR/JUNIOR!
  if (bot?.politenessGroup === 'CASUAL') {
    text = text
      .replace(/(นะครับ|นะคะ|นะคับ|นะค่ะ|ครับผม|ครับ|ค่ะ)\b/g, 'ว่ะ')
      .replace(/\bดิฉัน\b/g, 'กู');
  }

  // Hard No-Self-Leak Guard: block accidental own-room leak for all non-Drunk roles
  if (role && role !== 'DRUNK' && myRoom) {
    const roomStr = String(myRoom);
    if (text.includes(roomStr)) {
      text = text.replace(new RegExp(`ห้อง\\s*${roomStr}|${roomStr}`, 'g'), 'ห้องนั้น');
    }
  }

  if (text.length > 185) {
    text = text.slice(0, 182).trim() + '...';
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

  let lastError: unknown = null;

  for (const modelName of cfg.models) {
    const isGptOss = modelName.startsWith('openai/gpt-oss-');
    const isQwen38 = modelName.startsWith('qwen/qwen3.8');
    // Groq reasoning models count reasoning tokens inside max_completion_tokens
    const completionBudget = isGptOss ? Math.max(maxTokens * 4, 640) : Math.max(maxTokens, 256);
    const safeSystemPrompt =
      expectJson && !/json/i.test(systemPrompt) && !/json/i.test(userPrompt)
        ? `${systemPrompt}\nตอบกลับเป็น JSON object เท่านั้น`
        : systemPrompt;

    // Try with json_object first when expectJson=true, and retry once without response_format if 400
    const attempts = expectJson ? [true, false] : [false];

    for (const useJsonMode of attempts) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const body: Record<string, unknown> = {
          model: modelName,
          messages: [
            { role: 'system', content: safeSystemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: expectJson ? 0.55 : 0.9,
          max_completion_tokens: completionBudget,
        };
        if (isGptOss) {
          body.reasoning_effort = 'low';
        } else if (isQwen38) {
          body.reasoning_effort = 'none';
        }
        if (useJsonMode) {
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
          const err = new Error(`GROQ_HTTP_${res.status} (${modelName}): ${errText.slice(0, 180)}`);
          lastError = err;
          console.warn(
            `[AI] Groq model "${modelName}" failed (${res.status}, jsonMode=${useJsonMode}): ${errText.slice(0, 180)}`
          );
          if (res.status === 400 && useJsonMode) {
            continue; // Retry same model without response_format
          }
          if (res.status === 404 || res.status === 400 || res.status === 429 || res.status >= 500) {
            break; // Move to next candidate model
          }
          throw err;
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) {
          lastError = new Error(`GROQ_EMPTY_RESPONSE (${modelName})`);
          continue;
        }
        return content;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('GROQ_HTTP_401') || msg.includes('GROQ_HTTP_403')) {
          throw err;
        }
        console.warn(`[AI] Groq model "${modelName}" error (${msg.slice(0, 160)}), trying next...`);
        break;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('GROQ_FAILED');
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
  const configuredFast = process.env.GEMINI_MODEL_FAST?.trim();
  const baseCandidates = Array.from(
    new Set(
      [
        configuredPrimary,
        configuredFast,
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-2.5-flash-lite',
        'gemini-4-hydrogen',
      ].filter((m): m is string => Boolean(m))
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
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('504') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('overloaded') ||
        msg.includes('high demand') ||
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

  const providerOrder = getProviderOrder();

  for (const provider of providerOrder) {
    if (provider === 'groq' && hasGroq) {
      try {
        const text = await callGroq(systemPrompt, userPrompt, expectJson, maxTokens, timeoutMs);
        return { text, provider: 'groq' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Groq: ${msg}`);
        console.warn(`[AI] Groq failed/429/timeout, trying next provider:`, msg);
      }
    } else if (provider === 'gemini' && hasGemini) {
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
        console.warn(`[AI] Gemini failed, trying next provider:`, msg);
      }
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
  const botInfoLine = `ตัวตน:${input.bot.name}(${input.bot.gender === 'M' ? 'ชาย' : 'หญิง'} อายุ ${input.bot.age} ปี, แทนตัว "${input.bot.selfPronoun}", ลงท้าย "${input.bot.endingParticle}") | บทบาท:${roleDef.nameTh} ห้องลับส่วนตัว:${input.myRoom}(ชั้น${input.myFloor}/แถว${input.myColumn}) ${evilPartnerStr}`;

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
    `คำสั่ง:${directive} (ตอบ 1-2 ประโยคสั้นๆ ตามบุคลิกและสรรพนามของตัวละคร ห้ามซ้ำแชทเดิม${input.role !== 'DRUNK' ? ' และห้ามหลุดเลขห้องตัวเองเด็ดขาด' : ''}):`,
  ].join('\n');

  try {
    const systemPrompt = buildBotChatSystemPrompt(input.bot, input.role);
    const { text, provider } = await callAIWithAutoFallback(
      systemPrompt,
      userPrompt,
      false,
      120,
      8000
    );
    const cleaned = sanitizeThaiColloquial(text, input.bot, input.role, input.myRoom);
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
    const cleaned = sanitizeThaiColloquial(text, params.bot);
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
        ? sanitizeThaiColloquial(parsed.whisper, params.bot)
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

    if (params.role === 'RECEPTIONIST') {
      const candidates = params.unrevealedRooms.filter((r) => r !== params.myRoom);
      return candidates[Math.floor(Math.random() * candidates.length)] ?? params.unrevealedRooms[0] ?? null;
    }

    if (params.role === 'SHADOW_ASSASSIN') {
      const activeFloors = getFloorsForCount(params.totalFloors);
      if (Math.random() < 0.55) {
        const f = activeFloors[Math.floor(Math.random() * activeFloors.length)] ?? 1;
        return `FLOOR:${f}`;
      }
      const c = HOTEL_COLUMNS[Math.floor(Math.random() * HOTEL_COLUMNS.length)] ?? 1;
      return `COLUMN:${c}`;
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
        ? sanitizeThaiColloquial(parsed.comment, params.bot, params.role, params.myRoom)
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