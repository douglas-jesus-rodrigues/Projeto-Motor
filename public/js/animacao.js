document.addEventListener("DOMContentLoaded", () => {
    const introOverlay = document.getElementById("introOverlay");
    const btnPular = document.getElementById("btnPular");
    const lightningFlash = document.getElementById("lightning");
    const canvas = document.getElementById("lightningCanvas");
    const ctx = canvas ? canvas.getContext("2d") : null;

    // Redimensionar Canvas
    function redimensionarCanvas() {
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
    }
    redimensionarCanvas();
    window.addEventListener("resize", redimensionarCanvas);

    // Efeito dos Raios Trovão
    function desenharRaio(x1, y1, x2, y2) {
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(x1, y1);

        let curX = x1;
        let curY = y1;
        const passos = 12;

        for (let i = 0; i < passos; i++) {
            const nextY = curY + (y2 - y1) / passos;
            const nextX = curX + (Math.random() - 0.5) * 45;
            ctx.lineTo(nextX, nextY);
            curX = nextX;
            curY = nextY;
        }

        ctx.strokeStyle = Math.random() > 0.5 ? "#e50914" : "#00d2ff";
        ctx.lineWidth = Math.random() * 3.5 + 1.5;
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 18;
        ctx.stroke();
    }

    function dispararTrovao() {
        if (!lightningFlash || !ctx) return;
        lightningFlash.classList.add("flash-active");
        setTimeout(() => lightningFlash.classList.remove("flash-active"), 300);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const startX = Math.random() * canvas.width;
        desenharRaio(startX, 0, startX + (Math.random() - 0.5) * 220, canvas.height * 0.65);

        setTimeout(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 160);
    }

    const lightningInterval = setInterval(() => {
        if (Math.random() > 0.35) {
            dispararTrovao();
        }
    }, 1600);

    // TEMPO DA ANIMAÇÃO (12s) + ESPERA (2s) -> TOTAL 14s
    const TEMPO_ANIMACAO = 12000;
    const PAUSA_FINAL = 2000;
    const TEMPO_TOTAL = TEMPO_ANIMACAO + PAUSA_FINAL;

    const timerRedirecionamento = setTimeout(() => {
        irParaIndex();
    }, TEMPO_TOTAL);

    function irParaIndex() {
        clearInterval(lightningInterval);
        clearTimeout(timerRedirecionamento);

        if (introOverlay) {
            introOverlay.classList.add("saindo");
        }

        setTimeout(() => {
            window.location.href = "../index.html";
        }, 800);
    }

    btnPular?.addEventListener("click", () => {
        irParaIndex();
    });
});