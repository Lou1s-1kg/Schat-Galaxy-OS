import React from 'react';

// === 纯视觉组件：负责渲染宇宙、雷达和星球 ===
const styles = {
  container: {
    position: 'relative', width: '100%', height: '100%', 
    overflow: 'hidden', borderRadius: '8px',
    background: 'radial-gradient(circle at center, #1b2735 0%, #090a0f 100%)',
    boxShadow: 'inset 0 0 15px #000',
  },
  coreStar: {
    position: 'absolute', top: '50%', left: '50%',
    width: '30px', height: '30px', marginLeft: '-15px', marginTop: '-15px',
    background: '#00cec9', borderRadius: '50%',
    boxShadow: '0 0 20px #00cec9',
    zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '16px', color: '#000', cursor: 'default'
  },
  radarGrid: {
    position: 'absolute', inset: 0,
    backgroundImage: 'radial-gradient(transparent 30%, rgba(0,255,0,0.1) 31%, transparent 32%), radial-gradient(transparent 60%, rgba(0,255,0,0.1) 61%, transparent 62%)',
    borderRadius: '8px'
  },
  radarLine: {
    position: 'absolute', top: '50%', left: '50%', width: '60%', height: '2px', background: 'linear-gradient(90deg, transparent, #00ff00)',
    transformOrigin: '0 0', animation: 'scan 2s linear infinite', boxShadow: '0 0 10px #00ff00'
  }
};

const animationStyles = `
  @keyframes scan { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes orbit { from { transform: rotate(0deg) translateX(var(--radius)) rotate(0deg); } to { transform: rotate(360deg) translateX(var(--radius)) rotate(-360deg); } }
  .planet { position: absolute; top: 50%; left: 50%; width: 28px; height: 28px; margin-left: -14px; margin-top: -14px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #fff; text-shadow: 0 0 2px #000; transition: all 0.5s ease; animation: orbit var(--speed) linear infinite; }
  .planet:hover { z-index: 100; transform: scale(1.3); animation-play-state: paused; border: 2px solid #fff; }
  .radar-blip { position: absolute; width: 10px; height: 10px; background: #ff4d4f; border-radius: 50%; cursor: pointer; box-shadow: 0 0 8px #ff4d4f; animation: blip 0.5s ease-out; }
  @keyframes blip { 0% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
`;

const CosmosView = ({ viewMode, radarChannel, nearbyUsers, friends, targetId, onToggleRadar, onChannelChange, onAddFriend, onSelectFriend }) => {
  return (
    <div style={{width: '100%', height: '300px', position: 'relative', border: '1px solid #333', borderRadius: '8px', padding: '2px'}}>
      <style>{animationStyles}</style>

      {/* 宇宙视窗 */}
      <div style={styles.container}>
        {viewMode === 'RADAR' ? (
          <>
            <div style={styles.radarGrid}></div>
            <div style={styles.radarLine}></div>
            {nearbyUsers.map((u, i) => (
              <div key={i} className="radar-blip"
                   style={{ top: `calc(50% + ${Math.sin(u.angle)*u.dist}px)`, left: `calc(50% + ${Math.cos(u.angle)*u.dist}px)` }}
                   title={`Found: ${u.userId}`} 
                   onClick={() => { if(window.confirm(`📡 Signal Detected: ${u.userId}\nEstablish Connection?`)) onAddFriend(u.userId); }}
              />
            ))}
            <div style={{position:'absolute', bottom:'5px', width:'100%', textAlign:'center', color:'#00ff00', fontSize:'10px', fontFamily:'monospace', textShadow:'0 0 5px #00ff00'}}>
              SCANNING FREQ [{radarChannel}]...
            </div>
          </>
        ) : (
          <>
            <div style={styles.coreStar}>Me</div>
            <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'80px', height:'80px', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:'50%'}}></div>
            <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'160px', height:'160px', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:'50%'}}></div>
            
            {friends.length === 0 && <div style={{position:'absolute', top:'70%', width:'100%', textAlign:'center', color:'#555', fontSize:'9px'}}>ORBIT EMPTY<br/>INITIATE SCAN</div>}
            
            {friends.map((f) => (
              <div key={f.id} className="planet" onClick={() => onSelectFriend(f.id)}
                   style={{ '--radius': `${f.radius}px`, '--speed': f.speed, backgroundColor: f.color, boxShadow: f.id===targetId ? `0 0 10px ${f.color}` : 'none' }}>
                 {f.id.substring(0,1).toUpperCase()}
              </div>
            ))}
          </>
        )}
      </div>

      {/* 悬浮控制条 */}
      <div style={{position:'absolute', bottom:'10px', left:'10px', right:'10px', display:'flex', gap:'5px', background:'rgba(0,0,0,0.6)', padding:'5px', borderRadius:'4px', backdropFilter:'blur(2px)'}}>
         <input value={radarChannel} onChange={(e) => onChannelChange(e.target.value)} placeholder="CH" style={{width:'40px', background:'transparent', border:'none', borderBottom:'1px solid #666', color:'#00ff00', fontSize:'10px', textAlign:'center', outline:'none'}} />
         <button onClick={onToggleRadar} style={{flex:1, border:'none', background: viewMode==='RADAR'?'#ff4d4f':'#00cec9', color:'#000', fontSize:'10px', fontWeight:'bold', cursor:'pointer', borderRadius:'2px'}}>
            {viewMode === 'RADAR' ? 'STOP' : 'SCAN'}
         </button>
      </div>
    </div>
  );
};

export default CosmosView;