# UEFY Eleições 2026

Ferramenta da Uefyerryeni para acompanhar dados eleitorais oficiais e preparar publicações.

## Abrangência
- Presidência: Brasil, cinco regiões e todas as UFs.
- Governador: todas as UFs.
- Rio Grande do Norte: Presidente, Governador, Senado, Deputado Federal e Deputado Estadual.
- Municípios do RN: exclusivamente Governador.

## Fontes
- Candidaturas: arquivos oficiais de Candidatos 2026 e Informações Complementares do Portal de Dados Abertos do TSE.
- Resultados: arquivos EA20 da Divulgação de Resultados do TSE.
- Mapas: malhas territoriais derivadas de dados públicos do IBGE.

A atualização automática das bases de candidaturas está temporariamente suspensa. A regeneração a partir dos ZIPs oficiais do TSE pode ser iniciada manualmente pelo GitHub Actions, após conferência dos dados.

## Compartilhamento
A arte é gerada em PNG 1080×1080. O site tenta compartilhar texto e arquivo juntos pela Web Share API quando o navegador/sistema oferece suporte. Em navegadores desktop sem compartilhamento de arquivos, o fallback baixa o PNG e abre o compositor do X com o texto.

## Publicação oficial no Brave (celular)

A Central não inclui mais ensaios animados nem resultados inventados. Imagens, textos e vídeos oficiais continuam bloqueados até o segundo turno, a partir de 17h de 25/10/2026, e só são liberados com conciliação integral dos dados do TSE.

### Fluxo principal (RN e Presidência)
- **Compartilhar imagem + texto**: tenta enviar um JPEG 1080×1080 e a legenda juntos pelo seletor nativo do Brave/Android. A chamada a `navigator.share` é feita no mesmo toque, sem conversões assíncronas anteriores. Pode-se selecionar o X se estiver disponível.
- **Publicar no X**: no celular usa a mesma tentativa de envio de imagem + texto; no computador abre o editor do X com o texto e copia a imagem, quando permitido.
- **Copiar texto** e **Baixar imagem**: disponíveis quando a publicação é oficial e validada, inclusive se o sistema não aceitar compartilhamento nativo.
- Se o compartilhamento falhar, o site mostra o link **Abrir o X com o texto (anexar imagem manualmente)** e instruções de contingência. O link é um gesto separado para não ser bloqueado pelo navegador.
- O aplicativo X pode ignorar a legenda encaminhada pelo sistema operacional. É indispensável conferir imagem e texto no editor antes de publicar.

### Vídeo oficial
O Motion continua opcional para dados do TSE, sem demonstrações fictícias. O MP4 pode ser enviado com a folha nativa quando o navegador e o aplicativo permitirem; caso contrário, faça o download do MP4, copie o texto e anexe manualmente no X. Navegadores compatíveis com WebCodecs podem usar a biblioteca local mp4-muxer (licença MIT em `vendor/LICENSE-mp4-muxer.txt`). O site não publica automaticamente no X.

### Teste de segurança e regressão
O workflow GitHub Pages executa QA de integridade, sintaxe JavaScript e testes Playwright. Os testes do compartilhamento usam dados artificiais apenas dentro do navegador de automação, jamais armazenados ou distribuídos em páginas de produção.
