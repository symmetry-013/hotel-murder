import { Bot, RotateCcw, Skull, Trophy, MessageSquareQuote, Loader2, Wine } from 'lucide-react';
import type { RoomStatePayload } from '../shared/gameTypes';
import { ROLE_DEFINITIONS } from '../shared/gameTypes';
import { RoleIcon } from './RoleCardModal';

interface GameOverScreenProps {
  roomState: RoomStatePayload;
  myPlayerId: string | null;
  onPlayAgain: () => void;
}

export function GameOverScreen({ roomState, myPlayerId, onPlayAgain }: GameOverScreenProps) {
  const me = roomState.players.find((p) => p.id === myPlayerId) ?? null;
  const isHost = Boolean(me?.isHost);
  const goodWon = roomState.winner === 'GOOD';
  const drunkWon = roomState.winner === 'SPECIAL';

  const heroBannerClass = goodWon
    ? 'border-[#6E572C] bg-gradient-to-b from-[#211B13] to-[#141116]'
    : drunkWon
      ? 'border-[#7E22CE] bg-gradient-to-b from-[#251335] to-[#141116]'
      : 'border-[#7A1B24] bg-gradient-to-b from-[#291015] to-[#141116]';

  const victoryTitle = goodWon
    ? 'ฝ่ายผู้บริสุทธิ์ชนะ!'
    : drunkWon
      ? `คนเมา (${roomState.winnerPlayerName ?? 'จอมป่วน'}) ชนะเพียงคนเดียว!`
      : 'ฝ่ายฆาตกรชนะ!';

  return (
    <div className="min-h-screen w-full bg-[#0B0A0C] text-[#EAE4DC] py-6 sm:py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6 animate-settle">
        {/* Victory Hero Banner */}
        <section className={`rounded-xl border p-6 sm:p-8 ${heroBannerClass}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono-tabular text-[#C8A25A]">
                {goodWon ? (
                  <Trophy className="h-4 w-4 text-[#E8C984]" />
                ) : drunkWon ? (
                  <Wine className="h-4 w-4 text-[#D8B4FE]" />
                ) : (
                  <Skull className="h-4 w-4 text-[#F87171]" />
                )}
                <span>
                  จบเกม · วันที่ {roomState.day}/{roomState.maxDays}
                </span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wide text-[#F8F3EE]">
                {victoryTitle}
              </h1>
              <p className="text-sm sm:text-base text-[#D6CFC7]">{roomState.winReason}</p>
            </div>

            <div className="shrink-0">
              {isHost ? (
                <button
                  type="button"
                  onClick={onPlayAgain}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-[#C8A25A] px-5 py-2.5 text-sm font-bold text-[#120E09] hover:bg-[#DAB873] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>เล่นใหม่อีกครั้ง (Play Again)</span>
                </button>
              ) : (
                <p className="text-xs text-[#9D948A] rounded-lg border border-[#2F272C] bg-[#100D12] px-4 py-3">
                  รอหัวหน้าห้องกดเล่นใหม่อีกครั้ง...
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Main 2-Column Reveal & AI Thoughts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* AI Post-Game Thoughts */}
          <section className="lg:col-span-7 rounded-xl border border-[#2F262C] bg-[#141116] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#251F24] pb-3.5">
              <div className="flex items-center gap-2.5">
                <MessageSquareQuote className="h-5 w-5 text-[#C8A25A]" />
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#F5EFE6]">
                    ความคิดในใจของ AI หลังรู้ความจริง
                  </h2>
                  <p className="text-xs text-[#9D948A]">
                    ปฏิกิริยาสดๆ จากบอทเพื่อนซี้ทุกตัวหลังเปิดเผยบทบาทและห้องพักทั้งหมด
                  </p>
                </div>
              </div>
            </div>

            {roomState.aiThoughtsLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#C8A25A]" />
                <p className="text-sm text-[#CFC8BF]">
                  บอท AI กำลังอ่านเฉลยบทบาทและหมายเลขห้องพักของทุกคน...
                </p>
              </div>
            ) : roomState.aiThoughts.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#9D948A]">
                {roomState.players.some((p) => p.isBot)
                  ? 'ไม่สามารถโหลดความคิดสดจาก AI ได้ในขณะนี้ (กรุณาตรวจสอบ API Key ของ Groq หรือ Gemini)'
                  : 'รอบนี้ไม่มีบอท AI ร่วมเล่น'}
              </p>
            ) : (
              <div className="space-y-3">
                {roomState.aiThoughts.map((item) => {
                  const roleDef = ROLE_DEFINITIONS[item.role];
                  const isEvil = roleDef.faction === 'EVIL';
                  const isSpecial = roleDef.faction === 'SPECIAL';
                  return (
                    <article
                      key={item.botId}
                      className="rounded-lg border border-[#2A2228] bg-[#1B161E] p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Bot className="h-3.5 w-3.5 text-[#C8A25A]" />
                          <span className="font-semibold text-[#F5EFE6] text-sm">
                            {item.botName}
                          </span>
                          <span className="text-[#6E6660]" aria-hidden="true">
                            ·
                          </span>
                          <span
                            className={
                              isEvil
                                ? 'text-[#FCA5A5] font-medium'
                                : isSpecial
                                  ? 'text-[#D8B4FE] font-medium'
                                  : 'text-[#C8A25A]'
                            }
                          >
                            {roleDef.nameTh}
                          </span>
                        </div>
                        <span className="text-[#9D948A]">
                          {item.alive ? 'รอดชีวิต' : 'เสียชีวิต'}
                        </span>
                      </div>
                      <p className="text-sm sm:text-[15px] leading-relaxed text-[#EAE4DC]">
                        “{item.thought}”
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* True Role & Fixed Room Reveal Roster */}
          <section className="lg:col-span-5 rounded-xl border border-[#2F262C] bg-[#141116] p-5 sm:p-6 space-y-4">
            <div className="border-b border-[#251F24] pb-3.5">
              <h2 className="font-display text-lg font-semibold text-[#F5EFE6]">
                เฉลยบทบาทและหมายเลขห้องพัก
              </h2>
              <p className="text-xs text-[#9D948A] mt-0.5">
                เปิดเผยตัวตน ฝ่าย และห้องประจำตัวของผู้เล่นทุกคน
              </p>
            </div>

            <div className="divide-y divide-[#231D22]">
              {roomState.players.map((p) => {
                const role = p.revealedRole ?? 'KEYMASTER';
                const def = ROLE_DEFINITIONS[role];
                const isEvil = def.faction === 'EVIL';
                const isSpecial = def.faction === 'SPECIAL';
                const roomNum = p.finalRoom ?? p.deathRoom;

                const statusText = p.alive
                  ? `รอดชีวิต · ห้อง ${roomNum ?? '?'}`
                  : p.deathCause === 'MURDERED'
                    ? `ถูกฆ่า คืน ${p.deathDay ?? '?'} · ห้อง ${roomNum ?? '?'}`
                    : `ถูกโหวตห้อง วัน ${p.deathDay ?? '?'} · ห้อง ${roomNum ?? '?'}`;

                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                          isEvil
                            ? 'border-[#7F1D1D] bg-[#2D1217] text-[#F87171]'
                            : isSpecial
                              ? 'border-[#6B21A8] bg-[#241333] text-[#D8B4FE]'
                              : 'border-[#4D3F2A] bg-[#201A14] text-[#C8A25A]'
                        }`}
                      >
                        <RoleIcon role={role} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#F5EFE6]">
                          {p.name}
                          {p.id === myPlayerId ? ' (คุณ)' : ''}
                          {p.isBot ? ' · AI' : ''}
                        </p>
                        <p className="font-mono-tabular text-xs text-[#9D948A]">{statusText}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`text-xs font-semibold ${
                          isEvil
                            ? 'text-[#F87171]'
                            : isSpecial
                              ? 'text-[#D8B4FE]'
                              : 'text-[#E8C984]'
                        }`}
                      >
                        {def.nameTh}
                      </p>
                      <p className="text-[11px] text-[#7E766E]">
                        {isEvil ? 'ฝ่ายฆาตกร' : isSpecial ? 'ฝ่ายพิเศษ' : 'ฝ่ายผู้บริสุทธิ์'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
