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

A Central não gera resultados inventados. Imagens, textos e vídeos **com votos** só são liberados com dados oficiais integralmente conciliados do TSE, a partir de 17h de 25/10/2026. Antes da apuração, o vídeo permite apenas um **teste operacional de envio sem votos**, com o mesmo layout e avisos visíveis em todos os quadros.

### Fluxo principal (RN e Presidência)
- **Compartilhar imagem + texto**: tenta enviar um JPEG 1080×1080 e a legenda juntos pelo seletor nativo do Brave/Android. A chamada a `navigator.share` é feita no mesmo toque, sem conversões assíncronas anteriores. Pode-se selecionar o X se estiver disponível.
- **Publicar no X**: no celular usa a mesma tentativa de envio de imagem + texto; no computador abre o editor do X com o texto e copia a imagem, quando permitido.
- **Copiar texto** e **Baixar imagem**: disponíveis quando a publicação é oficial e validada, inclusive se o sistema não aceitar compartilhamento nativo.
- Se o compartilhamento falhar, o site mostra o link **Abrir o X com o texto (anexar imagem manualmente)** e instruções de contingência. O link é um gesto separado para não ser bloqueado pelo navegador.
- O aplicativo X pode ignorar a legenda encaminhada pelo sistema operacional. É indispensável conferir imagem e texto no editor antes de publicar.

### Vídeo no Brave: teste hoje, resultados amanhã
- **Testar publicação sem votos (MP4)** cria um vídeo de oito segundos, 1080×1080 quando houver suporte MP4 nativo ou 720×720 via WebCodecs. Usa a mesma identidade, animações, nomes de candidaturas conhecidos, tipografia e disposição dos cards. O vídeo NÃO contém votos nem porcentagens; mostra avisos **TESTE DE ENVIO / NÃO É RESULTADO ELEITORAL** e o nome do arquivo **UEFY-TESTE-ENVIO-SEM-RESULTADOS.mp4**.
- **Compartilhar vídeo no Twitter** agora é um controle de **duas etapas visíveis**, sempre acionável antes da gravação: no primeiro toque, **1/2 · Preparar MP4 para compartilhar**, a Central gera o arquivo (ensaio sem votos antes da apuração, ou oficial quando houver dados TSE conferidos); no segundo toque, **2/2 · Compartilhar vídeo e texto no X**, abre o seletor do Brave/Android com MP4 e legenda, se compatível. Um segundo toque é obrigatório porque o navegador exige ativação direta do usuário para abrir o compartilhamento. Caso o X ignore a legenda, copie o texto no botão próprio.
- **Gerar vídeo oficial MP4** exige os dados oficiais TSE conciliados, e então exibe as porcentagens e os votos verdadeiros no mesmo layout. Antes da apuração, essa exportação segue bloqueada.
- Se o navegador não permitir gravar ou compartilhar vídeo, use o MP4 baixado e anexe manualmente no X. A codificação alternativa usa WebCodecs e a biblioteca local mp4-muxer (licença MIT em `vendor/LICENSE-mp4-muxer.txt`).


### Teste de segurança e regressão
O workflow GitHub Pages executa QA de integridade, sintaxe JavaScript e testes Playwright. Os testes do compartilhamento usam dados artificiais apenas dentro do navegador de automação, jamais armazenados ou distribuídos em páginas de produção.
