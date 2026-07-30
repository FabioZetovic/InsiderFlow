/**
 * Regenerates backend/src/main/resources/legislators.json from the unitedstates/congress-legislators
 * datasets, attaching committee memberships so the ingester can flag committee-oversight conflicts.
 *
 * Members included: all current legislators + historical legislators who served in the STOCK Act era
 * (a term ending 2012 or later) — the set that can appear in the trade feeds.
 *
 * Run: node scripts/gen-legislators.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = 'https://unitedstates.github.io/congress-legislators';
const OUT = path.join(__dirname, '..', 'backend', 'src', 'main', 'resources', 'legislators.json');
const STOCK_ACT_YEAR = 2012;

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
  PR: 'Puerto Rico', GU: 'Guam', VI: 'Virgin Islands', AS: 'American Samoa', MP: 'Northern Mariana Islands',
};

const PARTY = { Democrat: 'Democrat', Republican: 'Republican', Independent: 'Independent', Libertarian: 'Libertarian' };

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function nicknamesFor(name) {
  const first = (name.first || '').trim();
  const middle = (name.middle || '').trim();
  const last = (name.last || '').trim();
  const nick = (name.nickname || '').trim();
  const out = new Set();
  const push = (...parts) => {
    const s = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (s) out.add(s);
  };
  push(first, last);
  if (middle) {
    push(first, middle[0], last); // "Robert F Bennett"
    push(first, middle[0] + '.', last); // "Robert F. Bennett"
  }
  if (nick && nick !== first) {
    push(nick, last);
    if (middle) push(nick, middle[0], last);
  }
  if (name.official_full) out.add(name.official_full.replace(/\s+/g, ' ').trim());
  return [...out];
}

(async () => {
  console.log('fetching datasets…');
  const [current, historical, committees, membership] = await Promise.all([
    getJson(`${BASE}/legislators-current.json`),
    getJson(`${BASE}/legislators-historical.json`),
    getJson(`${BASE}/committees-current.json`),
    getJson(`${BASE}/committee-membership-current.json`),
  ]);

  // thomas_id -> canonical committee name (parent committees only; subcommittee ids are
  // "<parent>NN" so we strip the numeric suffix to roll them up to the parent).
  const committeeName = {};
  for (const c of committees) {
    if (c.thomas_id) committeeName[c.thomas_id] = c.name;
  }

  // bioguide -> set of parent committee names
  const memberCommittees = {};
  for (const [committeeId, members] of Object.entries(membership)) {
    const parentId = committeeId.replace(/\d+$/, '');
    const name = committeeName[parentId] || committeeName[committeeId];
    if (!name) continue;
    for (const m of members) {
      if (!m.bioguide) continue;
      (memberCommittees[m.bioguide] ||= new Set()).add(name);
    }
  }

  const isStockActEra = (leg) => {
    const last = leg.terms[leg.terms.length - 1];
    const endYear = parseInt((last.end || '').slice(0, 4), 10);
    return endYear >= STOCK_ACT_YEAR;
  };

  const members = [];
  const seen = new Set();

  const build = (leg) => {
    const bioguide = leg.id.bioguide;
    if (seen.has(bioguide)) return;
    seen.add(bioguide);
    const last = leg.terms[leg.terms.length - 1];
    const canonical = `${(leg.name.first || '').trim()} ${(leg.name.last || '').trim()}`.replace(/\s+/g, ' ').trim();
    if (!canonical) return;
    members.push({
      canonical,
      party: PARTY[last.party] || last.party || null,
      state: STATE_NAMES[last.state] || last.state || null,
      stateAbbr: last.state || null,
      chamber: last.type === 'sen' ? 'SENATE' : 'HOUSE',
      first: leg.name.first || null,
      last: leg.name.last || null,
      nicknames: nicknamesFor(leg.name),
      committees: [...(memberCommittees[bioguide] || [])].sort(),
    });
  };

  current.forEach(build);
  historical.filter(isStockActEra).forEach(build);

  const withCommittees = members.filter((m) => m.committees.length > 0).length;
  const output = { generatedAt: new Date().toISOString(), members };
  fs.writeFileSync(OUT, JSON.stringify(output));
  console.log(`wrote ${members.length} members (${withCommittees} with committee assignments) -> ${OUT}`);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
