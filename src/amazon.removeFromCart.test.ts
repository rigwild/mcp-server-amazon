import { removeFromCart } from './cart.js'
import { USE_MOCKS } from './config.js'

// Manual / live test. Pass an ASIN as argv[2], e.g.:
//   node build/amazon.removeFromCart.test.js B0FGD3P28X
async function testRemoveFromCart() {
  if (USE_MOCKS) {
    console.log('Skipping removeFromCart test because USE_MOCKS is enabled')
    return
  }

  const asin = process.argv[2]
  if (!asin) {
    console.log('Usage: node build/amazon.removeFromCart.test.js <ASIN>')
    return
  }

  try {
    console.log(`Testing removeFromCart for ASIN ${asin}...`)

    const result = await removeFromCart(asin)
    console.log('Result:', result)

    if (result.success) {
      console.log(`✅ Test passed: ${result.message}`)
    } else {
      console.log(`❌ Test failed: ${result.message}`)
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRemoveFromCart()
}
