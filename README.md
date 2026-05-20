# ScanToKnow — Backend

> Node.js/Express REST API powering the ScanToKnow food intelligence platform — barcode lookup, OCR-based ingredient extraction, proprietary CPHS health scoring, and smart alternative recommendations.

🏆 **2nd Place — Xzibit 2026** National Level BE Project Competition (KCCEMSR)
🎓 **Aavishkar 2025 Finals** — University of Mumbai Inter-Collegiate Research Convention

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB Atlas |
| Search | MongoDB Atlas Search (2 indexes) |
| OCR | OCR.Space API (Engine 2) |
| ODM | Mongoose |

---

## Features

### CPHS — Consumer Product Health Score
A proprietary health scoring algorithm (patent applied) that outputs a 0–100 score per product:

- **S_Nutri (60%)** — FSAm-NPS based Nutri-Score component
- **S_Ing (40%)** — Positional-weighted top-5 ingredient risk scoring
- **P_Sugar** — Added sugar penalty
- **M_NOVA** — NOVA group processing multiplier
- **M_Add** — Additive risk multiplier (clamped 0.60–1.00)

### OCR Pipeline
Image → OCR.Space Engine 2 → Regex ingredient extractor → 7-pass Levenshtein fuzzy matching → MongoDB ingredient/additive resolution → NOVA computation

### Atlas Search
Two search indexes on `fooddb`:

**`variants_search`** — on `product_variants` collection
- `title` (autocomplete, minGrams: 2, maxGrams: 20)
- `brand.name` (autocomplete, minGrams: 2, maxGrams: 20)
- `cphs_final`, `health_label`, `health_stars`, `nova_group`, `nutri_score`, `category_ids`, `sku`, `description`, `quantity_value`, `quantity_unit`, `parent_product_id`

**`products_search`** — on `products` collection
- `product_name` (autocomplete)
- `brand`, `code`, `flavor_tags` (string)

### Alternatives Engine
Category-isolated recommendation engine with multi-factor ranking, label-based filtering modes, and an exclusion matrix preventing incompatible category suggestions.

---

## Project Structure

```
src/
├── config/          # MongoDB connection
├── controllers/     # Route handlers
├── models/          # Mongoose schemas
├── routes/          # Express routers
├── services/        # Business logic
│   ├── alternatives/ # Recommendation engine
│   ├── cphs.service.js
│   ├── ingredientExtractor.service.js
│   ├── nova.service.js
│   ├── ocrPipeline.service.js
│   └── ocrSpace.service.js
├── scripts/         # ETL & batch processing
├── utils/
├── app.js
└── server.js
```

---

## Database Schema (MongoDB)

**`product_variants`** — `{barcodes[], sku, title, brand, ingredient_summary, additives, nutriments, nova_group, nutri_score, cphs_final, health_label, health_stars}`

**`ingredients`** — `{canonical_name, aliases[], health_rating, source_tag, category}`

**`additives`** — `{code, name, health_rating, source_tag, synonyms[], category}`

**`products`** — `{product_name, brand, code, flavor_tags[]}`

**`categories`** — category taxonomy for product classification

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/search` | Search products by name/brand |
| GET | `/v1/products` | List products |
| GET | `/v1/scan/:barcode` | Lookup product by barcode |
| POST | `/v1/ocr/scan` | Extract ingredients from image |
| GET | `/v1/variants/:id` | Get product variant details |
| GET | `/v1/alternatives/:id` | Get alternative product recommendations |
| GET | `/v1/categories` | List categories |

---

## Setup & Installation

### Prerequisites
- Node.js v18+
- MongoDB Atlas account
- OCR.Space API key (free tier available at [ocr.space](https://ocr.space))

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/nparth29/ScanToKnow-Backend.git
cd ScanToKnow-Backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your real credentials

# 4. Start the server
npm start
```

### Environment Variables

```env
PORT=4000
MONGO_URI=your_mongodb_atlas_connection_string
OCR_SPACE_API_KEY=your_ocr_space_api_key
```

### Atlas Search Index Setup

After connecting your MongoDB Atlas cluster, create two search indexes manually via the Atlas UI (Search tab):

1. **`variants_search`** on `fooddb.product_variants`
2. **`products_search`** on `fooddb.products`

Refer to the index configurations in the [Atlas Search docs](https://www.mongodb.com/docs/atlas/atlas-search/).

---

## Related

- [ScanToKnow Frontend](https://github.com/nparth29/ScanToKnow) — Flutter mobile app

---

## Team

- **Parth Mishra**
- **Om Mujumdar**
- **Prathamesh Rane** 
- **Kaustubh Suryavanshi** 

---

## License

MIT License — see [LICENSE](./LICENSE) for details.

> ⚠️ The CPHS (Consumer Product Health Score) algorithm is patent-pending. The code is open source under MIT, but the algorithm methodology is protected intellectual property.
