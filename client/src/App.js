import React, { useState, useEffect, useRef, useMemo } from 'react';
import socket from './socket';
import {
  generateKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret,
  encryptMessage, decryptMessage, processFingerprint, bindBiometricKey,
  commutativeCrypt, tryDecodeContent,
  encryptFile, decryptFile,
  wrapPrivateKey, unwrapPrivateKey
} from './utils/crypto';

// === 全局样式 (修复重叠、拉伸与服务器区域) ===
const globalStyles = `
  :root {
    --bg-color: #0b0c10; --text-color: #e0e0e0; --text-secondary: #a0a0a0;
    --card-bg: #1f2833; --chat-bg: #121212;
    --sidebar-bg: rgba(31, 40, 51, 0.7);
    --primary: #00cec9; --primary-glow: rgba(0, 206, 201, 0.5);
    --danger: #ff4d4f; --success: #2ecc71; --process: #f1c40f;
    --orbit-line: rgba(255, 255, 255, 0.1);
    --bubble-self: #00cec9; --bubble-other: #2c2c2c;
    --input-bg: rgba(255, 255, 255, 0.05);
    --border-color: rgba(255,255,255,0.1);
    --shadow-color: rgba(0,0,0,0.5);
    --sun-shadow: 0 0 50px rgba(0, 206, 201, 0.6);
  }
  
  [data-theme='light'] {
    --bg-color: #f0f2f5; --text-color: #333333; --text-secondary: #666666;
    --card-bg: #ffffff; --chat-bg: #ffffff;
    --sidebar-bg: rgba(255, 255, 255, 0.8);
    --primary: #007bff; --primary-glow: rgba(0, 123, 255, 0.3);
    --danger: #dc3545; --success: #28a745; --process: #f39c12;
    --orbit-line: rgba(0, 0, 0, 0.1);
    --bubble-self: #007bff; --bubble-other: #f1f0f0;
    --input-bg: #f8f9fa; --border-color: #e0e0e0;
    --shadow-color: rgba(0,0,0,0.1);
    --sun-shadow: 0 0 20px rgba(0, 123, 255, 0.4);
  }

  .icon-group { display: flex !important; flex-direction: row !important; gap: 15px; align-items: center; }
  
  body, div, button, input, .planet, .chat-modal, .message-bubble, .sidebar {
    transition: background-color 0.6s cubic-bezier(0.25, 0.8, 0.25, 1),
                color 0.6s cubic-bezier(0.25, 0.8, 0.25, 1),
                border-color 0.6s cubic-bezier(0.25, 0.8, 0.25, 1),
                box-shadow 0.6s cubic-bezier(0.25, 0.8, 0.25, 1);
  }

  body { margin: 0; background-color: var(--bg-color); color: var(--text-color); font-family: 'Segoe UI', monospace; overflow: hidden; }

  .login-card { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--card-bg); padding: 40px; border-radius: 12px; box-shadow: 0 10px 30px var(--shadow-color); text-align: center; width: 350px; border: 1px solid var(--border-color); }
  .galaxy-bg { position: fixed; inset: 0; z-index: -1; pointer-events: none; transition: opacity 0.8s ease; }
  [data-theme='light'] .galaxy-bg { opacity: 0; }
  .star { position: absolute; background: #fff; border-radius: 50%; animation: twinkle 3s infinite; }
  @keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.8; } }

  .sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: 280px; background: var(--sidebar-bg); backdrop-filter: blur(10px); border-right: 1px solid var(--border-color); z-index: 100; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
  .sidebar-header { font-size: 14px; font-weight: bold; color: var(--text-secondary); letter-spacing: 1px; margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; }
  .friend-list-item { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; background: var(--input-bg); border: 1px solid var(--border-color); cursor: pointer; transition: 0.2s; }
  .friend-list-item:hover { background: var(--card-bg); border-color: var(--primary); }
  .friend-list-item.active { border-color: var(--primary); background: rgba(0, 206, 201, 0.1); }
  .friend-info { flex: 1; overflow: hidden; }
  .orbit-checkbox { width: 16px; height: 16px; border-radius: 4px; border: 2px solid var(--text-secondary); display: flex; align-items: center; justify-content: center; transition: 0.2s; flex-shrink: 0; }
  .friend-list-item.active .orbit-checkbox { background: var(--primary); border-color: var(--primary); }
  .friend-list-item.active .orbit-checkbox::after { content: '✔'; font-size: 10px; color: #fff; }
  .sidebar-actions { display: flex; gap: 5px; margin-left: 5px; }
  .mini-btn { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 12px; padding: 4px; border-radius: 4px; opacity: 0.6; transition: 0.2s; }
  .friend-list-item:hover .mini-btn { opacity: 1; } 
  .mini-btn:hover { background: var(--primary); color: #fff; }
  .mini-btn.danger:hover { background: var(--danger); color: #fff; }

  .sun { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80px; height: 80px; background: var(--primary); border-radius: 50%; box-shadow: var(--sun-shadow); z-index: 10; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #fff; font-size: 20px; cursor: default; border: 4px solid rgba(255,255,255,0.2); }
  .planet { position: absolute; width: 50px; height: 50px; transform: translate(-50%, -50%); border-radius: 50%; background: var(--card-bg); border: 2px solid var(--text-color); color: var(--text-color); box-shadow: 0 0 10px var(--shadow-color); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; }
  .planet:hover { z-index: 100; transform: translate(-50%, -50%) scale(1.1); }
  .planet.active { width: 70px; height: 70px; border-color: var(--primary); z-index: 100; box-shadow: 0 0 30px var(--primary); color: var(--primary); }
  .notification-dot { position: absolute; top: -2px; right: -2px; width: 12px; height: 12px; background: var(--danger); border-radius: 50%; border: 2px solid var(--bg-color); animation: pulseRed 1s infinite; }
  .planet-label { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); background: var(--card-bg); color: var(--text-color); padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-top: 5px; white-space: nowrap; pointer-events: none; border: 1px solid var(--border-color); max-width: 100px; overflow: hidden; text-overflow: ellipsis; }
  .action-menu { position: absolute; top: 50%; left: 100%; margin-left: 15px; transform: translateY(-50%); background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; width: 140px; box-shadow: 0 5px 20px var(--shadow-color); z-index: 200; }
  .menu-btn { background: var(--input-bg); color: var(--text-color); border: 1px solid var(--border-color); padding: 8px; border-radius: 4px; cursor: pointer; text-align: center; font-size: 12px; }
  .menu-btn:hover { background: var(--primary); color: #fff; }
  .menu-btn.danger { color: var(--danger); border-color: var(--danger); }
  .menu-btn.danger:hover { background: var(--danger); color: #fff; }

  .chat-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 850px; height: 700px; background: var(--chat-bg); border-radius: 12px; border: 1px solid var(--border-color); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px var(--shadow-color); z-index: 500; }
  .chat-header-row { padding: 15px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--card-bg); width: 100%; box-sizing: border-box; }
  .chat-header-security { padding: 10px 20px; background: var(--bg-color); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; }
  .security-status { font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px; }
  .security-status.secure { color: var(--success); }
  .security-status.standard { color: var(--text-secondary); }
  .bio-deck { background: var(--bg-color); padding: 5px 20px; display: flex; align-items: center; gap: 10px; }
  .scanner-btn { position: relative; overflow: hidden; display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-radius: 20px; border: 1px solid var(--primary); color: var(--primary); background: rgba(0,0,0,0.1); cursor: pointer; font-size: 11px; font-weight: bold; }
  .scanner-btn:hover { background: var(--primary-glow); }
  .scan-line { position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); transform: skewX(-20deg); animation: shine 3s infinite; pointer-events: none; }
  @keyframes shine { 0% { left: -100%; } 20% { left: 200%; } 100% { left: 200%; } }
  .status-badge { padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; letter-spacing: 1px; background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-secondary); }
  .status-badge.active { border-color: var(--success); color: var(--success); background: rgba(46, 204, 113, 0.1); }

  /* === 新增与修复：服务器区域与动态定位重叠解决 === */
  .crypto-anim-overlay { position: absolute; inset: 0; background: rgba(18, 18, 18, 0.9); backdrop-filter: blur(8px); z-index: 1000; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; }
  
  /* 舞台加宽到 90%，确保左右两端有充足空间停靠 */
  .crypto-stage { position: relative; width: 90%; height: 120px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px dashed rgba(255,255,255,0.2); }
  
  .crypto-node { width: 70px; height: 70px; border-radius: 50%; background: var(--card-bg); border: 2px solid var(--text-secondary); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; z-index: 3; box-shadow: 0 0 15px rgba(0,0,0,0.5); font-size: 12px; text-align: center; line-height: 1.2; }
  .crypto-node.me { border-color: var(--primary); box-shadow: 0 0 15px var(--primary-glow); }
  .crypto-node.bob { border-color: #ffbe76; box-shadow: 0 0 15px rgba(255, 190, 118, 0.5); }
  
  /* 修复 1：缩小服务器高亮区，防止包裹停靠时还处于红框内 */
  .server-zone { position: absolute; left: 50%; transform: translateX(-50%); width: 220px; height: 100px; border-left: 2px dashed rgba(255, 77, 79, 0.5); border-right: 2px dashed rgba(255, 77, 79, 0.5); background: rgba(255, 77, 79, 0.05); display: flex; align-items: flex-end; justify-content: center; padding-bottom: 10px; font-size: 11px; color: var(--danger); opacity: 0.9; border-radius: 8px; z-index: 1; letter-spacing: 1px; font-weight: bold; }

  /* 修复 2：优化包裹文字，禁止拉伸 */
  .crypto-packet { position: absolute; top: 15px; background: #2c3e50; color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: bold; display: flex; align-items: center; gap: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 4; transition: background 0.4s; border: 1px solid rgba(255,255,255,0.1); white-space: nowrap; width: max-content; }
  
  /* 强制 Data 文字不拉伸 */
  .data-label { flex-shrink: 0; display: inline-block; }

  .crypto-lock { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; font-size: 12px; font-weight: bold; position: relative; flex-shrink: 0; }
  .my-lock { background: #00cec9; color: #000; border: 2px solid #00a8a8; border-radius: 4px; } 
  .his-lock { background: #ff4d4f; color: #fff; border: 2px solid #d9363e; border-radius: 20px; }

  .unlocking { animation: breakLock 0.8s forwards ease-in; }
  @keyframes breakLock {
    0% { transform: scale(1); opacity: 1; filter: brightness(1); }
    50% { transform: scale(1.1); opacity: 1; filter: brightness(1.5); }
    100% { transform: scale(1.5); opacity: 0; filter: blur(5px); }
  }
  .anim-key { position: absolute; top: -18px; right: -15px; font-size: 20px; animation: insertKey 0.8s forwards; opacity: 0; z-index: 10; filter: drop-shadow(0 0 5px rgba(255,255,255,0.8)); }
  @keyframes insertKey {
    0% { transform: translate(15px, -15px) rotate(45deg); opacity: 0; }
    30% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
    70% { transform: translate(0, 0) rotate(-45deg); opacity: 1; }
    100% { transform: translate(0, 0) rotate(-45deg); opacity: 0; }
  }

  /* 修复 3：终极防重叠定位算法。
     不论包裹多宽，pos-bob 永远让包裹的右边缘距离容器右侧 80px (正好贴在 Bob 节点旁边) */
  .pos-me { left: 80px; transform: translateX(0); }
  .pos-bob { left: 100%; transform: translateX(calc(-100% - 80px)); } 
  
  .fly-right { animation: flyToRight 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
  .fly-left { animation: flyToLeft 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
  
  /* 动态计算终点，彻底解决响应式重叠 */
  @keyframes flyToRight { 
    0% { left: 80px; transform: translateX(0); } 
    100% { left: 100%; transform: translateX(calc(-100% - 80px)); } 
  }
  @keyframes flyToLeft { 
    0% { left: 100%; transform: translateX(calc(-100% - 80px)); } 
    100% { left: 80px; transform: translateX(0); } 
  }

  .pulse-success { background: #2ecc71 !important; color: white; border-color: #27ae60; animation: pulseWin 1s infinite; }
  @keyframes pulseWin { 0%, 100% { box-shadow: 0 0 15px #2ecc71; } 50% { box-shadow: 0 0 30px #2ecc71; } }

  .anim-text { font-size: 16px; font-weight: bold; letter-spacing: 1px; color: var(--primary); text-align: center; margin-top: 20px; animation: pulseText 1s infinite; height: 30px; }
  @keyframes pulseText { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }

  /* 其余聊天组件样式保持不变 */
  .chat-messages { flex: 1; padding: 20px; overflow-y: auto; background: var(--chat-bg); display: flex; flex-direction: column; gap: 15px; }
  .message-bubble { padding: 10px 15px; border-radius: 12px; max-width: 70%; position: relative; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
  .message-bubble.self { align-self: flex-end; background: var(--bubble-self); color: #fff; border-bottom-right-radius: 2px; }
  .message-bubble.other { align-self: flex-start; background: var(--bubble-other); color: var(--text-color); border-bottom-left-radius: 2px; border: 1px solid var(--border-color); }
  .message-bubble.process { background: transparent; border: 1px dashed var(--border-color); color: var(--text-secondary); font-family: monospace; font-size: 11px; text-align: center; width: 100%; max-width: 100%; border-radius: 4px; padding: 5px; }
  .message-info { font-size: 10px; margin-bottom: 4px; color: var(--text-secondary); opacity: 0.8; }
  .chat-img { max-width: 200px; border-radius: 8px; margin-top: 5px; border: 1px solid var(--border-color); }
  .chat-footer { padding: 15px 20px; background: var(--card-bg); border-top: 1px solid var(--border-color); display: flex; align-items: center; gap: 12px; }
  .chat-input { flex: 1; background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-color); padding: 12px 15px; border-radius: 20px; outline: none; font-family: inherit; font-size: 14px; }
  .icon-btn { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-secondary); transition: 0.2s; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; }
  .icon-btn:hover { color: var(--primary); background: var(--input-bg); transform: scale(1.1); }
  .btn-send { background: var(--primary); color: #fff; border: none; padding: 10px 24px; border-radius: 20px; cursor: pointer; font-weight: bold; }

  .radar-overlay { position: fixed; inset: 0; z-index: 40; background: radial-gradient(circle, transparent 30%, rgba(0,0,0,0.8)); }
  .radar-container { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; height: 600px; border-radius: 50%; }
  .radar-scan { position: absolute; inset: 0; background: conic-gradient(transparent 0deg, rgba(0, 206, 201, 0.3) 60deg, transparent 65deg); border-radius: 50%; animation: scan 4s linear infinite; pointer-events: none; }
  @keyframes scan { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .radar-line { position: absolute; inset: 0; border: 1px solid var(--primary); border-radius: 50%; opacity: 0.3; }
  .radar-dot { position: absolute; width: 20px; height: 20px; background: var(--danger); border-radius: 50%; cursor: pointer; box-shadow: 0 0 15px var(--danger); animation: pulse 1s infinite; margin-left: -10px; margin-top: -10px; }
  @keyframes pulse { 0% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.4); } 100% { transform: translate(-50%, -50%) scale(1); } }

  .notification-center { position: fixed; bottom: 90px; right: 20px; width: 300px; display: flex; flex-direction: column; gap: 10px; z-index: 2000; }
  .notify-card { background: var(--card-bg); border: 1px solid var(--primary); border-left: 4px solid var(--primary); padding: 15px; border-radius: 8px; box-shadow: 0 5px 20px var(--shadow-color); color: var(--text-color); animation: slideLeft 0.3s ease; display: flex; flex-direction: column; gap: 10px; }
  .dock { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--card-bg); padding: 10px 25px; border-radius: 40px; display: flex; gap: 20px; border: 1px solid var(--border-color); z-index: 1000; box-shadow: 0 10px 30px var(--shadow-color); }
  .dock button { background: transparent; border: none; font-size: 20px; cursor: pointer; transition: 0.2s; color: var(--text-color); }
  input.form-input { background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-color); padding: 12px; border-radius: 8px; outline: none; width: 100%; box-sizing: border-box; }
  .btn-primary { background: var(--primary); color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight:bold; width: 100%; }
`;

const MAGIC_TAG = "::SECURE::"; 

function App() {
  const [step, setStep] = useState('login'); 
  const [theme, setTheme] = useState('dark');
  const [myId, setMyId] = useState('');
  const [password, setPassword] = useState(''); 
  
  const [friends, setFriends] = useState([]); 
  const [selectedFriend, setSelectedFriend] = useState(null); 
  
  const [radarOn, setRadarOn] = useState(false);
  const [radarChannel, setRadarChannel] = useState('000'); 
  const [nearby, setNearby] = useState([]); 
  const [notifications, setNotifications] = useState([]); 
  
  const [chatOpen, setChatOpen] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [inputMsg, setInputMsg] = useState('');
  const [messageStore, setMessageStore] = useState({}); 
  
  const [mode, setMode] = useState('STANDARD');
  
  const [animState, setAnimState] = useState(null); 
  
  const myKeys = useRef(null);
  const sharedSecret = useRef(null); 
  const sharedSecrets = useRef({}); 
  const bioKeyRef = useRef(null); 
  
  const fileInputRef = useRef(null);
  const bioInputRef = useRef(null);
  const chatEndRef = useRef(null);

  const stars = useMemo(() => Array.from({ length: 100 }).map(() => ({
    left: Math.random() * 100 + '%', top: Math.random() * 100 + '%', delay: Math.random() * 3 + 's'
  })), []);

  useEffect(() => {
    if (step !== 'galaxy') return;
    const interval = setInterval(() => {
      setFriends(prev => prev.map(f => {
        if (!f.selected && selectedFriend !== f.id) return f;
        let newAngle = f.angle + f.speed;
        if (newAngle >= 360) newAngle -= 360;
        return { ...f, angle: newAngle };
      }));
    }, 30); 
    return () => clearInterval(interval);
  }, [step, selectedFriend]);

  const toggleFriendSelection = (id) => {
      setFriends(prev => {
          const tempFriends = prev.map(f => f.id === id ? { ...f, selected: !f.selected } : f);
          const activeCount = tempFriends.filter(f => f.selected).length;
          if (activeCount > 4) { alert("ORBIT LIMIT REACHED: Max 4 favorites."); return prev; }

          let activeIndex = 0;
          return tempFriends.map(f => {
              if (f.selected) {
                  const separation = 360 / activeCount;
                  const newRadius = 180 + (activeIndex * 50); 
                  const newAngle = activeIndex * separation;
                  activeIndex++;
                  return { ...f, angle: newAngle, radius: newRadius };
              }
              return f;
          });
      });
  };

  const ensureSharedKey = async (friendId) => {
    if (sharedSecrets.current[friendId]) return sharedSecrets.current[friendId];
    return new Promise((resolve) => {
      socket.emit('get_public_key', friendId, async (res) => {
        if(res.success && myKeys.current) {
          const s = await deriveSharedSecret(myKeys.current.privateKey, await importPublicKey(res.publicKey));
          sharedSecrets.current[friendId] = s;
          resolve(s);
        } else resolve(null);
      });
    });
  };

  const createFriendObject = (id, index = 0) => {
    const colors = ['#e056fd', '#badc58', '#686de0', '#ffbe76', '#ff7979'];
    const baseRadius = 180;
    const radiusStep = 60;
    const layer = index % 3; 
    return {
      id, alias: id, color: colors[Math.floor(Math.random()*colors.length)],
      angle: (index * 45) % 360, speed: 0.05 + Math.random() * 0.1, 
      radius: baseRadius + (layer * radiusStep) + (Math.random() * 20), 
      unread: false, selected: index < 4 
    };
  };

  useEffect(() => {
    socket.on('radar_update', (users) => {
      const others = users.filter(u => u.userId !== myId && !friends.find(f=>f.id===u.userId) && u.channel === radarChannel);
      setNearby(others.map(u => {
        const angle = Math.random() * 2 * Math.PI;
        const radius = 40 + Math.random() * 40; 
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        return { ...u, x, y };
      }));
    });

    socket.on('incoming_friend_request', ({ fromId }) => addNotification({ type: 'request', fromId, id: Date.now() }));
    
    socket.on('force_add_friend', ({ friendId }) => {
        setFriends(prev => {
            if (prev.find(f => f.id === friendId)) return prev;
            if (prev.length >= 8) { alert(`Cannot add ${friendId}: Friend list full (Max 8).`); return prev; }
            return [...prev, createFriendObject(friendId, prev.length)];
        });
        setNearby(prev => prev.filter(u => u.userId !== friendId));
    });

    socket.on('friend_deleted', ({ id }) => {
        setFriends(prev => prev.filter(f => f.id !== id));
        if (targetId === id) setChatOpen(false);
        addNotification({ type: 'system', msg: `${id} disconnected.`, id: Date.now() });
    });
    socket.on('auth_error', ({ message }) => alert(message));

    socket.on('receive_message', async (data) => {
      if (!chatOpen || targetId !== data.senderId) {
        setFriends(prev => prev.map(f => f.id === data.senderId ? { ...f, unread: true } : f));
      }

      if (data.type && data.type.startsWith('3pass-')) {
          if (!bioKeyRef.current) {
              const msg = { ...data, content: "🔒 [LOCKED BY FINGERPRINT]", locked: true, isBiometric: true };
              setMessageStore(prev => ({ ...prev, [data.senderId]: [...(prev[data.senderId] || []), msg] }));
              return;
          }
          const currentCipher = data.ciphertext;
          const nextCipher = commutativeCrypt(currentCipher, bioKeyRef.current);
          
          if (data.type === '3pass-step1') {
              socket.emit('send_message', { senderId: myId, receiverId: data.senderId, ciphertext: nextCipher, type: '3pass-step2', isBiometric: true });
          } else if (data.type === '3pass-step2') {
              socket.emit('send_message', { senderId: myId, receiverId: data.senderId, ciphertext: nextCipher, type: '3pass-step3', isBiometric: true });
          } else if (data.type === '3pass-step3') {
              const result = tryUnlockMessage(nextCipher, data);
              const msg = { ...data, content: result ? result.content : "🔒 [FINGERPRINT MISMATCH]", locked: !result, timestamp: new Date().toLocaleTimeString(), type: result ? result.type : 'text', rawCipher: nextCipher };
              setMessageStore(prev => ({ ...prev, [data.senderId]: [...(prev[data.senderId] || []), msg] }));
          }
          return;
      }

      let content = "🔒 Encrypted";
      let locked = true;
      try {
        const secret = await ensureSharedKey(data.senderId);
        if (secret) {
           content = await decryptMessage(data.ciphertext, data.iv, secret);
           locked = false;
        }
      } catch(e) {}
      const newMsg = { ...data, content, locked, rawCipher: data.ciphertext, rawIv: data.iv, isBiometric: false };
      setMessageStore(prev => ({ ...prev, [data.senderId]: [...(prev[data.senderId] || []), newMsg] }));
    });

    return () => { socket.off('radar_update'); socket.off('incoming_friend_request'); socket.off('force_add_friend'); socket.off('receive_message'); socket.off('auth_error'); socket.off('friend_deleted'); };
  }, [myId, chatOpen, targetId, mode, radarChannel]); 

  const tryUnlockMessage = (cipher, metadata) => {
      const plain = tryDecodeContent(cipher); 
      if (plain && plain.startsWith(MAGIC_TAG)) {
          return { content: plain.substring(MAGIC_TAG.length), type: metadata.isFileType ? 'file' : 'text' };
      }
      return null; 
  };

  const addNotification = (notif) => setNotifications(prev => [...prev, notif]);
  const removeNotification = (id) => setNotifications(prev => prev.filter(n => n.id !== id));
  
  const acceptRequest = (fromId, notifId) => { 
      if (friends.length >= 8) { alert("Friend list full (Max 8)."); removeNotification(notifId); return; }
      socket.emit('accept_friend_request', { myId, friendId: fromId }); 
      removeNotification(notifId); 
  };
  
  const handleRename = (id) => { const n = prompt("Rename to:"); if(n) setFriends(prev => prev.map(f => f.id === id ? { ...f, alias: n } : f)); };
  
  const handleDeleteFriend = (id) => { 
      if(window.confirm(`Delete ${id}?`)) { 
          socket.emit('delete_friend', { myId, friendId: id }); 
          setFriends(prev => prev.filter(f => f.id !== id)); 
          setSelectedFriend(null); 
          if(targetId === id) setChatOpen(false); 
      } 
  };
  
  const handleAuth = (type) => {
    if (!myId || !password) return alert("Missing credentials");
    if (type === 'register') {
      generateKeyPair().then(keys => {
        myKeys.current = keys;
        wrapPrivateKey(keys.privateKey, password).then(wrapped => {
          exportPublicKey(keys.publicKey).then(pubKey => {
            socket.emit('register_user', { userId: myId, publicKey: pubKey, encryptedPrivateKey: wrapped.encryptedKey, keyIv: wrapped.iv, keySalt: wrapped.salt });
            setStep('galaxy');
          });
        });
      });
    } else {
      socket.emit('login_request', myId, (res) => {
        if(res.success) {
           const data = res.data;
           unwrapPrivateKey(data.encryptedPrivateKey, data.keyIv, data.keySalt, password).then(pk => importPublicKey(data.publicKey).then(pub => {
                 myKeys.current = { publicKey: pub, privateKey: pk };
                 if (data.friends) {
                     setFriends(data.friends.map((fid, idx) => createFriendObject(fid, idx)));
                 }
                 socket.emit('register_user', data);
                 setStep('galaxy');
             })).catch(() => alert("Wrong Password"));
        } else { alert(res.error); }
      });
    }
  };

  const startChat = async (id) => {
    setTargetId(id); setSelectedFriend(null); setChatOpen(true); setMode('STANDARD'); 
    setFriends(prev => prev.map(f => f.id === id ? { ...f, unread: false } : f)); 
    if (!messageStore[id]) setMessageStore(prev => ({ ...prev, [id]: [] }));
    const s = await ensureSharedKey(id);
    if (s) sharedSecret.current = s;
  };

  const handleReset = () => {
    setMode('STANDARD');
    bioKeyRef.current = null; 
    setMessageStore(prev => {
        const msgs = prev[targetId] || [];
        const relockedMsgs = msgs.map(m => {
            if (m.isBiometric) return { ...m, locked: true, content: "🔒 [LOCKED BY FINGERPRINT]" };
            return m;
        });
        return { ...prev, [targetId]: relockedMsgs };
    });
  };

  const sendMessage = async () => {
    if(!inputMsg) return;
    
    if (mode === 'ENHANCED') {
        if (!bioKeyRef.current) return alert("Upload Fingerprint First!");
        
        const tempMsg = inputMsg;
        setInputMsg(''); 
        
        setAnimState('step1');
        setTimeout(() => {
            setAnimState('step2');
            setTimeout(() => {
                setAnimState('step3_unlock');
                setTimeout(() => {
                    setAnimState('step3_fly');
                    setTimeout(() => {
                        setAnimState('step4_unlock');
                        setTimeout(() => {
                            setAnimState('success');
                            setTimeout(() => {
                                setAnimState(null); 
                                const taggedMsg = MAGIC_TAG + tempMsg;
                                const cipher1 = commutativeCrypt(taggedMsg, bioKeyRef.current);
                                socket.emit('send_message', { senderId: myId, receiverId: targetId, ciphertext: cipher1, type: '3pass-step1', isBiometric: true });
                                
                                const myMsg = { content: tempMsg, isSelf: true, locked: false, timestamp: new Date().toLocaleTimeString(), type: 'text', isBiometric: true, rawCipher: cipher1 };
                                setMessageStore(prev => ({ ...prev, [targetId]: [...(prev[targetId] || []), myMsg] }));
                            }, 1200);
                        }, 1000); 
                    }, 1200); 
                }, 1000); 
            }, 1200); 
        }, 1200); 
        return;
    }

    const baseKey = await ensureSharedKey(targetId);
    if (!baseKey) return alert("Key exchange failed");
    const { ciphertext, iv } = await encryptMessage(inputMsg, baseKey);
    const payload = { senderId: myId, receiverId: targetId, ciphertext, iv, isBiometric: false, type:'text' };
    socket.emit('send_message', payload);
    const myMsg = { ...payload, content: inputMsg, locked: false, isSelf: true, timestamp: new Date().toLocaleTimeString(), rawCipher: ciphertext, rawIv: iv };
    setMessageStore(prev => ({ ...prev, [targetId]: [...(prev[targetId] || []), myMsg] }));
    setInputMsg('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert("Max 2MB");
    const reader = new FileReader();
    reader.onload = async () => {
        const base64 = reader.result;
        if (mode === 'ENHANCED') {
             if (!bioKeyRef.current) return alert("Upload Fingerprint First!");
             const tagged = MAGIC_TAG + base64;
             const cipher1 = commutativeCrypt(tagged, bioKeyRef.current);
             socket.emit('send_message', { senderId: myId, receiverId: targetId, ciphertext: cipher1, type: '3pass-step1', isBiometric: true, isFileType: true, fileName: file.name, fileType: file.type });
             const myMsg = { content: base64, isSelf: true, locked: false, timestamp: new Date().toLocaleTimeString(), type: 'file', fileName: file.name, fileType: file.type, isBiometric: true };
             setMessageStore(prev => ({ ...prev, [targetId]: [...(prev[targetId] || []), myMsg] }));
             return;
        }
        const baseKey = await ensureSharedKey(targetId);
        const { ciphertext, iv } = await encryptMessage(base64, baseKey);
        const payload = { senderId: myId, receiverId: targetId, ciphertext, iv, isBiometric: false, type: 'file', fileName: file.name, fileType: file.type };
        socket.emit('send_message', payload);
        const myMsg = { ...payload, content: base64, locked: false, isSelf: true, timestamp: new Date().toLocaleTimeString(), rawCipher: ciphertext, rawIv: iv };
        setMessageStore(prev => ({ ...prev, [targetId]: [...(prev[targetId] || []), myMsg] }));
    };
    reader.readAsDataURL(file);
  };

  const handleBioAuth = async (e) => {
    const file = e.target.files[0]; if(!file) return;
    try {
      const bioKey = await processFingerprint(file);
      bioKeyRef.current = bioKey; 
      setMode('ENHANCED'); 
      setMessageStore(prev => {
          const msgs = prev[targetId] || [];
          const unlockedMsgs = msgs.map(m => {
              if (m.isBiometric && m.locked && !m.isSelf && m.rawCipher) {
                  const nextCipher = commutativeCrypt(m.rawCipher, bioKey); 
                  const result = tryUnlockMessage(nextCipher, m);
                  if (result) return { ...m, locked: false, content: result.content, type: result.type };
              }
              return m;
          });
          return { ...prev, [targetId]: unlockedMsgs };
      });
      alert("Bio-Key Loaded.");
    } catch(err) { alert("Bio-Auth Failed"); }
  };

  const handleExportChat = () => {
    const msgs = messageStore[targetId] || [];
    if (msgs.length === 0) return alert("No messages");
    const text = msgs.map(m => `[${m.timestamp}] ${m.isSelf ? myId : targetId}: ${m.type === 'file' ? `[FILE: ${m.fileName}]` : m.content}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `chat_${targetId}.txt`; a.click();
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messageStore, targetId, chatOpen]);
  
  const currentChatFriend = friends.find(f => f.id === targetId);
  const chatTitle = currentChatFriend ? currentChatFriend.alias : targetId;
  let statusText = "🔓 STANDARD";
  let statusClass = "standard";
  if (mode === 'ENHANCED') { statusText = "🔒 ENHANCED (3-PASS)"; statusClass = "secure"; }

  const getPacketClass = () => {
    switch(animState) {
      case 'step1': return 'fly-right';
      case 'step2': return 'fly-left';
      case 'step3_unlock': return 'pos-me';
      case 'step3_fly': return 'fly-right';
      case 'step4_unlock': return 'pos-bob';
      case 'success': return 'pos-bob pulse-success';
      default: return 'pos-me';
    }
  };

  const renderAnimText = () => {
    switch(animState) {
      case 'step1': return "Step 1: Encrypting with your Square Bio-Key...";
      case 'step2': return "Step 2: Friend adds their Round Bio-Key (Double Lock)...";
      case 'step3_unlock': return "Unlocking: Removing your Bio-Key...";
      case 'step3_fly': return "Step 3: Sending back with ONLY Friend's Lock...";
      case 'step4_unlock': return "Unlocking: Friend removes their Bio-Key...";
      case 'success': return "Success: Message received securely!";
      default: return "";
    }
  };

  return (
    <div data-theme={theme} style={{width:'100vw', height:'100vh', position:'relative'}}>
      <style>{globalStyles}</style>
      <div className="galaxy-bg">{stars.map((s,i) => <div key={i} className="star" style={{left:s.left, top:s.top, width:Math.random()*3+'px', height:Math.random()*3+'px', animationDelay:s.delay}} />)}</div>

      {step === 'login' && (
        <div className="login-card">
          <h1 style={{marginBottom:'10px'}}>Schat</h1>
          <input className="form-input" placeholder="Callsign (ID)" value={myId} onChange={e=>setMyId(e.target.value)} style={{marginBottom:'10px'}} />
          <input className="form-input" type="password" placeholder="Access Key" value={password} onChange={e=>setPassword(e.target.value)} style={{marginBottom:'20px'}} />
          <div style={{display:'flex', gap:'10px'}}>
             <button className="btn-primary" onClick={()=>handleAuth('login')}>Login</button>
             <button className="btn-primary" style={{background:'transparent', border:'1px solid var(--primary)', color:'var(--primary)'}} onClick={()=>handleAuth('register')}>Register</button>
          </div>
        </div>
      )}

      {step === 'galaxy' && (
        <>
          <div className="sidebar">
             <div className="sidebar-header">COMMUNICATION UPLINK</div>
             <div style={{fontSize:'10px', color:'var(--text-secondary)', marginBottom:'10px'}}>
               Total: {friends.length}/8 | Active Orbits: {friends.filter(f=>f.selected).length}/4
             </div>
             {friends.map(f => (
               <div key={f.id} className={`friend-list-item ${f.selected ? 'active' : ''}`} onClick={() => toggleFriendSelection(f.id)}>
                  <div className="orbit-checkbox"></div>
                  <div className="friend-info">
                     <div style={{fontSize:'12px', fontWeight:'bold'}}>{f.alias}</div>
                     <div style={{fontSize:'10px', opacity:0.6}}>{f.unread ? 'New Message' : 'Idle'}</div>
                  </div>
                  <div className="sidebar-actions">
                    <button className="mini-btn" title="Rename" onClick={(e) => {e.stopPropagation(); handleRename(f.id)}}>✏️</button>
                    <button className="mini-btn" title="Chat" onClick={(e) => {e.stopPropagation(); startChat(f.id)}}>💬</button>
                    <button className="mini-btn danger" title="Delete" onClick={(e) => {e.stopPropagation(); handleDeleteFriend(f.id)}}>🗑️</button>
                  </div>
               </div>
             ))}
             {friends.length === 0 && <div style={{fontSize:'12px', opacity:0.5, textAlign:'center', marginTop:'20px'}}>No connections.<br/>Use Radar to scan.</div>}
          </div>

          <div style={{position:'absolute', top:'20px', right:'20px', zIndex:50, textAlign:'right'}}>
             <h2 style={{margin:0}}>Schat</h2>
             <div style={{fontSize:'12px', opacity:0.7}}>Cmdr: {myId}</div>
          </div>

          <div className="sun" onClick={()=>setSelectedFriend(null)}>Me</div>

          {friends.map((f) => {
            if (!f.selected) return null;
            const rad = f.angle * (Math.PI / 180);
            const left = `calc(50% + ${Math.cos(rad) * f.radius}px)`;
            const top = `calc(50% + ${Math.sin(rad) * f.radius}px)`;
            const isSelected = selectedFriend === f.id;
            return (
              <div key={f.id} className={`planet ${isSelected?'active':''}`} style={{ left, top }}
                   onClick={(e) => { e.stopPropagation(); setSelectedFriend(isSelected ? null : f.id); }}>
                {f.alias.substring(0,1).toUpperCase()}
                {f.unread && <div className="notification-dot"></div>}
                {!isSelected && <div className="planet-label">{f.alias}</div>}
                {isSelected && (
                  <div className="action-menu" onClick={e=>e.stopPropagation()}>
                    <div style={{fontSize:'12px', textAlign:'center', marginBottom:'5px', borderBottom:'1px solid #444', color:'var(--text-color)'}}>{f.alias}</div>
                    <button className="menu-btn" onClick={()=>handleRename(f.id)}>✏️ Rename</button>
                    <button className="menu-btn" onClick={()=>startChat(f.id)}>💬 Chat</button>
                    <button className="menu-btn danger" onClick={()=>toggleFriendSelection(f.id)}>⬇️ Deorbit</button>
                    <button className="menu-btn" onClick={()=>setSelectedFriend(null)}>✖ Cancel</button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="notification-center">
            {notifications.map((n) => (
              <div key={n.id} className="notify-card">
                {n.type === 'request' && <><div style={{fontSize:'14px'}}>📡 <strong>{n.fromId}</strong> request.</div><div style={{display:'flex', gap:'10px'}}><button className="menu-btn" style={{flex:1, background:'var(--primary)', color:'#fff'}} onClick={()=>acceptRequest(n.fromId, n.id)}>Accept</button><button className="menu-btn danger" style={{flex:1}} onClick={()=>removeNotification(n.id)}>Ignore</button></div></>}
                {n.type === 'system' && <div style={{fontSize:'12px', color:'var(--danger)'}}>{n.msg} <span style={{float:'right', cursor:'pointer'}} onClick={()=>removeNotification(n.id)}>✕</span></div>}
              </div>
            ))}
          </div>
          
          {radarOn && (
            <div className="radar-overlay">
               <div className="radar-container"><div className="radar-line"></div><div className="radar-scan"></div>{nearby.map((u, i) => <div key={i} className="radar-dot" style={{left: u.x+'%', top: u.y+'%'}} onClick={() => { socket.emit('send_friend_request', { fromId: myId, toId: u.userId }); alert(`Signal sent to ${u.userId}.`); }}><div style={{position:'absolute', top:'25px', color:'var(--primary)', fontSize:'12px', width:'100px', left:'-40px', textAlign:'center'}}>{u.userId}</div></div>)}</div>
               <div style={{position:'absolute', bottom:'150px', left:'50%', transform:'translateX(-50%)', display:'flex', gap:'10px', alignItems:'center'}}><span style={{color:'var(--primary)'}}>Freq:</span><input value={radarChannel} onChange={e=>setRadarChannel(e.target.value)} style={{width:'60px', textAlign:'center', padding:'5px', background:'rgba(0,0,0,0.5)', border:'1px solid var(--primary)', color:'#fff'}} /><button className="menu-btn" onClick={()=>{ socket.emit('enable_radar', { userId: myId, channel: radarChannel }); }}>Tune</button></div>
            </div>
          )}

          <div className="dock"><button style={{color: radarOn?'var(--danger)':'var(--text-color)'}} onClick={() => { if(radarOn) { setRadarOn(false); socket.emit('disable_radar'); } else { setRadarOn(true); socket.emit('enable_radar', { userId: myId, channel: radarChannel }); } }} title="Radar">{radarOn ? '🔴' : '📡'}</button></div>

          {chatOpen && (
            <div className="chat-modal" style={{position: 'relative'}}>
               <div className="chat-header-row">
                  <div className="header-left">
                     <strong style={{fontSize:'18px'}}>{chatTitle}</strong>
                     <span className={`status-badge ${statusClass}`}>{mode}</span>
                  </div>
                  <div className="header-right icon-group">
                     <button className="icon-btn" onClick={handleExportChat} title="Export">📥</button>
                     <button className="icon-btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')} title="Theme">{theme==='dark'?'☀️':'🌙'}</button>
                     <button className="icon-btn" onClick={()=>setChatOpen(false)}>✕</button>
                  </div>
               </div>
               <div className="chat-header-security">
                  <div className={`security-status ${statusClass}`}>{statusText}</div>
                  <div className="bio-deck">
                     <input type="file" ref={bioInputRef} onChange={handleBioAuth} style={{display:'none'}} />
                     {mode === 'STANDARD' ? <button className="scanner-btn" onClick={()=>bioInputRef.current.click()}><div className="scan-line"></div>👆 ACTIVATE</button> : <button className="menu-btn danger" onClick={handleReset}>RESET / LOCK</button>}
                  </div>
               </div>

               {animState && (
                 <div className="crypto-anim-overlay">
                   <h2 style={{color:'var(--primary)', marginBottom: '40px'}}>Shamir's Protocol Visualizer</h2>
                   <div className="crypto-stage">
                     
                     <div className="server-zone">UNTRUSTED SERVER<br/>(ENCRYPTED TRANSIT)</div>

                     <div className="crypto-node me">Me<br/>(Local)</div>
                     
                     <div className={`crypto-packet ${getPacketClass()}`}>
                       <span className="data-label">{animState === 'success' ? '🔓 Data' : '📦 Data'}</span>
                       
                       {['step1', 'step2', 'step3_unlock'].includes(animState) && (
                         <div className={`crypto-lock my-lock ${animState === 'step3_unlock' ? 'unlocking' : ''}`}>
                           🔒 My Lock
                           {animState === 'step3_unlock' && <span className="anim-key">🔑</span>}
                         </div>
                       )}

                       {['step2', 'step3_unlock', 'step3_fly', 'step4_unlock'].includes(animState) && (
                         <div className={`crypto-lock his-lock ${animState === 'step4_unlock' ? 'unlocking' : ''}`}>
                           🔒 Friend's Lock
                           {animState === 'step4_unlock' && <span className="anim-key">🔑</span>}
                         </div>
                       )}
                       
                       {animState === 'success' && <span style={{marginLeft: 4, flexShrink: 0}}>✅ Verified</span>}
                     </div>
                     
                     <div className="crypto-node bob">{chatTitle}<br/>(Remote)</div>
                   </div>
                   <div className="anim-text">{renderAnimText()}</div>
                 </div>
               )}

               <div className="chat-messages">
                  {(messageStore[targetId] || []).map((m, i) => (
                    <div key={i} className={`message-bubble ${m.type==='system'?'process':(m.isSelf?'self':'other')}`}>
                       {!m.isSelf && m.type!=='system' && <div className="message-info">{m.timestamp}</div>}
                       {m.locked ? <span style={{display:'flex', alignItems:'center', gap:'5px', color:'var(--danger)'}}>{m.content}</span> : (m.type === 'file' ? (m.fileType.startsWith('image/') ? <img src={m.content} alt={m.fileName} className="chat-img" /> : <a href={m.content} download={m.fileName} style={{color:'inherit'}}>📄 {m.fileName}</a>) : m.content)}
                    </div>
                  ))}
                  <div ref={chatEndRef}></div>
               </div>
               <div className="chat-footer">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{display:'none'}} />
                  <button className="icon-btn" title="Upload File" onClick={()=>fileInputRef.current.click()}>📎</button>
                  <input className="chat-input" value={inputMsg} onChange={e=>setInputMsg(e.target.value)} onKeyPress={e=>e.key==='Enter'&&sendMessage()} placeholder="Type a message..." />
                  <button className="btn-send" onClick={sendMessage}>Send</button>
               </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
