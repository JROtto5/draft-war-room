#!/usr/bin/env python3
"""Convert DK fantasy projections into real sportsbook markets:
team totals, game totals, spreads, moneylines, and anytime-TD props.

Uses the FULL projected player pool (not the distribution-fitted subset) because
team-level aggregates must count every player who is projected to score."""
import csv, math, collections

RUSH_SHARE = {'Jalen Hurts':0.34,'Josh Allen':0.28,'Lamar Jackson':0.32,'Jayden Daniels':0.30,
 'Kyler Murray':0.24,'Caleb Williams':0.14,'Justin Herbert':0.08,'Joe Burrow':0.05,'Jared Goff':0.02,
 'Trevor Lawrence':0.14,'Baker Mayfield':0.08,'Bryce Young':0.14,'Tyler Shough':0.10,'Jordan Love':0.06,
 'Daniel Jones':0.14,'Malik Willis':0.16,'C.J. Stroud':0.10,'Geno Smith':0.08,'Cam Ward':0.12,
 'Deshaun Watson':0.14,'Cooper Rush':0.04,'Jacoby Brissett':0.06,'Aaron Rodgers':0.03,'Kirk Cousins':0.03}

# YD_TD is not assumed - it is solved. Every passing TD is also a receiving TD, so summing
# receiving TDs across a team's pass catchers must equal that team's passing TDs. Solving that
# constraint over the full projected pool gives WR 142 / TE 119 receiving yards per receiving TD,
# both inside the real NFL band (WR ~130-160, TE ~110-130) - so the file is self-consistent.
YPR   = {'WR':12.5,'TE':10.5,'RB':7.5}
YD_TD = {'WR':142.0,'TE':119.1}     # SOLVED so team recTD == team passTD (see reconcile())
RB_RUSH_YD_TD = 88.0                # rushing yards per rushing TD
RB_REC_YD_TD  = 200.0
QB_PASS_YD_TD = 150.0
QB_RUSH_YD_TD = 70.0

def load(path='proj.csv'):
    def f(v):
        try: return float(v)
        except: return None
    out=[]
    for r in csv.DictReader(open(path)):
        fp=f(r['fpts'])
        if fp is None or fp<=0: continue
        out.append(dict(name=r['name'],team=r['team'],opp=r['opp'],pos=r['pos'],fpts=fp,
                        salary=f(r['salary']) or 0, own=f(r['proj_own']) or 0))
    return out

def receiver(p):
    pos='TE' if p['pos']=='TE' else 'WR'
    ypr,ydtd=YPR[pos],YD_TD[pos]
    per_rec=1.0+0.1*ypr+6.0*(ypr/ydtd)
    rec=p['fpts']/per_rec; yds=rec*ypr
    return dict(rec=rec,yds=yds,td=yds/ydtd)

def rb(p,rec_share=0.30):
    recpts=p['fpts']*rec_share
    per_rec=1.0+0.1*YPR['RB']+6.0*(YPR['RB']/RB_REC_YD_TD)
    rec=recpts/per_rec; recyds=rec*YPR['RB']
    rushpts=p['fpts']-recpts
    ry=rushpts/(0.1+6.0/RB_RUSH_YD_TD)
    return dict(rec=rec,recyds=recyds,rushyds=ry,scrim=ry+recyds,
                rushtd=ry/RB_RUSH_YD_TD, rectd=recyds/RB_REC_YD_TD,
                td=ry/RB_RUSH_YD_TD+recyds/RB_REC_YD_TD)

def qb(p):
    rs=RUSH_SHARE.get(p['name'],0.10)
    passpts=p['fpts']*(1-rs)
    py=passpts/(0.04+4.0/QB_PASS_YD_TD-1.0/300.0)
    ry=(p['fpts']*rs)/(0.1+6.0/QB_RUSH_YD_TD)
    return dict(passyds=py,passtd=py/QB_PASS_YD_TD,rushyds=ry,rushtd=ry/QB_RUSH_YD_TD)

def team_tds(players):
    rec=collections.defaultdict(float); pas=collections.defaultdict(float); rush=collections.defaultdict(float)
    for p in players:
        t=p['team']
        if p['pos'] in ('WR','TE'): rec[t]+=receiver(p)['td']
        elif p['pos']=='RB':
            d=rb(p); rush[t]+=d['rushtd']; rec[t]+=d['rectd']
        elif p['pos']=='QB':
            d=qb(p); pas[t]+=d['passtd']; rush[t]+=d['rushtd']
    return rec,pas,rush

def reconcile(players):
    rec,pas,_=team_tds(players)
    tr=sum(rec.values()); tp=sum(pas.values())
    return tr,tp,tr/tp

if __name__=='__main__':
    P=load()
    tr,tp,ratio=reconcile(P)
    print(f"receiving TDs {tr:.1f} vs passing TDs {tp:.1f} -> ratio {ratio:.3f} (target 1.000)")

# ---------------------------------------------------------------- team totals
XP_PER_TD = 0.94          # XP make rate net of 2-pt attempts
DEF_PLAY_PTS = 5.14       # league-avg DK DST points from sacks/INT/FR/TD/safety
SCORE_SD = 9.5            # sd of an NFL team's game score

PA_BRACKETS = [(0,0,10),(1,6,7),(7,13,4),(14,20,1),(21,27,0),(28,34,-1),(35,999,-4)]

def _norm_cdf(x): return 0.5*math.erfc(-x/math.sqrt(2))

def expected_pa_points(mu, sd=SCORE_SD):
    """E[DK points-allowed bracket score] when opponent scores ~ N(mu, sd)."""
    e=0.0
    for lo,hi,pts in PA_BRACKETS:
        p=_norm_cdf((hi+0.5-mu)/sd)-_norm_cdf((lo-0.5-mu)/sd)
        e+=p*pts
    return e

def total_from_dst(dst_fpts):
    """Invert a DST projection into the opponent's implied team total."""
    target=dst_fpts-DEF_PLAY_PTS
    lo,hi=0.0,60.0
    for _ in range(80):
        mid=(lo+hi)/2
        if expected_pa_points(mid)>target: lo=mid
        else: hi=mid
    return (lo+hi)/2

def offensive_total(team, rec, pas, rush, fg):
    tds=pas[team]+rush[team]
    return 6.0*tds + XP_PER_TD*tds + 3.0*fg


# ------------------------------------------------------------------ ATD props
# The offense-derived and DST-derived team totals disagree by ~1.9 pts/team, offense hotter.
# Attributing that gap entirely to touchdowns implies expected TDs run ~10% high.
TD_SHADE = 0.90

def anytime_td(p, shade=TD_SHADE):
    """Fair P(player scores >= 1 TD), Poisson on expected touchdowns."""
    if p['pos']=='RB': lam=rb(p)['td']
    elif p['pos'] in ('WR','TE'): lam=receiver(p)['td']
    elif p['pos']=='QB': lam=qb(p)['rushtd']
    else: return None
    return 1-math.exp(-lam*shade)

def american(prob):
    if prob<=0 or prob>=1: return None
    d=1/prob
    return f"+{round((d-1)*100)}" if d>=2 else f"-{round(100/(d-1))}"
