#!/usr/bin/env python3
import csv, io, json, math, os, re, sys, unicodedata, urllib.request, zipfile
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

ZIP_URL = 'https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2026.zip'
SOURCE_PAGE = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/prestacao-de-contas-eleitorais-2026'
OUT = Path(__file__).resolve().parents[1] / 'data' / 'radar-rn.json'
TZ = timezone(timedelta(hours=-3))

def norm(s):
    s = '' if s is None else str(s)
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'\s+', ' ', s).strip().upper()

def dec(v):
    if v is None: return 0.0
    s = str(v).strip().replace('R$', '').replace(' ', '')
    if not s: return 0.0
    if ',' in s:
        s = s.replace('.', '').replace(',', '.')
    try: return float(s)
    except: return 0.0

def brl(v):
    s = f'{float(v):,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    return 'R$ ' + s

def pct(v):
    return f'{float(v):.1f}'.replace('.', ',') + '%'

def compact(v):
    v=float(v or 0)
    if v>=1_000_000: return ('R$ '+f'{v/1_000_000:.2f}'.replace('.', ',')+' mi').replace(',00','')
    if v>=1_000: return ('R$ '+f'{v/1_000:.1f}'.replace('.', ',')+' mil').replace(',0','')
    return brl(v)

def get(row, *names):
    for n in names:
        if n in row and row[n] not in (None, ''): return row[n]
    return ''

def detect_kind(name):
    n=norm(name)
    if 'RECEITAS_CANDIDATOS' in n or ('RECEITA' in n and 'CANDIDAT' in n): return 'receipts'
    if 'DESPESAS_CONTRATADAS_CANDIDATOS' in n or ('DESPESA' in n and 'CONTRAT' in n and 'CANDIDAT' in n): return 'expenses'
    return None

def iter_csv(zf, member):
    raw=zf.read(member)
    text=None
    for enc in ('utf-8-sig','latin-1'):
        try:
            text=raw.decode(enc);break
        except UnicodeDecodeError: pass
    if text is None: text=raw.decode('latin-1','replace')
    sample=text[:8192]
    delim=';' if sample.count(';')>=sample.count(',') else ','
    rdr=csv.DictReader(io.StringIO(text), delimiter=delim)
    for row in rdr:
        yield {str(k).strip().lstrip('\ufeff'): v for k,v in row.items() if k is not None}

def is_rn_governor(row):
    return norm(get(row,'SG_UF'))=='RN' and 'GOVERNADOR' in norm(get(row,'DS_CARGO','NM_CARGO'))

def cand_key(row):
    return get(row,'SQ_CANDIDATO','NR_CANDIDATO','NM_CANDIDATO')

def cand_name(row):
    return get(row,'NM_URNA_CANDIDATO','NM_CANDIDATO') or 'Candidatura não identificada'

def cand_meta(row):
    return {'name':cand_name(row),'number':get(row,'NR_CANDIDATO'),'party':get(row,'SG_PARTIDO')}

def parse_source_stamp(row):
    d=get(row,'DT_GERACAO'); h=get(row,'HH_GERACAO')
    if not d:return None
    for fmt in ('%d/%m/%Y %H:%M:%S','%d/%m/%Y %H:%M','%d/%m/%Y'):
        try:
            val=(d+' '+h).strip() if '%H' in fmt else d
            dt=datetime.strptime(val,fmt).replace(tzinfo=TZ)
            return dt
        except: pass
    return None

def load_previous():
    try:
        return json.loads(OUT.read_text(encoding='utf-8'))
    except: return {}

def finding(fid, typ, headline, summary, display, calculation, post_text, candidate=None, candidates=None, breakdown=None, card_note=None):
    return {'id':fid,'type':typ,'headline':headline,'summary':summary,'display_value':display,'calculation':calculation,'post_text':post_text,'candidate':candidate,'candidates':candidates or [],'breakdown':breakdown or [],'explanation':summary,'card_note':card_note or summary}

def main():
    prev=load_previous(); prev_by={c.get('key'):c for c in prev.get('candidates',[]) if c.get('key')}
    req=urllib.request.Request(ZIP_URL, headers={'User-Agent':'Mozilla/5.0 UEFY-Radar-RN/1.0'})
    with urllib.request.urlopen(req, timeout=120) as r: payload=r.read()
    zf=zipfile.ZipFile(io.BytesIO(payload))
    members=[n for n in zf.namelist() if n.lower().endswith(('.csv','.txt'))]
    chosen={'receipts':[],'expenses':[]}
    for n in members:
        k=detect_kind(n)
        if k: chosen[k].append(n)
    if not chosen['receipts'] or not chosen['expenses']:
        raise RuntimeError('Não foi possível localizar receitas e despesas contratadas no ZIP oficial.')

    candidates={}
    rec_count=0; source_dt=None
    receipts=defaultdict(float); own=defaultdict(float)
    expenses=defaultdict(float); exp_by_cat=defaultdict(lambda:defaultdict(float)); exp_by_supplier=defaultdict(lambda:defaultdict(float)); exp_by_supplier_state=defaultdict(lambda:defaultdict(float)); supplier_names={}

    for member in chosen['receipts']:
        for row in iter_csv(zf,member):
            if not is_rn_governor(row): continue
            k=cand_key(row); candidates.setdefault(k,cand_meta(row)); rec_count+=1
            v=dec(get(row,'VR_RECEITA','VR_RECEITA_ESTIMAVEL'))
            receipts[k]+=v
            origin=norm(get(row,'DS_ORIGEM_RECEITA','DS_FONTE_RECEITA'))
            if 'RECURSOS PROPRIOS' in origin or 'RECURSO PROPRIO' in origin: own[k]+=v
            dt=parse_source_stamp(row); source_dt=max(source_dt,dt) if source_dt and dt else (dt or source_dt)

    for member in chosen['expenses']:
        for row in iter_csv(zf,member):
            if not is_rn_governor(row): continue
            k=cand_key(row); candidates.setdefault(k,cand_meta(row)); rec_count+=1
            v=dec(get(row,'VR_DESPESA_CONTRATADA','VR_DESPESA','VR_PAGTO_DESPESA'))
            if v<=0: continue
            expenses[k]+=v
            cat=get(row,'DS_ORIGEM_DESPESA','DS_TIPO_DESPESA','DS_DESPESA') or 'Não informado'
            exp_by_cat[k][cat]+=v
            sid=(get(row,'NR_CPF_CNPJ_FORNECEDOR','NR_CNPJ_CPF_FORNECEDOR') or get(row,'NM_FORNECEDOR','NM_FORNECEDOR_RFB') or 'sem-id').strip()
            sname=(get(row,'NM_FORNECEDOR_RFB','NM_FORNECEDOR') or 'Fornecedor não identificado').strip()
            supplier_names[sid]=sname
            exp_by_supplier[k][sid]+=v
            st=norm(get(row,'SG_UF_FORNECEDOR')) or 'NI'
            exp_by_supplier_state[k][st]+=v
            dt=parse_source_stamp(row); source_dt=max(source_dt,dt) if source_dt and dt else (dt or source_dt)

    findings=[]
    cand_list=[]
    for k,meta in sorted(candidates.items(), key=lambda kv: kv[1]['name']):
        total_e=expenses[k]; total_r=receipts[k]
        sups=sorted(exp_by_supplier[k].items(),key=lambda x:x[1],reverse=True)
        cats=sorted(exp_by_cat[k].items(),key=lambda x:x[1],reverse=True)
        top_sup=[{'name':supplier_names.get(s,'Fornecedor'),'value':round(v,2)} for s,v in sups[:5]]
        top_cat=[{'name':n,'value':round(v,2)} for n,v in cats[:5]]
        rec={'key':k,**meta,'receipts':round(total_r,2),'expenses':round(total_e,2),'own_resources':round(own[k],2),'top_suppliers':top_sup,'top_categories':top_cat}
        if total_r>0: rec['own_share']=round(own[k]/total_r*100,2)
        if total_e>0: rec['rn_supplier_share']=round(exp_by_supplier_state[k].get('RN',0)/total_e*100,2)
        cand_list.append(rec)
        name=meta['name']
        if total_e>0 and sups:
            top3=sum(v for _,v in sups[:3]); share=top3/total_e*100
            findings.append(finding(f'conc-{k}','supplier_concentration',f'Três fornecedores respondem por {pct(share)} das despesas contratadas de {name}.',f'O cálculo considera as despesas contratadas registradas na base processada e soma os três fornecedores com maior valor dentro desta candidatura.',pct(share),f'{brl(top3)} ÷ {brl(total_e)} = {pct(share)}',f'Três fornecedores respondem por {pct(share)} das despesas contratadas registradas de {name}.',candidate=name,breakdown=[{'label':'Três fornecedores','value':brl(top3)},{'label':'Despesas contratadas','value':brl(total_e)}],card_note='Proporção calculada sobre as despesas contratadas registradas na base oficial.'))
        if total_e>0 and cats:
            cat,val=cats[0]; share=val/total_e*100
            findings.append(finding(f'cat-{k}','expense_category',f'{cat} representa {pct(share)} das despesas contratadas de {name}.','O Radar agrupa as despesas pela classificação informada ao TSE e calcula a participação da categoria no total contratado.',pct(share),f'{brl(val)} ÷ {brl(total_e)} = {pct(share)}',f'{cat} representa {pct(share)} das despesas contratadas registradas de {name}.',candidate=name,breakdown=[{'label':cat,'value':brl(val)},{'label':'Despesas contratadas','value':brl(total_e)}]))
        if total_e>0:
            rnval=exp_by_supplier_state[k].get('RN',0); share=rnval/total_e*100
            findings.append(finding(f'rn-{k}','local_suppliers',f'Fornecedores identificados no RN concentram {pct(share)} das despesas contratadas de {name}.','O cálculo usa o campo de UF do fornecedor. Registros sem UF informada permanecem no denominador e não são tratados como fornecedores potiguares.',pct(share),f'{brl(rnval)} ÷ {brl(total_e)} = {pct(share)}',f'Fornecedores identificados no RN concentram {pct(share)} das despesas contratadas registradas de {name}.',candidate=name,breakdown=[{'label':'Fornecedores com UF = RN','value':brl(rnval)},{'label':'Despesas contratadas','value':brl(total_e)}]))
        if total_r>0 and own[k]>0:
            share=own[k]/total_r*100
            findings.append(finding(f'own-{k}','own_resources',f'Recursos próprios representam {pct(share)} das receitas registradas de {name}.','O Radar soma receitas cuja origem é identificada como recursos próprios e divide pelo total de receitas registradas para a candidatura.',pct(share),f'{brl(own[k])} ÷ {brl(total_r)} = {pct(share)}',f'Recursos próprios representam {pct(share)} das receitas registradas de {name}.',candidate=name,breakdown=[{'label':'Recursos próprios','value':brl(own[k])},{'label':'Receitas registradas','value':brl(total_r)}]))
        old=prev_by.get(k) or {}
        old_e=float(old.get('expenses') or 0); old_r=float(old.get('receipts') or 0)
        if old_e>0 and total_e-old_e>0.009:
            delta=total_e-old_e
            findings.append(finding(f'de-{k}','expense_change',f'{compact(delta)} em novas despesas contratadas apareceram para {name} desde o snapshot anterior.','A variação compara o total de despesas contratadas do snapshot atual com o último snapshot válido armazenado pela Central.',compact(delta),f'{brl(total_e)} − {brl(old_e)} = {brl(delta)}',f'Desde o snapshot anterior, a base passou a registrar {brl(delta)} a mais em despesas contratadas de {name}.',candidate=name,breakdown=[{'label':'Snapshot atual','value':brl(total_e)},{'label':'Snapshot anterior','value':brl(old_e)}]))
        if old_r>0 and total_r-old_r>0.009:
            delta=total_r-old_r
            findings.append(finding(f'dr-{k}','receipt_change',f'{compact(delta)} em novas receitas apareceram para {name} desde o snapshot anterior.','A variação compara o total de receitas registradas do snapshot atual com o último snapshot válido armazenado pela Central.',compact(delta),f'{brl(total_r)} − {brl(old_r)} = {brl(delta)}',f'Desde o snapshot anterior, a base passou a registrar {brl(delta)} a mais em receitas de {name}.',candidate=name,breakdown=[{'label':'Snapshot atual','value':brl(total_r)},{'label':'Snapshot anterior','value':brl(old_r)}]))

    common=defaultdict(list)
    for k in candidates:
        for sid,val in exp_by_supplier[k].items():
            if val>0: common[sid].append((k,val))
    for sid,items in common.items():
        if len(items)<2: continue
        names=[candidates[k]['name'] for k,_ in items]
        total=sum(v for _,v in items); sname=supplier_names.get(sid,'Fornecedor')
        findings.append(finding('common-'+re.sub(r'\W+','',sid)[-18:],'common_supplier',f'{sname} aparece como fornecedor em {len(items)} candidaturas ao Governo do RN.','O Radar encontrou o mesmo identificador de fornecedor em despesas contratadas de mais de uma candidatura. Isso descreve uma coincidência cadastral e não implica irregularidade.',f'{len(items)} campanhas',f'{len(items)} candidaturas possuem despesas contratadas associadas ao mesmo fornecedor.',f'{sname} aparece como fornecedor em despesas contratadas de {len(items)} candidaturas ao Governo do RN.',candidates=names,breakdown=[{'label':candidates[k]['name'],'value':brl(v)} for k,v in sorted(items,key=lambda x:x[1],reverse=True)[:6]],card_note='Fornecedor em comum na base de despesas contratadas. O dado, por si só, não indica irregularidade.'))

    # Ordenação técnica: mudanças primeiro, depois relações entre campanhas, depois indicadores individuais.
    priority={'expense_change':0,'receipt_change':0,'common_supplier':1,'supplier_concentration':2,'expense_category':3,'local_suppliers':4,'own_resources':5}
    findings.sort(key=lambda f:(priority.get(f['type'],9),f.get('candidate') or '',f['id']))
    now=datetime.now(TZ)
    data={'status':'ok','generated_at':now.isoformat(timespec='seconds'),'source_generated_at':source_dt.isoformat(timespec='seconds') if source_dt else None,'source_name':'TSE / Dados Abertos — Prestação de contas de candidatos 2026','source_url':SOURCE_PAGE,'source_download_url':ZIP_URL,'records':rec_count,'scope':'Rio Grande do Norte','office':'Governador','methodology_version':'1.0','candidates':cand_list,'findings':findings}
    OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Radar RN: {len(cand_list)} candidaturas, {len(findings)} achados, {rec_count} registros RN processados.')

if __name__=='__main__':
    try: main()
    except Exception as e:
        print('ERRO:',e,file=sys.stderr);sys.exit(1)
