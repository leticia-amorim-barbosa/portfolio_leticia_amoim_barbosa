const produtosTop = [
  {
    id: 'iphone-17-pro-max',
    nome: 'Apple iPhone 17 Pro Max 256GB',
    preco: 6999.99,
    desconto: 12,
    categoria: 'iPhones Lacrados',
    cores: ['Laranja Cósmico', 'Preto Titânio', 'Natural', 'Azul Profundo'],
    imagem: 'imagens/iphone-17-pro-max.png',
    miniaturas: ['imagens/iphone-17-pro-max.png', 'imagens/iphone-17-preto.png', 'imagens/iphone-17-lateral.png', 'imagens/iphone-17-camera.png', 'imagens/iphone-17-caixa.png'],
    precoOriginal: 7999.99,
    descricao: 'iPhone lacrado, com acabamento premium, alto desempenho e câmera avançada para fotos e vídeos com qualidade profissional.',
    especificacoes: ['256GB de armazenamento', 'Cor Laranja Cósmico', 'Produto lacrado', 'Garantia consultada com a loja']
  },
  {
    id: 'apple-watch-series-11',
    nome: 'Apple Watch Series 11 GPS',
    preco: 1999.99,
    desconto: 20,
    categoria: 'Acessórios',
    cores: ['Preto', 'Prata', 'Rosa Claro'],
    imagem: 'imagens/apple-watch.png',
    miniaturas: ['imagens/apple-watch.png', 'imagens/apple-watch-lateral.png', 'imagens/apple-watch-pulseira.png'],
    precoOriginal: 2499.99,
    descricao: 'Relógio inteligente com recursos de saúde, treino, notificações e integração com o iPhone.',
    especificacoes: ['Modelo GPS', 'Tela de alta definição', 'Compatível com iPhone', 'Pulseira inclusa']
  },
  {
    id: 'scooter-1000w',
    nome: 'Scooter Elétrica 1000W — Autopropelido — Sem CNH',
    preco: 9999.99,
    desconto: 10,
    categoria: 'Motos Elétricas',
    cores: ['Preta', 'Vermelha', 'Branca'],
    imagem: 'imagens/scooter-eletrica-1000w.png',
    miniaturas: ['imagens/scooter-eletrica-1000w.png', 'imagens/scooter-1000w-lateral.png', 'imagens/scooter-1000w-detalhe.png'],
    precoOriginal: 11111.10,
    descricao: 'Scooter elétrica com motor potente, visual moderno e proposta urbana para deslocamentos práticos.',
    especificacoes: ['Motor 1000W', 'Autopropelido', 'Sem CNH conforme anúncio', 'Autonomia variável por uso']
  },
  {
    id: 'airpods-pro-3',
    nome: 'AirPods Pro 3 Apple',
    preco: 2699.99,
    desconto: 15,
    categoria: 'Acessórios',
    cores: ['Branco'],
    imagem: 'imagens/airpods-pro-3.png',
    miniaturas: ['imagens/airpods-pro-3.png', 'imagens/airpods-caixa.png', 'imagens/airpods-detalhe.png'],
    precoOriginal: 3176.46,
    descricao: 'Fones Apple com áudio imersivo, estojo compacto e experiência prática para chamadas, música e vídeos.',
    especificacoes: ['Cancelamento de ruído', 'Estojo de recarga', 'Integração com dispositivos Apple', 'Produto de vitrine demonstrativa']
  },
  {
    id: 'scooter-500w',
    nome: 'Scooter Elétrica 500W — Autopropelido — Sem CNH',
    preco: 3500.90,
    desconto: 20,
    categoria: 'Motos Elétricas',
    cores: ['Verde Claro', 'Preta', 'Branca'],
    imagem: 'imagens/scooter-eletrica-500w.png',
    miniaturas: ['imagens/scooter-eletrica-500w.png', 'imagens/scooter-500w-lateral.png', 'imagens/scooter-500w-detalhe.png'],
    precoOriginal: 4376.12,
    descricao: 'Scooter elétrica compacta para o dia a dia, com design urbano e condução simples.',
    especificacoes: ['Motor 500W', 'Autopropelido', 'Modelo compacto', 'Ideal para trajetos curtos']
  },
  {
    id: 'iphone-12-pro-azul',
    nome: 'iPhone 12 Pro 128GB Azul Pacífico — Bateria 70%',
    preco: 1800.00,
    desconto: 10,
    categoria: 'Seminovos',
    imagem: 'imagens/iphone-12-pro-azul.png',
    miniaturas: ['imagens/iphone-12-pro-azul.png', 'imagens/iphone-12-pro-costas.png', 'imagens/iphone-12-pro-lateral.png'],
    precoOriginal: 2000.00,
    descricao: 'iPhone seminovo com acabamento Azul Pacífico, bom desempenho e bateria informada no anúncio.',
    especificacoes: ['128GB de armazenamento', 'Azul Pacífico', 'Bateria 70%', 'Estado seminovo']
  },
  {
    id: 'bateria-magsafe',
    nome: 'Apple Bateria MagSafe para iPhone Air',
    preco: 1110.00,
    desconto: 20,
    categoria: 'Acessórios',
    cores: ['Branca'],
    imagem: 'imagens/bateria-magsafe.png',
    miniaturas: ['imagens/bateria-magsafe.png', 'imagens/bateria-magsafe-caixa.png', 'imagens/bateria-magsafe-detalhe.png'],
    precoOriginal: 1387.50,
    descricao: 'Bateria MagSafe para recarga prática, com encaixe magnético e visual discreto.',
    especificacoes: ['Compatível com MagSafe', 'Design portátil', 'Recarga sem fio', 'Uso demonstrativo no site']
  },
  {
    id: 'case-silicone-colorida',
    nome: 'Case iPhone Silicone Aveludada Colorida',
    preco: 11.99,
    desconto: 30,
    categoria: 'Acessórios',
    cores: ['Preta', 'Rosa', 'Azul', 'Verde', 'Amarela'],
    imagem: 'imagens/case-silicone-colorida.png',
    miniaturas: ['imagens/case-silicone-colorida.png', 'imagens/case-preta.png', 'imagens/case-cores.png'],
    precoOriginal: 17.13,
    descricao: 'Capinha de silicone com toque aveludado, visual colorido e proteção básica para o aparelho.',
    especificacoes: ['Silicone aveludado', 'Cores variadas', 'Proteção contra riscos', 'Compatibilidade a confirmar']
  },
  {
    id: 'produto-extra-01',
    nome: 'Carregador USB-C Turbo para iPhone',
    preco: 129.90,
    desconto: 12,
    categoria: 'Acessórios',
    cores: ['Branco', 'Preto'],
    imagem: 'imagens/carregador-usb-c.png',
    estoque: 20,
    descricao: 'Carregador compacto para quem precisa de recarga rápida e acabamento limpo.',
    especificacoes: ['Conexão USB-C', 'Modelo compacto', 'Ideal para uso diário', 'Cabo vendido separadamente']
  },
  {
    id: 'produto-extra-02',
    nome: 'Película 3D Premium para iPhone',
    preco: 39.90,
    desconto: 12,
    categoria: 'Acessórios',
    cores: ['Transparente', 'Borda Preta'],
    imagem: 'imagens/pelicula-3d.png',
    estoque: 35,
    descricao: 'Película de proteção com encaixe visual premium para manter a tela mais segura no dia a dia.',
    especificacoes: ['Borda 3D', 'Alta transparência', 'Toque suave', 'Modelo conforme disponibilidade']
  },
  {
    id: 'produto-extra-03',
    nome: 'iPhone 14 128GB Meia-noite Seminovo',
    preco: 3299.99,
    desconto: 12,
    categoria: 'Seminovos',
    imagem: 'imagens/logo-top-iphones.png',
    estoque: 5,
    descricao: 'iPhone seminovo com boa performance, visual elegante e armazenamento suficiente para rotina intensa.',
    especificacoes: ['128GB', 'Cor Meia-noite', 'Seminovo', 'Condição consultada com a loja']
  },
  {
    id: 'produto-extra-04',
    nome: 'Cabo Lightning Reforçado 1 Metro',
    preco: 29.90,
    desconto: 12,
    categoria: 'Acessórios',
    cores: ['Branco', 'Preto'],
    imagem: 'imagens/logo-top-iphones.png',
    estoque: 60,
    descricao: 'Cabo reforçado para recarga e transferência de dados, pensado para uso prático.',
    especificacoes: ['1 metro', 'Acabamento reforçado', 'Compatível com Lightning', 'Produto demonstrativo']
  }
];

function buscarProdutoPorId(id) {
  return produtosTop.find((produto) => produto.id === id);
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
