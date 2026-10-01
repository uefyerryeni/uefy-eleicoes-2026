#!/usr/bin/env python3
import json, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path

BASE='https://resultados.tse.jus.br/oficial/ele2026'
ELECTION='6259'
EL='006259'
CARGO='0003'
CONFIG_URL='https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json'
OUT=Path(__file__).resolve().parents[1]/'data'/'rn-governador-mapa.json'
TZ=timezone(timedelta(hours=-3))

def fetch_json(url,timeout=20):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 UEFY-Eleicoes/1.0'})
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8-sig'))

def num(v):
    try:return int(str(v or '0').replace('.','').replace(',','.').split('.')[0])
    except:return 0

def pct(v):
    try:return float(str(v or '0').replace(',','.'))
    except:return 0.0

def municipalities(node,uf=None,out=None):
    if out is None:out=[]
    if isinstance(node,list):
        for x in node:municipalities(x,uf,out)
        return out
    if not isinstance(node,dict):return out
    state_code=str(node.get('cd') or '')
    local=str(node.get('sg') or node.get('uf') or node.get('cdabr') or node.get('abr') or (state_code if len(state_code)==2 and state_code.isalpha() else '') or uf or '').lower()
    if isinstance(node.get('mu'),list):
        for m in node['mu']:
            code=str(m.get('cd') or m.get('c') or m.get('cdmun') or m.get('mun') or m.get('codigo') or '').zfill(5)
            name=str(m.get('nm') or m.get('nmu') or m.get('nome') or m.get('ds') or m.get('descricao') or '').strip()
            if code and name:out.append({'uf':local,'code':code,'name':name})
    for k,v in node.items():
        if k!='mu':municipalities(v,local,out)
    return out

def parse(data):
    rows=[]
    for carg in data.get('carg',[]) or []:
        for agr in carg.get('agr',[]) or []:
            for par in agr.get('par',[]) or []:
                for c in par.get('cand',[]) or []:
                    rows.append({
                        'number':str(c.get('n') or ''),
                        'name':str(c.get('nmu') or c.get('nm') or ('Número '+str(c.get('n') or ''))),
                        'votes':num(c.get('vap')),
                        'pct':pct(c.get('pvap')),
                        'seq':num(c.get('seq') or 999999)
                    })
    rows.sort(key=lambda x:(-x['votes'],x['seq']))
    s=data.get('s') or {}
    progress=pct(s.get('pst')) if s.get('pst') is not None else (num(s.get('st'))/num(s.get('ts'))*100 if num(s.get('ts')) else 0)
    return rows,progress,' · '.join(x for x in [str(data.get('dg') or '').strip(),str(data.get('hg') or '').strip()] if x)

def url(code):
    return f'{BASE}/{ELECTION}/dados/rn/rn{code}-c{CARGO}-e{EL}-u.json'

def write_wait(message):
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({
        'status':'waiting','generated_at':datetime.now(TZ).isoformat(timespec='seconds'),
        'source_generated_at':None,'municipalities_expected':167,'municipalities_read':0,
        'publication_ready':False,'message':message,'leaders':{},'summary':[]
    },ensure_ascii=False,indent=2),encoding='utf-8')

def main():
    try:
        cfg=fetch_json(CONFIG_URL)
        mun=[m for m in municipalities(cfg) if m['uf']=='rn']
    except Exception:
        write_wait('A configuração oficial do TSE ainda não está disponível.')
        return
    if not mun:
        write_wait('A lista de municípios do RN ainda não está disponível no TSE.')
        return

    leaders={}; counts={}; latest=''; errors=[]
    def one(m):
        data=fetch_json(url(m['code']))
        rows,progress,stamp=parse(data)
        return m,rows,progress,stamp

    with ThreadPoolExecutor(max_workers=12) as ex:
        futs={ex.submit(one,m):m for m in mun}
        for f in as_completed(futs):
            m=futs[f]
            try:
                m,rows,progress,stamp=f.result()
                if stamp>latest:latest=stamp
                if not rows or rows[0]['votes']<=0:
                    leaders[m['name']]={'code':m['code'],'status':'no_votes','progress':round(progress,2)}
                    continue
                top=rows[0]
                leaders[m['name']]={
                    'code':m['code'],'status':'ok','progress':round(progress,2),
                    'candidate_number':top['number'],'candidate':top['name'],
                    'votes':top['votes'],'pct':round(top['pct'],2),
                    'top3':rows[:3]
                }
                counts[top['number']]=counts.get(top['number'],{'number':top['number'],'name':top['name'],'municipalities':0})
                counts[top['number']]['municipalities']+=1
            except Exception as e:
                errors.append({'municipality':m['name'],'error':str(e)[:100]})

    read=sum(1 for x in leaders.values() if x.get('status') in ('ok','no_votes'))
    complete=read==len(mun) and len(errors)==0
    summary=sorted(counts.values(),key=lambda x:(-x['municipalities'],x['name']))
    natal=leaders.get('Natal') or leaders.get('NATAL')
    data={
        'status':'ok' if read else 'waiting',
        'generated_at':datetime.now(TZ).isoformat(timespec='seconds'),
        'source_generated_at':latest or None,
        'municipalities_expected':len(mun),'municipalities_read':read,
        'publication_ready':complete,
        'errors':errors,'leaders':leaders,'summary':summary,'natal':natal,
        'message':('Mapa completo e conferido.' if complete else f'Mapa parcial: {read}/{len(mun)} municípios lidos. Publicação bloqueada até completar a base.')
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(data['message'])

if __name__=='__main__':
    try:main()
    except Exception as e:
        print('ERRO:',e,file=sys.stderr)
        write_wait('Não foi possível concluir a leitura do mapa nesta atualização.')
