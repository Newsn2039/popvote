'use client';

import { useEffect, useState, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { GameState, Teacher } from '@/lib/types';

const ADMIN_PASSWORD = 'pop2026';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

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
  const [durationMin, setDurationMin] = useState(3);
  const [durationSec, setDurationSec] = useState(0);
  const [countdown, setCountdown] = useState<string>('');
  const [connectedCount, setConnectedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-auth');
    if (saved === 'true') setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
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
  }, [isAuthenticated]);

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

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError(false);
      sessionStorage.setItem('admin-auth', 'true');
    } else {
      setPasswordError(true);
    }
  };

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

    let imageUrl = '';
    if (imageFile) {
      const reader = new FileReader();
      imageUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(imageFile);
      });
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
    const totalSeconds = durationMin * 60 + durationSec;
    getSocket().emit('admin:open-vote', { durationSeconds: totalSeconds, keepScores });
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
    idle: 'bg-gray-500',
    waiting: 'bg-yellow-500',
    voting: 'bg-green-500',
    closed: 'bg-orange-500',
    finalized: 'bg-purple-500',
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center text-indigo-700 mb-2">PopularVote Admin</h1>
          <p className="text-center text-gray-500 mb-6">กรุณาใส่รหัสผ่านเพื่อเข้าสู่ระบบ</p>
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className={`w-full px-4 py-3 bg-gray-100 rounded-lg text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-400 border ${passwordError ? 'border-red-400' : 'border-gray-200'} mb-3`}
            autoFocus
          />
          {passwordError && (
            <p className="text-red-500 text-sm mb-3">รหัสผ่านไม่ถูกต้อง</p>
          )}
          <button
            onClick={handleLogin}
            className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition text-white"
          >
            เข้าสู่ระบบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-2 text-indigo-700">
        PopularVote Admin
      </h1>
      <p className="text-center text-gray-500 mb-6">จัดการการโหวตประกวดครู</p>

      {/* Status Bar */}
      <div className="bg-white rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${statusColor[state.status]}`}>
            {statusLabel[state.status]}
          </span>
          {countdown && (
            <span className="text-2xl font-mono text-indigo-600">{countdown}</span>
          )}
        </div>
        <div className="text-gray-600">
          ผู้เชื่อมต่อ: <span className="text-green-600 font-bold">{connectedCount}</span> คน
        </div>
      </div>

      {/* Add Teacher */}
      {(state.status === 'idle' || state.status === 'finalized') && (
        <div className="bg-white rounded-xl p-6 mb-6 shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-indigo-600">เพิ่มครูเข้าแข่งขัน</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="ชื่อครู"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-4 py-3 bg-gray-100 rounded-lg text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-400 border border-gray-200"
              onKeyDown={(e) => e.key === 'Enter' && addTeacher()}
            />
            <div className="flex gap-2 items-center">
              <label className="px-4 py-3 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition text-gray-600 border border-gray-200">
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
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-lg font-semibold transition text-white"
            >
              เพิ่ม
            </button>
          </div>
        </div>
      )}

      {/* Teacher List */}
      <div className="bg-white rounded-xl p-6 mb-6 shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-indigo-600">
          ครูที่เข้าแข่งขัน ({state.teachers.length})
        </h2>
        {state.teachers.length === 0 ? (
          <p className="text-gray-400 text-center py-8">ยังไม่มีครู — เพิ่มครูด้านบน</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {state.teachers.map((t: Teacher) => (
              <div key={t.id} className="bg-indigo-50 rounded-lg p-3 text-center relative group border border-indigo-100">
                {t.image ? (
                  <img
                    src={t.image}
                    alt={t.name}
                    className="w-20 h-20 rounded-full mx-auto mb-2 object-cover border-2 border-indigo-400"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full mx-auto mb-2 bg-indigo-200 flex items-center justify-center text-3xl border-2 border-indigo-400">
                    {t.name.charAt(0)}
                  </div>
                )}
                <p className="font-medium text-sm text-gray-700">{t.name}</p>
                {(state.status === 'idle' || state.status === 'finalized') && (
                  <button
                    onClick={() => removeTeacher(t.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100 transition"
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
      <div className="bg-white rounded-xl p-6 shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-indigo-600">ควบคุมการโหวต</h2>

        {state.status === 'idle' && state.teachers.length >= 2 && (
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex gap-2 items-end">
              <div>
                <label className="block text-sm text-gray-500 mb-1">นาที</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                  className="w-20 px-3 py-2 bg-gray-100 rounded-lg text-gray-800 outline-none focus:ring-2 focus:ring-green-400 border border-gray-200"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">วินาที</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="w-20 px-3 py-2 bg-gray-100 rounded-lg text-gray-800 outline-none focus:ring-2 focus:ring-green-400 border border-gray-200"
                />
              </div>
            </div>
            <button
              onClick={() => openVote()}
              className="px-8 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-bold text-lg transition text-white"
            >
              เปิดโหวต
            </button>
          </div>
        )}

        {state.status === 'idle' && state.teachers.length < 2 && (
          <p className="text-gray-400">ต้องมีครูอย่างน้อย 2 คนจึงจะเปิดโหวตได้</p>
        )}

        {state.status === 'voting' && (
          <button
            onClick={closeVote}
            className="px-8 py-3 bg-orange-500 hover:bg-orange-600 rounded-lg font-bold text-lg transition text-white"
          >
            ปิดโหวต
          </button>
        )}

        {state.status === 'closed' && (
          <div className="space-y-3">
            <p className="text-orange-600 font-medium">โหวตปิดแล้ว — คะแนนยังไม่ถูกเปิดเผย</p>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-500 mb-1">จำกัดเวลา (นาที)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-gray-100 rounded-lg text-gray-800 outline-none focus:ring-2 focus:ring-green-400 border border-gray-200"
                />
              </div>
              <button
                onClick={() => openVote(true)}
                className="px-8 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-bold text-lg transition text-white"
              >
                เปิดโหวตอีกรอบ
              </button>
            </div>
            <button
              onClick={finalize}
              className="px-8 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-bold text-lg transition text-white"
            >
              สิ้นสุดการโหวตและรวมคะแนน
            </button>
          </div>
        )}

        {state.status === 'finalized' && (
          <div className="space-y-3">
            <p className="text-green-600 font-medium">แสดงผลคะแนนบนแดชบอร์ดแล้ว</p>
            <button
              onClick={reset}
              className="px-8 py-3 bg-gray-500 hover:bg-gray-600 rounded-lg font-bold text-lg transition text-white"
            >
              รีเซ็ต (เริ่มรอบใหม่)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
