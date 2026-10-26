# UEFY Eleições 2026

## UEFY Live — estúdio para OBS (25/10/2026)

O estúdio está em [estudio-live.html](estudio-live.html) e é acessível pelas páginas de Governo do RN e Presidência, inclusive no menu móvel. Produz um **gráfico editorial 16:9 nativo de 1920 × 1080**, independente dos cards, vídeos e mapas da Central.

- **Estúdio de controle:** estudio-live.html. Escolha RN ou Brasil, placar ou panorama, e habilite o giro automático.
- **Tela pronta para OBS:** estudio-live.html?capture=1&auto=1. Não exibe controles e faz rodízio automático de 18 segundos entre RN/placar, Brasil/placar, RN/panorama e Brasil/panorama.
- No OBS, crie **Fonte de navegador** e configure **1920 pixels de largura por 1080 de altura**. Use a URL publicada no próprio estúdio. Não é necessária câmera ou microfone para exibir os gráficos.
- **O site não inicia a live no X.** É necessário obter acesso/chave de transmissão na conta do X e configurar a saída no OBS.

### Integridade da exibição

A cada **60 segundos**, o estúdio consulta os JSON EA20 oficiais do TSE para o governo do RN (eleição 6260, abrangência estadual) e Presidência (eleição 6258, abrangência **Brasil inteiro**). A consulta só é iniciada após **17h de 25/10/2026**, horário de Brasília. O módulo election-integrity.js já utilizado pela Central verifica turno, fonte, cargo, abrangência, progresso, candidaturas e coerência dos votos. O estúdio também confronta os números com a base local de candidaturas proveniente do TSE.

**Não há simulação na transmissão pública.** Antes dos resultados válidos, a tela exibe as candidaturas com traços no lugar de porcentagens. Se houver erro de rede ou divergência na conciliação, os votos e percentuais são ocultados; uma nova tentativa é feita no ciclo seguinte. Boletins parciais e resultado final são identificados separadamente. O horário exibido é o carimbo do TSE, não o horário da captura do OBS.

### Homologação

tests/live-studio.spec.js executa testes de espera antes das 17h, aceite de boletim íntegro, rejeição de percentuais inconsistentes e saída OBS sem controles em Full HD. Dados artificiais existem **somente nas fixtures isoladas dos testes Playwright**, nunca nos arquivos de produção. O workflow pages.yml executa o teste e verifica a sintaxe de live-studio.js antes de publicar o site.

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

## Conferência das candidaturas do segundo turno

Em 24/10/2026, foi checado o quadro publicado pelo TSE para o 2º turno de 25/10:
- Presidência: **Flávio Bolsonaro (PL, 22)** e **Lula (PT, 13)**. Referências TSE:
  - https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/flavio-bolsonaro-e-lula-vao-disputar-o-2o-turno-para-a-presidencia-da-republica
  - https://www.tse.jus.br/eleicoes/eleicoes-2026-content/propostas-de-governo-dos-candidatos-ao-cargo-de-presidente-da-republica-eleicoes-2026-segundo-turno/planos-de-governo-dos-candidatos-ao-cargo-de-presidente-da-republica-eleicoes-2026-2-turno
- Governo do RN: **Allyson Bezerra (União, 44)** e **Cadu de Lula (PT, 13)**. Referência TSE:
  - https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/allyson-bezerra-uniao-e-cadu-de-lula-pt-seguem-na-disputa-no-rio-grande-do-norte

A prévia presidencial consulta `data/candidatos-2026.json` (base TSE/AGEL, gerada em 10/10/2026), seleciona somente as candidaturas oficialmente classificadas no segundo turno e valida nome, número, partido e situação do registro. Se a base não puder ser verificada, a exportação da prévia é bloqueada em vez de apresentar candidatos genéricos.

**Candidatura não é resultado:** antes da totalização oficial, a Central exibe nomes, partidos e números, sem atribuir votos, porcentagens ou posições de vitória. O vídeo com resultados exige separadamente conciliação com EA20 do TSE e janela de divulgação permitida.

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


### Ordem editorial do vídeo do governador e fluidez do MP4
A **primeira publicação de governador é de todo o Rio Grande do Norte**, e não de Natal. O estúdio de vídeo abre por padrão com **Rio Grande do Norte inteiro**. Somente quando o usuário seleciona **Município selecionado** o vídeo e o texto passam a retratar o município destacado no mapa.

No momento da apuração, o total estadual do RN é obtido no EA20 oficial por:
`https://resultados.tse.jus.br/oficial/ele2026/6260/dados/rn/rn-c0003-e006260-u.json`.
A Central só exporta o vídeo estadual após conciliar a apuração estadual com o registro das candidaturas e com progresso maior que zero. Nunca usa o resultado municipal de Natal em seu lugar. Selecionar outro município invalida o arquivo municipal gerado anteriormente.

**Diagnóstico do MP4 no Brave:** o arquivo de teste enviado em 24/10/2026 tinha pausa de 400 ms entre 0,336 s e 0,736 s, em uma gravação MediaRecorder 1080×1080/30 fps. O gerador agora **prefere WebCodecs H.264 com timestamps fixos de 24 fps**, sem depender da frequência de captura da tela. Se WebCodecs não for suportado, a captura nativa permanece como alternativa, com aviso para revisar a fluidez do vídeo. Na alternativa WebCodecs o arquivo é gerado a 720×720 para reduzir o custo de codificação em celulares.


## Homologação operacional de 24/10/2026

- Imagem, texto e vídeo do governador começam em **Rio Grande do Norte inteiro**. Os seletores de abrangência são explícitos; selecionar uma cidade no mapa não muda os totais estaduais. O recorte municipal precisa ser escolhido no respectivo seletor.
- O envelope EA20 é validado por eleição, turno, origem oficial, cargo, abrangência, horário, números e conciliação aritmética dos percentuais. Dados retidos após uma falha de consulta ficam visíveis com aviso e não autorizam uma nova publicação.
- Consultas de resultados têm prazo máximo de 15 segundos. Uma resposta de um município anterior é descartada após a troca de cidade e a consulta atual é refeita.
- A legenda do vídeo é gerada do mesmo snapshot dos quadros, incluindo o horário da fonte; não herda a edição do texto de outro município.
- WebCodecs usa H.264 com nível solicitado 3.1, adequado ao quadro 720×720, e 192 quadros em oito segundos a 24 fps. O nível 3.0 anteriormente solicitado era incompatível com essa resolução e fazia o navegador cair na captura em tempo real. A captura nativa continua como contingência e requer revisão visual.
- O compartilhamento sem dados oficiais após a abertura da apuração informa bloqueio; o ensaio sem votos continua disponível no botão próprio.
- Os dois workflows de coleta do segundo turno disparam explicitamente `pages.yml` após um commit com dados novos. A homologação continua obrigatória antes do deploy. O acréscimo de `actions: write` nesses dois workflows foi autorizado pelo responsável em 24/10/2026.
- A homologação de navegador pode usar um executável local por `UEFY_BROWSER_PATH`; no CI usa o Chromium instalado pelo Playwright. Testes com compartilhamento simulado e largura móvel não comprovam o seletor nativo do Brave em celular físico nem o recebimento pelo aplicativo X.

### Contingência da cobertura

1. Confirme no TSE o turno, o cargo, a abrangência, o horário da fonte e o progresso. Não contorne os bloqueios da Central.
2. Em falha de rede ou conciliação, suspenda novas peças daquele recorte. A consulta anterior não é uma confirmação atual; tente **Atualizar** e consulte a divulgação oficial diretamente.
3. No celular, gere o arquivo e depois faça um segundo toque para compartilhar. Se o seletor falhar, baixe o PNG/MP4, copie a legenda e anexe manualmente no X. Confira o rascunho antes de publicar.
4. Se a coleta concluir e o site continuar antigo, execute manualmente **Deploy UEFY Eleições to GitHub Pages**, aguarde QA e deploy concluírem e confira `version.json` e o horário do snapshot.
5. Não publique o MP4 com `TESTE` ou `SEM RESULTADOS` como apuração. A conferência final do Brave/Android ou Brave/iOS e do aplicativo X deve ser feita no aparelho real, sem enviar uma postagem de teste sem autorização.

Os cenários automatizados de espera usam relógio fixo e snapshots de teste sem resultados. Isso evita que a homologação falhe apenas porque o dia da eleição chegou ou os snapshots reais foram atualizados; os cenários de liberação avançam explicitamente o relógio e isolam as respostas dentro do navegador de teste.

A animação oficial revela desde o primeiro quadro somente os percentuais exatos do snapshot TSE. Não há contagem numérica de zero até o resultado, para impedir que valores intermediários sejam confundidos com apurações oficiais.


## Plataforma de estatísticas e imagens (26/10/2026)

A página inicial reúne 23 indicadores, filtros por candidatura e município, transições de liderança para Governador, mapas por turno e variação, ranking, CSV e estúdio PNG local para o X. Modelos: mapa, dois mapas com escala comum, ranking de oito municípios e destaque estatístico; formatos 1600×900, 1200×1200 e 1080×1350, com título editável e temas claro/escuro. A página inicial não carrega módulos de vídeo. A apuração anterior permanece em apuracao.html.

O motor estatistica-core.js cruza códigos TSE únicos; a geometria utiliza nomes normalizados com aliases documentados no código. Comparações só são liberadas quando os 167 registros de ambos os turnos passam pela validação. Falhas de atualização mantêm a última base conferida. Taxas estaduais usam denominadores estaduais, sem média simples municipal; ausência de candidatura no segundo turno é nula, nunca zero. Mudança de liderança não demonstra transferência individual de votos. Fontes e datas acompanham as imagens. Nenhum conteúdo é publicado automaticamente no X.

Verificação: node --test tests/estatistica-core.test.cjs, python scripts/qa_static.py e npx playwright test. Os testes de apuração histórica apontam para apuracao.html. Os testes da plataforma verificam os bytes PNG e o evento de download sem depender do gerenciador de arquivos do navegador.
