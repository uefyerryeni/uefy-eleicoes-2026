#!/usr/bin/env python3
import json, sys, urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path

BASE='https://resultados.tse.jus.br/oficial/ele2026'
ELECTION='6259'
EL='006259'
CONFIG_URL='https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json'
SOURCE_PAGE='https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/resultados'
OUT=Path(__file__).resolve().parents[1]/'data'/'radar-rn.json'
TZ=timezone(timedelta(hours=-3))
OFFICES={
    'sen': {'cargo':'0005','label':'Senador'},
    'depf': {'cargo':'0006','label':'Deputado federal'},
    'depe': {'cargo':'0007','label':'Deputado estadual'},
}

def fetch_json(url, timeout=25):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 UEFY-Radar-RN/2.0'})
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8-sig'))

def parse_number(v):
    try:return int(str(v or '0').replace('.','').replace(',','.').split('.')[0])
    except:return 0

def parse_pct(v):
    try:return float(str(v or '0').replace(',','.'))
    except:return 0.0

def walk_municipalities(node, uf=None, out=None):
    if out is None: out=[]
    if isinstance(node,list):
        for x in node: walk_municipalities(x,uf,out)
        return out
    if not isinstance(node,dict): return out
    local=str(node.get('sg') or node.get('uf') or node.get('cdabr') or node.get('abr') or uf or '').lower()
    if isinstance(node.get('mu'),list):
        maybe_state=str(node.get('cd') or '')
        if len(maybe_state)==2 and maybe_state.isalpha(): local=maybe_state.lower()
        for m in node['mu']:
            if not isinstance(m,dict): continue
            code=str(m.get('cd') or m.get('c') or m.get('cdmun') or m.get('mun') or m.get('codigo') or '').zfill(5)
            name=str(m.get('nm') or m.get('nmu') or m.get('nome') or m.get('ds') or m.get('descricao') or '').strip()
            if code and name: out.append({'uf':local,'code':code,'name':name})
    for k,v in node.items():
        if k!='mu': walk_municipalities(v,local,out)
    return out

def flatten_candidates(data):
    out=[]
    for cargo in data.get('carg',[]) or []:
        for agr in cargo.get('agr',[]) or []:
            for par in agr.get('par',[]) or []:
                for cand in par.get('cand',[]) or []:
                    number=str(cand.get('n') or cand.get('nsqcand') or '')
                    name=str(cand.get('nmu') or cand.get('nm') or ('Número '+number if number else 'Nome não informado'))
                    votes=parse_number(cand.get('vap'))
                    out.append({'id':number or name,'number':number,'name':name,'votes':votes,'seq':parse_number(cand.get('seq') or 999999)})
    return out

def progress_of(data):
    s=data.get('s') or {}
    if s.get('pst') is not None:return parse_pct(s.get('pst'))
    ts=parse_number(s.get('ts')); st=parse_number(s.get('st'))
    return st/ts*100 if ts else 0.0

def stamp_of(data):
    return ' · '.join([x for x in [str(data.get('dg') or '').strip(),str(data.get('hg') or '').strip()] if x])

def state_url(office):
    return f"{BASE}/{ELECTION}/dados/rn/rn-c{OFFICES[office]['cargo']}-e{EL}-u.json"

def municipality_url(code,office):
    return f"{BASE}/{ELECTION}/dados/rn/rn{code}-c{OFFICES[office]['cargo']}-e{EL}-u.json"

def pct(v):
    return f'{float(v):.1f}'.replace('.',',')+'%'

def integer(v):
    return f'{int(v):,}'.replace(',','.')

def finding(fid,typ,office,candidate,headline,summary,display,calculation,post_text,breakdown,card_note=None):
    return {
        'id':fid,'type':typ,'office':office,'candidate':candidate,'headline':headline,
        'summary':summary,'display_value':display,'calculation':calculation,'post_text':post_text,
        'breakdown':breakdown,'explanation':summary,'card_note':card_note or summary
    }

def waiting(message):
    now=datetime.now(TZ).isoformat(timespec='seconds')
    data={'status':'waiting','generated_at':now,'source_generated_at':None,'source_name':'Tribunal Superior Eleitoral · resultados oficiais','source_url':SOURCE_PAGE,'progress':0,'scope':'Rio Grande do Norte','offices':{},'findings':[],'message':message,'methodology_version':'2.0'}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(message)

def main():
    try:
        cfg=fetch_json(CONFIG_URL)
        municipalities=[m for m in walk_municipalities(cfg) if m['uf']=='rn']
    except Exception as e:
        waiting('A configuração oficial de municípios do TSE ainda não pôde ser carregada.')
        return
    if not municipalities:
        waiting('O TSE ainda não disponibilizou a lista de municípios necessária ao Radar RN.')
        return

    statewide={}
    for office in OFFICES:
        try:
            data=fetch_json(state_url(office))
            statewide[office]={'progress':progress_of(data),'stamp':stamp_of(data),'candidates':flatten_candidates(data)}
        except Exception:
            statewide[office]=None

    if not any(statewide.values()):
        waiting('Os resultados oficiais do RN ainda não estão disponíveis. O Radar será preenchido automaticamente quando o TSE publicar a apuração.')
        return

    per_office={o:defaultdict(lambda:{'name':'','total':0,'municipal':{},'natal':0}) for o in OFFICES}
    errors=0

    def task(m,office):
        data=fetch_json(municipality_url(m['code'],office))
        return m,office,flatten_candidates(data)

    futures=[]
    with ThreadPoolExecutor(max_workers=12) as ex:
        for m in municipalities:
            for office in OFFICES:
                if statewide.get(office):
                    futures.append(ex.submit(task,m,office))
        for fut in as_completed(futures):
            try:
                m,office,rows=fut.result()
                for c in rows:
                    if c['votes']<=0: continue
                    rec=per_office[office][c['id']]
                    rec['name']=c['name']; rec['number']=c['number']; rec['municipal'][m['name']]=c['votes']
                    if m['name'].strip().upper()=='NATAL': rec['natal']=c['votes']
            except Exception:
                errors+=1

    findings=[]; offices_meta={}; progress_values=[]; stamps=[]
    for office,meta in OFFICES.items():
        state=statewide.get(office)
        if not state: continue
        progress_values.append(state['progress'])
        if state['stamp']: stamps.append(state['stamp'])
        state_by={c['id']:c for c in state['candidates']}
        profiles=per_office[office]
        for cid,c in state_by.items():
            if c['votes']<=0: continue
            rec=profiles[cid]
            rec['name']=rec['name'] or c['name']; rec['number']=rec.get('number') or c['number']; rec['total']=c['votes']
            name=rec['name']; total=rec['total']; municipal=rec['municipal']
            if total<=0: continue
            covered=sum(1 for v in municipal.values() if v>0)
            natal=rec['natal']; natal_share=natal/total*100 if total else 0
            interior=max(0,total-natal); interior_share=interior/total*100 if total else 0
            ordered=sorted(municipal.items(),key=lambda x:x[1],reverse=True)
            top3=ordered[:3]; top3_votes=sum(v for _,v in top3); top3_share=top3_votes/total*100 if total else 0
            top_name,top_votes=(ordered[0] if ordered else ('—',0)); top_share=top_votes/total*100 if total else 0

            findings.append(finding(
                f'coverage-{office}-{cid}','territorial_coverage',office,name,
                f'{name} recebeu votos em {covered} dos 167 municípios do RN.',
                'O Radar conta em quantos municípios há ao menos um voto nominal registrado para esta candidatura.',
                f'{covered}/167',
                f'{covered} municípios com voto nominal registrado ÷ 167 municípios do RN.',
                f'{name} recebeu votos em {covered} dos 167 municípios do Rio Grande do Norte.',
                [{'label':'Municípios com votos','value':str(covered)},{'label':'Municípios do RN','value':'167'},{'label':'Votos no estado','value':integer(total)}]
            ))
            findings.append(finding(
                f'capital-{office}-{cid}','capital_share',office,name,
                f'Natal responde por {pct(natal_share)} dos votos de {name} contabilizados no RN.',
                'A participação da capital é calculada dividindo os votos nominais registrados em Natal pelo total estadual da candidatura.',
                pct(natal_share),
                f'{integer(natal)} votos em Natal ÷ {integer(total)} votos no RN = {pct(natal_share)}.',
                f'Natal concentra {pct(natal_share)} dos votos de {name} contabilizados no RN; o restante do estado responde por {pct(interior_share)}.',
                [{'label':'Natal','value':integer(natal)},{'label':'Demais municípios','value':integer(interior)},{'label':'Total no RN','value':integer(total)}]
            ))
            if top3:
                detail='; '.join([f'{n}: {integer(v)}' for n,v in top3])
                findings.append(finding(
                    f'top3-{office}-{cid}','top_municipalities',office,name,
                    f'Os três municípios com mais votos para {name} somam {pct(top3_share)} da votação estadual da candidatura.',
                    f'O município com maior número de votos nominais para esta candidatura é {top_name}, com {integer(top_votes)} votos ({pct(top_share)} do total estadual).',
                    pct(top3_share),
                    f'{integer(top3_votes)} votos nos três municípios com maior votação ÷ {integer(total)} votos no RN = {pct(top3_share)}.',
                    f'Os três municípios com mais votos para {name} somam {pct(top3_share)} da votação estadual registrada da candidatura.',
                    [{'label':'Três municípios','value':integer(top3_votes)},{'label':'Total no RN','value':integer(total)},{'label':'Maior votação municipal','value':top_name}],
                    card_note=detail
                ))
        offices_meta[office]={'label':meta['label'],'progress':state['progress'],'candidates_with_votes':sum(1 for c in state['candidates'] if c['votes']>0)}

    findings.sort(key=lambda f:(f['office'],f['candidate'],f['type']))
    now=datetime.now(TZ)
    progress=min(progress_values) if progress_values else 0
    data={
        'status':'ok','generated_at':now.isoformat(timespec='seconds'),
        'source_generated_at':max(stamps) if stamps else None,
        'source_name':'Tribunal Superior Eleitoral · resultados oficiais',
        'source_url':SOURCE_PAGE,'progress':round(progress,2),'scope':'Rio Grande do Norte',
        'offices':offices_meta,'municipalities':len(municipalities),'request_errors':errors,
        'findings':findings,'methodology_version':'2.0'
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f"Radar RN legislativo: {len(findings)} achados; {len(municipalities)} municípios; {errors} requisições sem resposta.")

if __name__=='__main__':
    try: main()
    except Exception as e:
        print('ERRO:',e,file=sys.stderr)
        waiting('O Radar RN não conseguiu concluir a leitura oficial nesta atualização. A próxima execução tentará novamente.')
