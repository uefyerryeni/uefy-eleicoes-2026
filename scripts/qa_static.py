#!/usr/bin/env python3
import json, re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
errors=[]

def fail(msg): errors.append(msg)
def load(path): return json.loads((ROOT/path).read_text(encoding='utf-8'))

# 1) Base de candidaturas: sem truncamento e sem duplicidade.
all_candidates={}
for shard in "abcd":
    data=load(f"data/candidatos-ufs-{shard}.json")
    all_candidates.update(data)
rn=all_candidates.get("rn",{}).get("candidates",[])
if not rn: fail("Base RN vazia.")
seqs=[str(x.get("seq","")) for x in rn]
if len(seqs)!=len(set(seqs)): fail("Há SQ_CANDIDATO duplicado na base RN.")
for cargo in (3,5,6,7):
    if not any(int(x.get("cargo",0))==cargo for x in rn):
        fail(f"Cargo {cargo} sem candidaturas no RN.")

# 2) A versão operacional não pode expor nem executar o antigo Laboratório UEFY.
for name in ("index.html","rn.html","radar.html","app.js","rn.js","radar.js"):
    txt=(ROOT/name).read_text(encoding="utf-8")
    if re.search(r"Laboratório UEFY|LAB_STEPS|value=[\"']lab[\"']|mode===?[\"']lab[\"']|radarMode===?[\"']lab[\"']",txt,re.I):
        fail(f"{name} ainda contém lógica ou interface do laboratório.")

# 2a) Guardas operacionais da apuração.
app_js=(ROOT/"app.js").read_text(encoding="utf-8")
rn_js=(ROOT/"rn.js").read_text(encoding="utf-8")
radar_js=(ROOT/"radar.js").read_text(encoding="utf-8")
if "AUTO_REFRESH_MS=60000" not in app_js: fail("Geral sem atualização automática de 60 s.")
if "AUTO_REFRESH_MS=60000" not in rn_js: fail("RN sem atualização automática de 60 s.")
if "setInterval" not in radar_js or "60000" not in radar_js: fail("Radar sem releitura automática.")
if "Mantendo o último resultado válido" not in app_js: fail("Geral sem retenção explícita do último dado válido.")
if "Mantendo o último resultado válido" not in rn_js: fail("RN sem retenção explícita do último dado válido.")
if "publicationIsSafe" not in app_js: fail("Geral sem bloqueio de publicação quando a conciliação falha.")
if "voteDestination:String(cand.dvt" not in app_js: fail("Geral não preserva a destinação de votos do EA20.")
if "voteDestination:String(cand.dvt" not in rn_js: fail("RN não preserva a destinação de votos do EA20.")
if "vote_destination" not in radar_js: fail("Radar não exibe a destinação diferenciada de votos.")

# 2b) Proteção contra seletor único usado diretamente com forEach.
# $() retorna um único elemento; "$(...).forEach(...)" é inválido.
for js_name in ("app.js","rn.js","radar.js"):
    js=(ROOT/js_name).read_text(encoding="utf-8")
    for line in js.splitlines():
        stripped=line.lstrip()
        if re.search(r"^\$\([^)]*\)\.forEach\(", stripped):
            fail(f"{js_name} usa seletor único $() diretamente com forEach: {stripped[:120]}")
            break

# 3) Snapshot do Radar: quando oficial estiver ativo, toda candidatura com achados
# deve possuir os quatro tipos e a integridade não pode acusar ausências.
radar=load("data/radar-rn.json")
types={"territorial_coverage","capital_share","top_municipalities","municipal_leads"}
if radar.get("status")=="ok":
    by={}
    for f in radar.get("findings",[]):
        by.setdefault((f.get("office"),f.get("candidate")),set()).add(f.get("type"))
    for key,got in by.items():
        missing=types-got
        if missing: fail(f"Radar oficial incompleto para {key}: faltam {sorted(missing)}")
    for office,meta in radar.get("offices",{}).items():
        integ=meta.get("integrity")
        if integ and integ.get("missing_candidate_ids"):
            fail(f"Integridade do Radar falhou em {office}: {integ['missing_candidate_ids']}")

# 3b) Radar Legislativo: estrutura dos mapas municipais por cargo.
radar_maps=radar.get("municipal_maps") or {}
for office in ("sen","depf","depe"):
    if office not in radar_maps:
        fail(f"Radar Legislativo sem mapa municipal do cargo {office}.")
        continue
    mm=radar_maps.get(office) or {}
    for key in ("leaders","results","summary","municipalities_read"):
        if key not in mm:
            fail(f"Radar Legislativo {office} sem campo {key}.")
    office_progress=float((radar.get("offices") or {}).get(office,{}).get("progress") or 0)
    if office_progress>0 and int(mm.get("municipalities_read") or 0)==0:
        fail(f"Radar Legislativo {office} tem apuração, mas nenhum município lido no mapa.")

# 4) Mapa de governador: se liberado para publicação, deve estar completo.
m=load("data/rn-governador-mapa.json")
if m.get("publication_ready"):
    if int(m.get("municipalities_read",0))!=int(m.get("municipalities_expected",167)):
        fail("Mapa de governador liberado sem todos os municípios.")
    if m.get("errors"): fail("Mapa de governador liberado com erros de leitura.")

# 5) Paleta de governador obrigatória e única.
required={
 "13":"#d62828","16":"#7b2cbf","22":"#2e7d32","27":"#ef6c00",
 "29":"#00897b","36":"#c2185b","44":"#1976d2","50":"#6d4c41","80":"#455a64"
}
for num,color in required.items():
    if f"'{num}':'{color}'" not in (ROOT/"rn.js").read_text(encoding="utf-8"):
        fail(f"Cor fixa ausente/alterada para governador {num}.")
if len(set(required.values()))!=len(required): fail("Paleta de governador contém cores duplicadas.")

if errors:
    print("\n".join("ERRO: "+e for e in errors))
    raise SystemExit(1)
print("QA estático OK")
