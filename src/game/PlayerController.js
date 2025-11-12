import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

const GRAVITY = 30;
const WALK_SPEED = 11;
const SPRINT_SPEED = 18;
const JUMP_FORCE = 9;

export class PlayerController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.controls = new PointerLockControls(camera, domElement);
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isSprinting = false;
    this.canJump = true;
    this.playerHeight = 1.6;
    this.energy = 100;

    this.onLock = () => {};
    this.onUnlock = () => {};
    this.onEnergyChange = () => {};

    this.#bindMethods();
  }

  #bindMethods() {
    this.handleKeyDown = (event) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.moveForward = true;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.moveLeft = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.moveBackward = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.moveRight = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          if (this.energy > 5) {
            this.isSprinting = true;
          }
          break;
        case 'Space':
          if (this.canJump) {
            this.velocity.y += JUMP_FORCE;
            this.canJump = false;
          }
          break;
        default:
          break;
      }
    };

    this.handleKeyUp = (event) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.moveForward = false;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.moveLeft = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.moveBackward = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.moveRight = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = false;
          break;
        default:
          break;
      }
    };

    this.handleLock = () => {
      this.onLock();
    };

    this.handleUnlock = () => {
      this.onUnlock();
      this.moveForward = false;
      this.moveBackward = false;
      this.moveLeft = false;
      this.moveRight = false;
      this.isSprinting = false;
    };
  }

  connect() {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
    this.controls.addEventListener('lock', this.handleLock);
    this.controls.addEventListener('unlock', this.handleUnlock);
  }

  disconnect() {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    this.controls.removeEventListener('lock', this.handleLock);
    this.controls.removeEventListener('unlock', this.handleUnlock);
  }

  attachEvents({ onLock, onUnlock, onEnergyChange }) {
    if (onLock) this.onLock = onLock;
    if (onUnlock) this.onUnlock = onUnlock;
    if (onEnergyChange) this.onEnergyChange = onEnergyChange;
  }

  lock() {
    this.controls.lock();
  }

  get object() {
    return this.controls.getObject();
  }

  getPosition() {
    return this.controls.getObject().position;
  }

  getHeading() {
    return this.controls.getObject().rotation.y;
  }

  isLocked() {
    return this.controls.isLocked;
  }

  update(delta, obstacles = [], bounds = 100) {
    const previousPosition = this.getPosition().clone();
    const damping = this.isLocked() ? 8 : 12;

    this.velocity.x -= this.velocity.x * damping * delta;
    this.velocity.z -= this.velocity.z * damping * delta;
    this.velocity.y -= GRAVITY * delta;

    const acceleration = this.isSprinting && this.energy > 0 ? SPRINT_SPEED : WALK_SPEED;

    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    if (this.moveForward || this.moveBackward) {
      this.velocity.z -= this.direction.z * acceleration * delta;
    }

    if (this.moveLeft || this.moveRight) {
      this.velocity.x -= this.direction.x * acceleration * delta;
    }

    // Energy economy
    const moving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
    let energyChanged = false;
    if (this.isSprinting && moving && this.energy > 0) {
      const before = this.energy;
      this.energy = Math.max(0, this.energy - delta * 14);
      if (before !== this.energy) energyChanged = true;
      if (this.energy <= 0) {
        this.isSprinting = false;
      }
    } else if (!this.isSprinting) {
      const before = this.energy;
      this.energy = Math.min(100, this.energy + delta * (moving ? 4 : 8));
      if (Math.abs(before - this.energy) > 0.1) energyChanged = true;
    }

    if (energyChanged) {
      this.onEnergyChange(Math.round(this.energy));
    }

    this.controls.moveRight(-this.velocity.x * delta);
    this.controls.moveForward(-this.velocity.z * delta);
    const position = this.getPosition();
    position.y += this.velocity.y * delta;

    const collided = this.#collides(position, obstacles, bounds);
    if (collided) {
      position.copy(previousPosition);
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    if (position.y < this.playerHeight) {
      this.velocity.y = 0;
      position.y = this.playerHeight;
      this.canJump = true;
    }
  }

  #collides(position, obstacles, bounds) {
    if (Math.abs(position.x) > bounds || Math.abs(position.z) > bounds) {
      return true;
    }

    const padding = 0.6;
    const playerBox = new THREE.Box3(
      new THREE.Vector3(position.x - padding, position.y - this.playerHeight, position.z - padding),
      new THREE.Vector3(position.x + padding, position.y + 0.5, position.z + padding)
    );

    return obstacles.some((box) => box.intersectsBox(playerBox));
  }
}
