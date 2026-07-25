import path from 'path'
import { fileURLToPath } from 'url'
import { loadAmazonCookiesFile } from './utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Directory where the package is installed (one level up from build/) */
export const PACKAGE_ROOT = path.resolve(__dirname, '..')

export const IS_BROWSER_VISIBLE = process.env.IS_BROWSER_VISIBLE === 'true'

/** Use local mock files instead of live scraping */
export const USE_MOCKS = process.env.USE_MOCK_RESPONSES === 'true'

/** Export live scraping HTML to mocks for future use */
export const EXPORT_LIVE_SCRAPING_FOR_MOCKS = process.env.EXPORT_LIVE_SCRAPING_FOR_MOCKS !== 'false'

/**
 * Cookie file path resolution order:
 * 1. AMAZON_COOKIES_PATH env var (absolute or relative to CWD)
 * 2. amazonCookies.json in current working directory
 * 3. amazonCookies.json in the package root directory
 */
export const COOKIES_FILE_PATH =
  process.env.AMAZON_COOKIES_PATH ||
  path.join(process.cwd(), 'amazonCookies.json')
/**
 * Go to the Amazon website and log in to your account
 * Then export cookies as JSON using a browser extension like "Cookie-Editor"
 * and paste them in [amazonCookies.json](../amazonCookies.json)
 *
 * @see https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm?hl=fr
 */
export const AMAZON_COOKIES: {
  domain: string
  expirationDate: number
  hostOnly: boolean
  httpOnly: boolean
  name: string
  path: string
  sameSite: 'Strict' | 'Lax' | 'None' | undefined
  secure: boolean
  session: boolean
  storeId: string | null
  value: string
}[] = loadAmazonCookiesFile()

/**
 * Extract the Amazon domain from cookies
 * Returns the domain without the leading dot (e.g., "amazon.com", "amazon.co.uk", "amazon.de")
 */
export function getAmazonDomain(): string {
  if (!AMAZON_COOKIES || AMAZON_COOKIES.length === 0) {
    console.error('[WARN] No cookies found, using default amazon.com domain')
    return 'amazon.com'
  }

  // Find a cookie with domain starting with ".amazon."
  const amazonCookie = AMAZON_COOKIES.find(cookie => 
    cookie.domain && cookie.domain.startsWith('.amazon.')
  )

  if (amazonCookie) {
    // Remove the leading dot from domain
    const domain = amazonCookie.domain.startsWith('.') 
      ? amazonCookie.domain.substring(1) 
      : amazonCookie.domain
    console.error(`[INFO] Detected Amazon domain from cookies: ${domain}`)
    return domain
  }

  // Fallback: try to find any cookie with "amazon" in the domain
  const fallbackCookie = AMAZON_COOKIES.find(cookie => 
    cookie.domain && cookie.domain.includes('amazon')
  )

  if (fallbackCookie) {
    let domain = fallbackCookie.domain
    // Remove leading dot if present
    if (domain.startsWith('.')) {
      domain = domain.substring(1)
    }
    // If it's a subdomain like "www.amazon.com", extract the main domain
    if (domain.startsWith('www.')) {
      domain = domain.substring(4)
    }
    console.error(`[INFO] Detected Amazon domain from cookies (fallback): ${domain}`)
    return domain
  }

  console.error('[WARN] Could not detect Amazon domain from cookies, using default amazon.com')
  return 'amazon.com'
}
