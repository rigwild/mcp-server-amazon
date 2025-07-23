import { clearCart } from './cart.js'
import { USE_MOCKS } from './config.js'

async function testClearCart() {
  if (USE_MOCKS) {
    console.log('Skipping clearCart test because USE_MOCKS is enabled')
    return
  }

  try {
    console.log('Testing clearCart function...')

    const result = await clearCart()
    console.log('Result:', result)

    if (result.success) {
      console.log(`✅ Test passed: ${result.message}`)
    } else {
      console.log('❌ Test failed: Cart clearing was not successful')
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testClearCart()
}
