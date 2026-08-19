'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { GameState, Teacher, FinalResults, VoteResult } from '@/lib/types';

export default function VotePage() {
  const [state, setState] = useState<GameState | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isPopping, setIsPopping] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [countdown, setCountdown] = useState<string>('');
  const [showRing, setShowRing] = useState(false);
  const [results, setResults] = useState<FinalResults | null>(null);
  const [preCountdown, setPreCountdown] = useState(0);
  const [kickCooldown, setKickCooldown] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const kickUntil = localStorage.getItem('popvote-kick-until');
    if (!kickUntil) return 0;
    const remaining = Math.ceil((parseInt(kickUntil) - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  });
  const ringKey = useRef(0);

  useEffect(() => {
    const socket = getSocket();

    socket.on('state-update', (data: GameState) => {
      setState(data);
    });

    socket.on('vote-opened', () => {
      setTapCount(0);
      setResults(null);
      setPreCountdown(5);
    });

    socket.on('results', (data: FinalResults) => {
      setResults(data);
    });

    socket.on('vote-kick', (data?: { cooldown?: number }) => {
      setSelectedTeacher(null);
      setTapCount(0);
      const cd = data?.cooldown ?? 15;
      setKickCooldown(cd);
      localStorage.setItem('popvote-kick-until', String(Date.now() + cd * 1000));
    });

    return () => {
      socket.off('state-update');
      socket.off('vote-opened');
      socket.off('results');
      socket.off('vote-kick');
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

  useEffect(() => {
    if (kickCooldown <= 0) {
      localStorage.removeItem('popvote-kick-until');
      return;
    }
    const t = setTimeout(() => setKickCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [kickCooldown]);

  useEffect(() => {
    if (preCountdown <= 0) return;
    const t = setTimeout(() => setPreCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [preCountdown]);

  const handleTap = useCallback(() => {
    if (!selectedTeacher || state?.status !== 'voting' || preCountdown > 0) return;

    getSocket().emit('vote', { teacherId: selectedTeacher.id });
    setTapCount((c) => c + 1);

    setIsPopping(true);
    setTimeout(() => setIsPopping(false), 150);

    ringKey.current++;
    setShowRing(true);
    setTimeout(() => setShowRing(false), 600);

    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, [selectedTeacher, state?.status, preCountdown]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-xl text-gray-500">กำลังเชื่อมต่อ...</div>
      </div>
    );
  }

  // Show results on student phone
  if (results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex flex-col items-center">
        <h1 className="text-2xl font-bold text-indigo-700 mb-1 mt-4">ผลการโหวต</h1>
        <p className="text-gray-500 mb-6">ขอบคุณที่ร่วมโหวต!</p>

        <div className="w-full max-w-sm space-y-3">
          {results.rankings.map((r: VoteResult, idx: number) => (
            <div
              key={r.teacher.id}
              className={`bg-white rounded-xl p-4 flex items-center gap-4 shadow-md border ${
                idx === 0 ? 'border-yellow-400 ring-2 ring-yellow-300' : 'border-gray-100'
              } animate-slide-right`}
              style={{ animationDelay: `${idx * 0.1}s`, opacity: 0 }}
            >
              <div className="text-2xl font-bold w-8 text-center">
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
              </div>
              {r.teacher.image ? (
                <img
                  src={r.teacher.image}
                  alt={r.teacher.name}
                  className={`w-14 h-14 rounded-full object-cover border-2 ${
                    idx === 0 ? 'border-yellow-400' : idx === 1 ? 'border-gray-400' : idx === 2 ? 'border-orange-400' : 'border-gray-200'
                  }`}
                />
              ) : (
                <div className={`w-14 h-14 rounded-full bg-indigo-200 flex items-center justify-center text-2xl border-2 ${
                  idx === 0 ? 'border-yellow-400' : 'border-gray-200'
                }`}>
                  {r.teacher.name.charAt(0)}
                </div>
              )}
              <div className="flex-1">
                <p className={`font-bold ${idx === 0 ? 'text-lg text-indigo-700' : 'text-gray-800'}`}>
                  {r.teacher.name}
                </p>
                <p className="text-sm text-gray-500">{r.votes.toLocaleString()} คะแนน</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedTeacher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex flex-col">
        <h1 className="text-2xl font-bold text-center text-indigo-700 mb-2">
          PopularVote
        </h1>
        {kickCooldown > 0 ? (
          <div className="text-center mb-4">
            <p className="text-red-500 font-semibold mb-1">ตรวจพบการใช้โปรแกรมช่วยกด</p>
            <p className="text-gray-500">รอ <span className="text-red-600 font-bold text-xl">{kickCooldown}</span> วินาที</p>
          </div>
        ) : (
          <p className="text-center text-gray-500 mb-6">เลือกครูที่คุณชอบ</p>
        )}

        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto w-full">
          {state.teachers.map((t: Teacher) => (
            <button
              key={t.id}
              onClick={() => { if (kickCooldown <= 0) setSelectedTeacher(t); }}
              disabled={kickCooldown > 0}
              className={`bg-white rounded-xl p-4 flex flex-col items-center gap-3 transition-transform shadow-md border border-indigo-100 ${
                kickCooldown > 0 ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 hover:bg-indigo-50'
              }`}
            >
              {t.image ? (
                <img
                  src={t.image}
                  alt={t.name}
                  className="w-24 h-24 rounded-full object-cover border-3 border-indigo-400"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-indigo-200 flex items-center justify-center text-4xl border-3 border-indigo-400">
                  {t.name.charAt(0)}
                </div>
              )}
              <span className="font-semibold text-lg text-gray-700">{t.name}</span>
            </button>
          ))}
        </div>

        {state.teachers.length === 0 && (
          <p className="text-center text-gray-400 mt-12">รอแอดมินเพิ่มครู...</p>
        )}
      </div>
    );
  }

  const isVoting = state.status === 'voting';
  const isClosed = state.status === 'closed' || state.status === 'finalized';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4 select-none">
      <div className="text-center mb-6">
        {selectedTeacher.image ? (
          <img
            src={selectedTeacher.image}
            alt={selectedTeacher.name}
            className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-indigo-500 mb-2"
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-indigo-200 flex items-center justify-center text-5xl mx-auto border-4 border-indigo-500 mb-2">
            {selectedTeacher.name.charAt(0)}
          </div>
        )}
        <p className="text-lg font-semibold text-indigo-700">{selectedTeacher.name}</p>
        <button
          onClick={() => {
            setSelectedTeacher(null);
            setTapCount(0);
          }}
          className="text-sm text-gray-400 underline mt-1 active:text-indigo-600"
        >
          เปลี่ยนครู
        </button>
      </div>

      {countdown && (
        <div className="text-4xl font-mono text-indigo-600 mb-4">{countdown}</div>
      )}

      {isVoting && preCountdown > 0 && (
        <div className="fixed inset-0 bg-black/60 flex flex-col items-center justify-center z-50">
          <p className="text-white text-2xl mb-4 font-semibold">เตรียมตัว!</p>
          <div className="text-9xl font-bold text-white animate-bounce">{preCountdown}</div>
        </div>
      )}

      <div className="relative mb-6">
        {showRing && (
          <div
            key={ringKey.current}
            className="absolute inset-0 rounded-full border-4 border-indigo-400 animate-pulse-ring pointer-events-none"
          />
        )}
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            handleTap();
          }}
          disabled={!isVoting || preCountdown > 0}
          className={`
            w-48 h-48 rounded-full text-6xl font-bold
            flex items-center justify-center
            transition-all duration-100 touch-manipulation
            ${isVoting && preCountdown <= 0
              ? `bg-gradient-to-br from-indigo-400 to-purple-500 text-white shadow-lg shadow-indigo-300/50 active:shadow-inner cursor-pointer ${isPopping ? 'animate-pop' : ''}`
              : 'bg-gray-300 text-gray-400 cursor-not-allowed'
            }
          `}
          style={{ WebkitTapHighlightColor: 'transparent', userSelect: 'none' }}
        >
          {isVoting ? '👆' : (isClosed ? '⏹' : '⏳')}
        </button>
      </div>

      {!isVoting && !isClosed && (
        <p className="text-xl text-gray-500 text-center">
          รอแอดมินเปิดโหวต...
        </p>
      )}

      {isVoting && (
        <p className="text-lg text-indigo-600 font-semibold">
          กดเร็วๆ เพื่อช่วยครู {selectedTeacher.name}!
        </p>
      )}

      {isClosed && (
        <p className="text-xl text-purple-600 text-center">
          การโหวตสิ้นสุดแล้ว — รอประกาศผล...
        </p>
      )}
    </div>
  );
}
