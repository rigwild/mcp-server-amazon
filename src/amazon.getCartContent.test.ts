import { getCartContent } from './cart.js'

async function main() {
  try {
    const cartContent = await getCartContent()
    console.log('getCartContent result:')
    console.log(JSON.stringify(cartContent, null, 2))
  } catch (error) {
    console.error('Error fetching cart content:', error)
  }
}
main().catch(console.error)
