#!/usr/bin/env python3
"""Regenerate data.js for Draft War Room.

Inputs:
  --proj   projections CSV (PLAYER,TEAM,POS,...,PATD,...,PPR,HALF per-stat columns)
  --board  team board CSV (TEAM,QUARTERBACK,QBRANGE,W15..17,ADP columns)
  --season last completed season for actuals (default 2025)
  --out    output path (default: data.js next to repo root)

Fetches Sleeper's public player DB + season stats (no keys needed) for
headshots, bios, injury/depth info and last-season stat lines.
Cache files land in .cache/ so re-runs are offline-friendly.
"""
import argparse, csv, json, os, re, sys, datetime, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ALIASES = {
    "chigoziem okonkwo": "chig okonkwo",
    "cameron ward": "cam ward",
    "joshua palmer": "josh palmer",
    "marquise brown": "hollywood brown",
    "gabriel davis": "gabe davis",
}
def norm(name):
    n = name.lower().strip()
    n = re.sub(r"[.'\u2019\-]", "", n)
    n = re.sub(r"\s+(jr|sr|ii|iii|iv|v)$", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return ALIASES.get(n, n)

def fetch_json(url, cache_name):
    cache_dir = os.path.join(HERE, ".cache")
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, cache_name)
    if os.path.exists(path):
        return json.load(open(path))
    print("fetching", url, file=sys.stderr)
    with urllib.request.urlopen(url, timeout=90) as r:
        data = json.load(r)
    json.dump(data, open(path, "w"))
    return data

# ---------------- intel (pasted analyst + prop data, 2026 preseason) ----------------
TARGETS = {
 "Bhayshul Tuten": ("40-64","Door open to outplay Chris Rodriguez and win the lion's share."),
 "Bijan Robinson": ("1-6","Deployed rushing AND receiving - the peak is about to hit."),
 "Blake Corum": ("79-103","Shared workload, but injury-contingent league-winning upside."),
 "Brenton Strange": ("138-162","Career highs despite missing 5 games; PFF's 7th-graded TE."),
 "Brock Bowers": ("8-32","Could lead ALL TEs (and most WRs) in targets - miserable LV WR room."),
 "Caleb Williams": ("59-83","Ascending in an elite system, dual-threat for fantasy."),
 "Chase Brown": ("6-28","True 3-down workhorse in an offense that will put up numbers."),
 "Chig Okonkwo": ("127-151","Now TE1 in WAS - Daniels leans on the TE. 80-target upside."),
 "Christian Watson": ("46-70","Injury history keeps price low; career-year vibes at 27."),
 "Colston Loveland": ("35-59","Ascending talent, offensive focus - weekly wrecker."),
 "DeVonta Smith": ("10-38","True WR1 target share now; could ascend to alpha status."),
 "Drake London": ("8-32","True WR1 role at a 2nd-round price. Could go nuclear."),
 "Drake Maye": ("54-78","QB1 potential; unrealized rush upside + AJB in the pass game."),
 "Emeka Egbuka": ("21-45","Year-2 ascent looks promising with Evans gone."),
 "Greg Dulcich": ("166-190","Brutal situation but might be option 1 for targets, dirt cheap."),
 "Isaac TeSlaa": ("157-181","Born to make contested end-zone catches; upside for more."),
 "Ja'Marr Chase": ("1-5","125/1412/8 last year - repeat explosion well in play."),
 "Jahmyr Gibbs": ("1-6","True feature back: explosion, receiving, goal line, snaps."),
 "Jalen McMillan": ("133-157","TBB's possible WR2 - stands out in every opportunity."),
 "Jayden Higgins": ("112-136","6 TDs in limited '25 looks; role expanding in year two."),
 "Jonathan Taylor": ("2-12","The offense revolves around him; this year isn't forever."),
 "Jonathon Brooks": ("82-106","Mid-round price that could look 1st-round by Week 14."),
 "Josh Allen": ("24-48","Unmatched individual upside - QB1 without weapons, maybe upgraded."),
 "Josh Jacobs": ("29-53","Off-field issue suppressed the price; these usually resolve."),
 "Justin Herbert": ("70-94","Everything in LAC looks bullish; young ascending skill corps."),
 "Keaton Mitchell": ("125-149","Cheap points late; role could expand."),
 "Kenneth Walker III": ("6-27","Bigger receiving role in KC; Reid finds work for his ilk."),
 "Luther Burden": ("33-57","2.34 YPRR on <50% routes; full-time now. League-winner."),
 "Malik Willis": ("122-146","Cheapest QB with secure job + major rushing upside."),
 "Mark Andrews": ("113-137","Likely (the player) left; new OC signals pass-heavy. Bounce-back."),
 "Puka Nacua": ("1-5","Volume monster in a scheme that demands his usage."),
 "Rashid Shaheed": ("119-143","SEA deep threat in a Super Bowl offense; more than go routes."),
 "Ray Davis": ("178-202","Unmatched zero-to-hero injury-contingent upside, dirt cheap."),
 "Terrance Ferguson": ("171-195","Massive upside if workload consolidates; spike weeks anyway."),
 "Terry McLaurin": ("31-55","New offense intends to feature him with high target volume."),
 "Travis Etienne": ("26-50","NO paid up for their new stallion; could be uptempo."),
 "Travis Hunter": ("128-152","One WR injury changes it all; extremely cheap for the talent."),
 "Tre Tucker": ("144-168","They think he can be featured; lower price, could pay big."),
 "Trevor Lawrence": ("73-97","WR room 4-deep; passing game could go wild."),
 "Tyler Warren": ("52-76","One of IND's most targeted in '25; usage should only grow."),
 "Woody Marks": ("129-153","Role out of the gate; Montgomery ~90% to miss games."),
 "Zay Flowers": ("19-43",""),
}
PROPS = [
 ("Jerry Jeudy","rec yds","under",13.54),("Romeo Doubs","rec yds","under",11.95),
 ("Calvin Ridley","rec yds","under",8.87),("Jaxson Dart","rush yds","under",7.26),
 ("Kyler Murray","rush yds","under",6.15),("Justin Herbert","rush yds","under",5.9),
 ("T.J. Hockenson","rec yds","under",5.38),("Juwan Johnson","rec yds","under",5.24),
 ("George Kittle","rec TD","under",5.11),("Josh Downs","rec yds","under",4.96),
 ("Germie Bernard","rec yds","under",4.93),("Jadarian Price","rush yds","under",4.92),
 ("Malik Willis","pass yds","over",4.87),("Sam Darnold","pass yds","under",4.84),
 ("Dallas Goedert","rec TD","under",4.63),("Jayden Daniels","pass yds","over",4.49),
 ("Kyren Williams","rush yds","under",4.4),("De'Von Achane","rec yds","over",4.37),
 ("C.J. Stroud","pass yds","under",4.31),("De'Von Achane","rush yds","under",4.29),
 ("Dalton Schultz","rec yds","under",4.22),("Travis Kelce","rec yds","under",4.1),
 ("Ladd McConkey","rec yds","over",4.0),("Jalen Hurts","pass yds","under",3.98),
 ("Rashid Shaheed","rec yds","over",3.93),("Emeka Egbuka","rec yds","over",3.91),
 ("Jayden Daniels","rush yds","under",3.72),("Lamar Jackson","rush yds","over",3.72),
 ("Travis Etienne","rush yds","over",3.7),("Malik Willis","rush yds","under",3.66),
 ("Bijan Robinson","rec yds","over",3.62),("Omar Cooper","rec yds","under",3.38),
 ("Chris Godwin","rec yds","under",3.19),("Bhayshul Tuten","rush yds","over",3.18),
 ("Rashid Shaheed","rec TD","over",3.1),("Saquon Barkley","rush yds","over",3.04),
 ("Isaiah Likely","rec yds","under",3.02),("Jeremiyah Love","rush yds","under",2.97),
 ("Saquon Barkley","rec yds","under",2.92),("DeVonta Smith","rec TD","over",2.9),
 ("Greg Dulcich","rec yds","over",2.84),("Brian Thomas","rec TD","over",2.82),
 ("Rashod Bateman","rec yds","under",2.79),("Courtland Sutton","rec yds","under",2.74),
 ("Jakobi Meyers","rec yds","under",2.64),("Aaron Rodgers","pass yds","under",2.62),
 ("Amon-Ra St. Brown","rec yds","under",2.6),("DJ Moore","rec yds","over",2.58),
 ("Bijan Robinson","rec TD","over",2.56),
]

T2SLEEPER = {"SFO":"SF","GBP":"GB","KCC":"KC","NEP":"NE","NOS":"NO","TBB":"TB","LVR":"LV","JAC":"JAX"}
T2ESPN = {"ARI":"ari","ATL":"atl","BAL":"bal","BUF":"buf","CAR":"car","CHI":"chi","CIN":"cin","CLE":"cle",
"DAL":"dal","DEN":"den","DET":"det","GBP":"gb","HOU":"hou","IND":"ind","JAC":"jax","KCC":"kc","LAC":"lac",
"LAR":"lar","LVR":"lv","MIA":"mia","MIN":"min","NEP":"ne","NOS":"no","NYG":"nyg","NYJ":"nyj","PHI":"phi",
"PIT":"pit","SEA":"sea","SFO":"sf","TBB":"tb","TEN":"ten","WAS":"wsh"}
POSITIONS = ("QB","RB","WR","TE","DEF")

def f(row, col):
    try: return float(row.get(col) or 0)
    except ValueError: return 0.0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--proj", required=True)
    ap.add_argument("--board", required=True)
    ap.add_argument("--season", default="2025")
    ap.add_argument("--out", default=os.path.join(ROOT, "data.js"))
    args = ap.parse_args()

    # ---------- projections ----------
    players, proj26 = [], {}
    for row in csv.DictReader(open(args.proj)):
        name = (row.get("PLAYER") or "").strip()
        if not name: continue
        team, pos = row["TEAM"].strip(), row["POS"].strip()
        try: ppr, half = float(row["PPR"]), float(row["HALF"])
        except (ValueError, KeyError): continue
        patd = f(row, "PATD")
        ppr += 2*patd; half += 2*patd            # store as 6pt pass TD
        if pos == "DST":
            pos = "DEF"; name = name.split()[-1] + " D/ST"
        if pos in ("QB","RB","WR","TE") and ppr < 30: continue
        if pos not in POSITIONS: continue
        players.append({"name":name,"team":team,"pos":pos,"ppr":round(ppr,1),"half":round(half,1),"patd":round(patd,1)})
        proj26[norm(name)] = [round(f(row,"G"),1), round(f(row,"PAYDS")), round(patd,1), round(f(row,"INT"),1),
                              round(f(row,"RUYDS")), round(f(row,"RUTD"),1), round(f(row,"TAR")),
                              round(f(row,"REC")), round(f(row,"REYDS")), round(f(row,"RETD"),1)]
    best = {}
    for p in players:
        k = (norm(p["name"]), p["pos"])
        if k not in best or p["ppr"] > best[k]["ppr"]: best[k] = p
    players = sorted(best.values(), key=lambda p: -p["ppr"])

    # ---------- board: ADP, playoff weeks, team QBs ----------
    txt = open(args.board).read()
    adp = {}
    for m in re.finditer(r"(\d{1,3})-([A-Za-z.'\u2019\- ]+?)(?:<|\"|,|$)", txt):
        v, nm = int(m.group(1)), norm(m.group(2))
        if len(nm) >= 4 and (nm not in adp or v < adp[nm]): adp[nm] = v
    psos, teamqb = {}, {}
    for row in csv.DictReader(open(args.board)):
        team = re.sub(r"<[^>]+>", "", row.get("TEAM") or "").strip()
        if not team or len(team) > 3: continue
        qb = (row.get("QUARTERBACK") or "").strip()
        if qb: teamqb[team] = qb
        m = re.match(r"(\d+)-(\d+)$", (row.get("QBRANGE") or "").strip())
        if qb and m and norm(qb) not in adp:
            adp[norm(qb)] = (int(m.group(1)) + int(m.group(2))) // 2
        try:
            psos[team] = {"o":[row["W15"].strip(), row["W16"].strip(), row["W17"].strip()],
                          "r":[int(row["15RK"]), int(row["16RK"]), int(row["17RK"])]}
        except (KeyError, ValueError, AttributeError): pass

    # ---------- sleeper: ids, bio, injuries, depth; last-season stats ----------
    sleeper = fetch_json("https://api.sleeper.app/v1/players/nfl", "sleeper-players.json")
    seasons = [str(int(args.season)-2), str(int(args.season)-1), str(args.season)]
    stats_by = {y: fetch_json(f"https://api.sleeper.app/v1/stats/nfl/regular/{y}", f"stats-{y}.json") for y in seasons}
    stats = stats_by[str(args.season)]
    sidx = {}
    for pid, v in sleeper.items():
        if v.get("full_name") and pid.isdigit():
            sidx.setdefault((norm(v["full_name"]), v.get("position")), []).append((pid, v))
    # positional finish ranks per season
    finish_by = {}
    for y, sts in stats_by.items():
        f2 = {}
        for pos in ("QB","RB","WR","TE"):
            scored = []
            for pid, st in sts.items():
                pl = sleeper.get(pid)
                if pl and pl.get("position")==pos and st.get("pts_ppr"):
                    scored.append((pid, st["pts_ppr"]))
            scored.sort(key=lambda x: -x[1])
            for i, (pid, _) in enumerate(scored): f2[pid] = i+1
        finish_by[y] = f2
    finish = finish_by[str(args.season)]

    heads, meta, last, last3 = {}, {}, {}, {}
    for p in players:
        if p["pos"] == "DEF": continue
        k = norm(p["name"])
        cands = sidx.get((k, p["pos"])) or [c for kk, lst in sidx.items() if kk[0]==k for c in lst]
        if not cands: continue
        st_team = T2SLEEPER.get(p["team"], p["team"])
        pid, v = next((c for c in cands if c[1].get("team")==st_team), None) \
              or next((c for c in cands if c[1].get("active")), cands[0])
        heads[k] = int(pid)
        hi = v.get("height") or ""
        try: hgt = f"{int(hi)//12}'{int(hi)%12}\""
        except (ValueError, TypeError): hgt = str(hi)
        yexp = v.get("years_exp") if v.get("years_exp") is not None else -1
        rookie_yr = (int(args.season)+1 - yexp) if yexp >= 0 else 0
        meta[k] = [v.get("age") or 0, yexp,
                   v.get("college") or "", hgt, v.get("weight") or "", v.get("number") or 0,
                   v.get("injury_status") or "", v.get("depth_chart_order") or 0, v.get("depth_chart_position") or "",
                   v.get("injury_body_part") or "", (v.get("injury_notes") or "")[:160],
                   v.get("high_school") or "", rookie_yr, v.get("birth_date") or ""]
        hist = []
        for y in seasons:
            sy = stats_by[y].get(pid)
            if sy and sy.get("gp"):
                hist.append([int(y), round(sy.get("gp",0)), round(sy.get("pts_ppr",0),1), finish_by[y].get(pid,0),
                             round(sy.get("rec_tgt",0)), round(sy.get("pass_yd",0)), round(sy.get("rush_yd",0))])
        if hist: last3[k] = hist
        s = stats.get(pid)
        if s and s.get("gp"):
            last[k] = [round(s.get("gp",0)), round(s.get("pass_yd",0)), round(s.get("pass_td",0),1),
                       round(s.get("pass_int",0),1), round(s.get("rush_yd",0)), round(s.get("rush_td",0),1),
                       round(s.get("rec_tgt",0)), round(s.get("rec",0)), round(s.get("rec_yd",0)),
                       round(s.get("rec_td",0),1), round(s.get("pts_ppr",0),1), finish.get(pid, 0)]

    # ---------- ESPN injuries snapshot (baked offline baseline) ----------
    injbase = {}
    try:
        espn = fetch_json("https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries", "espn-injuries.json")
        ours = {norm(p["name"]) for p in players}
        for t in espn.get("injuries", []):
            for i in t.get("injuries", []):
                a = i.get("athlete") or {}
                k = norm(a.get("displayName") or "")
                st = i.get("status") or ""
                if not k or k not in ours or st.lower().startswith("active"): continue
                injbase[k] = [st, (i.get("shortComment") or i.get("longComment") or "")[:240], (i.get("date") or "")[:10]]
    except Exception as e:
        print("espn injuries snapshot failed:", e, file=sys.stderr)

    # ---------- prop/analyst intel ----------
    prop_agg = {}
    for nm, typ, side, edge in PROPS:
        e = prop_agg.setdefault(norm(nm), {"score":0.0, "notes":[]})
        e["score"] += (1 if side=="over" else -1)*edge
        e["notes"].append(f"{side} {typ} ({edge:g}% edge)")
    intel = {}
    for p in players:
        k, entry = norm(p["name"]), {}
        for tname,(rng,note) in TARGETS.items():
            if norm(tname)==k: entry["t"] = (note+" (range "+rng+")").strip()
        if k in prop_agg:
            s = prop_agg[k]["score"]
            entry["lean"] = 1 if s>1 else (-1 if s<-1 else 0)
            entry["p"] = "Prop market: " + "; ".join(prop_agg[k]["notes"])
        if entry: intel[k] = entry

    # ---------- emit ----------
    out = ["const RAW = ["]
    for p in players:
        out.append(json.dumps([p["name"],p["team"],p["pos"],p["ppr"],p["half"],adp.get(norm(p["name"]),0),p["patd"]], ensure_ascii=False)+",")
    out.append("];")
    out.append("const INTEL = " + json.dumps(intel, ensure_ascii=False) + ";")
    out.append("function normName(n){return n.toLowerCase().replace(/[.'\\u2019-]/g,'').replace(/\\s+(jr|sr|ii|iii|iv|v)$/,'').replace(/\\s+/g,' ').trim();}")
    out.append("const PSOS = " + json.dumps(psos, ensure_ascii=False) + ";")
    out.append("const HEADSHOT = " + json.dumps(heads, separators=(',',':')) + ";")
    out.append("const TEAMLOGO = " + json.dumps(T2ESPN, separators=(',',':')) + ";")
    out.append("const PLAYERMETA = " + json.dumps(meta, ensure_ascii=False, separators=(',',':')) + ";")
    out.append("const LASTSZN = " + json.dumps(last, separators=(',',':')) + ";")
    out.append("const PROJ26 = " + json.dumps(proj26, separators=(',',':')) + ";")
    out.append("const LAST3 = " + json.dumps(last3, separators=(',',':')) + ";")
    COLLEGES = {
      "Ohio State":["Big Ten","#BB0000"], "Michigan":["Big Ten","#00274C"], "Penn State":["Big Ten","#041E42"],
      "Alabama":["SEC","#9E1B32"], "Georgia":["SEC","#BA0C2F"], "LSU":["SEC","#461D7C"], "Texas":["SEC","#BF5700"],
      "Texas A&M":["SEC","#500000"], "Florida":["SEC","#0021A5"], "Tennessee":["SEC","#FF8200"],
      "Ole Miss":["SEC","#CE1126"], "Kentucky":["SEC","#0033A0"], "South Carolina":["SEC","#73000A"],
      "Auburn":["SEC","#0C2340"], "Missouri":["SEC","#F1B82D"], "Arkansas":["SEC","#9D2235"],
      "Oklahoma":["SEC","#841617"], "Clemson":["ACC","#F56600"], "Florida State":["ACC","#782F40"],
      "Miami":["ACC","#F47321"], "North Carolina":["ACC","#7BAFD4"], "Louisville":["ACC","#AD0000"],
      "Pittsburgh":["ACC","#003594"], "Boston College":["ACC","#8C2232"], "Notre Dame":["Ind","#0C2340"],
      "USC":["Big Ten","#990000"], "UCLA":["Big Ten","#2D68C4"], "Oregon":["Big Ten","#154733"],
      "Washington":["Big Ten","#4B2E83"], "Wisconsin":["Big Ten","#C5050C"], "Iowa":["Big Ten","#FFCD00"],
      "Minnesota":["Big Ten","#7A0019"], "Michigan State":["Big Ten","#18453B"], "Purdue":["Big Ten","#CEB888"],
      "Illinois":["Big Ten","#13294B"], "Nebraska":["Big Ten","#E41C38"], "Maryland":["Big Ten","#E03A3E"],
      "Rutgers":["Big Ten","#CC0033"], "Indiana":["Big Ten","#990000"], "Northwestern":["Big Ten","#4E2A84"],
      "Kansas State":["Big 12","#512888"], "TCU":["Big 12","#4D1979"], "Baylor":["Big 12","#154734"],
      "Texas Tech":["Big 12","#CC0000"], "Oklahoma State":["Big 12","#FF7300"], "Utah":["Big 12","#CC0000"],
      "Arizona":["Big 12","#AB0520"], "Arizona State":["Big 12","#8C1D40"], "Colorado":["Big 12","#CFB87C"],
      "West Virginia":["Big 12","#002855"], "Iowa State":["Big 12","#C8102E"], "UCF":["Big 12","#BA9B37"],
      "Cincinnati":["Big 12","#E00122"], "Houston":["Big 12","#C8102E"], "BYU":["Big 12","#002E5D"],
      "Wyoming":["MWC","#492F24"], "Boise State":["MWC","#0033A0"], "San Diego State":["MWC","#A6192E"],
      "Fresno State":["MWC","#DB0032"], "Toledo":["MAC","#003E7E"], "Ohio":["MAC","#00694E"],
      "North Dakota State":["FCS","#009A44"], "South Dakota State":["FCS","#0033A0"],
    }
    out.append("const COLLEGE = " + json.dumps(COLLEGES, ensure_ascii=False, separators=(',',':')) + ";")
    out.append("const TEAMQB = " + json.dumps(teamqb, ensure_ascii=False, separators=(',',':')) + ";")
    out.append("const INJBASE = " + json.dumps(injbase, ensure_ascii=False, separators=(',',':')) + ";")
    out.append('const LAST_SEASON = "' + args.season + '";')
    out.append('const DATA_STAMP = "' + datetime.date.today().isoformat() + '";')
    open(args.out, "w").write("\n".join(out) + "\n")
    print(f"wrote {args.out}: {len(players)} players, {len(heads)} headshots, {len(meta)} bios, {len(last)} stat lines, {len(last3)} 3yr histories, {len(intel)} intel, {len(injbase)} baked injuries", file=sys.stderr)

if __name__ == "__main__":
    main()
