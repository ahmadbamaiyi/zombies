// ============================================
// ZOMBIE APOCALYPSE SURVIVAL v2.1
// Fixed Mobile Controls
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 600;
canvas.height = 800;

// ============================================
// GAME STATE
// ============================================
const state = {
    player: {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 16,
        speed: 3.5,
        hp: 200,
        maxHp: 200,
        angle: 0,
        invincible: 0,
        invincibleDuration: 30,
    },
    zombies: [],
    bullets: [],
    particles: [],
    powerUps: [],
    bloodStains: [],
    weapons: [],
    currentWeapon: 0,
    wave: 1,
    kills: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    gameOver: false,
    paused: false,
    waveActive: false,
    zombiesToSpawn: 0,
    zombiesSpawned: 0,
    spawnTimer: 0,
    spawnDelay: 60,
    screenShake: 0,
    keys: {},
    // Mouse/Desktop aiming
    mouseX: canvas.width / 2,
    mouseY: canvas.height / 2,
    mouseDown: false,
    // Mobile twin-stick - TRACKED BY TOUCH IDENTIFIER
    moveTouchId: null,
    aimTouchId: null,
    moveJoystick: { active: false, startX: 0, startY: 0, x: 0, y: 0 },
    aimJoystick: { active: false, startX: 0, startY: 0, x: 0, y: 0, angle: 0 },
    // Auto-fire
    autoFire: true,
    shootCooldown: 0,
    reloading: false,
    reloadTimer: 0,
    ammoWarning: 0,
    regenTimer: 0,
    healingText: 0,
};

// ============================================
// WEAPON DEFINITIONS
// ============================================
const WEAPONS = [
    {
        name: 'Pistol',
        damage: 25,
        fireRate: 15,
        spread: 0.04,
        bulletsPerShot: 1,
        speed: 10,
        range: 500,
        ammo: 20,
        maxAmmo: 20,
        reloadTime: 40,
        color: '#ffcc00',
        symbol: '🔫',
    },
    {
        name: 'Shotgun',
        damage: 18,
        fireRate: 40,
        spread: 0.3,
        bulletsPerShot: 6,
        speed: 8,
        range: 250,
        ammo: 8,
        maxAmmo: 8,
        reloadTime: 65,
        color: '#ff6600',
        symbol: '💥',
    },
    {
        name: 'Assault Rifle',
        damage: 15,
        fireRate: 7,
        spread: 0.07,
        bulletsPerShot: 1,
        speed: 12,
        range: 600,
        ammo: 35,
        maxAmmo: 35,
        reloadTime: 50,
        color: '#00ccff',
        symbol: '🎯',
    },
    {
        name: 'Flamethrower',
        damage: 4,
        fireRate: 3,
        spread: 0.7,
        bulletsPerShot: 3,
        speed: 5,
        range: 130,
        ammo: 120,
        maxAmmo: 120,
        reloadTime: 80,
        color: '#ff4400',
        symbol: '🔥',
        fire: true,
    },
];

// ============================================
// ZOMBIE TYPES
// ============================================
const ZOMBIE_TYPES = {
    walker: {
        name: 'Walker',
        hp: 40,
        speed: 1.2,
        damage: 5,
        radius: 14,
        color: '#557744',
        xp: 10,
        weight: 1,
    },
    runner: {
        name: 'Runner',
        hp: 25,
        speed: 3.0,
        damage: 4,
        radius: 12,
        color: '#994422',
        xp: 15,
        weight: 2,
    },
    tank: {
        name: 'Tank',
        hp: 150,
        speed: 0.8,
        damage: 12,
        radius: 22,
        color: '#444444',
        xp: 50,
        weight: 5,
    },
    spitter: {
        name: 'Spitter',
        hp: 35,
        speed: 1.5,
        damage: 7,
        radius: 15,
        color: '#88aa22',
        xp: 20,
        weight: 3,
        ranged: true,
    },
};

// ============================================
// PARTICLE CLASS
// ============================================
class Particle {
    constructor(x, y, vx, vy, color, size, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = life;
        this.maxLife = life;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1;
        this.life--;
        return this.life <= 0;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// ============================================
// ZOMBIE CLASS
// ============================================
class Zombie {
    constructor(x, y, type, wave) {
        const def = ZOMBIE_TYPES[type];
        this.x = x;
        this.y = y;
        this.type = type;
        this.name = def.name;
        this.maxHp = def.hp + wave * 10;
        this.hp = this.maxHp;
        this.speed = def.speed + wave * 0.05;
        this.damage = def.damage + Math.floor(wave / 2);
        this.radius = def.radius;
        this.color = def.color;
        this.xp = def.xp + wave * 2;
        this.ranged = def.ranged || false;
        this.attackCooldown = 0;
        this.angle = 0;
        this.staggerTimer = 0;
        this.wobbleOffset = Math.random() * Math.PI * 2;
    }

    update(player, zombies) {
        if (this.staggerTimer > 0) {
            this.staggerTimer--;
            return;
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.angle = Math.atan2(dy, dx);

        let moveX = 0;
        let moveY = 0;

        if (dist > 30) {
            moveX = (dx / dist) * this.speed;
            moveY = (dy / dist) * this.speed;
        }

        for (const other of zombies) {
            if (other === this) continue;
            const odx = this.x - other.x;
            const ody = this.y - other.y;
            const odist = Math.sqrt(odx * odx + ody * ody);
            if (odist < this.radius * 2 && odist > 0) {
                moveX += (odx / odist) * 0.5;
                moveY += (ody / odist) * 0.5;
            }
        }

        this.x += moveX;
        this.y += moveY;

        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        if (dist < this.radius + player.radius + 5) {
            if (this.attackCooldown <= 0) {
                player.hp -= this.damage;
                player.invincible = player.invincibleDuration;
                this.attackCooldown = 60;
                state.screenShake = 4;

                for (let i = 0; i < 4; i++) {
                    state.particles.push(new Particle(
                        player.x, player.y,
                        (Math.random() - 0.5) * 3,
                        (Math.random() - 0.5) * 3,
                        '#ff0000', 2 + Math.random() * 2, 8 + Math.random() * 8
                    ));
                }
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown--;
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.staggerTimer = 5;

        for (let i = 0; i < 6; i++) {
            state.particles.push(new Particle(
                this.x, this.y,
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5,
                this.color, 2 + Math.random() * 4, 10 + Math.random() * 20
            ));
        }

        state.bloodStains.push({
            x: this.x + (Math.random() - 0.5) * 10,
            y: this.y + (Math.random() - 0.5) * 10,
            size: 3 + Math.random() * 8,
            alpha: 0.5 + Math.random() * 0.3,
        });
        if (state.bloodStains.length > 120) state.bloodStains.shift();

        return this.hp <= 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const wobble = Math.sin(Date.now() / 200 + this.wobbleOffset) * 2;

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(2, 2, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(wobble, wobble, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(-5, -4, 3, 0, Math.PI * 2);
        ctx.arc(5, -4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (this.type === 'tank') {
            ctx.fillStyle = '#555';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius - 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#777';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        if (this.hp < this.maxHp) {
            const barWidth = this.radius * 2;
            const barY = -this.radius - 10;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(-barWidth / 2 - 1, barY - 1, barWidth + 2, 5);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(-barWidth / 2, barY, barWidth * (this.hp / this.maxHp), 3);
        }

        ctx.restore();
    }
}

// ============================================
// BULLET CLASS
// ============================================
class Bullet {
    constructor(x, y, angle, weapon) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * weapon.speed;
        this.vy = Math.sin(angle) * weapon.speed;
        this.damage = weapon.damage;
        this.color = weapon.color;
        this.range = weapon.range;
        this.traveled = 0;
        this.isFire = weapon.fire || false;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.traveled += Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        if (this.isFire && Math.random() < 0.5) {
            state.particles.push(new Particle(
                this.x, this.y,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2 - 1,
                ['#ff4400', '#ff6600', '#ffaa00'][Math.floor(Math.random() * 3)],
                2 + Math.random() * 3, 6 + Math.random() * 10
            ));
        }

        return this.traveled > this.range ||
            this.x < -20 || this.x > canvas.width + 20 ||
            this.y < -20 || this.y > canvas.height + 20;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.isFire ? 10 : 6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.isFire ? 5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vx * 3, this.y - this.vy * 3);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

// ============================================
// POWER-UP CLASS
// ============================================
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 14;
        this.life = 480;

        switch (type) {
            case 'health':
                this.color = '#ff4444';
                this.symbol = '❤️';
                this.glowColor = '#ff0000';
                break;
            case 'ammo':
                this.color = '#ffcc00';
                this.symbol = '🔫';
                this.glowColor = '#ffaa00';
                break;
            case 'speed':
                this.color = '#44ff44';
                this.symbol = '💨';
                this.glowColor = '#00ff00';
                break;
            case 'nuke':
                this.color = '#ff8800';
                this.symbol = '💣';
                this.glowColor = '#ff4400';
                break;
        }
    }

    update() {
        this.life--;
        this.y += Math.sin(Date.now() / 300 + this.x) * 0.3;
        return this.life <= 0;
    }

    draw(ctx) {
        const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;

        ctx.fillStyle = this.glowColor;
        ctx.globalAlpha = 0.2 * pulse;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.symbol, this.x, this.y);
    }
}

// ============================================
// WAVE MANAGEMENT
// ============================================
function startWave() {
    if (state.waveActive || state.gameOver) return;

    state.waveActive = true;
    state.wave++;
    state.zombiesToSpawn = 5 + state.wave * 3;
    state.zombiesSpawned = 0;
    state.spawnTimer = 0;
    state.spawnDelay = Math.max(18, 55 - state.wave * 2);

    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 20);
    state.healingText = 40;

    document.getElementById('wave-hud').textContent = state.wave;
}

function spawnZombie() {
    let x, y;
    const side = Math.floor(Math.random() * 4);
    const margin = 30;

    switch (side) {
        case 0: x = Math.random() * canvas.width; y = -margin; break;
        case 1: x = canvas.width + margin; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + margin; break;
        case 3: x = -margin; y = Math.random() * canvas.height; break;
    }

    let type;
    const roll = Math.random();
    if (state.wave >= 8 && roll < 0.1) type = 'tank';
    else if (state.wave >= 5 && roll < 0.25) type = 'spitter';
    else if (state.wave >= 3 && roll < 0.5) type = 'runner';
    else type = 'walker';

    state.zombies.push(new Zombie(x, y, type, state.wave));
    state.zombiesSpawned++;
}

function updateWaveSpawning() {
    if (!state.waveActive) return;

    if (state.zombiesSpawned < state.zombiesToSpawn) {
        state.spawnTimer++;
        if (state.spawnTimer >= state.spawnDelay) {
            state.spawnTimer = 0;
            spawnZombie();
        }
    }

    if (state.zombiesSpawned >= state.zombiesToSpawn && state.zombies.length === 0) {
        state.waveActive = false;
        state.score += state.wave * 100;

        if (Math.random() < 0.6) {
            const types = ['health', 'ammo', 'speed', 'nuke'];
            const type = types[Math.floor(Math.random() * types.length)];
            state.powerUps.push(new PowerUp(
                Math.random() * (canvas.width - 100) + 50,
                Math.random() * (canvas.height - 200) + 100,
                type
            ));
        }

        setTimeout(() => {
            if (!state.gameOver) startWave();
        }, 2500);
    }
}

// ============================================
// AUTO-FIRE SYSTEM
// ============================================
function isMobileDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function autoFire() {
    if (state.gameOver || state.reloading) return;
    if (state.shootCooldown > 0) return;

    const shouldFire = state.autoFire && 
        (state.aimJoystick.active || state.mouseDown || isMobileDevice());

    if (!shouldFire) return;

    const weapon = WEAPONS[state.currentWeapon];

    if (weapon.ammo <= 0) {
        reloadWeapon();
        return;
    }

    weapon.ammo--;
    state.shootCooldown = weapon.fireRate;

    if (weapon.ammo <= 0) {
        state.ammoWarning = 30;
    }

    const p = state.player;
    const angle = p.angle;

    for (let i = 0; i < weapon.bulletsPerShot; i++) {
        const spreadAngle = angle + (Math.random() - 0.5) * weapon.spread * 2;
        state.bullets.push(new Bullet(
            p.x + Math.cos(angle) * 20,
            p.y + Math.sin(angle) * 20,
            spreadAngle,
            weapon
        ));
    }

    for (let i = 0; i < 4; i++) {
        state.particles.push(new Particle(
            p.x + Math.cos(angle) * 22,
            p.y + Math.sin(angle) * 22,
            Math.cos(angle) * 2 + (Math.random() - 0.5) * 2,
            Math.sin(angle) * 2 + (Math.random() - 0.5) * 2,
            weapon.color, 2 + Math.random() * 3, 6 + Math.random() * 6
        ));
    }

    updateWeaponUI();
}

// ============================================
// WEAPON RELOAD
// ============================================
function reloadWeapon() {
    if (state.reloading) return;
    const weapon = WEAPONS[state.currentWeapon];
    if (weapon.ammo === weapon.maxAmmo) return;

    state.reloading = true;
    state.reloadTimer = weapon.reloadTime;
    state.ammoWarning = 0;
}

function finishReload() {
    const weapon = WEAPONS[state.currentWeapon];
    weapon.ammo = weapon.maxAmmo;
    state.reloading = false;
    state.reloadTimer = 0;
    state.ammoWarning = 0;
    updateWeaponUI();
}

// ============================================
// POWER-UP EFFECTS
// ============================================
function activatePowerUp(type) {
    switch (type) {
        case 'health':
            state.player.hp = Math.min(state.player.maxHp, state.player.hp + 80);
            state.healingText = 60;
            for (let i = 0; i < 20; i++) {
                state.particles.push(new Particle(
                    state.player.x, state.player.y,
                    (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5,
                    '#ff4444', 4, 18
                ));
            }
            break;

        case 'ammo':
            WEAPONS.forEach(w => w.ammo = w.maxAmmo);
            updateWeaponUI();
            for (let i = 0; i < 15; i++) {
                state.particles.push(new Particle(
                    state.player.x, state.player.y,
                    (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5,
                    '#ffcc00', 3, 15
                ));
            }
            break;

        case 'speed':
            state.player.speed = 6;
            setTimeout(() => { state.player.speed = 3.5; }, 5000);
            for (let i = 0; i < 15; i++) {
                state.particles.push(new Particle(
                    state.player.x, state.player.y,
                    (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5,
                    '#44ff44', 3, 15
                ));
            }
            break;

        case 'nuke':
            for (const zombie of state.zombies) {
                for (let i = 0; i < 12; i++) {
                    state.particles.push(new Particle(
                        zombie.x, zombie.y,
                        (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10,
                        '#ff8800', 5, 25
                    ));
                }
                state.kills++;
                state.score += zombie.xp * 2;
                state.combo++;
            }
            state.zombies = [];
            state.screenShake = 20;
            updateUI();
            break;
    }
}

// ============================================
// COLLISION DETECTION
// ============================================
function checkBulletZombieCollisions() {
    for (let b = state.bullets.length - 1; b >= 0; b--) {
        const bullet = state.bullets[b];

        for (let z = state.zombies.length - 1; z >= 0; z--) {
            const zombie = state.zombies[z];
            const dx = bullet.x - zombie.x;
            const dy = bullet.y - zombie.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < zombie.radius + 6) {
                if (zombie.takeDamage(bullet.damage)) {
                    state.kills++;
                    state.score += zombie.xp;
                    state.combo++;
                    state.comboTimer = 90;

                    if (state.combo > state.maxCombo) state.maxCombo = state.combo;

                    for (let i = 0; i < 12; i++) {
                        state.particles.push(new Particle(
                            zombie.x, zombie.y,
                            (Math.random() - 0.5) * 6,
                            (Math.random() - 0.5) * 6,
                            zombie.color, 3 + Math.random() * 4, 15 + Math.random() * 20
                        ));
                    }

                    state.zombies.splice(z, 1);
                }

                if (!bullet.isFire || Math.random() < 0.5) {
                    state.bullets.splice(b, 1);
                }
                updateUI();
                break;
            }
        }
    }
}

function checkPlayerZombieCollisions() {
    if (state.player.invincible > 0) return;

    for (const zombie of state.zombies) {
        const dx = state.player.x - zombie.x;
        const dy = state.player.y - zombie.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < state.player.radius + zombie.radius) {
            state.player.hp -= zombie.damage;
            state.player.invincible = state.player.invincibleDuration;
            state.screenShake = 5;

            const pushAngle = Math.atan2(dy, dx);
            state.player.x += Math.cos(pushAngle) * 10;
            state.player.y += Math.sin(pushAngle) * 10;

            for (let i = 0; i < 5; i++) {
                state.particles.push(new Particle(
                    state.player.x, state.player.y,
                    (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4,
                    '#ff0000', 3, 12
                ));
            }
        }
    }
}

function checkPlayerPowerUpCollisions() {
    for (let i = state.powerUps.length - 1; i >= 0; i--) {
        const pu = state.powerUps[i];
        const dx = state.player.x - pu.x;
        const dy = state.player.y - pu.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < state.player.radius + pu.radius + 10) {
            activatePowerUp(pu.type);
            state.powerUps.splice(i, 1);
        }
    }
}

// ============================================
// UI UPDATES
// ============================================
function updateUI() {
    const hp = Math.max(0, Math.ceil(state.player.hp));
    document.getElementById('health-hud').textContent = `❤️ ${hp}`;
    document.getElementById('kills-hud').textContent = state.kills;
    document.getElementById('score-hud').textContent = state.score;

    const healthHud = document.getElementById('health-hud');
    if (state.player.hp < 50) {
        healthHud.classList.add('danger');
    } else {
        healthHud.classList.remove('danger');
    }
}

function updateWeaponUI() {
    const weapon = WEAPONS[state.currentWeapon];
    const slots = document.querySelectorAll('.weapon-slot');
    slots.forEach((slot, i) => {
        slot.classList.toggle('active', i === state.currentWeapon);
    });
}

// ============================================
// RENDERING
// ============================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let shakeX = 0, shakeY = 0;
    if (state.screenShake > 0) {
        shakeX = (Math.random() - 0.5) * state.screenShake;
        shakeY = (Math.random() - 0.5) * state.screenShake;
        state.screenShake *= 0.85;
        if (state.screenShake < 0.5) state.screenShake = 0;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Ground
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Blood stains
    for (const stain of state.bloodStains) {
        ctx.fillStyle = `rgba(80, 0, 0, ${stain.alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(stain.x, stain.y, stain.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Power-ups
    for (const pu of state.powerUps) {
        pu.draw(ctx);
    }

    // Zombies
    for (const zombie of state.zombies) {
        zombie.draw(ctx);
    }

    // Bullets
    for (const bullet of state.bullets) {
        bullet.draw(ctx);
    }

    // Player
    drawPlayer();

    // Particles
    for (const particle of state.particles) {
        particle.draw(ctx);
    }

    ctx.restore();

    drawHUD();
    drawMobileControls();

    if (state.gameOver) {
        drawGameOver();
    }
}

function drawPlayer() {
    const p = state.player;

    if (p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }

    if (p.invincible > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(p.x + 2, p.y + 2, p.radius, 0, Math.PI * 2);
    ctx.fill();

    const bodyGrad = ctx.createRadialGradient(p.x - 3, p.y - 3, 2, p.x, p.y, p.radius);
    bodyGrad.addColorStop(0, '#66aaff');
    bodyGrad.addColorStop(1, '#2255cc');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#444';
    ctx.fillRect(8, -3, 16, 6);
    ctx.fillStyle = '#666';
    ctx.fillRect(16, -5, 10, 10);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, -5, 10, 10);
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x - 4, p.y - 3, 3, 0, Math.PI * 2);
    ctx.arc(p.x + 4, p.y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(p.x - 3, p.y - 3, 1.5, 0, Math.PI * 2);
    ctx.arc(p.x + 5, p.y - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;

    const barWidth = 36;
    const barY = p.y - p.radius - 14;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(p.x - barWidth / 2 - 1, barY - 1, barWidth + 2, 7);

    const hpPercent = p.hp / p.maxHp;
    let barColor = hpPercent > 0.6 ? '#44ff44' : hpPercent > 0.3 ? '#ffaa00' : '#ff0000';
    ctx.fillStyle = barColor;
    ctx.fillRect(p.x - barWidth / 2, barY, barWidth * hpPercent, 5);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHp}`, p.x, barY - 3);
}

function drawHUD() {
    if (state.combo > 1 && state.comboTimer > 0) {
        const alpha = Math.min(1, state.comboTimer / 60);
        const scale = 1 + state.combo * 0.02;
        ctx.save();
        ctx.translate(canvas.width / 2, 60);
        ctx.scale(scale, scale);
        ctx.fillStyle = `rgba(255, 200, 0, ${alpha})`;
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${state.combo}x COMBO!`, 0, 0);
        ctx.restore();
    }

    if (state.ammoWarning > 0 && state.ammoWarning % 20 < 10) {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('NO AMMO!', canvas.width / 2, canvas.height / 2 + 30);
    }

    if (state.reloading) {
        const progress = 1 - (state.reloadTimer / WEAPONS[state.currentWeapon].reloadTime);
        const barY = canvas.height / 2 + 40;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(canvas.width / 2 - 50, barY, 100, 10);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(canvas.width / 2 - 50, barY, 100 * progress, 10);
        ctx.fillStyle = '#fff';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('RELOADING...', canvas.width / 2, barY - 5);
    }

    if (state.healingText > 0) {
        const alpha = Math.min(1, state.healingText / 30);
        ctx.fillStyle = `rgba(68, 255, 68, ${alpha})`;
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('+HP', canvas.width / 2, canvas.height / 2 - 60);
        state.healingText--;
    }

    if (!state.waveActive && state.zombies.length === 0 && state.wave > 0) {
        const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Wave ${state.wave + 1} incoming...`, canvas.width / 2, canvas.height / 2 - 30);
    }
}

function drawMobileControls() {
    if (!isMobileDevice()) return;

    const alpha = 0.2;

    // Left side - Movement joystick
    const moveCenterX = 80;
    const moveCenterY = canvas.height - 100;

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(moveCenterX, moveCenterY, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha + 0.15})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Move thumb position
    let thumbMX = moveCenterX;
    let thumbMY = moveCenterY;
    if (state.moveJoystick.active) {
        thumbMX = moveCenterX + state.moveJoystick.x * 40;
        thumbMY = moveCenterY + state.moveJoystick.y * 40;
    }

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha + 0.3})`;
    ctx.beginPath();
    ctx.arc(thumbMX, thumbMY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MOVE', moveCenterX, moveCenterY + 4);

    // Right side - Aim joystick
    const aimCenterX = canvas.width - 80;
    const aimCenterY = canvas.height - 100;

    ctx.fillStyle = `rgba(255, 80, 80, ${alpha})`;
    ctx.beginPath();
    ctx.arc(aimCenterX, aimCenterY, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 80, 80, ${alpha + 0.15})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Aim thumb position
    let thumbAX = aimCenterX;
    let thumbAY = aimCenterY;
    if (state.aimJoystick.active) {
        const dist = Math.sqrt(state.aimJoystick.x * state.aimJoystick.x + state.aimJoystick.y * state.aimJoystick.y);
        if (dist > 10) {
            const scale = Math.min(dist, 40) / Math.max(dist, 1);
            thumbAX = aimCenterX + state.aimJoystick.x * scale;
            thumbAY = aimCenterY + state.aimJoystick.y * scale;
        }
    }

    ctx.fillStyle = `rgba(255, 80, 80, ${alpha + 0.3})`;
    ctx.beginPath();
    ctx.arc(thumbAX, thumbAY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff6666';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('AIM', aimCenterX, aimCenterY + 4);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('YOU DIED', canvas.width / 2, canvas.height / 2 - 50);

    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.fillText(`Waves: ${state.wave - 1}`, canvas.width / 2, canvas.height / 2);
    ctx.fillText(`Kills: ${state.kills}`, canvas.width / 2, canvas.height / 2 + 28);
    ctx.fillText(`Score: ${state.score}`, canvas.width / 2, canvas.height / 2 + 56);
    ctx.fillText(`Best Combo: ${state.maxCombo}x`, canvas.width / 2, canvas.height / 2 + 84);

    ctx.fillStyle = '#ffcc00';
    ctx.font = '18px Arial';
    const pulse = Math.sin(Date.now() / 500) * 0.5 + 0.5;
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fillText('TAP OR PRESS R TO RESTART', canvas.width / 2, canvas.height / 2 + 130);
    ctx.globalAlpha = 1;
}

// ============================================
// FIXED MOBILE TOUCH CONTROLS
// ============================================
function getCanvasTouchPos(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (touch.clientX - rect.left) * (canvas.width / rect.width),
        y: (touch.clientY - rect.top) * (canvas.height / rect.height),
    };
}

function setupMobileControls() {
    // REMOVE old button handlers first by cloning and replacing
    const reloadBtn = document.getElementById('reload-btn');
    const swapBtn = document.getElementById('weapon-swap-btn');
    
    const newReloadBtn = reloadBtn.cloneNode(true);
    const newSwapBtn = swapBtn.cloneNode(true);
    reloadBtn.parentNode.replaceChild(newReloadBtn, reloadBtn);
    swapBtn.parentNode.replaceChild(newSwapBtn, swapBtn);

    // Button handlers with stopPropagation
    newReloadBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        reloadWeapon();
    });

    newSwapBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.currentWeapon = (state.currentWeapon + 1) % WEAPONS.length;
        updateWeaponUI();
    });

    // CANVAS TOUCH HANDLERS
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        
        if (state.gameOver) {
            restartGame();
            return;
        }

        // Process all active touches
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const pos = getCanvasTouchPos(touch);

            // Determine which side and assign touch ID
            if (pos.x < canvas.width / 2) {
                // LEFT SIDE = MOVEMENT
                state.moveTouchId = touch.identifier;
                state.moveJoystick.active = true;
                state.moveJoystick.startX = pos.x;
                state.moveJoystick.startY = pos.y;
                state.moveJoystick.x = 0;
                state.moveJoystick.y = 0;
            } else {
                // RIGHT SIDE = AIM
                state.aimTouchId = touch.identifier;
                state.aimJoystick.active = true;
                state.aimJoystick.startX = pos.x;
                state.aimJoystick.startY = pos.y;
                state.aimJoystick.x = 0;
                state.aimJoystick.y = 0;
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const pos = getCanvasTouchPos(touch);

            // Check which joystick this touch belongs to
            if (touch.identifier === state.moveTouchId) {
                // MOVEMENT JOYSTICK
                const dx = pos.x - state.moveJoystick.startX;
                const dy = pos.y - state.moveJoystick.startY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const maxDist = 40;

                if (dist < maxDist && dist > 0) {
                    state.moveJoystick.x = dx / maxDist;
                    state.moveJoystick.y = dy / maxDist;
                } else if (dist > 0) {
                    state.moveJoystick.x = dx / dist;
                    state.moveJoystick.y = dy / dist;
                } else {
                    state.moveJoystick.x = 0;
                    state.moveJoystick.y = 0;
                }
            } else if (touch.identifier === state.aimTouchId) {
                // AIM JOYSTICK
                const dx = pos.x - state.aimJoystick.startX;
                const dy = pos.y - state.aimJoystick.startY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                state.aimJoystick.x = dx;
                state.aimJoystick.y = dy;

                // Update player angle if the aim movement is significant
                if (dist > 15) {
                    state.aimJoystick.angle = Math.atan2(dy, dx);
                    state.player.angle = state.aimJoystick.angle;
                }
            }
            // If touch is on left but belongs to right, reassign
            else if (pos.x < canvas.width / 2 && state.moveTouchId === null) {
                state.moveTouchId = touch.identifier;
                state.moveJoystick.active = true;
                state.moveJoystick.startX = pos.x;
                state.moveJoystick.startY = pos.y;
                state.moveJoystick.x = 0;
                state.moveJoystick.y = 0;
            } else if (pos.x >= canvas.width / 2 && state.aimTouchId === null) {
                state.aimTouchId = touch.identifier;
                state.aimJoystick.active = true;
                state.aimJoystick.startX = pos.x;
                state.aimJoystick.startY = pos.y;
                state.aimJoystick.x = 0;
                state.aimJoystick.y = 0;
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];

            if (touch.identifier === state.moveTouchId) {
                // Release movement
                state.moveTouchId = null;
                state.moveJoystick.active = false;
                state.moveJoystick.x = 0;
                state.moveJoystick.y = 0;
            } else if (touch.identifier === state.aimTouchId) {
                // Release aim
                state.aimTouchId = null;
                state.aimJoystick.active = false;
                state.aimJoystick.x = 0;
                state.aimJoystick.y = 0;
                // DON'T reset angle - player keeps facing last direction
            }
        }

        // If all touches released, check if we need to restart
        if (e.touches.length === 0 && state.gameOver) {
            restartGame();
        }
    }, { passive: false });

    canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        // Reset all joysticks
        state.moveTouchId = null;
        state.aimTouchId = null;
        state.moveJoystick.active = false;
        state.moveJoystick.x = 0;
        state.moveJoystick.y = 0;
        state.aimJoystick.active = false;
        state.aimJoystick.x = 0;
        state.aimJoystick.y = 0;
    }, { passive: false });
}

// ============================================
// DESKTOP CONTROLS
// ============================================
function setupDesktopControls() {
    document.addEventListener('keydown', (e) => {
        state.keys[e.key.toLowerCase()] = true;

        if (e.key.toLowerCase() === 'r' && state.gameOver) {
            restartGame();
        }
        if (e.key.toLowerCase() === 'r' && !state.gameOver) {
            reloadWeapon();
        }
        if (e.key >= '1' && e.key <= '4') {
            state.currentWeapon = parseInt(e.key) - 1;
            updateWeaponUI();
        }
    });

    document.addEventListener('keyup', (e) => {
        state.keys[e.key.toLowerCase()] = false;
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        state.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
        state.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    });

    canvas.addEventListener('mousedown', (e) => {
        if (state.gameOver) {
            restartGame();
            return;
        }
        state.mouseDown = true;
    });

    canvas.addEventListener('mouseup', () => {
        state.mouseDown = false;
    });

    canvas.addEventListener('mouseleave', () => {
        state.mouseDown = false;
    });
}

// ============================================
// GAME LOOP
// ============================================
function update() {
    if (state.gameOver) return;

    const p = state.player;

    // Desktop aiming (mouse)
    if (!isMobileDevice() || (!state.aimJoystick.active && state.mouseDown)) {
        p.angle = Math.atan2(state.mouseY - p.y, state.mouseX - p.x);
    }

    // Reload timer
    if (state.reloading) {
        state.reloadTimer--;
        if (state.reloadTimer <= 0) finishReload();
    }

    // Shoot cooldown
    if (state.shootCooldown > 0) state.shootCooldown--;

    // Combo timer
    if (state.comboTimer > 0) {
        state.comboTimer--;
        if (state.comboTimer <= 0) state.combo = 0;
    }

    // Ammo warning
    if (state.ammoWarning > 0) state.ammoWarning--;

    // Invincibility
    if (p.invincible > 0) p.invincible--;

    // Health regeneration
    if (p.hp < p.maxHp && !state.gameOver) {
        state.regenTimer = (state.regenTimer || 0) + 1;
        if (state.regenTimer >= 120) {
            state.regenTimer = 0;
            p.hp = Math.min(p.maxHp, p.hp + 2);
            if (Math.random() < 0.2) {
                state.particles.push(new Particle(
                    p.x, p.y,
                    (Math.random() - 0.5) * 1, -1.5,
                    '#44ff44', 2, 12
                ));
            }
        }
    }

    // Movement
    let moveX = 0, moveY = 0;

    // Desktop keyboard
    if (state.keys['w'] || state.keys['arrowup']) moveY = -1;
    if (state.keys['s'] || state.keys['arrowdown']) moveY = 1;
    if (state.keys['a'] || state.keys['arrowleft']) moveX = -1;
    if (state.keys['d'] || state.keys['arrowright']) moveX = 1;

    // Mobile movement joystick
    if (state.moveJoystick.active) {
        moveX = state.moveJoystick.x;
        moveY = state.moveJoystick.y;
    }

    // Normalize diagonal
    if (moveX !== 0 && moveY !== 0) {
        const mag = Math.sqrt(moveX * moveX + moveY * moveY);
        moveX /= mag;
        moveY /= mag;
    }

    p.x += moveX * p.speed;
    p.y += moveY * p.speed;

    // Keep in bounds
    p.x = Math.max(p.radius, Math.min(canvas.width - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(canvas.height - p.radius, p.y));

    // Auto-fire
    autoFire();

    // Update bullets
    state.bullets = state.bullets.filter(b => !b.update());

    // Update zombies
    for (const zombie of state.zombies) {
        zombie.update(p, state.zombies);
    }

    // Update power-ups
    state.powerUps = state.powerUps.filter(pu => !pu.update());

    // Update particles
    state.particles = state.particles.filter(p => !p.update());

    // Collisions
    checkBulletZombieCollisions();
    checkPlayerZombieCollisions();
    checkPlayerPowerUpCollisions();

    // Wave management
    updateWaveSpawning();

    // UI
    updateUI();

    // Death check
    if (p.hp <= 0) {
        p.hp = 0;
        state.gameOver = true;
    }
}

function restartGame() {
    state.player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 16,
        speed: 3.5,
        hp: 200,
        maxHp: 200,
        angle: 0,
        invincible: 0,
        invincibleDuration: 30,
    };
    state.zombies = [];
    state.bullets = [];
    state.particles = [];
    state.powerUps = [];
    state.bloodStains = [];
    state.wave = 0;
    state.kills = 0;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.comboTimer = 0;
    state.gameOver = false;
    state.waveActive = false;
    state.zombiesToSpawn = 0;
    state.zombiesSpawned = 0;
    state.reloading = false;
    state.reloadTimer = 0;
    state.shootCooldown = 0;
    state.ammoWarning = 0;
    state.regenTimer = 0;
    state.healingText = 0;
    state.screenShake = 0;
    state.moveTouchId = null;
    state.aimTouchId = null;
    state.moveJoystick.active = false;
    state.moveJoystick.x = 0;
    state.moveJoystick.y = 0;
    state.aimJoystick.active = false;
    state.aimJoystick.x = 0;
    state.aimJoystick.y = 0;
    WEAPONS.forEach(w => w.ammo = w.maxAmmo);
    state.currentWeapon = 0;
    updateUI();
    updateWeaponUI();
    startWave();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// ============================================
// INITIALIZATION
// ============================================
function init() {
    updateUI();
    updateWeaponUI();
    setupDesktopControls();
    setupMobileControls();
    startWave();
    gameLoop();
}

init();

console.log('🧟 Zombie Apocalypse Survival v2.1 - FIXED MOBILE');
console.log('📱 MOBILE: Left side = Move | Right side = Aim 360°');
console.log('🔫 Auto-fires when aiming on right side');
console.log('🔄 Tap reload button | ⇄ Tap to swap weapons');
