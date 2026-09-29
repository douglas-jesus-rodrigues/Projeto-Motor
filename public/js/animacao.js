/* ==========================================================
   MOTORFLEX — Intro cinematográfica (JS vanilla + Canvas)
   Áudio: o vídeo tenta arrancar com som. Se o navegador bloquear,
   arranca mudo e o primeiro toque válido (touchend / pointerup / click / keydown)
   desmuta o vídeo e desbloqueia o AudioContext (trovões via Web Audio API).

   Tempestade: EXATAMENTE dois raios gigantes, quase simultâneos (40–120 ms),
   flash em múltiplos pulsos, trovão, escuridão, pausa e só então a marca.
   ========================================================== */
(() => {
    'use strict';

    /* ---------- CONFIG ---------- */
    const DESTINO = '../index.html';
    const FALLBACK_IMG = '../imagens/carro-ilustrado.png';
    const THUNDER_SRC = '../audio/thunder.mp3';
    const VIDEO_HORIZON = 0.50;
    const VIDEO_VOLUME = 1;
    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const MOBILE = matchMedia('(max-width: 720px)').matches;
    const $ = id => document.getElementById(id);

    const intro = $('intro'), stage = $('stage'), film = $('film'), video = $('video');
    const fallbackImg = $('fallback'), btn = $('btnPular');
    const fx = $('fx'), fctx = fx.getContext('2d');

    /* ---------- TIMELINE CENTRAL (ms) ---------- */
    const WALL = { glow: 200, play: 250, reveal: 800, kicker: 1300 };
    const VID = {
        kickerOut: 3600,
        fadeBeforeEnd: 1700,
        endGuard: 60,
        startTimeout: 5000,
        stallTimeout: 3000,
        defaultDur: 6000
    };
    // Tempos relativos ao início da fase STORM. dark/line/brand dependem de "portões" (ver STORM_EV).
    const STORM = {
        strike: 700,     // 1º raio
        dark: 1900,      // cena volta ao preto (só depois de o último flash acabar)
        line: 3300,      // linha central (só depois de escuro + pausa)
        brand: 3900,     // MOTORFLEX
        sub: 5200,       // SEJA BEM-VINDO
        out: 7400        // saída
    };
    const BOLT2_DELAY = 40 + Math.round(Math.random() * 80);  // 2º raio: 40–120 ms depois do 1º
    const FLASH_MS = 1050;     // duração total do envelope de clarão de cada raio
    const DARK_MS = 900;       // tempo do fade-out da cena (igual ao CSS .stage)
    const BRAND_PAUSE = 550;   // pausa cinematográfica em preto antes da linha (400–700 ms)

    const THUNDER = [
        { delay: 90,  vol: 0.90, rate: 1.00, skip: 0.57 },
        { delay: 210, vol: 0.30, rate: 0.88, skip: 0.57 }
    ];

    const setState = s => { intro.dataset.state = s; };
    const cls = c => intro.classList.add(c);

    let raf = 0, t0 = null, last = 0, clock = 0, fadeRaf = 0;
    let phase = 'INITIAL';
    let finished = false, cleaned = false, redirTimer = 0, resizeQueued = false;
    let vPlaying = false, fb = false, fbStart = 0, dur = VID.defaultDur;
    let lastVt = -1, lastAdv = 0, kickerOutDone = false, fadeDone = false;
    let stormT0 = 0, nextWall = 0, nextStorm = 0;
    let strikes = 0, boltEnd = 0, darkAt = 0, lineShown = false, brandShown = false;
    const fired = [false, false];
    let fxTarget = 0, fxAlpha = 0, fxDrawn = false, curFlash = 0, lastFlashStr = '';
    let shakeAmp = 0, shakeT = 0, shaking = false;

    // Som
    let soundOn = true, videoGain = 1, volCur = 0, lastVol = -1, interacted = false;
    let W = 0, H = 0, FDPR = 1, horizonY = 0, filmL = 0, filmW = 1;
    let thPlan = [];
    const parts = [], bolts = [];

    /* ==========================================================
       AUDIO ENGINE (Web Audio API)
       Um único AudioContext: um resume() dentro de um gesto válido
       desbloqueia-o para sempre e depois o RAF pode tocar à vontade.
       ========================================================== */
    const AudioEngine = (() => {
        const AC = window.AudioContext || window.webkitAudioContext;
        let ctx = null, master = null, buf = null, visHandler = null;

        // iOS 16.4+: trata o áudio como "playback" (ignora o switch de silêncio)
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}

        let failed = false, lastTry = 0;

        function init() {
            if (!AC || ctx) return;
            ctx = new AC({ latencyHint: 'interactive' });   // nasce 'suspended', é normal
            ctx.onstatechange = () => console.info('[audio] AudioContext:', ctx && ctx.state);
            master = ctx.createGain();
            master.connect(ctx.destination);
            ctx.resume().catch(() => {});                    // funciona se o navegador já confia no site

            fetch(THUNDER_SRC)
                .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + THUNDER_SRC); return r.arrayBuffer(); })
                .then(ab => new Promise((ok, err) => ctx.decodeAudioData(ab, ok, err))) // callback: Safari antigo
                .then(b => { buf = b; console.info('[audio] trovão decodificado:', b.duration.toFixed(2) + 's'); })
                .catch(e => { failed = true; console.warn('[audio] Web Audio falhou, usando <audio> de reserva:', e); });

            visHandler = () => {
                if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
            };
            document.addEventListener('visibilitychange', visHandler);
        }

        // TEM de ser chamada de forma síncrona dentro do handler do gesto
        function unlock() {
            if (!ctx) return Promise.resolve(false);
            const p = ctx.resume();
            try {
                const s = ctx.createBufferSource();       // "blip" silencioso (truque clássico iOS)
                s.buffer = ctx.createBuffer(1, 1, 22050);
                s.connect(ctx.destination);
                s.start(0);
            } catch (e) {}
            return Promise.resolve(p).then(() => ctx.state === 'running').catch(() => false);
        }

        function status() { return { state: ctx ? ctx.state : 'sem-contexto', buffer: !!buf, fallback: failed }; }

        function playFallback({ vol = 1, rate = 1, skip = 0 }) {
            try {
                const a = new Audio(THUNDER_SRC);
                a.volume = vol; a.playbackRate = rate;
                a.addEventListener('loadedmetadata', () => { try { a.currentTime = skip; } catch (e) {} }, { once: true });
                a.play().catch(e => console.warn('[audio] <audio> bloqueado:', e.name));
                return true;
            } catch (e) { return false; }
        }

        function play(o) {
            const { vol = 1, rate = 1, skip = 0 } = o;
            if (!ctx) return false;
            if (ctx.state !== 'running') {                    // ainda sem permissão: tenta de novo (máx. 4x/s)
                const n = performance.now();
                if (n - lastTry > 250) { lastTry = n; ctx.resume().catch(() => {}); }
                return false;
            }
            if (failed) return playFallback(o);
            if (!buf) return false;
            const s = ctx.createBufferSource(), g = ctx.createGain();
            s.buffer = buf;
            s.playbackRate.value = rate;
            g.gain.value = vol;
            s.connect(g); g.connect(master);
            s.start(0, Math.min(skip, Math.max(0, buf.duration - 0.05)));
            s.onended = () => { try { s.disconnect(); g.disconnect(); } catch (e) {} };
            return true;
        }

        function fadeOut(ms) {
            if (!ctx || !master) return;
            const t = ctx.currentTime;
            master.gain.cancelScheduledValues(t);
            master.gain.setValueAtTime(master.gain.value, t);
            master.gain.linearRampToValueAtTime(0, t + ms / 1000);
        }

        function close() {
            if (visHandler) { document.removeEventListener('visibilitychange', visHandler); visHandler = null; }
            if (ctx) { try { ctx.close(); } catch (e) {} }
            ctx = master = buf = null;
        }

        return { init, unlock, play, fadeOut, close, status };
    })();

    /* ---------- UTILITÁRIOS ---------- */
    function fit(cv, maxDpr) {
        const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
        const w = cv.clientWidth, h = cv.clientHeight;
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        const ctx = cv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { w, h, dpr };
    }

    function measureHorizon() {
        const r = film.getBoundingClientRect();
        filmL = r.left; filmW = r.width || 1;
        horizonY = fb ? H * 0.5 : Math.max(H * 0.3, Math.min(H * 0.75, r.top + r.height * VIDEO_HORIZON));
    }

    function makeGrain() {
        const c = document.createElement('canvas'); c.width = c.height = 96;
        const x = c.getContext('2d'), d = x.createImageData(96, 96);
        for (let i = 0; i < d.data.length; i += 4) {
            const v = Math.random() * 255;
            d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
        }
        x.putImageData(d, 0, 0);
        intro.style.setProperty('--grain', `url(${c.toDataURL()})`);
    }

    function tickVolume(dt) {
        if (!soundOn || video.muted || fb) return;
        volCur += (VIDEO_VOLUME * videoGain - volCur) * Math.min(1, dt * 4);
        const v = Math.max(0, Math.min(1, volCur));
        if (Math.abs(v - lastVol) > .004) { lastVol = v; try { video.volume = v; } catch (e) {} }
    }

    /* ==========================================================
       DESBLOQUEADOR GLOBAL DE ÁUDIO
       Só eventos que o navegador reconhece como "ativação de utilizador".
       ========================================================== */
    const GESTURES = ['touchend', 'pointerup', 'click', 'keydown'];
    const GESTURE_OPTS = { capture: true, passive: true };

    function attachGestures() {
        GESTURES.forEach(e => document.addEventListener(e, onGesture, GESTURE_OPTS));
    }
    function detachGestures() {
        GESTURES.forEach(e => document.removeEventListener(e, onGesture, GESTURE_OPTS));
    }

    function onGesture() {
        if (finished || cleaned) return;
        soundOn = true;

        try {
            video.muted = false;
            // Só retoma na fase do vídeo (na tempestade o vídeo está pausado de propósito)
            if (phase === 'VIDEO' && !fb && video.paused && !video.ended) {
                const p = video.play();
                if (p && p.catch) p.catch(() => {
                    try { video.muted = true; video.play().catch(() => {}); } catch (e) {}
                });
            }
        } catch (e) {}

        AudioEngine.unlock().then(ok => {
            if (ok) { interacted = true; detachGestures(); }
        });
    }

    /* ---------- VÍDEO ---------- */
    // O Chrome PAUSA o vídeo se o script o desmutar sem o utilizador ter interagido com a página.
    const hasActivation = () => !!(navigator.userActivation && navigator.userActivation.hasBeenActive);

    function tryPlay() {
        const withSound = hasActivation();
        try {
            video.muted = !withSound;
            if (withSound) video.volume = 0;
        } catch (e) {}

        const p = video.play();
        if (p && typeof p.catch === 'function') {
            p.catch(() => {
                // Bloqueado: arranca mudo e espera o toque.
                try {
                    video.muted = true;
                    const p2 = video.play();
                    if (p2 && p2.catch) p2.catch(() => useFallback(clock));
                } catch (err) {
                    useFallback(clock);
                }
            });
        }
    }

    function onMeta() { dur = isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : VID.defaultDur; }
    function onPlaying() { if (fb) return; vPlaying = true; lastAdv = performance.now(); }
    function onCanPlay() { if (phase === 'VIDEO' && !vPlaying && !fb && video.paused && !video.ended) tryPlay(); }
    function onEnded() { startStorm(performance.now()); }
    function onVideoError() { useFallback(performance.now()); }

    const V_EVENTS = [['loadedmetadata', onMeta], ['canplay', onCanPlay], ['playing', onPlaying], ['ended', onEnded], ['error', onVideoError]];
    function bindVideo() {
        V_EVENTS.forEach(([n, h]) => video.addEventListener(n, h));
        const src = video.querySelector('source');
        if (src) src.addEventListener('error', onVideoError);
        try { video.pause(); video.currentTime = 0; } catch (e) {}
        if (video.readyState >= 1) onMeta();
    }

    function disposeVideo() {
        V_EVENTS.forEach(([n, h]) => video.removeEventListener(n, h));
        const src = video.querySelector('source');
        if (src) src.removeEventListener('error', onVideoError);
        try {
            video.pause();
            video.removeAttribute('autoplay');
            video.querySelectorAll('source').forEach(s => s.remove());
            video.removeAttribute('src');
            video.load();
        } catch (e) {}
    }

    function useFallback(now) {
        if (fb || finished || phase === 'STORM') return;
        fb = true; fbStart = now; vPlaying = false;
        try { video.pause(); } catch (e) {}
        fallbackImg.src = FALLBACK_IMG;
        cls('is-fallback');
        measureHorizon();
    }

    /* ---------- CANVAS / CHUVA ---------- */
    function resizeCanvas() {
        const f = fit(fx, MOBILE ? 1.5 : 2);
        W = f.w; H = f.h; FDPR = f.dpr;
        measureHorizon();
        initParticles();
    }

    function onResize() {
        if (resizeQueued) return;
        resizeQueued = true;
        requestAnimationFrame(() => { resizeQueued = false; if (!finished) resizeCanvas(); });
    }

    function initParticles() {
        parts.length = 0;
        const n = REDUCED ? 0 : MOBILE ? 28 : 70;
        for (let i = 0; i < n; i++)
            parts.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random(), rain: Math.random() < .75 });
    }

    function updateParticles(dt) {
        for (const p of parts) {
            if (p.rain) { p.y += (380 + p.z * 820) * dt; p.x -= (380 + p.z * 820) * .12 * dt; }
            else { p.x -= (6 + p.z * 26) * dt; p.y += (4 + p.z * 10) * dt; }
            if (p.y > H + 30) { p.y = -30; p.x = Math.random() * (W + 200); }
            if (p.x < -30) p.x = W + 30;
        }
    }

    // A chuva fica bem mais visível durante o clarão (gotas "acendem")
    function drawParticles() {
        const boost = 1 + curFlash * 9;
        fctx.lineCap = 'round';
        for (const p of parts) {
            fctx.globalAlpha = Math.min(1, (.03 + p.z * .07) * fxAlpha * boost);
            if (p.rain) {
                const len = 8 + p.z * 22;
                fctx.strokeStyle = '#d3deee'; fctx.lineWidth = .5 + p.z * .7;
                fctx.beginPath(); fctx.moveTo(p.x, p.y); fctx.lineTo(p.x + len * .12, p.y - len); fctx.stroke();
            } else {
                fctx.fillStyle = p.z > .5 ? '#ffb4a8' : '#ffffff';
                fctx.beginPath(); fctx.arc(p.x, p.y, .6 + p.z * p.z * 2, 0, 6.283); fctx.fill();
            }
        }
        fctx.globalAlpha = 1;
    }

    /* ==========================================================
       RAIOS — exatamente dois, gigantes, ramificados e diferentes
       Geometria baseada em W, H e horizonY (nada de pixels fixos).
       ========================================================== */
    const BOLT_STYLE = [
        // esquerdo: mais "limpo", inclina para a direita
        { x: [.20, .32], jag: .50, branch: .12, kink: .04, tilt: [ .03,  .14], reach: [.68, .80], wMul: 1.00, gain: .95 },
        // direito: mais nervoso, mais ramificado, um pouco mais longo e grosso
        { x: [.66, .79], jag: .75, branch: .16, kink: .06, tilt: [-.16, -.02], reach: [.74, .86], wMul: 1.12, gain: 1.0 }
    ];

    function createBolt(i) {
        const P = BOLT_STYLE[i], r = Math.random, rr = (a, b) => a + (b - a) * r();
        const buckets = new Map(), maxSeg = MOBILE ? 260 : 480;
        let count = 0;

        const x0 = W * rr(P.x[0], P.x[1]);
        const w0 = Math.max(2.2, Math.min(W, H) * .0042) * P.wMul;               // espessura do tronco
        const len = Math.min(H * .9, Math.max(H * rr(P.reach[0], P.reach[1]), horizonY * .95)); // 65–90% da altura
        const unit = Math.max(9, Math.min(16, H / 62));                          // comprimento de cada segmento

        function seg(x1, y1, x2, y2, w) {
            const k = Math.max(.5, Math.round(w * 4) / 4);
            let p = buckets.get(k);
            if (!p) { p = new Path2D(); buckets.set(k, p); }
            p.moveTo(x1, y1); p.lineTo(x2, y2); count++;
        }

        function grow(x, y, a, L, w, d) {
            const steps = Math.max(3, Math.ceil(L / unit)), step = L / steps;
            let cx = x, cy = y, ang = a;
            for (let k = 0; k < steps; k++) {
                ang = a + (ang - a) * .55 + (r() - .5) * P.jag * (d ? 1.25 : 1);
                if (d === 0 && r() < P.kink) ang += (r() < .5 ? -1 : 1) * rr(.5, .9);   // quebra brusca do tronco
                const nx = cx + Math.cos(ang) * step, ny = cy + Math.sin(ang) * step;
                seg(cx, cy, nx, ny, w * (1 - k / steps * .5));
                if (d < 3 && k > 2 && count < maxSeg && r() < P.branch * (d ? .6 : 1))
                    grow(nx, ny, ang + (r() < .5 ? -1 : 1) * rr(.3, .85), (L - k * step) * rr(.25, .55), w * (d ? .5 : .55), d + 1);
                cx = nx; cy = ny;
            }
        }

        grow(x0, -H * .03, Math.PI / 2 + rr(P.tilt[0], P.tilt[1]), len, w0, 0);
        return { paths: [...buckets], x0 };
    }

    /* Envelope do clarão: PULSO FORTE → queda → 2º PULSO FORTE → pequena queda → residual → sumiço */
    const KF = [[0, 0], [18, 1], [60, .92], [110, .28], [150, 1], [210, .85], [260, .30], [320, .55], [380, .40]];
    function flashEnv(s) {
        if (s <= 0) return 0;
        if (s >= 380) return .4 * Math.exp(-(s - 380) / 200);
        for (let i = 1; i < KF.length; i++) if (s <= KF[i][0]) {
            const [ta, ea] = KF[i - 1], [tb, eb] = KF[i];
            return ea + (eb - ea) * (s - ta) / (tb - ta);
        }
        return 0;
    }

    // micro camera-shake (~100–200 ms)
    function kick(a) {
        if (REDUCED) return;
        shakeAmp = MOBILE ? a * .55 : a; shakeT = clock;
    }

    function strike(i) {
        if (fired[i] || (i === 1 && !fired[0])) return;     // nunca mais de 2 raios
        fired[i] = true; strikes++;
        const b = createBolt(i);
        bolts.push({ paths: b.paths, t0: clock, e: 0, ve: 0, gain: BOLT_STYLE[i].gain });
        intro.style.setProperty(i ? '--bx2' : '--bx1', (((b.x0 - filmL) / filmW) * 100).toFixed(1) + '%');
        boltEnd = Math.max(boltEnd, clock + FLASH_MS);
        kick(i ? 1.6 : 2.2);
        if (i === 0) console.info('[thunder] raio! estado do áudio:', AudioEngine.status());
        if (i === 0) thPlan = THUNDER.map((t, k) => ({ i: k, at: clock + t.delay, vol: t.vol, rate: t.rate, skip: t.skip, done: false }));
    }

    function updateFlash(now) {
        curFlash = 0;
        for (let i = bolts.length - 1; i >= 0; i--) {
            const b = bolts[i], s = now - b.t0;
            if (s > FLASH_MS) { bolts.splice(i, 1); continue; }
            b.e = flashEnv(s) * b.gain;
            // o traço do raio some antes do clarão residual terminar
            b.ve = b.e * (s < 330 ? 1 : Math.exp(-(s - 330) / 110));
            if (b.e > curFlash) curFlash = b.e;
        }
        const str = curFlash.toFixed(3);
        if (str !== lastFlashStr) { lastFlashStr = str; intro.style.setProperty('--flash', str); }
    }

    // 4 camadas: halo externo → glow branco-azulado → núcleo → núcleo interno (quase branco puro)
    const PASSES = [
        { k: 7,  a: .09, blur: 70, c: '186,202,232' },
        { k: 3,  a: .28, blur: 32, c: '214,226,246' },
        { k: 1,  a: .92, blur: 12, c: '244,248,255' },
        { k: .4, a: 1,   blur: 3,  c: '255,255,255' }
    ];
    const BLUR_K = MOBILE ? .6 : 1;

    function drawBolts() {
        fctx.lineCap = 'round'; fctx.lineJoin = 'round';
        fctx.shadowColor = 'rgba(200,215,245,.85)';
        for (const b of bolts) {
            if (b.ve < .01) continue;
            const al = Math.min(1, b.ve);
            for (const ps of PASSES) {
                fctx.shadowBlur = ps.blur * FDPR * BLUR_K;
                fctx.strokeStyle = `rgba(${ps.c},${(ps.a * al).toFixed(3)})`;
                for (const [k, path] of b.paths) {
                    fctx.lineWidth = Math.max(.5, k * ps.k);
                    fctx.stroke(path);
                }
            }
        }
        fctx.shadowBlur = 0;
    }

    function renderFx(now, dt) {
        updateFlash(now);
        fxAlpha += (fxTarget - fxAlpha) * Math.min(1, dt * 2.5);
        const s = shakeAmp * Math.exp(-(now - shakeT) / 90);
        if (s > .05) {
            stage.style.transform = `translate3d(${((Math.random() - .5) * 2 * s).toFixed(1)}px,${((Math.random() - .5) * 2 * s).toFixed(1)}px,0)`;
            shaking = true;
        } else if (shaking) { stage.style.transform = ''; shaking = false; }

        if (fxAlpha < .01 && !bolts.length) {
            if (fxDrawn) { fctx.clearRect(0, 0, W, H); fxDrawn = false; }
            return;
        }
        updateParticles(dt);
        fctx.clearRect(0, 0, W, H);
        if (fxAlpha >= .01) drawParticles();
        drawBolts();
        fxDrawn = true;
    }

    /* ---------- ÁUDIO DO TROVÃO (via AudioEngine) ---------- */
    function initAudio() { AudioEngine.init(); }

    function runThunder(now) {
        for (const p of thPlan) {
            if (p.done || now < p.at) continue;
            const late = Math.max(0, (now - p.at) / 1000);
            const ok = AudioEngine.play({ vol: p.vol, rate: p.rate, skip: p.skip + late * p.rate });
            // Se o áudio ainda não estava liberado, insiste por até 2,5 s (um toque tardio ainda dispara o trovão)
            if (ok || now - p.at > 2500) p.done = true;
        }
    }

    function fadeOutAudio(ms) {
        AudioEngine.fadeOut(ms);
        const tStart = performance.now();
        let vv = 1; try { vv = video.volume; } catch (e) {}
        (function step(now) {
            const u = Math.min(1, (now - tStart) / ms);
            try { if (!video.muted) video.volume = Math.max(0, vv * (1 - u)); } catch (e) {}
            if (u < 1 && !cleaned) fadeRaf = requestAnimationFrame(step);
        })(tStart);
    }

    function stopAudio() {
        AudioEngine.close();
        thPlan = [];
    }

    /* ---------- TIMELINES ---------- */
    const WALL_EV = REDUCED ? [
        [150,  () => cls('is-brand-line')],
        [500,  () => { cls('is-brand'); setState('BRAND_REVEAL'); }],
        [1200, () => cls('is-sub')],
        [2800, () => leave(false)]
    ] : [
        [WALL.glow,   () => cls('is-glow')],
        [WALL.play,   () => { phase = 'VIDEO'; tryPlay(); }],
        [WALL.reveal, () => { cls('is-scene'); setState('SCENE_REVEAL'); }],
        [WALL.kicker, () => { cls('is-kicker'); fxTarget = 1; }]
    ];

    // Portões: cada evento só dispara quando o anterior realmente terminou.
    const boltDone = now => strikes === 2 && now >= boltEnd;                        // raios + clarão acabaram
    const lineGate = now => darkAt > 0 && now >= darkAt + DARK_MS + BRAND_PAUSE;    // escuro total + pausa
    const brandGate = () => lineShown;

    const STORM_EV = [
        [STORM.strike,                () => strike(0)],
        [STORM.strike + BOLT2_DELAY,  () => strike(1)],
        [STORM.strike + 150,          () => kick(1.0)],                             // impacto do 2º pulso
        [STORM.dark,  () => { darkAt = clock; cls('is-dark'); fxTarget = 0; }, boltDone],
        [STORM.line,  () => { lineShown = true; cls('is-brand-line'); setState('BRAND_REVEAL'); }, lineGate],
        [STORM.brand, () => { brandShown = true; cls('is-brand'); }, brandGate],
        [STORM.sub,   () => cls('is-sub'), () => brandShown],
        [STORM.out,   () => leave(false), () => brandShown]
    ];

    function startStorm(now) {
        if (phase !== 'VIDEO' || finished) return;
        phase = 'STORM'; stormT0 = now;
        try { video.pause(); } catch (e) {}
        setState('STORM'); cls('is-fade'); cls('is-storm'); cls('is-kicker-out');
    }

    function runVideo(now, t) {
        if (!fb && !vPlaying) { if (t > VID.startTimeout) useFallback(now); return; }
        const vt = fb ? now - fbStart : video.currentTime * 1000;
        if (!fb) {
            if (vt !== lastVt) { lastVt = vt; lastAdv = now; }
            else if (now - lastAdv > VID.stallTimeout) return startStorm(now);
        }
        if (!kickerOutDone && vt >= VID.kickerOut) { kickerOutDone = true; cls('is-kicker-out'); }
        if (!fadeDone && vt >= dur - VID.fadeBeforeEnd) { fadeDone = true; cls('is-fade'); }
        const left = dur - vt;
        videoGain = left >= VID.fadeBeforeEnd ? 1 : Math.max(0, left / VID.fadeBeforeEnd);
        if ((!fb && video.ended) || vt >= dur - VID.endGuard) startStorm(now);
    }

    function runStorm(now) {
        const st = now - stormT0;
        while (nextStorm < STORM_EV.length) {
            const e = STORM_EV[nextStorm];
            if (st < e[0] || (e[2] && !e[2](now))) break;
            nextStorm++; e[1]();
            if (finished) return;
        }
    }

    /* ---------- LOOP PRINCIPAL ---------- */
    function frame(now) {
        if (finished) return;
        raf = requestAnimationFrame(frame);
        if (t0 === null) { t0 = now; last = now; }
        clock = now;
        const t = now - t0, dt = Math.min(.05, (now - last) / 1000);
        last = now;

        while (nextWall < WALL_EV.length && t >= WALL_EV[nextWall][0]) WALL_EV[nextWall++][1]();
        if (finished || REDUCED) return;

        if (phase === 'VIDEO') runVideo(now, t);
        else if (phase === 'STORM') runStorm(now);
        if (finished) return;
        tickVolume(dt);
        if (thPlan.length) runThunder(now);
        renderFx(now, dt);
    }

    /* ---------- SAÍDA / LIMPEZA ---------- */
    function skipIntro() { leave(true); }

    function leave(fast) {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(raf);
        setState('FINISHING');
        try { video.pause(); } catch (e) {}
        intro.classList.add('is-out');
        if (fast) intro.classList.add('is-skipping');
        btn.disabled = true;
        fadeOutAudio(fast ? 400 : 900);
        redirTimer = setTimeout(finishIntro, fast ? 480 : 1050);
    }

    function finishIntro() {
        cleanup();
        setState('FINISHED');
        location.replace(DESTINO);
    }

    function cleanup() {
        if (cleaned) return;
        cleaned = true;
        cancelAnimationFrame(raf);
        cancelAnimationFrame(fadeRaf);
        clearTimeout(redirTimer);
        window.removeEventListener('resize', onResize);
        detachGestures();
        btn.removeEventListener('click', skipIntro);
        disposeVideo();
        stopAudio();
        parts.length = 0; bolts.length = 0;
        fctx.clearRect(0, 0, fx.width, fx.height);
    }

    /* ---------- INIT ---------- */
    function initIntro() {
        resizeCanvas();
        makeGrain();
        window.addEventListener('resize', onResize);
        btn.addEventListener('click', skipIntro);
        attachGestures();     // desbloqueador invisível no ecrã inteiro

        if (REDUCED) {
            disposeVideo();
            raf = requestAnimationFrame(frame);
            return;
        }
        bindVideo();
        initAudio();
        raf = requestAnimationFrame(frame);
    }

    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise(r => setTimeout(r, 700))]).then(initIntro);
})();