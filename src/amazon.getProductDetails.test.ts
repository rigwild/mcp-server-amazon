import { getProductDetails, searchProducts } from './products.js'
import { USE_MOCKS } from './config.js'

async function getTestASINs() {
  try {
    // Search for common products that are likely to be available
    const searchTerms = ['usb cable', 'notebook', 'pen'];
    
    for (const term of searchTerms) {
      console.log(`Searching for "${term}" to get test ASINs...`);
      const results = await searchProducts(term);
      
      if (results && results.length > 0) {
        // Find a regular product and one that might have subscribe & save
        const regularProduct = results.find(p => p.asin && !p.title.toLowerCase().includes('sponsored'));
        const subscribeProduct = results.find(p => p.asin && (p.title.toLowerCase().includes('pack') || p.title.toLowerCase().includes('count')));
        
        return {
          regular: regularProduct?.asin || results[0].asin,
          subscribe: subscribeProduct?.asin || results[1]?.asin || results[0].asin
        };
      }
    }
    
    throw new Error('Could not find any products to test with');
  } catch (error) {
    console.error('Error getting test ASINs:', error);
    // Fallback to some commonly available ASINs
    return {
      regular: 'B07THHPGCV', // Common USB cable
      subscribe: 'B07232M876' // Common office supplies
    };
  }
}

async function testGetProductDetails_regular() {
  console.log('\n\n--------------------------------------')
  console.log('Run testGetProductDetails_regular...')
  
  if (USE_MOCKS) {
    console.log('Using mock data - skipping dynamic ASIN lookup');
    const testAsin = 'B0F2255HFW';
    try {
      const result = await getProductDetails(testAsin);
      console.log('✅ Mock test passed');
      return;
    } catch (error) {
      console.error('❌ Mock test failed:', error);
      return;
    }
  }
  
  try {
    const asins = await getTestASINs();
    const testAsin = asins.regular;
    console.log(`Testing getProductDetails with ASIN: ${testAsin}`)

    const result = await getProductDetails(testAsin)
    console.log('Result data:')
    console.log(JSON.stringify(result.data, null, 2))

    // Basic validation
    if (result.data.asin === testAsin && result.data.title && result.data.price) {
      console.log('✅ Test passed: Product details successfully retrieved')
      console.log(`   Title: ${result.data.title}`)
      console.log(`   Price: ${result.data.price}`)
      console.log(`   Reviews: ${result.data.reviews.averageRating || 'N/A'} (${result.data.reviews.reviewsCount || '0'} reviews)`)
    } else {
      console.log('❌ Test failed: Missing required product data')
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

async function testGetProductDetails_subscribeAndSave() {
  console.log('\n\n--------------------------------------')
  console.log('Run testGetProductDetails_subscribeAndSave...')
  
  if (USE_MOCKS) {
    console.log('Using mock data - skipping dynamic ASIN lookup');
    return;
  }
  
  try {
    const asins = await getTestASINs();
    const testAsin = asins.subscribe;
    console.log(`Testing getProductDetails with ASIN: ${testAsin}`)

    const result = await getProductDetails(testAsin)
    console.log('Result data:')
    console.log(JSON.stringify(result.data, null, 2))

    // Basic validation
    if (result.data.asin === testAsin && result.data.title && result.data.price) {
      console.log('✅ Test passed: Product details successfully retrieved')
      console.log(`   Title: ${result.data.title}`)
      console.log(`   Price: ${result.data.price}`)
      console.log(`   Subscribe & Save available: ${result.data.canUseSubscribeAndSave}`)
    } else {
      console.log('❌ Test failed: Missing required product data')
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

async function testInvalidAsin() {
  console.log('\n\n--------------------------------------')
  console.log('Run testInvalidAsin...')
  try {
    console.log('\nTesting getProductDetails with invalid ASIN...')
    await getProductDetails('INVALID')
    console.log('❌ Test failed: Should have thrown an error for invalid ASIN')
  } catch (error: any) {
    console.log('✅ Test passed: Correctly rejected invalid ASIN')
    console.log(`   Error: ${error.message}`)
  }
}

async function main() {
  console.log('Running getProductDetails tests...\n')
  await testGetProductDetails_regular()
  await testGetProductDetails_subscribeAndSave()
  await testInvalidAsin()
  console.log('\nTests completed.')
}

main().catch(console.error)