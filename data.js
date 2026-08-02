/* =====================================================================
   PLAYER DATA — 2026 season projections (PPR-flavored).
   QB totals already reflect 6-POINT PASSING TDS (≈ +2 pts per pass TD
   over standard). Edit any number in-app by clicking it.
   ===================================================================== */
const RAW = [
["Josh Allen", "BUF", "QB", 417.0, 403.2, 36, 25.6],
["Joe Burrow", "CIN", "QB", 367.1, 349.6, 68, 29.5],
["Lamar Jackson", "BAL", "QB", 361.3, 351.1, 55, 23.6],
["Drake Maye", "NEP", "QB", 360.2, 346.9, 65, 24.6],
["Justin Herbert", "LAC", "QB", 356.5, 344.9, 81, 27.0],
["Trevor Lawrence", "JAC", "QB", 354.8, 340.4, 85, 24.3],
["Caleb Williams", "CHI", "QB", 348.0, 333.4, 71, 22.9],
["Jahmyr Gibbs", "DET", "RB", 346.9, 296.8, 1, 0.0],
["Dak Prescott", "DAL", "QB", 344.4, 328.6, 79, 25.4],
["Jayden Daniels", "WAS", "QB", 341.8, 328.5, 67, 19.4],
["Bijan Robinson", "ATL", "RB", 339.3, 283.1, 2, 0.0],
["Matthew Stafford", "LAR", "QB", 334.8, 320.9, 105, 28.1],
["Jared Goff", "DET", "QB", 332.0, 316.8, 111, 27.1],
["Ja'Marr Chase", "CIN", "WR", 331.6, 256.0, 3, 0.0],
["Bo Nix", "DEN", "QB", 329.4, 319.6, 105, 23.5],
["Brock Purdy", "SFO", "QB", 328.9, 314.3, 97, 24.5],
["Jordan Love", "GBP", "QB", 324.4, 311.9, 113, 23.7],
["Jalen Hurts", "PHI", "QB", 320.6, 313.1, 70, 19.3],
["Tyler Shough", "NOS", "QB", 318.2, 307.1, 123, 23.3],
["Jaxson Dart", "NYG", "QB", 315.9, 305.3, 101, 18.3],
["Baker Mayfield", "TBB", "QB", 311.3, 300.4, 119, 22.5],
["Puka Nacua", "LAR", "WR", 307.1, 237.2, 4, 0.0],
["Patrick Mahomes", "KCC", "QB", 300.7, 289.8, 92, 21.6],
["Jonathan Taylor", "IND", "RB", 294.0, 253.6, 8, 0.0],
["Christian McCaffrey", "SFO", "RB", 294.0, 251.3, 6, 0.0],
["C.J. Stroud", "HOU", "QB", 293.3, 284.0, 143, 21.9],
["Sam Darnold", "SEA", "QB", 290.4, 279.9, 140, 22.4],
["Jaxon Smith-Njigba", "SEA", "WR", 288.9, 224.4, 5, 0.0],
["Kyler Murray", "MIN", "QB", 287.1, 278.7, 112, 18.8],
["Cam Ward", "TEN", "QB", 280.9, 270.2, 138, 18.1],
["Malik Willis", "MIA", "QB", 278.1, 269.4, 134, 12.8],
["Daniel Jones", "IND", "QB", 276.0, 270.2, 146, 17.9],
["Amon-Ra St. Brown", "DET", "WR", 272.6, 210.0, 7, 0.0],
["Bryce Young", "CAR", "QB", 270.8, 263.1, 159, 19.2],
["James Cook", "BUF", "RB", 269.4, 235.2, 12, 0.0],
["Chase Brown", "CIN", "RB", 267.3, 229.6, 16, 0.0],
["CeeDee Lamb", "DAL", "WR", 266.8, 206.5, 9, 0.0],
["Justin Jefferson", "MIN", "WR", 258.1, 199.8, 10, 0.0],
["Ashton Jeanty", "LVR", "RB", 254.9, 215.2, 11, 0.0],
["DeVonta Smith", "PHI", "WR", 251.4, 194.8, 26, 0.0],
["Brock Bowers", "LVR", "TE", 249.4, 184.8, 21, 0.0],
["Saquon Barkley", "PHI", "RB", 248.5, 217.4, 13, 0.0],
["Drake London", "ATL", "WR", 248.0, 191.7, 20, 0.0],
["Rashee Rice", "KCC", "WR", 247.8, 190.6, 24, 0.0],
["Aaron Rodgers", "PIT", "QB", 247.0, 239.1, 176, 19.4],
["Omarion Hampton", "LAC", "RB", 241.8, 209.3, 14, 0.0],
["Zay Flowers", "BAL", "WR", 240.1, 186.6, 30, 0.0],
["Derrick Henry", "BAL", "RB", 239.3, 214.9, 17, 0.0],
["Nico Collins", "HOU", "WR", 239.3, 187.3, 22, 0.0],
["Ladd McConkey", "LAC", "WR", 237.0, 186.9, 35, 0.0],
["A.J. Brown", "NEP", "WR", 236.1, 184.6, 19, 0.0],
["Kenneth Walker III", "KCC", "RB", 233.3, 202.2, 15, 0.0],
["Devon Achane", "MIA", "RB", 232.1, 197.1, 18, 0.0],
["Trey McBride", "ARI", "TE", 228.8, 167.8, 27, 0.0],
["Emeka Egbuka", "TBB", "WR", 227.7, 180.0, 33, 0.0],
["George Pickens", "DAL", "WR", 225.2, 175.7, 23, 0.0],
["Malik Nabers", "NYG", "WR", 223.6, 173.4, 31, 0.0],
["Luther Burden", "CHI", "WR", 223.4, 174.3, 45, 0.0],
["Chris Olave", "NOS", "WR", 222.8, 174.0, 29, 0.0],
["Travis Etienne", "NOS", "RB", 220.3, 193.1, 38, 0.0],
["Garrett Wilson", "NYJ", "WR", 218.2, 167.3, 40, 0.0],
["Tee Higgins", "CIN", "WR", 217.3, 169.4, 34, 0.0],
["Breece Hall", "NYJ", "RB", 216.2, 185.0, 27, 0.0],
["Terry McLaurin", "WAS", "WR", 215.1, 167.4, 43, 0.0],
["Tetairoa McMillan", "CAR", "WR", 215.0, 170.5, 39, 0.0],
["Colston Loveland", "CHI", "TE", 214.4, 163.1, 47, 0.0],
["Josh Jacobs", "GBP", "RB", 211.1, 187.2, 41, 0.0],
["Jaylen Waddle", "DEN", "WR", 210.6, 165.4, 42, 0.0],
["Mike Evans", "SFO", "WR", 209.3, 165.5, 46, 0.0],
["Javonte Williams", "DAL", "RB", 209.2, 182.0, 37, 0.0],
["D.J. Moore", "BUF", "WR", 208.3, 166.8, 57, 0.0],
["Jacoby Brissett", "ARI", "QB", 207.2, 202.9, 193, 14.0],
["Fernando Mendoza", "LVR", "QB", 205.6, 203.8, 0, 13.4],
["Geno Smith", "NYJ", "QB", 204.0, 198.6, 185, 13.3],
["Kyren Williams", "LAR", "RB", 202.3, 181.5, 32, 0.0],
["Davante Adams", "LAR", "WR", 197.2, 157.2, 49, 0.0],
["Bhayshul Tuten", "JAC", "RB", 192.9, 170.9, 53, 0.0],
["Tyler Warren", "IND", "TE", 189.8, 142.8, 64, 0.0],
["Cam Skattebo", "NYG", "RB", 189.3, 163.1, 44, 0.0],
["Jameson Williams", "DET", "WR", 187.9, 149.5, 51, 0.0],
["Parker Washington", "JAC", "WR", 185.6, 143.6, 66, 0.0],
["Jeremiyah Love", "ARI", "RB", 183.4, 160.0, 25, 0.0],
["Christian Watson", "GBP", "WR", 183.4, 147.0, 58, 0.0],
["Quinshon Judkins", "CLE", "RB", 182.9, 159.6, 54, 0.0],
["D'Andre Swift", "CHI", "RB", 179.4, 157.9, 50, 0.0],
["Rome Odunze", "CHI", "WR", 178.8, 144.4, 60, 0.0],
["David Montgomery", "HOU", "RB", 177.1, 157.2, 48, 0.0],
["Carnell Tate", "TEN", "WR", 176.5, 138.4, 59, 0.0],
["Kyle Pitts", "ATL", "TE", 176.3, 133.8, 104, 0.0],
["Michael Wilson", "ARI", "WR", 175.1, 135.0, 98, 0.0],
["TreVeyon Henderson", "NEP", "RB", 174.9, 152.4, 52, 0.0],
["Rhamondre Stevenson", "NEP", "RB", 174.3, 151.3, 0, 0.0],
["Jordyn Tyson", "NOS", "WR", 171.2, 133.7, 63, 0.0],
["Tony Pollard", "TEN", "RB", 170.8, 150.9, 72, 0.0],
["Bucky Irving", "TBB", "RB", 169.8, 148.8, 56, 0.0],
["Harold Fannin", "CLE", "TE", 169.6, 128.4, 103, 0.0],
["Brian Thomas", "JAC", "WR", 168.5, 137.5, 61, 0.0],
["D.K. Metcalf", "PIT", "WR", 168.3, 134.9, 76, 0.0],
["Courtland Sutton", "DEN", "WR", 166.7, 134.2, 83, 0.0],
["Alec Pierce", "IND", "WR", 166.3, 134.5, 80, 0.0],
["Marvin Harrison", "ARI", "WR", 161.6, 128.6, 69, 0.0],
["Jaylen Warren", "PIT", "RB", 158.8, 137.1, 73, 0.0],
["Josh Downs", "IND", "WR", 158.5, 121.3, 90, 0.0],
["Rico Dowdle", "PIT", "RB", 158.5, 136.0, 0, 0.0],
["Tucker Kraft", "GBP", "TE", 158.4, 122.0, 82, 0.0],
["Michael Pittman", "PIT", "WR", 157.6, 123.4, 100, 0.0],
["Tua Tagovailoa", "ATL", "QB", 154.4, 154.1, 208, 11.8],
["Broncos D/ST", "DEN", "DEF", 152.9, 152.9, 0, 0.0],
["Blake Corum", "LAR", "RB", 152.7, 136.2, 0, 0.0],
["RJ Harvey", "DEN", "RB", 152.6, 131.0, 86, 0.0],
["Texans D/ST", "HOU", "DEF", 152.5, 152.5, 0, 0.0],
["Rams D/ST", "LAR", "DEF", 151.8, 151.8, 0, 0.0],
["Packers D/ST", "GBP", "DEF", 151.6, 151.6, 0, 0.0],
["Seahawks D/ST", "SEA", "DEF", 151.5, 151.5, 0, 0.0],
["Makai Lemon", "PHI", "WR", 151.1, 116.3, 73, 0.0],
["Vikings D/ST", "MIN", "DEF", 150.7, 150.7, 0, 0.0],
["Jayden Reed", "GBP", "WR", 150.3, 122.0, 84, 0.0],
["Lions D/ST", "DET", "DEF", 149.7, 149.7, 0, 0.0],
["Wan'Dale Robinson", "TEN", "WR", 149.4, 115.3, 115, 0.0],
["Rashid Shaheed", "SEA", "WR", 149.3, 120.2, 130, 0.0],
["Matthew Golden", "GBP", "WR", 149.1, 116.9, 110, 0.0],
["Steelers D/ST", "PIT", "DEF", 149.0, 149.0, 0, 0.0],
["Sam LaPorta", "DET", "TE", 148.7, 115.5, 93, 0.0],
["Chuba Hubbard", "CAR", "RB", 148.3, 131.2, 78, 0.0],
["Bills D/ST", "BUF", "DEF", 148.3, 148.3, 0, 0.0],
["Eagles D/ST", "PHI", "DEF", 147.3, 147.3, 0, 0.0],
["Chargers D/ST", "LAC", "DEF", 147.0, 147.0, 0, 0.0],
["Chiefs D/ST", "KCC", "DEF", 146.7, 146.7, 0, 0.0],
["Dalton Kincaid", "BUF", "TE", 146.6, 114.1, 127, 0.0],
["Ravens D/ST", "BAL", "DEF", 146.3, 146.3, 0, 0.0],
["Quentin Johnston", "LAC", "WR", 146.2, 121.6, 75, 0.0],
["Kenneth Gainwell", "TBB", "RB", 146.2, 120.7, 0, 0.0],
["Giants D/ST", "NYG", "DEF", 145.7, 145.7, 0, 0.0],
["Kyle Monangai", "CHI", "RB", 145.2, 128.2, 0, 0.0],
["49ers D/ST", "SFO", "DEF", 144.2, 144.2, 0, 0.0],
["Jordan Addison", "MIN", "WR", 143.9, 113.6, 88, 0.0],
["Buccaneers D/ST", "TBB", "DEF", 143.7, 143.7, 0, 0.0],
["Chris Godwin", "TBB", "WR", 143.7, 112.1, 89, 0.0],
["Saints D/ST", "NOS", "DEF", 143.0, 143.0, 0, 0.0],
["Mark Andrews", "BAL", "TE", 142.9, 114.7, 125, 0.0],
["Jayden Higgins", "HOU", "WR", 142.8, 114.2, 124, 0.0],
["Jake Ferguson", "DAL", "TE", 141.5, 107.5, 131, 0.0],
["Cowboys D/ST", "DAL", "DEF", 141.4, 141.4, 0, 0.0],
["Falcons D/ST", "ATL", "DEF", 141.3, 141.3, 0, 0.0],
["Khalil Shakir", "BUF", "WR", 141.0, 109.3, 126, 0.0],
["Bears D/ST", "CHI", "DEF", 141.0, 141.0, 0, 0.0],
["Patriots D/ST", "NEP", "DEF", 140.7, 140.7, 0, 0.0],
["Jakobi Meyers", "JAC", "WR", 140.3, 111.0, 106, 0.0],
["J.K. Dobbins", "DEN", "RB", 140.1, 125.2, 0, 0.0],
["Colts D/ST", "IND", "DEF", 140.1, 140.1, 0, 0.0],
["Jalen Coker", "CAR", "WR", 139.8, 108.5, 132, 0.0],
["Rachaad White", "WAS", "RB", 139.7, 120.0, 109, 0.0],
["Jaguars D/ST", "JAC", "DEF", 139.5, 139.5, 0, 0.0],
["Jalen McMillan", "TBB", "WR", 139.4, 111.3, 145, 0.0],
["Browns D/ST", "CLE", "DEF", 139.3, 139.3, 0, 0.0],
["Jets D/ST", "NYJ", "DEF", 139.2, 139.2, 0, 0.0],
["Deebo Samuel", "SFO", "WR", 138.6, 109.2, 164, 0.0],
["George Kittle", "SFO", "TE", 138.4, 107.9, 116, 0.0],
["KC Concepcion", "CLE", "WR", 138.3, 109.8, 118, 0.0],
["Jonathon Brooks", "CAR", "RB", 138.0, 119.3, 0, 0.0],
["Brenton Strange", "JAC", "TE", 137.7, 106.1, 150, 0.0],
["Titans D/ST", "TEN", "DEF", 136.0, 136.0, 0, 0.0],
["Bengals D/ST", "CIN", "DEF", 135.9, 135.9, 0, 0.0],
["Commanders D/ST", "WAS", "DEF", 135.8, 135.8, 0, 0.0],
["Raiders D/ST", "LVR", "DEF", 135.7, 135.7, 0, 0.0],
["Chigoziem Okonkwo", "WAS", "TE", 135.6, 102.4, 139, 0.0],
["Xavier Worthy", "KCC", "WR", 135.3, 112.3, 95, 0.0],
["Dolphins D/ST", "MIA", "DEF", 134.5, 134.5, 0, 0.0],
["Panthers D/ST", "CAR", "DEF", 133.8, 133.8, 0, 0.0],
["Travis Hunter", "JAC", "WR", 132.0, 105.0, 0, 0.0],
["Travis Kelce", "KCC", "TE", 131.9, 101.7, 122, 0.0],
["Cardinals D/ST", "ARI", "DEF", 131.7, 131.7, 0, 0.0],
["Tre Tucker", "LVR", "WR", 131.1, 107.4, 154, 0.0],
["Jadarian Price", "SEA", "RB", 131.1, 121.5, 62, 0.0],
["Aaron Jones", "MIN", "RB", 129.9, 114.5, 0, 0.0],
["Jordan Mason", "MIN", "RB", 129.3, 115.0, 114, 0.0],
["Michael Penix", "ATL", "QB", 128.2, 128.1, 0, 9.6],
["Deshaun Watson", "CLE", "QB", 127.5, 127.2, 237, 8.0],
["Isaiah Likely", "NYG", "TE", 126.6, 97.4, 129, 0.0],
["Dallas Goedert", "PHI", "TE", 125.9, 97.1, 135, 0.0],
["Shedeur Sanders", "CLE", "QB", 123.6, 123.3, 0, 7.8],
["Jo'quavioius Marks", "HOU", "RB", 121.2, 106.9, 0, 0.0],
["Keaton Mitchell", "LAC", "RB", 119.9, 106.6, 0, 0.0],
["Tyler Allgeier", "ARI", "RB", 119.7, 106.6, 0, 0.0],
["Jauan Jennings", "MIN", "WR", 119.5, 94.2, 153, 0.0],
["Jacory Croskey-Merritt", "WAS", "RB", 117.2, 103.8, 0, 0.0],
["Ryan Flournoy", "DAL", "WR", 116.9, 92.3, 161, 0.0],
["Kenyon Sadiq", "NYJ", "TE", 116.1, 91.5, 160, 0.0],
["Hunter Henry", "NEP", "TE", 115.7, 90.3, 151, 0.0],
["Isaac TeSlaa", "DET", "WR", 115.4, 94.9, 169, 0.0],
["Oronde Gadsden", "LAC", "TE", 110.7, 88.8, 148, 0.0],
["Chris Rodriguez", "JAC", "RB", 109.8, 101.9, 0, 0.0],
["Adonai Mitchell", "NYJ", "WR", 109.8, 88.9, 171, 0.0],
["Juwan Johnson", "NOS", "TE", 109.7, 85.7, 156, 0.0],
["Greg Dulcich", "MIA", "TE", 108.2, 83.4, 178, 0.0],
["Pat Freiermuth", "PIT", "TE", 107.9, 82.4, 192, 0.0],
["Jalen Nailor", "LVR", "WR", 107.5, 86.8, 147, 0.0],
["Tre Harris", "LAC", "WR", 105.4, 85.4, 166, 0.0],
["AJ Barner", "SEA", "TE", 105.0, 82.5, 174, 0.0],
["Tyrone Tracy", "NYG", "RB", 104.8, 91.7, 0, 0.0],
["Denzel Boston", "CLE", "WR", 104.4, 82.8, 155, 0.0],
["Zach Charbonnet", "SEA", "RB", 104.2, 93.0, 0, 0.0],
["Terrance Ferguson", "LAR", "TE", 103.5, 83.0, 183, 0.0],
["Omar Cooper", "NYJ", "WR", 103.4, 82.2, 144, 0.0],
["Malik Washington", "MIA", "WR", 102.6, 80.7, 182, 0.0],
["Jerry Jeudy", "CLE", "WR", 100.8, 81.3, 177, 0.0],
["Dalton Schultz", "HOU", "TE", 100.5, 78.4, 168, 0.0],
["Gunnar Helm", "TEN", "TE", 99.9, 76.4, 180, 0.0],
["Antonio Williams", "WAS", "WR", 96.6, 75.6, 175, 0.0],
["T.J. Hockenson", "MIN", "TE", 96.0, 74.2, 170, 0.0],
["Cade Otton", "TBB", "TE", 95.8, 75.7, 188, 0.0],
["Romeo Doubs", "NEP", "WR", 95.0, 76.2, 117, 0.0],
["Tyjae Spears", "TEN", "RB", 94.9, 79.7, 0, 0.0],
["Alvin Kamara", "NOS", "RB", 93.2, 77.9, 0, 0.0],
["Tank Dell", "HOU", "WR", 90.8, 74.3, 190, 0.0],
["Isiah Pacheco", "DET", "RB", 90.7, 81.2, 0, 0.0],
["Dylan Sampson", "CLE", "RB", 89.4, 76.4, 0, 0.0],
["Zachariah Branch", "ATL", "WR", 88.3, 71.7, 181, 0.0],
["Calvin Ridley", "TEN", "WR", 87.9, 71.3, 186, 0.0],
["MarShawn Lloyd", "GBP", "RB", 87.3, 78.1, 0, 0.0],
["De'Zhaun Stribling", "SFO", "WR", 87.2, 70.3, 0, 0.0],
["Cooper Kupp", "SEA", "WR", 84.7, 69.3, 204, 0.0],
["Dontayvion Wicks", "PHI", "WR", 83.6, 67.3, 190, 0.0],
["Rashod Bateman", "BAL", "WR", 83.3, 68.0, 206, 0.0],
["Brian Robinson", "ATL", "RB", 82.8, 76.6, 0, 0.0],
["Eli Raridon", "NEP", "TE", 82.8, 64.9, 0, 0.0],
["Kayshon Boutte", "NEP", "WR", 80.1, 64.5, 203, 0.0],
["Mike Gesicki", "CIN", "TE", 79.0, 63.1, 202, 0.0],
["Tyquan Thornton", "KCC", "WR", 77.3, 63.8, 211, 0.0],
["David Njoku", "LAC", "TE", 76.8, 61.3, 0, 0.0],
["Michael Mayer", "LVR", "TE", 76.1, 58.5, 0, 0.0],
["Kirk Cousins", "LVR", "QB", 76.0, 76.0, 233, 5.4],
["Kendrick Bourne", "ARI", "WR", 75.4, 59.5, 266, 0.0],
["Evan Engram", "DEN", "TE", 74.8, 58.7, 218, 0.0],
["James Conner", "ARI", "RB", 72.5, 59.2, 0, 0.0],
["Justice Hill", "BAL", "RB", 72.4, 59.2, 0, 0.0],
["Colby Parkinson", "LAR", "TE", 72.2, 56.9, 0, 0.0],
["Theo Johnson", "NYG", "TE", 72.0, 55.3, 0, 0.0],
["Germie Bernard", "PIT", "WR", 71.1, 58.1, 187, 0.0],
["Tank Bigsby", "PHI", "RB", 71.0, 65.5, 0, 0.0],
["George Holani", "SEA", "RB", 71.0, 62.9, 0, 0.0],
["Kaytron Allen", "WAS", "RB", 71.0, 63.9, 0, 0.0],
["Tommy Tremble", "CAR", "TE", 70.3, 54.0, 290, 0.0],
["Marvin Mims", "DEN", "WR", 70.3, 58.0, 0, 0.0],
["Jalen Tolbert", "MIA", "WR", 69.2, 55.5, 250, 0.0],
["Nicholas Singleton", "TEN", "RB", 69.0, 61.0, 0, 0.0],
["Treylon Burks", "WAS", "WR", 68.8, 56.4, 266, 0.0],
["Darnell Mooney", "NYG", "WR", 68.4, 54.6, 197, 0.0],
["Jordan James", "SFO", "RB", 68.3, 64.3, 0, 0.0],
["Kalif Raymond", "CHI", "WR", 68.0, 54.1, 266, 0.0],
["Troy Franklin", "DEN", "WR", 68.0, 55.6, 219, 0.0],
["Elijah Arroyo", "SEA", "TE", 68.0, 54.2, 0, 0.0],
["Jonah Coleman", "DEN", "RB", 67.9, 60.4, 0, 0.0],
["Skyler Bell", "BUF", "WR", 67.5, 54.5, 0, 0.0],
["Braelon Allen", "NYJ", "RB", 67.5, 62.1, 0, 0.0],
["Mason Taylor", "NYJ", "TE", 67.5, 51.9, 0, 0.0],
["Keon Coleman", "BUF", "WR", 67.0, 55.2, 209, 0.0],
["Isaiah Davis", "NYJ", "RB", 67.0, 55.9, 0, 0.0],
["Ashton Dulin", "IND", "WR", 66.9, 54.7, 290, 0.0],
["Ray Davis", "BUF", "RB", 66.8, 58.1, 0, 0.0],
["KaVontae Turpin", "DAL", "WR", 66.8, 55.3, 0, 0.0],
["Malachi Fields", "NYG", "WR", 66.6, 53.0, 226, 0.0],
["Cole Kmet", "CHI", "TE", 66.5, 52.1, 0, 0.0],
["Xavier Legette", "CAR", "WR", 66.1, 52.4, 0, 0.0],
["Jaylin Noel", "HOU", "WR", 66.0, 51.8, 0, 0.0],
["Roman Wilson", "PIT", "WR", 65.2, 51.3, 0, 0.0],
["Eli Stowers", "PHI", "TE", 63.5, 49.1, 0, 0.0],
["Mike Washington", "LVR", "RB", 62.7, 56.9, 0, 0.0],
["Caleb Douglas", "MIA", "WR", 62.7, 50.3, 250, 0.0],
["Sean Tucker", "TBB", "RB", 62.1, 56.7, 0, 0.0],
["Oscar Delp", "NOS", "TE", 62.0, 49.1, 0, 0.0],
["Marlin Klein", "HOU", "TE", 61.9, 48.3, 0, 0.0],
["Emmett Johnson", "KCC", "RB", 61.9, 53.3, 0, 0.0],
["Chimere Dike", "TEN", "WR", 61.9, 49.1, 0, 0.0],
["Ja'Kobi Lane", "BAL", "WR", 61.7, 50.8, 241, 0.0],
["Justin Fields", "KCC", "QB", 61.0, 60.6, 0, 3.1],
["Devontez Walker", "BAL", "WR", 60.7, 48.6, 0, 0.0],
["Noah Gray", "KCC", "TE", 60.7, 47.6, 0, 0.0],
["Darnell Washington", "PIT", "TE", 60.7, 47.2, 0, 0.0],
["Elijah Sarratt", "BAL", "WR", 58.9, 49.3, 0, 0.0],
["Jack Bech", "LVR", "WR", 58.9, 46.9, 244, 0.0],
["Ted Hurst", "TBB", "WR", 58.5, 47.6, 0, 0.0],
["Demond Claiborne", "MIN", "RB", 57.4, 50.2, 0, 0.0],
["Chris Bell", "MIA", "WR", 57.2, 46.3, 0, 0.0],
["Christian Kirk", "SFO", "WR", 56.9, 46.0, 0, 0.0],
["Kaleb Johnson", "PIT", "RB", 56.4, 50.4, 0, 0.0],
["Emari Demercado", "KCC", "RB", 56.1, 49.8, 0, 0.0],
["Luke Musgrave", "GBP", "TE", 55.6, 43.0, 0, 0.0],
["Jake Tonges", "SFO", "TE", 55.5, 43.2, 0, 0.0],
["Cyrus Allen", "KCC", "WR", 55.2, 44.7, 0, 0.0],
["Andrei Iosivas", "CIN", "WR", 54.8, 44.8, 241, 0.0],
["Pat Bryant", "DEN", "WR", 54.8, 43.8, 0, 0.0],
["Samaje Perine", "CIN", "RB", 54.6, 47.2, 0, 0.0],
["Dawson Knox", "BUF", "TE", 54.4, 43.7, 0, 0.0],
["Darius Slayton", "NYG", "WR", 54.1, 43.0, 0, 0.0],
["Emanuel Wilson", "SEA", "RB", 54.1, 44.7, 0, 0.0],
["Tutu Atwell", "MIA", "WR", 54.0, 43.7, 0, 0.0],
["Carson Beck", "ARI", "QB", 53.6, 53.6, 0, 3.6],
["Devin Neal", "NOS", "RB", 53.4, 46.6, 0, 0.0],
["Olamide Zaccheaus", "ATL", "WR", 53.3, 42.2, 290, 0.0],
["Matthew Hibner", "BAL", "TE", 53.3, 43.2, 0, 0.0],
["Devaughn Vele", "NOS", "WR", 52.9, 41.5, 233, 0.0],
["Drew Sample", "CIN", "TE", 52.8, 39.1, 0, 0.0],
["Josh Oliver", "MIN", "TE", 52.8, 40.8, 0, 0.0],
["Isaiah Bond", "CLE", "WR", 52.0, 42.9, 0, 0.0],
["Justin Joly", "DEN", "TE", 52.0, 40.8, 0, 0.0],
["Erick All", "CIN", "TE", 51.9, 39.1, 0, 0.0],
["Tyler Higbee", "LAR", "TE", 51.3, 40.5, 0, 0.0],
["Mack Hollins", "NEP", "WR", 51.3, 41.2, 0, 0.0],
["Colbie Young", "CIN", "WR", 51.1, 41.8, 0, 0.0],
["Zavion Thomas", "CHI", "WR", 50.6, 41.0, 0, 0.0],
["Rasheen Ali", "BAL", "RB", 50.2, 46.8, 0, 0.0],
["Greg Dortch", "DET", "WR", 49.7, 38.9, 0, 0.0],
["Jordan Whittington", "LAR", "WR", 49.5, 39.5, 290, 0.0],
["Tahj Brooks", "CIN", "RB", 49.3, 44.4, 0, 0.0],
["Ty Johnson", "BUF", "RB", 49.0, 43.3, 0, 0.0],
["Tanner Koziol", "JAC", "TE", 48.8, 38.1, 0, 0.0],
["Ja'Tavion Sanders", "CAR", "TE", 48.1, 37.3, 0, 0.0],
["Cade Klubnik", "NYJ", "QB", 46.8, 46.6, 0, 2.9],
["Jaydon Blue", "DAL", "RB", 46.4, 42.6, 0, 0.0],
["Jaylen Wright", "MIA", "RB", 46.0, 39.9, 0, 0.0],
["Phil Mafah", "DAL", "RB", 45.7, 41.5, 0, 0.0],
["Demario Douglas", "NEP", "WR", 45.4, 36.7, 0, 0.0],
["Kaelon Black", "SFO", "RB", 45.2, 42.1, 0, 0.0],
["DJ Giddens", "IND", "RB", 44.9, 38.6, 0, 0.0],
["Elic Ayomanor", "TEN", "WR", 44.8, 36.5, 0, 0.0],
["Malik Davis", "DAL", "RB", 43.4, 38.0, 0, 0.0],
["LeQuint Allen", "JAC", "RB", 43.4, 33.9, 0, 0.0],
["Deion Burks", "IND", "WR", 43.2, 34.5, 0, 0.0],
["Jahdae Walker", "CHI", "WR", 43.1, 34.7, 0, 0.0],
["Savion Williams", "GBP", "WR", 42.9, 34.5, 0, 0.0],
["Kendre Miller", "NOS", "RB", 42.9, 39.0, 0, 0.0],
["Ollie Gordon", "MIA", "RB", 42.0, 36.4, 0, 0.0],
["Tory Horton", "SEA", "WR", 42.0, 33.8, 0, 0.0],
["Dont'e Thornton", "LVR", "WR", 41.0, 34.1, 0, 0.0],
["Jarquez Hunter", "LAR", "RB", 40.7, 36.1, 0, 0.0],
["Davis Mills", "HOU", "QB", 40.3, 40.1, 0, 2.9],
["Brashard Smith", "KCC", "RB", 40.3, 32.3, 0, 0.0],
["Daniel Bellinger", "TEN", "TE", 39.8, 30.1, 0, 0.0],
["Trey Lance", "LAC", "QB", 39.7, 39.6, 0, 2.7],
["Dyami Brown", "WAS", "WR", 39.5, 31.9, 0, 0.0],
["Jahan Dotson", "ATL", "WR", 39.3, 32.1, 0, 0.0],
["Marquise Brown", "PHI", "WR", 39.0, 31.2, 0, 0.0],
["Charlie Kolar", "LAC", "TE", 38.6, 30.2, 0, 0.0],
["Jack Endries", "CIN", "TE", 38.3, 29.6, 0, 0.0],
["Noah Fant", "NOS", "TE", 38.2, 29.0, 0, 0.0],
["Joe Flacco", "CIN", "QB", 38.0, 37.7, 0, 2.1],
["Adam Randall", "BAL", "RB", 37.9, 32.8, 0, 0.0],
["Josh Whyle", "GBP", "TE", 37.8, 29.0, 0, 0.0],
["John Metchie", "CAR", "WR", 37.6, 29.5, 0, 0.0],
["J.J. McCarthy", "MIN", "QB", 37.6, 37.5, 0, 2.6],
["Bryce Lance", "NOS", "WR", 37.5, 30.0, 0, 0.0],
["Spencer Rattler", "NOS", "QB", 37.3, 37.1, 0, 2.1],
["Mitchell Evans", "CAR", "TE", 37.2, 28.4, 0, 0.0],
["Luke Schoonmaker", "DAL", "TE", 36.9, 28.6, 0, 0.0],
["Jaylin Lane", "WAS", "WR", 36.9, 30.4, 0, 0.0],
["Kevin Coleman", "MIA", "WR", 36.2, 29.0, 0, 0.0],
["Odell Beckham", "NYG", "WR", 36.1, 28.7, 0, 0.0],
["Ty Simpson", "LAR", "QB", 36.0, 35.9, 0, 2.9],
["Xavier Hutchinson", "HOU", "WR", 35.9, 28.7, 0, 0.0],
["Josh Palmer", "BUF", "WR", 35.8, 28.3, 0, 0.0],
["Jerome Ford", "WAS", "RB", 35.2, 27.3, 0, 0.0],
["Jackson Hawes", "BUF", "TE", 34.7, 28.0, 0, 0.0],
["Xavier Smith", "LAR", "WR", 34.5, 28.0, 0, 0.0],
["Calvin Austin", "NYG", "WR", 34.4, 27.9, 0, 0.0],
["Austin Hooper", "ATL", "TE", 34.2, 26.7, 0, 0.0],
["Kimani Vidal", "LAC", "RB", 34.0, 31.5, 0, 0.0],
["Konata Mumpfield", "LAR", "WR", 33.8, 27.0, 0, 0.0],
["Ben Sinnott", "WAS", "TE", 33.7, 25.1, 0, 0.0],
["Adam Trautman", "DEN", "TE", 33.4, 26.3, 0, 0.0],
["Mac Jones", "SFO", "QB", 33.4, 33.2, 0, 2.4],
["Joe Milton", "DAL", "QB", 33.2, 33.2, 0, 2.6],
["Van Jefferson", "WAS", "WR", 33.2, 27.0, 0, 0.0],
["John Bates", "WAS", "TE", 33.2, 25.6, 0, 0.0],
["Tez Johnson", "TBB", "WR", 33.1, 26.3, 0, 0.0],
["Seth McGowan", "IND", "RB", 32.8, 29.5, 0, 0.0],
["Travis Homer", "PIT", "RB", 32.7, 26.7, 0, 0.0],
["Will Kacmarek", "MIA", "TE", 32.4, 25.2, 0, 0.0],
["Brycen Tremayne", "CAR", "WR", 32.2, 25.3, 0, 0.0],
["Michael Trigg", "DAL", "TE", 32.2, 25.1, 0, 0.0],
["Cade Stover", "HOU", "TE", 32.2, 24.7, 0, 0.0],
["Tanner McKee", "PHI", "QB", 32.1, 32.0, 0, 2.0],
["Elijah Higgins", "ARI", "TE", 32.0, 24.4, 0, 0.0],
["Drew Lock", "SEA", "QB", 31.8, 31.6, 0, 2.2],
["KeAndre Lambert-Smith", "LAC", "WR", 31.6, 25.5, 0, 0.0],
["Payne Durham", "TBB", "TE", 31.4, 24.2, 0, 0.0],
["Trevor Etienne", "CAR", "RB", 31.1, 27.6, 0, 0.0],
["Joe Royer", "CLE", "TE", 30.9, 24.1, 0, 0.0],
["Malik Benson", "LVR", "WR", 30.9, 24.9, 0, 0.0],
["Max Klare", "LAR", "TE", 30.1, 24.0, 0, 0.0],
];
const INTEL = {
"josh allen": {
"t": "Unmatched individual upside - QB1 without weapons, maybe upgraded. (range 24-48)"
},
"lamar jackson": {
"lean": 1,
"p": "Prop market: over rush yds (3.72% edge)"
},
"drake maye": {
"t": "QB1 potential; unrealized rush upside + AJB in the pass game. (range 54-78)"
},
"justin herbert": {
"t": "Everything in LAC looks bullish; young ascending skill corps. (range 70-94)",
"lean": -1,
"p": "Prop market: under rush yds (5.9% edge)"
},
"trevor lawrence": {
"t": "WR room 4-deep; passing game could go wild. (range 73-97)"
},
"caleb williams": {
"t": "Ascending in an elite system, dual-threat for fantasy. (range 59-83)"
},
"jahmyr gibbs": {
"t": "True feature back: explosion, receiving, goal line, snaps. (range 1-6)"
},
"jayden daniels": {
"lean": 0,
"p": "Prop market: over pass yds (4.49% edge); under rush yds (3.72% edge)"
},
"bijan robinson": {
"t": "Deployed rushing AND receiving - the peak is about to hit. (range 1-6)",
"lean": 1,
"p": "Prop market: over rec yds (3.62% edge); over rec TD (2.56% edge)"
},
"jamarr chase": {
"t": "125/1412/8 last year - repeat explosion well in play. (range 1-5)"
},
"jalen hurts": {
"lean": -1,
"p": "Prop market: under pass yds (3.98% edge)"
},
"jaxson dart": {
"lean": -1,
"p": "Prop market: under rush yds (7.26% edge)"
},
"puka nacua": {
"t": "Volume monster in a scheme that demands his usage. (range 1-5)"
},
"jonathan taylor": {
"t": "The offense revolves around him; this year isn't forever. (range 2-12)"
},
"cj stroud": {
"lean": -1,
"p": "Prop market: under pass yds (4.31% edge)"
},
"sam darnold": {
"lean": -1,
"p": "Prop market: under pass yds (4.84% edge)"
},
"kyler murray": {
"lean": -1,
"p": "Prop market: under rush yds (6.15% edge)"
},
"malik willis": {
"t": "Cheapest QB with secure job + major rushing upside. (range 122-146)",
"lean": 1,
"p": "Prop market: over pass yds (4.87% edge); under rush yds (3.66% edge)"
},
"amonra st brown": {
"lean": -1,
"p": "Prop market: under rec yds (2.6% edge)"
},
"chase brown": {
"t": "True 3-down workhorse in an offense that will put up numbers. (range 6-28)"
},
"devonta smith": {
"t": "True WR1 target share now; could ascend to alpha status. (range 10-38)",
"lean": 1,
"p": "Prop market: over rec TD (2.9% edge)"
},
"brock bowers": {
"t": "Could lead ALL TEs (and most WRs) in targets - miserable LV WR room. (range 8-32)"
},
"saquon barkley": {
"lean": 0,
"p": "Prop market: over rush yds (3.04% edge); under rec yds (2.92% edge)"
},
"drake london": {
"t": "True WR1 role at a 2nd-round price. Could go nuclear. (range 8-32)"
},
"aaron rodgers": {
"lean": -1,
"p": "Prop market: under pass yds (2.62% edge)"
},
"zay flowers": {
"t": "(range 19-43)"
},
"ladd mcconkey": {
"lean": 1,
"p": "Prop market: over rec yds (4% edge)"
},
"kenneth walker": {
"t": "Bigger receiving role in KC; Reid finds work for his ilk. (range 6-27)"
},
"devon achane": {
"lean": 0,
"p": "Prop market: over rec yds (4.37% edge); under rush yds (4.29% edge)"
},
"emeka egbuka": {
"t": "Year-2 ascent looks promising with Evans gone. (range 21-45)",
"lean": 1,
"p": "Prop market: over rec yds (3.91% edge)"
},
"luther burden": {
"t": "2.34 YPRR on <50% routes; full-time now. League-winner. (range 33-57)"
},
"travis etienne": {
"t": "NO paid up for their new stallion; could be uptempo. (range 26-50)",
"lean": 1,
"p": "Prop market: over rush yds (3.7% edge)"
},
"terry mclaurin": {
"t": "New offense intends to feature him with high target volume. (range 31-55)"
},
"colston loveland": {
"t": "Ascending talent, offensive focus - weekly wrecker. (range 35-59)"
},
"josh jacobs": {
"t": "Off-field issue suppressed the price; these usually resolve. (range 29-53)"
},
"dj moore": {
"lean": 1,
"p": "Prop market: over rec yds (2.58% edge)"
},
"kyren williams": {
"lean": -1,
"p": "Prop market: under rush yds (4.4% edge)"
},
"bhayshul tuten": {
"t": "Door open to outplay Chris Rodriguez and win the lion's share. (range 40-64)",
"lean": 1,
"p": "Prop market: over rush yds (3.18% edge)"
},
"tyler warren": {
"t": "One of IND's most targeted in '25; usage should only grow. (range 52-76)"
},
"jeremiyah love": {
"lean": -1,
"p": "Prop market: under rush yds (2.97% edge)"
},
"christian watson": {
"t": "Injury history keeps price low; career-year vibes at 27. (range 46-70)"
},
"brian thomas": {
"lean": 1,
"p": "Prop market: over rec TD (2.82% edge)"
},
"courtland sutton": {
"lean": -1,
"p": "Prop market: under rec yds (2.74% edge)"
},
"josh downs": {
"lean": -1,
"p": "Prop market: under rec yds (4.96% edge)"
},
"blake corum": {
"t": "Shared workload, but injury-contingent league-winning upside. (range 79-103)"
},
"rashid shaheed": {
"t": "SEA deep threat in a Super Bowl offense; more than go routes. (range 119-143)",
"lean": 1,
"p": "Prop market: over rec yds (3.93% edge); over rec TD (3.1% edge)"
},
"chris godwin": {
"lean": -1,
"p": "Prop market: under rec yds (3.19% edge)"
},
"mark andrews": {
"t": "Likely (the player) left; new OC signals pass-heavy. Bounce-back. (range 113-137)"
},
"jayden higgins": {
"t": "6 TDs in limited '25 looks; role expanding in year two. (range 112-136)"
},
"jakobi meyers": {
"lean": -1,
"p": "Prop market: under rec yds (2.64% edge)"
},
"jalen mcmillan": {
"t": "TBB's possible WR2 - stands out in every opportunity. (range 133-157)"
},
"george kittle": {
"lean": -1,
"p": "Prop market: under rec TD (5.11% edge)"
},
"jonathon brooks": {
"t": "Mid-round price that could look 1st-round by Week 14. (range 82-106)"
},
"brenton strange": {
"t": "Career highs despite missing 5 games; PFF's 7th-graded TE. (range 138-162)"
},
"chig okonkwo": {
"t": "Now TE1 in WAS - Daniels leans on the TE. 80-target upside. (range 127-151)"
},
"travis hunter": {
"t": "One WR injury changes it all; extremely cheap for the talent. (range 128-152)"
},
"travis kelce": {
"lean": -1,
"p": "Prop market: under rec yds (4.1% edge)"
},
"tre tucker": {
"t": "They think he can be featured; lower price, could pay big. (range 144-168)"
},
"jadarian price": {
"lean": -1,
"p": "Prop market: under rush yds (4.92% edge)"
},
"isaiah likely": {
"lean": -1,
"p": "Prop market: under rec yds (3.02% edge)"
},
"dallas goedert": {
"lean": -1,
"p": "Prop market: under rec TD (4.63% edge)"
},
"keaton mitchell": {
"t": "Cheap points late; role could expand. (range 125-149)"
},
"isaac teslaa": {
"t": "Born to make contested end-zone catches; upside for more. (range 157-181)"
},
"juwan johnson": {
"lean": -1,
"p": "Prop market: under rec yds (5.24% edge)"
},
"greg dulcich": {
"t": "Brutal situation but might be option 1 for targets, dirt cheap. (range 166-190)",
"lean": 1,
"p": "Prop market: over rec yds (2.84% edge)"
},
"terrance ferguson": {
"t": "Massive upside if workload consolidates; spike weeks anyway. (range 171-195)"
},
"omar cooper": {
"lean": -1,
"p": "Prop market: under rec yds (3.38% edge)"
},
"jerry jeudy": {
"lean": -1,
"p": "Prop market: under rec yds (13.54% edge)"
},
"dalton schultz": {
"lean": -1,
"p": "Prop market: under rec yds (4.22% edge)"
},
"tj hockenson": {
"lean": -1,
"p": "Prop market: under rec yds (5.38% edge)"
},
"romeo doubs": {
"lean": -1,
"p": "Prop market: under rec yds (11.95% edge)"
},
"calvin ridley": {
"lean": -1,
"p": "Prop market: under rec yds (8.87% edge)"
},
"rashod bateman": {
"lean": -1,
"p": "Prop market: under rec yds (2.79% edge)"
},
"germie bernard": {
"lean": -1,
"p": "Prop market: under rec yds (4.93% edge)"
},
"ray davis": {
"t": "Unmatched zero-to-hero injury-contingent upside, dirt cheap. (range 178-202)"
}
};
function normName(n){return n.toLowerCase().replace(/[.'\u2019-]/g,'').replace(/\s+(jr|sr|ii|iii|iv|v)$/,'').replace(/\s+/g,' ').trim();}
const PSOS = {"BUF": {"o": ["DET", "NEP", "NYJ"], "r": [10, 12, 31]}, "BAL": {"o": ["NYG", "PIT", "HOU"], "r": [13, 6, 3]}, "CIN": {"o": ["TEN", "CLE", "DEN"], "r": [25, 14, 1]}, "SFO": {"o": ["LAR", "MIA", "DET"], "r": [8, 28, 10]}, "LAC": {"o": ["TBB", "DEN", "NEP"], "r": [17, 1, 12]}, "DET": {"o": ["BUF", "CHI", "SFO"], "r": [16, 24, 15]}, "DAL": {"o": ["CAR", "TBB", "PHI"], "r": [18, 17, 4]}, "LAR": {"o": ["SFO", "NYJ", "ARI"], "r": [15, 31, 30]}, "PHI": {"o": ["PIT", "WAS", "DAL"], "r": [6, 27, 29]}, "CHI": {"o": ["MIN", "DET", "SEA"], "r": [5, 10, 2]}, "JAC": {"o": ["NYJ", "LVR", "TEN"], "r": [31, 26, 25]}, "NEP": {"o": ["ARI", "BUF", "LAC"], "r": [30, 16, 23]}, "IND": {"o": ["DEN", "TEN", "NYG"], "r": [1, 25, 13]}, "WAS": {"o": ["NOS", "PHI", "ATL"], "r": [22, 4, 20]}, "GBP": {"o": ["SEA", "NOS", "MIN"], "r": [2, 22, 5]}, "NYG": {"o": ["BAL", "ATL", "IND"], "r": [19, 20, 21]}, "NOS": {"o": ["WAS", "GBP", "LVR"], "r": [27, 7, 26]}, "DEN": {"o": ["IND", "LAC", "CIN"], "r": [21, 23, 32]}, "SEA": {"o": ["GBP", "MIN", "CHI"], "r": [7, 5, 24]}, "ATL": {"o": ["LVR", "NYG", "WAS"], "r": [26, 13, 27]}, "TBB": {"o": ["LAC", "DAL", "CAR"], "r": [23, 29, 18]}, "KCC": {"o": ["CLE", "HOU", "PIT"], "r": [14, 3, 6]}, "LVR": {"o": ["ATL", "JAC", "NOS"], "r": [20, 11, 22]}, "MIA": {"o": ["HOU", "SFO", "CLE"], "r": [3, 15, 14]}, "HOU": {"o": ["MIA", "KCC", "BAL"], "r": [28, 9, 19]}, "MIN": {"o": ["CHI", "SEA", "GBP"], "r": [24, 2, 7]}, "NYJ": {"o": ["JAC", "LAR", "BUF"], "r": [11, 8, 16]}, "CAR": {"o": ["DAL", "ARI", "TBB"], "r": [29, 30, 17]}, "TEN": {"o": ["CIN", "IND", "JAC"], "r": [32, 21, 11]}, "ARI": {"o": ["NEP", "CAR", "LAR"], "r": [12, 18, 8]}, "PIT": {"o": ["PHI", "BAL", "KCC"], "r": [4, 19, 9]}, "CLE": {"o": ["KCC", "CIN", "MIA"], "r": [9, 32, 28]}};

const HEADSHOT = {"josh allen":4984,"joe burrow":6770,"lamar jackson":4881,"drake maye":11564,"justin herbert":6797,"trevor lawrence":7523,"caleb williams":11560,"jahmyr gibbs":9221,"dak prescott":3294,"jayden daniels":11566,"bijan robinson":9509,"matthew stafford":421,"jared goff":3163,"jamarr chase":7564,"bo nix":11563,"brock purdy":8183,"jordan love":6804,"jalen hurts":6904,"tyler shough":12545,"jaxson dart":12508,"baker mayfield":4892,"puka nacua":9493,"patrick mahomes":4046,"jonathan taylor":6813,"christian mccaffrey":4034,"cj stroud":9758,"sam darnold":4943,"jaxon smithnjigba":9488,"kyler murray":5849,"cam ward":12522,"malik willis":8161,"daniel jones":5870,"amonra st brown":7547,"bryce young":9228,"james cook":8138,"chase brown":9224,"ceedee lamb":6786,"justin jefferson":6794,"ashton jeanty":12527,"devonta smith":7525,"brock bowers":11604,"saquon barkley":4866,"drake london":8112,"rashee rice":10229,"aaron rodgers":96,"omarion hampton":12507,"zay flowers":9997,"derrick henry":3198,"nico collins":7569,"ladd mcconkey":11635,"aj brown":5859,"kenneth walker":8151,"devon achane":9226,"trey mcbride":8130,"emeka egbuka":12514,"george pickens":8137,"malik nabers":11632,"luther burden":12519,"chris olave":8144,"travis etienne":7543,"garrett wilson":8146,"tee higgins":6801,"breece hall":8155,"terry mclaurin":5927,"tetairoa mcmillan":12526,"colston loveland":12517,"josh jacobs":5850,"jaylen waddle":7526,"mike evans":2216,"javonte williams":7588,"dj moore":4983,"jacoby brissett":3257,"fernando mendoza":13269,"geno smith":1373,"kyren williams":8150,"davante adams":2133,"bhayshul tuten":12490,"tyler warren":12518,"cam skattebo":12481,"jameson williams":8148,"parker washington":9487,"jeremiyah love":13287,"christian watson":8167,"quinshon judkins":12512,"dandre swift":6790,"rome odunze":11620,"david montgomery":5892,"carnell tate":13279,"kyle pitts":7553,"michael wilson":10232,"treveyon henderson":12529,"rhamondre stevenson":7611,"jordyn tyson":13281,"tony pollard":5967,"bucky irving":11584,"harold fannin":12506,"brian thomas":11631,"dk metcalf":5846,"courtland sutton":5045,"alec pierce":8142,"marvin harrison":11628,"jaylen warren":8228,"josh downs":9500,"rico dowdle":7021,"tucker kraft":9484,"michael pittman":6819,"tua tagovailoa":6768,"blake corum":11586,"rj harvey":12489,"makai lemon":13294,"jayden reed":10222,"wandale robinson":8126,"rashid shaheed":8676,"matthew golden":12501,"sam laporta":10859,"chuba hubbard":7594,"dalton kincaid":10236,"quentin johnston":9754,"kyle monangai":12534,"jordan addison":9756,"chris godwin":4037,"mark andrews":5012,"jayden higgins":12484,"jake ferguson":8110,"khalil shakir":8134,"jakobi meyers":5947,"jk dobbins":6806,"jalen coker":11646,"rachaad white":8136,"jalen mcmillan":11618,"deebo samuel":5872,"george kittle":4217,"kc concepcion":13298,"jonathon brooks":11583,"brenton strange":9480,"xavier worthy":11624,"travis hunter":12530,"travis kelce":1466,"tre tucker":10213,"jadarian price":13286,"aaron jones":4199,"jordan mason":8408,"michael penix":11559,"deshaun watson":4017,"isaiah likely":8131,"dallas goedert":5022,"shedeur sanders":12524,"keaton mitchell":9511,"tyler allgeier":8132,"jauan jennings":7049,"jacory croskeymerritt":12533,"ryan flournoy":11783,"kenyon sadiq":13330,"hunter henry":3214,"isaac teslaa":12535,"oronde gadsden":12493,"chris rodriguez":10219,"adonai mitchell":11625,"juwan johnson":7002,"greg dulcich":8172,"pat freiermuth":7600,"jalen nailor":8180,"tre harris":12509,"aj barner":11603,"tyrone tracy":11655,"denzel boston":13346,"zach charbonnet":9753,"terrance ferguson":12487,"omar cooper":13276,"malik washington":11610,"jerry jeudy":6783,"dalton schultz":5001,"gunnar helm":12502,"antonio williams":13301,"tj hockenson":5844,"cade otton":8111,"romeo doubs":8121,"tyjae spears":9508,"alvin kamara":4035,"tank dell":9502,"isiah pacheco":8205,"dylan sampson":12469,"zachariah branch":13320,"calvin ridley":4981,"marshawn lloyd":11581,"dezhaun stribling":13417,"cooper kupp":4039,"dontayvion wicks":9486,"rashod bateman":7571,"brian robinson":8154,"eli raridon":13421,"kayshon boutte":9504,"mike gesicki":4993,"tyquan thornton":8188,"david njoku":4033,"michael mayer":9482,"kirk cousins":1166,"kendrick bourne":4454,"evan engram":4066,"james conner":4137,"justice hill":5995,"colby parkinson":6865,"theo johnson":11597,"germie bernard":13274,"tank bigsby":9225,"george holani":12048,"kaytron allen":13405,"tommy tremble":7694,"marvin mims":9494,"jalen tolbert":8117,"nicholas singleton":13288,"treylon burks":8135,"darnell mooney":7090,"jordan james":12467,"kalif raymond":3634,"troy franklin":11627,"elijah arroyo":12521,"jonah coleman":13345,"skyler bell":13402,"braelon allen":11576,"mason taylor":12498,"keon coleman":11637,"isaiah davis":11571,"ashton dulin":6427,"ray davis":11575,"kavontae turpin":8917,"malachi fields":13285,"cole kmet":6826,"xavier legette":11626,"jaylin noel":12536,"roman wilson":11630,"eli stowers":13349,"mike washington":13305,"caleb douglas":13296,"sean tucker":9506,"oscar delp":13319,"marlin klein":13307,"emmett johnson":13337,"chimere dike":12540,"jakobi lane":13293,"justin fields":7591,"devontez walker":11629,"noah gray":7828,"darnell washington":9479,"elijah sarratt":13268,"jack bech":12483,"ted hurst":13317,"demond claiborne":13347,"chris bell":13311,"christian kirk":4950,"kaleb johnson":12504,"emari demercado":11199,"luke musgrave":9481,"jake tonges":8698,"cyrus allen":13413,"andrei iosivas":10226,"pat bryant":12492,"samaje perine":4147,"dawson knox":5906,"darius slayton":6149,"emanuel wilson":11435,"tutu atwell":7562,"carson beck":13272,"devin neal":12476,"olamide zaccheaus":6271,"devaughn vele":11834,"drew sample":6001,"josh oliver":5973,"isaiah bond":12503,"justin joly":13400,"erick all":11592,"tyler higbee":3271,"mack hollins":4177,"colbie young":13477,"zavion thomas":13411,"rasheen ali":11570,"greg dortch":5970,"jordan whittington":11623,"tahj brooks":12543,"ty johnson":6039,"tanner koziol":13408,"jatavion sanders":11600,"cade klubnik":13303,"jaydon blue":12457,"jaylen wright":11643,"phil mafah":12738,"demario douglas":9501,"kaelon black":13414,"dj giddens":12471,"elic ayomanor":12499,"malik davis":8800,"lequint allen":12544,"deion burks":13333,"jahdae walker":13079,"savion williams":12482,"kendre miller":9757,"ollie gordon":12495,"tory horton":12497,"donte thornton":12541,"jarquez hunter":11569,"davis mills":7585,"brashard smith":12455,"daniel bellinger":8225,"trey lance":7610,"dyami brown":7587,"jahan dotson":8119,"marquise brown":5848,"charlie kolar":8127,"jack endries":13282,"noah fant":5857,"joe flacco":19,"adam randall":13302,"josh whyle":10212,"john metchie":8147,"jj mccarthy":11565,"bryce lance":13420,"spencer rattler":11562,"mitchell evans":12473,"luke schoonmaker":10871,"jaylin lane":12641,"kevin coleman":13338,"odell beckham":2078,"ty simpson":13275,"xavier hutchinson":10218,"jerome ford":8143,"jackson hawes":12658,"xavier smith":11168,"calvin austin":8125,"austin hooper":3202,"kimani vidal":11647,"konata mumpfield":12718,"ben sinnott":11596,"adam trautman":6869,"mac jones":7527,"joe milton":11557,"van jefferson":6853,"john bates":7716,"tez johnson":12485,"seth mcgowan":13424,"travis homer":6012,"will kacmarek":13434,"brycen tremayne":11157,"michael trigg":13401,"cade stover":11599,"tanner mckee":9230,"elijah higgins":10231,"drew lock":5854,"keandre lambertsmith":12670,"payne durham":10227,"trevor etienne":12531,"joe royer":13435,"malik benson":13329,"max klare":13278};
const TEAMLOGO = {"ARI":"ari","ATL":"atl","BAL":"bal","BUF":"buf","CAR":"car","CHI":"chi","CIN":"cin","CLE":"cle","DAL":"dal","DEN":"den","DET":"det","GBP":"gb","HOU":"hou","IND":"ind","JAC":"jax","KCC":"kc","LAC":"lac","LAR":"lar","LVR":"lv","MIA":"mia","MIN":"min","NEP":"ne","NOS":"no","NYG":"nyg","NYJ":"nyj","PHI":"phi","PIT":"pit","SEA":"sea","SFO":"sf","TBB":"tb","TEN":"ten","WAS":"wsh"};
const DATA_STAMP = "2026-08-02";
