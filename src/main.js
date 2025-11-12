import './styles.css';
import { World } from './game/World.js';

const app = document.getElementById('app');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('startButton');
const missionList = document.getElementById('missionList');
const energyLevel = document.getElementById('energyLevel');
const shardCount = document.getElementById('shardCount');

const world = new World(app);
let initialized = false;

const minimap = document.getElementById('minimap');
const minimapContext = minimap?.getContext('2d');
const radioTrack = document.getElementById('radioTrack');
const weatherStatus = document.getElementById('weatherStatus');
const wantedLevel = document.getElementById('wantedLevel');

function renderWanted(level) {
  if (!wantedLevel) return;
  const stars = Array.from({ length: 5 }, (_, index) => (index < level ? '★' : '☆')).join(' ');
  wantedLevel.textContent = stars;
  if (level >= 3) {
    wantedLevel.classList.add('is-hot');
  } else {
    wantedLevel.classList.remove('is-hot');
  }
}

function renderWeather(status) {
  if (weatherStatus) {
    weatherStatus.textContent = status;
  }
}

function renderRadio(track) {
  if (radioTrack) {
    radioTrack.textContent = track;
  }
}

function renderMinimap(state) {
  if (!minimap || !minimapContext) return;
  const { bounds, player, missions, vehicles, npcs, collectibles } = state;
  const size = minimap.width;
  const half = size / 2;
  const scale = size / (bounds * 2);

  minimapContext.clearRect(0, 0, size, size);

  const drawPoint = (x, z, radius, color) => {
    minimapContext.beginPath();
    minimapContext.fillStyle = color;
    minimapContext.arc(half + x * scale, half - z * scale, radius, 0, Math.PI * 2);
    minimapContext.fill();
  };

  minimapContext.save();
  minimapContext.translate(half, half);
  minimapContext.fillStyle = 'rgba(0, 12, 24, 0.85)';
  minimapContext.fillRect(-half, -half, size, size);
  minimapContext.strokeStyle = 'rgba(0, 255, 198, 0.2)';
  minimapContext.lineWidth = 2;
  minimapContext.strokeRect(-half, -half, size, size);
  minimapContext.restore();

  vehicles?.forEach(({ x, z }) => drawPoint(x, z, 3, 'rgba(255, 196, 54, 0.85)'));
  npcs?.forEach(({ x, z }) => drawPoint(x, z, 3, 'rgba(120, 200, 255, 0.8)'));
  collectibles?.forEach(({ x, z }) => drawPoint(x, z, 2.5, 'rgba(0, 255, 198, 0.9)'));
  missions?.forEach(({ x, z, active }) => {
    drawPoint(x, z, active ? 5 : 4, active ? 'rgba(255, 65, 130, 0.9)' : 'rgba(255, 255, 255, 0.65)');
  });

  if (player) {
    const px = half + player.x * scale;
    const pz = half - player.z * scale;
    minimapContext.save();
    minimapContext.translate(px, pz);
    minimapContext.rotate(-player.heading);
    minimapContext.fillStyle = '#00ffc6';
    minimapContext.beginPath();
    minimapContext.moveTo(0, -8);
    minimapContext.lineTo(6, 8);
    minimapContext.lineTo(-6, 8);
    minimapContext.closePath();
    minimapContext.fill();
    minimapContext.restore();
  }
}

function renderMissions(missions) {
  missionList.innerHTML = '';
  missions.forEach((mission) => {
    const item = document.createElement('li');
    item.textContent = mission.text;
    if (mission.completed) {
      item.classList.add('completed');
    }
    missionList.appendChild(item);
  });
}

world.onPointerLockChange((locked) => {
  if (locked) {
    overlay.classList.add('hidden');
  } else {
    overlay.classList.remove('hidden');
    startButton.textContent = 'Resume Exploration';
  }
});

world.onEnergyChange((value) => {
  energyLevel.textContent = `${value}%`;
});

world.onShardChange((value) => {
  shardCount.textContent = value;
});

world.onMissionChange((missions) => {
  renderMissions(missions);
});

world.onMapUpdate((state) => {
  renderMinimap(state);
});

world.onWantedChange((level) => {
  renderWanted(level);
});

world.onWeatherChange((status) => {
  renderWeather(status);
});

world.onRadioChange((track) => {
  renderRadio(track);
});

startButton.addEventListener('click', async () => {
  if (!initialized) {
    await world.init();
    initialized = true;
  }

  overlay.classList.add('hidden');
  world.start();
});
