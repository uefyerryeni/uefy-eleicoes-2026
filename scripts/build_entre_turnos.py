#!/usr/bin/env python3
"""Indicadores de participação do RN — segundo turno de 2026.

Somente os EA20 oficiais de 25/10/2026 podem compor este snapshot.
Uma consulta bem-sucedida não é, por si só, voto apurado. Não divulgar
comparações enquanto faltar qualquer resultado municipal ou estadual final.
"""
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path

BASE = 'https://resultados.tse.jus.br/oficial/ele2026'
FED, FEDPAD = '6258', '006258'
EST, ESTPAD = '6260', '006260'
CONFIG = f'{BASE}/{FED}/config/mun-e{FEDPAD}-cm.json'
CONFIG_FALLBACK = f'{BASE}/6257/config/mun-e006257-cm.json'
OUT = Path(__file__).resolve().parents[1] / 'data/entre-turnos-2t.json'
TZ = timezone(timedelta(hours=-3))
ELECTION_DATE = datetime(2026, 10, 25, 17, 0, tzinfo=TZ)

def fetch(url, timeout=22):
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 UEFY-Eleicoes/2026'})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode('utf-8-sig'))

def number(value):
    try: return int(str(value or '0').replace('.', '').replace(',', '.').split('.')[0])
    except (ValueError, TypeError): return 0

def percent(value):
    try: return float(str(value or '0').replace(',', '.'))
    except (ValueError, TypeError): return 0.0

def cities(node, uf='', result=None):
    if result is None: result=[]
    if isinstance(node, list):
        for item in node: cities(item, uf, result)
        return result
    if not isinstance(node, dict): return result
    raw=str(node.get('cd') or '')
    local=str(node.get('sg') or node.get('uf') or node.get('cdabr') or node.get('abr') or (raw if len(raw)==2 and raw.isalpha() else '') or uf).lower()
    if isinstance(node.get('mu'), list):
        for item in node['mu']:
            code=str(item.get('cd') or item.get('c') or item.get('cdmun') or item.get('codigo') or '').zfill(5)
            name=str(item.get('nm') or item.get('nmu') or item.get('nome') or '').strip()
            if code and name: result.append({'code':code, 'name':name, 'uf':local})
    for key,value in node.items():
        if key!='mu': cities(value, local, result)
    return result

def metrics(data):
    e=data.get('e') or {}
    v=data.get('v') or {}
    return {
        'electorate':number(e.get('te') or e.get('e') or e.get('est')),
        'turnout':number(e.get('c')),
        'turnout_pct':percent(e.get('pc')),
        'abstention':number(e.get('a')),
        'abstention_pct':percent(e.get('pa')),
        'total_votes':number(v.get('tv')),
        'blank':number(v.get('vb')),
        'blank_pct':percent(v.get('pvb')),
        'null':number(v.get('tvn')),
        'null_pct':percent(v.get('ptvn'))
    }

def complete(data, m):
    # Não confundir zero voto / zero seção com dado fechado.
    if str(data.get('tf') or '').lower()!='s': return False
    e=data.get('e') or {}
    s=data.get('s') or {}
    if number(s.get('ts'))>0 and number(s.get('st'))<number(s.get('ts')): return False
    if m['electorate']<=0 or m['turnout']<=0 or m['total_votes']<=0: return False
    if m['turnout']>m['electorate']: return False
    if m['blank']+m['null']>m['total_votes']: return False
    if abs(m['turnout']+m['abstention']-m['electorate'])>1: return False
    return all(0<=m[k]<=100 for k in ('turnout_pct','abstention_pct','blank_pct','null_pct'))

def source(office, code=None):
    election,padded,cargo=(FED,FEDPAD,'0001') if office=='pres' else (EST,ESTPAD,'0003')
    place='rn' if code is None else 'rn'+code
    return f'{BASE}/{election}/dados/rn/{place}-c{cargo}-e{padded}-u.json'

def snapshot(status='waiting', rows=None, state=None, errors=None, stamp=None):
    rows=rows or []
    state=state or {}
    errors=errors or []
    released=datetime.now(TZ)>=ELECTION_DATE
    ready=(released and len(rows)==167 and len(errors)==0
           and all(state.get(k,{}).get('complete') for k in ('gov','pres')))
    return {
        'round':2,'election_ids':{'gov':EST,'pres':FED},
        'status':'complete' if ready else status,
        'publication_ready':bool(ready),
        'generated_at':datetime.now(TZ).isoformat(timespec='seconds'),
        'source_generated_at':stamp,
        'municipalities_expected':167,'municipalities_read':len(rows),
        'state':state,'municipalities':sorted(rows,key=lambda x:x['name']),
        'errors':errors,
        'message':'Base oficial encerrada e conferida para os dois cargos.' if ready else 'Aguardando os resultados oficiais completos de 25/10. Comparações indisponíveis.'
    }

def save(obj):
    OUT.parent.mkdir(parents=True,exist_ok=True)
    old=None
    try: old=json.loads(OUT.read_text(encoding='utf-8'))
    except (OSError,ValueError): pass
    def comparable(x):
        return {k:v for k,v in x.items() if k!='generated_at'}
    if old and comparable(old)==comparable(obj):
        print('Sem alterações materiais.')
        return
    # Na falta temporária de rede após um fechamento válido, não destruir o snapshot.
    if old and old.get('publication_ready') and not obj.get('publication_ready'):
        print('Preservada a última base final íntegra.')
        return
    OUT.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(obj['message'])

def main():
    if datetime.now(TZ)<ELECTION_DATE:
        print('Antes da abertura da divulgação do 2º turno; não consultar votos.')
        if not OUT.exists(): save(snapshot())
        return
    try:
        try: config=fetch(CONFIG)
        except Exception: config=fetch(CONFIG_FALLBACK)
        locations=cities(config)
        locations=[x for x in locations if x['uf']=='rn']
        codes={x['code']:x for x in locations}
        if len(codes)!=167:
            raise RuntimeError('Configuração municipal incompleta ou duplicada.')
    except Exception as exc:
        save(snapshot('waiting',errors=[{'source':'municipal_configuration','error':str(exc)[:100]}]))
        return

    states={}
    for office in ('gov','pres'):
        try:
            data=fetch(source(office))
            values=metrics(data)
            states[office]={**values,'complete':complete(data,values),
                            'source_generated_at':' · '.join(x for x in (str(data.get('dg') or ''),str(data.get('hg') or '')) if x)}
        except Exception as exc:
            states[office]={'complete':False,'error':str(exc)[:100]}

    rows=[]; errors=[]
    def one(city):
        out={'code':city['code'],'name':city['name']}
        for office in ('gov','pres'):
            data=fetch(source(office,city['code']))
            val=metrics(data)
            if not complete(data,val):
                return None
            out[office]=val
        return out

    with ThreadPoolExecutor(max_workers=12) as pool:
        futures={pool.submit(one,city):city for city in codes.values()}
        for job in as_completed(futures):
            try:
                row=job.result()
                if row: rows.append(row)
            except Exception as exc:
                errors.append({'municipality':futures[job]['name'],'error':str(exc)[:100]})
    ready=len(rows)==167 and not errors and all(states[x].get('complete') for x in ('gov','pres'))
    stamp=max((states[x].get('source_generated_at','') for x in ('gov','pres')),default='')
    save(snapshot('partial' if rows else 'waiting',rows,states,errors,stamp or None))

if __name__=='__main__':
    try: main()
    except Exception as exc:
        print('Coleta não concluída:',exc,file=sys.stderr)
        if not OUT.exists(): save(snapshot('waiting',errors=[{'source':'system','error':str(exc)[:100]}]))
        sys.exit(1)
