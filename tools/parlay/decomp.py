#!/usr/bin/env python3
# MIT License — see LICENSE. © 2026 JROtto5 / Draft War Room.
"""Translate DK fantasy-point projections into implied conventional stat lines.
DK scoring: rec 1.0 | rec/rush yd 0.1 | pass yd 0.04 | rec/rush TD 6 | pass TD 4 | INT -1
            +3 bonus at 100 rush yds, 100 rec yds, 300 pass yds."""
import engine, math

# position assumptions (league-typical, stated openly)
YPR   = {'WR': 12.5, 'TE': 10.5, 'RB': 7.5}     # yards per reception
YD_TD = {'WR': 155.0, 'TE': 130.0}              # receiving yards per receiving TD

def p_bonus(p, yards_median, thresh=100.0):
    """P(yards >= thresh) approximated by scaling the player's own fpts lognormal."""
    if yards_median <= 0: return 0.0
    z = (math.log(thresh) - math.log(yards_median)) / p['sigma']
    return 0.5*math.erfc(z/math.sqrt(2))

def receiver(p):
    pos = 'TE' if p['pos']=='TE' else 'WR'
    ypr, ydtd = YPR[pos], YD_TD[pos]
    per_rec = 1.0 + 0.1*ypr + 6.0*(ypr/ydtd)
    rec = p['fpts']/per_rec
    for _ in range(30):                      # iterate to settle the 100-yd bonus
        yds = rec*ypr
        rec = (p['fpts'] - 3.0*p_bonus(p, yds))/per_rec
    yds = rec*ypr
    return dict(rec=rec, yds=yds, td=yds/ydtd)

def rb(p, rec_share=0.30):
    """rec_share = fraction of DK points from the receiving game (typical modern RB ~0.3)."""
    recpts = p['fpts']*rec_share
    per_rec = 1.0 + 0.1*YPR['RB'] + 6.0*(YPR['RB']/220.0)
    rec = recpts/per_rec
    recyds = rec*YPR['RB']
    rushpts = p['fpts'] - recpts
    # rush pts = 0.1*yds + 6*td + 3*P(100); td ~ yds/85 for a lead back
    per_yd = 0.1 + 6.0/95.0
    ry = rushpts/per_yd
    for _ in range(30):
        ry = (rushpts - 3.0*p_bonus(p, ry))/per_yd
    return dict(rec=rec, recyds=recyds, rushyds=ry, td=ry/95.0 + recyds/220.0,
                scrim=ry+recyds)

def qb(p, rush_share=0.0):
    passpts = p['fpts']*(1-rush_share)
    # pass pts = 0.04*yds + 4*td - 1*int + 3*P(300); td ~ yds/115, int ~ yds/300
    per_yd = 0.04 + 4.0/150.0 - 1.0/300.0
    py = passpts/per_yd
    for _ in range(30):
        py = (passpts - 3.0*p_bonus(p, py, 300.0))/per_yd
    rushpts = p['fpts']*rush_share
    ry = rushpts/(0.1 + 6.0/70.0)
    return dict(passyds=py, passtd=py/150.0, rushyds=ry, rushtd=ry/70.0)

if __name__ == '__main__':
    P = engine.load()
    RUSHY = {'Jalen Hurts':0.34,'Josh Allen':0.28,'Lamar Jackson':0.32,'Jayden Daniels':0.30,
             'Kyler Murray':0.24,'Caleb Williams':0.14,'Justin Herbert':0.08,'Joe Burrow':0.05,
             'Jared Goff':0.02,'Trevor Lawrence':0.14,'Baker Mayfield':0.08,'Bryce Young':0.14,
             'Tyler Shough':0.10,'Jordan Love':0.06,'Daniel Jones':0.14,'Malik Willis':0.16}
    print("=== IMPLIED STAT LINES (assumptions stated in decomp.py) ===\n")
    print("QB  (pass yds / pass TD / rush yds)")
    for p in sorted([x for x in P if x['pos']=='QB'], key=lambda x:-x['fpts'])[:12]:
        d = qb(p, RUSHY.get(p['name'], 0.10))
        print(f"  {p['name']:<20} {p['team']:<4} {p['fpts']:5.1f}fp -> {d['passyds']:5.0f} pass yds, {d['passtd']:4.2f} pass TD, {d['rushyds']:4.0f} rush yds")
    print("\nRB  (rush yds / rec / scrimmage yds / total TD)")
    for p in sorted([x for x in P if x['pos']=='RB'], key=lambda x:-x['fpts'])[:14]:
        d = rb(p)
        print(f"  {p['name']:<20} {p['team']:<4} {p['fpts']:5.1f}fp -> {d['rushyds']:5.0f} rush, {d['rec']:4.1f} rec, {d['scrim']:5.0f} scrim, {d['td']:4.2f} TD")
    print("\nWR/TE  (rec / rec yds / rec TD)")
    for p in sorted([x for x in P if x['pos'] in ('WR','TE')], key=lambda x:-x['fpts'])[:20]:
        d = receiver(p)
        print(f"  {p['name']:<20} {p['team']:<4} {p['pos']} {p['fpts']:5.1f}fp -> {d['rec']:4.1f} rec, {d['yds']:5.0f} yds, {d['td']:4.2f} TD")
