(() => {
  // 8 imagens = 8 pares = 16 cartas.
  const SIMBOLOS = [
    { tipo: "img", valor: "imagens/davy-jones.gif" },
    { tipo: "img", valor: "imagens/serjao-berranteiro.gif" },
    { tipo: "img", valor: "imagens/sanduiche-sanduiche-iche.gif" },
    { tipo: "img", valor: "imagens/chico-buarque-.jpg" },
    { tipo: "img", valor: "imagens/monica-ata.gif" },
    { tipo: "img", valor: "imagens/lasier-martins.gif" },
    { tipo: "img", valor: "imagens/nazare-confusa.gif" },
    { tipo: "img", valor: "imagens/o-melhor-meme-do-mundo-é-o-trollface.gif" }
  ];

  const TEMPO_GIRO = 550;            // ms, igual a --tempo-giro no CSS
  const TEMPO_MOSTRAR_ERRO = 1000;   // ms que as cartas ficam à vista após virar
  const TOTAL_PARES = SIMBOLOS.length;
  const MOVIMENTO_REDUZIDO = window.matchMedia("(prefers-reduced-motion: reduce)");

  const tabuleiro = document.getElementById("tabuleiro");
  const msgVez = document.getElementById("mensagem-vez");
  const dica = document.getElementById("dica");
  const resultado = document.getElementById("resultado");
  const msgResultado = document.getElementById("mensagem-resultado");
  const btnReiniciar = document.getElementById("btn-reiniciar");
  const btnSom = document.getElementById("btn-som");
  const confete = document.getElementById("confete");
  const placar = {
    1: { caixa: document.getElementById("placar-1"), pontos: document.getElementById("pontos-1") },
    2: { caixa: document.getElementById("placar-2"), pontos: document.getElementById("pontos-2") }
  };

  let pontos, jogadorAtual, primeira, segunda, bloqueado, paresEncontrados, timers = [];

  /* ---------- Utilidades ---------- */

  // Timeouts rastreados, para cancelar tudo se o jogador reiniciar no meio de uma animação
  function agendar(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function cancelarTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  // Pré-carrega as imagens para a carta não "piscar" ao virar
  SIMBOLOS.forEach(s => {
    if (s.tipo === "img") { const img = new Image(); img.src = s.valor; }
  });

  // Fisher-Yates
  function embaralhar(lista) {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- Som (Web Audio, sem arquivos externos) ---------- */

  let somLigado = true;
  try { somLigado = localStorage.getItem("memoria-som") !== "off"; } catch (e) {}
  let ctxAudio = null;

  function atualizarBotaoSom() {
    btnSom.textContent = somLigado ? "🔊" : "🔇";
    btnSom.setAttribute("aria-pressed", String(somLigado));
    btnSom.setAttribute("aria-label", somLigado ? "Desligar som" : "Ligar som");
  }

  function tocar(notas) {
    if (!somLigado) return;
    try {
      ctxAudio = ctxAudio || new (window.AudioContext || window.webkitAudioContext)();
      if (ctxAudio.state === "suspended") ctxAudio.resume();
      const agora = ctxAudio.currentTime;
      notas.forEach(({ f, t = 0, d = 0.12, tipo = "sine", v = 0.15 }) => {
        const osc = ctxAudio.createOscillator();
        const ganho = ctxAudio.createGain();
        osc.type = tipo;
        osc.frequency.value = f;
        ganho.gain.setValueAtTime(0.0001, agora + t);
        ganho.gain.exponentialRampToValueAtTime(v, agora + t + 0.015);
        ganho.gain.exponentialRampToValueAtTime(0.0001, agora + t + d);
        osc.connect(ganho).connect(ctxAudio.destination);
        osc.start(agora + t);
        osc.stop(agora + t + d + 0.05);
      });
    } catch (e) { /* som é opcional */ }
  }

  const SONS = {
    virar:  () => tocar([{ f: 520, d: 0.08, tipo: "triangle", v: 0.1 }]),
    acerto: () => tocar([{ f: 660, d: 0.14 }, { f: 880, t: 0.1, d: 0.2 }]),
    erro:   () => tocar([{ f: 200, d: 0.22, tipo: "sawtooth", v: 0.08 }, { f: 150, t: 0.12, d: 0.25, tipo: "sawtooth", v: 0.08 }]),
    vitoria: () => tocar([523, 659, 784, 1047].map((f, i) => ({ f, t: i * 0.13, d: 0.3 }))),
    empate: () => tocar([{ f: 440, d: 0.2 }, { f: 440, t: 0.22, d: 0.3 }]),
    distribuir: () => tocar([{ f: 330, d: 0.1, tipo: "triangle", v: 0.08 }])
  };

  btnSom.addEventListener("click", () => {
    somLigado = !somLigado;
    try { localStorage.setItem("memoria-som", somLigado ? "on" : "off"); } catch (e) {}
    atualizarBotaoSom();
    if (somLigado) SONS.acerto();
  });
  atualizarBotaoSom();

  /* ---------- Criação do tabuleiro ---------- */

  function criarCarta(simbolo, indice) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "carta entrando";
    btn.dataset.id = SIMBOLOS.indexOf(simbolo);
    btn.style.setProperty("--i", indice);
    btn.setAttribute("aria-label", "Carta virada para baixo");

    const interior = document.createElement("div");
    interior.className = "carta-interior";

    const verso = document.createElement("div");
    verso.className = "face verso";
    verso.textContent = "?";

    const frente = document.createElement("div");
    frente.className = "face frente";
    if (simbolo.tipo === "img") {
      const img = document.createElement("img");
      img.src = simbolo.valor;
      img.alt = "";
      img.draggable = false;
      frente.appendChild(img);
    } else {
      frente.textContent = simbolo.valor;
    }

    interior.append(verso, frente);
    btn.appendChild(interior);
    btn.addEventListener("click", () => virarCarta(btn));
    btn.addEventListener("animationend", e => {
      if (e.animationName === "distribuir") btn.classList.remove("entrando");
    });
    return btn;
  }

  /* ---------- Interface ---------- */

  function atualizarVez(animar = true) {
    msgVez.textContent = `Vez do Jogador ${jogadorAtual}`;
    msgVez.className = `vez j${jogadorAtual}`;
    if (animar) {
      void msgVez.offsetWidth; // reinicia a animação
      msgVez.classList.add("troca");
    }
    [1, 2].forEach(n => placar[n].caixa.classList.toggle("ativo", n === jogadorAtual));
  }

  function mostrarDica(texto) {
    dica.textContent = texto;
    dica.classList.toggle("visivel", Boolean(texto));
  }

  function atualizarPontos(n) {
    const el = placar[n].pontos;
    el.textContent = pontos[n];
    el.classList.remove("subiu");
    void el.offsetWidth;
    el.classList.add("subiu");
  }

  // "+1" que sobe a partir das cartas encontradas
  function mostrarMaisUm(carta) {
    if (MOVIMENTO_REDUZIDO.matches) return;
    const r = carta.getBoundingClientRect();
    const el = document.createElement("span");
    el.className = `mais-um j${jogadorAtual}`;
    el.textContent = "+1";
    el.style.left = `${r.left + r.width / 2}px`;
    el.style.top = `${r.top + r.height / 2}px`;
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  function lancarConfete(corPrincipal) {
    if (MOVIMENTO_REDUZIDO.matches) return;
    const cores = [corPrincipal, "#fff6e5", "#ff7b3d", "#3ddbd9", "#ffd23f", "#ff5d73"];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 90; i++) {
      const p = document.createElement("i");
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = cores[Math.floor(Math.random() * cores.length)];
      p.style.setProperty("--dur", `${2.2 + Math.random() * 2}s`);
      p.style.setProperty("--atraso", `${Math.random() * 0.9}s`);
      p.style.setProperty("--deriva", `${(Math.random() - 0.5) * 240}px`);
      p.style.setProperty("--giro", `${360 + Math.random() * 720}deg`);
      frag.appendChild(p);
    }
    confete.appendChild(frag);
    agendar(() => confete.replaceChildren(), 5200);
  }

  /* ---------- Fluxo do jogo ---------- */

  function iniciarPartida() {
    cancelarTimers();
    confete.replaceChildren();
    document.querySelectorAll(".mais-um").forEach(el => el.remove());

    pontos = { 1: 0, 2: 0 };
    jogadorAtual = 1;
    primeira = segunda = null;
    paresEncontrados = 0;
    bloqueado = true; // liberado quando a distribuição termina

    placar[1].pontos.textContent = 0;
    placar[2].pontos.textContent = 0;
    [1, 2].forEach(n => placar[n].caixa.classList.remove("vencedor"));
    resultado.hidden = true;
    mostrarDica("");

    const baralho = embaralhar([...SIMBOLOS, ...SIMBOLOS]);
    tabuleiro.replaceChildren(...baralho.map(criarCarta));
    atualizarVez();

    SONS.distribuir();
    const duracao = MOVIMENTO_REDUZIDO.matches ? 0 : baralho.length * 45 + 550;
    agendar(() => { bloqueado = false; }, duracao);
  }

  function virarCarta(carta) {
    if (bloqueado || carta.classList.contains("virada")) return;

    carta.classList.add("virada");
    carta.setAttribute("aria-label", "Carta virada para cima");
    SONS.virar();
    mostrarDica("");

    if (!primeira) {
      primeira = carta;
      return;
    }

    segunda = carta;
    bloqueado = true;

    if (primeira.dataset.id === segunda.dataset.id) {
      agendar(acerto, TEMPO_GIRO - 100);
    } else {
      // espera o giro terminar, balança as cartas e depois as desvira
      agendar(() => {
        [primeira, segunda].forEach(c => c.classList.add("errada"));
        SONS.erro();
      }, TEMPO_GIRO);
      agendar(erro, TEMPO_GIRO + TEMPO_MOSTRAR_ERRO);
    }
  }

  function acerto() {
    const cartas = [primeira, segunda];
    cartas.forEach(c => {
      c.classList.add("encontrada", `j${jogadorAtual}`);
      c.disabled = true;
      c.setAttribute("aria-label", `Par encontrado pelo Jogador ${jogadorAtual}`);
    });
    SONS.acerto();
    mostrarMaisUm(segunda);
    pontos[jogadorAtual]++;
    atualizarPontos(jogadorAtual);
    paresEncontrados++;
    primeira = segunda = null;

    if (paresEncontrados === TOTAL_PARES) {
      agendar(fimDeJogo, 900);
    } else {
      mostrarDica("Acertou! Jogue de novo.");
      bloqueado = false;
      focarProximaCarta(cartas[1]);
    }
  }

  function erro() {
    [primeira, segunda].forEach(c => {
      c.classList.remove("errada", "virada");
      c.setAttribute("aria-label", "Carta virada para baixo");
    });
    const ultima = segunda;
    primeira = segunda = null;
    jogadorAtual = jogadorAtual === 1 ? 2 : 1;
    atualizarVez();
    mostrarDica("Não deu! A vez passou.");
    bloqueado = false;
    if (document.activeElement === ultima) ultima.focus();
  }

  function fimDeJogo() {
    const p1 = pontos[1], p2 = pontos[2];
    let texto, vencedor = 0;
    if (p1 > p2) { texto = `Jogador 1 venceu! (${p1} × ${p2})`; vencedor = 1; }
    else if (p2 > p1) { texto = `Jogador 2 venceu! (${p2} × ${p1})`; vencedor = 2; }
    else texto = `Empate! (${p1} × ${p2})`;

    msgResultado.textContent = texto;
    msgVez.textContent = "Fim da partida";
    msgVez.className = "vez troca";
    mostrarDica("");
    [1, 2].forEach(n => placar[n].caixa.classList.remove("ativo"));
    resultado.hidden = false;

    if (vencedor) {
      placar[vencedor].caixa.classList.add("vencedor");
      lancarConfete(vencedor === 1 ? "#ffd23f" : "#3ddbd9");
      SONS.vitoria();
    } else {
      SONS.empate();
    }
    btnReiniciar.focus({ preventScroll: true });
  }

  /* ---------- Teclado: setas movem o foco entre as cartas ---------- */

  function focarProximaCarta(atual) {
    // depois de um acerto, devolve o foco a uma carta ainda disponível
    if (document.activeElement !== atual) return;
    const livre = [...tabuleiro.children].find(c => !c.disabled && !c.classList.contains("virada"));
    if (livre) livre.focus();
  }

  tabuleiro.addEventListener("keydown", e => {
    const passos = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 };
    if (!(e.key in passos)) return;
    const cartas = [...tabuleiro.children];
    const i = cartas.indexOf(document.activeElement);
    if (i < 0) return;
    const alvo = cartas[i + passos[e.key]];
    if (alvo) { e.preventDefault(); alvo.focus(); }
  });

  btnReiniciar.addEventListener("click", iniciarPartida);
  iniciarPartida();
})();
