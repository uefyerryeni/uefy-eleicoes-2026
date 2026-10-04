#!/usr/bin/env python3
import json, urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

BASE='https://resultados.tse.jus.br/oficial/ele2026'
OUT=Path(__file__).resolve().parents[1]/'data'/'evolucao-rn.json'
TZ=timezone(timedelta(hours=-3))
RACES={
 'gov':('6259','006259','0003','rn'),
 'sen':('6259','006259','0005','rn'),
 'pres':('6257','006257','0001','br')
}
def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 UEFY-Eleicoes/1.0'})
 with urllib.request.urlopen(req,timeout=20) as r:return json.loads(r.read().decode('utf-8-sig'))
def num(v):
 try:return int(str(v or '0').replace('.','').replace(',','.').split('.')[0])
 except:return 0
def pct(v):
 try:return float(str(v or '0').replace(',','.'))
 except:return 0.0
def parse(data):
 rows=[]
 for carg in data.get('carg',[]) or []:
  for agr in carg.get('agr',[]) or []:
   for par in agr.get('par',[]) or []:
    for c in par.get('cand',[]) or []:
     rows.append({'number':str(c.get('n') or ''),'name':str(c.get('nmu') or c.get('nm') or c.get('n') or ''),'party':str(par.get('sg') or ''),'votes':num(c.get('vap')),'pct':pct(c.get('pvap'))})
 rows.sort(key=lambda x:-x['votes'])
 s=data.get('s') or {}
 progress=pct(s.get('pst')) if s.get('pst') is not None else (num(s.get('st'))/num(s.get('ts'))*100 if num(s.get('ts')) else 0)
 stamp=' · '.join(x for x in [str(data.get('dg') or '').strip(),str(data.get('hg') or '').strip()] if x)
 return rows,round(progress,2),stamp
def url(election,el,cargo,scope):
 return f'{BASE}/{election}/dados/{scope}/{scope}-c{cargo}-e{el}-u.json'
def main():
 try: hist=json.loads(OUT.read_text(encoding='utf-8'))
 except: hist={'version':1,'source':'Tribunal Superior Eleitoral','started_at':datetime.now(TZ).isoformat(timespec='seconds'),'races':{'gov':[],'sen':[],'pres':[]}}
 changed=False
 now=datetime.now(TZ).isoformat(timespec='seconds')
 for key,args in RACES.items():
  try:
   rows,progress,source_stamp=parse(fetch(url(*args)))
  except Exception as e:
   print(key,'indisponível:',e);continue
  if not rows: continue
  top=rows[:3]
  point={'collected_at':now,'source_generated_at':source_stamp or None,'progress':progress,'candidates':top}
  prev=(hist.get('races',{}).get(key) or [])
  signature=(progress,[(x['number'],x['votes'],x['pct']) for x in top])
  prevsig=None
  if prev:
   p=prev[-1];prevsig=(p.get('progress'),[(x.get('number'),x.get('votes'),x.get('pct')) for x in p.get('candidates',[])])
  if signature!=prevsig:
   hist.setdefault('races',{}).setdefault(key,[]).append(point);changed=True
 if changed:
  hist['updated_at']=now
  OUT.write_text(json.dumps(hist,ensure_ascii=False,indent=2),encoding='utf-8')
  print('Histórico atualizado.')
 else: print('Sem mudança eleitoral; histórico preservado.')
if __name__=='__main__':main()
\n