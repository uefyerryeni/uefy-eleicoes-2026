import csv, io, json, urllib.request, pathlib
UFS=["RJ","SP"]
BASE="https://raw.githubusercontent.com/leofn/tse-candidatos-2026/main/dados/"
def fetch(name):
    with urllib.request.urlopen(BASE+name, timeout=60) as r:
        return r.read().decode("latin-1")
def rows(text):
    return list(csv.DictReader(io.StringIO(text), delimiter=";", quotechar='"'))
out={}
for uf in UFS:
    main=rows(fetch(f"consulta_cand_2026_{uf}.csv"))
    comp=rows(fetch(f"consulta_cand_complementar_2026_{uf}.csv"))
    cm={x["SQ_CANDIDATO"]:x for x in comp}
    cand=[]
    for x in main:
        if int(x["CD_CARGO"]) not in (3,5,6,7): continue
        c=cm.get(x["SQ_CANDIDATO"],{})
        if c.get("ST_CANDIDATO_INSERIDO_URNA")!="SIM" or c.get("ST_SUBSTITUIDO")=="S": continue
        cand.append({"cargo":int(x["CD_CARGO"]),"numero":int(x["NR_CANDIDATO"]),"nome":x["NM_URNA_CANDIDATO"],"partido":x["SG_PARTIDO"],"seq":x["SQ_CANDIDATO"],"situacao":c.get("DS_SITUACAO_JULGAMENTO_URNA","")})
    out[uf.lower()]={"generated":(main[0].get("DT_GERACAO","")+" "+main[0].get("HH_GERACAO","")).strip(),"candidates":cand}
pathlib.Path("data").mkdir(exist_ok=True)
pathlib.Path("data/candidatos-ufs-d.json").write_text(json.dumps(out,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
