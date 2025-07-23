import { searchProducts } from './products.js'

async function testSearchProducts() {
  console.log('🧪 Testing Amazon Search Products functionality...')
  console.log('='.repeat(50))

  // Test 1: Basic search functionality
  console.log('\n📦 Test 1: Basic search for "collagen"')
  console.log('-'.repeat(30))
  try {
    const results = await searchProducts('collagen')
    console.log(`✅ Found ${results.length} products`)

    if (results.length > 0) {
      const firstProduct = results[0]
      console.log(`📍 First product:`)
      console.log(`   ASIN: ${firstProduct.asin}`)
      console.log(`   Title: ${firstProduct.title}`)
      console.log(`   Price: ${firstProduct.price || 'N/A'}`)
      console.log(`   Brand: ${firstProduct.brand || 'N/A'}`)
      console.log(`   Sponsored: ${firstProduct.isSponsored}`)
      console.log(`   Prime: ${firstProduct.isPrimeEligible}`)
      console.log(`   Reviews: ${firstProduct.reviews?.averageRating || 'N/A'} (${firstProduct.reviews?.reviewCount || 'N/A'} reviews)`)
      console.log(`   Delivery: ${firstProduct.deliveryInfo || 'N/A'}`)

      console.log()
      console.log()
      console.log()
      console.log('Logging first 5 products:')
      console.log(results.slice(0, 5))
    }
  } catch (error) {
    console.log(`❌ Error: ${error}`)
  }

  // // Test 2: Search with special characters
  // console.log('\n📦 Test 2: Search with special characters "café & tea"')
  // console.log('-'.repeat(30))
  // try {
  //   const results = await searchProducts('café & tea')
  //   console.log(`✅ Found ${results.length} products with special characters`)
  // } catch (error) {
  //   console.log(`❌ Error with special characters: ${error}`)
  // }

  // // Test 3: Search for a popular tech product
  // console.log('\n📦 Test 3: Search for "iPhone"')
  // console.log('-'.repeat(30))
  // try {
  //   const results = await searchProducts('iPhone')
  //   console.log(`✅ Found ${results.length} iPhone products`)

  //   // Check for variety in results
  //   const sponsoredCount = results.filter(p => p.isSponsored).length
  //   const primeCount = results.filter(p => p.isPrimeEligible).length
  //   const bestSellerCount = results.filter(p => p.isBestSeller).length
  //   const withPriceCount = results.filter(p => p.price).length

  //   console.log(`   📊 Statistics:`)
  //   console.log(`   - Sponsored ads: ${sponsoredCount}`)
  //   console.log(`   - Prime eligible: ${primeCount}`)
  //   console.log(`   - Best sellers: ${bestSellerCount}`)
  //   console.log(`   - With prices: ${withPriceCount}`)
  // } catch (error) {
  //   console.log(`❌ Error searching for iPhone: ${error}`)
  // }

  // // Test 4: Edge case - empty search term
  // console.log('\n📦 Test 4: Empty search term (should fail)')
  // console.log('-'.repeat(30))
  // try {
  //   const results = await searchProducts('')
  //   console.log(`❌ Empty search should have failed but returned ${results.length} results`)
  // } catch (error: any) {
  //   console.log(`✅ Correctly handled empty search term: ${error.message}`)
  // }

  // // Test 5: Search for something unlikely to exist
  // console.log('\n📦 Test 5: Search for unlikely term "xyzabc123nonexistent"')
  // console.log('-'.repeat(30))
  // try {
  //   const results = await searchProducts('xyzabc123nonexistent')
  //   console.log(`✅ Search for unlikely term returned ${results.length} products (expected 0 or few)`)
  // } catch (error) {
  //   console.log(`❌ Error with unlikely search term: ${error}`)
  // }

  // // Test 6: Verify data quality for a few products
  // console.log('\n📦 Test 6: Data quality check for "laptop"')
  // console.log('-'.repeat(30))
  // try {
  //   const results = await searchProducts('laptop')
  //   console.log(`✅ Found ${results.length} laptop products`)

  //   let validASINs = 0
  //   let validTitles = 0
  //   let withImages = 0

  //   results.slice(0, 5).forEach((product, index) => {
  //     if (product.asin && product.asin.length === 10) validASINs++
  //     if (product.title && product.title.length > 0) validTitles++
  //     if (product.imageUrl) withImages++

  //     console.log(`   Product ${index + 1}: ${product.asin} - ${product.title.substring(0, 50)}${product.title.length > 50 ? '...' : ''}`)
  //   })

  //   console.log(`   📊 Quality metrics (first 5):`)
  //   console.log(`   - Valid ASINs: ${validASINs}/5`)
  //   console.log(`   - Valid titles: ${validTitles}/5`)
  //   console.log(`   - With images: ${withImages}/5`)
  // } catch (error) {
  //   console.log(`❌ Error in data quality check: ${error}`)
  // }

  // console.log('\n' + '='.repeat(50))
  console.log('✨ Search Products tests completed!')
}

// Run the tests
testSearchProducts().catch(console.error)
