// Configuration
const config = {
  accessoire: '',
  pin: '1234',
  apiKey: '',
  météo: null,
  humeur: 3,
  messages: {
    focus: [
      "Respire profondément... Tu es sur la bonne voie !",
      "Un pas à la fois, tu vas y arriver.",
      "La concentration est une compétence, tu t'améliores chaque jour.",
      "Tu es plus fort que tu ne le penses."
    ],
    méditation: [
      "Inspire... (3 secondes)",
      "Retiens... (3 secondes)",
      "Expire... (6 secondes)",
      "Répète ce cycle 5 fois."
    ]
  }
};

// p5.js sketch
let particles = [];
let PX = 8;
let C = {
  body: '#c8d8c0',
  bodyDk: '#a0b890',
  star: '#f0c040',
  cheek: '#e0a0c0',
  water: '#a0d0f0'
};

const p5s = function(p) {
  let tamaX = 100, tamaY = 100;
  let energy = 100, habitude = 50, sl = false, room = 'parc';

  p.setup = function() {
    // ✅ FIX : p.windowWidth au lieu de windowWidth (mode instance)
    let canvas = p.createCanvas(200, 200);
    canvas.parent('tama-canvas'); // ✅ FIX : attache le canvas au bon conteneur HTML
    p.noSmooth();
    p.noStroke();
  };

  p.draw = function() {
    p.noStroke(); // ✅ reset à chaque frame (drawWind ajoute un stroke)
    p.background(room === 'parc' ? '#80d0a8' : room === 'chambre' ? '#b090d0' : '#88bee8');
    drawTama(p, tamaX, tamaY);
    updateParts(p);
    if (room === 'montagne') drawMountain(p);
    if (config.météo?.current_weather?.windspeed > 20) drawWind(p);
  };

  // ✅ Expose room setter pour la navigation
  p.setRoom = function(r) { room = r; };
  p.setEnergy = function(e) { energy = e; };

  function drawTama(p, x, y) {
    p.fill(C.body);
    p.rect(x, y, PX * 5, PX * 7);

    // Accessoire couronne
    if (config.accessoire === 'couronne_or') {
      p.fill(C.star);
      p.ellipse(x + PX * 2.5, y - PX, PX * 3, PX);
    }

    // Visage — couleur change si fatigué
    if (energy < 20) {
      p.fill(C.water);
    } else {
      p.fill(C.body);
    }
    p.rect(x + PX, y + PX, PX * 3, PX * 2);

    // Yeux
    p.fill(p.color(56, 48, 74));
    p.rect(x + PX, y + PX * 2, PX, PX);
    p.rect(x + PX * 3, y + PX * 2, PX, PX);

    // Bouche
    p.fill(p.color(220, 100, 100));
    p.ellipse(x + PX * 2, y + PX * 4, PX * 2, PX);
  }

  function drawMountain(p) {
    p.fill('#504020');
    p.triangle(0, 200, 100, 50, 200, 200);
    p.fill('#706040');
    p.triangle(50, 200, 100, 80, 150, 200);
  }

  function drawWind(p) {
    p.stroke('#fff');
    p.strokeWeight(2);
    for (let i = 0; i < 5; i++) {
      p.line(p.random(0, 200), p.random(0, 200), p.random(0, 200), p.random(0, 200));
    }
    p.noStroke(); // ✅ reset stroke après le vent
  }

  function updateParts(p) {
    particles = particles.filter(pt => {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.12;
      pt.life--;
      const a = Math.floor(pt.life / 16 * 255);
      try {
        p.fill(p.color(pt.c + (a < 16 ? '0' : '') + a.toString(16)));
      } catch (e) {
        p.fill(200);
      }
      p.rect(pt.x, pt.y, PX, PX);
      return pt.life > 0;
    });
  }
};

// ✅ Stocker la référence pour y accéder depuis la navigation
let myP5 = new p5(p5s);

// Navigation
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('menu-button').addEventListener('click', () => {
    document.getElementById('menu-overlay').style.display = 'flex';
  });

  document.getElementById('close-menu').addEventListener('click', () => {
    document.getElementById('menu-overlay').style.display = 'none';
  });

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.pnl').forEach(p => p.classList.remove('on'));
      const panel = document.getElementById(item.dataset.tab + '-panel');
      if (panel) panel.classList.add('on');
      document.getElementById('menu-overlay').style.display = 'none';

      // ✅ FIX : utilise la méthode p5 au lieu de la variable locale inaccessible
      if (myP5 && myP5.setRoom) {
        myP5.setRoom(item.dataset.tab);
      }
    });
  });

  const focusPanel = document.getElementById('focus-panel');
  if (focusPanel) {
    focusPanel.addEventListener('click', () => {
      if (typeof startFocus === 'function') {
        startFocus('pomodoro');
      }
    });
  }
});

// Haptique
function vibrate() {
  if ('vibrate' in navigator) {
    navigator.vibrate([50]);
  }
}
