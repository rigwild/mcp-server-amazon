import * as cheerio from 'cheerio'
import fs from 'fs'
import puppeteer from 'puppeteer'
import { USE_MOCKS, EXPORT_LIVE_SCRAPING_FOR_MOCKS, getAmazonDomain } from './config.js'
import { createBrowserAndPage, getTimestamp, throwIfNotLoggedIn } from './utils.js'

const __dirname = new URL('.', import.meta.url).pathname

// ##################################
// Get Orders History
// ##################################

export async function getOrdersHistory() {
  let html: string
  if (USE_MOCKS) {
    console.error('[INFO][get-orders-history] Fetching orders history from mocks')
    const mockPath = `${__dirname}/../mocks/getOrdersHistory.html`
    html = fs.readFileSync(mockPath, 'utf-8')
  } else {
    const domain = getAmazonDomain()
    const url = `https://www.${domain}/-/en/gp/css/order-history`
    console.error(`[INFO][get-orders-history] Fetching orders history from ${url}`)

    const { browser, page } = await createBrowserAndPage()

    try {
      // Navigate to the page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Handle login if needed
      await throwIfNotLoggedIn(page)

      // Wait for the order cards to load (adjust selector as needed)
      try {
        await page.waitForSelector('.order-card, .your-orders-content-container', { timeout: 10000 })
      } catch (e) {
        throw new Error(
          '[INFO][get-orders-history] Could not find orders card selector. Ensure you are logged in and the orders history is accessible.'
        )
      }

      if (EXPORT_LIVE_SCRAPING_FOR_MOCKS) {
        // Export only the .order-card and .your-orders-content-container content to a mock file
        const timestamp = getTimestamp()
        const mockPath = `${__dirname}/../mocks/getOrdersHistory_${timestamp}.html`
        const orderCardsHtml = await page.$$eval('.order-card, .your-orders-content-container', elements =>
          elements.map(el => el.outerHTML).join('\n')
        )
        fs.writeFileSync(mockPath, orderCardsHtml)
        console.error(`[INFO][get-orders-history] Exported order cards HTML to ${mockPath}`)
      }

      // Get the HTML content after JavaScript execution
      html = await page.content()
    } finally {
      await browser.close()
    }
  }

  const $ = cheerio.load(html)
  const orderCards = $('.order-card')
    .map((index, element) => extractOrdersHistoryPageData($, $(element)))
    .get()
  return orderCards
}

function extractOrdersHistoryPageData($: cheerio.CheerioAPI, $card: cheerio.Cheerio<any>) {
  // Extract order information
  const orderNumber = $card.find('.yohtmlc-order-id span').last().text().trim()
  const orderDate = $card.find('.order-header__header-list-item').first().find('.a-size-base').text().trim()
  const total = $card.find('.order-header__header-list-item').eq(1).find('.a-size-base').text().trim()
  const status = $card.find('.delivery-box__primary-text').text().trim()
  const collectionMatch = status.match(/Collected on (.+)/)
  const collectionDate = collectionMatch ? collectionMatch[1] : null

  // Extract delivery address
  const deliveryName = $card.find('.a-popover-preload h5').text().trim()
  const deliveryAddress = $card.find('.a-popover-preload .a-row').eq(1).text().trim().replace(/\s+/g, ' ')
  const deliveryCountry = $card.find('.a-popover-preload .a-row').last().text().trim()

  // Extract items
  const items: {
    title: string
    image: string | undefined
    productUrl: string | undefined
    asin: string | null
    returnEligible: boolean
    returnDate: string | null
  }[] = []
  $card.find('.item-box').each((index, element) => {
    const $element = $(element)
    const title = $element.find('.yohtmlc-product-title a').text().trim()
    const image = $element.find('.product-image img').attr('src')
    const productUrl = $element.find('.yohtmlc-product-title a').attr('href')
    const returnText = $element.find('.a-size-small').text().trim()

    let asin = null
    if (productUrl) {
      const asinMatch = productUrl.match(/\/dp\/([A-Z0-9]{10})/)
      asin = asinMatch ? asinMatch[1] : null
    }

    let returnEligible = false
    let returnDate = null
    if (returnText.includes('Return or Replace Items')) {
      returnEligible = true
      const returnDateMatch = returnText.match(/until (.+)/)
      returnDate = returnDateMatch ? returnDateMatch[1] : null
    }

    items.push({
      title,
      image,
      productUrl,
      asin,
      returnEligible,
      returnDate,
    })
  })

  const domain = getAmazonDomain()
  const returnUrl = orderNumber ? `https://www.${domain}/spr/returns/cart?orderId=${orderNumber}&ref=ppx_yo2ov_dt_b_return_replace` : null

  return {
    orderInfo: {
      orderNumber,
      orderDate,
      total,
      deliveryAddress: {
        name: deliveryName,
        address: deliveryAddress,
        country: deliveryCountry,
      },
      status,
      collectionDate,
      returnUrl,
    },
    items,
  }
}

// ##################################
// Initiate Return or Replace
// ##################################

export async function initiateReturn(orderId: string) {
  if (USE_MOCKS) {
    console.error('[INFO][initiate-return] Mock mode: Would navigate to return page for order', orderId)
    return {
      success: true,
      message: `Mock mode: Would open return page for order ${orderId}`,
      returnUrl: `https://www.${getAmazonDomain()}/spr/returns/cart?orderId=${orderId}&ref=ppx_yo2ov_dt_b_return_replace`
    }
  }

  const domain = getAmazonDomain()
  const url = `https://www.${domain}/spr/returns/cart?orderId=${orderId}&ref=ppx_yo2ov_dt_b_return_replace`
  console.error(`[INFO][initiate-return] Navigating to return page: ${url}`)

  const { browser, page } = await createBrowserAndPage()

  try {
    // Navigate to the return page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Handle login if needed
    await throwIfNotLoggedIn(page)

    // Wait for the return page to load
    try {
      await page.waitForSelector('h1', { timeout: 10000 })
    } catch (e) {
      throw new Error(
        '[ERROR][initiate-return] Could not find page title. The page may not have loaded correctly.'
      )
    }

    // Get the page content to extract available items for return
    const html = await page.content()
    const $ = cheerio.load(html)

    // Check if we're on the return page
    const pageTitle = $('h1').text().trim()
    const isReturnPage = pageTitle.toLowerCase().includes('choose items to return') || 
                        pageTitle.toLowerCase().includes('return') || 
                        pageTitle.toLowerCase().includes('replace')
    
    if (!isReturnPage) {
      // Check for error messages
      const errorMessage = $('.a-alert-error').text().trim() || $('.a-box-error').text().trim()
      if (errorMessage) {
        throw new Error(`[ERROR][initiate-return] ${errorMessage}`)
      }
      throw new Error(`[ERROR][initiate-return] Not on the return page. Page title: "${pageTitle}". Order may not be eligible for returns.`)
    }

    // Extract returnable items
    const returnableItems: Array<{
      title: string
      asin: string | null
      returnEligible: boolean
      price?: string
      orderNumber?: string
      quantity?: number
      itemKey?: string
    }> = []

    // Find all checkbox containers which represent returnable items
    $('.orc-item-selection-checkbox').each((index, element) => {
      const $checkbox = $(element)
      const itemKey = $checkbox.attr('data-item-key') || ''
      const checkbox = $checkbox.find('input[type="checkbox"]')
      const isDisabled = checkbox.attr('disabled') !== undefined
      const isChecked = checkbox.attr('checked') !== undefined
      
      // Find the corresponding item details
      const $itemDetails = $(`.orc-returnable-item-details[data-item-key="${itemKey}"]`)
      const title = $itemDetails.find('.a-text-bold').first().text().trim()
      
      // Extract order number from popover content
      const popoverContent = $itemDetails.find('.a-popover-preload').html() || ''
      const orderMatch = popoverContent.match(/Order #:\s*<\/span>\s*<span[^>]*>([^<]+)/)
      const orderNumber = orderMatch ? orderMatch[1].trim() : undefined
      
      // Extract price
      const priceText = $itemDetails.find('.a-size-small').filter((i, el) => $(el).text().includes('$')).first().text().trim()
      
      // Try to find ASIN from product link or image
      let asin = null
      const productLink = $itemDetails.find('a[href*="/dp/"]').attr('href')
      if (productLink) {
        const asinMatch = productLink.match(/\/dp\/([A-Z0-9]{10})/)
        asin = asinMatch ? asinMatch[1] : null
      }

      returnableItems.push({
        title,
        asin,
        returnEligible: !isDisabled,
        price: priceText,
        orderNumber,
        itemKey
      })
    })

    return {
      success: true,
      orderId,
      returnUrl: url,
      pageTitle,
      returnableItems,
      message: 'Successfully loaded return page. User can now select items to return.'
    }

  } catch (error: any) {
    console.error('[ERROR][initiate-return] Error:', error)
    throw error
  } finally {
    await browser.close()
  }
}