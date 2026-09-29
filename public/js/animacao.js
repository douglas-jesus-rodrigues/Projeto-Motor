/* ==========================================================
   MOTORFLEX — Intro cinematográfica (JS vanilla + Canvas 2D)

   SEQUÊNCIA (uma única timeline, sem setTimeout soltos):
   VÍDEO (com um raio no meio, no drift) → fim do vídeo → escurece → DOIS raios
   gigantes (quase juntos) → flash → trovão → 2º pulso → raios somem → a tela
   fica TOTALMENTE escura → FUMAÇA (só ela) → cresce → MOTORFLEX surge pela
   fumaça → totalmente visível → pausa → fade para preto → site.

   A intro sempre é exibida; o botão PULAR INTRO é a única forma de sair antes do fim.

   Áudio: o vídeo tenta arrancar com som. Se o navegador bloquear, arranca mudo
   e o primeiro gesto válido (touchend / pointerup / click / keydown) desmuta o
   vídeo e desbloqueia o AudioContext (trovão via Web Audio API). Nada disso
   interrompe a apresentação.
   ========================================================== */
(() => {
    'use strict';

    /* ---------- CONFIG ---------- */
    const DESTINO = '../pages/index.html';
    const FALLBACK_IMG = '../imagens/carro-ilustrado.png';
    const THUNDER_SRC = '../audio/thunder.mp3';
    const VIDEO_HORIZON = 0.50;
    const VIDEO_VOLUME = 1;
    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const MOBILE = matchMedia('(max-width: 720px)').matches;
    const LOW = MOBILE || (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
                (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    const $ = id => document.getElementById(id);

    const intro = $('intro'), stage = $('stage'), film = $('film'), video = $('video');
    const fallbackImg = $('fallback'), btn = $('btnPular');
    const brandEl = $('brand'), brandMask = $('brandMask');
    const fx = $('fx'), fctx = fx.getContext('2d');
    const smoke = $('smoke'), sctx = smoke.getContext('2d');

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
    // Relativo ao início da fase STORM (fim do vídeo): o vídeo escurece, depois caem os raios.
    const STORM = { strike: REDUCED ? 250 : 700 };
    // Relativo ao início da fumaça (que só começa quando o clarão termina)
    const SMK = REDUCED
        ? { grow: 1000, glint: 500,  rvStart: 800,  rvDur: 1000, sub: 1500, out: 3000 }
        : { grow: 2400, glint: 1300, rvStart: 1900, rvDur: 2300, sub: 3800, out: 5900 };
    //   glint   → surge um pequeno brilho no centro
    //   rvStart → letras começam a aparecer (a fumaça se abre no centro)
    //   rvStart+rvDur → MOTORFLEX totalmente visível; daí até "out" = pausa com a fumaça ainda em movimento

    const BOLT2_DELAY = 40 + Math.round(Math.random() * 80);  // 2º raio: 40–120 ms depois do 1º
    const FLASH_MS = 1050;     // duração total do envelope de clarão de cada raio
    const FLASH_GAIN = REDUCED ? .5 : 1;
    const MID_AT = .5;         // raio no MEIO do vídeo (fração da duração). Ajuste para cair exatamente no drift do carro.
    const GROW_MS = 70;        // tempo em que o raio "desce" do céu até o chão (leader) antes do clarão principal

    // Trovão. "skip" = segundo do ARQUIVO em que o estrondo começa (ajuste conforme o seu thunder.mp3);
    // "delay" = ms depois do raio em que ele soa (impacto sincronizado com os dois raios).
    const THUNDER = [
        { delay: 90,  vol: 0.90, rate: 1.00, skip: 0.57 },
        { delay: 210, vol: 0.30, rate: 0.88, skip: 0.57 }
    ];

    const setState = s => { intro.dataset.state = s; };
    const cls = c => intro.classList.add(c);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const smooth = t => t * t * (3 - 2 * t);
    const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const easeOut = t => 1 - Math.pow(1 - t, 3);

    let raf = 0, t0 = null, last = 0, clock = 0, fadeRaf = 0;
    let phase = 'INITIAL';
    let leaving = false, cleaned = false, redirTimer = 0, resizeQueued = false;
    let vPlaying = false, fb = false, fbStart = 0, dur = REDUCED ? 1400 : VID.defaultDur;
    let lastVt = -1, lastAdv = 0, kickerOutDone = false, fadeDone = false;
    let stormT0 = 0, nextWall = 0, nextStorm = 0, nextSmoke = 0;
    let strikes = 0, boltEnd = 0;
    const fired = [false, false];
    let fxTarget = 0, fxAlpha = 0, fxDrawn = false, curFlash = 0, lastFlashStr = '';
    let shakeAmp = 0, shakeT = 0, shaking = false;

    // Fumaça / marca
    let smokeOn = false, smokeT0 = 0, rvCur = 0, lastBrandKey = '', slow = 0;
    let midDone = REDUCED, flickAt = 0, flick = null, glowSpr = null;
    let SW = 1, SS = 1, brandY = 0, activeN = 0;
    const SMOKE_N = REDUCED ? 9 : LOW ? 22 : 42;
    const SMOKE_RES = LOW ? .4 : .5;             // resolução do canvas da fumaça (fração do tamanho CSS)
    const MOVE = REDUCED ? .3 : 1;               // amplitude do movimento da fumaça
    const SPR_R = 128;
    const sprites = [], puffs = [];

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

        let failed = false, lastTry = 0, poolIdx = 0;
        const pool = [];        // <audio> pré-carregados (reserva quando o fetch é bloqueado, ex.: file://)

        function prewarm() {
            if (pool.length) return;
            for (let i = 0; i < 2; i++) {
                try {
                    const a = new Audio(THUNDER_SRC);
                    a.preload = 'auto';
                    pool.push(a);
                } catch (e) {}
            }
        }

        function init() {
            if (!AC || ctx) return;
            try {
                ctx = new AC({ latencyHint: 'interactive' });   // nasce 'suspended', é normal
            } catch (e) { ctx = null; failed = true; return; }
            ctx.onstatechange = () => console.info('[audio] AudioContext:', ctx && ctx.state);
            master = ctx.createGain();
            master.connect(ctx.destination);
            ctx.resume().catch(() => {});                    // funciona se o navegador já confia no site

            fetch(THUNDER_SRC)
                .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + THUNDER_SRC); return r.arrayBuffer(); })
                .then(ab => new Promise((ok, err) => ctx.decodeAudioData(ab, ok, err))) // callback: Safari antigo
                .then(b => { buf = b; console.info('[audio] trovão decodificado:', b.duration.toFixed(2) + 's'); })
                .catch(e => { failed = true; prewarm(); console.warn('[audio] Web Audio indisponível (normal em file://), usando <audio> de reserva:', e); });

            visHandler = () => {
                if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
            };
            document.addEventListener('visibilitychange', visHandler);
        }

        // TEM de ser chamada de forma síncrona dentro do handler do gesto
        function unlock() {
            if (!ctx) return Promise.resolve(false);
            const p = ctx.resume();
            // Reserva: um play() mudo dentro do gesto "autoriza" os <audio> a tocarem depois sem novo toque
            pool.forEach(a => {
                try {
                    a.muted = true;
                    const q = a.play();
                    if (q && q.then) q.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
                } catch (e) {}
            });
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
                prewarm();
                const a = pool[poolIdx++ % pool.length];
                a.pause();
                a.muted = false; a.volume = vol; a.playbackRate = rate;
                try { a.currentTime = skip; } catch (e) {}
                a.play().catch(e => console.warn('[audio] <audio> bloqueado:', e.name));
                return true;
            } catch (e) { return false; }
        }

        function play(o) {
            const { vol = 1, rate = 1, skip = 0 } = o;
            if (!ctx) return failed ? playFallback(o) : false;
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
            pool.forEach(a => { try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) {} });
            pool.length = 0;
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

    function measureBrand() {
        const r = brandMask.getBoundingClientRect();
        brandY = r.height ? r.top + r.height / 2 : H * 0.46;
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
        if (leaving || cleaned) return;
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
                // Bloqueado: arranca mudo e espera o toque. Nunca interrompe a apresentação.
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

    function onMeta() {
        dur = isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : VID.defaultDur;
        applyVideoGeometry(0);                 // proporção real do arquivo, sem esticar
    }

    /* Geometria do vídeo: nunca deforma. --A = proporção do arquivo já descontando barras pretas embutidas. */
    let geoDone = false, geoTries = 0, geoAt = 0;
    function applyVideoGeometry(bars) {
        const ar = video.videoWidth / video.videoHeight;
        if (!ar || !isFinite(ar)) return;
        intro.style.setProperty('--bars', bars.toFixed(4));
        intro.style.setProperty('--A', (ar / (1 - 2 * bars)).toFixed(4));
        measureHorizon();
    }
    // Procura faixas pretas idênticas no topo e na base de um frame (só barras "de verdade": brilho máx. ≤ 8)
    function detectBars() {
        if (geoDone || fb || !video.videoWidth) return;
        try {
            const cw = 96, ch = Math.max(8, Math.round(cw * video.videoHeight / video.videoWidth));
            const c = document.createElement('canvas'); c.width = cw; c.height = ch;
            const x = c.getContext('2d', { willReadFrequently: true });
            x.drawImage(video, 0, 0, cw, ch);
            const d = x.getImageData(0, 0, cw, ch).data;
            const dark = r => { let m = 0; for (let i = r * cw * 4, e = i + cw * 4; i < e; i += 4) m = Math.max(m, d[i], d[i + 1], d[i + 2]); return m <= 8; };
            let top = 0; while (top < ch && dark(top)) top++;
            if (top >= ch - 1) return;                       // frame todo preto (início do vídeo): tenta de novo depois
            let bot = 0; while (bot < ch && dark(ch - 1 - bot)) bot++;
            const b = Math.min(top, bot) / ch;
            geoDone = true;
            applyVideoGeometry(b > .03 && b < .4 ? b : 0);
        } catch (e) { geoDone = true; }                       // canvas bloqueado (ex.: file://): fica sem recorte
    }
    function onPlaying() { if (fb) return; vPlaying = true; lastAdv = performance.now(); }
    function onCanPlay() { if (phase === 'VIDEO' && !vPlaying && !fb && video.paused && !video.ended) tryPlay(); }
    function onEnded() { startStorm(performance.now()); }          // idempotente: startStorm só age na fase VIDEO
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
        if (fb || leaving || phase === 'STORM') return;
        fb = true; fbStart = now; vPlaying = false;
        try { video.pause(); } catch (e) {}
        fallbackImg.src = FALLBACK_IMG;
        cls('is-fallback');
        measureHorizon();
    }

    /* ---------- CANVAS / CHUVA ---------- */
    function resizeCanvas() {
        const f = fit(fx, LOW ? 1.5 : 2);
        W = f.w; H = f.h; FDPR = f.dpr;
        smoke.width = Math.max(1, Math.round(W * SMOKE_RES));
        smoke.height = Math.max(1, Math.round(H * SMOKE_RES));
        SW = smoke.width; SS = SW / W;
        measureHorizon();
        measureBrand();
        initParticles();
        initSmoke();
    }

    function onResize() {
        if (resizeQueued) return;
        resizeQueued = true;
        requestAnimationFrame(() => { resizeQueued = false; if (!cleaned) resizeCanvas(); });
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
       RAIOS — canal principal por deslocamento de ponto médio (curvas
       naturais, com desvios grandes e pequenos), ramos que só descem,
       afinamento rumo à ponta e crescimento progressivo (leader) seguido
       do clarão de retorno com cintilação. Brilho aditivo + explosão no chão.
       Geometria relativa a W, H e horizonY (nada de pixels fixos).
       Três estilos: 0 esquerdo, 1 direito (tempestade final) e 2 (meio do vídeo).
       ========================================================== */
    const BOLT_STYLE = [
        { x: [.20, .32], reach: [.70, .84], tilt: [ .02,  .12], disp: .26, forks: 6, wMul: 1.00, gain: .95 },
        { x: [.66, .79], reach: [.76, .90], tilt: [-.14, -.02], disp: .32, forks: 8, wMul: 1.12, gain: 1.0 },
        { x: [.14, .84], reach: [.62, .78], tilt: [-.10,  .10], disp: .30, forks: 7, wMul: .92,  gain: .85 }
    ];

    function createBolt(si, xFrac) {
        const P = BOLT_STYLE[si], r = Math.random, rr = (a, b) => a + (b - a) * r();
        const segs = [], maxSeg = LOW ? 420 : 760;
        let maxD = 0;
        const w0 = Math.max(2.8, Math.min(W, H) * .0055) * P.wMul;                 // tronco grande também no celular
        const x0 = W * (xFrac != null ? xFrac : rr(P.x[0], P.x[1])), y0 = -H * .03;
        const len = Math.min(H * .92, Math.max(H * rr(P.reach[0], P.reach[1]), horizonY * .95));
        const ang = Math.PI / 2 + rr(P.tilt[0], P.tilt[1]);
        const ex = x0 + Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len;
        const minLen = Math.max(7, Math.min(14, H / 75));

        // Subdivide a reta A→B deslocando cada ponto médio na perpendicular (proporcional ao trecho)
        function channel(ax, ay, bx, by, rough) {
            let pts = [[ax, ay], [bx, by]], again = true;
            while (again) {
                again = false;
                const nx = [pts[0]];
                for (let k = 0; k < pts.length - 1; k++) {
                    const p = pts[k], q = pts[k + 1], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
                    if (L > minLen) {
                        again = true;
                        const off = (r() - .5) * L * rough;
                        nx.push([(p[0] + q[0]) / 2 - dy / L * off, (p[1] + q[1]) / 2 + dx / L * off]);
                    }
                    nx.push(q);
                }
                pts = nx;
            }
            return pts;
        }

        // segs: [x1,y1,x2,y2,largura,distância acumulada desde o céu] — a distância comanda o crescimento
        function addPath(pts, w, dStart, depth) {
            const cum = [dStart];
            for (let k = 0; k < pts.length - 1; k++) {
                const p = pts[k], q = pts[k + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
                segs.push([p[0], p[1], q[0], q[1], w * (1 - .55 * k / (pts.length - 1)), cum[k]]);
                cum.push(cum[k] + L);
            }
            maxD = Math.max(maxD, cum[cum.length - 1]);
            if (depth < 2 && pts.length > 8) {
                const nf = depth === 0 ? P.forks : Math.max(1, Math.round(P.forks * .3));
                for (let f = 0; f < nf && segs.length < maxSeg; f++) {
                    const k = 2 + Math.floor(r() * (pts.length - 5));
                    const p = pts[k], q = pts[k + 1], base = Math.atan2(q[1] - p[1], q[0] - p[0]);
                    const a2 = base + (r() < .5 ? -1 : 1) * rr(.3, .8);
                    if (Math.sin(a2) < .05) continue;                                   // ramos não sobem
                    const Lb = len * (depth === 0 ? rr(.08, .26) : rr(.04, .11)) * (1 - k / pts.length * .5);
                    addPath(channel(p[0], p[1], p[0] + Math.cos(a2) * Lb, p[1] + Math.sin(a2) * Lb, P.disp * 1.15),
                            w * (depth ? .5 : .55), cum[k], depth + 1);
                }
            }
        }

        addPath(channel(x0, y0, ex, ey, P.disp), w0, 0, 0);
        return { segs, maxD, x0, ex, ey };
    }

    // Agrupa os segmentos por espessura em Path2D (poucos strokes por frame). upTo = alcance do crescimento.
    function buildPaths(segs, upTo) {
        const bk = new Map();
        for (const s of segs) {
            if (s[5] > upTo) continue;
            const k = Math.max(.5, Math.round(s[4] * 4) / 4);
            let p = bk.get(k);
            if (!p) { p = new Path2D(); bk.set(k, p); }
            p.moveTo(s[0], s[1]); p.lineTo(s[2], s[3]);
        }
        return [...bk];
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

    // micro camera-shake (~100–180 ms), discreto; quase nulo em prefers-reduced-motion
    function kick(a) {
        shakeAmp = a * (REDUCED ? .12 : MOBILE ? .55 : 1); shakeT = clock;
    }

    function spawnBolt(si, xFrac) {
        const b = createBolt(si, xFrac);
        bolts.push({ segs: b.segs, maxD: b.maxD, paths: null, t0: clock, e: 0, ve: 0,
                     gain: BOLT_STYLE[si].gain * FLASH_GAIN, ex: b.ex, ey: b.ey, seed: Math.random() * 100 });
        return (((b.x0 - filmL) / filmW) * 100).toFixed(1) + '%';      // posição do raio p/ a luz CSS
    }

    function planThunder(list) {
        for (const t of list) thPlan.push({ at: clock + t.delay, vol: t.vol, rate: t.rate, skip: t.skip, done: false });
    }

    // Tempestade final: exatamente dois raios quase simultâneos
    function strike(i) {
        if (fired[i] || (i === 1 && !fired[0])) return;
        fired[i] = true; strikes++;
        intro.style.setProperty(i ? '--bx2' : '--bx1', spawnBolt(i));
        boltEnd = Math.max(boltEnd, clock + FLASH_MS + GROW_MS);
        kick(i ? 1.6 : 2.2);
        if (i === 0) { console.info('[thunder] raio! estado do áudio:', AudioEngine.status()); planThunder(THUNDER); }
    }

    // Raio do meio do vídeo (uma vez): longe do carro, ilumina a cena e o trovão chega um pouco depois
    function strikeMid() {
        if (midDone) return;
        midDone = true;
        const xf = Math.random() < .5 ? .14 + Math.random() * .16 : .70 + Math.random() * .16;
        const px = spawnBolt(2, xf);
        intro.style.setProperty('--bx1', px); intro.style.setProperty('--bx2', px);
        kick(1.4);
        planThunder([{ delay: 220, vol: .62, rate: .94, skip: THUNDER[0].skip }]);
    }

    function updateFlash(now) {
        curFlash = 0;
        for (let i = bolts.length - 1; i >= 0; i--) {
            const b = bolts[i], s = now - b.t0;
            if (s > FLASH_MS + GROW_MS) { bolts.splice(i, 1); continue; }
            const s2 = Math.max(0, s - GROW_MS * .8);                   // o clarão principal vem quando o raio "toca o chão"
            b.e = flashEnv(s2) * b.gain;
            const flk = s2 < 420 ? .8 + .2 * Math.abs(Math.sin(s2 * .19 + b.seed) * Math.cos(s2 * .07)) : 1;   // cintilação
            const lead = s < GROW_MS * .8 ? .6 * b.gain : 0;            // canal já visível durante a descida
            b.ve = Math.max(lead, b.e * (s2 < 330 ? 1 : Math.exp(-(s2 - 330) / 110))) * flk;
            if (b.e > curFlash) curFlash = b.e;
        }
        const str = curFlash.toFixed(3);
        if (str !== lastFlashStr) { lastFlashStr = str; intro.style.setProperty('--flash', str); }
    }

    // 5 camadas aditivas: halo largo → halo → glow branco-frio → núcleo → núcleo interno (branco puro)
    const PASSES = [
        { k: 16, a: .05, blur: 110, c: '176,192,226' },
        { k: 7,  a: .10, blur: 70,  c: '186,202,232' },
        { k: 3,  a: .28, blur: 32,  c: '214,226,246' },
        { k: 1,  a: .92, blur: 12,  c: '244,248,255' },
        { k: .4, a: 1,   blur: 3,   c: '255,255,255' }
    ];
    const BLUR_K = LOW ? .6 : 1;

    function drawBolts(now) {
        fctx.globalCompositeOperation = 'lighter';
        fctx.lineCap = 'round'; fctx.lineJoin = 'round';
        fctx.shadowColor = 'rgba(200,215,245,.85)';
        for (const b of bolts) {
            if (b.ve < .01) continue;
            const g = clamp((now - b.t0) / GROW_MS, 0, 1);
            let paths;
            if (g >= 1) { if (!b.paths) b.paths = buildPaths(b.segs, Infinity); paths = b.paths; }
            else paths = buildPaths(b.segs, b.maxD * (1 - Math.pow(1 - g, 2)));   // desce rápido do céu ao chão
            const al = Math.min(1, b.ve);
            for (const ps of PASSES) {
                fctx.shadowBlur = ps.blur * FDPR * BLUR_K;
                fctx.strokeStyle = `rgba(${ps.c},${(ps.a * al).toFixed(3)})`;
                for (const [k, path] of paths) {
                    fctx.lineWidth = Math.max(.5, k * ps.k);
                    fctx.stroke(path);
                }
            }
            if (g >= 1) {                                              // explosão de luz no ponto de contato
                fctx.shadowBlur = 0;
                const rad = Math.min(W, H) * .1, gr = fctx.createRadialGradient(b.ex, b.ey, 0, b.ex, b.ey, rad);
                gr.addColorStop(0, `rgba(255,255,255,${(.55 * al).toFixed(3)})`);
                gr.addColorStop(.4, `rgba(214,226,246,${(.18 * al).toFixed(3)})`);
                gr.addColorStop(1, 'rgba(214,226,246,0)');
                fctx.fillStyle = gr;
                fctx.fillRect(b.ex - rad, b.ey - rad, rad * 2, rad * 2);
            }
        }
        fctx.shadowBlur = 0;
        fctx.globalCompositeOperation = 'source-over';
    }

    function renderFx(now, dt) {
        updateFlash(now);
        fxAlpha += (fxTarget - fxAlpha) * Math.min(1, dt * 2.5);
        const s = shakeAmp * Math.exp(-(now - shakeT) / 45);      // ~150–180 ms até sumir
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
        drawBolts(now);
        fxDrawn = true;
    }

    /* ==========================================================
       FUMAÇA — puffs com textura de ruído fractal (fBm) gerada uma vez,
       iluminados de cima, com bounce avermelhado embaixo. Camadas de
       profundidade (fundo escuro → frente clara), esticados na horizontal,
       flutuando devagar. Canvas em meia resolução. Poucos elementos
       (9 / 22 / 42) e adaptativo. Relâmpagos internos iluminam só a
       fumaça (source-atop). Tudo relativo a W/H.
       ========================================================== */
    function fbm(R, oct) {
        const out = new Float32Array(R * R);
        let amp = .5, tot = 0;
        for (let o = 0; o < oct; o++) {
            const n = 3 << o, lat = new Float32Array((n + 1) * (n + 1));
            for (let i = 0; i < lat.length; i++) lat[i] = Math.random();
            for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
                const u = x / R * n, v = y / R * n, i = u | 0, k = v | 0, fx = u - i, fy = v - k;
                const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
                const a = lat[k * (n + 1) + i], b = lat[k * (n + 1) + i + 1];
                const c = lat[(k + 1) * (n + 1) + i], d = lat[(k + 1) * (n + 1) + i + 1];
                out[y * R + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
            }
            tot += amp; amp *= .5;
        }
        for (let i = 0; i < out.length; i++) out[i] /= tot;
        return out;
    }

    function makeSmokeSprites() {
        sprites.length = 0;
        const R = LOW ? 128 : 176, oct = LOW ? 4 : 5, bright = [.6, .82, 1];
        for (let layer = 0; layer < 3; layer++) for (let k = 0; k < 3; k++) {
            const f = fbm(R, oct), c = document.createElement('canvas');
            c.width = c.height = R;
            const g = c.getContext('2d'), img = g.createImageData(R, R), d = img.data, bs = bright[layer];
            for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
                const nx = (x + .5) / R * 2 - 1, ny = (y + .5) / R * 2 - 1, rad = Math.hypot(nx, ny);
                const t = clamp((rad - .45) / .55, 0, 1), fall = 1 - t * t * (3 - 2 * t);      // borda que se desfaz
                const n = f[y * R + x], nn = clamp((n - .5) * 2.2 + .5, 0, 1);                   // contraste do ruído
                const a = clamp((nn * fall - .2) * 2.2, 0, 1) * .62;
                const lit = clamp(.5 - ny * .35 + (n - .5) * .9, 0, 1);                         // luz vinda de cima
                const bounce = clamp(ny, 0, 1) * 26;                                            // reflexo quente embaixo
                const i = (y * R + x) * 4;
                d[i]     = Math.min(255, ((40 + 120 * lit) * bs) + bounce * bs);
                d[i + 1] = (46 + 120 * lit) * bs;
                d[i + 2] = (60 + 122 * lit) * bs;
                d[i + 3] = a * 255;
            }
            g.putImageData(img, 0, 0);
            sprites.push(c);
        }
        // brilho suave usado nos relâmpagos internos
        glowSpr = document.createElement('canvas'); glowSpr.width = glowSpr.height = 64;
        const gx = glowSpr.getContext('2d'), gr = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(232,238,250,1)'); gr.addColorStop(.5, 'rgba(210,220,240,.35)'); gr.addColorStop(1, 'rgba(210,220,240,0)');
        gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
    }

    function initSmoke() {
        puffs.length = 0;
        if (!sprites.length) return;
        const r = Math.random, cx = W / 2, base = Math.max(W, H * 1.1);
        for (let i = 0; i < SMOKE_N; i++) {
            const layer = i % 3;                                            // 0 fundo · 1 meio · 2 frente
            const gs = (r() + r() + r() - 1.5) / 1.5;                       // -1..1, concentrado no centro
            const tx = cx + gs * W * .55;
            const ty = H * (layer === 0 ? .34 + r() * .34 : layer === 1 ? .44 + r() * .42 : .60 + r() * .42);
            const d0 = Math.min(1, Math.abs(tx - cx) / (W * .55));
            puffs.push({
                tx, ty, dir: tx >= cx ? 1 : -1,
                sz: base * (.26 + r() * .24) * (layer === 2 ? 1.15 : layer === 0 ? .9 : 1),
                sx: 1.1 + r() * .6,                                         // espalha na horizontal
                a: (layer === 0 ? .30 : layer === 1 ? .36 : .42) * (.75 + r() * .5),
                birth: (d0 * .5 + r() * .3) * SMK.grow,                     // nasce do centro para as bordas
                gdur: SMK.grow * .55,
                spr: sprites[layer * 3 + ((i / 3 | 0) % 3)],
                ph1: r() * 6.283, ph2: r() * 6.283,
                f1: .18 + r() * .22, f2: .14 + r() * .2,
                ax: W * (.03 + r() * .04), ay: H * (.012 + r() * .02),
                rot0: (r() - .5) * .7, rs: (r() - .5) * .07                 // rotação mínima: a luz de cima continua "em cima"
            });
        }
        activeN = puffs.length;
    }

    function startSmoke(now) {
        if (smokeOn) return;
        smokeOn = true; smokeT0 = now; flickAt = now + 1300;
        measureBrand(); initSmoke();
        setState('SMOKE');
    }

    // Dirige a marca (variáveis CSS em .brand) a partir do relógio da fumaça
    function driveBrand(st) {
        const rv = easeIO(clamp((st - SMK.rvStart) / SMK.rvDur, 0, 1));
        const g0 = smooth(clamp((st - SMK.glint) / (SMK.rvStart - SMK.glint + 500), 0, 1));
        const gl = g0 * (1 - rv);
        const sh = smooth(clamp((st - (SMK.rvStart + SMK.rvDur - 400)) / 1400, 0, 1));   // reflexo que varre as letras
        rvCur = rv;
        const key = rv.toFixed(3) + '|' + gl.toFixed(3) + '|' + sh.toFixed(3);
        if (key !== lastBrandKey) {
            lastBrandKey = key;
            brandEl.style.setProperty('--rv', rv.toFixed(3));
            brandEl.style.setProperty('--gl', gl.toFixed(3));
            brandEl.style.setProperty('--sh', sh.toFixed(3));
        }
    }

    function renderSmoke(now, dt) {
        if (!smokeOn) return;
        const st = now - smokeT0, sec = st / 1000;
        driveBrand(st);

        // qualidade adaptativa: engasgou por ~25 frames → tira 25% dos puffs
        if (dt > .034) slow++; else if (slow > 0) slow--;
        if (slow > 25 && activeN > Math.ceil(SMOKE_N * .45)) { activeN = Math.floor(activeN * .75); slow = 0; }

        const cx = W / 2, cy = brandY || H * .46, open = rvCur;
        sctx.globalCompositeOperation = 'source-over';
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.clearRect(0, 0, smoke.width, smoke.height);

        for (let i = 0; i < activeN; i++) {
            const p = puffs[i];
            const gp = clamp((st - p.birth) / p.gdur, 0, 1);
            if (gp <= 0) continue;
            const e = easeOut(gp), ae = smooth(gp);

            // entra pelo centro/parte baixa e se espalha; depois só flutua devagar
            const ox = cx + (p.tx - cx) * .2, oy = p.ty + H * .1;
            let x = ox + (p.tx - ox) * e + Math.sin(sec * p.f1 + p.ph1) * p.ax * MOVE;
            const y = oy + (p.ty - oy) * e + Math.cos(sec * p.f2 + p.ph2) * p.ay * MOVE;

            // a fumaça "se afasta" do centro quando a marca é revelada
            const dx = (x - cx) / (W * .42), dy = (y - cy) / (H * .3);
            const d = Math.min(1, Math.hypot(dx, dy)), k = d * d * (3 - 2 * d);
            x += p.dir * open * W * .09 * (1 - k);
            const alpha = p.a * ae * (1 - open * .88 * (1 - k));
            if (alpha < .004) continue;

            const size = p.sz * (.4 + .6 * e);
            const ang = p.rot0 + sec * p.rs * MOVE, cs = Math.cos(ang), sn = Math.sin(ang);
            sctx.globalAlpha = alpha;
            sctx.setTransform(cs * p.sx * SS, sn * p.sx * SS, -sn * SS, cs * SS, x * SS, y * SS);
            sctx.drawImage(p.spr, -size / 2, -size / 2, size, size);
        }

        // relâmpagos internos: um clarão suave que ilumina SÓ a fumaça (source-atop), a cada ~1–3 s
        if (!REDUCED && glowSpr) {
            if (!flick && now >= flickAt) {
                flickAt = now + 900 + Math.random() * 1800;
                flick = { x: W * (.15 + Math.random() * .7), y: H * (.45 + Math.random() * .4), t0: now,
                          dur: 140 + Math.random() * 120, r: W * (.25 + Math.random() * .25), a: .16 + Math.random() * .14 };
            }
            if (flick) {
                const u = (now - flick.t0) / flick.dur;
                if (u >= 1) flick = null;
                else {
                    sctx.globalCompositeOperation = 'source-atop';
                    sctx.globalAlpha = flick.a * Math.sin(u * Math.PI);
                    sctx.setTransform(SS, 0, 0, SS * .7, flick.x * SS, flick.y * SS);
                    sctx.drawImage(glowSpr, -flick.r, -flick.r, flick.r * 2, flick.r * 2);
                }
            }
        }
        sctx.globalCompositeOperation = 'source-over';
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.globalAlpha = 1;
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
    // 1) Relógio de parede (antes/durante o vídeo)
    const WALL_EV = [
        [WALL.glow,   () => cls('is-glow')],
        [WALL.play,   () => { phase = 'VIDEO'; if (REDUCED) useFallback(clock); else tryPlay(); }],
        [WALL.reveal, () => { cls('is-scene'); setState('SCENE_REVEAL'); }]
    ];
    if (!REDUCED) WALL_EV.push([WALL.kicker, () => { cls('is-kicker'); fxTarget = 1; }]);

    // 2) Tempestade (relativa ao fim do vídeo). O último evento espera o clarão realmente acabar.
    const smokeGate = now => strikes === 2 && now >= boltEnd - 200;
    const STORM_EV = [
        [STORM.strike,               () => strike(0)],
        [STORM.strike + BOLT2_DELAY, () => strike(1)],
        [STORM.strike + 150,         () => kick(1.0)],                        // impacto do 2º pulso
        [0, () => { cls('is-dark'); fxTarget = 0; startSmoke(clock); }, smokeGate]
    ];

    // 3) Fumaça → marca → pausa → saída (relativa ao início da fumaça)
    const SMOKE_EV = [
        [SMK.glint,               () => setState('BRAND_REVEAL')],
        [SMK.rvStart,             () => cls('is-brand-line')],
        [SMK.sub,                 () => cls('is-sub')],
        [SMK.rvStart + SMK.rvDur, () => cls('is-brand')],
        [SMK.out,                 () => leave(false)]
    ];

    function startStorm(now) {
        if (phase !== 'VIDEO' || leaving) return;          // garante execução ÚNICA
        phase = 'STORM'; stormT0 = now;
        try { video.pause(); } catch (e) {}
        setState('STORM'); cls('is-fade'); cls('is-storm'); cls('is-kicker-out');
    }

    function runVideo(now, t) {
        if (!fb && !vPlaying) { if (t > VID.startTimeout) useFallback(now); return; }
        const vt = fb ? now - fbStart : video.currentTime * 1000;
        if (!midDone && vt >= dur * MID_AT) strikeMid();
        if (!geoDone && !fb && now - geoAt > 250) {
            geoAt = now; detectBars();
            if (++geoTries > 12) geoDone = true;
        }
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
            if (leaving) return;
        }
        if (smokeOn) {
            const s = now - smokeT0;
            while (nextSmoke < SMOKE_EV.length && s >= SMOKE_EV[nextSmoke][0]) {
                SMOKE_EV[nextSmoke++][1]();
                if (leaving) return;
            }
        }
    }

    /* ---------- LOOP PRINCIPAL ---------- */
    function frame(now) {
        if (cleaned) return;
        raf = requestAnimationFrame(frame);
        if (t0 === null) { t0 = now; last = now; }
        clock = now;
        const t = now - t0, dt = Math.min(.05, (now - last) / 1000);
        last = now;

        if (!leaving) {
            while (nextWall < WALL_EV.length && t >= WALL_EV[nextWall][0]) WALL_EV[nextWall++][1]();
            if (!leaving) {
                if (phase === 'VIDEO') runVideo(now, t);
                else if (phase === 'STORM') runStorm(now);
            }
        }
        // Continua desenhando durante o fade final: a fumaça segue se movendo até o preto
        tickVolume(dt);
        if (thPlan.length) runThunder(now);
        renderFx(now, dt);
        renderSmoke(now, dt);
    }

    /* ---------- SAÍDA / LIMPEZA ---------- */
    function skipIntro() { leave(true); }

    // Ponto ÚNICO de saída (fim natural ou PULAR INTRO): inicia o fade para preto
    function leave(fast) {
        if (leaving) return;
        leaving = true;
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
        parts.length = 0; bolts.length = 0; puffs.length = 0; sprites.length = 0; glowSpr = null; flick = null;
        thPlan = [];
        try {
            fctx.clearRect(0, 0, fx.width, fx.height);
            sctx.clearRect(0, 0, smoke.width, smoke.height);
        } catch (e) {}
    }

    /* ---------- INIT ---------- */
    function initIntro() {
        makeSmokeSprites();
        resizeCanvas();
        makeGrain();
        window.addEventListener('resize', onResize);
        btn.addEventListener('click', skipIntro);
        attachGestures();     // desbloqueador invisível no ecrã inteiro

        if (REDUCED) disposeVideo();     // sem vídeo: usa a imagem estática (ver WALL_EV)
        else bindVideo();
        initAudio();
        raf = requestAnimationFrame(frame);

        function skipIntro() { 
    leave(true); // O parâmetro 'true' acelera o processo e o fade para pular instantaneamente
}

function leave(fast) {
    if (leaving) return;
    leaving = true;
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
    location.replace(DESTINO); // Envia imediatamente para o index.html na mesma pasta
}
    }

    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise(r => setTimeout(r, 700))]).then(initIntro);


})();