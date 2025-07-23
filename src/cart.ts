import * as cheerio from 'cheerio'
import fs from 'fs'
import { USE_MOCKS, EXPORT_LIVE_SCRAPING_FOR_MOCKS, getAmazonDomain } from './config.js'
import { createBrowserAndPage, getTimestamp, throwIfNotLoggedIn } from './utils.js'

const __dirname = new URL('.', import.meta.url).pathname

// ##################################
// Cart Content Types
// ##################################

interface CartItem {
  title: string
  price: string
  quantity: number
  image?: string
  productUrl?: string
  asin?: string
  availability: string
  isSelected: boolean
}

interface CartContent {
  isEmpty: boolean
  items: CartItem[]
  subtotal?: string
  totalItems?: number
}

// ##################################
// Get Cart Content
// ##################################

export async function getCartContent(): Promise<CartContent> {
  let html: string
  if (USE_MOCKS) {
    console.error('[INFO][get-cart-content] Fetching cart content from mocks')
    const mockPath = `${__dirname}/../mocks/getCartContent.html`
    html = fs.readFileSync(mockPath, 'utf-8')
  } else {
    const domain = getAmazonDomain()
    const url = `https://www.${domain}/-/en/gp/cart/view.html?ref_=nav_cart`
    console.error(`[INFO][get-cart-content] Fetching cart content from ${url}`)

    const { browser, page } = await createBrowserAndPage()

    try {
      // Navigate to the cart page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Handle login if needed
      await throwIfNotLoggedIn(page)

      // Wait for the cart content to load
      try {
        await page.waitForSelector('#sc-active-cart', { timeout: 10000 })
      } catch (e) {
        throw new Error('[INFO][get-cart-content] Could not find cart container. Ensure you are logged in and the cart is accessible.')
      }

      if (EXPORT_LIVE_SCRAPING_FOR_MOCKS) {
        // Export only the `#sc-active-cart` content to a mock file
        const timestamp = getTimestamp()
        const mockPath = `${__dirname}/../mocks/getCartContent_${timestamp}.html`
        const cartHtml = await page.$eval('#sc-active-cart', el => el.outerHTML)
        fs.writeFileSync(mockPath, cartHtml)
        console.error(`[INFO][get-cart-content] Exported cart container HTML to ${mockPath}`)
      }

      // Get the HTML content after JavaScript execution
      html = await page.content()
    } finally {
      await browser.close()
    }
  }

  const $ = cheerio.load(html)
  return extractCartPageData($)
}

function extractCartPageData($: cheerio.CheerioAPI): CartContent {
  const $cartContainer = $('#sc-active-cart')

  // Check if cart is empty
  const emptyCartText = $cartContainer.text()
  if (emptyCartText.includes('Your Amazon Cart is empty')) {
    return {
      isEmpty: true,
      items: [],
    }
  }

  // Extract cart items
  const items: CartItem[] = []
  $cartContainer.find('[data-asin]').each((_index, element) => {
    const $item = $(element)

    // Extract basic item information
    const titleElement = $item.find('a.sc-product-title').first()
    const title = titleElement.find('.a-truncate-full').text().trim()
    const price = $item.find('.apex-price-to-pay-value .a-offscreen').text().trim()
    const quantityElement = $item.find('[data-a-selector="value"]').text().trim()
    const quantity = parseInt(quantityElement) || 1

    // Extract optional information
    const image = $item.find('.sc-product-image').attr('src')
    const productUrl = $item.find('.sc-product-link').attr('href')
    const asin = $item.attr('data-asin')
    const availability = $item.find('.sc-product-availability').text().trim() || 'Unknown'
    const isSelected = $item.find('input[type="checkbox"]').is(':checked')

    console.error(`[INFO][get-cart-content] Extracted ASIN: ${asin}, Price: ${price}, Quantity: ${quantity}, item: ${title}`)
    // Only add items with valid titles and prices
    if (title && price) {
      items.push({
        title,
        price,
        quantity,
        image,
        productUrl,
        asin,
        availability,
        isSelected,
      })
    }
  })

  // Extract subtotal information
  const subtotal =
    $cartContainer.find('#sc-subtotal-amount-activecart .sc-price').text().trim() ||
    $cartContainer.find('.sc-subtotal .sc-price').text().trim()

  const totalItemsText = $cartContainer.find('#sc-subtotal-label-activecart').text().trim()
  const totalItemsMatch = totalItemsText.match(/\((\d+)\s+item/)
  const totalItems = totalItemsMatch ? parseInt(totalItemsMatch[1]) : items.length

  return {
    isEmpty: false,
    items,
    subtotal,
    totalItems,
  }
}

// ##################################
// Add to Cart
// ##################################

export async function addToCart(asin: string): Promise<{ success: boolean; message: string }> {
  if (!asin || asin.length !== 10) {
    throw new Error('Invalid ASIN provided. ASIN should be a 10-character string.')
  }

  const domain = getAmazonDomain()
  const url = `https://www.${domain}/-/en/gp/product/${asin}`
  console.error(`[INFO][add-to-cart] Adding product ${asin} to cart from ${url}`)

  const { browser, page } = await createBrowserAndPage()

  try {
    // Navigate to the product page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Handle login if needed
    await throwIfNotLoggedIn(page)

    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 10000 })

    try {
      // Check for subscribe and save option using XPath
      const xpath = "//div[contains(@class, 'accordion-caption')]//span[contains(text(), 'One-time purchase')]"
      const element = await page.waitForSelector(`::-p-xpath(${xpath})`, { timeout: 2000 })
      if (element) {
        console.error(`[INFO][add-to-cart] The item is a subscribe and save product, clicking the one-time purchase option`)
        element.click()
        // Wait for the page to update
        await new Promise(resolve => setTimeout(resolve, 2000))
      } else {
        console.error('[INFO][add-to-cart] No subscribe and save option found, proceeding to add to cart')
      }
    } catch (error) {
      console.error(`[INFO][add-to-cart] Error checking for subscribe and save option: ${error}`)
    }

    // Find and click the add to cart button
    try {
      await page.waitForSelector('#add-to-cart-button', { timeout: 10000 })
      await page.click('#add-to-cart-button')
      console.error('[INFO][add-to-cart] Clicked add to cart button')
    } catch (error) {
      throw new Error(`Could not find or click the add to cart button: ${error}`)
    }

    // If there is an insurance option, refuse it
    try {
      await page.waitForSelector('#productTitle', { timeout: 1000 })
      await page.click('#productTitle', { delay: 100 })
      await page.click('#attachSiNoCoverage', { delay: 300 })
    } catch (error) {
      console.error(`[WARNING][add-to-cart] Failed to click insurance option (it may not have been presented):`, error)
    }

    // Wait for the confirmation page/modal
    try {
      await page.waitForSelector('#sw-atc-confirmation', { timeout: 15000 })

      // Check for success message
      const confirmationText = await page.$eval('#sw-atc-confirmation', el => el.textContent || '')

      if (!confirmationText.includes('Added to cart') && !confirmationText.includes('Added to basket')) {
        throw new Error(`Unexpected confirmation message: ${confirmationText}`)
      }

      console.error('[INFO][add-to-cart] Successfully added product to cart')
      return {
        success: true,
        message: `Product ${asin} successfully added to cart`,
      }
    } catch (error) {
      throw new Error(`Could not verify that the product was added to cart: ${error}`)
    }
  } finally {
    await browser.close()
  }
}

// ##################################
// Clear Cart
// ##################################

export async function clearCart() {
  const domain = getAmazonDomain()
  const url = `https://www.${domain}/-/en/gp/cart/view.html`
  console.error(`[INFO][clear-cart] Clearing cart at ${url}`)

  const { browser, page } = await createBrowserAndPage()

  try {
    // Navigate to the cart page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Handle login if needed
    await throwIfNotLoggedIn(page)

    // Wait for the cart to load
    await page.waitForSelector('#sc-active-cart, .sc-cart-item, .sc-empty-cart-banner', { timeout: 10000 })

    // Find all delete buttons
    const deleteButtons = await page.$$('span[data-action="delete-active"]')

    if (deleteButtons.length === 0) {
      console.error('[INFO][clear-cart] No items found in cart to remove')
      return {
        success: true,
        message: 'No items found in cart to remove',
        itemsRemoved: 0,
      }
    }

    console.error(`[INFO][clear-cart] Found ${deleteButtons.length} items to remove`)

    let itemsRemoved = 0

    // Click each delete button with delay
    for (let i = 0; i < deleteButtons.length; i++) {
      try {
        // Re-query the delete buttons as DOM changes after each deletion
        const currentDeleteButtons = await page.$$('span[data-action="delete-active"]')

        if (currentDeleteButtons.length === 0) {
          console.error('[INFO][clear-cart] No more items to delete')
          break
        }

        // Click the first available delete button
        await currentDeleteButtons[0].click()
        itemsRemoved++

        console.error(`[INFO][clear-cart] Removed item ${itemsRemoved}`)

        // Wait for the page to update after deletion
        if (i < deleteButtons.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
      } catch (error) {
        console.error(`[WARNING][clear-cart] Failed to remove item ${i + 1}:`, error)
      }
    }

    console.error(`[INFO][clear-cart] Successfully removed ${itemsRemoved} items from cart`)

    return {
      success: true,
      message: `Successfully cleared cart. Removed ${itemsRemoved} items.`,
      itemsRemoved,
    }
  } catch (error: any) {
    console.error('[ERROR][clear-cart] Error clearing cart:', error)
    throw new Error(`Failed to clear cart: ${error.message}`)
  } finally {
    await browser.close()
  }
}