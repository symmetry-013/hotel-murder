import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Crosshair, Layers, Radio, Send, Skull } from 'lucide-react';
import type {
  HotelFloorNumber,
  PrivatePlayerIntel,
  PublicPlayer,
} from '../shared/gameTypes';
import { getFloorsForCount, ROLE_DEFINITIONS } from '../shared/gameTypes';

interface SecretKillerCommsProps {
  intel: PrivatePlayerIntel;
  myPlayerId: string;
  totalFloors: number;
  alivePlayers: PublicPlayer[];
  pingModeActive: boolean;
  onTogglePingMode: () => void;
  onSendSecretChat: (text: string) => void;
  onPingFloor: (floor: HotelFloorNumber) => void;
  onPingPlayer: (playerId: string) => void;
}

export function SecretKillerComms({
  intel,
  myPlayerId,
  totalFloors,
  alivePlayers,
  pingModeActive,
  onTogglePingMode,
  onSendSecretChat,
  onPingFloor,
  onPingPlayer,
}: SecretKillerCommsProps) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [intel.secretChat.length]);

  const isAccomplice = intel.role === 'ACCOMPLICE';
  const partnerDesc =
    intel.evilPartners
      .map((p) => `${p.name} (${ROLE_DEFINITIONS[p.role].nameTh})`)
      .join(', ') || 'ไม่มี';
  const ping = intel.secretPing;
  const latestAccompliceClue = isAccomplice
    ? [...intel.clueLogs].reverse().find((c) => c.category === 'ACCOMPLICE') ?? null
    : null;
  const activeFloorsAsc = [...getFloorsForCount(totalFloors)].reverse();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    onSendSecretChat(clean);
    setText('');
  };

  return (
    <section
      aria-label="แชทลับใต้ดินฝ่ายฆาตกร"
      className="rounded-xl border border-[#7A1E28] bg-[#1C0D12]/95 p-4 space-y-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#47171E] pb-2.5">
        <div className="flex items-center gap-2">
          <Skull className="h-4 w-4 text-[#F87171] shrink-0" />
          <div>
            <h3 className="font-display text-sm sm:text-base font-bold text-[#FECACA]">
              แชทลับใต้ดิน (Secret Killer Chat)
            </h3>
            <p className="text-[11px] text-[#E5A3AB]">
              คู่หูของคุณ: <strong className="text-[#FFF1F2]">{partnerDesc}</strong> ·
              คนอื่นมองไม่เห็น
            </p>
          </div>
        </div>
      </div>

      {/* Murderer Complete Targeting Freedom Note */}
      {!isAccomplice && (
        <p className="text-xs text-[#F5C6CB] rounded-lg border border-[#4D1A22] bg-[#150A0E] px-3 py-2">
          ฆาตกรมีอิสระเต็มที่ในการจิ้มฆ่า{' '}
          <strong className="text-[#FDE047]">ทุกห้องที่ยังไม่ปิดทั่วทั้ง {totalFloors} ชั้น</strong>{' '}
          — จะฆ่าตามซิกของผู้ช่วย หรือเลือกฆ่าห้องอื่นเองก็ได้ตามใจชอบ
        </p>
      )}

      {/* Instant Floor Intel Banner for Accomplice */}
      {isAccomplice && latestAccompliceClue && (
        <div className="rounded-lg border border-[#9E2A37] bg-[#2D1017] px-3 py-2.5 text-xs text-[#FFE4E6] space-y-1">
          <p className="font-semibold text-[#FDE047]">{latestAccompliceClue.title}</p>
          <p>{latestAccompliceClue.detail}</p>
        </div>
      )}

      {/* Live Target Signal / Ping Alert Banner */}
      {ping && (
        <div className="flex items-center gap-2.5 rounded-lg border border-[#EF4444] bg-[#361017] px-3.5 py-2.5 text-xs sm:text-sm text-[#FEE2E2] animate-signal-ring">
          <Radio className="h-4 w-4 shrink-0 text-[#F87171]" />
          <p className="font-semibold">
            {ping.senderName} ส่งซิกชี้เป้า:{' '}
            <span className="text-[#FDE047] font-mono-tabular">
              {ping.kind === 'ROOM'
                ? `ห้อง ${ping.room}`
                : ping.kind === 'FLOOR'
                  ? `ชั้น ${ping.floor} (ห้อง ${ping.floor}01–${ping.floor}03)`
                  : `เล็งตัว ${ping.playerName}`}
            </span>
          </p>
        </div>
      )}

      {/* Accomplice Signal / Ping Target Controls (Room + Dynamic Floors + Player) */}
      {isAccomplice && (
        <div className="rounded-lg border border-[#521A22] bg-[#140A0D] p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#FCA5A5]">
              ส่งซิกชี้เป้าให้ฆาตกร (Signal Target)
            </span>
            <button
              type="button"
              onClick={onTogglePingMode}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                pingModeActive
                  ? 'bg-[#DC2626] text-white'
                  : 'border border-[#882530] bg-[#291116] text-[#FECACA] hover:bg-[#3A151D]'
              }`}
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span>
                {pingModeActive ? 'กำลังชี้เป้าห้องบนผัง (คลิกปิด)' : 'กดจิ้มห้องชี้เป้าบนผัง'}
              </span>
            </button>
          </div>

          {/* Dynamic Quick Floor Signal Buttons (1..totalFloors) */}
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 text-[11px] text-[#C88D95]">
              <Layers className="h-3 w-3" />
              <span>ส่งซิกชั้นที่สืบเจอให้ฆาตกร (ชั้น 1–{totalFloors}):</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {activeFloorsAsc.map((floor) => {
                const active = ping?.kind === 'FLOOR' && ping.floor === floor;
                return (
                  <button
                    key={floor}
                    type="button"
                    onClick={() => onPingFloor(floor)}
                    className={`min-h-[36px] min-w-[54px] flex-1 rounded-md border font-mono-tabular text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'border-[#FDE047] bg-[#4C141D] text-[#FDE047]'
                        : 'border-[#4D1E25] bg-[#221015] text-[#F5D0D5] hover:border-[#EF4444]'
                    }`}
                  >
                    ชั้น {floor}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Player Name Signal Buttons */}
          <div className="flex flex-wrap gap-1.5">
            {alivePlayers
              .filter(
                (p) =>
                  p.id !== myPlayerId && !intel.evilPartners.some((partner) => partner.id === p.id)
              )
              .map((suspect) => (
                <button
                  key={suspect.id}
                  type="button"
                  onClick={() => onPingPlayer(suspect.id)}
                  className="min-h-[34px] rounded-md border border-[#4D1E25] bg-[#221015] px-2.5 text-xs text-[#F5D0D5] hover:border-[#EF4444] hover:bg-[#33131A] transition-colors cursor-pointer"
                >
                  ชี้เป้า {suspect.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Secret Chat Messages */}
      <div className="max-h-40 overflow-y-auto space-y-2 rounded-lg border border-[#3A161C] bg-[#11080B] p-2.5">
        {intel.secretChat.length === 0 ? (
          <p className="py-3 text-center text-xs text-[#9C6C73]">
            ส่งข้อความกระซิบวางแผนลอบสังหารกับคู่หูของคุณ...
          </p>
        ) : (
          intel.secretChat.map((m) => {
            const mine = m.senderId === myPlayerId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-[#C88D95] px-1 mb-0.5">{m.senderName}</span>
                <div
                  className={`max-w-[88%] rounded-lg px-3 py-1.5 text-xs sm:text-sm ${
                    mine
                      ? 'bg-[#4A141D] text-[#FFF1F2]'
                      : 'bg-[#261117] border border-[#541C25] text-[#FDE8E8]'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Secret Chat Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          maxLength={200}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="กระซิบแผนในแชทลับใต้ดิน..."
          className="flex-1 min-h-[42px] rounded-lg border border-[#5A1E27] bg-[#10080B] px-3 text-sm text-[#FFF1F2] placeholder:text-[#8E5B63] focus:border-[#EF4444] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="ส่งแชทลับ"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-[#DC2626] text-white hover:bg-[#EF4444] disabled:opacity-40 cursor-pointer"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
