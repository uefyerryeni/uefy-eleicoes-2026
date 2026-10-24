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

## Ensaio de vídeo para o X (dados fictícios)
Para testar o Motion sem depender de apuração oficial, acesse:
- RN: https://uefyerryeni.github.io/uefy-eleicoes-2026/index.html?teste-video=1
- Presidência: https://uefyerryeni.github.io/uefy-eleicoes-2026/presidencia.html?teste-video=1

O link habilita uma simulação local no estúdio do vídeo, com **Candidatura Beta (barra vermelha, 53,8%)** na frente da **Candidatura Alfa (barra azul, 46,2%)** e 72,4% de seções fictícias. Clique em **Ver animação** e **Gerar vídeo MP4**. No celular, use **Compartilhar vídeo no Twitter / Threads** para abrir o seletor de aplicativos. Alguns aplicativos móveis recebem só o arquivo: há também **Copiar texto da publicação**, permitindo colar a legenda no editor do X ou Threads. Nada é publicado automaticamente. No computador, o fluxo abre o X com o texto e baixa o MP4 para anexar.

A exportação usa MP4/H.264 nativo quando disponível; em navegadores compatíveis com WebCodecs, há uma alternativa de MP4 a 720×720 por uma biblioteca local (mp4-muxer, licença MIT em `vendor/LICENSE-mp4-muxer.txt`). A compatibilidade real depende do dispositivo e navegador. O MP4 e o texto do teste incluem identificação explícita de **SIMULAÇÃO / DADOS FICTÍCIOS**. O modo de teste não altera os dados oficiais, não desbloqueia o publicador do mapa ou dos cards nem consulta dados inventados ao TSE.

A opção não aparece no site público sem o parâmetro `teste-video=1`. Para sair, abra o endereço normal da Central sem esse parâmetro.
