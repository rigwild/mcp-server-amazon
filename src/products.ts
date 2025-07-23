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