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

As bases de candidaturas são regeneradas automaticamente quatro vezes ao dia a partir dos ZIPs oficiais do TSE.

## Compartilhamento
A arte é gerada em PNG 1080×1080. O site tenta compartilhar texto e arquivo juntos pela Web Share API quando o navegador/sistema oferece suporte. Em navegadores desktop sem compartilhamento de arquivos, o fallback baixa o PNG e abre o compositor do X com o texto.
