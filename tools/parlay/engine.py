#!/usr/bin/env python3
# MIT License — see LICENSE. © 2026 JROtto5 / Draft War Room.
"""Parlay engine: lognormal marginals fit from RotoGrinders fpts/ceil/floor,
Gaussian-copula joint simulation for correlated same-game legs."""
import csv, math, random, collections

Z90 = 1.2815515655446004

def load(path='proj.csv'):
    rows = list(csv.DictReader(open(path)))
    def f(v):
        try: return float(v)
        except: return None
    out = []
    for r in rows:
        fp = f(r['fpts'])
        if fp is None or fp <= 0: continue
        ce, fl = f(r['ceil']), f(r['floor'])
        if ce is None or fl is None or fl <= 0 or ce <= fl: continue
        out.append(dict(name=r['name'], team=r['team'], opp=r['opp'], pos=r['pos'],
                        fpts=fp, ceil=ce, floor=fl,
                        own=f(r['proj_own']) or 0.0, salary=f(r['salary']) or 0.0))
    for p in out:
        # lognormal: median=fpts, ceil=P90, floor=P10 -> sigma from log-range
        p['mu'] = math.log(p['fpts'])
        p['sigma'] = math.log(p['ceil']/p['floor']) / (2*Z90)
        p['cv'] = math.sqrt(math.exp(p['sigma']**2)-1)
    return out

DST_WARNED = set()

def p_over(p, x):
    """P(player fpts >= x) under fitted lognormal.

    NOT VALID FOR DST: DST ceil/fpts median is 6.0x vs 2.0x for skill players, and
    sqrt(ceil*floor)/fpts runs 1.5-2.9 instead of ~1.0. The published DST 'ceil' is a
    max-case (def TD + shutout), not a P90, and two DSTs have floor <= 0. Any number this
    returns for a DST is meaningless."""
    if p.get('pos') == 'DST' and p['name'] not in DST_WARNED:
        DST_WARNED.add(p['name'])
        import sys; print(f"  !! WARNING: p_over() called on DST ({p['name']}) - lognormal fit is INVALID for DST, result is not usable", file=sys.stderr)
    if x <= 0: return 1.0
    z = (math.log(x) - p['mu']) / p['sigma']
    return 0.5 * math.erfc(z / math.sqrt(2))

def quantile(p, q):
    """Inverse CDF."""
    # Acklam-ish via erfinv through bisection (stdlib has no erfinv)
    lo, hi = 1e-6, p['fpts']*20
    for _ in range(200):
        mid = (lo+hi)/2
        if p_over(p, mid) > 1-q: lo = mid
        else: hi = mid
    return (lo+hi)/2

# ---------- correlation model (NFL-standard same-game structure) ----------
def corr(a, b):
    if a is b: return 1.0
    same_team = a['team'] == b['team']
    same_game = same_team or a['opp'] == b['team']
    if not same_game: return 0.0
    pa, pb = a['pos'], b['pos']
    key = tuple(sorted([pa, pb]))
    if same_team:
        table = {('QB','WR'):0.58, ('QB','TE'):0.50, ('QB','RB'):0.12,
                 ('RB','WR'):0.02, ('RB','TE'):0.02, ('TE','WR'):0.08,
                 ('WR','WR'):0.06, ('RB','RB'):-0.28, ('TE','TE'):-0.20,
                 ('QB','QB'):-0.60,
                 ('DST','QB'):-0.30, ('DST','RB'):0.05, ('DST','TE'):-0.20,
                 ('DST','WR'):-0.22, ('DST','DST'):1.0}
        return table.get(key, 0.0)
    # opponents: shootout correlation, positive but modest
    table = {('QB','QB'):0.22, ('QB','WR'):0.18, ('QB','TE'):0.15, ('QB','RB'):0.02,
             ('WR','WR'):0.16, ('TE','WR'):0.13, ('RB','WR'):0.02, ('TE','TE'):0.12,
             ('RB','RB'):-0.10, ('RB','TE'):0.02,
             ('DST','QB'):-0.42, ('DST','WR'):-0.34, ('DST','TE'):-0.30,
             ('DST','RB'):-0.22, ('DST','DST'):-0.35}
    return table.get(key, 0.0)

def _chol(M):
    n = len(M); L = [[0.0]*n for _ in range(n)]
    for i in range(n):
        for j in range(i+1):
            s = sum(L[i][k]*L[j][k] for k in range(j))
            if i == j:
                v = M[i][i]-s
                L[i][j] = math.sqrt(max(v, 1e-9))
            else:
                L[i][j] = (M[i][j]-s)/L[j][j]
    return L

def parlay_prob(legs, n=200000, seed=12345):
    """legs = [(player, threshold, 'over'|'under')]. Returns (joint_prob, naive_prob)."""
    rng = random.Random(seed)
    ps = [l[0] for l in legs]
    k = len(ps)
    M = [[corr(ps[i], ps[j]) if i!=j else 1.0 for j in range(k)] for i in range(k)]
    L = _chol(M)
    # per-leg z-threshold
    zt = []
    for p, x, side in legs:
        z = (math.log(x)-p['mu'])/p['sigma']
        zt.append((z, side))
    hits = 0
    for _ in range(n):
        g = [rng.gauss(0,1) for _ in range(k)]
        ok = True
        for i in range(k):
            zi = sum(L[i][j]*g[j] for j in range(i+1))
            z, side = zt[i]
            if side == 'over':
                if zi < z: ok = False; break
            else:
                if zi >= z: ok = False; break
        if ok: hits += 1
    joint = hits/n
    naive = 1.0
    for p, x, side in legs:
        q = p_over(p, x)
        naive *= q if side=='over' else (1-q)
    return joint, naive

def american(prob):
    if prob <= 0 or prob >= 1: return None
    dec = 1/prob
    return f"+{round((dec-1)*100)}" if dec >= 2 else f"-{round(100/(dec-1))}"

def find(players, name):
    for p in players:
        if p['name'].lower().startswith(name.lower()): return p
    raise KeyError(name)
