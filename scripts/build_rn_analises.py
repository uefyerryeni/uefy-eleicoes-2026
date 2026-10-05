#!/usr/bin/env python3
import json, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path

BASE26='https://resultados.tse.jus.br/oficial/ele2026'
FED26='6257'; FED26_PAD='006257'
EST26='6259'; EST26_PAD='006259'
CONFIG26=f'{BASE26}/{FED26}/config/mun-e{FED26_PAD}-cm.json'
OUT=Path(__file__).resolve().parents[1]/'data'/'rn-analises.json'
TZ=timezone(timedelta(hours=-3))

def fetch_json(url,timeout=25):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 UEFY-Eleicoes/1.0'})
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8-sig'))

def num(v):
    try:return int(float(str(v or '0').replace('.','').replace(',','.')))
    except:return 0

def dec(v):
    try:return float(str(v or '0').replace(',','.'))
    except:return 0.0

def municipalities(node,uf=None,out=None):
    if out is None: out=[]
    if isinstance(node,list):
        for x in node: municipalities(x,uf,out)
        return out
    if not isinstance(node,dict): return out
    state_code=str(node.get('cd') or '')
    local=str(node.get('sg') or node.get('uf') or node.get('cdabr') or node.get('abr') or (state_code if len(state_code)==2 and state_code.isalpha() else '') or uf or '').lower()
    if isinstance(node.get('mu'),list):
        for m in node['mu']:
            code=str(m.get('cd') or m.get('c') or m.get('cdmun') or m.get('mun') or m.get('codigo') or '').zfill(5)
            name=str(m.get('nm') or m.get('nmu') or m.get('nome') or m.get('ds') or m.get('descricao') or '').strip()
            if code and name: out.append({'uf':local,'code':code,'name':name})
    for k,v in node.items():
        if k!='mu': municipalities(v,local,out)
    return out

def candidates(data):
    rows=[]
    for carg in data.get('carg',[]) or []:
        for agr in carg.get('agr',[]) or []:
            for par in agr.get('par',[]) or []:
                for c in par.get('cand',[]) or []:
                    rows.append({
                        'number':str(c.get('n') or ''),
                        'name':str(c.get('nmu') or c.get('nm') or ('Número '+str(c.get('n') or ''))),
                        'party':str(par.get('sg') or ''),
                        'votes':num(c.get('vap')),
                        'pct':dec(c.get('pvap')),
                        'seq':num(c.get('seq') or 999999),
                        'vote_destination':str(c.get('dvt') or par.get('dvt') or '').lower()
                    })
    rows.sort(key=lambda x:(-x['votes'],x['seq']))
    return rows

def metrics26(data):
    e=data.get('e') or {}
    v=data.get('v') or {}
    return {
        'electorate':num(e.get('te') or e.get('e') or e.get('est')),
        'turnout':num(e.get('c')),
        'turnout_pct':dec(e.get('pc')),
        'abstention':num(e.get('a')),
        'abstention_pct':dec(e.get('pa')),
        'total_votes':num(v.get('tv')),
        'valid':num(v.get('vv')),
        'valid_pct':dec(v.get('pvv')),
        'blank':num(v.get('vb')),
        'blank_pct':dec(v.get('pvb')),
        'null':num(v.get('tvn')),
        'null_pct':dec(v.get('ptvn'))
    }

def metrics22(data):
    return {
        'electorate':num(data.get('e') or data.get('ea')),
        'turnout':num(data.get('c')),
        'turnout_pct':dec(data.get('pc')),
        'abstention':num(data.get('a')),
        'abstention_pct':dec(data.get('pa')),
        'total_votes':num(data.get('tv')),
        'valid':num(data.get('vv') or data.get('vvc')),
        'valid_pct':dec(data.get('pvv') or data.get('pvvc')),
        'blank':num(data.get('vb')),
        'blank_pct':dec(data.get('pvb')),
        'null':num(data.get('tvn') or data.get('vn')),
        'null_pct':dec(data.get('ptvn') or data.get('pvn'))
    }

def stamp(data):
    return ' · '.join(x for x in [str(data.get('dg') or data.get('dt') or '').strip(),str(data.get('hg') or data.get('ht') or '').strip()] if x)

def url26(code,office):
    if office=='pres':
        return f'{BASE26}/{FED26}/dados/rn/rn{code}-c0001-e{FED26_PAD}-u.json'
    return f'{BASE26}/{EST26}/dados/rn/rn{code}-c0003-e{EST26_PAD}-u.json'

def state26(office):
    if office=='pres':
        return f'{BASE26}/{FED26}/dados/rn/rn-c0001-e{FED26_PAD}-u.json'
    return f'{BASE26}/{EST26}/dados/rn/rn-c0003-e{EST26_PAD}-u.json'

def legacy22(office):
    if office=='pres':
        return 'https://resultados.tse.jus.br/oficial/ele2022/544/dados-simplificados/rn/rn-c0001-e000544-r.json'
    return 'https://resultados.tse.jus.br/oficial/ele2022/546/dados-simplificados/rn/rn-c0003-e000546-r.json'

def leader(rows):
    valid=[x for x in rows if x['votes']>0 and x.get('vote_destination') not in ('anulado','anulado sub judice')]
    return valid[0] if valid else (rows[0] if rows and rows[0]['votes']>0 else None)

def main():
    cfg=fetch_json(CONFIG26)
    mun=[m for m in municipalities(cfg) if m['uf']=='rn']
    if not mun: raise RuntimeError('Lista de municípios do RN não encontrada.')

    rows=[]; errors=[]; latest=''
    def one(m):
        p=fetch_json(url26(m['code'],'pres'))
        g=fetch_json(url26(m['code'],'gov'))
        return m,p,g

    with ThreadPoolExecutor(max_workers=8) as ex:
        futs={ex.submit(one,m):m for m in mun}
        for f in as_completed(futs):
            m=futs[f]
            try:
                m,p,g=f.result()
                pl=leader(candidates(p)); gl=leader(candidates(g))
                ps=stamp(p); gs=stamp(g); latest=max(latest,ps,gs)
                pm=metrics26(p); gm=metrics26(g)
                rows.append({
                    'code':m['code'],'name':m['name'],
                    'president':pl,'governor':gl,
                    'participation':{
                        'electorate':pm['electorate'] or gm['electorate'],
                        'turnout':pm['turnout'] or gm['turnout'],
                        'turnout_pct':pm['turnout_pct'] or gm['turnout_pct'],
                        'abstention':pm['abstention'] or gm['abstention'],
                        'abstention_pct':pm['abstention_pct'] or gm['abstention_pct'],
                        'president':{'blank':pm['blank'],'blank_pct':pm['blank_pct'],'null':pm['null'],'null_pct':pm['null_pct'],'valid':pm['valid'],'valid_pct':pm['valid_pct']},
                        'governor':{'blank':gm['blank'],'blank_pct':gm['blank_pct'],'null':gm['null'],'null_pct':gm['null_pct'],'valid':gm['valid'],'valid_pct':gm['valid_pct']}
                    }
                })
            except Exception as e:
                errors.append({'municipality':m['name'],'code':m['code'],'error':str(e)[:160]})

    rows.sort(key=lambda x:x['name'])
    pairs={}
    for r in rows:
        p=r.get('president') or {}; g=r.get('governor') or {}
        if not p or not g: continue
        key=f"{p.get('number','')}|{g.get('number','')}"
        if key not in pairs:
            pairs[key]={'president':{'name':p.get('name'),'party':p.get('party'),'number':p.get('number')},
                        'governor':{'name':g.get('name'),'party':g.get('party'),'number':g.get('number')},
                        'municipalities':0,'names':[]}
        pairs[key]['municipalities']+=1
        pairs[key]['names'].append(r['name'])
    pair_list=sorted(pairs.values(),key=lambda x:(-x['municipalities'],x['president']['name'] or '',x['governor']['name'] or ''))

    def top(metric,path,reverse=True,n=10):
        def get(r):
            cur=r
            for k in path: cur=(cur or {}).get(k)
            return float(cur or 0)
        usable=[r for r in rows if get(r)>0]
        return [{'name':r['name'],'value':round(get(r),4)} for r in sorted(usable,key=get,reverse=reverse)[:n]]

    state={}
    for off in ('pres','gov'):
        try:
            d=fetch_json(state26(off)); state[off]=metrics26(d); state[off]['source_generated_at']=stamp(d)
        except Exception as e:
            state[off]={'error':str(e)[:160]}
    hist={}
    for off in ('pres','gov'):
        try: hist[off]=metrics22(fetch_json(legacy22(off)))
        except Exception as e: hist[off]={'error':str(e)[:160]}

    out={
        'status':'ok' if rows else 'waiting',
        'generated_at':datetime.now(TZ).isoformat(timespec='seconds'),
        'source_generated_at':latest or None,
        'municipalities_expected':len(mun),
        'municipalities_read':len(rows),
        'errors':errors,
        'cross':{'pairs':pair_list,'municipalities':rows},
        'participation':{
            'state_2026':state,
            'state_2022':hist,
            'rankings':{
                'highest_abstention':top('abstention_pct',['participation','abstention_pct'],True),
                'lowest_abstention':top('abstention_pct',['participation','abstention_pct'],False),
                'highest_blank_president':top('blank_pct',['participation','president','blank_pct'],True),
                'highest_null_president':top('null_pct',['participation','president','null_pct'],True),
                'highest_blank_governor':top('blank_pct',['participation','governor','blank_pct'],True),
                'highest_null_governor':top('null_pct',['participation','governor','null_pct'],True)
            }
        },
        'methodology':{
            'cross_note':'O cruzamento é territorial e agregado por município. Não permite afirmar que os mesmos eleitores votaram nas duas candidaturas.',
            'participation_note':'Comparecimento e abstenção vêm do eleitorado das seções instaladas. Brancos e nulos são específicos de cada cargo.',
            'source':'Tribunal Superior Eleitoral — arquivos oficiais de resultado unificado (EA20) de 2026; resultados simplificados oficiais do 1º turno de 2022 para a comparação estadual.'
        }
    }
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f"RN análises: {len(rows)}/{len(mun)} municípios; {len(errors)} erro(s).")

if __name__=='__main__':
    try: main()
    except Exception as e:
        print('ERRO:',e,file=sys.stderr)
        OUT.write_text(json.dumps({'status':'error','generated_at':datetime.now(TZ).isoformat(timespec='seconds'),'message':str(e)},ensure_ascii=False,indent=2),encoding='utf-8')
        raise
