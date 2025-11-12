import * as THREE from 'three';
import { PlayerController } from './PlayerController.js';

const CITY_BOUNDS = 120;
const DRONE_MISSION_DURATION = 20;
const WANTED_MAX_LEVEL = 5;
const WEATHER_TRANSITION_TIME = 6;
const WEATHER_DURATION_RANGE = [55, 95];
const WEATHER_STATES = ['clear', 'rain', 'fog', 'storm'];
const WEATHER_LABELS = {
  clear: 'Calm Skies',
  rain: 'Radiant Rainfall',
  fog: 'Midnight Mist',
  storm: 'Ion Storm Warning'
};
const TMP_DIRECTION = new THREE.Vector3();
const TMP_VECTOR = new THREE.Vector3();

export class World {
  constructor(container) {
    this.container = container;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.player = null;
    this.clock = new THREE.Clock();
    this.obstacles = [];
    this.collectibles = [];
    this.missions = [
      {
        id: 'shards',
        text: 'Collect five neon data shards hidden across the districts.',
        completed: false
      },
      {
        id: 'plaza',
        text: 'Reach the central plaza hologram at the heart of the city.',
        completed: false
      },
      {
        id: 'drone',
        text: `Keep pace with the courier drone for ${DRONE_MISSION_DURATION} seconds.`,
        completed: false
      },
      {
        id: 'musician',
        text: 'Find the synthwave busker and enjoy the show.',
        completed: false
      },
      {
        id: 'boardwalk',
        text: 'Sprint the waterfront boardwalk without leaving the glow.',
        completed: false
      },
      {
        id: 'wanted',
        text: 'Escalate the alert, then lose the security drone to prove your stealth.',
        completed: false
      }
    ];
    this.shardsCollected = 0;
    this.droneProximityTime = 0;
    this.vehicles = [];
    this.npcs = [];
    this.dynamicProps = [];
    this.boardwalkArea = null;
    this.npcMissionTarget = null;
    this.skyUniforms = null;
    this.missionMarkers = new Map();
    this.lights = {
      ambient: null,
      moon: null,
      neon: null,
      street: []
    };
    this.timeOfDay = Math.random();
    this.lightingPalette = {
      ambientDay: new THREE.Color(0x4b8fdc),
      ambientNight: new THREE.Color(0x11243b),
      fogDay: new THREE.Color(0x12324b),
      fogNight: new THREE.Color(0x04070f)
    };
    this.pointerLockCallback = () => {};
    this.energyCallback = () => {};
    this.shardCallback = () => {};
    this.missionCallback = () => {};
    this.mapCallback = () => {};
    this.weatherCallback = () => {};
    this.wantedCallback = () => {};
    this.radioCallback = () => {};
    this.running = false;
    this.initialized = false;
    this.weatherState = 'clear';
    this.nextWeatherState = 'clear';
    this.weatherTransition = 0;
    this.weatherTimer = 0;
    this.weatherDuration = THREE.MathUtils.randFloat(...WEATHER_DURATION_RANGE);
    this.weatherStrength = { rain: 0, fog: 0, storm: 0 };
    this.weatherEffects = { rain: null, lightning: null };
    this.restrictedZones = [
      { center: new THREE.Vector3(54, 0, -64), radius: 14, heat: 1.2 },
      { center: new THREE.Vector3(-66, 0, 48), radius: 12, heat: 1 },
      { center: new THREE.Vector3(18, 0, 72), radius: 10, heat: 0.9 }
    ];
    this.wantedLevel = 0;
    this.displayedWantedLevel = 0;
    this.maxWantedLevel = 0;
    this.securityDrone = null;
    this.securityDroneLight = null;
    this.securityDroneTarget = new THREE.Vector3();
    this.radio = {
      tracks: [
        { title: 'Silver Pulse - Skyline Run' },
        { title: 'Vector 99 - Midnight Dash' },
        { title: 'Aurora Flux - Coded Dreams' },
        { title: 'Lazerhawk - Neon Sunsets (Remix)' }
      ],
      index: 0,
      timer: 0,
      duration: 70 + Math.random() * 30
    };

    this.update = this.update.bind(this);
  }

  async init() {
    if (this.initialized) {
      return;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04070f);
    this.scene.fog = new THREE.FogExp2(this.lightingPalette.fogNight.getHex(), 0.012);
    this.scene.fog.color.copy(this.lightingPalette.fogNight);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      400
    );
    this.camera.position.set(0, 1.6, 12);

    this.player = new PlayerController(this.camera, this.renderer.domElement);
    this.player.attachEvents({
      onLock: () => this.pointerLockCallback(true),
      onUnlock: () => this.pointerLockCallback(false),
      onEnergyChange: (value) => this.energyCallback(value)
    });
    this.player.connect();
    this.energyCallback(this.player.energy);

    this.createSky();
    this.createLights();
    this.createGround();
    this.createRoadDetails();
    this.createWaterfront();
    this.createCityBlocks();
    this.createStreetLights();
    this.createBillboards();
    this.createPlaza();
    this.createBoardwalk();
    this.createDrone();
    this.createCollectibles();
    this.createTraffic();
    this.createNPCs();
    this.createSecuritySystems();
    this.createWeatherSystem();
    this.initRadio();

    window.addEventListener('resize', this.handleResize);

    this.weatherCallback(WEATHER_LABELS[this.weatherState]);
    this.radioCallback(this.radio.tracks[this.radio.index].title);
    this.wantedCallback(0);
    this.initialized = true;
  }

  start() {
    if (!this.initialized) {
      throw new Error('World.init() must be called before start().');
    }

    if (!this.running) {
      this.clock.start();
      this.renderer.setAnimationLoop(this.update);
      this.running = true;
    }

    if (!this.player.isLocked()) {
      this.player.lock();
    }
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.player.disconnect();
    this.renderer.dispose();
    this.collectibles.forEach(({ mesh }) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
  }

  onPointerLockChange(callback) {
    this.pointerLockCallback = callback;
  }

  onEnergyChange(callback) {
    this.energyCallback = callback;
  }

  onShardChange(callback) {
    this.shardCallback = callback;
  }

  onMissionChange(callback) {
    this.missionCallback = callback;
    callback(this.missions);
  }

  onMapUpdate(callback) {
    this.mapCallback = callback;
  }

  onWeatherChange(callback) {
    this.weatherCallback = callback;
    callback(WEATHER_LABELS[this.weatherState]);
  }

  onWantedChange(callback) {
    this.wantedCallback = callback;
    callback(this.displayedWantedLevel);
  }

  onRadioChange(callback) {
    this.radioCallback = callback;
    callback(this.radio.tracks[this.radio.index].title);
  }

  handleResize = () => {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  createLights() {
    const ambient = new THREE.HemisphereLight(0x1d3a6b, 0x050b16, 0.65);
    this.scene.add(ambient);

    const moon = new THREE.DirectionalLight(0x9fd0ff, 1.05);
    moon.position.set(40, 65, 20);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near = 10;
    moon.shadow.camera.far = 160;
    moon.shadow.camera.left = -90;
    moon.shadow.camera.right = 90;
    moon.shadow.camera.top = 90;
    moon.shadow.camera.bottom = -90;
    this.scene.add(moon);

    const neon = new THREE.SpotLight(0x00ffc6, 1.25, 240, Math.PI / 5, 0.45, 1.4);
    neon.position.set(-30, 40, -25);
    neon.castShadow = true;
    this.scene.add(neon);

    this.lights.ambient = ambient;
    this.lights.moon = moon;
    this.lights.neon = neon;
  }

  createSky() {
    const geometry = new THREE.SphereGeometry(320, 64, 64);
    this.skyUniforms = {
      mixFactor: { value: 0.5 },
      topColor: { value: new THREE.Color(0x1e4b84) },
      bottomColor: { value: new THREE.Color(0x04070f) },
      nightColor: { value: new THREE.Color(0x02020b) }
    };

    const material = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: `varying vec3 vWorldPosition;\n        void main() {\n          vec4 worldPosition = modelMatrix * vec4(position, 1.0);\n          vWorldPosition = worldPosition.xyz;\n          gl_Position = projectionMatrix * viewMatrix * worldPosition;\n        }`,
      fragmentShader: `varying vec3 vWorldPosition;\n        uniform vec3 topColor;\n        uniform vec3 bottomColor;\n        uniform vec3 nightColor;\n        uniform float mixFactor;\n        void main() {\n          float h = normalize(vWorldPosition).y * 0.5 + 0.5;\n          vec3 day = mix(bottomColor, topColor, pow(h, 0.65));\n          vec3 night = mix(bottomColor, nightColor, pow(h, 0.9));\n          vec3 color = mix(night, day, clamp(mixFactor, 0.0, 1.0));\n          gl_FragColor = vec4(color, 1.0);\n        }`,
      side: THREE.BackSide,
      depthWrite: false
    });

    const sky = new THREE.Mesh(geometry, material);
    this.scene.add(sky);
    this.sky = sky;

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 900;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const direction = new THREE.Vector3().randomDirection().multiplyScalar(260 + Math.random() * 40);
      starPositions[i * 3] = direction.x;
      starPositions[i * 3 + 1] = direction.y;
      starPositions[i * 3 + 2] = direction.z;

      const tint = new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 0.6, 0.6 + Math.random() * 0.2);
      starColors[i * 3] = tint.r;
      starColors[i * 3 + 1] = tint.g;
      starColors[i * 3 + 2] = tint.b;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 1.4,
      transparent: true,
      opacity: 0.75,
      vertexColors: true,
      depthWrite: false
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(stars);
    this.stars = stars;
  }

  createGround() {
    const groundGeometry = new THREE.PlaneGeometry(220, 220, 10, 10);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c1824,
      metalness: 0.1,
      roughness: 0.9
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x1d1f2b,
      metalness: 0.3,
      roughness: 0.6
    });

    const road = new THREE.Mesh(new THREE.BoxGeometry(220, 0.2, 30), roadMaterial);
    road.position.y = 0.05;
    road.castShadow = false;
    road.receiveShadow = true;
    this.scene.add(road);

    const crossRoad = road.clone();
    crossRoad.rotation.y = Math.PI / 2;
    this.scene.add(crossRoad);

    const laneMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xf0f4ff });
    for (let i = -5; i <= 5; i++) {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(3, 0.02, 0.4),
        laneMarkerMaterial
      );
      marker.position.set(i * 18, 0.11, 0);
      this.scene.add(marker);
      const marker2 = marker.clone();
      marker2.rotation.y = Math.PI / 2;
      marker2.position.set(0, 0.11, i * 18);
      this.scene.add(marker2);
    }
  }

  createRoadDetails() {
    const crosswalkMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f7ff,
      metalness: 0.1,
      roughness: 0.25
    });

    const crosswalkOffsets = [-12, 12];
    crosswalkOffsets.forEach((offset) => {
      for (let i = -2; i <= 2; i++) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.8), crosswalkMaterial);
        slab.position.set(i * 3, 0.12, offset);
        this.scene.add(slab);
      }
    });

    const dividerMaterial = new THREE.MeshStandardMaterial({
      color: 0x11131f,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.35,
      metalness: 0.8,
      roughness: 0.25
    });
    const divider = new THREE.Mesh(new THREE.BoxGeometry(220, 0.3, 1.4), dividerMaterial);
    divider.position.y = 0.16;
    this.scene.add(divider);
    this.dynamicProps.push({ type: 'divider', mesh: divider, baseIntensity: 0.35, speed: 1.6 + Math.random(), offset: Math.random() * Math.PI * 2 });

    const perimeterMaterial = new THREE.MeshStandardMaterial({
      color: 0x040b12,
      emissive: 0x0099ff,
      emissiveIntensity: 0.25,
      metalness: 0.9,
      roughness: 0.15
    });

    const northStrip = new THREE.Mesh(new THREE.BoxGeometry(220, 0.2, 0.3), perimeterMaterial);
    northStrip.position.set(0, 0.15, CITY_BOUNDS - 8);
    const southStrip = northStrip.clone();
    southStrip.position.set(0, 0.15, -CITY_BOUNDS + 8);
    const eastStrip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 220), perimeterMaterial);
    eastStrip.position.set(CITY_BOUNDS - 8, 0.15, 0);
    const westStrip = eastStrip.clone();
    westStrip.position.set(-CITY_BOUNDS + 8, 0.15, 0);

    [northStrip, southStrip, eastStrip, westStrip].forEach((strip) => {
      this.scene.add(strip);
      this.dynamicProps.push({ type: 'divider', mesh: strip, baseIntensity: 0.3, speed: 1.2 + Math.random(), offset: Math.random() * Math.PI * 2 });
    });
  }

  createWaterfront() {
    const waterGeometry = new THREE.PlaneGeometry(170, 70, 1, 1);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a2a3c,
      transparent: true,
      opacity: 0.88,
      metalness: 0.9,
      roughness: 0.12,
      emissive: 0x04263c,
      emissiveIntensity: 0.5
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.04, -85);
    water.receiveShadow = true;
    this.scene.add(water);

    const boardwalkDeck = new THREE.Mesh(
      new THREE.BoxGeometry(170, 0.6, 12),
      new THREE.MeshStandardMaterial({ color: 0x2f2621, roughness: 0.8, metalness: 0.15 })
    );
    boardwalkDeck.position.set(0, 0.3, -55);
    boardwalkDeck.receiveShadow = true;
    this.scene.add(boardwalkDeck);

    const railingMaterial = new THREE.MeshStandardMaterial({ color: 0x0d1f31, metalness: 0.7, roughness: 0.35 });
    for (let i = -8; i <= 8; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.4, 8), railingMaterial);
      post.position.set(i * 10, 1.5, -49.5);
      post.castShadow = true;
      this.scene.add(post);
    }

    const glowStrip = new THREE.Mesh(
      new THREE.BoxGeometry(170, 0.2, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x00f6ff, emissiveIntensity: 0.55, metalness: 0.9, roughness: 0.2 })
    );
    glowStrip.position.set(0, 0.4, -49.8);
    this.scene.add(glowStrip);
    this.dynamicProps.push({ type: 'divider', mesh: glowStrip, baseIntensity: 0.55, speed: 1.8, offset: Math.random() * Math.PI * 2 });

    this.boardwalkArea = new THREE.Box3(
      new THREE.Vector3(-85, 0, -64),
      new THREE.Vector3(85, 3, -46)
    );
    const boardwalkCenter = new THREE.Vector3();
    this.boardwalkArea.getCenter(boardwalkCenter);
    this.missionMarkers.set('boardwalk', boardwalkCenter);
  }

  createStreetLights() {
    const poleGeometry = new THREE.CylinderGeometry(0.35, 0.45, 8, 8);
    const headGeometry = new THREE.BoxGeometry(1.4, 0.6, 1.4);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x1a253a, metalness: 0.8, roughness: 0.35 });
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0x0e1723, metalness: 0.6, roughness: 0.4 });

    const lightPositions = [];
    for (let i = -3; i <= 3; i++) {
      lightPositions.push(new THREE.Vector3(i * 24, 0, 14));
      lightPositions.push(new THREE.Vector3(i * 24, 0, -14));
      lightPositions.push(new THREE.Vector3(14, 0, i * 24));
      lightPositions.push(new THREE.Vector3(-14, 0, i * 24));
    }

    lightPositions.forEach((position) => {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.y = 4;
      pole.castShadow = true;
      pole.receiveShadow = true;
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.set(0, 8, 0);
      head.castShadow = true;

      group.add(pole);
      group.add(head);
      group.position.copy(position);

      const light = new THREE.PointLight(0x86d8ff, 1.4, 38, 2.2);
      light.position.set(0, 8.3, 0);
      light.castShadow = true;
      head.add(light);

      this.scene.add(group);
      this.lights.street.push(light);
      light.userData.baseIntensity = light.intensity;
      this.dynamicProps.push({ type: 'streetLight', mesh: light, baseIntensity: light.intensity, speed: 1 + Math.random() * 0.6, offset: Math.random() * Math.PI * 2 });

      const bounds = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(position.x, 1, position.z),
        new THREE.Vector3(1.6, 2, 1.6)
      );
      this.obstacles.push(bounds);
    });
  }

  createBillboards() {
    const panelGeometry = new THREE.PlaneGeometry(18, 9, 1, 1);
    const supportGeometry = new THREE.BoxGeometry(0.9, 9, 0.9);
    const billboardConfigs = [
      { position: new THREE.Vector3(-42, 10, 32), rotationY: Math.PI / 3, color: 0xff6bd6 },
      { position: new THREE.Vector3(38, 11, -34), rotationY: -Math.PI / 2.2, color: 0x6bffef },
      { position: new THREE.Vector3(-12, 12, -70), rotationY: Math.PI / 10, color: 0xffd166 }
    ];

    billboardConfigs.forEach((config) => {
      const group = new THREE.Group();
      const support = new THREE.Mesh(supportGeometry, new THREE.MeshStandardMaterial({ color: 0x12121e, metalness: 0.8, roughness: 0.35 }));
      support.position.y = 4.5;
      group.add(support);

      const panelMaterial = new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.color,
        emissiveIntensity: 1.8,
        metalness: 0.2,
        roughness: 0.45
      });
      const panel = new THREE.Mesh(panelGeometry, panelMaterial);
      panel.position.set(0, 9.5, 0);
      panel.castShadow = true;
      group.add(panel);

      group.position.copy(config.position);
      group.rotation.y = config.rotationY;
      this.scene.add(group);

      const halo = new THREE.PointLight(config.color, 4.5, 60, 1.6);
      halo.position.set(0, 0, 0.2);
      panel.add(halo);
      this.lights.street.push(halo);
      halo.userData.baseIntensity = halo.intensity;

      this.dynamicProps.push({
        type: 'billboard',
        mesh: panel,
        baseIntensity: 1.6 + Math.random() * 0.6,
        speed: 2 + Math.random(),
        offset: Math.random() * Math.PI * 2
      });
    });
  }

  createBoardwalk() {
    if (!this.boardwalkArea) return;

    const seatingMaterial = new THREE.MeshStandardMaterial({ color: 0x262019, roughness: 0.7, metalness: 0.2 });
    for (let i = -6; i <= 6; i++) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.6, 0.8), seatingMaterial);
      bench.position.set(i * 12, 0.9, -52.5);
      bench.castShadow = true;
      this.scene.add(bench);
    }

    const lanternMaterial = new THREE.MeshStandardMaterial({ color: 0x1d2538, metalness: 0.8, roughness: 0.3 });
    for (let i = -5; i <= 5; i++) {
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 3.2, 12), lanternMaterial);
      lantern.position.set(i * 14, 1.7, -57.5);
      this.scene.add(lantern);

      const glow = new THREE.PointLight(0xff7b2d, 1.5, 22, 2.5);
      glow.position.set(0, 1.8, 0);
      lantern.add(glow);
      this.lights.street.push(glow);
      glow.userData.baseIntensity = glow.intensity;
      this.dynamicProps.push({ type: 'lantern', mesh: glow, baseIntensity: glow.intensity, speed: 0.8 + Math.random() * 0.3, offset: Math.random() * Math.PI * 2 });
    }
  }

  createTraffic() {
    const carBodyGeometry = new THREE.BoxGeometry(2.2, 1.1, 4.4);
    const cabinGeometry = new THREE.BoxGeometry(1.8, 0.8, 2.2);
    const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12);
    wheelGeometry.rotateZ(Math.PI / 2);
    const colors = [0xff5f7a, 0xffd166, 0x7ad7f0, 0x9df3c4, 0xb892ff];

    const lanes = [
      { axis: 'x', z: 6.5, direction: 1 },
      { axis: 'x', z: -6.5, direction: -1 },
      { axis: 'z', x: 6.5, direction: -1 },
      { axis: 'z', x: -6.5, direction: 1 }
    ];

    lanes.forEach((lane) => {
      for (let i = 0; i < 4; i++) {
        const color = colors[(i + Math.floor(Math.random() * colors.length)) % colors.length];
        const group = new THREE.Group();
        const bodyMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35, emissive: color, emissiveIntensity: 0.2 });
        const cabinMaterial = new THREE.MeshStandardMaterial({ color: 0x1f1f2b, metalness: 0.8, roughness: 0.4 });

        const body = new THREE.Mesh(carBodyGeometry, bodyMaterial);
        body.castShadow = true;
        body.receiveShadow = true;
        const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        cabin.position.y = 0.8;
        body.add(cabin);

        for (let w = 0; w < 4; w++) {
          const wheel = new THREE.Mesh(wheelGeometry, new THREE.MeshStandardMaterial({ color: 0x0b0b10, metalness: 0.6, roughness: 0.4 }));
          wheel.position.set(w < 2 ? -0.9 : 0.9, -0.6, w % 2 === 0 ? -1.4 : 1.4);
          wheel.castShadow = true;
          body.add(wheel);
        }

        group.add(body);
        group.position.set(
          lane.axis === 'x' ? -CITY_BOUNDS + i * 40 : lane.x,
          0.7,
          lane.axis === 'z' ? -CITY_BOUNDS + i * 40 : lane.z
        );

        if (lane.axis === 'x') {
          group.rotation.y = lane.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          group.rotation.y = lane.direction > 0 ? 0 : Math.PI;
        }

        const headLight = new THREE.SpotLight(color, 1.6, 18, Math.PI / 5, 0.6, 2.2);
        headLight.position.set(0, 0.3, 2.4);
        headLight.target.position.set(0, -0.1, 6);
        group.add(headLight);
        group.add(headLight.target);

        this.scene.add(group);
        this.vehicles.push({ group, lane, speed: 12 + Math.random() * 6 });
      }
    });
  }

  createNPCs() {
    const createCitizen = (primaryColor, accentColor) => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.7, 1.7, 12),
        new THREE.MeshStandardMaterial({ color: primaryColor, metalness: 0.4, roughness: 0.5 })
      );
      body.position.y = 1.2;
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xffe0bd, metalness: 0.2, roughness: 0.7 })
      );
      head.position.y = 2.1;
      head.castShadow = true;
      group.add(head);

      const visor = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.1, 8, 24),
        new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.3 })
      );
      visor.position.set(0, 1.85, 0.2);
      group.add(visor);

      const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 0.2), new THREE.MeshStandardMaterial({ color: primaryColor, metalness: 0.4, roughness: 0.5 }));
      const rightArm = leftArm.clone();
      leftArm.position.set(-0.75, 1.2, 0);
      rightArm.position.set(0.75, 1.2, 0);
      group.add(leftArm);
      group.add(rightArm);

      return { group, leftArm, rightArm };
    };

    const walkerColors = [
      [0x3a86ff, 0x8338ec],
      [0xff006e, 0xffbe0b],
      [0x2ec4b6, 0xcbf3f0],
      [0xf8961e, 0xffc43d]
    ];

    const walkerRoutes = [
      [new THREE.Vector3(-80, 0, 24), new THREE.Vector3(80, 0, 24)],
      [new THREE.Vector3(24, 0, 80), new THREE.Vector3(24, 0, -80)],
      [new THREE.Vector3(-60, 0, -40), new THREE.Vector3(60, 0, -40)],
      [new THREE.Vector3(-20, 0, 60), new THREE.Vector3(60, 0, 20), new THREE.Vector3(-60, 0, -20)]
    ];

    walkerRoutes.forEach((route, index) => {
      const [primary, accent] = walkerColors[index % walkerColors.length];
      const citizen = createCitizen(primary, accent);
      citizen.group.position.copy(route[0]);
      this.scene.add(citizen.group);
      this.npcs.push({
        ...citizen,
        route,
        targetIndex: 1,
        speed: 3 + Math.random() * 1.8,
        swing: Math.random() * Math.PI * 2
      });
    });

    const buskerColors = [0x4361ee, 0x4cc9f0];
    const busker = createCitizen(...buskerColors);
    busker.group.position.set(20, 0, -52);
    const synth = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x111321, metalness: 0.8, roughness: 0.3, emissive: 0x00e5ff, emissiveIntensity: 0.7 })
    );
    synth.position.set(0, 0.9, 0.9);
    busker.group.add(synth);
    const speaker = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 16), new THREE.MeshStandardMaterial({ color: 0x101420, metalness: 0.7, roughness: 0.3 }));
    speaker.position.set(1.2, 0.4, 0.6);
    busker.group.add(speaker);

    const stageLight = new THREE.PointLight(0x5de0ff, 1.8, 25, 2.2);
    stageLight.position.set(0, 2.2, 0.4);
    busker.group.add(stageLight);
    this.lights.street.push(stageLight);
    stageLight.userData.baseIntensity = stageLight.intensity;
    this.dynamicProps.push({ type: 'billboard', mesh: synth, baseIntensity: 0.7, speed: 3.2, offset: Math.random() * Math.PI * 2 });

    this.scene.add(busker.group);
    this.missionMarkers.set('musician', busker.group.position.clone());
    this.npcMissionTarget = busker.group;
    this.npcs.push({
      ...busker,
      route: [busker.group.position.clone()],
      targetIndex: 0,
      speed: 0,
      swing: 0,
      stationary: true
    });
  }

  createSecuritySystems() {
    const drone = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0x1a0b11, metalness: 0.9, roughness: 0.32, emissive: 0x33090f, emissiveIntensity: 0.8 })
    );
    shell.castShadow = true;
    drone.add(shell);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.12, 16, 50),
      new THREE.MeshStandardMaterial({ color: 0xff5522, metalness: 0.8, roughness: 0.35, emissive: 0xff3311, emissiveIntensity: 1.4 })
    );
    ring.rotation.x = Math.PI / 2;
    drone.add(ring);

    const thruster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.8, 20),
      new THREE.MeshStandardMaterial({ color: 0x0a0a10, emissive: 0x901818, emissiveIntensity: 1.2 })
    );
    thruster.position.y = -1.4;
    drone.add(thruster);

    const light = new THREE.SpotLight(0xff4f2c, 0, 28, Math.PI / 4, 0.45, 2.6);
    light.position.set(0, -0.2, 0);
    light.target.position.set(0, -4, 0);
    drone.add(light);
    drone.add(light.target);

    drone.position.set(0, 12, 0);
    drone.visible = false;
    this.scene.add(drone);

    this.securityDrone = drone;
    this.securityDroneLight = light;
  }

  createWeatherSystem() {
    const rainDrops = 1400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(rainDrops * 3);
    const velocities = new Float32Array(rainDrops);
    for (let i = 0; i < rainDrops; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 140;
      positions[i * 3 + 1] = Math.random() * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 140;
      velocities[i] = 22 + Math.random() * 16;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x7fc8ff,
      size: 0.35,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });

    const rain = new THREE.Points(geometry, material);
    rain.visible = false;
    rain.frustumCulled = false;
    this.scene.add(rain);

    const lightning = new THREE.PointLight(0x9fd8ff, 0, 140, 2.4);
    lightning.position.set(0, 60, 0);
    this.scene.add(lightning);

    this.weatherEffects.rain = { mesh: rain, velocities, area: 140 };
    this.weatherEffects.lightning = lightning;
  }

  initRadio() {
    const track = this.radio.tracks[this.radio.index];
    if (track) {
      this.radioCallback(track.title);
    }
  }

  advanceRadio() {
    this.radio.index = (this.radio.index + 1) % this.radio.tracks.length;
    this.radio.timer = 0;
    this.radio.duration = 70 + Math.random() * 30;
    const track = this.radio.tracks[this.radio.index];
    if (track) {
      this.radioCallback(track.title);
    }
  }

  createCityBlocks() {
    const blockPositions = [-75, -45, -15, 15, 45, 75];
    const palette = [0x152647, 0x1c3059, 0x274777, 0x1b4b6b, 0x0f2f4a, 0x1b998b];
    const glowPalette = [0x3df0ff, 0xff7ee2, 0x94f87e, 0xfff36a];

    blockPositions.forEach((x) => {
      blockPositions.forEach((z) => {
        if (Math.abs(x) < 14 && Math.abs(z) < 14) {
          return;
        }

        if (Math.random() < 0.08) {
          return;
        }

        const width = 12 + Math.random() * 18;
        const depth = 12 + Math.random() * 18;
        const height = 16 + Math.random() * 60;
        const color = palette[Math.floor(Math.random() * palette.length)];
        const glow = glowPalette[Math.floor(Math.random() * glowPalette.length)];

        const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        const buildingMaterial = new THREE.MeshStandardMaterial({
          color,
          emissive: new THREE.Color(glow).multiplyScalar(0.25 + Math.random() * 0.4),
          metalness: 0.7,
          roughness: 0.32
        });

        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.set(x + (Math.random() - 0.5) * 12, height / 2, z + (Math.random() - 0.5) * 12);
        building.castShadow = true;
        building.receiveShadow = true;
        this.scene.add(building);

        const bounds = new THREE.Box3().setFromObject(building);
        this.obstacles.push(bounds);

        if (Math.random() > 0.4) {
          const crown = new THREE.Mesh(
            new THREE.CylinderGeometry(width * 0.12, width * 0.3, 1.8, 20),
            new THREE.MeshStandardMaterial({
              color: glow,
              emissive: glow,
              emissiveIntensity: 1.4,
              transparent: true,
              opacity: 0.85,
              metalness: 0.8,
              roughness: 0.2
            })
          );
          crown.position.set(building.position.x, height + 1.2, building.position.z);
          this.scene.add(crown);
          this.dynamicProps.push({ type: 'billboard', mesh: crown, baseIntensity: 1.4, speed: 1.5 + Math.random(), offset: Math.random() * Math.PI * 2 });
        }

        if (Math.random() > 0.55) {
          const antenna = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.25, 6 + Math.random() * 6, 10),
            new THREE.MeshStandardMaterial({ color: 0x0f1625, metalness: 0.8, roughness: 0.35 })
          );
          antenna.position.set(building.position.x + (Math.random() - 0.5) * width * 0.4, height + antenna.geometry.parameters.height / 2, building.position.z + (Math.random() - 0.5) * depth * 0.4);
          this.scene.add(antenna);
        }

        if (Math.random() > 0.5) {
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(width * 0.6, height * 0.22),
            new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.3 })
          );
          sign.position.set(building.position.x + width / 2 + 0.1, height * 0.6, building.position.z);
          sign.rotation.y = Math.PI / 2;
          this.scene.add(sign);
          this.dynamicProps.push({ type: 'billboard', mesh: sign, baseIntensity: 1.2, speed: 2.4 + Math.random(), offset: Math.random() * Math.PI * 2 });
        }

        const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xaed0ff, transparent: true, opacity: 0.85 });
        const windowGroup = new THREE.Group();
        const floors = Math.max(3, Math.floor(height / 6));
        const columns = Math.max(2, Math.floor(width / 6));
        for (let floor = 1; floor <= floors; floor++) {
          const y = floor * (height / (floors + 1));
          for (let col = 0; col < columns; col++) {
            const offsetX = -width / 2 + (col + 0.5) * (width / columns);
            const windowFront = new THREE.Mesh(new THREE.PlaneGeometry(width / columns * 0.6, height / (floors + 1) * 0.5), windowMaterial);
            windowFront.position.set(offsetX, y, depth / 2 + 0.01);
            windowGroup.add(windowFront);
            const windowBack = windowFront.clone();
            windowBack.position.z = -depth / 2 - 0.01;
            windowBack.rotation.y = Math.PI;
            windowGroup.add(windowBack);
          }
        }
        windowGroup.position.copy(building.position);
        this.scene.add(windowGroup);

        if (Math.random() > 0.65) {
          const rooftopGarden = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.6, 0.6, depth * 0.6),
            new THREE.MeshStandardMaterial({ color: 0x193c29, emissive: 0x1a5f3d, emissiveIntensity: 0.4, roughness: 0.6, metalness: 0.2 })
          );
          rooftopGarden.position.set(building.position.x, height + 0.5, building.position.z);
          rooftopGarden.receiveShadow = true;
          this.scene.add(rooftopGarden);
        }
      });
    });
  }

  createPlaza() {
    const plazaGeometry = new THREE.CylinderGeometry(10, 12, 1.6, 32, 1, true);
    const plazaMaterial = new THREE.MeshStandardMaterial({
      color: 0x142336,
      metalness: 0.2,
      roughness: 0.4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    this.plaza = new THREE.Mesh(plazaGeometry, plazaMaterial);
    this.plaza.rotation.x = Math.PI / 2;
    this.plaza.position.y = 0.5;
    this.scene.add(this.plaza);
    this.missionMarkers.set('plaza', new THREE.Vector3(0, 0, 0));

    const hologram = new THREE.Mesh(
      new THREE.TorusGeometry(6.5, 0.18, 16, 64),
      new THREE.MeshBasicMaterial({ color: 0x00ffc6 })
    );
    hologram.rotation.x = Math.PI / 2;
    hologram.position.y = 3;
    this.scene.add(hologram);

    const particles = new THREE.Points(
      new THREE.SphereGeometry(8, 24, 24),
      new THREE.PointsMaterial({ color: 0x00ffc6, size: 0.2, transparent: true, opacity: 0.4 })
    );
    particles.position.y = 5;
    this.scene.add(particles);

    this.plazaObjects = { hologram, particles };
  }

  createDrone() {
    const body = new THREE.SphereGeometry(1.2, 24, 24);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffb347,
      emissive: 0xff8b20,
      emissiveIntensity: 1.5,
      metalness: 0.3,
      roughness: 0.2
    });
    this.drone = new THREE.Mesh(body, material);
    this.drone.castShadow = true;
    this.scene.add(this.drone);

    const light = new THREE.PointLight(0xffa040, 1.6, 30, 2);
    this.drone.add(light);

    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x151c2b,
      emissive: 0xffa040,
      emissiveIntensity: 0.35,
      metalness: 0.8,
      roughness: 0.25
    });
    const wing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.18, 24, 64), wingMaterial);
    wing.rotation.x = Math.PI / 2;
    this.drone.add(wing);
    this.droneWing = wing;

    const trail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.05, 3.6, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.35 })
    );
    trail.rotation.x = Math.PI / 2;
    trail.position.y = -2.4;
    this.drone.add(trail);
    this.droneTrail = trail;

    this.droneLight = light;
    this.droneAngle = 0;
    this.missionMarkers.set('drone', new THREE.Vector3());
  }

  createCollectibles() {
    const shardGeometry = new THREE.OctahedronGeometry(1.1, 0);
    const positions = [
      new THREE.Vector3(20, 1.6, 14),
      new THREE.Vector3(-22, 1.6, -24),
      new THREE.Vector3(34, 1.6, -42),
      new THREE.Vector3(-40, 1.6, 36),
      new THREE.Vector3(14, 1.6, -10),
      new THREE.Vector3(-12, 1.6, -56),
      new THREE.Vector3(58, 1.6, 18)
    ];
    this.missionMarkers.set('shards', positions[0].clone());

    positions.forEach((position, index) => {
      const hue = 0.5 + Math.random() * 0.2;
      const color = new THREE.Color().setHSL(hue, 0.7, 0.6);
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color.clone().multiplyScalar(0.6),
        emissiveIntensity: 1.1,
        metalness: 0.2,
        roughness: 0.15
      });
      const mesh = new THREE.Mesh(shardGeometry.clone(), material);
      mesh.position.copy(position);
      const aura = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 1.25, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      );
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = -1.1;
      mesh.add(aura);
      mesh.userData = {
        collected: false,
        rotationSpeed: 0.6 + Math.random() * 0.8,
        baseY: position.y,
        aura
      };
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.collectibles.push({ mesh, index });
    });
  }

  update() {
    const delta = this.clock.getDelta();
    this.player.update(delta, this.obstacles, CITY_BOUNDS);
    this.updateWeather(delta);
    this.updateDrone(delta);
    this.updateTraffic(delta);
    this.updateCollectibles(delta);
    this.updateNPCs(delta);
    this.updateMissions(delta);
    this.updatePlaza(delta);
    this.updateLighting(delta);
    this.updateDynamicProps(delta);
    this.updateWanted(delta);
    this.updateSecurityDrone(delta);
    this.updateRadio(delta);
    this.updateMinimapState();

    this.renderer.render(this.scene, this.camera);
  }

  updateDrone(delta) {
    this.droneAngle += delta * 0.35;
    const radius = 24 + Math.sin(this.droneAngle * 1.7) * 6;
    const height = 9 + Math.sin(this.droneAngle * 2.2) * 2.8;
    const lateralOffset = Math.sin(this.droneAngle * 0.5) * 18;
    this.drone.position.set(
      Math.cos(this.droneAngle) * radius,
      height,
      Math.sin(this.droneAngle) * (radius * 0.65) + lateralOffset
    );

    this.drone.rotation.y += delta * 1.2;
    if (this.droneWing) {
      this.droneWing.rotation.y += delta * 4.2;
      this.droneWing.material.emissiveIntensity = 0.35 + Math.sin(performance.now() * 0.004) * 0.15;
    }
    if (this.droneTrail) {
      this.droneTrail.material.opacity = 0.2 + Math.abs(Math.sin(performance.now() * 0.005)) * 0.35;
    }
    if (this.droneLight) {
      this.droneLight.intensity = 1.6 + Math.sin(performance.now() * 0.003) * 0.4;
    }

    const playerPosition = this.player.getPosition();
    const distance = playerPosition.distanceTo(this.drone.position);
    if (distance < 10) {
      this.droneProximityTime = Math.min(DRONE_MISSION_DURATION, this.droneProximityTime + delta);
    } else {
      this.droneProximityTime = Math.max(0, this.droneProximityTime - delta * 0.6);
    }
  }

  updateTraffic(delta) {
    this.vehicles.forEach((vehicle) => {
      const { group, lane, speed } = vehicle;
      const movement = speed * delta * lane.direction;
      if (lane.axis === 'x') {
        group.position.x += movement;
        if (lane.direction > 0 && group.position.x > CITY_BOUNDS + 20) {
          group.position.x = -CITY_BOUNDS - 20;
        } else if (lane.direction < 0 && group.position.x < -CITY_BOUNDS - 20) {
          group.position.x = CITY_BOUNDS + 20;
        }
      } else {
        group.position.z += movement;
        if (lane.direction > 0 && group.position.z > CITY_BOUNDS + 20) {
          group.position.z = -CITY_BOUNDS - 20;
        } else if (lane.direction < 0 && group.position.z < -CITY_BOUNDS - 20) {
          group.position.z = CITY_BOUNDS + 20;
        }
      }

      group.position.y = 0.7 + Math.sin(performance.now() * 0.004 + group.position.x * 0.02 + group.position.z * 0.02) * 0.05;
    });
  }

  updateNPCs(delta) {
    const swingTime = performance.now() * 0.005;
    this.npcs.forEach((npc) => {
      if (npc.stationary) {
        const swing = Math.sin(swingTime + npc.swing) * 0.35;
        npc.leftArm.rotation.x = swing;
        npc.rightArm.rotation.x = -swing;
        return;
      }

      const route = npc.route;
      if (!route || route.length === 0) return;

      const target = route[npc.targetIndex];
      const position = npc.group.position;
      TMP_DIRECTION.subVectors(target, position);
      const distance = TMP_DIRECTION.length();
      if (distance < 0.6) {
        npc.targetIndex = (npc.targetIndex + 1) % route.length;
        return;
      }

      TMP_DIRECTION.normalize();
      position.addScaledVector(TMP_DIRECTION, npc.speed * delta);
      npc.group.lookAt(target.x, position.y, target.z);

      const swing = Math.sin(swingTime * 1.2 + npc.swing) * 0.5;
      npc.leftArm.rotation.x = swing;
      npc.rightArm.rotation.x = -swing;
    });
  }

  updateDynamicProps(delta) {
    const time = performance.now() * 0.001;
    this.dynamicProps.forEach((prop) => {
      const { mesh, baseIntensity, speed, offset, type } = prop;
      if (!mesh) return;
      const wave = Math.sin(time * speed + offset);

      if (type === 'billboard') {
        if (mesh.material && 'emissiveIntensity' in mesh.material) {
          const intensity = baseIntensity + wave * baseIntensity * 0.45;
          mesh.material.emissiveIntensity = Math.max(0.2, intensity);
        }
      } else if (type === 'divider') {
        if (mesh.material && 'emissiveIntensity' in mesh.material) {
          const intensity = baseIntensity + wave * baseIntensity * 0.35;
          mesh.material.emissiveIntensity = Math.max(0.12, intensity);
        }
      } else if ((type === 'streetLight' || type === 'lantern') && mesh.isLight) {
        const flicker = wave * 0.2;
        mesh.intensity = Math.max(0.12, mesh.intensity + flicker);
      }
    });

    if (this.stars) {
      this.stars.rotation.y += delta * 0.01;
    }
  }

  updateWeather(delta) {
    this.weatherTimer += delta;

    if (this.nextWeatherState === this.weatherState && this.weatherTimer > this.weatherDuration) {
      this.weatherTimer = 0;
      this.weatherDuration = THREE.MathUtils.randFloat(...WEATHER_DURATION_RANGE);
      let next = WEATHER_STATES[Math.floor(Math.random() * WEATHER_STATES.length)];
      if (next === this.weatherState) {
        next = WEATHER_STATES[(WEATHER_STATES.indexOf(next) + 1) % WEATHER_STATES.length];
      }
      this.nextWeatherState = next;
    }

    if (this.nextWeatherState !== this.weatherState) {
      this.weatherTransition = Math.min(1, this.weatherTransition + delta / WEATHER_TRANSITION_TIME);
      this.#blendWeather(this.weatherState, this.nextWeatherState, this.weatherTransition);
      if (this.weatherTransition >= 1) {
        this.weatherState = this.nextWeatherState;
        this.nextWeatherState = this.weatherState;
        this.weatherTransition = 0;
        this.weatherTimer = 0;
        this.weatherDuration = THREE.MathUtils.randFloat(...WEATHER_DURATION_RANGE);
        this.weatherCallback(WEATHER_LABELS[this.weatherState]);
      }
    } else {
      this.#blendWeather(this.weatherState, this.weatherState, 1);
    }

    const rainEffect = this.weatherEffects.rain;
    if (rainEffect && rainEffect.mesh) {
      const rainStrength = this.weatherStrength.rain;
      const visible = rainStrength > 0.05;
      rainEffect.mesh.visible = visible;
      rainEffect.mesh.material.opacity = THREE.MathUtils.lerp(rainEffect.mesh.material.opacity, rainStrength * 0.8, 0.1);
      if (visible) {
        const playerPosition = this.player.getPosition();
        rainEffect.mesh.position.set(playerPosition.x, playerPosition.y + 15, playerPosition.z);
        const positions = rainEffect.mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          positions.array[i * 3 + 1] -= rainEffect.velocities[i] * delta * (0.6 + rainStrength * 0.8);
          if (positions.array[i * 3 + 1] < -5) {
            positions.array[i * 3] = (Math.random() - 0.5) * rainEffect.area;
            positions.array[i * 3 + 1] = 50 + Math.random() * 10;
            positions.array[i * 3 + 2] = (Math.random() - 0.5) * rainEffect.area;
          }
        }
        positions.needsUpdate = true;
      }
    }

    if (this.weatherEffects.lightning) {
      const stormStrength = this.weatherStrength.storm;
      if (stormStrength > 0.05 && Math.random() < delta * (0.5 + stormStrength * 2)) {
        this.weatherEffects.lightning.intensity = 8 * stormStrength;
        this.weatherEffects.lightning.position.set(
          (Math.random() - 0.5) * CITY_BOUNDS,
          60 + Math.random() * 15,
          (Math.random() - 0.5) * CITY_BOUNDS
        );
      } else {
        this.weatherEffects.lightning.intensity = THREE.MathUtils.lerp(
          this.weatherEffects.lightning.intensity,
          0,
          0.1 + stormStrength * 0.2
        );
      }
    }
  }

  #blendWeather(current, next, t) {
    const getWeights = (state) => {
      switch (state) {
        case 'rain':
          return { rain: 1, fog: 0.25, storm: 0.1 };
        case 'fog':
          return { rain: 0.05, fog: 0.9, storm: 0.05 };
        case 'storm':
          return { rain: 0.85, fog: 0.35, storm: 1 };
        default:
          return { rain: 0, fog: 0.05, storm: 0 };
      }
    };

    const from = getWeights(current);
    const to = getWeights(next);
    this.weatherStrength.rain = THREE.MathUtils.lerp(from.rain, to.rain, t);
    this.weatherStrength.fog = THREE.MathUtils.lerp(from.fog, to.fog, t);
    this.weatherStrength.storm = THREE.MathUtils.lerp(from.storm, to.storm, t);
  }

  updateLighting(delta) {
    this.timeOfDay = (this.timeOfDay + delta * 0.01) % 1;
    const daylight = Math.sin(this.timeOfDay * Math.PI * 2) * 0.5 + 0.5;
    const weatherDim = 1 - this.weatherStrength.fog * 0.3 - this.weatherStrength.rain * 0.2;

    if (this.lights.ambient) {
      this.lights.ambient.intensity = (0.25 + daylight * 0.5) * weatherDim;
      this.lights.ambient.color.lerpColors(this.lightingPalette.ambientNight, this.lightingPalette.ambientDay, daylight);
    }

    if (this.lights.moon) {
      this.lights.moon.intensity = (0.35 + (1 - daylight) * 0.8) * (1 + this.weatherStrength.storm * 0.2);
    }

    if (this.lights.neon) {
      this.lights.neon.intensity = 0.9 + (1 - daylight) * 0.6 + this.weatherStrength.rain * 0.2;
    }

    this.lights.street.forEach((light) => {
      if (!light.isLight) return;
      const base = light.userData?.baseIntensity ?? 1;
      light.intensity = 0.18 + (1 - daylight) * base + this.weatherStrength.fog * 0.35;
    });

    if (this.skyUniforms) {
      this.skyUniforms.mixFactor.value = 0.35 + daylight * 0.45;
    }

    if (this.scene.fog) {
      this.scene.fog.density = 0.008 + (1 - daylight) * 0.012 + this.weatherStrength.fog * 0.02;
      this.scene.fog.color.lerpColors(this.lightingPalette.fogNight, this.lightingPalette.fogDay, daylight);
    }

    if (this.sky) {
      this.sky.rotation.y += delta * 0.002;
    }

    if (this.stars) {
      this.stars.visible = daylight < 0.65;
      this.stars.material.opacity = daylight < 0.5 ? 0.75 : (1 - daylight) * 1.2;
    }
  }

  updateCollectibles(delta) {
    const playerPosition = this.player.getPosition();

    this.collectibles.forEach((item) => {
      const { mesh } = item;
      if (mesh.userData.collected) return;

      mesh.rotation.y += mesh.userData.rotationSpeed * delta;
      mesh.position.y = mesh.userData.baseY + Math.sin(performance.now() * 0.002 + item.index) * 0.4;
      if (mesh.userData.aura) {
        mesh.userData.aura.scale.setScalar(1 + Math.sin(performance.now() * 0.003 + item.index) * 0.1);
      }
      if (mesh.material && 'emissiveIntensity' in mesh.material) {
        mesh.material.emissiveIntensity = 1.1 + Math.sin(performance.now() * 0.004 + item.index) * 0.3;
      }

      const distance = playerPosition.distanceTo(mesh.position);
      if (distance < 2.4) {
        mesh.userData.collected = true;
        this.shardsCollected += 1;
        this.shardCallback(this.shardsCollected);
        mesh.visible = false;
      }
    });
  }

  updatePlaza(delta) {
    if (!this.plazaObjects) return;
    this.plazaObjects.hologram.rotation.z += delta * 0.4;
    this.plazaObjects.particles.rotation.y += delta * 0.2;
  }

  updateWanted(delta) {
    const playerPosition = this.player.getPosition();
    let heat = 0;

    if (this.player.isSprinting && this.player.energy > 15) {
      heat = Math.max(heat, 0.6);
    }

    for (const zone of this.restrictedZones) {
      if (playerPosition.distanceTo(zone.center) < zone.radius) {
        heat = Math.max(heat, zone.heat);
      }
    }

    const decayRate = 0.35 + this.weatherStrength.fog * 0.2;
    if (heat > 0) {
      this.wantedLevel = Math.min(WANTED_MAX_LEVEL, this.wantedLevel + heat * delta);
    } else {
      this.wantedLevel = Math.max(0, this.wantedLevel - decayRate * delta);
    }

    const discreteLevel = Math.min(WANTED_MAX_LEVEL, Math.floor(this.wantedLevel + 0.001));
    if (discreteLevel !== this.displayedWantedLevel) {
      this.displayedWantedLevel = discreteLevel;
      this.wantedCallback(discreteLevel);
    }

    this.maxWantedLevel = Math.max(this.maxWantedLevel, discreteLevel);
  }

  updateSecurityDrone(delta) {
    if (!this.securityDrone) return;

    const level = this.displayedWantedLevel;
    if (level <= 0) {
      this.securityDrone.visible = false;
      if (this.securityDroneLight) {
        this.securityDroneLight.intensity = THREE.MathUtils.lerp(
          this.securityDroneLight.intensity,
          0,
          0.15
        );
      }
      return;
    }

    this.securityDrone.visible = true;
    const playerPosition = this.player.getPosition();
    const desiredHeight = 8 + Math.sin(performance.now() * 0.002) * 1.5;
    TMP_DIRECTION.subVectors(playerPosition, this.securityDrone.position);
    const distance = TMP_DIRECTION.length();
    if (distance > 0.001) {
      TMP_DIRECTION.normalize();
      const chaseSpeed = THREE.MathUtils.lerp(6, 18, level / WANTED_MAX_LEVEL);
      this.securityDrone.position.addScaledVector(TMP_DIRECTION, delta * chaseSpeed);
    }
    this.securityDrone.position.y = THREE.MathUtils.lerp(
      this.securityDrone.position.y,
      desiredHeight,
      0.08
    );

    if (this.securityDroneLight) {
      this.securityDroneLight.intensity = THREE.MathUtils.lerp(
        this.securityDroneLight.intensity,
        3 + level * 1.5,
        0.12
      );
      TMP_VECTOR.copy(playerPosition).sub(this.securityDrone.position);
      this.securityDroneLight.target.position.lerp(TMP_VECTOR, 0.12);
    }

    this.securityDrone.lookAt(playerPosition.x, playerPosition.y + 1.2, playerPosition.z);
  }

  updateRadio(delta) {
    if (!this.radio.tracks.length) return;
    this.radio.timer += delta;
    if (this.radio.timer > this.radio.duration) {
      this.advanceRadio();
    }
  }

  updateMinimapState() {
    if (!this.mapCallback) return;
    const playerPosition = this.player.getPosition();
    const playerHeading = this.player.getHeading ? this.player.getHeading() : this.camera.rotation.y;
    const missions = [];
    this.missionMarkers.forEach((value, key) => {
      let target = value;
      if (key === 'drone' && this.drone) {
        target = this.drone.position;
      } else if (key === 'shards') {
        const nextShard = this.collectibles.find(({ mesh }) => !mesh.userData.collected);
        target = nextShard ? nextShard.mesh.position : value;
      }
      if (!target) return;
      const mission = this.missions.find((m) => m.id === key);
      missions.push({ x: target.x, z: target.z, active: mission ? !mission.completed : true });
    });

    const vehicles = this.vehicles.map(({ group }) => ({ x: group.position.x, z: group.position.z }));
    const npcs = this.npcs.map(({ group }) => ({ x: group.position.x, z: group.position.z }));
    const collectibles = this.collectibles
      .filter(({ mesh }) => !mesh.userData.collected)
      .map(({ mesh }) => ({ x: mesh.position.x, z: mesh.position.z }));

    this.mapCallback({
      bounds: CITY_BOUNDS,
      player: { x: playerPosition.x, z: playerPosition.z, heading: playerHeading },
      missions,
      vehicles,
      npcs,
      collectibles
    });
  }

  updateMissions(delta) {
    const playerPosition = this.player.getPosition();
    let changed = false;

    const shardsMission = this.missions.find((m) => m.id === 'shards');
    if (shardsMission && !shardsMission.completed && this.shardsCollected >= 5) {
      shardsMission.completed = true;
      changed = true;
    }

    const plazaMission = this.missions.find((m) => m.id === 'plaza');
    if (
      plazaMission &&
      !plazaMission.completed &&
      playerPosition.distanceTo(new THREE.Vector3(0, playerPosition.y, 0)) < 6.5
    ) {
      plazaMission.completed = true;
      changed = true;
    }

    const droneMission = this.missions.find((m) => m.id === 'drone');
    if (droneMission && !droneMission.completed && this.droneProximityTime >= DRONE_MISSION_DURATION) {
      droneMission.completed = true;
      changed = true;
    }

    const musicianMission = this.missions.find((m) => m.id === 'musician');
    if (
      musicianMission &&
      !musicianMission.completed &&
      this.npcMissionTarget &&
      playerPosition.distanceTo(this.npcMissionTarget.position) < 3.2
    ) {
      musicianMission.completed = true;
      changed = true;
    }

    const boardwalkMission = this.missions.find((m) => m.id === 'boardwalk');
    if (
      boardwalkMission &&
      !boardwalkMission.completed &&
      this.boardwalkArea &&
      this.boardwalkArea.containsPoint(playerPosition)
    ) {
      if (this.player.isSprinting && this.player.energy > 10) {
        boardwalkMission.completed = true;
        changed = true;
      }
    }

    const wantedMission = this.missions.find((m) => m.id === 'wanted');
    if (wantedMission && !wantedMission.completed && this.maxWantedLevel >= 3 && this.displayedWantedLevel === 0) {
      wantedMission.completed = true;
      this.advanceRadio();
      changed = true;
    }

    if (changed) {
      this.missionCallback(this.missions);
    }
  }
}
