#!/usr/bin/env python3
# MIT License — see LICENSE. © 2026 JROtto5 / Draft War Room.
"""Parlay optimizer.
Simulate each GAME jointly once under the Gaussian copula, encode every (player,threshold)
outcome as a bitset over simulation trials, then score any parlay by bitset AND + popcount.
Correlation is fully preserved because all legs are read off the same joint sample."""
import engine, random, itertools, math

N = 60000
MULTS = [1.0, 1.15, 1.3, 1.45]

def simulate_games(players, seed=99):
    rng = random.Random(seed)
    games = {}
    for p in players:
        if p['pos'] == 'DST':      # lognormal invalid for DST - excluded by design
            continue
        games.setdefault(tuple(sorted([p['team'], p['opp']])), []).append(p)
    out = {}
    for g, ps in games.items():
        ps = sorted(ps, key=lambda x: -x['fpts'])[:9]
        k = len(ps)
        M = [[engine.corr(ps[i], ps[j]) if i != j else 1.0 for j in range(k)] for i in range(k)]
        L = engine._chol(M)
        # z-threshold per (player, multiplier)
        bits = {}
        for i, p in enumerate(ps):
            for m in MULTS:
                bits[(i, m)] = 0
        cols = [0]*k
        for t in range(N):
            gs = [rng.gauss(0, 1) for _ in range(k)]
            for i in range(k):
                zi = sum(L[i][j]*gs[j] for j in range(i+1))
                cols[i] = zi
            for i, p in enumerate(ps):
                for m in MULTS:
                    zt = (math.log(p['fpts']*m) - p['mu'])/p['sigma']
                    if cols[i] >= zt:
                        bits[(i, m)] |= (1 << t)
        out[g] = (ps, bits)
    return out

def popcount(x):
    return bin(x).count('1')

def search(sim, sizes=(3,4,5,6), top=6):
    """Return best parlay per (game, size, multiplier) by joint probability."""
    res = []
    for g, (ps, bits) in sim.items():
        idxs = list(range(len(ps)))
        for size in sizes:
            if size > len(ps): continue
            for m in MULTS:
                best = None
                for combo in itertools.combinations(idxs, size):
                    acc = (1 << N) - 1
                    for i in combo:
                        acc &= bits[(i, m)]
                        if acc == 0: break
                    c = popcount(acc)
                    if best is None or c > best[0]:
                        best = (c, combo)
                if best and best[0] > 0:
                    joint = best[0]/N
                    naive = 1.0
                    for i in best[1]:
                        naive *= engine.p_over(ps[i], ps[i]['fpts']*m)
                    res.append(dict(game='%s/%s' % g, size=size, mult=m, joint=joint, naive=naive,
                                    lift=joint/naive if naive > 0 else 0,
                                    legs=[(ps[i]['name'], ps[i]['pos'], ps[i]['team'],
                                           round(ps[i]['fpts']*m, 1)) for i in best[1]]))
    return res

if __name__ == '__main__':
    P = engine.load()
    print('simulating 12 games jointly (N=%d trials each)...' % N)
    sim = simulate_games(P)
    print('done. searching parlay space...\n')
    res = search(sim)
    res.sort(key=lambda r: -r['joint'])
    import json
    json.dump(res, open('opt_results.json','w'), indent=1)
    print('=== BEST SINGLE-GAME PARLAY AT EACH PAYOUT TIER ===\n')
    tiers = [(0.30,1.0,'~even money'),(0.15,0.30,'~+250 to +550'),(0.07,0.15,'~+600 to +1300'),
             (0.02,0.07,'~+1300 to +4900'),(0.005,0.02,'~+4900 to +20000'),(0.0,0.005,'20000+')]
    for lo,hi,lbl in tiers:
        band=[r for r in res if lo<=r['joint']<hi]
        if not band: continue
        band.sort(key=lambda r:-r['lift'])
        print(f"--- tier {lbl} (fair odds) — ranked by correlation lift ---")
        for r in band[:3]:
            print(f"  {r['game']:<9} {r['size']}legs @{r['mult']:.2f}x  joint={r['joint']:.4f} ({engine.american(r['joint'])})  naive={engine.american(r['naive'])}  LIFT {r['lift']:.2f}x")
            for n,pos,tm,th in r['legs']:
                print(f"        {n} ({pos},{tm}) over {th}")
        print()
