import io from 'socket.io-client';

// 自动判断环境
const URL = process.env.NODE_ENV === 'production' 
  ? 'https://schat-server-louis.onrender.com' 
  : 'http://localhost:3001';

const socket = io(URL, {
  transports: ['websocket'],
  secure: true, // 开启安全模式
});


export default socket;
