(() => {
  // 8 símbolos = 8 pares = 16 cartas.
  // Para trocar o 8º símbolo por uma imagem, use: { tipo: "img", valor: "imagens/arquivo.gif" }
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

  const TEMPO_MOSTRAR_ERRO = 1000; // ms
  const TOTAL_PARES = SIMBOLOS.length;

  const tabuleiro = document.getElementById("tabuleiro");
  const msgVez = document.getElementById("mensagem-vez");
  const resultado = document.getElementById("resultado");
  const msgResultado = document.getElementById("mensagem-resultado");
  const btnReiniciar = document.getElementById("btn-reiniciar");
  const placar = {
    1: { caixa: document.getElementById("placar-1"), pontos: document.getElementById("pontos-1") },
    2: { caixa: document.getElementById("placar-2"), pontos: document.getElementById("pontos-2") }
  };

  let pontos, jogadorAtual, primeira, segunda, bloqueado, paresEncontrados;

  // Embaralhamento Fisher-Yates
  function embaralhar(lista) {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function criarCarta(simbolo, id) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "carta";
    btn.dataset.id = id;
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
    return btn;
  }

  function atualizarVez() {
    msgVez.textContent = `Vez do Jogador ${jogadorAtual}`;
    msgVez.className = `vez j${jogadorAtual}`;
    [1, 2].forEach(n => placar[n].caixa.classList.toggle("ativo", n === jogadorAtual));
  }

  function atualizarPontos(n) {
    const el = placar[n].pontos;
    el.textContent = pontos[n];
    el.classList.remove("subiu");
    void el.offsetWidth; // reinicia a animação
    el.classList.add("subiu");
  }

  function iniciarPartida() {
    pontos = { 1: 0, 2: 0 };
    jogadorAtual = 1;
    primeira = segunda = null;
    bloqueado = false;
    paresEncontrados = 0;

    placar[1].pontos.textContent = 0;
    placar[2].pontos.textContent = 0;
    resultado.hidden = true;

    const baralho = embaralhar([...SIMBOLOS, ...SIMBOLOS]);
    tabuleiro.replaceChildren(...baralho.map((s) => {
      const carta = criarCarta(s, SIMBOLOS.indexOf(s));
      return carta;
    }));
    atualizarVez();
  }

  function virarCarta(carta) {
    if (bloqueado || carta.classList.contains("virada")) return;

    carta.classList.add("virada");
    carta.setAttribute("aria-label", "Carta virada para cima");

    if (!primeira) {
      primeira = carta;
      return;
    }

    segunda = carta;
    bloqueado = true;

    if (primeira.dataset.id === segunda.dataset.id) {
      acerto();
    } else {
      setTimeout(erro, TEMPO_MOSTRAR_ERRO);
    }
  }

  function acerto() {
    [primeira, segunda].forEach(c => {
      c.classList.add("encontrada", `j${jogadorAtual}`);
      c.disabled = true;
    });
    pontos[jogadorAtual]++;
    atualizarPontos(jogadorAtual);
    paresEncontrados++;
    primeira = segunda = null;

    if (paresEncontrados === TOTAL_PARES) {
      setTimeout(fimDeJogo, 700);
    } else {
      bloqueado = false; // o mesmo jogador joga novamente
    }
  }

  function erro() {
    [primeira, segunda].forEach(c => {
      c.classList.remove("virada");
      c.setAttribute("aria-label", "Carta virada para baixo");
    });
    primeira = segunda = null;
    jogadorAtual = jogadorAtual === 1 ? 2 : 1;
    atualizarVez();
    bloqueado = false;
  }

  function fimDeJogo() {
    const p1 = pontos[1], p2 = pontos[2];
    let texto;
    if (p1 > p2) texto = `Jogador 1 venceu! (${p1} × ${p2})`;
    else if (p2 > p1) texto = `Jogador 2 venceu! (${p2} × ${p1})`;
    else texto = `Empate! (${p1} × ${p2})`;

    msgResultado.textContent = texto;
    msgVez.textContent = "Fim da partida";
    msgVez.className = "vez";
    [1, 2].forEach(n => placar[n].caixa.classList.remove("ativo"));
    resultado.hidden = false;
  }

  btnReiniciar.addEventListener("click", iniciarPartida);
  iniciarPartida();
})();
