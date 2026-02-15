#!/usr/bin/env node
/**
 * Generate HTML clip from game JSON for YouTube Shorts (9:16 vertical)
 * Usage: node generate-clip.js <game.json> <output.html>
 */

const fs = require('fs');
const path = require('path');

const gameFile = process.argv[2];
const outputFile = process.argv[3];

if (!gameFile || !outputFile) {
  console.error('Usage: node generate-clip.js <game.json> <output.html>');
  process.exit(1);
}

const game = JSON.parse(fs.readFileSync(gameFile, 'utf-8'));

// Find impostor
const impostor = game.players.find(p => p.role === 'IMPOSTOR');
const impostorName = impostor ? impostor.nickname : 'Unknown';
const winner = game.winner || (game.players.filter(p => p.role === 'IMPOSTOR' && p.isAlive).length > 0 ? 'IMPOSTOR' : 'CREW');

// Get messages for clip
const messages = game.chatMessages || [];
const recentMessages = messages.slice(-12);

// Convert to clip format
const clipMessages = recentMessages.map(msg => {
  if (msg.isSystem || msg.playerId === 'SYSTEM') {
    return { system: true, content: msg.content };
  }
  return { 
    name: msg.playerNickname, 
    content: msg.content.length > 80 ? msg.content.substring(0, 77) + '...' : msg.content 
  };
});

// Add final result
if (winner === 'IMPOSTOR') {
  clipMessages.push({ system: true, content: '🔪 IMPOSTOR WINS' });
} else {
  clipMessages.push({ system: true, content: '✅ CREW WINS' });
}

const playerColors = ['#e94560', '#4ecdc4', '#feca57', '#a55eea', '#26de81', '#fd79a8', '#0984e3'];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1080, height=1920">
  <title>Prescio - AI Mafia Game</title>
  <link href="https://fonts.googleapis.com/css2?family=VT323&family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      width: 1080px;
      height: 1920px;
      background: linear-gradient(180deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%);
      font-family: 'VT323', monospace;
      color: #fff;
      overflow: hidden;
    }
    
    .container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 60px 50px;
    }
    
    /* Compact header at top */
    .header {
      text-align: center;
      padding-bottom: 30px;
      flex-shrink: 0;
    }
    
    .logo {
      font-family: 'Press Start 2P', cursive;
      font-size: 52px;
      color: #e94560;
      text-shadow: 0 0 40px rgba(233, 69, 96, 0.6);
      margin-bottom: 20px;
    }
    
    .game-info {
      display: flex;
      justify-content: center;
      gap: 60px;
      font-size: 32px;
      color: #888;
    }
    
    .game-info span {
      color: #4ecdc4;
    }
    
    /* Players in vertical column on left side */
    .players-column {
      position: absolute;
      left: 30px;
      top: 250px;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .player-avatar {
      width: 65px;
      height: 65px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      border: 3px solid rgba(255,255,255,0.3);
    }
    
    .player-avatar.dead {
      opacity: 0.3;
      filter: grayscale(100%);
    }
    
    .player-avatar.impostor {
      border-color: #ff4444;
      box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
    }
    
    /* Chat takes most of the space */
    .chat-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 20px 30px;
      margin-left: 80px;
      overflow: hidden;
    }
    
    .message {
      display: flex;
      gap: 20px;
      margin-bottom: 25px;
      opacity: 0;
      transform: translateX(-30px);
      animation: slideIn 0.5s forwards;
    }
    
    @keyframes slideIn {
      to { opacity: 1; transform: translateX(0); }
    }
    
    .message-avatar {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
      flex-shrink: 0;
      border: 3px solid rgba(255,255,255,0.2);
    }
    
    .message-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .message-name {
      font-weight: bold;
      font-size: 32px;
      margin-bottom: 8px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }
    
    .message-text {
      background: rgba(255,255,255,0.08);
      padding: 20px 25px;
      border-radius: 20px;
      font-size: 36px;
      line-height: 1.4;
      max-width: 800px;
    }
    
    .system-message {
      text-align: center;
      padding: 30px 40px;
      margin: 25px 0;
      background: linear-gradient(90deg, transparent, rgba(233, 69, 96, 0.2), transparent);
      font-size: 42px;
      color: #e94560;
      text-shadow: 0 0 20px rgba(233, 69, 96, 0.5);
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    /* Result overlay */
    .result-overlay {
      position: fixed;
      bottom: 100px;
      left: 0;
      right: 0;
      text-align: center;
      font-family: 'Press Start 2P', cursive;
      font-size: 38px;
      padding: 30px;
      background: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.8) 20%, rgba(0,0,0,0.8) 80%, transparent 100%);
      opacity: 0;
      animation: fadeInResult 0.5s 25s forwards;
    }
    
    .result-overlay.impostor-wins {
      color: #ff4444;
      text-shadow: 0 0 30px rgba(255,0,0,0.8);
    }
    
    .result-overlay.crew-wins {
      color: #26de81;
      text-shadow: 0 0 30px rgba(38,222,129,0.8);
    }
    
    @keyframes fadeInResult {
      to { opacity: 1; }
    }
    
    /* Watermark */
    .watermark {
      position: fixed;
      bottom: 40px;
      right: 40px;
      font-family: 'Press Start 2P', cursive;
      font-size: 24px;
      color: rgba(255,255,255,0.4);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">PRESCIO</div>
      <div class="game-info">
        <span>Game ${game.code || 'DEMO'}</span>
        <span>Round ${game.currentRound || game.rounds || '?'}</span>
      </div>
    </div>
    
    <div class="players-column">
      ${game.players.map((p, i) => `
        <div class="player-avatar ${!p.isAlive ? 'dead' : ''} ${p.role === 'IMPOSTOR' && winner ? 'impostor' : ''}" 
             style="background: ${playerColors[i % playerColors.length]}">
          ${p.nickname.charAt(6) || p.nickname.charAt(0)}
        </div>
      `).join('')}
    </div>
    
    <div class="chat-container">
      ${clipMessages.map((msg, i) => {
        if (msg.system) {
          return `<div class="system-message" style="animation-delay: ${i * 2}s">${msg.content}</div>`;
        }
        const playerIndex = game.players.findIndex(p => p.nickname === msg.name);
        const color = playerColors[playerIndex % playerColors.length] || '#888';
        const initial = msg.name.charAt(6) || msg.name.charAt(0);
        return `
          <div class="message" style="animation-delay: ${i * 2}s">
            <div class="message-avatar" style="background: ${color}">${initial}</div>
            <div class="message-content">
              <div class="message-name" style="color: ${color}">${msg.name}</div>
              <div class="message-text">${msg.content}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  </div>
  
  <div class="result-overlay ${winner === 'IMPOSTOR' ? 'impostor-wins' : 'crew-wins'}">
    ${winner === 'IMPOSTOR' ? '🔪 IMPOSTOR WINS' : '✅ CREW WINS'}
  </div>
  
  <div class="watermark">prescio.fun</div>
</body>
</html>`;

fs.writeFileSync(outputFile, html);
console.log(`Generated: ${outputFile}`);
console.log(`Winner: ${winner}`);
console.log(`Messages: ${clipMessages.length}`);
