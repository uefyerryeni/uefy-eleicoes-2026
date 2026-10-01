import csv, io, json, urllib.request, pathlib, zipfile
UFS=["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"]
MAIN_URL="https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip"
COMP_URL="https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand_complementar/consulta_cand_complementar_2026.zip"

def download(url):
    req=urllib.request.Request(url,headers={"User-Agent":"UEFY-Eleicoes/2026"})
    with urllib.request.urlopen(req,timeout=120) as r:
        return zipfile.ZipFile(io.BytesIO(r.read()))

def csv_rows(z,name):
    raw=z.read(name)
    return list(csv.DictReader(io.StringIO(raw.decode("latin-1")),delimiter=";",quotechar='"'))

def find_name(z,prefix,uf):
    target=f"{prefix}_2026_{uf}.csv".lower()
    for n in z.namelist():
        if pathlib.PurePosixPath(n).name.lower()==target:
            return n
    raise FileNotFoundError(target)

main_zip=download(MAIN_URL)
comp_zip=download(COMP_URL)

def build(uf):
    main=csv_rows(main_zip,find_name(main_zip,"consulta_cand",uf))
    comp=csv_rows(comp_zip,find_name(comp_zip,"consulta_cand_complementar",uf))
    cm={x["SQ_CANDIDATO"]:x for x in comp}
    cand=[]
    for x in main:
        cargo=int(x["CD_CARGO"])
        if cargo not in (1,3,5,6,7): continue
        c=cm.get(x["SQ_CANDIDATO"],{})
        if c.get("ST_CANDIDATO_INSERIDO_URNA")!="SIM" or c.get("ST_SUBSTITUIDO")=="S": continue
        cand.append({
            "cargo":cargo,"numero":int(x["NR_CANDIDATO"]),
            "nome":x["NM_URNA_CANDIDATO"],"partido":x["SG_PARTIDO"],
            "seq":x["SQ_CANDIDATO"],
            "situacao":c.get("DS_SITUACAO_JULGAMENTO_URNA","")
        })
    cand.sort(key=lambda x:(x["cargo"],x["numero"],x["nome"]))
    generated=((main[0].get("DT_GERACAO","")+" "+main[0].get("HH_GERACAO","")).strip() if main else "")
    return {"generated":generated,"candidates":cand}

all_ufs={uf.lower():build(uf) for uf in UFS}
br=build("BR")
pathlib.Path("data").mkdir(exist_ok=True)
groups={
 "a":["ac","al","am","ap","ba","ce","df","es","go"],
 "b":["ma","mg","ms","mt","pa","pb","pe","pi","pr"],
 "c":["rn","ro","rr","rs","sc","se","to"],
 "d":["rj","sp"]
}
for shard,ufs in groups.items():
    pathlib.Path(f"data/candidatos-ufs-{shard}.json").write_text(
        json.dumps({uf:all_ufs[uf] for uf in ufs},ensure_ascii=False,separators=(",",":")),encoding="utf-8")
pres=[x for x in br["candidates"] if x["cargo"]==1]
pathlib.Path("data/candidatos-2026.json").write_text(json.dumps({
 "source":"TSE/AGEL - Candidatos 2026",
 "source_url":MAIN_URL,
 "generatedBR":br["generated"],
 "pres":pres
},ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print("UFs:",len(all_ufs),"Presidencia:",len(pres),"RN:",len(all_ufs["rn"]["candidates"]))