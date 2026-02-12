import io from 'socket.io-client';

// 自动判断环境
const URL = process.env.NODE_ENV === 'production' 
  ? 'https://schat-server-louis.onrender.com' // 👈 这里填你刚才在 Render 复制的真实网址
  : 'http://localhost:3001';

const socket = io(URL, {
  transports: ['websocket'],
  secure: true, // 开启安全模式
});

export default socket;