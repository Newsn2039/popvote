'use client';

import { useEffect, useState, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { GameState, Teacher } from '@/lib/types';

export default function AdminPage() {
  const [state, setState] = useState<GameState>({
    status: 'idle',
    teachers: [],
    votingEndsAt: null,
    durationMinutes: 3,
    connectedClients: 0,
  });
  const [name, setName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [duration, setDuration] = useState(3);
  const [countdown, setCountdown] = useState<string>('');
  const [connectedCount, setConnectedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('state-update', (data: GameState) => {
      setState(data);
    });

    socket.on('connected-count', (data: { count: number }) => {
      setConnectedCount(data.count);
    });

    return () => {
      socket.off('state-update');
      socket.off('connected-count');
    };
  }, []);

  useEffect(() => {
    if (!state.votingEndsAt || state.status !== 'voting') {
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
  }, [state.votingEndsAt, state.status]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addTeacher = async () => {
    if (!name.trim()) return;

    let imageUrl = '/uploads/default.png';
    if (imageFile) {
      const formData = new FormData();
      formData.append('file', imageFile);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      imageUrl = data.url;
    }

    getSocket().emit('admin:add-teacher', { name: name.trim(), image: imageUrl });
    setName('');
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeTeacher = (id: string) => {
    getSocket().emit('admin:remove-teacher', { teacherId: id });
  };

  const openVote = (keepScores = false) => {
    getSocket().emit('admin:open-vote', { durationMinutes: duration, keepScores });
  };

  const closeVote = () => {
    getSocket().emit('admin:close-vote');
  };

  const finalize = () => {
    getSocket().emit('admin:finalize');
  };

  const reset = () => {
    getSocket().emit('admin:reset');
  };

  const statusLabel: Record<string, string> = {
    idle: 'ยังไม่เริ่ม',
    waiting: 'รอเปิดโหวต',
    voting: 'กำลังโหวต',
    closed: 'ปิดโหวตแล้ว (ยังไม่รวมคะแนน)',
    finalized: 'สิ้นสุด — แสดงผลแล้ว',
  };

  const statusColor: Record<string, string> = {
    idle: 'bg-gray-600',
    waiting: 'bg-yellow-600',
    voting: 'bg-green-600',
    closed: 'bg-orange-600',
    finalized: 'bg-purple-600',
  };

  return (
    <div className="min-h-screen bg-[#0f0f23] p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-2 text-yellow-400">
        PopVote Admin
      </h1>
      <p className="text-center text-gray-400 mb-6">จัดการการโหวตแต่งกายครูวันวิทยาศาสตร์</p>

      {/* Status Bar */}
      <div className="bg-[#1a1a3e] rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${statusColor[state.status]}`}>
            {statusLabel[state.status]}
          </span>
          {countdown && (
            <span className="text-2xl font-mono text-yellow-400">{countdown}</span>
          )}
        </div>
        <div className="text-gray-300">
          ผู้เชื่อมต่อ: <span className="text-green-400 font-bold">{connectedCount}</span> คน
        </div>
      </div>

      {/* Add Teacher */}
      {(state.status === 'idle' || state.status === 'finalized') && (
        <div className="bg-[#1a1a3e] rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-300">เพิ่มครูเข้าแข่งขัน</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="ชื่อครู"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-4 py-3 bg-[#2a2a5e] rounded-lg text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && addTeacher()}
            />
            <div className="flex gap-2 items-center">
              <label className="px-4 py-3 bg-[#2a2a5e] rounded-lg cursor-pointer hover:bg-[#3a3a6e] transition text-gray-300">
                {imagePreview ? 'เปลี่ยนรูป' : 'เลือกรูป'}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
              {imagePreview && (
                <img src={imagePreview} alt="preview" className="w-12 h-12 rounded-full object-cover" />
              )}
            </div>
            <button
              onClick={addTeacher}
              disabled={!name.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg font-semibold transition"
            >
              เพิ่ม
            </button>
          </div>
        </div>
      )}

      {/* Teacher List */}
      <div className="bg-[#1a1a3e] rounded-xl p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-blue-300">
          ครูที่เข้าแข่งขัน ({state.teachers.length})
        </h2>
        {state.teachers.length === 0 ? (
          <p className="text-gray-500 text-center py-8">ยังไม่มีครู — เพิ่มครูด้านบน</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {state.teachers.map((t: Teacher) => (
              <div key={t.id} className="bg-[#2a2a5e] rounded-lg p-3 text-center relative group">
                <img
                  src={t.image}
                  alt={t.name}
                  className="w-20 h-20 rounded-full mx-auto mb-2 object-cover border-2 border-blue-500"
                />
                <p className="font-medium text-sm">{t.name}</p>
                {(state.status === 'idle' || state.status === 'finalized') && (
                  <button
                    onClick={() => removeTeacher(t.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 text-xs opacity-0 group-hover:opacity-100 transition"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vote Controls */}
      <div className="bg-[#1a1a3e] rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4 text-blue-300">ควบคุมการโหวต</h2>

        {state.status === 'idle' && state.teachers.length >= 2 && (
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div>
              <label className="block text-sm text-gray-400 mb-1">จำกัดเวลา (นาที)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-24 px-3 py-2 bg-[#2a2a5e] rounded-lg text-white outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={() => openVote()}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg transition"
            >
              เปิดโหวต
            </button>
          </div>
        )}

        {state.status === 'idle' && state.teachers.length < 2 && (
          <p className="text-gray-500">ต้องมีครูอย่างน้อย 2 คนจึงจะเปิดโหวตได้</p>
        )}

        {state.status === 'voting' && (
          <button
            onClick={closeVote}
            className="px-8 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold text-lg transition"
          >
            ปิดโหวต
          </button>
        )}

        {state.status === 'closed' && (
          <div className="space-y-3">
            <p className="text-yellow-400">โหวตปิดแล้ว — คะแนนยังไม่ถูกเปิดเผย</p>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-400 mb-1">จำกัดเวลา (นาที)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-[#2a2a5e] rounded-lg text-white outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button
                onClick={() => openVote(true)}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg transition"
              >
                เปิดโหวตอีกรอบ
              </button>
            </div>
            <button
              onClick={finalize}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold text-lg transition"
            >
              สิ้นสุดการโหวตและรวมคะแนน
            </button>
          </div>
        )}

        {state.status === 'finalized' && (
          <div className="space-y-3">
            <p className="text-green-400">แสดงผลคะแนนบนแดชบอร์ดแล้ว</p>
            <button
              onClick={reset}
              className="px-8 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-bold text-lg transition"
            >
              รีเซ็ต (เริ่มรอบใหม่)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
