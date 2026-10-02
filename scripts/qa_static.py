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

# 2) Proteção contra o bug que limitava candidatos do Laboratório.
radar_js=(ROOT/"radar.js").read_text(encoding="utf-8")
for pattern in (r"registryForOffice\([^\)]*\)\.slice\(", r"regs\.slice\(0\s*,\s*6", r"regs\.slice\(0\s*,"):
    if re.search(pattern,radar_js):
        fail("Radar LAB contém corte de candidaturas: "+pattern)

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
