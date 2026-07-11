// ============================================
// ZOMBIE APOCALYPSE SURVIVAL v4.0
// With Tutorial System + Fullscreen
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ============================================
// CANVAS SIZING - TRUE FULLSCREEN
// ============================================
function resizeCanvas() {
    const container = document.getElementById('game-container');
    const maxWidth = 600;
    const maxHeight = 800;
    
    let w, h;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    // Calculate aspect ratio
    const aspectRatio = maxWidth / maxHeight;
    
    if (screenW / screenH > aspectRatio) {
        // Screen is wider than game ratio - fit by height
        h = screenH;
        w = h * aspectRatio;
    } else {
        // Screen is taller than game ratio - fit by width
        w = screenW;
        h = w / aspectRatio;
    }
    
    // Don't exceed max dimensions
    if (w > maxWidth) {
        w = maxWidth;
        h = w / aspectRatio;
    }
    if (h > maxHeight) {
        h = maxHeight;
        w = h * aspectRatio;
    }
    
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = maxWidth;   // Internal resolution stays fixed
    canvas.height = maxHeight;
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100);
});
resizeCanvas();

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
    currentWeapon: 0,
    wave: 1,
    kills: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    gameOver: false,
    gameStarted: false,  // Don't start until tutorial is done
    waveActive: false,
    zombiesToSpawn: 0,
    zombiesSpawned: 0,
    spawnTimer: 0,
    spawnDelay: 60,
    screenShake: 0,
    keys: {},
    mouseX: canvas.width / 2,
    mouseY: canvas.height / 2,
    mouseDown: false,
    moveTouchId: null,
    aimTouchId: null,
    moveJoystick: { active: false, startX: 0, startY: 0, x: 0, y: 0 },
    aimJoystick: { active: false, startX: 0, startY: 0, x: 0, y: 0 },
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
    { name: 'Pistol', damage: 25, fireRate: 15, spread: 0.04, bulletsPerShot: 1, speed: 10, range: 500, ammo: 20, maxAmmo: 20, reloadTime: 40, color: '#ffcc00', symbol: '🔫' },
    { name: 'Shotgun', damage: 18, fireRate: 40, spread: 0.3, bulletsPerShot: 6, speed: 8, range: 250, ammo: 8, maxAmmo: 8, reloadTime: 65, color: '#ff6600', symbol: '💥' },
    { name: 'Assault Rifle', damage: 15, fireRate: 7, spread: 0.07, bulletsPerShot: 1, speed: 12, range: 600, ammo: 35, maxAmmo: 35, reloadTime: 50, color: '#00ccff', symbol: '🎯' },
    { name: 'Flamethrower', damage: 4, fireRate: 3, spread: 0.7, bulletsPerShot: 3, speed: 5, range: 130, ammo: 120, maxAmmo: 120, reloadTime: 80, color: '#ff4400', symbol: '🔥', fire: true },
];

// ============================================
// ZOMBIE TYPES
// ============================================
const ZOMBIE_TYPES = {
    walker: { name: 'Walker', hp: 40, speed: 1.2, damage: 5, radius: 14, color: '#557744', xp: 10 },
    runner: { name: 'Runner', hp: 25, speed: 3.0, damage: 4, radius: 12, color: '#994422', xp: 15 },
    tank: { name: 'Tank', hp: 150, speed: 0.8, damage: 12, radius: 22, color: '#444444', xp: 50 },
    spitter: { name: 'Spitter', hp: 35, speed: 1.5, damage: 7, radius: 15, color: '#88aa22', xp: 20 },
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function isMobile() { return 'ontouchstart' in window || navigator.maxTouchPoints > 0; }
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function dist(a, b) { const dx = a.x - b.x; const dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

// ============================================
// PARTICLE
// ============================================
class Particle {
    constructor(x, y, vx, vy, color, size, life) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.color = color; this.size = size; this.life = life; this.maxLife = life;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += 0.1; this.life--; return this.life <= 0; }
    draw(ctx) {
        const a = this.life / this.maxLife;
        ctx.globalAlpha = a; ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * a, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// ============================================
// ZOMBIE
// ============================================
class Zombie {
    constructor(x, y, type, wave) {
        const def = ZOMBIE_TYPES[type];
        this.x = x; this.y = y; this.type = type;
        this.maxHp = def.hp + wave * 10; this.hp = this.maxHp;
        this.speed = def.speed + wave * 0.05;
        this.damage = def.damage + Math.floor(wave / 2);
        this.radius = def.radius; this.color = def.color;
        this.xp = def.xp + wave * 2;
        this.attackCooldown = 0; this.staggerTimer = 0;
        this.wobble = Math.random() * Math.PI * 2;
    }
    update(player, zombies) {
        if (this.staggerTimer > 0) { this.staggerTimer--; return; }
        const dx = player.x - this.x, dy = player.y - this.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        let mx = 0, my = 0;
        if (d > 30) { mx = (dx/d)*this.speed; my = (dy/d)*this.speed; }
        for (const o of zombies) {
            if (o === this) continue;
            const odx = this.x - o.x, ody = this.y - o.y;
            const od = Math.sqrt(odx*odx + ody*ody);
            if (od < this.radius*2 && od > 0) { mx += (odx/od)*0.5; my += (ody/od)*0.5; }
        }
        this.x += mx; this.y += my;
        this.x = Math.max(this.radius, Math.min(canvas.width-this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height-this.radius, this.y));
        if (d < this.radius + player.radius + 5 && this.attackCooldown <= 0) {
            player.hp -= this.damage;
            player.invincible = player.invincibleDuration;
            this.attackCooldown = 60;
            state.screenShake = 4;
            for (let i = 0; i < 4; i++) state.particles.push(new Particle(player.x, player.y, rand(-1.5,1.5), rand(-1.5,1.5), '#f00', rand(2,4), rand(8,16)));
        }
        if (this.attackCooldown > 0) this.attackCooldown--;
    }
    takeDamage(amount) {
        this.hp -= amount; this.staggerTimer = 5;
        for (let i = 0; i < 6; i++) state.particles.push(new Particle(this.x, this.y, rand(-2.5,2.5), rand(-2.5,2.5), this.color, rand(2,6), rand(10,30)));
        state.bloodStains.push({ x: this.x+rand(-5,5), y: this.y+rand(-5,5), size: rand(3,11), alpha: rand(0.5,0.8) });
        if (state.bloodStains.length > 120) state.bloodStains.shift();
        return this.hp <= 0;
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y);
        const w = Math.sin(Date.now()/200 + this.wobble)*2;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(2,2,this.radius,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(w,w,this.radius,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#f00'; ctx.shadowColor = '#f00'; ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(-5,-4,3,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(5,-4,3,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        if (this.type === 'tank') { ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(0,0,this.radius-4,0,Math.PI*2); ctx.fill(); ctx.strokeStyle = '#777'; ctx.lineWidth = 2; ctx.stroke(); }
        if (this.hp < this.maxHp) {
            const bw = this.radius*2;
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw/2-1, -this.radius-11, bw+2, 5);
            ctx.fillStyle = '#f44'; ctx.fillRect(-bw/2, -this.radius-10, bw*(this.hp/this.maxHp), 3);
        }
        ctx.restore();
    }
}

// ============================================
// BULLET
// ============================================
class Bullet {
    constructor(x, y, angle, weapon) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle)*weapon.speed; this.vy = Math.sin(angle)*weapon.speed;
        this.damage = weapon.damage; this.color = weapon.color;
        this.range = weapon.range; this.traveled = 0;
        this.isFire = weapon.fire || false;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.traveled += Math.sqrt(this.vx*this.vx + this.vy*this.vy);
        if (this.isFire && Math.random()<0.5) state.particles.push(new Particle(this.x, this.y, rand(-1,1), rand(-2,0), ['#f40','#f60','#fa0'][randInt(0,2)], rand(2,5), rand(6,16)));
        return this.traveled > this.range || this.x < -20 || this.x > canvas.width+20 || this.y < -20 || this.y > canvas.height+20;
    }
    draw(ctx) {
        ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = this.isFire?10:6;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.isFire?5:2.5, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = this.color; ctx.globalAlpha = 0.4; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x-this.vx*3, this.y-this.vy*3); ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

// ============================================
// POWER-UP
// ============================================
class PowerUp {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type; this.radius = 14; this.life = 480;
        const c = { health:{c:'#f44',s:'❤️',g:'#f00'}, ammo:{c:'#fc0',s:'🔫',g:'#fa0'}, speed:{c:'#4f4',s:'💨',g:'#0f0'}, nuke:{c:'#f80',s:'💣',g:'#f40'} };
        Object.assign(this, c[type]); this.color = this.c; this.symbol = this.s; this.glow = this.g;
    }
    update() { this.life--; this.y += Math.sin(Date.now()/300+this.x)*0.3; return this.life <= 0; }
    draw(ctx) {
        const p = Math.sin(Date.now()/200)*0.3+0.7;
        ctx.globalAlpha = 0.2*p; ctx.fillStyle = this.glow; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius+8, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = '16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.symbol, this.x, this.y);
    }
}

// ============================================
// WAVE MANAGEMENT
// ============================================
function startWave() {
    if (state.waveActive || state.gameOver || !state.gameStarted) return;
    state.waveActive = true; state.wave++;
    state.zombiesToSpawn = 5 + state.wave * 3;
    state.zombiesSpawned = 0; state.spawnTimer = 0;
    state.spawnDelay = Math.max(18, 55 - state.wave * 2);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 20);
    state.healingText = 40;
    document.getElementById('wave-hud').textContent = state.wave;
}

function spawnZombie() {
    let x, y;
    const s = randInt(0,3);
    if (s===0) { x=rand(0,canvas.width); y=-30; }
    else if (s===1) { x=canvas.width+30; y=rand(0,canvas.height); }
    else if (s===2) { x=rand(0,canvas.width); y=canvas.height+30; }
    else { x=-30; y=rand(0,canvas.height); }
    let t = 'walker';
    const r = Math.random();
    if (state.wave>=8 && r<0.1) t='tank';
    else if (state.wave>=5 && r<0.25) t='spitter';
    else if (state.wave>=3 && r<0.5) t='runner';
    state.zombies.push(new Zombie(x, y, t, state.wave));
    state.zombiesSpawned++;
}

function updateWaveSpawning() {
    if (!state.waveActive) return;
    if (state.zombiesSpawned < state.zombiesToSpawn) {
        state.spawnTimer++;
        if (state.spawnTimer >= state.spawnDelay) { state.spawnTimer = 0; spawnZombie(); }
    }
    if (state.zombiesSpawned >= state.zombiesToSpawn && state.zombies.length === 0) {
        state.waveActive = false; state.score += state.wave * 100;
        if (Math.random()<0.6) state.powerUps.push(new PowerUp(rand(50,canvas.width-50), rand(100,canvas.height-200), ['health','ammo','speed','nuke'][randInt(0,3)]));
        setTimeout(() => { if (!state.gameOver && state.gameStarted) startWave(); }, 2500);
    }
}

// ============================================
// WEAPON SYSTEM
// ============================================
function fireWeapon() {
    if (state.gameOver || state.reloading || state.shootCooldown > 0 || !state.gameStarted) return;
    const weapon = WEAPONS[state.currentWeapon];
    if (weapon.ammo <= 0) { reloadWeapon(); return; }
    weapon.ammo--; state.shootCooldown = weapon.fireRate;
    if (weapon.ammo <= 0) state.ammoWarning = 30;
    const p = state.player, a = p.angle;
    for (let i = 0; i < weapon.bulletsPerShot; i++) {
        state.bullets.push(new Bullet(p.x+Math.cos(a)*20, p.y+Math.sin(a)*20, a+rand(-weapon.spread,weapon.spread), weapon));
    }
    for (let i = 0; i < 4; i++) state.particles.push(new Particle(p.x+Math.cos(a)*22, p.y+Math.sin(a)*22, Math.cos(a)*2+rand(-1,1), Math.sin(a)*2+rand(-1,1), weapon.color, rand(2,5), rand(6,12)));
    updateWeaponUI();
}

function reloadWeapon() {
    if (state.reloading || !state.gameStarted) return;
    const w = WEAPONS[state.currentWeapon];
    if (w.ammo === w.maxAmmo) return;
    state.reloading = true; state.reloadTimer = w.reloadTime; state.ammoWarning = 0;
}

function finishReload() {
    WEAPONS[state.currentWeapon].ammo = WEAPONS[state.currentWeapon].maxAmmo;
    state.reloading = false; state.reloadTimer = 0; updateWeaponUI();
}

function swapWeapon(slotIndex) {
    state.currentWeapon = slotIndex;
    updateWeaponUI();
}

function updateWeaponUI() {
    document.querySelectorAll('.weapon-slot').forEach((s, i) => s.classList.toggle('active', i === state.currentWeapon));
}

// ============================================
// POWER-UP EFFECTS
// ============================================
function activatePowerUp(type) {
    if (type === 'health') {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp+80); state.healingText = 60;
        for (let i=0;i<20;i++) state.particles.push(new Particle(state.player.x,state.player.y,rand(-2.5,2.5),rand(-2.5,2.5),'#f44',4,18));
    } else if (type === 'ammo') {
        WEAPONS.forEach(w=>w.ammo=w.maxAmmo); updateWeaponUI();
        for (let i=0;i<15;i++) state.particles.push(new Particle(state.player.x,state.player.y,rand(-2.5,2.5),rand(-2.5,2.5),'#fc0',3,15));
    } else if (type === 'speed') {
        state.player.speed=6; setTimeout(()=>{state.player.speed=3.5;},5000);
        for (let i=0;i<15;i++) state.particles.push(new Particle(state.player.x,state.player.y,rand(-2.5,2.5),rand(-2.5,2.5),'#4f4',3,15));
    } else if (type === 'nuke') {
        for (const z of state.zombies) {
            for (let i=0;i<12;i++) state.particles.push(new Particle(z.x,z.y,rand(-5,5),rand(-5,5),'#f80',5,25));
            state.kills++; state.score+=z.xp*2; state.combo++;
        }
        state.zombies=[]; state.screenShake=20; updateUI();
    }
}

// ============================================
// COLLISIONS
// ============================================
function checkBulletZombieCollisions() {
    for (let b=state.bullets.length-1;b>=0;b--) {
        for (let z=state.zombies.length-1;z>=0;z--) {
            if (dist(state.bullets[b],state.zombies[z]) < state.zombies[z].radius+6) {
                if (state.zombies[z].takeDamage(state.bullets[b].damage)) {
                    state.kills++; state.score+=state.zombies[z].xp; state.combo++; state.comboTimer=90;
                    if (state.combo>state.maxCombo) state.maxCombo=state.combo;
                    for (let i=0;i<12;i++) state.particles.push(new Particle(state.zombies[z].x,state.zombies[z].y,rand(-3,3),rand(-3,3),state.zombies[z].color,rand(3,7),rand(15,35)));
                    state.zombies.splice(z,1);
                }
                if (!state.bullets[b].isFire || Math.random()<0.5) { state.bullets.splice(b,1); }
                updateUI(); break;
            }
        }
    }
}

function checkPlayerZombieCollisions() {
    if (state.player.invincible>0) return;
    for (const z of state.zombies) {
        if (dist(state.player,z) < state.player.radius+z.radius) {
            state.player.hp-=z.damage; state.player.invincible=state.player.invincibleDuration; state.screenShake=5;
            const a=Math.atan2(state.player.y-z.y,state.player.x-z.x);
            state.player.x+=Math.cos(a)*10; state.player.y+=Math.sin(a)*10;
            for (let i=0;i<5;i++) state.particles.push(new Particle(state.player.x,state.player.y,rand(-2,2),rand(-2,2),'#f00',3,12));
        }
    }
}

function checkPlayerPowerUpCollisions() {
    for (let i=state.powerUps.length-1;i>=0;i--) {
        if (dist(state.player,state.powerUps[i]) < state.player.radius+state.powerUps[i].radius+10) {
            activatePowerUp(state.powerUps[i].type); state.powerUps.splice(i,1);
        }
    }
}

// ============================================
// UI
// ============================================
function updateUI() {
    document.getElementById('health-hud').textContent = `❤️ ${Math.max(0,Math.ceil(state.player.hp))}`;
    document.getElementById('kills-hud').textContent = state.kills;
    document.getElementById('score-hud').textContent = state.score;
    const hh = document.getElementById('health-hud');
    if (state.player.hp<50) hh.classList.add('danger'); else hh.classList.remove('danger');
}

// ============================================
// RENDERING
// ============================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let sx=0, sy=0;
    if (state.screenShake>0) { sx=rand(-state.screenShake,state.screenShake); sy=rand(-state.screenShake,state.screenShake); state.screenShake*=0.85; if (state.screenShake<0.5) state.screenShake=0; }
    ctx.save(); ctx.translate(sx,sy);
    
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    for (let x=0;x<canvas.width;x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y=0;y<canvas.height;y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
    
    for (const s of state.bloodStains) { ctx.fillStyle=`rgba(80,0,0,${s.alpha*0.7})`; ctx.beginPath(); ctx.arc(s.x,s.y,s.size,0,Math.PI*2); ctx.fill(); }
    for (const pu of state.powerUps) pu.draw(ctx);
    for (const z of state.zombies) z.draw(ctx);
    for (const b of state.bullets) b.draw(ctx);
    
    const p = state.player;
    if (p.invincible>0 && Math.floor(p.invincible/4)%2===0) ctx.globalAlpha=0.5;
    if (p.invincible>0) { ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius+5,0,Math.PI*2); ctx.stroke(); }
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(p.x+2,p.y+2,p.radius,0,Math.PI*2); ctx.fill();
    const bg=ctx.createRadialGradient(p.x-3,p.y-3,2,p.x,p.y,p.radius);
    bg.addColorStop(0,'#6af'); bg.addColorStop(1,'#25c');
    ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle);
    ctx.fillStyle='#444'; ctx.fillRect(8,-3,16,6); ctx.fillStyle='#666'; ctx.fillRect(16,-5,10,10);
    ctx.restore();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(p.x-4,p.y-3,3,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(p.x+4,p.y-3,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(p.x-3,p.y-3,1.5,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(p.x+5,p.y-3,1.5,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    
    const bw=36, by=p.y-p.radius-14;
    ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(p.x-bw/2-1,by-1,bw+2,7);
    ctx.fillStyle = p.hp/p.maxHp>0.6?'#4f4':p.hp/p.maxHp>0.3?'#fa0':'#f00';
    ctx.fillRect(p.x-bw/2,by,bw*(p.hp/p.maxHp),5);
    ctx.fillStyle='#fff'; ctx.font='bold 10px Arial'; ctx.textAlign='center'; ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHp}`,p.x,by-3);
    
    for (const pt of state.particles) pt.draw(ctx);
    ctx.restore();
    
    // HUD
    if (state.combo>1 && state.comboTimer>0) {
        ctx.fillStyle=`rgba(255,200,0,${Math.min(1,state.comboTimer/60)})`;
        ctx.font='bold 22px Arial'; ctx.textAlign='center';
        ctx.fillText(`${state.combo}x COMBO!`, canvas.width/2, 60);
    }
    if (state.reloading) {
        const prog = 1 - state.reloadTimer/WEAPONS[state.currentWeapon].reloadTime;
        ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(canvas.width/2-50, canvas.height/2+40, 100, 10);
        ctx.fillStyle='#fc0'; ctx.fillRect(canvas.width/2-50, canvas.height/2+40, 100*prog, 10);
        ctx.fillStyle='#fff'; ctx.font='11px Arial'; ctx.textAlign='center'; ctx.fillText('RELOADING...', canvas.width/2, canvas.height/2+35);
    }
    if (state.healingText>0) {
        ctx.fillStyle=`rgba(68,255,68,${Math.min(1,state.healingText/30)})`;
        ctx.font='bold 18px Arial'; ctx.textAlign='center'; ctx.fillText('+HP', canvas.width/2, canvas.height/2-60);
        state.healingText--;
    }
    if (!state.waveActive && state.zombies.length===0 && state.wave>0 && state.gameStarted) {
        ctx.fillStyle=`rgba(255,255,255,${Math.sin(Date.now()/500)*0.3+0.7})`;
        ctx.font='bold 22px Arial'; ctx.textAlign='center';
        ctx.fillText(`Wave ${state.wave+1} incoming...`, canvas.width/2, canvas.height/2-30);
    }
    if (state.gameOver) {
        ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#f00'; ctx.font='bold 48px Arial'; ctx.textAlign='center'; ctx.fillText('YOU DIED', canvas.width/2, canvas.height/2-50);
        ctx.fillStyle='#fff'; ctx.font='20px Arial';
        ctx.fillText(`Waves: ${state.wave-1}`, canvas.width/2, canvas.height/2);
        ctx.fillText(`Kills: ${state.kills}`, canvas.width/2, canvas.height/2+28);
        ctx.fillText(`Score: ${state.score}`, canvas.width/2, canvas.height/2+56);
        ctx.fillStyle='#fc0'; ctx.font='18px Arial';
        ctx.fillText('TAP OR PRESS R TO RESTART', canvas.width/2, canvas.height/2+100);
    }
    
    // Mobile joystick visuals
    if (isMobile() && !state.gameOver && state.gameStarted) {
        const a=0.2;
        const mcx=80, mcy=canvas.height-100;
        ctx.fillStyle=`rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(mcx,mcy,55,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(255,255,255,${a+0.15})`; ctx.lineWidth=2; ctx.stroke();
        let tmx=mcx, tmy=mcy;
        if (state.moveJoystick.active) { tmx=mcx+state.moveJoystick.x*40; tmy=mcy+state.moveJoystick.y*40; }
        ctx.fillStyle=`rgba(255,255,255,${a+0.3})`; ctx.beginPath(); ctx.arc(tmx,tmy,22,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#fff'; ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='bold 10px Arial'; ctx.textAlign='center'; ctx.fillText('MOVE',mcx,mcy+4);
        const acx=canvas.width-80, acy=canvas.height-100;
        ctx.fillStyle=`rgba(255,80,80,${a})`; ctx.beginPath(); ctx.arc(acx,acy,55,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(255,80,80,${a+0.15})`; ctx.lineWidth=2; ctx.stroke();
        let tax=acx, tay=acy;
        if (state.aimJoystick.active) {
            const ad=Math.sqrt(state.aimJoystick.x**2+state.aimJoystick.y**2);
            if (ad>10) { const s=Math.min(ad,40)/ad; tax=acx+state.aimJoystick.x*s; tay=acy+state.aimJoystick.y*s; }
        }
        ctx.fillStyle=`rgba(255,80,80,${a+0.3})`; ctx.beginPath(); ctx.arc(tax,tay,22,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#f66'; ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fillText('AIM',acx,acy+4);
    }
}

// ============================================
// TUTORIAL SYSTEM
// ============================================
const tutorialSteps = [
    {
        title: 'Welcome, Survivor! 🧟',
        icon: '🧟',
        text: 'The zombie apocalypse has begun! You are the last hope. Learn the controls to survive the endless hordes.',
        tip: '',
        highlight: '',
    },
    {
        title: isMobile() ? 'Movement (Left Side)' : 'Movement (WASD Keys)',
        icon: isMobile() ? '👆' : '⌨️',
        text: isMobile() 
            ? '<span class="tutorial-highlight">Touch and drag</span> on the <span class="tutorial-highlight">LEFT side</span> of the screen to move your character around.'
            : 'Use <span class="tutorial-highlight">W, A, S, D</span> or <span class="tutorial-highlight">Arrow Keys</span> to move your character.',
        tip: isMobile() ? '💡 The semi-transparent circle on the left is your movement joystick.' : '💡 Diagonal movement works too! Press W+A to move diagonally.',
        highlight: 'move',
    },
    {
        title: isMobile() ? 'Aiming (Right Side)' : 'Aiming (Mouse)',
        icon: isMobile() ? '👉' : '🖱️',
        text: isMobile()
            ? '<span class="tutorial-highlight">Touch and drag</span> on the <span class="tutorial-highlight">RIGHT side</span> to aim your weapon in any direction (360°).'
            : 'Move your <span class="tutorial-highlight">mouse</span> to aim. Your character will face toward the cursor.',
        tip: isMobile() ? '💡 The red circle on the right is your aim joystick. Auto-fire happens while aiming!' : '💡 The farther you move the mouse, the more precise your aim.',
        highlight: 'aim',
    },
    {
        title: 'Weapons & Firing 🔫',
        icon: '🔫',
        text: isMobile()
            ? 'You have <span class="tutorial-highlight">4 weapons</span> (tap icons at top). <span class="tutorial-highlight">Auto-fire</span> happens while aiming on the right side.'
            : '<span class="tutorial-highlight">Click and hold</span> to fire. Press <span class="tutorial-highlight">1-4</span> or click the weapon icons to swap weapons. Press <span class="tutorial-highlight">R</span> to reload.',
        tip: '🔫 Pistol | 💥 Shotgun | 🎯 Assault Rifle | 🔥 Flamethrower',
        highlight: 'weapons',
    },
    {
        title: 'Survival Tips 💀',
        icon: '💀',
        text: '• Kill zombies to earn <span class="tutorial-highlight">score</span> and <span class="tutorial-highlight">combos</span><br>• Collect <span class="tutorial-highlight">power-ups</span> (❤️🔫💨💣)<br>• You have <span class="tutorial-highlight">200 HP</span> and regenerate slowly<br>• Complete waves to progress<br>• <span class="tutorial-highlight">Don\'t die!</span>',
        tip: '💡 The tank zombies are tough but slow. Flamethrower melts groups!',
        highlight: '',
    },
];

let currentTutorialStep = 0;

function showTutorialStep(stepIndex) {
    if (stepIndex >= tutorialSteps.length) {
        endTutorial();
        return;
    }
    
    currentTutorialStep = stepIndex;
    const step = tutorialSteps[stepIndex];
    
    document.getElementById('tutorial-title').textContent = step.title;
    document.getElementById('tutorial-icon').textContent = step.icon;
    document.getElementById('tutorial-text').innerHTML = step.text;
    
    // Update dots
    const dots = document.querySelectorAll('#tutorial-dots .step-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === stepIndex);
    });
    
    // Tip
    const tipBox = document.getElementById('tutorial-tip');
    if (step.tip) {
        tipBox.style.display = 'block';
        tipBox.textContent = step.tip;
    } else {
        tipBox.style.display = 'none';
    }
    
    // Update buttons
    const btnNext = document.getElementById('btn-next');
    if (stepIndex === tutorialSteps.length - 1) {
        btnNext.textContent = '🎮 START GAME';
    } else {
        btnNext.textContent = 'NEXT ➤';
    }
}

function endTutorial() {
    document.getElementById('tutorial-overlay').classList.add('hidden');
    state.gameStarted = true;
    startWave();
}

function skipTutorial() {
    document.getElementById('tutorial-overlay').classList.add('hidden');
    state.gameStarted = true;
    startWave();
}

// Tutorial button handlers
document.getElementById('btn-next').addEventListener('click', () => {
    showTutorialStep(currentTutorialStep + 1);
});

document.getElementById('btn-skip').addEventListener('click', skipTutorial);

// Keyboard support for tutorial
document.addEventListener('keydown', function tutorialKeyHandler(e) {
    if (!state.gameStarted) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showTutorialStep(currentTutorialStep + 1);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            skipTutorial();
        }
    }
});

// Show first tutorial step
showTutorialStep(0);

// ============================================
// CONTROLS SETUP
// ============================================
function setupControls() {
    document.addEventListener('keydown', (e) => {
        if (!state.gameStarted) return;
        state.keys[e.key.toLowerCase()] = true;
        if (e.key.toLowerCase() === 'r') { e.preventDefault(); if (state.gameOver) restartGame(); else reloadWeapon(); }
        if (e.key >= '1' && e.key <= '4') { e.preventDefault(); swapWeapon(parseInt(e.key)-1); }
    });
    document.addEventListener('keyup', (e) => { state.keys[e.key.toLowerCase()] = false; });

    document.querySelectorAll('.weapon-slot').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!state.gameStarted) return;
            e.preventDefault(); e.stopPropagation();
            swapWeapon(parseInt(btn.dataset.slot));
        });
        btn.addEventListener('touchstart', (e) => {
            if (!state.gameStarted) return;
            e.preventDefault(); e.stopPropagation();
            swapWeapon(parseInt(btn.dataset.slot));
        });
    });

    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        state.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
        state.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', () => { if (state.gameOver) restartGame(); else if (state.gameStarted) state.mouseDown = true; });
    canvas.addEventListener('mouseup', () => { state.mouseDown = false; });
    canvas.addEventListener('mouseleave', () => { state.mouseDown = false; });

    const reloadBtn = document.getElementById('reload-btn');
    const swapBtn = document.getElementById('swap-btn');
    if (reloadBtn) {
        reloadBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); reloadWeapon(); });
        reloadBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); reloadWeapon(); });
    }
    if (swapBtn) {
        swapBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); swapWeapon((state.currentWeapon+1)%WEAPONS.length); });
        swapBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); swapWeapon((state.currentWeapon+1)%WEAPONS.length); });
    }

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (state.gameOver) { restartGame(); return; }
        if (!state.gameStarted) return;
        for (const touch of e.changedTouches) {
            const r = canvas.getBoundingClientRect();
            const tx = (touch.clientX - r.left) * (canvas.width / r.width);
            const ty = (touch.clientY - r.top) * (canvas.height / r.height);
            if (ty < 100 && tx > canvas.width/2-100 && tx < canvas.width/2+100) continue;
            if (tx < canvas.width/2 && state.moveTouchId === null) {
                state.moveTouchId = touch.identifier; state.moveJoystick.active = true;
                state.moveJoystick.startX = tx; state.moveJoystick.startY = ty;
            } else if (tx >= canvas.width/2 && state.aimTouchId === null) {
                state.aimTouchId = touch.identifier; state.aimJoystick.active = true;
                state.aimJoystick.startX = tx; state.aimJoystick.startY = ty;
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const r = canvas.getBoundingClientRect();
            const tx = (touch.clientX - r.left) * (canvas.width / r.width);
            const ty = (touch.clientY - r.top) * (canvas.height / r.height);
            if (touch.identifier === state.moveTouchId) {
                const dx = tx - state.moveJoystick.startX, dy = ty - state.moveJoystick.startY;
                const d = Math.sqrt(dx*dx+dy*dy), max = 40;
                if (d > 0) { state.moveJoystick.x = d<max ? dx/max : dx/d; state.moveJoystick.y = d<max ? dy/max : dy/d; }
            } else if (touch.identifier === state.aimTouchId) {
                const dx = tx - state.aimJoystick.startX, dy = ty - state.aimJoystick.startY;
                state.aimJoystick.x = dx; state.aimJoystick.y = dy;
                if (Math.sqrt(dx*dx+dy*dy) > 15) state.player.angle = Math.atan2(dy, dx);
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            if (touch.identifier === state.moveTouchId) { state.moveTouchId = null; state.moveJoystick.active = false; state.moveJoystick.x = 0; state.moveJoystick.y = 0; }
            if (touch.identifier === state.aimTouchId) { state.aimTouchId = null; state.aimJoystick.active = false; state.aimJoystick.x = 0; state.aimJoystick.y = 0; }
        }
        if (e.touches.length === 0 && state.gameOver) restartGame();
    }, { passive: false });

    canvas.addEventListener('touchcancel', () => {
        state.moveTouchId = null; state.aimTouchId = null;
        state.moveJoystick.active = false; state.aimJoystick.active = false;
    });
}

// ============================================
// GAME LOOP
// ============================================
function update() {
    if (state.gameOver || !state.gameStarted) return;
    const p = state.player;

    if (state.mouseDown || isMobile()) {
        p.angle = Math.atan2(state.mouseY - p.y, state.mouseX - p.x);
    }

    if (state.reloading) { state.reloadTimer--; if (state.reloadTimer <= 0) finishReload(); }
    if (state.shootCooldown > 0) state.shootCooldown--;
    if (state.comboTimer > 0) { state.comboTimer--; if (state.comboTimer <= 0) state.combo = 0; }
    if (state.ammoWarning > 0) state.ammoWarning--;
    if (p.invincible > 0) p.invincible--;
    if (state.healingText > 0) state.healingText--;

    if (p.hp < p.maxHp) { state.regenTimer++; if (state.regenTimer >= 120) { state.regenTimer = 0; p.hp = Math.min(p.maxHp, p.hp + 2); } }

    let mx = 0, my = 0;
    if (state.keys['w'] || state.keys['arrowup']) my = -1;
    if (state.keys['s'] || state.keys['arrowdown']) my = 1;
    if (state.keys['a'] || state.keys['arrowleft']) mx = -1;
    if (state.keys['d'] || state.keys['arrowright']) mx = 1;
    if (state.moveJoystick.active) { mx = state.moveJoystick.x; my = state.moveJoystick.y; }
    if (mx !== 0 && my !== 0) { const mag = Math.sqrt(mx*mx+my*my); mx /= mag; my /= mag; }
    p.x += mx * p.speed; p.y += my * p.speed;
    p.x = Math.max(p.radius, Math.min(canvas.width - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(canvas.height - p.radius, p.y));

    if (state.mouseDown || state.aimJoystick.active) fireWeapon();

    state.bullets = state.bullets.filter(b => !b.update());
    for (const z of state.zombies) z.update(p, state.zombies);
    state.powerUps = state.powerUps.filter(pu => !pu.update());
    state.particles = state.particles.filter(pt => !pt.update());

    checkBulletZombieCollisions();
    checkPlayerZombieCollisions();
    checkPlayerPowerUpCollisions();
    updateWaveSpawning();
    updateUI();

    if (p.hp <= 0) { p.hp = 0; state.gameOver = true; }
}

function restartGame() {
    state.player = { x: canvas.width/2, y: canvas.height/2, radius: 16, speed: 3.5, hp: 200, maxHp: 200, angle: 0, invincible: 0, invincibleDuration: 30 };
    state.zombies = []; state.bullets = []; state.particles = []; state.powerUps = []; state.bloodStains = [];
    state.wave = 0; state.kills = 0; state.score = 0; state.combo = 0; state.maxCombo = 0; state.comboTimer = 0;
    state.gameOver = false; state.waveActive = false; state.zombiesToSpawn = 0; state.zombiesSpawned = 0;
    state.reloading = false; state.reloadTimer = 0; state.shootCooldown = 0; state.ammoWarning = 0;
    state.regenTimer = 0; state.healingText = 0; state.screenShake = 0;
    state.moveTouchId = null; state.aimTouchId = null;
    state.moveJoystick.active = false; state.aimJoystick.active = false;
    state.currentWeapon = 0;
    WEAPONS.forEach(w => w.ammo = w.maxAmmo);
    updateUI(); updateWeaponUI(); startWave();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

// ============================================
// INIT
// ============================================
updateUI();
updateWeaponUI();
setupControls();
// Game starts after tutorial
gameLoop();

console.log('🧟 Zombie Apocalypse Survival v4.0');
console.log('📚 Tutorial system active');
console.log('📱 Fullscreen responsive design');
