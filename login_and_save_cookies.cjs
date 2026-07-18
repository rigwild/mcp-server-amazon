#!/usr/bin/env node
// One-shot login helper for the Amazon MCP server.
// Launches Puppeteer (visible), auto-fills email + password from
// AMAZON_EMAIL / AMAZON_PASSWORD env vars, then polls the page until it
// detects a logged-in state (URL leaves /ap/signin AND an account greeting
// element appears). Saves the resulting cookies to amazonCookies.json.
//
// Domain is controlled by the AMAZON_DOMAIN env var (default: amazon.com).
// Examples: AMAZON_DOMAIN=amazon.de  AMAZON_DOMAIN=amazon.co.uk
// The MCP itself auto-detects the marketplace domain from whichever cookies
// it finds in amazonCookies.json (see build/config.js → getAmazonDomain).
//
// If extra steps (CAPTCHA, OTP, device-approval) appear, the user finishes
// them in the visible window — the script keeps polling.

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const EMAIL = process.env.AMAZON_EMAIL;
const PASSWORD = process.env.AMAZON_PASSWORD;
const DOMAIN = process.env.AMAZON_DOMAIN || "amazon.com";
const COOKIE_FILE = path.join(__dirname, "amazonCookies.json");
const POLL_INTERVAL_MS = 2000;
const DEADLINE_MS = 15 * 60 * 1000;

if (!EMAIL || !PASSWORD) {
  console.error("Set AMAZON_EMAIL and AMAZON_PASSWORD env vars.");
  console.error("Optionally set AMAZON_DOMAIN (default: amazon.com). E.g. AMAZON_DOMAIN=amazon.de");
  process.exit(1);
}

// Escape the domain for use in a RegExp (".com" → "\\.com").
const DOMAIN_RE = new RegExp(DOMAIN.replace(/\./g, "\\.") + "$");
const SIGNIN_URL =
  `https://www.${DOMAIN}/ap/signin?_encoding=UTF8` +
  `&openid.return_to=https%3A%2F%2Fwww.${DOMAIN}%2F` +
  `&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select` +
  `&openid.assoc_handle=usflex` +
  `&openid.mode=checkid_setup` +
  `&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select` +
  `&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0`;

function toEditThisCookieFormat(cookies) {
  return cookies.map((c) => {
    const out = {
      domain: c.domain,
      hostOnly: !!c.domain && !c.domain.startsWith("."),
      httpOnly: !!c.httpOnly,
      name: c.name,
      path: c.path || "/",
      sameSite: c.sameSite || null,
      secure: !!c.secure,
      session: !c.expires || c.expires <= 0,
      storeId: null,
      value: c.value,
    };
    if (c.expires && c.expires > 0) out.expirationDate = c.expires;
    return out;
  });
}

async function isLoggedIn(page) {
  let url;
  try { url = page.url(); } catch (_) { return false; }
  if (!url) return false;
  if (/\/ap\/signin/.test(url)) return false;
  if (/\/ap\/mfa/.test(url)) return false;
  if (/\/ap\/cvf\//.test(url)) return false;
  if (!DOMAIN_RE.test(new URL(url).hostname)) return false;
  const greeting = await page
    .$eval("#nav-link-accountList-nav-line-1", (el) => el.textContent.trim())
    .catch(() => null);
  if (!greeting) return false;
  if (/sign\s*in/i.test(greeting)) return false;
  return true;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1280,900",
    ],
  });
  const [page] = await browser.pages();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
  );

  let browserClosed = false;
  browser.on("disconnected", () => { browserClosed = true; });

  console.error(`[login] navigating to ${DOMAIN} sign-in…`);
  await page.goto(SIGNIN_URL, { waitUntil: "domcontentloaded" });

  try {
    await page.waitForSelector("#ap_email, #ap_email_login", { timeout: 15000 });
    const emailSel = (await page.$("#ap_email")) ? "#ap_email" : "#ap_email_login";
    await page.click(emailSel, { clickCount: 3 });
    await page.type(emailSel, EMAIL, { delay: 30 });
    const continueBtn = await page.$("#continue, #continue-announce");
    if (continueBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}),
        continueBtn.click(),
      ]);
    }
    await page.waitForSelector("#ap_password", { timeout: 10000 });
    await page.type("#ap_password", PASSWORD, { delay: 30 });
    const keep = await page.$("input[name='rememberMe']");
    if (keep) await keep.click().catch(() => {});
    const signInBtn = await page.$("#signInSubmit");
    if (signInBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}),
        signInBtn.click(),
      ]);
    }
  } catch (e) {
    console.error("[login] auto-fill stopped early (CAPTCHA / OTP / unfamiliar layout). Finish manually in the open window.");
  }

  console.error("");
  console.error("============================================================");
  console.error("  If Amazon shows a CAPTCHA / OTP / 'verify this device' /");
  console.error("  'Keep me signed in?' page, finish it in the open window.");
  console.error("  The script auto-detects the logged-in homepage and saves");
  console.error("  cookies. Do not close the browser yourself.");
  console.error("============================================================");
  console.error("");

  const deadline = Date.now() + DEADLINE_MS;
  let loggedIn = false;
  while (Date.now() < deadline) {
    if (browserClosed) {
      console.error("[login] browser closed before login completed. Aborting.");
      process.exit(2);
    }
    if (await isLoggedIn(page)) { loggedIn = true; break; }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  if (!loggedIn) {
    console.error("[login] timed out before detecting logged-in state. Aborting.");
    await browser.close().catch(() => {});
    process.exit(2);
  }

  await new Promise((r) => setTimeout(r, 1500));

  const client = await page.target().createCDPSession();
  const { cookies } = await client.send("Network.getAllCookies");
  const formatted = toEditThisCookieFormat(
    cookies.filter((c) => DOMAIN_RE.test(c.domain.replace(/^\./, "")))
  );

  fs.writeFileSync(COOKIE_FILE, JSON.stringify(formatted, null, 2));
  console.error(`[login] wrote ${formatted.length} ${DOMAIN} cookies to ${COOKIE_FILE}`);

  await browser.close().catch(() => {});
})().catch((e) => {
  console.error("[login] error:", e && e.stack ? e.stack : e);
  process.exit(1);
});
