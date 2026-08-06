'use client';

import { useEffect, useState, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { GameState, Teacher, RaceUpdate, FinalResults, VoteResult } from '@/lib/types';

const LANE_COLORS = [
  'from-red-500 to-red-700',
  'from-blue-500 to-blue-700',
  'from-green-500 to-green-700',
  'from-yellow-500 to-yellow-700',
  'from-purple-500 to-purple-700',
  'from-pink-500 to-pink-700',
  'from-cyan-500 to-cyan-700',
  'from-orange-500 to-orange-700',
  'from-teal-500 to-teal-700',
  'from-indigo-500 to-indigo-700',
];

const LANE_BG = [
  'bg-red-500/10',
  'bg-blue-500/10',
  'bg-green-500/10',
  'bg-yellow-500/10',
  'bg-purple-500/10',
  'bg-pink-500/10',
  'bg-cyan-500/10',
  'bg-orange-500/10',
  'bg-teal-500/10',
  'bg-indigo-500/10',
];

export default function DashboardPage() {
  const [state, setState] = useState<GameState | null>(null);
  const [positions, setPositions] = useState<Map<string, number>>(new Map());
  const [results, setResults] = useState<FinalResults | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('state-update', (data: GameState) => {
      setState(data);
    });

    socket.on('race-update', (data: RaceUpdate) => {
      const map = new Map<string, number>();
      data.positions.forEach((p) => map.set(p.id, p.progress));
      setPositions(map);
    });

    socket.on('vote-opened', () => {
      setResults(null);
      setShowConfetti(false);
    });

    socket.on('results', (data: FinalResults) => {
      setResults(data);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 8000);
    });

    return () => {
      socket.off('state-update');
      socket.off('race-update');
      socket.off('vote-opened');
      socket.off('results');
    };
  }, []);

  useEffect(() => {
    if (!state?.votingEndsAt || state.status !== 'voting') {
      setCountdown('');
      return;
    }

    const timer = setInterval(() => {
      const remaining = state.votingEndsAt! - Date.now();
      if (remaining <= 0) {
        setCountdown('00:00');
        clearInterval(timer);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }, 200);

    return () => clearInterval(timer);
  }, [state?.votingEndsAt, state?.status]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f23]">
        <div className="text-2xl text-gray-400">กำลังเชื่อมต่อ...</div>
      </div>
    );
  }

  // Idle state
  if (state.status === 'idle' && !results) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f23]">
        <h1 className="text-5xl font-bold text-yellow-400 mb-4">PopVote</h1>
        <p className="text-2xl text-gray-400">โหวตยอดนิยมแต่งกายครูวันวิทยาศาสตร์</p>
        <p className="text-lg text-gray-600 mt-4">รอแอดมินเปิดการโหวต...</p>
      </div>
    );
  }

  const teachers = state.teachers;

  return (
    <div className="min-h-screen bg-[#0f0f23] p-6 flex flex-col">
      {/* Confetti */}
      {showConfetti && (
        <div ref={confettiRef} className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-sm"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#ff0', '#f0f', '#0ff', '#f00', '#0f0', '#00f', '#ff8800'][i % 7],
                animation: `confetti-fall ${2 + Math.random() * 3}s linear ${Math.random() * 2}s forwards`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-yellow-400">
          {results ? '🏆 ผลการโหวต 🏆' : 'PopVote — วิ่งแข่ง!'}
        </h1>
        {countdown && (
          <div className="text-6xl font-mono text-yellow-400 mt-2">{countdown}</div>
        )}
        {state.status === 'closed' && !results && (
          <p className="text-2xl text-orange-400 mt-2">ปิดโหวตแล้ว — รอเปิดเผยคะแนน...</p>
        )}
      </div>

      {/* Racing Lanes or Results */}
      <div className="flex-1 flex flex-col justify-center gap-3 max-w-6xl mx-auto w-full">
        {results ? (
          // Final Results
          results.rankings.map((r: VoteResult, idx: number) => (
            <div
              key={r.teacher.id}
              className="flex items-center gap-4 animate-slide-right"
              style={{ animationDelay: `${idx * 0.15}s`, opacity: 0 }}
            >
              <div className="text-4xl font-bold text-yellow-400 w-12 text-right">
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
              </div>
              <img
                src={r.teacher.image}
                alt={r.teacher.name}
                className={`w-16 h-16 rounded-full object-cover border-3 ${
                  idx === 0 ? 'border-yellow-400 w-20 h-20' : idx === 1 ? 'border-gray-300' : idx === 2 ? 'border-orange-600' : 'border-gray-600'
                }`}
              />
              <div className="flex-1">
                <div className="flex items-baseline gap-3">
                  <span className={`text-2xl font-bold ${idx === 0 ? 'text-yellow-400 text-3xl' : ''}`}>
                    {r.teacher.name}
                  </span>
                  <span className="text-xl text-gray-400">
                    {r.votes.toLocaleString()} คะแนน
                  </span>
                </div>
                <div className="mt-1 h-3 bg-[#1a1a3e] rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${LANE_COLORS[idx % LANE_COLORS.length]} rounded-full transition-all duration-1000`}
                    style={{
                      width: `${results.rankings[0].votes > 0 ? (r.votes / results.rankings[0].votes) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          // Racing Lanes
          teachers.map((t: Teacher, idx: number) => {
            const progress = positions.get(t.id) || 0;
            return (
              <div key={t.id} className={`relative rounded-xl overflow-hidden ${LANE_BG[idx % LANE_BG.length]}`}>
                {/* Lane background */}
                <div className="h-20 relative">
                  {/* Dashed lane line */}
                  <div className="absolute inset-0 flex items-center px-4">
                    <div className="w-full border-t-2 border-dashed border-white/10" />
                  </div>

                  {/* Finish line */}
                  <div className="absolute right-0 top-0 bottom-0 w-2">
                    <div className="h-full w-full bg-gradient-to-b from-white/30 via-black/30 to-white/30"
                      style={{ backgroundSize: '100% 8px' }} />
                  </div>

                  {/* Teacher name label */}
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-bold text-lg">
                    {t.name}
                  </div>

                  {/* Progress bar */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r ${LANE_COLORS[idx % LANE_COLORS.length]} opacity-30 transition-all duration-200 ease-out`}
                    style={{ width: `${progress}%` }}
                  />

                  {/* Teacher avatar (the racer head) */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 transition-all duration-200 ease-out"
                    style={{ left: `${Math.max(progress, 2)}%`, transform: `translateX(-50%) translateY(-50%)` }}
                  >
                    <div className="relative">
                      <img
                        src={t.image}
                        alt={t.name}
                        className="w-14 h-14 rounded-full object-cover border-3 border-white shadow-lg"
                      />
                      {state.status === 'voting' && progress > 5 && (
                        <div className="absolute -right-1 -top-1 w-4 h-4 bg-green-500 rounded-full animate-ping" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
