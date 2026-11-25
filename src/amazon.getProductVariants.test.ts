// Offline test: parses mocks/getProductDetails.html, makes no network calls.
// Run: npm run build && node build/amazon.getProductVariants.test.js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import { filterVariants, parseChildOffer, parseVariantMap } from './products.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const html = fs.readFileSync(`${__dirname}/../mocks/getProductDetails.html`, 'utf-8')

// Variant map
const map = parseVariantMap(html)
assert.ok(map, 'variant map should be found in the mock page')
assert.deepEqual(map.dimensionNames, ['Size', 'Colour'])
assert.ok(map.variants.length > 1, 'mock has several variations')
for (const v of map.variants) {
  assert.match(v.asin, /^[A-Z0-9]{10}$/)
  assert.equal(v.values.length, 2)
}
assert.deepEqual(
  map.variants.find(v => v.asin === 'B08DFNN8P4')?.values,
  ['48 EU', 'Smoked Black'],
  'known child ASIN maps to its size and color'
)
assert.equal(parseVariantMap('<html>no twister here</html>'), null)
// amazon.com format: names come from dimensions + variationDisplayLabels
const usMap = parseVariantMap(
  '"dimensions" : ["size_name","color_name"], "variationDisplayLabels" : {"size_name":"Size","color_name":"Color"},' +
    ' "dimensionValuesDisplayData" : {"B0FX2QC35K":["XX-Large","Brown - Pumpkin & Turkey"]}'
)
assert.deepEqual(usMap?.dimensionNames, ['Size', 'Color'])
assert.deepEqual(usMap?.variants, [{ asin: 'B0FX2QC35K', values: ['XX-Large', 'Brown - Pumpkin & Turkey'] }])

// Filters: exact match wins over substring
const size48 = filterVariants(map.variants, map.dimensionNames, '48 eu', /size/i)
assert.ok(size48.length > 0 && size48.every(v => v.values[0] === '48 EU'))
const synthetic = [
  { asin: 'A000000001', values: ['X-Large', 'Red'] },
  { asin: 'A000000002', values: ['XX-Large', 'Red'] },
]
assert.deepEqual(
  filterVariants(synthetic, ['Size', 'Color'], 'X-Large', /size/i).map(v => v.asin),
  ['A000000001'],
  '"X-Large" must not also match "XX-Large"'
)
assert.equal(filterVariants(synthetic, ['Size', 'Color'], 'large', /size/i).length, 2, 'substring fallback')
const black = filterVariants(map.variants, map.dimensionNames, 'black', /colou?r/i)
assert.ok(black.length > 0 && black.every(v => v.values[1].toLowerCase().includes('black')))
assert.equal(filterVariants(synthetic, ['Size', 'Color'], 'nope', /size/i).length, 0)
// Real layout of B07Z9PY46C: "Special Size" comes before "Size"; the filter must use "Size"
const threeDims = [
  { asin: 'B07Z9Q8ZZR', values: ['Thanksgiving', 'XX-Large', 'Navy Thanksgiving'] },
  { asin: 'A000000003', values: ['Thanksgiving', 'Large', 'Navy Thanksgiving'] },
]
assert.deepEqual(
  filterVariants(threeDims, ['Special Size', 'Size', 'Color'], 'XX-Large', /size/i).map(v => v.asin),
  ['B07Z9Q8ZZR'],
  'size filter must use the dimension named exactly "Size"'
)
assert.equal(filterVariants(threeDims, ['Special Size', 'Color'], 'Thanksgiving', /size/i).length, 2, 'partial name fallback')
assert.equal(filterVariants(synthetic, ['Size', 'Color'], undefined, /size/i).length, 2, 'no filter keeps all')

// Child offer: the mock is a single page with a delivery block
const offer = parseChildOffer(cheerio.load(html))
assert.ok(offer.delivery?.time, 'delivery time should be read from data-csa-c-delivery-time')
assert.ok(!offer.availability?.includes('{'), 'availability must not contain page JSON')
// Live markup of #availability: visible span plus a hidden a-state script
const liveAvailability = parseChildOffer(
  cheerio.load(
    '<div id="availability"><span class="primary-availability-message">In Stock</span>' +
      '<script type="a-state">{"isInternal":false,"showInsightsHub":false}</script><br></div>'
  )
)
assert.equal(liveAvailability.availability, 'In Stock')
// fastestDelivery only when it differs from delivery
const deliverySpan = (time: string, price: string) =>
  `<span data-csa-c-delivery-time="${time}" data-csa-c-delivery-price="${price}" data-csa-c-delivery-cutoff=""></span>`
const repeated = parseChildOffer(cheerio.load(deliverySpan('Today 3 PM - 6 PM', 'FREE') + deliverySpan('Today 3 PM - 6 PM', 'FREE')))
assert.equal(repeated.delivery?.time, 'Today 3 PM - 6 PM')
assert.equal(repeated.fastestDelivery, undefined, 'identical second option is dropped')
const twoOptions = parseChildOffer(cheerio.load(deliverySpan('Saturday, November 28', 'FREE') + deliverySpan('Tomorrow, November 26', '$5.99')))
assert.deepEqual(twoOptions.fastestDelivery, { time: 'Tomorrow, November 26', price: '$5.99', cutoff: undefined })
console.log('Child offer parsed from mock:', JSON.stringify(offer, null, 2))

console.log(`✅ getProductVariants offline tests passed (${map.variants.length} variants in mock)`)
