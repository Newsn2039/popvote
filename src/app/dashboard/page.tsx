'use client';

import { useEffect, useState, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { GameState, Teacher, RaceUpdate, FinalResults, VoteResult } from '@/lib/types';

const LANE_COLORS = [
  'from-orange-400 to-orange-600',
  'from-blue-400 to-blue-600',
  'from-green-400 to-green-600',
  'from-yellow-400 to-yellow-600',
  'from-purple-400 to-purple-600',
  'from-pink-400 to-pink-600',
  'from-cyan-400 to-cyan-600',
  'from-teal-400 to-teal-600',
  'from-indigo-400 to-indigo-600',
  'from-rose-400 to-rose-600',
];

const LANE_FILL = [
  'bg-orange-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-rose-500',
];

const LANE_BG = [
  'bg-orange-100',
  'bg-blue-100',
  'bg-green-100',
  'bg-yellow-100',
  'bg-purple-100',
  'bg-pink-100',
  'bg-cyan-100',
  'bg-teal-100',
  'bg-indigo-100',
  'bg-rose-100',
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-2xl text-gray-500">กำลังเชื่อมต่อ...</div>
      </div>
    );
  }

  if (state.status === 'idle' && !results) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <h1 className="text-5xl font-bold text-indigo-700 mb-4">PopularVote</h1>
        <p className="text-2xl text-gray-600">โหวตยอดนิยมแต่งกายครูวันวิทยาศาสตร์</p>
        <p className="text-lg text-gray-400 mt-4">รอแอดมินเปิดการโหวต...</p>
      </div>
    );
  }

  const teachers = state.teachers;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 flex flex-col">
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
        <h1 className="text-4xl font-bold text-indigo-700">
          {results ? '🏆 ผลการโหวต 🏆' : 'PopularVote — วิ่งแข่ง!'}
        </h1>
        {countdown && (
          <div className="text-6xl font-mono text-indigo-600 mt-2">{countdown}</div>
        )}
        {state.status === 'closed' && !results && (
          <p className="text-2xl text-orange-500 mt-2">ปิดโหวตแล้ว — รอเปิดเผยคะแนน...</p>
        )}
      </div>

      {/* Racing Lanes or Results */}
      <div className="flex-1 flex flex-col justify-center gap-3 max-w-6xl mx-auto w-full">
        {results ? (
          results.rankings.map((r: VoteResult, idx: number) => (
            <div
              key={r.teacher.id}
              className="flex items-center gap-4 animate-slide-right"
              style={{ animationDelay: `${idx * 0.15}s`, opacity: 0 }}
            >
              <div className="text-4xl font-bold w-12 text-right">
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
              </div>
              {r.teacher.image ? (
                <img
                  src={r.teacher.image}
                  alt={r.teacher.name}
                  className={`w-16 h-16 rounded-full object-cover border-3 ${
                    idx === 0 ? 'border-yellow-400 w-20 h-20' : idx === 1 ? 'border-gray-400' : idx === 2 ? 'border-orange-400' : 'border-gray-300'
                  }`}
                />
              ) : (
                <div className={`w-16 h-16 rounded-full bg-indigo-200 flex items-center justify-center text-2xl border-3 ${
                  idx === 0 ? 'border-yellow-400 w-20 h-20' : 'border-gray-300'
                }`}>
                  {r.teacher.name.charAt(0)}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-baseline gap-3">
                  <span className={`text-2xl font-bold text-gray-800 ${idx === 0 ? 'text-3xl text-indigo-700' : ''}`}>
                    {r.teacher.name}
                  </span>
                  <span className="text-xl text-gray-500">
                    {r.votes.toLocaleString()} คะแนน
                  </span>
                </div>
                <div className="mt-1 h-3 bg-gray-200 rounded-full overflow-hidden">
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
          teachers.map((t: Teacher, idx: number) => {
            const progress = positions.get(t.id) || 0;
            return (
              <div key={t.id} className="relative h-14">
                {/* HP bar */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-10 bg-gray-800 rounded-lg border-2 border-gray-900 overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 bottom-0 ${LANE_FILL[idx % LANE_FILL.length]} transition-all duration-200 ease-out`}
                    style={{ width: `${Math.max(progress, 2)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center pl-4">
                    <span className="text-white font-bold text-lg drop-shadow-md">{t.name}</span>
                  </div>
                </div>
                {/* Avatar running ahead of the bar */}
                <div
                  className="absolute z-10 top-1/2 transition-all duration-200 ease-out"
                  style={{ left: `${Math.max(progress, 2)}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                >
                  <div className="relative">
                    {t.image ? (
                      <img
                        src={t.image}
                        alt={t.name}
                        className="w-14 h-14 rounded-full object-cover border-3 border-gray-800 shadow-lg"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-indigo-200 flex items-center justify-center text-xl font-bold border-3 border-gray-800 shadow-lg">
                        {t.name.charAt(0)}
                      </div>
                    )}
                    {state.status === 'voting' && progress > 5 && (
                      <div className="absolute -right-1 -top-1 w-4 h-4 bg-green-500 rounded-full animate-ping" />
                    )}
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
