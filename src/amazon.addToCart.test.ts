import { addToCart } from './cart.js'
import { searchProducts } from './products.js'
import { USE_MOCKS } from './config.js'

async function getTestProductASIN() {
  try {
    // Search for products that are commonly available and likely to have add to cart functionality
    const searchTerms = ['usb cable', 'hdmi cable', 'phone charger', 'mouse pad'];
    
    for (const term of searchTerms) {
      console.log(`Searching for "${term}" to find a product to add to cart...`);
      const results = await searchProducts(term);
      
      if (results && results.length > 0) {
        // Find a product that's not sponsored and is Prime eligible (more likely to be in stock)
        const idealProduct = results.find(p => 
          p.asin && 
          !p.title.toLowerCase().includes('sponsored') && 
          p.isPrimeEligible &&
          p.price // Has a price, indicating it's available
        );
        
        if (idealProduct) {
          console.log(`Found product: ${idealProduct.title} (${idealProduct.asin})`);
          return idealProduct.asin;
        }
        
        // Fallback to any product with a price
        const anyProduct = results.find(p => p.asin && p.price);
        if (anyProduct) {
          console.log(`Found product: ${anyProduct.title} (${anyProduct.asin})`);
          return anyProduct.asin;
        }
      }
    }
    
    throw new Error('Could not find any suitable products to test');
  } catch (error) {
    console.error('Error finding test product:', error);
    // Return a commonly available ASIN as fallback
    return 'B07THHPGCV'; // Common USB cable
  }
}

async function testAddToCart() {
  if (USE_MOCKS) {
    console.log('Skipping addToCart test because USE_MOCKS is enabled')
    return
  }

  try {
    // Get a dynamic ASIN from search results
    const testAsin = await getTestProductASIN();
    
    console.log(`\nTesting addToCart with ASIN: ${testAsin}`)

    const result = await addToCart(testAsin)
    console.log('Result:', result)

    if (result.success) {
      console.log('✅ Test passed: Product successfully added to cart')
    } else {
      console.log('❌ Test failed: Product was not added to cart')
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

async function testAddToCartWithOptions() {
  if (USE_MOCKS) {
    console.log('Skipping addToCart test with options because USE_MOCKS is enabled')
    return
  }

  console.log('\n\n--------------------------------------')
  console.log('Testing add to cart with products that may have options...')
  
  try {
    // Search for products that often have subscribe & save options
    console.log('Searching for products with subscribe & save options...');
    const results = await searchProducts('paper towels');
    
    const subscribeProduct = results.find(p => 
      p.asin && 
      (p.title.toLowerCase().includes('pack') || 
       p.title.toLowerCase().includes('count') ||
       p.title.toLowerCase().includes('rolls'))
    );
    
    if (subscribeProduct) {
      console.log(`\nTesting with product that may have subscribe & save: ${subscribeProduct.title}`);
      console.log(`ASIN: ${subscribeProduct.asin}`);
      
      try {
        const result = await addToCart(subscribeProduct.asin);
        console.log('Result:', result);
        
        if (result.success) {
          console.log('✅ Test passed: Product with options successfully added to cart');
        }
      } catch (error: any) {
        console.log('Note: Product may require additional interaction:', error.message);
      }
    }
  } catch (error) {
    console.error('Could not test products with options:', error);
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log('=== Amazon Add to Cart Test ===\n');
    await testAddToCart();
    await testAddToCartWithOptions();
    console.log('\n=== Tests completed ===');
  })();
}