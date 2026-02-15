#!/usr/bin/env node
/**
 * Generate HTML clip from game JSON - ORIGINAL TEMPLATE with Greek letters
 * This is the style that got 285 views!
 * 
 * Features:
 * - Greek letter icons (α, β, γ, δ, ε, ζ, η)
 * - "AI Agents Playing Mafia" subtitle
 * - Round number display
 * - @presciodotfun watermark
 * 
 * Usage: node generate-clip-v1.js <game.json> <output.html>
 */

const fs = require('fs');

const gameFile = process.argv[2];
const outputFile = process.argv[3];

if (!gameFile || !outputFile) {
  console.error('Usage: node generate-clip-v1.js <game.json> <output.html>');
  process.exit(1);
}

const game = JSON.parse(fs.readFileSync(gameFile, 'utf-8'));

const impostor = game.players.find(p => p.role === 'IMPOSTOR');
const impostorName = impostor ? impostor.nickname : 'Unknown';
const winner = game.winner || 'IMPOSTOR';
const gameCode = game.code || 'DEMO';
const rounds = game.round || game.rounds || 1;

// Greek letters for agents
const greekInitials = {
  'Agent-Alpha': 'α',
  'Agent-Bravo': 'β',
  'Agent-Charlie': 'γ',
  'Agent-Delta': 'δ',
  'Agent-Echo': 'ε',
  'Agent-Foxtrot': 'ζ',
  'Agent-Golf': 'η'
};

const agentColors = {
  'Agent-Alpha': '#c0392b',
  'Agent-Bravo': '#2980b9',
  'Agent-Charlie': '#27ae60',
  'Agent-Delta': '#f39c12',
  'Agent-Echo': '#9b59b6',
  'Agent-Foxtrot': '#1abc9c',
  'Agent-Golf': '#e91e63'
};

// Get messages
const messages = game.chatMessages || [];
const displayMessages = messages.slice(-10);

// Format messages for template
const formattedMessages = displayMessages.map(msg => {
  if (msg.isSystem || msg.playerId === 'SYSTEM') {
    return { system: true, content: msg.content };
  }
  return {
    name: msg.playerNickname,
    content: msg.content.length > 100 ? msg.content.substring(0, 97) + '...' : msg.content
  };
});

// Add final result
formattedMessages.push({
  system: true,
  content: winner === 'IMPOSTOR' ? '🔪 IMPOSTOR WINS' : '✅ CREW WINS'
});

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
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      font-family: 'VT323', monospace;
      color: #fff;
      overflow: hidden;
    }
    
    .container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 40px 50px;
    }
    
    .header {
      text-align: center;
      padding: 30px 0;
      border-bottom: 2px solid rgba(255,255,255,0.1);
      margin-bottom: 30px;
    }
    
    .logo {
      font-family: 'Press Start 2P', cursive;
      font-size: 48px;
      color: #e94560;
      text-shadow: 0 0 30px rgba(233, 69, 96, 0.6);
      margin-bottom: 15px;
    }
    
    .subtitle {
      font-size: 28px;
      color: #888;
      margin-bottom: 20px;
    }
    
    .game-info {
      display: flex;
      justify-content: center;
      gap: 50px;
      font-size: 28px;
    }
    
    .game-info span {
      color: #4ecdc4;
    }
    
    .players-bar {
      display: flex;
      justify-content: center;
      gap: 15px;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }
    
    .player-avatar {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: bold;
      position: relative;
      transition: all 0.3s;
      border: 3px solid rgba(255,255,255,0.2);
    }
    
    .player-avatar.dead {
      opacity: 0.4;
      filter: grayscale(100%);
    }
    
    .player-avatar.dead::after {
      content: '💀';
      position: absolute;
      font-size: 20px;
      top: -8px;
      right: -8px;
    }
    
    .player-avatar.impostor {
      box-shadow: 0 0 20px rgba(255, 0, 0, 0.6);
      animation: impostor-glow 2s infinite;
    }
    
    @keyframes impostor-glow {
      0%, 100% { box-shadow: 0 0 20px rgba(255, 0, 0, 0.6); }
      50% { box-shadow: 0 0 35px rgba(255, 0, 0, 0.9); }
    }
    
    .chat-container {
      flex: 1;
      overflow: hidden;
      padding: 20px;
      background: rgba(0,0,0,0.3);
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.1);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .message {
      display: flex;
      gap: 18px;
      opacity: 0;
      transform: translateY(30px);
      animation: fadeIn 0.5s forwards;
    }
    
    @keyframes fadeIn {
      to { opacity: 1; transform: translateY(0); }
    }
    
    .message-avatar {
      width: 65px;
      height: 65px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
      flex-shrink: 0;
      border: 2px solid rgba(255,255,255,0.2);
    }
    
    .message-content {
      flex: 1;
    }
    
    .message-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    
    .message-name {
      font-weight: bold;
      font-size: 28px;
    }
    
    .message-text {
      background: rgba(255,255,255,0.1);
      padding: 16px 22px;
      border-radius: 0 18px 18px 18px;
      font-size: 32px;
      line-height: 1.4;
    }
    
    .system-message {
      text-align: center;
      padding: 25px;
      margin: 15px 0;
      background: linear-gradient(90deg, transparent, rgba(233, 69, 96, 0.3), transparent);
      font-size: 36px;
      color: #e94560;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    .reveal-screen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      animation: showReveal 0.8s 24s forwards;
    }
    
    @keyframes showReveal {
      to { opacity: 1; }
    }
    
    .reveal-text {
      font-family: 'Press Start 2P', cursive;
      font-size: 32px;
      color: #e94560;
      text-align: center;
      margin-bottom: 40px;
      text-shadow: 0 0 40px rgba(233, 69, 96, 0.8);
    }
    
    .reveal-agent {
      font-size: 100px;
      margin: 30px 0;
    }
    
    .reveal-name {
      font-family: 'Press Start 2P', cursive;
      font-size: 28px;
      color: #fff;
      margin-bottom: 50px;
    }
    
    .reveal-result {
      font-family: 'Press Start 2P', cursive;
      font-size: 32px;
    }
    
    .reveal-result.impostor { color: #ff4444; text-shadow: 0 0 30px rgba(255,0,0,0.8); }
    .reveal-result.crew { color: #26de81; text-shadow: 0 0 30px rgba(38,222,129,0.8); }
    
    .watermark {
      position: fixed;
      bottom: 40px;
      right: 50px;
      font-family: 'Press Start 2P', cursive;
      font-size: 20px;
      color: rgba(255,255,255,0.5);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">PRESCIO</div>
      <div class="subtitle">AI Agents Playing Mafia</div>
      <div class="game-info">
        <div>Game <span>${gameCode}</span></div>
        <div>Round <span>${rounds}</span></div>
      </div>
    </div>
    
    <div class="players-bar">
      ${game.players.map(p => `
        <div class="player-avatar ${!p.isAlive ? 'dead' : ''} ${p.role === 'IMPOSTOR' ? 'impostor' : ''}"
             style="background: ${agentColors[p.nickname] || '#888'}">
          ${greekInitials[p.nickname] || p.nickname.charAt(6)}
        </div>
      `).join('')}
    </div>
    
    <div class="chat-container">
      ${formattedMessages.map((msg, i) => {
        if (msg.system) {
          return `<div class="system-message message" style="animation-delay: ${i * 2}s">${msg.content}</div>`;
        }
        const color = agentColors[msg.name] || '#888';
        const initial = greekInitials[msg.name] || msg.name.charAt(6);
        return `
          <div class="message" style="animation-delay: ${i * 2}s">
            <div class="message-avatar" style="background: ${color}">${initial}</div>
            <div class="message-content">
              <div class="message-header">
                <span class="message-name" style="color: ${color}">${msg.name}</span>
              </div>
              <div class="message-text">${msg.content}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  </div>
  
  <div class="reveal-screen">
    <div class="reveal-text">THE IMPOSTOR WAS...</div>
    <div class="reveal-agent">🔪</div>
    <div class="reveal-name">${impostorName}</div>
    <div class="reveal-result ${winner === 'IMPOSTOR' ? 'impostor' : 'crew'}">
      ${winner === 'IMPOSTOR' ? 'IMPOSTOR WINS' : 'CREW WINS'}
    </div>
  </div>
  
  <div class="watermark">@presciodotfun</div>
</body>
</html>`;

fs.writeFileSync(outputFile, html);
console.log(`Generated: ${outputFile}`);
console.log(`Game: ${gameCode}`);
console.log(`Winner: ${winner}`);
console.log(`Impostor: ${impostorName}`);
console.log(`Rounds: ${rounds}`);
console.log(`Messages: ${formattedMessages.length}`);
