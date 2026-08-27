const gradeProdutos = document.getElementById('grade-produtos');
const paginaProduto = document.getElementById('pagina-produto');
const favoritosSalvos = new Set(JSON.parse(localStorage.getItem('top_iphones_favoritos') || '[]'));

const numeroWhatsAppLoja = '5524992484443'; // Troque pelo WhatsApp real da loja, com DDI e DDD

function montarProdutos(lista = produtosTop) {
  if (!gradeProdutos) return;

  gradeProdutos.innerHTML = lista.map((produto) => {
    const favorito = favoritosSalvos.has(produto.id) ? 'favorito-ativo' : '';

    return `
      <article class="cartao-produto" data-id="${produto.id}" tabindex="0" aria-label="Ver detalhes de ${produto.nome}">
        <button class="selo-desconto" type="button">${produto.desconto}%<br>OFF</button>
        <button class="botao-favorito ${favorito}" type="button" aria-label="Favoritar produto" data-favorito="${produto.id}">♡</button>
        <div class="area-imagem-produto">
          <img src="${produto.imagem}" alt="${produto.nome}" />
        </div>
        <h3 class="nome-produto">${produto.nome}</h3>
        <strong class="preco-produto">${formatarMoeda(produto.preco)}</strong>
        <a class="botao-comprar" href="produto.html?id=${produto.id}" aria-label="Ver detalhes de ${produto.nome}">Ver detalhes</a>
      </article>
    `;
  }).join('');
}

function montarPaginaProduto() {
  if (!paginaProduto) return;

  const parametros = new URLSearchParams(window.location.search);
  const id = parametros.get('id') || produtosTop[0].id;
  const produto = buscarProdutoPorId(id);

  if (!produto) {
    paginaProduto.innerHTML = `<div class="produto-nao-encontrado"><h1>Produto não encontrado</h1><a class="botao-destaque" href="index.html">Voltar para o catálogo</a></div>`;
    return;
  }

  document.title = `${produto.nome} | Top iPhones`;

  const miniaturas = produto.miniaturas && produto.miniaturas.length ? produto.miniaturas : [produto.imagem];
  const precoOriginal = produto.precoOriginal || produto.preco / (1 - produto.desconto / 100);
  const valorPix = produto.preco * 0.95;
  const valorParcela = produto.preco / 12;
  const avaliacao = produto.avaliacao || 4.8;
  const avaliacoes = produto.avaliacoes || 128;
  const cores = produto.cores && produto.cores.length ? produto.cores : ['Consultar disponibilidade'];
  const linkWhatsApp = gerarLinkWhatsApp(produto, cores[0]);

  paginaProduto.innerHTML = `
    <section class="produto-vitrine">
      <div class="lado-galeria-produto">
        <div class="imagem-produto-destaque">
          <div class="botoes-sociais-produto">
            <button class="botao-quadrado-produto" type="button" data-favorito="${produto.id}" aria-label="Favoritar produto">♡</button>
            <button class="botao-quadrado-produto" type="button" id="compartilhar-produto" aria-label="Compartilhar produto">⌯</button>
          </div>
          <img id="imagem-produto-principal" src="${produto.imagem}" alt="${produto.nome}" />
        </div>

        <div class="trilho-miniaturas-produto">
          ${miniaturas.map((imagem, indice) => `
            <button class="miniatura-vitrine ${indice === 0 ? 'miniatura-ativa' : ''}" type="button" data-miniatura="${imagem}" aria-label="Ver imagem ${indice + 1}">
              <img src="${imagem}" alt="Miniatura ${indice + 1} de ${produto.nome}" />
            </button>
          `).join('')}
        </div>
      </div>

      <div class="lado-compra-produto">
        <span class="selo-vitrine">${produto.desconto}% OFF</span>
        <h1>${produto.nome}</h1>

        <p class="preco-antigo-produto">${formatarMoeda(precoOriginal)}</p>
        <strong class="preco-vitrine-produto">${formatarMoeda(produto.preco)}</strong>
        <p class="parcela-vitrine">ou em até 12x de ${formatarMoeda(valorParcela)} sem juros</p>
        <p class="pix-vitrine"><span>❖</span> ${formatarMoeda(valorPix)} no PIX com <strong>5% de desconto</strong></p>

        <div class="cores-produto">
          <strong>Cores disponíveis</strong>
          <div class="lista-cores-produto">
            ${cores.map((cor, indice) => `<button class="opcao-cor-produto ${indice === 0 ? 'cor-ativa' : ''}" type="button">${cor}</button>`).join('')}
          </div>
        </div>

        <div class="acoes-vitrine-produto">
          <a class="botao-whatsapp-produto" id="whatsapp-produto" href="${linkWhatsApp}" target="_blank" rel="noopener">Chamar no WhatsApp</a>
          <a class="botao-pagamentos" href="${linkWhatsApp}" target="_blank" rel="noopener">Consultar disponibilidade ›</a>
        </div>

        <div class="beneficios-produto">
          <div>
            <span>▱</span>
            <strong>Atendimento direto</strong>
            <p>Fale com a equipe da loja antes de fechar qualquer compra.</p>
          </div>
          <div>
            <span>♢</span>
            <strong>Garantia Top</strong>
            <p>Condições de garantia confirmadas diretamente com a loja.</p>
          </div>
          <div>
            <span>□</span>
            <strong>Produto sob consulta</strong>
            <p>Estoque, cores e entrega podem variar conforme disponibilidade.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="detalhes-vitrine-produto" id="descricao-produto">
      <div>
        <h2>Descrição</h2>
        <p>${produto.descricao}</p>
      </div>
      <div>
        <h2>Informações principais</h2>
        <ul>${produto.especificacoes.map((item) => `<li>${item}</li>`).join('')}</ul>
        <p><strong>Estoque fictício:</strong> ${produto.estoque} unidades</p>
      </div>
    </section>
  `;

  document.querySelectorAll('[data-miniatura]').forEach((botao) => {
    botao.addEventListener('click', () => {
      document.getElementById('imagem-produto-principal').src = botao.dataset.miniatura;
      document.querySelectorAll('.miniatura-vitrine').forEach((item) => item.classList.remove('miniatura-ativa'));
      botao.classList.add('miniatura-ativa');
    });
  });

  document.querySelectorAll('.opcao-cor-produto').forEach((botao) => {
    botao.addEventListener('click', () => {
      document.querySelectorAll('.opcao-cor-produto').forEach((item) => item.classList.remove('cor-ativa'));
      botao.classList.add('cor-ativa');
      const atalhoWhatsApp = document.getElementById('whatsapp-produto');
      if (atalhoWhatsApp) atalhoWhatsApp.href = gerarLinkWhatsApp(produto, botao.textContent.trim());
    });
  });

  const botaoCompartilhar = document.getElementById('compartilhar-produto');
  if (botaoCompartilhar) {
    botaoCompartilhar.addEventListener('click', async () => {
      const url = window.location.href;
      if (navigator.share) {
        await navigator.share({ title: produto.nome, url });
      } else {
        await navigator.clipboard.writeText(url);
        mostrarAviso('Link copiado.');
      }
    });
  }
}

function gerarLinkWhatsApp(produto, corSelecionada = '') {
  const linkProduto = `${window.location.origin}${window.location.pathname}?id=${produto.id}`;
  const trechoCor = corSelecionada ? `
Cor de interesse: ${corSelecionada}` : '';
  const mensagem = `Olá! Vi esse produto no site da Top iPhones e tenho interesse:

${produto.nome}
Valor: ${formatarMoeda(produto.preco)}${trechoCor}
Link: ${linkProduto}

Pode me passar mais informações?`;
  return `https://wa.me/${numeroWhatsAppLoja}?text=${encodeURIComponent(mensagem)}`;
}

function gerarLinkWhatsAppGeral() {
  const linkPagina = window.location.href;
  const mensagem = `Olá! Vi o catálogo da Top iPhones e fiquei interessada(o) em um item do site.

Link do catálogo: ${linkPagina}

Pode me ajudar?`;
  return `https://wa.me/${numeroWhatsAppLoja}?text=${encodeURIComponent(mensagem)}`;
}

function prepararLinksWhatsAppDoTopo() {
  document.querySelectorAll('[data-whatsapp-topo]').forEach((link) => {
    link.href = gerarLinkWhatsAppGeral();
  });
}

function ativarCarrosselBanner() {
  const carrossel = document.getElementById('carrossel-banner');
  if (!carrossel) return;

  const slides = [...carrossel.querySelectorAll('.slide-banner')];
  const marcadores = [...carrossel.querySelectorAll('.marcadores-banner button')];
  const anterior = carrossel.querySelector('.controle-anterior');
  const proximo = carrossel.querySelector('.controle-proximo');
  let slideAtual = 0;
  let intervalo;

  function mostrarSlide(indice) {
    slideAtual = (indice + slides.length) % slides.length;
    slides.forEach((slide, posicao) => slide.classList.toggle('slide-ativo', posicao === slideAtual));
    marcadores.forEach((marcador, posicao) => marcador.classList.toggle('marcador-ativo', posicao === slideAtual));
  }

  function reiniciarTempo() {
    clearInterval(intervalo);
    intervalo = setInterval(() => mostrarSlide(slideAtual + 1), 5500);
  }

  anterior?.addEventListener('click', () => {
    mostrarSlide(slideAtual - 1);
    reiniciarTempo();
  });

  proximo?.addEventListener('click', () => {
    mostrarSlide(slideAtual + 1);
    reiniciarTempo();
  });

  marcadores.forEach((marcador, indice) => {
    marcador.addEventListener('click', () => {
      mostrarSlide(indice);
      reiniciarTempo();
    });
  });

  reiniciarTempo();
}

function mostrarAviso(texto) {
  const aviso = document.createElement('div');
  aviso.className = 'aviso-flutuante';
  aviso.textContent = texto;
  document.body.appendChild(aviso);
  setTimeout(() => aviso.remove(), 2200);
}

function filtrarPorBusca() {
  const campoBusca = document.getElementById('campo-busca');
  if (!campoBusca) return;

  campoBusca.addEventListener('input', () => {
    const termo = campoBusca.value.toLowerCase().trim();
    const resultado = produtosTop.filter((produto) => {
      return produto.nome.toLowerCase().includes(termo) || produto.categoria.toLowerCase().includes(termo);
    });
    montarProdutos(resultado);
  });
}

function ativarEventosDaLoja() {
  document.addEventListener('click', (evento) => {
    const botaoFavorito = evento.target.closest('[data-favorito]');
    const categoria = evento.target.closest('[data-categoria]');
    const cartaoProduto = evento.target.closest('.cartao-produto');

    if (botaoFavorito) {
      evento.stopPropagation();
      const id = botaoFavorito.dataset.favorito;
      if (favoritosSalvos.has(id)) {
        favoritosSalvos.delete(id);
        botaoFavorito.classList.remove('favorito-ativo');
      } else {
        favoritosSalvos.add(id);
        botaoFavorito.classList.add('favorito-ativo');
      }
      localStorage.setItem('top_iphones_favoritos', JSON.stringify([...favoritosSalvos]));
      return;
    }

    if (categoria && gradeProdutos) {
      const nomeCategoria = categoria.dataset.categoria;
      const filtrados = produtosTop.filter((produto) => produto.categoria === nomeCategoria);
      montarProdutos(filtrados.length ? filtrados : produtosTop);
      return;
    }

    if (cartaoProduto && gradeProdutos) {
      window.location.href = `produto.html?id=${cartaoProduto.dataset.id}`;
    }
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter') return;
    const cartaoProduto = evento.target.closest('.cartao-produto');
    if (cartaoProduto && gradeProdutos) {
      window.location.href = `produto.html?id=${cartaoProduto.dataset.id}`;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  montarProdutos();
  montarPaginaProduto();
  prepararLinksWhatsAppDoTopo();
  ativarCarrosselBanner();
  filtrarPorBusca();
  ativarEventosDaLoja();
});
