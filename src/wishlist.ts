import fs from 'fs'
import path from 'path'

const __dirname = new URL('.', import.meta.url).pathname
const WISHLISTS_FILE_PATH = path.join(__dirname, '..', 'wishlists.json')

// ##################################
// Types
// ##################################

export interface WishlistItem {
  asin: string
  title: string
  price: string
  productUrl: string
  image?: string
  notes?: string
  addedAt: string
}

export interface Wishlist {
  name: string
  description?: string
  items: WishlistItem[]
  createdAt: string
  updatedAt: string
}

interface WishlistStore {
  wishlists: Record<string, Wishlist>
}

// ##################################
// Storage Helpers
// ##################################

function wishlistKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

function loadWishlists(): WishlistStore {
  if (fs.existsSync(WISHLISTS_FILE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(WISHLISTS_FILE_PATH, 'utf-8'))
    } catch {
      return { wishlists: {} }
    }
  }
  return { wishlists: {} }
}

function saveWishlists(store: WishlistStore): void {
  fs.writeFileSync(WISHLISTS_FILE_PATH, JSON.stringify(store, null, 2))
}

// ##################################
// Create Wishlist
// ##################################

export function createWishlist(name: string, description?: string): { success: boolean; message: string } {
  const store = loadWishlists()
  const key = wishlistKey(name)

  if (store.wishlists[key]) {
    return { success: false, message: `Wishlist "${name}" already exists.` }
  }

  store.wishlists[key] = {
    name,
    description,
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  saveWishlists(store)
  console.error(`[INFO][create-wishlist] Created wishlist "${name}"`)
  return { success: true, message: `Wishlist "${name}" created successfully.` }
}

// ##################################
// Add to Wishlist
// ##################################

export function addToWishlist(
  wishlistName: string,
  item: Omit<WishlistItem, 'addedAt'>,
): { success: boolean; message: string } {
  const store = loadWishlists()
  const key = wishlistKey(wishlistName)

  // Auto-create wishlist if it doesn't exist
  if (!store.wishlists[key]) {
    store.wishlists[key] = {
      name: wishlistName,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    console.error(`[INFO][add-to-wishlist] Auto-created wishlist "${wishlistName}"`)
  }

  const wishlist = store.wishlists[key]

  // Prevent duplicates
  if (wishlist.items.some(i => i.asin === item.asin)) {
    return { success: false, message: `"${item.title}" is already in wishlist "${wishlistName}".` }
  }

  wishlist.items.push({ ...item, addedAt: new Date().toISOString() })
  wishlist.updatedAt = new Date().toISOString()

  saveWishlists(store)
  console.error(`[INFO][add-to-wishlist] Added ASIN ${item.asin} to wishlist "${wishlistName}"`)
  return { success: true, message: `Added "${item.title}" to wishlist "${wishlistName}".` }
}

// ##################################
// Get Wishlist
// ##################################

export function getWishlist(name: string): Wishlist | null {
  const store = loadWishlists()
  const key = wishlistKey(name)
  return store.wishlists[key] ?? null
}

// ##################################
// List Wishlists
// ##################################

export function listWishlists(): {
  name: string
  description?: string
  itemCount: number
  estimatedTotal: string
  updatedAt: string
}[] {
  const store = loadWishlists()

  return Object.values(store.wishlists).map(wishlist => {
    const total = wishlist.items.reduce((sum, item) => {
      const price = parseFloat(item.price.replace(/[$,]/g, ''))
      return sum + (isNaN(price) ? 0 : price)
    }, 0)

    return {
      name: wishlist.name,
      description: wishlist.description,
      itemCount: wishlist.items.length,
      estimatedTotal: `$${total.toFixed(2)}`,
      updatedAt: wishlist.updatedAt,
    }
  })
}

// ##################################
// Remove from Wishlist
// ##################################

export function removeFromWishlist(wishlistName: string, asin: string): { success: boolean; message: string } {
  const store = loadWishlists()
  const key = wishlistKey(wishlistName)

  if (!store.wishlists[key]) {
    return { success: false, message: `Wishlist "${wishlistName}" not found.` }
  }

  const wishlist = store.wishlists[key]
  const before = wishlist.items.length
  wishlist.items = wishlist.items.filter(i => i.asin !== asin)

  if (wishlist.items.length === before) {
    return { success: false, message: `ASIN "${asin}" not found in wishlist "${wishlistName}".` }
  }

  wishlist.updatedAt = new Date().toISOString()
  saveWishlists(store)
  console.error(`[INFO][remove-from-wishlist] Removed ASIN ${asin} from wishlist "${wishlistName}"`)
  return { success: true, message: `Removed item from wishlist "${wishlistName}".` }
}

// ##################################
// Delete Wishlist
// ##################################

export function deleteWishlist(name: string): { success: boolean; message: string } {
  const store = loadWishlists()
  const key = wishlistKey(name)

  if (!store.wishlists[key]) {
    return { success: false, message: `Wishlist "${name}" not found.` }
  }

  delete store.wishlists[key]
  saveWishlists(store)
  console.error(`[INFO][delete-wishlist] Deleted wishlist "${name}"`)
  return { success: true, message: `Wishlist "${name}" deleted.` }
}
