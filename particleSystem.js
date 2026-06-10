/**
 * @file particleSystem.js — Weather particle system for weather-animated@zulus
 * @module particleSystem
 *
 * Features enhanced multi-layer rain with depth perception
 * and natural snow with drift, rotation, and varied trajectories.
 */

/* ── Particle constructor ─────────────────────────────────────────────────── */

/**
 * Create a new Particle.
 * @constructor
 * @param {number} x - Initial X position
 * @param {number} y - Initial Y position
 * @param {string} type - Particle type ('rain', 'snow', 'cloud', 'star', 'sparkle', 'hail')
 * @returns {void}
 */
function Particle(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;

    // Common
    this.vx = 0;
    this.vy = 0;
    this.size = 0;
    this.alpha = 1;
    this.life = 1;
    this.maxLife = 1;
    this.speed = 0;

    // Depth layer (0=far, 1=near) for multi-layer effects
    this.depth = Math.random();

    // Wobble/trajectory
    this.wobble = 0;
    this.wobbleSpeed = 0;
    this.wobbleOffset = 0;

    // Snow-specific
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.driftPhase = 0;
    this.driftAmplitude = 0;

    this._init(type);
}

/**
 * Initialise particle properties based on its type.
 * @param {string} type - Particle type
 * @returns {void}
 */
Particle.prototype._init = function (type) {
    switch (type) {
        case 'rain':
            // Depth determines speed, size, alpha
            // Far (depth~0): slow, thin, dim
            // Near (depth~1): fast, thick, bright
            const rd = this.depth;
            this.size = (0.8 + rd * 1.8) * (1 + Math.random() * 0.3);
            this.speed = (250 + rd * 500 + Math.random() * 150);
            this.vy = this.speed;
            // Wind shear: more horizontal at distance
            this.vx = -15 - rd * 30 - Math.random() * 15;
            // Alpha: far=dim, near=bright
            this.alpha = 0.25 + rd * 0.55 + Math.random() * 0.1;
            // Streak length: near=longer
            this._streakLen = 0.02 + rd * 0.04;
            break;

        case 'snow':
            const sd = this.depth;
            // Size varies with depth (near=larger)
            this.size = (1.5 + sd * 4) * (0.7 + Math.random() * 0.6);
            // Fall speed: far=slow, near=fast (but much slower than rain)
            this.speed = (20 + sd * 60 + Math.random() * 30);
            this.vy = this.speed;
            // Horizontal drift: sine wave
            this.driftPhase = Math.random() * Math.PI * 2;
            this.driftAmplitude = (5 + sd * 25) * (0.5 + Math.random() * 0.5);
            // Wobble (swaying motion)
            this.wobble = (1 + sd * 3) * (0.5 + Math.random() * 0.5);
            this.wobbleSpeed = 0.8 + Math.random() * 1.5;
            this.wobbleOffset = Math.random() * Math.PI * 2;
            // Rotation while falling
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = (Math.random() - 0.5) * 1.5;
            // Horizontal wind base
            this.vx = -3 - Math.random() * 8;
            // Alpha: near=more visible
            this.alpha = 0.35 + sd * 0.5 + Math.random() * 0.1;
            this._rotationAngle = 0;
            break;

        case 'cloud':
            this.size = 40 + Math.random() * 80;
            this.vx = -5 - Math.random() * 10;
            this.alpha = 0.15 + Math.random() * 0.2;
            break;

        case 'star':
            this.size = 1 + Math.random() * 2;
            this.maxLife = 40 + Math.random() * 80;
            this.life = Math.random() * this.maxLife;
            this.alpha = 0.3 + Math.random() * 0.7;
            this.wobble = Math.random() * 0.002;
            break;

        case 'sparkle':
            this.size = 2 + Math.random() * 4;
            this.maxLife = 20 + Math.random() * 30;
            this.life = Math.random() * this.maxLife;
            this.vx = (Math.random() - 0.5) * 20;
            this.vy = -30 - Math.random() * 40;
            this.alpha = 1;
            break;

        case 'hail':
            // Hail: small hard balls, fast fall, some bounce
            const hd = this.depth;
            this.size = (2 + hd * 4) * (0.8 + Math.random() * 0.4);
            this.speed = (300 + hd * 400 + Math.random() * 200);
            this.vy = this.speed;
            this.vx = -5 - Math.random() * 20;
            this.alpha = 0.5 + hd * 0.4 + Math.random() * 0.1;
            this._bouncePhase = Math.random() * Math.PI * 2;
            this._rotationAngle = Math.random() * Math.PI * 2;
            this._rotationSpeed = (Math.random() - 0.5) * 8;
            break;
    }
};

/* ── ParticleSystem constructor ──────────────────────────────────────────── */

/**
 * Create a ParticleSystem instance.
 * @constructor
 * @returns {void}
 */
function ParticleSystem() {
    this.particles = [];
    this._time = 0;
    // Ambient light for natural color integration (set externally)
    this.ambientLight = [1, 1, 1];
}

/**
 * Re-initialise all particles based on weather condition.
 * @param {number} width - Desklet width
 * @param {number} height - Desklet height
 * @param {number} weatherId - OWM weather ID
 * @param {boolean} isNight - Whether it is currently night
 * @returns {void}
 */
ParticleSystem.prototype.init = function (width, height, weatherId, isNight) {
    this.particles = [];
    this._time = 0;

    if (weatherId >= 200 && weatherId < 300) {
        // Thunderstorm: heavy rain + varied particles
        for (let i = 0; i < 250; i++) { this.particles.push(new Particle(Math.random() * width, Math.random() * height, 'rain')); }
        // Hail for severe thunderstorm (WMO 96, 99 → OWM 201, 202)
        if (weatherId >= 201) {
            for (let i = 0; i < 60; i++) { this.particles.push(new Particle(Math.random() * width, Math.random() * height, 'hail')); }
        }
    } else if (weatherId >= 300 && weatherId < 400) {
        // Drizzle: lighter rain
        for (let i = 0; i < 60; i++) { this.particles.push(new Particle(Math.random() * width, Math.random() * height, 'rain')); }
    } else if (weatherId >= 500 && weatherId < 600) {
        // Rain
        const count = weatherId >= 502 ? 200 : 100;
        for (let i = 0; i < count; i++) { this.particles.push(new Particle(Math.random() * width, Math.random() * height, 'rain')); }
    } else if (weatherId >= 600 && weatherId < 700) {
        // Snow
        const count = weatherId >= 602 ? 180 : 120;
        for (let i = 0; i < count; i++) { this.particles.push(new Particle(Math.random() * width, Math.random() * height, 'snow')); }
    } else if (weatherId === 800 && isNight) {
        // Stars
        for (let i = 0; i < 80; i++) { this.particles.push(new Particle(Math.random() * width, Math.random() * height * 0.7, 'star')); }
    } else if (weatherId === 800) {
        // Clear day: sparkles
        for (let i = 0; i < 15; i++) { this.particles.push(new Particle(Math.random() * width, height * 0.3 + Math.random() * height * 0.4, 'sparkle')); }
    } else if (weatherId >= 801 && weatherId < 900) {
        // Cloudy
        for (let i = 0; i < 4; i++) { this.particles.push(new Particle(Math.random() * width, Math.random() * height * 0.5, 'cloud')); }
        if (weatherId >= 803) {
            for (let i = 0; i < 20; i++) { this.particles.push(new Particle(Math.random() * width, Math.random() * height, 'rain')); }
        }
    } else if (weatherId >= 700 && weatherId < 800) {
        // Foggy
        for (let i = 0; i < 6; i++) { this.particles.push(new Particle(Math.random() * width, Math.random() * height * 0.6, 'cloud')); }
    }
};

/**
 * Update all particle positions.
 * @param {number} dt - Delta time in seconds
 * @param {number} width - Desklet width
 * @param {number} height - Desklet height
 * @returns {void}
 */
ParticleSystem.prototype.update = function (dt, width, height) {
    this._time += dt;

    for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];

        switch (p.type) {
            case 'rain':
                this._updateRain(p, dt, width, height);
                break;

            case 'snow':
                this._updateSnow(p, dt, width, height);
                break;

            case 'cloud':
                p.x += p.vx * dt;
                if (p.x + p.size < -50) {
                    p.x = width + Math.random() * 100;
                    p.y = Math.random() * height * 0.5;
                }
                break;

            case 'star':
                p.life -= 1;
                if (p.life <= 0) {
                    p.life = p.maxLife;
                    p.alpha = 0.3 + Math.random() * 0.7;
                }
                p.alpha += (Math.sin(this._time * p.wobble + p.wobbleOffset) * 0.002);
                p.alpha = Math.max(0.2, Math.min(1, p.alpha));
                break;

            case 'sparkle':
                p.life -= 1;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.alpha = p.life / p.maxLife;
                if (p.life <= 0) {
                    p.life = p.maxLife;
                    p.y = height * 0.3 + Math.random() * height * 0.4;
                    p.x = Math.random() * width;
                    p.vx = (Math.random() - 0.5) * 20;
                    p.vy = -30 - Math.random() * 40;
                }
                break;

            case 'hail':
                this._updateHail(p, dt, width, height);
                break;
        }
    }
};

/* ── Rain update with multi-layer depth ──────────────────────────────────── */

/**
 * Update a rain particle's position with depth-dependent speed.
 * @param {Object} p - Particle object
 * @param {number} dt - Delta time in seconds
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @returns {void}
 */
ParticleSystem.prototype._updateRain = function (p, dt, w, h) {
    // Depth affects speed (parallax-like)
    const speedFactor = 0.6 + p.depth * 0.8;
    const actualVx = p.vx * speedFactor;
    const actualVy = p.vy * speedFactor;

    p.x += actualVx * dt;
    p.y += actualVy * dt;

    // Wind gust: subtle horizontal push based on time and depth
    const gust = Math.sin(this._time * 0.7 + p.wobbleOffset) * 5 * (0.3 + p.depth * 0.7);
    p.x += gust * dt;

    if (p.y >= h + 10) {
        p.y = -10;
        p.x = Math.random() * w;
        p.depth = Math.random(); // new random depth for variety
    }
    if (p.x < -30) p.x = w + 30;
    if (p.x > w + 30 && actualVx > 0) p.x = -30;
};

/* ── Snow update with natural movement ────────────────────────────────────── */

/**
 * Update a snow particle's position with drift, wobble, and rotation.
 * @param {Object} p - Particle object
 * @param {number} dt - Delta time in seconds
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @returns {void}
 */
ParticleSystem.prototype._updateSnow = function (p, dt, w, h) {
    // Advance wobble phase
    p.wobbleOffset += p.wobbleSpeed * dt;

    // Horizontal drift: sine wave + random gust + wind
    const drift = Math.sin(this._time * p.wobbleSpeed + p.driftPhase) * p.driftAmplitude;

    // Gust: occasional wind burst
    let gust = Math.sin(this._time * 0.3 + p.wobbleOffset) * 8;
    gust *= Math.max(0, Math.sin(this._time * 0.5 + p.driftPhase));

    // Slow horizontal wind
    const wind = p.vx * (0.5 + p.depth * 0.5);

    // Combine horizontal movement
    const hMove = (wind + drift + gust) * dt;

    // Vertical speed with slight wobble
    const vWobble = Math.sin(this._time * 2 + p.wobbleOffset * 3) * 5 * dt;
    const vMove = (p.vy + vWobble) * dt;

    p.x += hMove;
    p.y += vMove;

    // Update rotation
    p._rotationAngle = (p._rotationAngle || 0) + p.rotationSpeed * dt;
    if (p._rotationAngle > Math.PI * 2) p._rotationAngle -= Math.PI * 2;

    // Wrap around
    if (p.y >= h + 10) {
        p.y = -10 - Math.random() * 20;
        p.x = Math.random() * w;
        p.depth = Math.random();
        p.driftPhase = Math.random() * Math.PI * 2;
        p.driftAmplitude = (5 + p.depth * 25) * (0.5 + Math.random() * 0.5);
    }
    if (p.x < -40) p.x = w + 40;
    if (p.x > w + 40) p.x = -40;
};

/* ── Hail update with bouncing ─────────────────────────────────────────── */

/**
 * Update a hail particle's position with rotation and wrap-around.
 * @param {Object} p - Particle object
 * @param {number} dt - Delta time in seconds
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @returns {void}
 */
ParticleSystem.prototype._updateHail = function (p, dt, w, h) {
    const speedFactor = 0.6 + p.depth * 0.8;
    const actualVx = p.vx * speedFactor;
    const actualVy = p.vy * speedFactor;

    p.x += actualVx * dt;
    p.y += actualVy * dt;

    // Rotation while falling
    p._rotationAngle += p._rotationSpeed * dt;
    if (p._rotationAngle > Math.PI * 2) p._rotationAngle -= Math.PI * 2;

    // Subtle horizontal wobble (hail is less affected by wind than rain)
    const gust = Math.sin(this._time * 0.5 + p._bouncePhase) * 3;
    p.x += gust * dt;

    if (p.y >= h + 10) {
        p.y = -10 - Math.random() * 20;
        p.x = Math.random() * w;
        p.depth = Math.random();
        p._bouncePhase = Math.random() * Math.PI * 2;
    }
    if (p.x < -30) p.x = w + 30;
    if (p.x > w + 30 && actualVx > 0) p.x = -30;
};

/* ── Draw all particles via Cairo context ──────────────────────────────── */

/**
 * Draw all particles using a Cairo context.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @returns {void}
 */
ParticleSystem.prototype.draw = function (cr) {
    for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        cr.save();

        switch (p.type) {
            case 'rain':
                this._drawRain(cr, p);
                break;

            case 'snow':
                this._drawSnow(cr, p);
                break;

            case 'cloud':
                cr.setSourceRGBA(1, 1, 1, p.alpha * 0.5);
                cr.arc(p.x, p.y, p.size * 0.3, 0, Math.PI * 2);
                cr.arc(p.x + p.size * 0.3, p.y - p.size * 0.1, p.size * 0.25, 0, Math.PI * 2);
                cr.arc(p.x + p.size * 0.5, p.y + p.size * 0.05, p.size * 0.2, 0, Math.PI * 2);
                cr.fill();
                break;

            case 'star':
                this._drawStar(cr, p);
                break;

            case 'sparkle':
                cr.setSourceRGBA(1, 1, 0.8, p.alpha * 0.8);
                cr.arc(p.x, p.y, p.size * 0.5 * p.alpha, 0, Math.PI * 2);
                cr.fill();
                break;

            case 'hail':
                this._drawHail(cr, p);
                break;
        }

        cr.restore();
    }
};

/* ── Draw rain streak with depth-dependent appearance ────────────────────── */

/**
 * Draw a rain particle as a streak with depth-dependent appearance.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {Object} p - Particle object
 * @returns {void}
 */
ParticleSystem.prototype._drawRain = function (cr, p) {
    // Color: cool blue-white, picking up ambient sky tone
    const amb = this.ambientLight;
    const r = (0.58 + p.depth * 0.22) * amb[0];
    const g = (0.68 + p.depth * 0.22) * amb[1];
    const b = (0.88 + p.depth * 0.12) * amb[2];

    // Streak length based on depth
    const streakLen = p._streakLen || (0.02 + p.depth * 0.04);
    const speedFactor = 0.6 + p.depth * 0.8;

    cr.setSourceRGBA(r, g, b, p.alpha * 0.7);
    cr.setLineWidth(p.size * 0.4 * (0.6 + p.depth * 0.4));

    const dx = p.vx * speedFactor * streakLen;
    const dy = p.vy * speedFactor * streakLen;

    cr.moveTo(p.x, p.y);
    cr.lineTo(p.x + dx, p.y + dy);
    cr.stroke();

    // Near drops get a slight glow
    if (p.depth > 0.6) {
        cr.setSourceRGBA(r, g, b, p.alpha * 0.1);
        cr.setLineWidth(p.size * 1.2);
        cr.moveTo(p.x - dx * 0.1, p.y - dy * 0.1);
        cr.lineTo(p.x + dx * 1.1, p.y + dy * 1.1);
        cr.stroke();
    }
};

/* ── Draw snowflake with rotation and shape ──────────────────────────────── */

/**
 * Draw a snowflake particle with rotation and hexagonal shape.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {Object} p - Particle object
 * @returns {void}
 */
ParticleSystem.prototype._drawSnow = function (cr, p) {
    const alpha = p.alpha * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(this._time * 2 + p.wobbleOffset)));
    const s = p.size * 0.5;
    const angle = p._rotationAngle || 0;
    const amb = this.ambientLight;

    // Snow: mostly white with subtle blue-amber variation from ambient light
    const sr = Math.min(1, 0.98 * amb[0]);
    const sg = Math.min(1, 0.97 * amb[1]);
    const sb = Math.min(1, 1.0 * amb[2]);

    cr.setSourceRGBA(sr, sg, sb, alpha);

    // Draw snowflake as a small circle with subtle hexagonal hint
    if (s > 3) {
        // Larger flakes: draw a simple star pattern
        cr.translate(p.x, p.y);
        cr.rotate(angle);

        // Central dot
        cr.arc(0, 0, s * 0.3, 0, Math.PI * 2);
        cr.fill();

        // 6-pointed star (simplified snowflake)
        cr.setLineWidth(s * 0.2);
        cr.setSourceRGBA(sr, sg, sb, alpha * 0.5);
        for (let arm = 0; arm < 6; arm++) {
            const a = arm * Math.PI / 3;
            cr.moveTo(0, 0);
            cr.lineTo(Math.cos(a) * s, Math.sin(a) * s);
            cr.stroke();

            // Tiny branches
            const bx = Math.cos(a) * s * 0.6;
            const by = Math.sin(a) * s * 0.6;
            cr.moveTo(bx, by);
            cr.lineTo(bx + Math.cos(a + 0.4) * s * 0.3,
                by + Math.sin(a + 0.4) * s * 0.3);
            cr.stroke();
            cr.moveTo(bx, by);
            cr.lineTo(bx + Math.cos(a - 0.4) * s * 0.3,
                by + Math.sin(a - 0.4) * s * 0.3);
            cr.stroke();
        }

        // Outer glow
        cr.setSourceRGBA(sr, sg, sb, alpha * 0.08);
        cr.arc(0, 0, s * 2, 0, Math.PI * 2);
        cr.fill();
    } else {
        // Small flakes: simple dot
        cr.arc(p.x, p.y, s * 0.8, 0, Math.PI * 2);
        cr.fill();

        // Faint glow
        cr.setSourceRGBA(sr, sg, sb, alpha * 0.05);
        cr.arc(p.x, p.y, s * 2, 0, Math.PI * 2);
        cr.fill();
    }
};

/* ── Draw star with twinkle ──────────────────────────────────────────────── */

/**
 * Draw a star particle with twinkling effect.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {Object} p - Particle object
 * @returns {void}
 */
ParticleSystem.prototype._drawStar = function (cr, p) {
    cr.setSourceRGBA(1, 1, 1, p.alpha);
    const twinkle = 0.5 + 0.5 * Math.sin(this._time * 3 + p.wobbleOffset * 10);
    const s = p.size * (0.5 + twinkle * 0.5);
    cr.arc(p.x, p.y, s, 0, Math.PI * 2);
    cr.fill();

    // Cross
    cr.setLineWidth(0.5);
    cr.setSourceRGBA(1, 1, 1, p.alpha * 0.3);
    cr.moveTo(p.x - s * 3, p.y);
    cr.lineTo(p.x + s * 3, p.y);
    cr.moveTo(p.x, p.y - s * 3);
    cr.lineTo(p.x, p.y + s * 3);
    cr.stroke();
};

/* ── Draw hail stone ───────────────────────────────────────────────────── */

/**
 * Draw a hail particle as an icy ball with highlight.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {Object} p - Particle object
 * @returns {void}
 */
ParticleSystem.prototype._drawHail = function (cr, p) {
    const s = p.size * 0.5;
    const angle = p._rotationAngle || 0;
    const amb = this.ambientLight;

    // Hail is white/icy with a slight blue tint, picking up ambient light
    const hr = 0.85 * amb[0];
    const hg = 0.90 * amb[1];
    const hb = 1.0 * amb[2];

    cr.setSourceRGBA(hr, hg, hb, p.alpha * 0.8);

    // Small hail: simple circle
    if (s < 2) {
        cr.arc(p.x, p.y, s, 0, Math.PI * 2);
        cr.fill();
        return;
    }

    // Larger hail: icy ball with highlight
    cr.save();
    cr.translate(p.x, p.y);
    cr.rotate(angle);

    // Main icy ball
    cr.setSourceRGBA(0.78 * amb[0], 0.83 * amb[1], 0.96 * amb[2], p.alpha * 0.85);
    cr.arc(0, 0, s, 0, Math.PI * 2);
    cr.fill();

    // Highlight (light reflection)
    cr.setSourceRGBA(1, 1, 1, p.alpha * 0.5);
    cr.arc(-s * 0.25, -s * 0.25, s * 0.35, 0, Math.PI * 2);
    cr.fill();

    // Ice ring (subtle)
    cr.setSourceRGBA(1, 1, 1, p.alpha * 0.2);
    cr.setLineWidth(0.5);
    cr.arc(0, 0, s * 0.7, 0, Math.PI * 2);
    cr.stroke();

    cr.restore();

    // Faint glow
    cr.setSourceRGBA(0.7, 0.8, 1.0, p.alpha * 0.08);
    cr.arc(p.x, p.y, s * 2.5, 0, Math.PI * 2);
    cr.fill();
};

// eslint-disable-next-line no-var
var ParticleSystem = ParticleSystem;
