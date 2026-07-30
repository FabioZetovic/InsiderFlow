/**
 * Senate eFD scraper.
 *
 * Scrapes Periodic Transaction Reports from the official Senate financial disclosure site
 * (efdsearch.senate.gov) — the community senate-stock-watcher mirror died in March 2021, so
 * this is the only free way to get current senate trades.
 *
 * Uses headless Chrome (the site's CDN blocks plain HTTP clients by TLS fingerprint, and the
 * default HeadlessChrome user-agent — a normal Chrome UA passes). All requests after login
 * happen via in-page fetch so cookies and the bot-clearance apply.
 *
 * Output: JSON array in the senate-stock-watcher record schema, merged with any existing
 * output file (safe to run repeatedly):
 *   { transaction_date, owner, ticker, asset_description, asset_type, type, amount, comment,
 *     senator, ptr_link, disclosure_date }
 *
 * Usage:
 *   node senate-efd-scraper.js                     # last 7 days of filings
 *   node senate-efd-scraper.js --since 03/16/2021  # backfill since the mirror died
 *   node senate-efd-scraper.js --out C:\path\to\out.json
 *
 * Env: CHROME_PATH overrides the Chrome executable location.
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH =
  process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://efdsearch.senate.gov';
const PAGE_SIZE = 100;
const REPORT_DELAY_MS = 350;

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function defaultSince() {
  const d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

const SINCE = arg('since', defaultSince());
const OUT = path.resolve(arg('out', path.join(__dirname, '..', 'data', 'senate_efd_transactions.json')));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`[efd] scraping PTRs submitted since ${SINCE} -> ${OUT}`);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(BASE + '/search/home/', { waitUntil: 'networkidle2', timeout: 60000 });

    // Accept the prohibition agreement (sets the session cookie)
    if (await page.$('#agree_statement')) {
      await Promise.all([
        page.click('#agree_statement'),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      ]);
    }
    if (!page.url().includes('/search')) {
      throw new Error('agreement not accepted, still at ' + page.url());
    }

    // 1) Collect all PTR report rows via the DataTables JSON endpoint
    const reports = [];
    for (let start = 0; ; start += PAGE_SIZE) {
      const chunk = await page.evaluate(
        async (start, length, since) => {
          const csrf = document.cookie
            .split('; ')
            .find((c) => c.startsWith('csrftoken='))
            ?.split('=')[1];
          const body = new URLSearchParams({
            start: String(start),
            length: String(length),
            report_types: '[11]', // 11 = Periodic Transaction Report
            filer_types: '[]',
            submitted_start_date: since + ' 00:00:00',
            submitted_end_date: '',
            candidate_state: '',
            senator_state: '',
            office_id: '',
            first_name: '',
            last_name: '',
          });
          const res = await fetch('/search/report/data/', {
            method: 'POST',
            headers: {
              'X-CSRFToken': csrf,
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
            body: body.toString(),
          });
          if (!res.ok) return { error: res.status };
          return await res.json();
        },
        start,
        PAGE_SIZE,
        SINCE,
      );
      if (chunk.error) throw new Error('search API returned ' + chunk.error);
      for (const row of chunk.data) {
        const [first, last, , linkHtml, dateReceived] = row;
        const href = (linkHtml.match(/href="([^"]+)"/) || [])[1];
        if (!href) continue;
        reports.push({
          senator: `${first.trim()} ${last.trim()}`.replace(/\s+/g, ' '),
          href,
          disclosureDate: dateReceived,
          electronic: href.includes('/search/view/ptr'),
        });
      }
      console.log(`[efd] report list: ${Math.min(start + PAGE_SIZE, chunk.recordsTotal)}/${chunk.recordsTotal}`);
      if (start + PAGE_SIZE >= chunk.recordsTotal) break;
      await sleep(200);
    }

    // Load existing output up-front: enables resume (skip already-parsed reports) and
    // incremental saves so an interrupted run loses at most 50 reports of work.
    let existing = [];
    if (fs.existsSync(OUT)) {
      try {
        existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
      } catch {
        existing = [];
      }
    }
    const byKey = new Map();
    const parsedLinks = new Set();
    for (const r of existing) {
      byKey.set(`${r.ptr_link}|${r.transaction_number}`, r);
      parsedLinks.add(r.ptr_link);
    }
    const save = () => fs.writeFileSync(OUT, JSON.stringify([...byKey.values()], null, 1));

    const electronic = reports.filter((r) => r.electronic && !parsedLinks.has(BASE + r.href));
    const skipped = reports.filter((r) => r.electronic && parsedLinks.has(BASE + r.href)).length;
    const paper = reports.length - electronic.length - skipped;
    console.log(`[efd] ${reports.length} PTRs found (${electronic.length} to parse, ${skipped} already done, ${paper} paper/skipped)`);

    // 2) Fetch each electronic PTR page and parse its transaction table
    const records = [];
    let done = 0;
    for (const report of electronic) {
      const rows = await page.evaluate(async (href) => {
        const res = await fetch(href);
        if (!res.ok) return { error: res.status };
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const table = doc.querySelector('table.table tbody, table tbody');
        if (!table) return { rows: [] };
        const out = [];
        for (const tr of table.querySelectorAll('tr')) {
          const cells = [...tr.querySelectorAll('td')].map((td) => td.textContent.replace(/\s+/g, ' ').trim());
          if (cells.length >= 8) out.push(cells);
        }
        return { rows: out };
      }, report.href);

      if (rows.error) {
        console.warn(`[efd] ${report.href} -> HTTP ${rows.error}, skipping`);
      } else {
        for (const c of rows.rows) {
          // cells: [#, transaction_date, owner, ticker, asset_description, asset_type, type, amount, comment?]
          const rec = {
            transaction_number: c[0],
            transaction_date: c[1],
            owner: c[2],
            ticker: c[3],
            asset_description: c[4],
            asset_type: c[5],
            type: c[6],
            amount: c[7],
            comment: c[8] || '--',
            senator: report.senator,
            ptr_link: BASE + report.href,
            disclosure_date: report.disclosureDate,
          };
          records.push(rec);
          byKey.set(`${rec.ptr_link}|${rec.transaction_number}`, rec);
        }
      }
      done++;
      if (done % 50 === 0) {
        save(); // incremental checkpoint — an interrupted run resumes from here
      }
      if (done % 25 === 0 || done === electronic.length) {
        console.log(`[efd] reports parsed: ${done}/${electronic.length} (${records.length} transactions so far)`);
      }
      await sleep(REPORT_DELAY_MS);
    }

    save();
    console.log(`[efd] done: ${records.length} scraped this run, ${byKey.size} total in ${OUT}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('[efd] FAILED:', e.message);
  process.exit(1);
});
