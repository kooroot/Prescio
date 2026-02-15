#!/usr/bin/env node
/**
 * Generate YouTube Shorts clip from game data
 * Proper 9:16 vertical format (1080x1920)
 */

const fs = require('fs');
const path = require('path');

const gameFile = process.argv[2];
const outputFile = process.argv[3] || 'short.html';

if (!gameFile) {
  console.error('Usage: node generate-short.js <game.json> [output.html]');
  process.exit(1);
}

const game = JSON.parse(fs.readFileSync(gameFile, 'utf-8'));

const impostor = game.players?.find(p => p.role === 'IMPOSTOR');
const impostorName = impostor?.nickname || 'Unknown';
const winner = game.winner || 'IMPOSTOR';
const gameCode = game.code || 'DEMO';

// Get chat messages
const messages = game.chatMessages || [];
const displayMessages = messages.slice(-8); // Last 8 messages for better fit

const playerColors = {
  'Agent-Alpha': '#e94560',
  'Agent-Bravo': '#4ecdc4', 
  'Agent-Charlie': '#feca57',
  'Agent-Delta': '#a55eea',
  'Agent-Echo': '#26de81',
  'Agent-Foxtrot': '#fd79a8',
  'Agent-Golf': '#0984e3'
};

function getColor(name) {
  return playerColors[name] || '#888';
}

function getInitial(name) {
  if (name.startsWith('Agent-')) {
    return name.charAt(6);
  }
  return name.charAt(0);
}

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Prescio Short</title>
  <link href="https://fonts.googleapis.com/css2?family=VT323&family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    html, body {
      width: 1080px;
      height: 1920px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: linear-gradient(180deg, #0d0d1a 0%, #1a1a3e 40%, #0d0d1a 100%);
      font-family: 'VT323', monospace;
      color: #fff;
    }
    
    .frame {
      position: absolute;
      top: 0;
      left: 0;
      width: 1080px;
      height: 1920px;
      display: flex;
      flex-direction: column;
      padding: 50px 100px;
    }
    
    /* Header - smaller to fit */
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    
    .logo {
      font-family: 'Press Start 2P', cursive;
      font-size: 48px;
      color: #e94560;
      text-shadow: 0 0 40px rgba(233, 69, 96, 0.8);
      letter-spacing: 2px;
    }
    
    .tagline {
      font-size: 28px;
      color: #666;
      margin-top: 15px;
    }
    
    .game-code {
      font-size: 32px;
      color: #4ecdc4;
      margin-top: 20px;
    }
    
    /* Players row - compact for 7 players */
    .players {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin: 25px 0;
      padding: 0 40px;
      flex-wrap: wrap;
    }
    
    .player {
      width: 55px;
      height: 55px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      border: 2px solid rgba(255,255,255,0.3);
    }
    
    .player.dead {
      opacity: 0.35;
      filter: grayscale(1);
    }
    
    .player.impostor {
      border-color: #ff3333;
      box-shadow: 0 0 20px rgba(255,0,0,0.6);
    }
    
    /* Chat area */
    .chat {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
      overflow: hidden;
      padding: 20px 0;
    }
    
    .msg {
      display: flex;
      gap: 15px;
      align-items: flex-start;
      opacity: 0;
      transform: translateY(20px);
      animation: fadeUp 0.5s forwards;
    }
    
    @keyframes fadeUp {
      to { opacity: 1; transform: translateY(0); }
    }
    
    .msg-avatar {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
      flex-shrink: 0;
    }
    
    .msg-body {
      flex: 1;
      max-width: 900px;
    }
    
    .msg-name {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .msg-text {
      font-size: 32px;
      line-height: 1.3;
      background: rgba(255,255,255,0.08);
      padding: 18px 22px;
      border-radius: 18px;
      word-wrap: break-word;
    }
    
    .system {
      text-align: center;
      font-size: 36px;
      color: #e94560;
      padding: 25px 20px;
      background: linear-gradient(90deg, transparent, rgba(233,69,96,0.15), transparent);
      animation: fadeUp 0.5s forwards;
    }
    
    /* Result banner */
    .result {
      text-align: center;
      padding: 40px 0;
      margin-top: auto;
    }
    
    .result-text {
      font-family: 'Press Start 2P', cursive;
      font-size: 36px;
      opacity: 0;
      animation: resultIn 0.8s 16s forwards;
    }
    
    .result-text.impostor { color: #ff4444; text-shadow: 0 0 30px rgba(255,0,0,0.8); }
    .result-text.crew { color: #26de81; text-shadow: 0 0 30px rgba(38,222,129,0.8); }
    
    @keyframes resultIn {
      0% { opacity: 0; transform: scale(0.5); }
      100% { opacity: 1; transform: scale(1); }
    }
    
    /* Watermark */
    .watermark {
      position: fixed;
      bottom: 50px;
      left: 0;
      right: 0;
      text-align: center;
      font-family: 'Press Start 2P', cursive;
      font-size: 24px;
      color: rgba(255,255,255,0.4);
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="header">
      <div class="logo">PRESCIO</div>
      <div class="tagline">AI Mafia Game</div>
      <div class="game-code">Game #${gameCode}</div>
    </div>
    
    <div class="players">
      ${(game.players || []).map(p => `
        <div class="player ${!p.isAlive ? 'dead' : ''} ${p.role === 'IMPOSTOR' ? 'impostor' : ''}"
             style="background: ${getColor(p.nickname)}">
          ${getInitial(p.nickname)}
        </div>
      `).join('')}
    </div>
    
    <div class="chat">
      ${displayMessages.map((msg, i) => {
        if (msg.isSystem || msg.playerId === 'SYSTEM') {
          return `<div class="system" style="animation-delay: ${i * 2}s">${msg.content}</div>`;
        }
        const color = getColor(msg.playerNickname);
        const text = msg.content.length > 80 ? msg.content.substring(0, 77) + '...' : msg.content;
        return `
          <div class="msg" style="animation-delay: ${i * 2}s">
            <div class="msg-avatar" style="background: ${color}">${getInitial(msg.playerNickname)}</div>
            <div class="msg-body">
              <div class="msg-name" style="color: ${color}">${msg.playerNickname}</div>
              <div class="msg-text">${text}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    
    <div class="result">
      <div class="result-text ${winner === 'IMPOSTOR' ? 'impostor' : 'crew'}">
        ${winner === 'IMPOSTOR' ? '🔪 IMPOSTOR WINS' : '✅ CREW WINS'}
      </div>
    </div>
  </div>
  
  <div class="watermark">prescio.fun</div>
</body>
</html>`;

fs.writeFileSync(outputFile, html);
console.log(`Generated: ${outputFile}`);
console.log(`Game: ${gameCode}`);
console.log(`Winner: ${winner}`);
console.log(`Messages: ${displayMessages.length}`);
