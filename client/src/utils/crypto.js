/* client/src/utils/crypto.js */

// ==========================================
// Part 1: 标准非对称加密 (ECDH + AES-GCM)
// 用于普通模式下的密钥交换和消息加密
// ==========================================

// 1. 生成 ECDH 密钥对 (本地生成，私钥不离线)
export const generateKeyPair = async () => {
  return await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
};

// 2. 导出公钥 (转换为 Base64 字符串以便通过 Socket 发送)
export const exportPublicKey = async (key) => {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

// 3. 导入对方的公钥 (从 Base64 还原)
export const importPublicKey = async (pem) => {
  const binaryDer = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
};

// 4. 计算共享密钥 (ECDH 核心魔法)
// 使用我的私钥 + 你的公钥 = 只有我们两人知道的共享密钥
export const deriveSharedSecret = async (privateKey, publicKey) => {
  return await window.crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

// 5. 标准 AES 加密
export const encryptMessage = async (text, key) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 推荐 12 字节 IV
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  );
  
  // 返回 Base64 格式的密文和向量
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...new Uint8Array(iv)))
  };
};

// 6. 标准 AES 解密
export const decryptMessage = async (cipherText, ivStr, key) => {
  const cipherBuffer = Uint8Array.from(atob(cipherText), c => c.charCodeAt(0));
  const ivBuffer = Uint8Array.from(atob(ivStr), c => c.charCodeAt(0));
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer },
    key,
    cipherBuffer
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
};

// ==========================================
// Part 2: 生物特征与密钥保护
// ==========================================

// 7. 处理指纹/图片 -> 生成 256位 哈希密钥
// 这个 Key 将直接用于三通协议的异或操作
export const processFingerprint = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  // 使用 SHA-256 将任意图片转换为固定长度的 Key
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
  return hashBuffer; 
};

// 8. (可选) 混合密钥 - 用于将指纹与 ECDH 密钥结合
// 虽然三通协议主要用 XOR，但保留此函数以便扩展
export const bindBiometricKey = async (baseKey, bioKeyBuffer) => {
  const baseKeyRaw = await window.crypto.subtle.exportKey("raw", baseKey);
  const mixed = new Uint8Array(baseKeyRaw.byteLength);
  const bioView = new Uint8Array(bioKeyBuffer);
  const baseView = new Uint8Array(baseKeyRaw);

  for(let i=0; i<mixed.length; i++) {
    mixed[i] = baseView[i] ^ bioView[i % bioView.length];
  }

  return await window.crypto.subtle.importKey(
    "raw", mixed, "AES-GCM", true, ["encrypt", "decrypt"]
  );
};

// 9. 封装私钥 (本地存储加密) - 保护用户的账号安全
export const wrapPrivateKey = async (privateKey, password) => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const wrapKey = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, true, ["wrapKey", "unwrapKey"]
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedKey = await window.crypto.subtle.wrapKey("pkcs8", privateKey, wrapKey, { name: "AES-GCM", iv });
  
  return {
    encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedKey))),
    iv: btoa(String.fromCharCode(...new Uint8Array(iv))),
    salt: btoa(String.fromCharCode(...new Uint8Array(salt)))
  };
};

export const unwrapPrivateKey = async (wrappedKeyStr, ivStr, saltStr, password) => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  const salt = Uint8Array.from(atob(saltStr), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivStr), c => c.charCodeAt(0));
  const wrappedKey = Uint8Array.from(atob(wrappedKeyStr), c => c.charCodeAt(0));
  
  const unwrapKey = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, true, ["wrapKey", "unwrapKey"]
  );
  
  return await window.crypto.subtle.unwrapKey(
    "pkcs8", wrappedKey, unwrapKey, { name: "AES-GCM", iv },
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
  );
};

// ==========================================
// Part 3: 三通协议专用 (Commutative Encryption)
// ==========================================

// 10. 可交换加密 (XOR Stream Cipher)
// 核心逻辑：Data ^ KeyA ^ KeyB ^ KeyA = Data ^ KeyB
// 特性：上锁和解锁顺序不敏感，这是实现三通协议的关键
export const commutativeCrypt = (input, keyBuffer) => {
  let inputBytes;
  
  // 1. 判断输入是明文还是 Base64 密文
  try {
    // 尝试按 Base64 解码。如果成功且看起来像二进制数据，则认为是密文
    // 注意：这里简单的 try-catch 可能误判短明文，但在本应用流程中，
    // Step 2 和 Step 3 传入的肯定是 Base64。
    // 为了保险，我们在 App.js 逻辑中控制了输入源。
    inputBytes = Uint8Array.from(atob(input), c => c.charCodeAt(0));
  } catch (e) {
    // 失败则说明是初始明文，使用 TextEncoder 转为字节
    inputBytes = new TextEncoder().encode(input);
  }

  const keyBytes = new Uint8Array(keyBuffer);
  const outputBytes = new Uint8Array(inputBytes.length);

  // 2. XOR 操作 (循环使用 Key)
  for (let i = 0; i < inputBytes.length; i++) {
    outputBytes[i] = inputBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  // 3. 输出统一转为 Base64 方便传输
  const base64Output = btoa(String.fromCharCode(...outputBytes));
  return base64Output;
};

// 11. 尝试解码内容 (用于最后一步验证)
// 如果指纹正确，解出的数据应该包含 ::SECURE:: 前缀
// 否则解出的是乱码
export const tryDecodeContent = (base64) => {
  try {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    // 使用 TextDecoder 尝试转回字符串
    // 如果是乱码，这里可能会成功转成乱码字符串，或者抛错
    const decoded = new TextDecoder().decode(bytes);
    return decoded;
  } catch (e) {
    return null; // 解码失败（通常是乱码导致 UTF-8 校验失败）
  }
};

// ==========================================
// Part 4: 文件辅助 (Legacy but useful)
// ==========================================
export const encryptFile = async (file, key) => {
  const buffer = await file.arrayBuffer();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, buffer
  );
  return { 
    blob: new Blob([ciphertext]), 
    iv: btoa(String.fromCharCode(...new Uint8Array(iv))) 
  };
};

export const decryptFile = async (fileBlob, ivStr, key) => {
  const buffer = await fileBlob.arrayBuffer();
  const iv = Uint8Array.from(atob(ivStr), c => c.charCodeAt(0));
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv }, key, buffer
  );
  return new Blob([decrypted]);
};