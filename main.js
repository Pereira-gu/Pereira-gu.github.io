(() => {
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n, c = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });

  /* Distribuição das notas: valores calculados a partir da base da Olist */
  const grupos = {
    prazo: { nome: 'no prazo', media: 4.29, dist: [6.6, 2.6, 8.0, 20.4, 62.4] },
    atraso: { nome: 'com atraso', media: 2.57, dist: [46.2, 7.8, 11.4, 12.3, 22.2] },
  };
  const barras = document.getElementById('bars');
  const colunas = [...barras.querySelectorAll('.col')];
  const botoes = [...document.querySelectorAll('.toggle button')];
  const media = document.getElementById('mean-value');
  let atual = 'prazo';
  let animacao = 0;
  let autoTroca = 0;

  function animarMedia(de, para) {
    cancelAnimationFrame(animacao);
    if (reduzir) { media.textContent = fmt(para, 2); return; }
    const inicio = performance.now();
    const passo = agora => {
      const t = Math.min((agora - inicio) / 900, 1);
      const suave = 1 - Math.pow(1 - t, 4);
      media.textContent = fmt(de + (para - de) * suave, 2);
      if (t < 1) animacao = requestAnimationFrame(passo);
    };
    animacao = requestAnimationFrame(passo);
  }

  function mostrar(chave) {
    if (chave === atual) return;
    const g = grupos[chave];
    colunas.forEach((col, i) => {
      col.querySelector('.fill').style.setProperty('--v', g.dist[i]);
      col.querySelector('.val').textContent = fmt(g.dist[i]) + '%';
    });
    botoes.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.group === chave)));
    barras.setAttribute('aria-label', `Distribuição das notas de pedidos entregues ${g.nome}: ` +
      g.dist.map((v, i) => `nota ${i + 1}, ${fmt(v)}%`).join('; ') + '.');
    animarMedia(grupos[atual].media, g.media);
    atual = chave;
  }

  botoes.forEach(b => b.addEventListener('click', () => {
    clearTimeout(autoTroca);
    mostrar(b.dataset.group);
  }));

  if (!reduzir) autoTroca = setTimeout(() => mostrar('atraso'), 1400);

  /* Receita mensal, em milhares de reais */
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const receita = [111.8, 234.2, 359.2, 340.7, 489.3, 421.9, 481.6, 554.7, 607.4, 648.2, 987.8, 726.0,
    924.6, 826.4, 953.4, 973.5, 977.5, 856.1, 868.0, 838.6];
  const rotulo = i => `${meses[i % 12]}/${2017 + Math.floor(i / 12)}`;
  const PICO = 10;

  document.getElementById('line-table').innerHTML = receita
    .map((v, i) => `<tr><td>${rotulo(i)}</td><td>${fmt(v)}</td></tr>`).join('');

  const caixa = document.getElementById('line-chart');
  const leitura = document.getElementById('readout');
  const NS = 'http://www.w3.org/2000/svg';
  let selecionado = PICO;

  const el = (nome, attrs, pai) => {
    const n = document.createElementNS(NS, nome);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    pai.appendChild(n);
    return n;
  };

  function desenhar() {
    const largura = caixa.clientWidth;
    if (!largura) return;
    const compacto = largura < 560;
    const altura = compacto ? 260 : 360;
    const m = { t: 14, r: compacto ? 8 : 16, b: 28, l: 42 };
    const yMax = 1000;
    const x = i => m.l + i * (largura - m.l - m.r) / (receita.length - 1);
    const y = v => altura - m.b - v * (altura - m.t - m.b) / yMax;

    caixa.textContent = '';
    const svg = el('svg', {
      viewBox: `0 0 ${largura} ${altura}`, height: altura, tabindex: 0, role: 'img',
      'aria-label': 'Gráfico de linha da receita mensal de janeiro de 2017 a agosto de 2018. Use as setas para percorrer os meses.',
    }, caixa);

    [0, 250, 500, 750, 1000].forEach(v => {
      el('line', { class: 'grid-line', x1: m.l, x2: largura - m.r, y1: y(v), y2: y(v) }, svg);
      el('text', { class: 'axis-text', x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, svg).textContent = v === 1000 ? '1 mi' : v;
    });

    const marcas = compacto ? [0, 12, 19] : [0, 6, 12, 19];
    marcas.forEach(i => {
      const ancora = i === 0 ? 'start' : i === 19 ? 'end' : 'middle';
      el('text', { class: 'axis-text', x: x(i), y: altura - 6, 'text-anchor': ancora }, svg).textContent = rotulo(i);
    });

    el('path', { class: 'series', d: receita.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('') }, svg);

    const linha = el('line', { class: 'cursor-line', y1: m.t, y2: altura - m.b }, svg);
    const ponto = el('circle', { class: 'cursor-dot', r: 6 }, svg);

    const atualizar = i => {
      selecionado = Math.max(0, Math.min(receita.length - 1, i));
      linha.setAttribute('x1', x(selecionado));
      linha.setAttribute('x2', x(selecionado));
      ponto.setAttribute('cx', x(selecionado));
      ponto.setAttribute('cy', y(receita[selecionado]));
      leitura.textContent = `${rotulo(selecionado)}: R$ ${fmt(receita[selecionado])} mil` +
        (selecionado === PICO ? ', o maior valor da série' : '');
    };

    svg.addEventListener('pointermove', e => {
      const r = svg.getBoundingClientRect();
      atualizar(Math.round((e.clientX - r.left - m.l) / ((largura - m.l - m.r) / (receita.length - 1))));
    });
    svg.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        atualizar(selecionado + (e.key === 'ArrowRight' ? 1 : -1));
      }
    });
    atualizar(selecionado);
  }

  let largura = caixa.clientWidth;
  desenhar();
  new ResizeObserver(() => {
    if (caixa.clientWidth !== largura) { largura = caixa.clientWidth; desenhar(); }
  }).observe(caixa);
})();
