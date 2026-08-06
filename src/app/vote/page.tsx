'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { GameState, Teacher } from '@/lib/types';

export default function VotePage() {
  const [state, setState] = useState<GameState | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isPopping, setIsPopping] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [countdown, setCountdown] = useState<string>('');
  const [showRing, setShowRing] = useState(false);
  const ringKey = useRef(0);

  useEffect(() => {
    const socket = getSocket();

    socket.on('state-update', (data: GameState) => {
      setState(data);
    });

    socket.on('vote-opened', () => {
      setTapCount(0);
    });

    return () => {
      socket.off('state-update');
      socket.off('vote-opened');
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

  const handleTap = useCallback(() => {
    if (!selectedTeacher || state?.status !== 'voting') return;

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
  }, [selectedTeacher, state?.status]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f23]">
        <div className="text-xl text-gray-400">กำลังเชื่อมต่อ...</div>
      </div>
    );
  }

  // Step 1: Select teacher
  if (!selectedTeacher) {
    return (
      <div className="min-h-screen bg-[#0f0f23] p-4 flex flex-col">
        <h1 className="text-2xl font-bold text-center text-yellow-400 mb-2">
          PopVote
        </h1>
        <p className="text-center text-gray-400 mb-6">เลือกครูที่คุณชอบ</p>

        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto w-full">
          {state.teachers.map((t: Teacher) => (
            <button
              key={t.id}
              onClick={() => setSelectedTeacher(t)}
              className="bg-[#1a1a3e] rounded-xl p-4 flex flex-col items-center gap-3 active:scale-95 transition-transform hover:bg-[#2a2a5e]"
            >
              <img
                src={t.image}
                alt={t.name}
                className="w-24 h-24 rounded-full object-cover border-3 border-blue-500"
              />
              <span className="font-semibold text-lg">{t.name}</span>
            </button>
          ))}
        </div>

        {state.teachers.length === 0 && (
          <p className="text-center text-gray-500 mt-12">รอแอดมินเพิ่มครู...</p>
        )}
      </div>
    );
  }

  // Step 2: Waiting or Voting
  const isVoting = state.status === 'voting';
  const isClosed = state.status === 'closed' || state.status === 'finalized';

  return (
    <div className="min-h-screen bg-[#0f0f23] flex flex-col items-center justify-center p-4 select-none">
      {/* Teacher info */}
      <div className="text-center mb-6">
        <img
          src={selectedTeacher.image}
          alt={selectedTeacher.name}
          className="w-20 h-20 rounded-full object-cover mx-auto border-3 border-yellow-400 mb-2"
        />
        <p className="text-lg font-semibold text-yellow-400">{selectedTeacher.name}</p>
        <button
          onClick={() => {
            setSelectedTeacher(null);
            setTapCount(0);
          }}
          className="text-sm text-gray-400 underline mt-1 active:text-white"
        >
          เปลี่ยนครู
        </button>
      </div>

      {/* Countdown */}
      {countdown && (
        <div className="text-4xl font-mono text-yellow-400 mb-4">{countdown}</div>
      )}

      {/* Tap Button */}
      <div className="relative mb-6">
        {showRing && (
          <div
            key={ringKey.current}
            className="absolute inset-0 rounded-full border-4 border-yellow-400 animate-pulse-ring pointer-events-none"
          />
        )}
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            handleTap();
          }}
          disabled={!isVoting}
          className={`
            w-48 h-48 rounded-full text-6xl font-bold
            flex items-center justify-center
            transition-all duration-100 touch-manipulation
            ${isVoting
              ? `bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-lg shadow-yellow-500/30 active:shadow-inner cursor-pointer ${isPopping ? 'animate-pop' : ''}`
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
          style={{ WebkitTapHighlightColor: 'transparent', userSelect: 'none' }}
        >
          {isVoting ? '👆' : (isClosed ? '⏹' : '⏳')}
        </button>
      </div>

      {/* Status messages */}
      {!isVoting && !isClosed && (
        <p className="text-xl text-gray-400 text-center">
          รอแอดมินเปิดโหวต...
        </p>
      )}

      {isVoting && (
        <p className="text-lg text-green-400 font-semibold">
          กดเร็วๆ เพื่อช่วยครู {selectedTeacher.name}!
        </p>
      )}

      {isClosed && (
        <p className="text-xl text-purple-400 text-center">
          การโหวตสิ้นสุดแล้ว!
        </p>
      )}
    </div>
  );
}
