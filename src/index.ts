import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { getOrdersHistory } from './orders.js'
import { getCartContent, addToCart, clearCart } from './cart.js'
import { getProductDetails, searchProducts } from './products.js'
import { createWishlist, addToWishlist, getWishlist, listWishlists, removeFromWishlist, deleteWishlist } from './wishlist.js'

// Create server instance
const server = new McpServer({
  name: 'amazon',
  version: '1.0.0',
})

server.tool('get-orders-history', 'Get orders history for a user', {}, async ({}) => {
  let ordersHistory: Awaited<ReturnType<typeof getOrdersHistory>>
  try {
    ordersHistory = await getOrdersHistory()
  } catch (error: any) {
    console.error('[ERROR][get-orders-history] Error in get-orders-history tool:', error)
    return {
      content: [
        {
          type: 'text',
          text: `An error occurred while retrieving orders history. Error: ${error.message}`,
        },
      ],
    }
  }

  if (!ordersHistory || ordersHistory.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: 'No orders found.',
        },
      ],
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(ordersHistory, null, 2),
      },
    ],
  }
})

server.tool(
  'get-cart-content',
  'Get the current cart content for a user - Always provide the product link when you mention a product in the response',
  {},
  async ({}) => {
    let cartContent: Awaited<ReturnType<typeof getCartContent>>
    try {
      cartContent = await getCartContent()
    } catch (error: any) {
      console.error('[ERROR][get-cart-content] Error in get-cart-content tool:', error)
      return {
        content: [
          {
            type: 'text',
            text: `An error occurred while retrieving cart content. Error: ${error.message}`,
          },
        ],
      }
    }

    if (cartContent.isEmpty) {
      return {
        content: [
          {
            type: 'text',
            text: 'Your Amazon cart is empty.',
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(cartContent, null, 2),
        },
      ],
    }
  }
)

server.tool(
  'add-to-cart',
  'Add a product to the Amazon cart using ASIN - You should always ask for confirmation to the user before running this tool',
  {
    asin: z
      .string()
      .length(10, { message: 'ASIN must be a 10-character string.' })
      .describe('The ASIN (Amazon Standard Identification Number) of the product to add to cart. Must be a 10-character string.'),
  },
  async ({ asin }) => {
    let result: Awaited<ReturnType<typeof addToCart>>
    try {
      result = await addToCart(asin)
    } catch (error: any) {
      console.error('[ERROR][add-to-cart] Error in add-to-cart tool:', error)
      return {
        content: [
          {
            type: 'text',
            text: `An error occurred while adding product to cart. Error: ${error.message}`,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: result.success ? `✅ ${result.message}` : `❌ Failed to add product to cart: ${result.message}`,
        },
      ],
    }
  }
)

server.tool('clear-cart', 'Clear all items from the Amazon cart', {}, async ({}) => {
  let result: Awaited<ReturnType<typeof clearCart>>
  try {
    result = await clearCart()
  } catch (error: any) {
    console.error('[ERROR][clear-cart] Error in clear-cart tool:', error)
    return {
      content: [
        {
          type: 'text',
          text: `An error occurred while clearing the cart. Error: ${error.message}`,
        },
      ],
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: result.message,
      },
    ],
  }
})

server.tool(
  'get-product-details',
  'Get detailed information about a product using its ASIN - Always provide the product link when you mention a product in the response',
  {
    asin: z
      .string()
      .length(10, { message: 'ASIN must be a 10-character string.' })
      .describe('The ASIN (Amazon Standard Identification Number) of the product to get details for. Must be a 10-character string.'),
  },
  async ({ asin }) => {
    let result: Awaited<ReturnType<typeof getProductDetails>>
    try {
      result = await getProductDetails(asin)
    } catch (error: any) {
      console.error('[ERROR][get-product-details] Error in get-product-details tool:', error)
      return {
        content: [
          {
            type: 'text',
            text: `An error occurred while retrieving product details. Error: ${error.message}`,
          },
        ],
      }
    }

    return {
      content: result.mainImageBase64
        ? [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
            {
              type: 'image',
              data: result.mainImageBase64,
              mimeType: 'image/jpeg',
            },
          ]
        : [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
    }
  }
)

server.tool(
  'search-products',
  'Search for products on Amazon using a search term - Returns a list of products matching the search term - Always provide the product link when you mention a product in the response',
  {
    searchTerm: z
      .string()
      .min(1, { message: 'Search term cannot be empty.' })
      .describe('The search term to look for products on Amazon. For example: "collagen", "laptop", "books"'),
  },
  async ({ searchTerm }) => {
    let result: Awaited<ReturnType<typeof searchProducts>>
    try {
      result = await searchProducts(searchTerm)
    } catch (error: any) {
      console.error('[ERROR][search-products] Error in search-products tool:', error)
      return {
        content: [
          {
            type: 'text',
            text: `An error occurred while searching for products. Error: ${error.message}`,
          },
        ],
      }
    }

    if (!result || result.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No products found for search term "${searchTerm}".`,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  }
)

server.tool(
  'perform-purchase',
  'Checkout with the current cart and complete the purchase - ' +
    'Before purchasing, you should verify in the cart content that your are not buying another product that was already there. ' +
    'If there are other products, clear the cart then add the items that the user want to buy again to the cart. ' +
    'Eventually you can purchase. ' +
    'You should always ask for confirmation to the user before running this tool',
  {},
  async ({}) => {
    // Mock the purchase confirmation for demonstration purposes
    return {
      content: [
        {
          type: 'text',
          text: '✅ Purchase confirmed! You can now consult your orders history to see the details of your latest purchase.',
        },
      ],
    }
  }
)

// ##################################
// Wishlist Tools
// ##################################

server.tool(
  'create-wishlist',
  'Create a new local wishlist to save Amazon products for later. Wishlists are stored in wishlists.json.',
  {
    name: z.string().min(1).describe('Name for the wishlist, e.g. "Camping Gear", "Nintendo Switch", "Tesla Accessories"'),
    description: z.string().optional().describe('Optional description for the wishlist'),
  },
  async ({ name, description }) => {
    try {
      const result = createWishlist(name, description)
      return { content: [{ type: 'text', text: result.success ? `✅ ${result.message}` : `❌ ${result.message}` }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `❌ Error creating wishlist: ${error.message}` }] }
    }
  }
)

server.tool(
  'add-to-wishlist',
  'Add a product to a local wishlist by ASIN. Auto-creates the wishlist if it does not exist. Use this to save cart items for later.',
  {
    wishlistName: z.string().min(1).describe('Name of the wishlist to add the item to'),
    asin: z.string().length(10).describe('10-character Amazon ASIN of the product'),
    title: z.string().min(1).describe('Product title'),
    price: z.string().min(1).describe('Product price, e.g. "$19.99"'),
    productUrl: z.string().describe('Amazon product URL or path'),
    image: z.string().optional().describe('Product image URL'),
    notes: z.string().optional().describe('Optional personal notes about this item'),
  },
  async ({ wishlistName, asin, title, price, productUrl, image, notes }) => {
    try {
      const result = addToWishlist(wishlistName, { asin, title, price, productUrl, image, notes })
      return { content: [{ type: 'text', text: result.success ? `✅ ${result.message}` : `❌ ${result.message}` }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `❌ Error adding to wishlist: ${error.message}` }] }
    }
  }
)

server.tool(
  'get-wishlist',
  'Get all items in a specific wishlist, including titles, prices, ASINs, and product links.',
  {
    name: z.string().min(1).describe('Name of the wishlist to retrieve'),
  },
  async ({ name }) => {
    try {
      const result = getWishlist(name)
      if (!result) {
        return { content: [{ type: 'text', text: `❌ Wishlist "${name}" not found. Use list-wishlists to see all wishlists.` }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `❌ Error retrieving wishlist: ${error.message}` }] }
    }
  }
)

server.tool(
  'list-wishlists',
  'List all wishlists with their names, item counts, estimated totals, and last updated timestamps.',
  {},
  async () => {
    try {
      const result = listWishlists()
      if (result.length === 0) {
        return { content: [{ type: 'text', text: 'No wishlists found. Use create-wishlist or add-to-wishlist to get started.' }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `❌ Error listing wishlists: ${error.message}` }] }
    }
  }
)

server.tool(
  'remove-from-wishlist',
  'Remove a specific product from a wishlist by ASIN.',
  {
    wishlistName: z.string().min(1).describe('Name of the wishlist'),
    asin: z.string().length(10).describe('10-character ASIN of the product to remove'),
  },
  async ({ wishlistName, asin }) => {
    try {
      const result = removeFromWishlist(wishlistName, asin)
      return { content: [{ type: 'text', text: result.success ? `✅ ${result.message}` : `❌ ${result.message}` }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `❌ Error removing from wishlist: ${error.message}` }] }
    }
  }
)

server.tool(
  'delete-wishlist',
  'Permanently delete an entire wishlist and all its items.',
  {
    name: z.string().min(1).describe('Name of the wishlist to delete'),
  },
  async ({ name }) => {
    try {
      const result = deleteWishlist(name)
      return { content: [{ type: 'text', text: result.success ? `✅ ${result.message}` : `❌ ${result.message}` }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `❌ Error deleting wishlist: ${error.message}` }] }
    }
  }
)

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[INFO] Amazon MCP Server running on stdio')
}

main().catch(error => {
  console.error('[ERROR] Fatal error in main():', error)
  process.exit(1)
})
