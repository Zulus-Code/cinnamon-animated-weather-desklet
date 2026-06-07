/* particleSystem.js — Weather particle system for weather-animated@zulus */

/* ── Particle constructor (not exported, used internally) ─────────────────── */
function Particle(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.vx = 0;
    this.vy = 0;
    this.size = 0;
    this.alpha = 1;
    this.life = 1;
    this.maxLife = 1;
    this.speed = 0;
    this.wobble = 0;
    this.wobbleSpeed = 0;
    this.wobbleOffset = 0;
    this._init(type);
}

Particle.prototype._init = function (type) {
    switch (type) {
        case 'rain':
            this.size = Math.random() * 2 + 1.5;
            this.speed = 300 + Math.random() * 400;
            this.vy = this.speed;
            this.vx = -20 - Math.random() * 30;
            this.alpha = 0.4 + Math.random() * 0.5;
            break;
        case 'snow':
            this.size = Math.random() * 4 + 2;
            this.speed = 40 + Math.random() * 60;
            this.vy = this.speed;
            this.wobble = Math.random() * 30 + 10;
            this.wobbleSpeed = 1 + Math.random() * 2;
            this.wobbleOffset = Math.random() * Math.PI * 2;
            this.alpha = 0.6 + Math.random() * 0.4;
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
    }
};

/* ── ParticleSystem constructor ──────────────────────────────────────────── */
function ParticleSystem() {
    this.particles = [];
    this._time = 0;
}

/* Re-initialise all particles based on weather condition */
ParticleSystem.prototype.init = function (width, height, weatherId, isNight) {
    this.particles = [];
    this._time = 0;

    if (weatherId >= 200 && weatherId < 300) {
        for (let i = 0; i < 200; i++)
            this.particles.push(new Particle(Math.random() * width, Math.random() * height, 'rain'));
    } else if (weatherId >= 300 && weatherId < 400) {
        for (let i = 0; i < 80; i++)
            this.particles.push(new Particle(Math.random() * width, Math.random() * height, 'rain'));
    } else if (weatherId >= 500 && weatherId < 600) {
        let count = weatherId >= 502 ? 180 : 100;
        for (let i = 0; i < count; i++)
            this.particles.push(new Particle(Math.random() * width, Math.random() * height, 'rain'));
    } else if (weatherId >= 600 && weatherId < 700) {
        for (let i = 0; i < 120; i++)
            this.particles.push(new Particle(Math.random() * width, Math.random() * height, 'snow'));
    } else if (weatherId === 800 && isNight) {
        for (let i = 0; i < 80; i++)
            this.particles.push(new Particle(Math.random() * width, Math.random() * height * 0.7, 'star'));
    } else if (weatherId === 800) {
        for (let i = 0; i < 15; i++)
            this.particles.push(new Particle(Math.random() * width, height * 0.3 + Math.random() * height * 0.4, 'sparkle'));
    } else if (weatherId >= 801 && weatherId < 900) {
        for (let i = 0; i < 4; i++)
            this.particles.push(new Particle(Math.random() * width, Math.random() * height * 0.5, 'cloud'));
        if (weatherId >= 803) {
            for (let i = 0; i < 20; i++)
                this.particles.push(new Particle(Math.random() * width, Math.random() * height, 'rain'));
        }
    } else if (weatherId >= 700 && weatherId < 800) {
        for (let i = 0; i < 6; i++)
            this.particles.push(new Particle(Math.random() * width, Math.random() * height * 0.6, 'cloud'));
    }
};

/* Update all particle positions */
ParticleSystem.prototype.update = function (dt, width, height) {
    this._time += dt;
    let p, i;

    for (i = this.particles.length - 1; i >= 0; i--) {
        p = this.particles[i];

        switch (p.type) {
            case 'rain':
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (p.y >= height + 10) {
                    p.y = -10;
                    p.x = Math.random() * width;
                }
                if (p.x < -20) p.x = width + 20;
                break;

            case 'snow':
                p.wobbleOffset += p.wobbleSpeed * dt;
                p.x += p.vx * dt + Math.sin(p.wobbleOffset) * p.wobble * dt;
                p.y += p.vy * dt;
                if (p.y >= height + 5) {
                    p.y = -5;
                    p.x = Math.random() * width;
                    p.wobbleOffset = Math.random() * Math.PI * 2;
                }
                if (p.x < -20) p.x = width + 20;
                if (p.x > width + 20) p.x = -20;
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
        }
    }
};

/* Draw all particles via Cairo context */
ParticleSystem.prototype.draw = function (cr) {
    let p, i, twinkle, s;

    for (i = 0; i < this.particles.length; i++) {
        p = this.particles[i];
        cr.save();

        switch (p.type) {
            case 'rain':
                cr.setSourceRGBA(0.7, 0.8, 1, p.alpha * 0.6);
                cr.setLineWidth(p.size * 0.5);
                cr.moveTo(p.x, p.y);
                cr.lineTo(p.x + p.vx * 0.03, p.y + p.vy * 0.03);
                cr.stroke();
                break;

            case 'snow':
                cr.setSourceRGBA(1, 1, 1, p.alpha);
                cr.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
                cr.fill();
                break;

            case 'cloud':
                cr.setSourceRGBA(1, 1, 1, p.alpha * 0.5);
                cr.arc(p.x, p.y, p.size * 0.3, 0, Math.PI * 2);
                cr.arc(p.x + p.size * 0.3, p.y - p.size * 0.1, p.size * 0.25, 0, Math.PI * 2);
                cr.arc(p.x + p.size * 0.5, p.y + p.size * 0.05, p.size * 0.2, 0, Math.PI * 2);
                cr.fill();
                break;

            case 'star':
                cr.setSourceRGBA(1, 1, 1, p.alpha);
                twinkle = 0.5 + 0.5 * Math.sin(this._time * 3 + p.wobbleOffset * 10);
                s = p.size * (0.5 + twinkle * 0.5);
                cr.arc(p.x, p.y, s, 0, Math.PI * 2);
                cr.fill();
                cr.setLineWidth(0.5);
                cr.setSourceRGBA(1, 1, 1, p.alpha * 0.3);
                cr.moveTo(p.x - s * 3, p.y);
                cr.lineTo(p.x + s * 3, p.y);
                cr.moveTo(p.x, p.y - s * 3);
                cr.lineTo(p.x, p.y + s * 3);
                cr.stroke();
                break;

            case 'sparkle':
                cr.setSourceRGBA(1, 1, 0.8, p.alpha * 0.8);
                cr.arc(p.x, p.y, p.size * 0.5 * p.alpha, 0, Math.PI * 2);
                cr.fill();
                break;
        }

        cr.restore();
    }
};

var ParticleSystem = ParticleSystem;
