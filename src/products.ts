import * as cheerio from 'cheerio'
import fs from 'fs'
import puppeteer from 'puppeteer'
import { USE_MOCKS, EXPORT_LIVE_SCRAPING_FOR_MOCKS, getAmazonDomain } from './config.js'
import { createBrowserAndPage, getTimestamp, throwIfNotLoggedIn } from './utils.js'

const __dirname = new URL('.', import.meta.url).pathname

// ##################################
// Product Details
// ##################################

interface ProductDetails {
  data: {
    asin: string
    title: string
    price: string
    canUseSubscribeAndSave: boolean
    description: {
      overview?: string
      features?: string
      facts?: string
      brandSnapshot?: string
    }
    reviews: {
      averageRating?: string
      reviewsCount?: string
    }
    mainImageUrl?: string
  }
  mainImageBase64?: string
}

export async function getProductDetails(asin: string): Promise<ProductDetails> {
  if (!asin || asin.length !== 10) {
    throw new Error('Invalid ASIN provided. ASIN should be a 10-character string.')
  }

  let html: string
  if (USE_MOCKS) {
    console.error('[INFO][get-product-details] Fetching product details from mocks')
    const mockPath = `${__dirname}/../mocks/getProductDetails.html`
    html = fs.readFileSync(mockPath, 'utf-8')
  } else {
    const domain = getAmazonDomain()
    const url = `https://www.${domain}/-/en/gp/product/${asin}`
    console.error(`[INFO][get-product-details] Fetching product details from ${url}`)

    const { browser, page } = await createBrowserAndPage()

    try {
      // Navigate to the product page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Handle login if needed
      await throwIfNotLoggedIn(page)

      // Wait for the product page to load
      try {
        await page.waitForSelector('#productTitle', { timeout: 10000 })
      } catch (e) {
        throw new Error('[INFO][get-product-details] Could not find product title. The product may not exist or be accessible.')
      }

      if (EXPORT_LIVE_SCRAPING_FOR_MOCKS) {
        // Export the main product content to a mock file
        const timestamp = getTimestamp()
        const mockPath = `${__dirname}/../mocks/getProductDetails_${timestamp}.html`
        const productHtml = await page.content()
        fs.writeFileSync(mockPath, productHtml)
        console.error(`[INFO][get-product-details] Exported product page HTML to ${mockPath}`)
      }

      // Get the HTML content after JavaScript execution
      html = await page.content()
    } finally {
      await browser.close()
    }
  }

  const $ = cheerio.load(html)
  return extractProductDetailsPageData($, asin)
}

async function extractProductDetailsPageData($: cheerio.CheerioAPI, asin: string): Promise<ProductDetails> {
  // Extract product title
  const title = $('span#productTitle').text().trim()

  // Extract price information
  let price = ''
  let canUseSubscribeAndSave: ProductDetails['data']['canUseSubscribeAndSave'] = false

  // Check if it's a subscribe and save product
  const subscriptionPrice = $('#subscriptionPrice .a-price .a-offscreen').prop('innerText')?.trim()
  if (subscriptionPrice) {
    price = subscriptionPrice
    canUseSubscribeAndSave = true
  } else {
    // Use regular price
    price = $('.priceToPay').text().trim()
  }

  // Extract description sections
  const description: ProductDetails['data']['description'] = {}

  const overview = $('#productOverview_feature_div').prop('innerText')?.trim()
  if (overview) description.overview = overview

  const features = $('#featurebullets_feature_div').prop('innerText')?.trim()
  if (features) description.features = features

  const facts = $('#productFactsDesktop_feature_div').prop('innerText')?.trim()
  if (facts) description.facts = facts

  const brandSnapshot = $('#brandSnapshot_feature_div').prop('innerText')?.trim()
  if (brandSnapshot) description.brandSnapshot = brandSnapshot

  // Extract reviews information
  const reviews: ProductDetails['data']['reviews'] = {}

  const averageRating = $('#averageCustomerReviews span.a-size-small.a-color-base').text().trim()
  if (averageRating) reviews.averageRating = averageRating

  const reviewsCountElement = $('#acrCustomerReviewLink span')
  const reviewsCount = reviewsCountElement.attr('aria-label')
  if (reviewsCount)
    reviews.reviewsCount = reviewsCount
      .replace(/\s+.*$/g, '')
      .replace(/,/g, '')
      .trim()

  // Extract main product image
  const mainImageUrl = $('#main-image-container img.a-dynamic-image').attr('src')
  // Download the image and convert to base64
  let mainImageBase64: ProductDetails['mainImageBase64'] = undefined
  if (mainImageUrl) {
    if (USE_MOCKS) {
      console.error('[INFO][get-product-details] Downloading product main image from mocks')
      const mockPath = `${__dirname}/../mocks/getProductDetails_image_base64.txt`
      mainImageBase64 = fs.readFileSync(mockPath, 'utf-8')
    } else {
      // FIXME: This is not supported yet by Claude Desktop client!! Uncomment when they implement it
      // console.error(`[INFO][get-product-details] Downloading main image from ${mainImageUrl}`)
      // mainImageBase64 = await downloadImageAsBase64(mainImageUrl)
      // if (EXPORT_LIVE_SCRAPING_FOR_MOCKS) {
      //   const timestamp = getTimestamp()
      //   const mockPath = `${__dirname}/../mocks/getProductDetails_image_base64_${timestamp}.txt`
      //   fs.writeFileSync(mockPath, mainImageBase64)
      //   console.error(`[INFO][get-product-details] Exported main image base64 to ${mockPath}`)
      // }
    }
  }

  console.error(
    `[INFO][get-product-details] Extracted product: ASIN: ${asin}, ${title}, Price: ${price}, Can use subscribe and save: ${canUseSubscribeAndSave}, Reviews: ${reviews.averageRating} (${reviews.reviewsCount} reviews), Main image URL: ${mainImageUrl}`
  )

  return {
    data: {
      asin,
      title,
      price,
      canUseSubscribeAndSave,
      description,
      reviews,
      mainImageUrl,
    },
    mainImageBase64,
  }
}

// ##################################
// Product Search
// ##################################

interface ProductSearchResult {
  asin: string
  title: string
  isSponsored: boolean
  brand?: string
  price?: string
  pricePerUnit?: string
  description?: {
    overview?: string
    features?: string
    facts?: string
    brandSnapshot?: string
  }
  reviews?: {
    averageRating?: string
    reviewCount?: string
  }
  imageUrl?: string
  isPrimeEligible: boolean
  deliveryInfo?: string
  productUrl?: string
}

export async function searchProducts(searchTerm: string): Promise<ProductSearchResult[]> {
  if (!searchTerm || searchTerm.trim().length === 0) {
    throw new Error('Search term is required and cannot be empty.')
  }

  let html: string
  if (USE_MOCKS) {
    console.error('[INFO][search-products] Fetching search results from mocks')
    const mockPath = `${__dirname}/../mocks/searchProducts.html`
    html = fs.readFileSync(mockPath, 'utf-8')
  } else {
    const domain = getAmazonDomain()
    const url = `https://www.${domain}/s?k=${encodeURIComponent(searchTerm)}`
    console.error(`[INFO][search-products] Searching for products with term "${searchTerm}" from ${url}`)

    const { browser, page } = await createBrowserAndPage()

    try {
      // Navigate to the search page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Handle login if needed
      await throwIfNotLoggedIn(page)

      // Wait for search results to load
      try {
        await page.waitForSelector('.s-search-results', { timeout: 10000 })
      } catch (e) {
        throw new Error(
          '[INFO][search-products] Could not find search results container. The search may have failed or returned no results.'
        )
      }

      if (EXPORT_LIVE_SCRAPING_FOR_MOCKS) {
        // Export the search results content to a mock file
        const timestamp = getTimestamp()
        const searchResultsHtml = await page.$eval('.s-search-results', el => el.outerHTML)
        const mockFileName = `searchProducts_${timestamp}.html`
        const mockPath = `${__dirname}/../mocks/${mockFileName}`
        fs.writeFileSync(mockPath, searchResultsHtml)
        console.error(`[INFO][search-products] Exported search results HTML to ${mockPath}`)
      }

      // Get the HTML content after JavaScript execution
      html = await page.content()
    } finally {
      await browser.close()
    }
  }

  const $ = cheerio.load(html)
  return extractSearchResultsPageData($, searchTerm)
}

function extractSearchResultsPageData($: cheerio.CheerioAPI, searchTerm: string): ProductSearchResult[] {
  const searchResults: ProductSearchResult[] = []

  // Find the search results using the actual Amazon structure
  const $productItems = $('[role="listitem"]')

  if ($productItems.length === 0) {
    console.error('[INFO][search-products] No search results found')
    return []
  }

  // Limit to first 20 items
  const limitedItems = $productItems.slice(0, 20)

  console.error(`[INFO][search-products] Found ${$productItems.length} products, processing first ${limitedItems.length}`)

  limitedItems.each((index, element) => {
    const $item = $(element)

    try {
      const productData = extractSearchResultSingleProductData($, $item)
      if (productData && productData.asin) {
        searchResults.push(productData)
        console.error(`[INFO][search-products] Extracted product ${index + 1}: ${productData.asin} - ${productData.title}`)
      }
    } catch (error) {
      console.error(`[INFO][search-products] Error extracting product ${index + 1}:`, error)
    }
  })

  console.error(`[INFO][search-products] Successfully extracted ${searchResults.length} products for search term "${searchTerm}"`)
  return searchResults
}

function extractSearchResultSingleProductData($: cheerio.CheerioAPI, $item: cheerio.Cheerio<any>): ProductSearchResult | null {
  // Extract ASIN
  const asin = $item.attr('data-asin')
  if (!asin) {
    return null
  }

  // Extract title and check if sponsored
  const titleElement = $item.find('h2[aria-label]')
  const fullTitle = titleElement.attr('aria-label') || ''
  const isSponsored = fullTitle.startsWith('Sponsored Ad – ')
  const title = isSponsored ? fullTitle.replace('Sponsored Ad – ', '') : fullTitle

  // Extract brand
  const brand = $item.find('h2.a-size-mini span.a-size-base-plus.a-color-base').text().trim() || undefined

  // Extract price information
  const price = $item.find('span.a-price[data-a-size="xl"] > span.a-offscreen').text().trim() || undefined

  // Extract price per unit (more complex selector)
  let pricePerUnit: string | undefined
  const pricePerUnitElement = $item.find('span.a-price[data-a-size="b"][data-a-color="secondary"] > span.a-offscreen')
  if (pricePerUnitElement.length > 0) {
    const parentText = pricePerUnitElement.parent().parent().text().trim()
    pricePerUnit = parentText || undefined
  }

  // Extract reviews
  const reviews: ProductSearchResult['reviews'] = {}

  const ratingElement = $item.find('i.a-icon-star-mini span.a-icon-alt')
  const ratingText = ratingElement.text().trim()
  if (ratingText) {
    reviews.averageRating = ratingText
  }

  const reviewCountElement = $item.find('a[aria-label*="ratings"] span.a-size-small')
  const reviewCount = reviewCountElement.text().trim()
  if (reviewCount) {
    reviews.reviewCount = reviewCount
  }

  // Extract image URL
  const imageUrl = $item.find('img.s-image').attr('src') || undefined

  // Check Prime eligibility
  const isPrimeEligible = $item.find('i.a-icon-prime').length > 0

  // Extract delivery information
  const deliveryInfo = $item.find('div.udm-primary-delivery-message').text().trim() || undefined

  // Extract product URL
  const domain = getAmazonDomain()
  const productUrl = `https://www.${domain}/-/en/gp/product/${asin}`

  return {
    asin,
    title,
    isSponsored,
    brand,
    price,
    pricePerUnit,
    reviews: Object.keys(reviews).length > 0 ? reviews : undefined,
    imageUrl,
    isPrimeEligible,
    deliveryInfo,
    productUrl,
  }
}

// ##################################
// Product Variants
// ##################################

export const VARIANTS_DEFAULT_LIMIT = 5
export const VARIANTS_MAX_LIMIT = 15

interface DeliveryOption {
  time?: string
  price?: string
  cutoff?: string
}

interface ProductVariant {
  asin: string
  dimensions: Record<string, string>
  price?: string
  availability?: string
  delivery?: DeliveryOption
  fastestDelivery?: DeliveryOption
  url: string
  error?: string
}

interface ProductVariantsResult {
  parentAsin: string
  dimensionNames: string[]
  totalVariants: number
  matched: number
  fetched: number
  skipped: number
  variants: ProductVariant[]
}

/** Parse the variation ("twister") data embedded in a product page: child ASIN -> dimension values. */
export function parseVariantMap(html: string): { dimensionNames: string[]; variants: { asin: string; values: string[] }[] } | null {
  // shortcut: regex stops at the first "}", breaks if a size/color value contains "}"; upgrade to a JSON scanner if that ever happens
  const valuesMatch = html.match(/"dimensionValuesDisplayData"\s*:\s*(\{[^}]*\})/)
  if (!valuesMatch) return null
  let values: Record<string, string[]>
  try {
    values = JSON.parse(valuesMatch[1])
  } catch (error: any) {
    throw new Error(`Could not parse variation data on the product page: ${error.message}`)
  }
  const namesMatch = html.match(/"dimensionsDisplay"\s*:\s*(\[[^\]]*\])/)
  let dimensionNames: string[] = namesMatch ? JSON.parse(namesMatch[1]) : []
  // amazon.com pages have no dimensionsDisplay: map dimension keys (size_name) through variationDisplayLabels (Size)
  const keysMatch = html.match(/"dimensions"\s*:\s*(\[[^\]]*\])/)
  const labelsMatch = html.match(/"variationDisplayLabels"\s*:\s*(\{[^}]*\})/)
  if (!namesMatch && keysMatch && labelsMatch) {
    const labels: Record<string, string> = JSON.parse(labelsMatch[1])
    dimensionNames = (JSON.parse(keysMatch[1]) as string[]).map(key => labels[key] ?? key)
  }
  return { dimensionNames, variants: Object.entries(values).map(([asin, values]) => ({ asin, values })) }
}

/** Parse price, stock and delivery from a child (single variation) product page. */
export function parseChildOffer($: cheerio.CheerioAPI): Pick<ProductVariant, 'price' | 'availability' | 'delivery' | 'fastestDelivery'> {
  const price =
    $('#corePrice_feature_div .a-offscreen').first().text().trim() || $('.apexPriceToPay .a-offscreen').first().text().trim() || undefined
  // #availability also holds a <script type="a-state"> with page JSON; keep only the visible text
  const availability = $('#availability').clone().find('script, style').remove().end().text().replace(/\s+/g, ' ').trim() || undefined
  // Amazon shows the primary delivery first and, when offered, a faster paid/Prime option second
  const [primary, fastest] = $('[data-csa-c-delivery-time]')
    .toArray()
    .map(el => ({
      time: $(el).attr('data-csa-c-delivery-time') || undefined,
      price: $(el).attr('data-csa-c-delivery-price') || undefined,
      cutoff: $(el).attr('data-csa-c-delivery-cutoff') || undefined,
    }))
  return { price, availability, delivery: primary, fastestDelivery: fastest }
}

/** Keep variants whose dimension matches the filter: exact (case-insensitive) match wins, else substring. */
export function filterVariants(
  variants: { asin: string; values: string[] }[],
  dimensionNames: string[],
  filter: string | undefined,
  dimensionPattern: RegExp
) {
  if (!filter) return variants
  const wanted = filter.trim().toLowerCase()
  // A dimension named exactly "Size" beats e.g. "Special Size" or "Size Name"
  const exactName = new RegExp(`^(?:${dimensionPattern.source})$`, 'i')
  let index = dimensionNames.findIndex(name => exactName.test(name.trim()))
  if (index < 0) index = dimensionNames.findIndex(name => dimensionPattern.test(name))
  // If the page doesn't name a matching dimension, search all values
  const candidates = (v: { values: string[] }) => (index >= 0 ? [v.values[index] ?? ''] : v.values).map(s => s.toLowerCase())
  const exact = variants.filter(v => candidates(v).some(s => s === wanted))
  return exact.length > 0 ? exact : variants.filter(v => candidates(v).some(s => s.includes(wanted)))
}

export async function getProductVariants(
  asin: string,
  options: { size?: string; color?: string; limit?: number } = {}
): Promise<ProductVariantsResult> {
  if (!asin || asin.length !== 10) {
    throw new Error('Invalid ASIN provided. ASIN should be a 10-character string.')
  }
  const limit = Math.min(Math.max(1, Math.floor(options.limit ?? VARIANTS_DEFAULT_LIMIT)), VARIANTS_MAX_LIMIT)
  const domain = getAmazonDomain()
  const childUrl = (childAsin: string) => `https://www.${domain}/dp/${childAsin}?th=1&psc=1`

  // One browser for the parent and every child page; launching per page is the slow part
  const session = USE_MOCKS ? null : await createBrowserAndPage()
  try {
    const loadHtml = async (url: string, timeout: number) => {
      if (!session) return fs.readFileSync(`${__dirname}/../mocks/getProductDetails.html`, 'utf-8')
      console.error(`[INFO][get-product-variants] Fetching ${url}`)
      await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout })
      await throwIfNotLoggedIn(session.page)
      // Price/stock/delivery are server-rendered; give the buy box a moment without waiting for network idle
      await session.page.waitForSelector('#availability, [data-csa-c-delivery-time]', { timeout: 5000 }).catch(() => {})
      return session.page.content()
    }

    const map = parseVariantMap(await loadHtml(`https://www.${domain}/-/en/gp/product/${asin}`, 30000))
    if (!map) {
      return { parentAsin: asin, dimensionNames: [], totalVariants: 0, matched: 0, fetched: 0, skipped: 0, variants: [] }
    }

    let matched = filterVariants(map.variants, map.dimensionNames, options.size, /size/i)
    matched = filterVariants(matched, map.dimensionNames, options.color, /colou?r/i)
    const selected = matched.slice(0, limit)

    const variants: ProductVariant[] = []
    for (const v of selected) {
      const dimensions = Object.fromEntries(v.values.map((value, i) => [map.dimensionNames[i] ?? `dimension${i + 1}`, value]))
      const url = childUrl(v.asin)
      try {
        variants.push({ asin: v.asin, dimensions, ...parseChildOffer(cheerio.load(await loadHtml(url, 20000))), url })
      } catch (error: any) {
        // One slow or blocked child page shouldn't lose the others
        console.error(`[ERROR][get-product-variants] Failed to fetch ${v.asin}:`, error)
        variants.push({ asin: v.asin, dimensions, url, error: error.message })
      }
    }

    console.error(
      `[INFO][get-product-variants] ${asin}: ${map.variants.length} variants, ${matched.length} matched, ${variants.length} fetched`
    )
    return {
      parentAsin: asin,
      dimensionNames: map.dimensionNames,
      totalVariants: map.variants.length,
      matched: matched.length,
      fetched: variants.length,
      skipped: matched.length - variants.length,
      variants,
    }
  } finally {
    await session?.browser.close()
  }
}