import { getOrdersHistory } from './orders.js'

async function main() {
  try {
    const orders = await getOrdersHistory()
    console.log('getOrdersHistory result:')
    console.log(JSON.stringify(orders, null, 2))
  } catch (error) {
    console.error('Error fetching orders:', error)
  }
}
main().catch(console.error)
