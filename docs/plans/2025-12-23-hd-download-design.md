# HD Photo Download Feature

## Overview

Enable parents to download high-resolution photos they've purchased. Hybrid approach: immediate access to original files, with retouched versions available later.

## Data Model

No new tables. Query existing data:

```
orders (family_id, payment_status='paid')
  └── order_items (photo_id)
       └── photos (original_url)
```

New server action: `getPurchasedPhotoIds(familyId: string)` returns Set of photo IDs.

## UI Changes

### Gallery Photo Cards
- Gold "HD" badge on purchased photos (top-right, opposite heart)
- Click badge → download original_url
- Regular click still opens lightbox

### Order Confirmation Page (`/order/[orderId]/complete`)
- "Your Photos" section when paid
- Thumbnails with "Download HD" buttons
- Each photo downloadable individually

### Gallery Header
- "X Photos Purchased" badge when family owns photos
- Click to filter/highlight purchased photos

### Admin Orders Dashboard
- Payment status badges (Green/Yellow/Red)
- Photo count per order
- Expandable rows showing purchased thumbnails

### Admin Family Detail
- "Purchases" section
- Order history with thumbnails
- Total spent

## Implementation Order

1. Server action: `getPurchasedPhotoIds()`
2. Gallery: HD badge + download
3. Order complete page: Your Photos section
4. Gallery header: Purchased indicator
5. Admin enhancements (if time)
