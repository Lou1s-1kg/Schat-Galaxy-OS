/* server/index.js - Galaxy OS Core v3.5 (Final Deploy Version) */
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// === 修改点 1：允许 Vercel 连接 ===
const io = new Server(server, {
  cors: { 
    origin: "*", // 允许任何来源，确保上线后前端能连上
    methods: ["GET", "POST"] 
  }
});

// 内存数据库
let usersDB = {}; 
let radarPool = {}; 

io.on('connection', (socket) => {
  console.log(`⚡ Link: ${socket.id}`);

  // === 修改点 2：增强注册稳定性 ===
  socket.on('register_user', (data) => {
    if (usersDB[data.userId]) {
      // 如果用户在内存里已存在（比如刷新了页面），我们不报错，而是直接更新连接
      // 这样演示时更流畅，不会因为重复注册而卡住
      usersDB[data.userId].socketId = socket.id;
      socket.join(data.userId);
      socket.emit('registration_success', { userId: data.userId });
      // 同步一下最新的好友数据，防止前端丢失
      if (usersDB[data.userId].friends) {
         // 这里不需要显式发回，因为前端稍后会自己处理，但这行代码无害
      }
      return;
    }
    
    // 正常的新用户注册
    usersDB[data.userId] = { ...data, socketId: socket.id, friends: [] }; 
    socket.join(data.userId);
    socket.emit('registration_success', { userId: data.userId });
  });
  
  socket.on('login_request', (userId, callback) => {
    if (usersDB[userId]) {
      usersDB[userId].socketId = socket.id; // 更新在线状态
      socket.join(userId);
      // 返回用户数据，包含已保存的好友列表
      callback({ success: true, data: usersDB[userId] });
    } else {
      callback({ success: false, error: "User not found. Please Register." });
    }
  });

  // === 2. 雷达模块 (无修改) ===
  socket.on('enable_radar', ({ userId, channel }) => {
    radarPool[socket.id] = { userId, channel, socketId: socket.id };
    io.emit('radar_update', Object.values(radarPool));
  });

  socket.on('disable_radar', () => {
    delete radarPool[socket.id];
    io.emit('radar_update', Object.values(radarPool));
  });

  // === 3. 好友逻辑 (无修改) ===
  socket.on('send_friend_request', ({ fromId, toId }) => {
    const target = usersDB[toId];
    if (target && target.socketId) {
      io.to(target.socketId).emit('incoming_friend_request', { fromId });
    }
  });

  socket.on('accept_friend_request', ({ myId, friendId }) => {
    const me = usersDB[myId];
    const friend = usersDB[friendId];
    
    // 更新双方的好友列表
    if (me && !me.friends.includes(friendId)) me.friends.push(friendId);
    if (friend && !friend.friends.includes(myId)) friend.friends.push(myId);

    // 实时通知双方刷新 UI
    if (me?.socketId) io.to(me.socketId).emit('force_add_friend', { friendId });
    if (friend?.socketId) io.to(friend.socketId).emit('force_add_friend', { friendId: myId });
  });

  socket.on('delete_friend', ({ myId, friendId }) => {
    const me = usersDB[myId];
    const friend = usersDB[friendId];

    if (me) me.friends = me.friends.filter(id => id !== friendId);
    if (friend) friend.friends = friend.friends.filter(id => id !== myId);

    if (friend?.socketId) {
      io.to(friend.socketId).emit('friend_deleted', { id: myId });
    }
  });

  // === 4. 消息与加密交换 (无修改) ===
  socket.on('get_public_key', (targetId, callback) => {
    const user = usersDB[targetId];
    if (user) callback({ success: true, publicKey: user.publicKey });
    else callback({ success: false, error: "Offline" });
  });

  socket.on('send_message', (data) => {
    if (usersDB[data.receiverId]) {
      // 直接转发加密数据包，服务器无法解密
      socket.to(data.receiverId).emit('receive_message', data);
    }
  });

  socket.on('disconnect', () => {
    delete radarPool[socket.id];
    io.emit('radar_update', Object.values(radarPool));
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Galaxy Core Online: ${PORT}`);
});