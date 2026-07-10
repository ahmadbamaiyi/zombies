// ============================================
// ZOMBIE APOCALYPSE SURVIVAL
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
        speed: 3,
        hp: 100,
        maxHp: 100,
        angle: 0,
        invincible: 0,
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
    mouseX: canvas.width / 2,
    mouseY: canvas.height / 2,
    joystickActive: false,
    joystickX: 0,
    joystickY: 0,
    shooting: false,
    reloading: false,
    reloadTimer: 0,
    ammoWarning: 0,
};

// ============================================
// WEAPON DEFINITIONS
// ============================================
const WEAPONS = [
    {
        name: 'Pistol',
        damage: 25,
        fireRate: 12,
        spread: 0.05,
        bulletsPerShot: 1,
        speed: 10,
        range: 500,
        ammo: 15,
        maxAmmo: 15,
        reloadTime: 45,
        color: '#ffcc00',
        symbol: '🔫',
        auto: false,
    },
    {
        name: 'Shotgun',
        damage: 18,
        fireRate: 35,
        spread: 0.3,
        bulletsPerShot: 6,
        speed: 8,
        range: 250,
        ammo: 6,
        maxAmmo: 6,
        reloadTime: 70,
        color: '#ff6600',
        symbol: '💥',
        auto: false,
    },
    {
        name: 'Assault Rifle',
        damage: 15,
        fireRate: 6,
        spread: 0.08,
        bulletsPerShot: 1,
        speed: 12,
        range: 600,
        ammo: 30,
        maxAmmo: 30,
        reloadTime: 50,
        color: '#00ccff',
        symbol: '🎯',
        auto: true,
    },
    {
        name: 'Flamethrower',
        damage: 3,
        fireRate: 2,
        spread: 0.8,
        bulletsPerShot: 3,
        speed: 4,
        range: 120,
        ammo: 100,
        maxAmmo: 100,
        reloadTime: 90,
        color: '#ff4400',
        symbol: '🔥',
        auto: true,
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
        damage: 10,
        radius: 14,
        color: '#557744',
        xp: 10,
        weight: 1,
    },
    runner: {
        name: 'Runner',
        hp: 25,
        speed: 3.0,
        damage: 8,
        radius: 12,
        color: '#994422',
        xp: 15,
        weight: 2,
    },
    tank: {
        name: 'Tank',
        hp: 150,
        speed: 0.8,
        damage: 25,
        radius: 22,
        color: '#444444',
        xp: 50,
        weight: 5,
    },
    spitter: {
        name: 'Spitter',
        hp: 35,
        speed: 1.5,
        damage: 15,
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
    constructor(x, y, vx, vy, color, size, life, type = 'circle') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = life;
        this.maxLife = life;
        this.type = type;
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
        
        if (this.type === 'circle') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'rect') {
            ctx.fillRect(this.x - this.size, this.y - this.size/2, this.size * 2, this.size);
        }
        
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
        this.damage = def.damage + wave;
        this.radius = def.radius;
        this.color = def.color;
        this.xp = def.xp + wave * 2;
        this.ranged = def.ranged || false;
        this.attackCooldown = 0;
        this.angle = 0;
        this.staggerTimer = 0;
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

        // Movement with separation from other zombies
        let moveX = 0;
        let moveY = 0;

        if (dist > 30) {
            moveX = (dx / dist) * this.speed;
            moveY = (dy / dist) * this.speed;
        }

        // Separate from nearby zombies
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

        // Keep in bounds
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        // Attack player
        if (dist < this.radius + player.radius + 5) {
            if (this.attackCooldown <= 0) {
                player.hp -= this.damage;
                player.invincible = 15;
                this.attackCooldown = 40;
                state.screenShake = 8;

                // Blood particles
                for (let i = 0; i < 8; i++) {
                    state.particles.push(new Particle(
                        player.x, player.y,
                        (Math.random() - 0.5) * 4,
                        (Math.random() - 0.5) * 4,
                        '#ff0000', 3 + Math.random() * 3, 15 + Math.random() * 15
                    ));
                }
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown--;
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.staggerTimer = 5;

        // Blood splatter
        for (let i = 0; i < 6; i++) {
            state.particles.push(new Particle(
                this.x, this.y,
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5,
                this.color, 2 + Math.random() * 4, 10 + Math.random() * 20
            ));
        }

        // Blood stain on ground
        state.bloodStains.push({
            x: this.x,
            y: this.y,
            size: 3 + Math.random() * 8,
            alpha: 0.6,
        });
        if (state.bloodStains.length > 100) state.bloodStains.shift();

        return this.hp <= 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Body
        const wobble = Math.sin(Date.now() / 200 + this.x) * 2;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(wobble, wobble, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(-5, -4, 3, 0, Math.PI * 2);
        ctx.arc(5, -4, 3, 0, Math.PI * 2);
        ctx.fill();

        // HP bar
        if (this.hp < this.maxHp) {
            const barWidth = this.radius * 2;
            ctx.fillStyle = '#333';
            ctx.fillRect(-barWidth/2, -this.radius - 10, barWidth, 3);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(-barWidth/2, -this.radius - 10, barWidth * (this.hp / this.maxHp), 3);
        }

        // Type indicator
        if (this.type === 'tank') {
            ctx.fillStyle = '#666';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius - 4, 0, Math.PI * 2);
            ctx.fill();
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

        // Trail particles
        if (this.isFire) {
            state.particles.push(new Particle(
                this.x, this.y,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                ['#ff4400', '#ff6600', '#ffaa00'][Math.floor(Math.random() * 3)],
                2 + Math.random() * 3, 8 + Math.random() * 8
            ));
        }

        return this.traveled > this.range ||
               this.x < 0 || this.x > canvas.width ||
               this.y < 0 || this.y > canvas.height;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.isFire ? 8 : 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.isFire ? 5 : 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (!this.isFire) {
            // Bullet trail
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.vx * 2, this.y - this.vy * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
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
        this.radius = 12;
        this.life = 600; // 10 seconds
        
        switch (type) {
            case 'health':
                this.color = '#ff4444';
                this.symbol = '❤️';
                break;
            case 'ammo':
                this.color = '#ffcc00';
                this.symbol = '🔫';
                break;
            case 'speed':
                this.color = '#44ff44';
                this.symbol = '💨';
                break;
            case 'nuke':
                this.color = '#ff8800';
                this.symbol = '💣';
                break;
        }
    }

    update() {
        this.life--;
        // Float effect
        this.y += Math.sin(Date.now() / 300) * 0.3;
        return this.life <= 0;
    }

    draw(ctx) {
        const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.3 * pulse;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.symbol, this.x, this.y + 5);
    }
}

// ============================================
// WAVE MANAGEMENT
// ============================================
function startWave() {
    if (state.waveActive || state.gameOver) return;

    state.waveActive = true;
    state.wave++;
    state.zombiesToSpawn = 8 + state.wave * 4;
    state.zombiesSpawned = 0;
    state.spawnTimer = 0;
    state.spawnDelay = Math.max(15, 50 - state.wave * 2);

    document.getElementById('wave-hud').textContent = state.wave;
}

function spawnZombie() {
    // Spawn from edges
    let x, y;
    const side = Math.floor(Math.random() * 4);
    const margin = 30;

    switch (side) {
        case 0: x = Math.random() * canvas.width; y = -margin; break;
        case 1: x = canvas.width + margin; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + margin; break;
        case 3: x = -margin; y = Math.random() * canvas.height; break;
    }

    // Choose zombie type based on wave
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

    // Check wave complete
    if (state.zombiesSpawned >= state.zombiesToSpawn && state.zombies.length === 0) {
        state.waveActive = false;
        state.score += state.wave * 100;

        // Spawn power-up
        if (Math.random() < 0.6) {
            const types = ['health', 'ammo', 'speed', 'nuke'];
            const type = types[Math.floor(Math.random() * types.length)];
            state.powerUps.push(new PowerUp(
                Math.random() * (canvas.width - 100) + 50,
                Math.random() * (canvas.height - 100) + 50,
                type
            ));
        }

        // Auto-start next wave after delay
        setTimeout(() => {
            if (!state.gameOver) startWave();
        }, 2000);
    }
}

// ============================================
// SHOOTING
// ============================================
function shoot() {
    const weapon = WEAPONS[state.currentWeapon];
    const player = state.player;

    if (state.reloading) return;
    if (weapon.ammo <= 0) {
        reload();
        return;
    }

    weapon.ammo--;
    if (weapon.ammo <= 0) {
        state.ammoWarning = 30;
    }

    const angle = player.angle;
    
    for (let i = 0; i < weapon.bulletsPerShot; i++) {
        const spreadAngle = angle + (Math.random() - 0.5) * weapon.spread * 2;
        state.bullets.push(new Bullet(
            player.x + Math.cos(angle) * 20,
            player.y + Math.sin(angle) * 20,
            spreadAngle,
            weapon
        ));
    }

    // Muzzle flash particles
    for (let i = 0; i < 5; i++) {
        state.particles.push(new Particle(
            player.x + Math.cos(angle) * 20,
            player.y + Math.sin(angle) * 20,
            Math.cos(angle) * 3 + (Math.random() - 0.5) * 2,
            Math.sin(angle) * 3 + (Math.random() - 0.5) * 2,
            weapon.color, 3, 8
        ));
    }

    // Recoil
    player.x -= Math.cos(angle) * 2;
    player.y -= Math.sin(angle) * 2;

    updateWeaponUI();
}

let shootCooldown = 0;

function reload() {
    if (state.reloading) return;
    const weapon = WEAPONS[state.currentWeapon];
    if (weapon.ammo === weapon.maxAmmo) return;

    state.reloading = true;
    state.reloadTimer = weapon.reloadTime;
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
            state.player.hp = Math.min(state.player.maxHp, state.player.hp + 40);
            for (let i = 0; i < 20; i++) {
                state.particles.push(new Particle(
                    state.player.x, state.player.y,
                    (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5,
                    '#ff4444', 5, 20
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
                    '#ffcc00', 4, 15
                ));
            }
            break;

        case 'speed':
            state.player.speed = 6;
            setTimeout(() => { state.player.speed = 3; }, 5000);
            for (let i = 0; i < 15; i++) {
                state.particles.push(new Particle(
                    state.player.x, state.player.y,
                    (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5,
                    '#44ff44', 4, 15
                ));
            }
            break;

        case 'nuke':
            // Kill all zombies
            for (const zombie of state.zombies) {
                for (let i = 0; i < 15; i++) {
                    state.particles.push(new Particle(
                        zombie.x, zombie.y,
                        (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10,
                        '#ff8800', 6, 30
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

            if (dist < zombie.radius + 5) {
                if (zombie.takeDamage(bullet.damage)) {
                    // Zombie killed
                    state.kills++;
                    state.score += zombie.xp;
                    state.combo++;
                    state.comboTimer = 90;

                    if (state.combo > state.maxCombo) state.maxCombo = state.combo;

                    // Death particles
                    for (let i = 0; i < 15; i++) {
                        state.particles.push(new Particle(
                            zombie.x, zombie.y,
                            (Math.random() - 0.5) * 6,
                            (Math.random() - 0.5) * 6,
                            zombie.color, 3 + Math.random() * 5, 20 + Math.random() * 20
                        ));
                    }

                    state.zombies.splice(z, 1);
                }

                state.bullets.splice(b, 1);
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
            state.player.invincible = 20;
            state.screenShake = 5;

            for (let i = 0; i < 5; i++) {
                state.particles.push(new Particle(
                    state.player.x, state.player.y,
                    (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4,
                    '#ff0000', 4, 15
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

        if (dist < state.player.radius + pu.radius) {
            activatePowerUp(pu.type);
            state.powerUps.splice(i, 1);
        }
    }
}

// ============================================
// UI UPDATES
// ============================================
function updateUI() {
    document.getElementById('health-hud').textContent = `❤️ ${Math.max(0, state.player.hp)}`;
    document.getElementById('kills-hud').textContent = state.kills;
    document.getElementById('score-hud').textContent = state.score;

    // Health warning
    const healthHud = document.getElementById('health-hud');
    if (state.player.hp < 30) {
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
    document.getElementById('shoot-btn').textContent = 
        state.reloading ? '⏳' : `${weapon.ammo}`;
}

// ============================================
// RENDERING
// ============================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Screen shake offset
    let shakeX = 0, shakeY = 0;
    if (state.screenShake > 0) {
        shakeX = (Math.random() - 0.5) * state.screenShake;
        shakeY = (Math.random() - 0.5) * state.screenShake;
        state.screenShake *= 0.85;
        if (state.screenShake < 0.5) state.screenShake = 0;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Draw ground
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
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
        ctx.fillStyle = `rgba(100, 0, 0, ${stain.alpha})`;
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

    // HUD elements on canvas
    drawCanvasHUD();

    // Game over overlay
    if (state.gameOver) {
        drawGameOver();
    }
}

function drawPlayer() {
    const p = state.player;

    // Invincibility flash
    if (p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }

    // Body
    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Gun
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#333';
    ctx.fillRect(8, -3, 15, 6);
    ctx.fillStyle = '#666';
    ctx.fillRect(15, -4, 8, 8);
    ctx.restore();

    ctx.globalAlpha = 1;

    // HP bar
    const barWidth = 30;
    ctx.fillStyle = '#333';
    ctx.fillRect(p.x - barWidth/2, p.y - p.radius - 12, barWidth, 4);
    ctx.fillStyle = p.hp > 50 ? '#44ff44' : p.hp > 25 ? '#ffaa00' : '#ff0000';
    ctx.fillRect(p.x - barWidth/2, p.y - p.radius - 12, barWidth * (p.hp / p.maxHp), 4);
}

function drawCanvasHUD() {
    // Combo display
    if (state.combo > 1) {
        const alpha = Math.min(1, state.comboTimer / 60);
        ctx.fillStyle = `rgba(255, 200, 0, ${alpha})`;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${state.combo}x COMBO!`, canvas.width / 2, 70);
    }

    // Ammo warning
    if (state.ammoWarning > 0) {
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('NO AMMO! RELOAD!', canvas.width / 2, canvas.height / 2);
    }

    // Reload bar
    if (state.reloading) {
        const progress = 1 - (state.reloadTimer / WEAPONS[state.currentWeapon].reloadTime);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(canvas.width / 2 - 50, canvas.height / 2 + 20, 100, 10);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(canvas.width / 2 - 50, canvas.height / 2 + 20, 100 * progress, 10);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('RELOADING...', canvas.width / 2, canvas.height / 2 + 15);
    }

    // Wave announcement
    if (!state.waveActive && state.zombies.length === 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Wave ${state.wave + 1} incoming...`, canvas.width / 2, canvas.height / 2 - 50);
    }
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('YOU DIED', canvas.width / 2, canvas.height / 2 - 40);

    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.fillText(`Waves Survived: ${state.wave - 1}`, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText(`Zombies Killed: ${state.kills}`, canvas.width / 2, canvas.height / 2 + 35);
    ctx.fillText(`Score: ${state.score}`, canvas.width / 2, canvas.height / 2 + 60);
    ctx.fillText(`Best Combo: ${state.maxCombo}x`, canvas.width / 2, canvas.height / 2 + 85);

    ctx.fillStyle = '#aaa';
    ctx.font = '16px Arial';
    ctx.fillText('Press R or tap to restart', canvas.width / 2, canvas.height / 2 + 130);
}

// ============================================
// INPUT HANDLING
// ============================================
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'r' && state.gameOver) restartGame();
    if (e.key === 'r' && !state.gameOver) reload();
    if (e.key >= '1' && e.key <= '4') {
        state.currentWeapon = parseInt(e.key) - 1;
        updateWeaponUI();
    }
});
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    state.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
});

canvas.addEventListener('mousedown', () => {
    if (state.gameOver) { restartGame(); return; }
    state.shooting = true;
});
canvas.addEventListener('mouseup', () => state.shooting = false);

// Mobile joystick
const joystickBase = document.getElementById('joystick-base');
const joystickThumb = document.getElementById('joystick-thumb');

joystickBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.joystickActive = true;
    updateJoystick(e.touches[0]);
});

joystickBase.addEventListener('touchmove', (e) => {
    e.preventDefault();
    updateJoystick(e.touches[0]);
});

joystickBase.addEventListener('touchend', () => {
    state.joystickActive = false;
    state.joystickX = 0;
    state.joystickY = 0;
    joystickThumb.style.transform = 'translate(-50%, -50%)';
});

function updateJoystick(touch) {
    const rect = joystickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = touch.clientX - cx;
    const dy = touch.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = rect.width / 2 - 20;

    if (dist < maxDist) {
        state.joystickX = dx / maxDist;
        state.joystickY = dy / maxDist;
        joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else {
        state.joystickX = (dx / dist);
        state.joystickY = (dy / dist);
        joystickThumb.style.transform = `translate(calc(-50% + ${(dx/dist) * maxDist}px), calc(-50% + ${(dy/dist) * maxDist}px))`;
    }
}

// Shoot button
document.getElementById('shoot-btn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.shooting = true;
});
document.getElementById('shoot-btn').addEventListener('touchend', () => state.shooting = false);

// Reload button
document.getElementById('reload-btn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    reload();
});

// Weapon swap button
document.getElementById('weapon-swap-btn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.currentWeapon = (state.currentWeapon + 1) % WEAPONS.length;
    updateWeaponUI();
});

// Canvas touch for shooting direction
canvas.addEventListener('touchstart', (e) => {
    if (state.gameOver) { restartGame(); return; }
    const rect = canvas.getBoundingClientRect();
    state.mouseX = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    state.mouseY = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
});

// ============================================
// GAME LOOP
// ============================================
function update() {
    if (state.gameOver) return;

    const p = state.player;
    const weapon = WEAPONS[state.currentWeapon];

    // Player angle toward mouse
    p.angle = Math.atan2(state.mouseY - p.y, state.mouseX - p.x);

    // Reload timer
    if (state.reloading) {
        state.reloadTimer--;
        if (state.reloadTimer <= 0) finishReload();
    }

    // Combo timer
    if (state.comboTimer > 0) {
        state.comboTimer--;
        if (state.comboTimer <= 0) state.combo = 0;
    }

    // Ammo warning timer
    if (state.ammoWarning > 0) state.ammoWarning--;

    // Invincibility timer
    if (p.invincible > 0) p.invincible--;

    // Player movement
    let moveX = 0, moveY = 0;

    // Keyboard
    if (keys['w'] || keys['arrowup']) moveY = -1;
    if (keys['s'] || keys['arrowdown']) moveY = 1;
    if (keys['a'] || keys['arrowleft']) moveX = -1;
    if (keys['d'] || keys['arrowright']) moveX = 1;

    // Joystick override
    if (state.joystickActive) {
        moveX = state.joystickX;
        moveY = state.joystickY;
    }

    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
        moveX *= 0.707;
        moveY *= 0.707;
    }

    p.x += moveX * p.speed;
    p.y += moveY * p.speed;

    // Keep player in bounds
    p.x = Math.max(p.radius, Math.min(canvas.width - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(canvas.height - p.radius, p.y));

    // Shooting
    if (shootCooldown > 0) shootCooldown--;
    if ((state.shooting || (keys[' '] && weapon.auto)) && shootCooldown <= 0 && !state.reloading) {
        if (weapon.ammo > 0) {
            shoot();
            shootCooldown = weapon.fireRate;
        } else {
            reload();
        }
    }

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

    // Update UI
    updateUI();

    // Check death
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
        speed: 3,
        hp: 100,
        maxHp: 100,
        angle: 0,
        invincible: 0,
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
    state.gameOver = false;
    state.waveActive = false;
    state.zombiesToSpawn = 0;
    state.zombiesSpawned = 0;
    state.reloading = false;
    state.reloadTimer = 0;
    state.shooting = false;
    WEAPONS.forEach(w => w.ammo = w.maxAmmo);
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
// START GAME
// ============================================
updateUI();
updateWeaponUI();
startWave();
gameLoop();

console.log('🧟 Zombie Apocalypse Survival Ready!');
console.log('🕹️ WASD = Move | Mouse = Aim | Click = Shoot');
console.log('🔢 1-4 = Switch weapons | R = Reload');
console.log('📱 Mobile: Joystick + buttons');
