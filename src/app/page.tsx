'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function HomePage() {
  const [voteUrl, setVoteUrl] = useState('');

  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!isLocalhost) {
      setVoteUrl(`${window.location.origin}/vote`);
      return;
    }

    fetch('/api/server-info')
      .then((res) => res.json())
      .then((data) => {
        setVoteUrl(`http://${data.ip}:${data.port}/vote`);
      })
      .catch(() => {
        setVoteUrl(`${window.location.origin}/vote`);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0f0f23] flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl md:text-7xl font-bold text-yellow-400 mb-4 text-center">
        PopVote
      </h1>
      <p className="text-xl md:text-2xl text-gray-300 mb-2 text-center">
        โหวตยอดนิยมแต่งกายครูวันวิทยาศาสตร์
      </p>
      <p className="text-lg text-gray-500 mb-8 text-center">
        สแกน QR Code เพื่อเข้าร่วมโหวต
      </p>

      {voteUrl && (
        <div className="bg-white p-6 rounded-2xl shadow-2xl shadow-yellow-500/20">
          <QRCodeSVG
            value={voteUrl}
            size={280}
            level="H"
            includeMargin={false}
          />
        </div>
      )}

      <p className="mt-6 text-gray-500 text-sm">
        หรือเข้าที่: <span className="text-yellow-400 font-mono">{voteUrl}</span>
      </p>

      <div className="mt-12 flex gap-4 text-sm text-gray-600">
        <a href="/admin" className="hover:text-gray-400 transition underline">
          Admin
        </a>
        <a href="/dashboard" className="hover:text-gray-400 transition underline">
          Dashboard
        </a>
      </div>
    </div>
  );
}
