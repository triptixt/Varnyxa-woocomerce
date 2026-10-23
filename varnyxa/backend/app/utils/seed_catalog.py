from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.catalog import Category, Brand, Product, ProductVariant, ProductImage, Gender, AgeGroup
from app.models.coupon import Coupon, DiscountType


def seed_store():
    db = SessionLocal()
    try:
        print("Seeding VARNYXA Categories, Brands, Coupons, and Comprehensive Clothing Catalog...")

        # 1. Coupons
        coupons_data = [
            {
                "code": "WELCOME500",
                "description": "INR 500 flat discount on your premier VARNYXA order above INR 1,999",
                "discount_type": DiscountType.FIXED,
                "discount_value": 500.0,
                "min_order_value": 1999.0,
                "max_discount": None,
                "is_active": True,
            },
            {
                "code": "VARNYXA15",
                "description": "15% off across contemporary and heritage couture (up to INR 1,500)",
                "discount_type": DiscountType.PERCENTAGE,
                "discount_value": 15.0,
                "min_order_value": 2499.0,
                "max_discount": 1500.0,
                "is_active": True,
            },
            {
                "code": "FESTIVE20",
                "description": "20% off luxury festive and occasion wear (up to INR 2,500)",
                "discount_type": DiscountType.PERCENTAGE,
                "discount_value": 20.0,
                "min_order_value": 3999.0,
                "max_discount": 2500.0,
                "is_active": True,
            },
        ]
        for c_data in coupons_data:
            existing_c = db.query(Coupon).filter(Coupon.code == c_data["code"]).first()
            if not existing_c:
                c = Coupon(**c_data)
                db.add(c)

        # 2. Brands
        brands_data = [
            {"name": "VARNYXA Atelier", "slug": "varnyxa-atelier", "description": "High-end artisanal tailoring and couture craftsmanship."},
            {"name": "VARNYXA Heritage", "slug": "varnyxa-heritage", "description": "Timeless ethnic weaves, handloom silks, and bespoke festive wear."},
            {"name": "VARNYXA Urban", "slug": "varnyxa-urban", "description": "Modern minimalist silhouettes, refined everyday essentials."},
            {"name": "VARNYXA Petite & Juniors", "slug": "varnyxa-petite-juniors", "description": "Soft organic fabrics tailored for babies, toddlers, and young minds."},
        ]
        brand_map = {}
        for b_data in brands_data:
            b = db.query(Brand).filter(Brand.slug == b_data["slug"]).first()
            if not b:
                b = Brand(**b_data)
                db.add(b)
                db.flush()
            brand_map[b.slug] = b.id

        # 3. Categories
        categories_data = [
            {"name": "Shirts & Tops", "slug": "shirts-tops", "description": "Crisp poplin, hand-spun linen, and relaxed silhouettes."},
            {"name": "T-Shirts & Polos", "slug": "t-shirts-polos", "description": "Heavyweight Pima cotton and textured knit tees."},
            {"name": "Dresses & Gowns", "slug": "dresses-gowns", "description": "Flowing midi dresses, structured evening gowns, and silk slips."},
            {"name": "Ethnic & Festive", "slug": "ethnic-festive", "description": "Handwoven sarees, sherwanis, bandhgalas, and embroidered kurtas."},
            {"name": "Trousers & Denim", "slug": "trousers-denim", "description": "Tailored pleated trousers, selvedge denim, and relaxed chinos."},
            {"name": "Outerwear & Coats", "slug": "outerwear-coats", "description": "Double-breasted trench coats, wool overcoats, and structured blazers."},
            {"name": "Knitwear & Sweaters", "slug": "knitwear-sweaters", "description": "Pure Mongolian cashmere, merino wool cardigans, and ribbed knits."},
            {"name": "Kids & Baby Wear", "slug": "kids-baby-wear", "description": "Gentle hypoallergenic bodysuits, dungarees, and festive sets."},
            {"name": "Activewear & Loungewear", "slug": "activewear-loungewear", "description": "Breathable performance sets, fleece joggers, and modal loungewear."},
        ]
        cat_map = {}
        for c_data in categories_data:
            cat = db.query(Category).filter(Category.slug == c_data["slug"]).first()
            if not cat:
                cat = Category(**c_data)
                db.add(cat)
                db.flush()
            cat_map[cat.slug] = cat.id

        # 4. Authentic Products: 24 Curated Garments with 3-4 Unique Photos Each
        products_seed = [
            # 1. Men's Camel Wool Overcoat
            {
                "title": "Italian Double-Breasted Camel Wool Overcoat",
                "slug": "italian-double-breasted-camel-wool-overcoat",
                "description": "Crafted from fine double-faced camel wool with a hand-stitched pick-lapel and horn buttons. Tailored with structured shoulders and an elegant relaxed drape that falls mid-calf. Fully lined in cupro silk.",
                "material_care": "100% Virgin Wool. Dry clean only. Store in a breathable garment bag.",
                "sku_prefix": "VNX-CT-01",
                "base_price": 14999.0,
                "sale_price": 12499.0,
                "discount_percent": 16,
                "gender": Gender.MEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "outerwear-coats",
                "brand_slug": "varnyxa-atelier",
                "fabric": "Virgin Camel Wool",
                "fit": "Tailored Classic",
                "sleeve_length": "Full Sleeve",
                "occasion": "Formal",
                "season": "Autumn/Winter",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=1000&q=80", "alt": "Men's Camel Wool Overcoat Front Profile", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=1000&q=80", "alt": "Overcoat Styling View with Knit Turtleneck", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1550614000-4895a10e1bfd?auto=format&fit=crop&w=1000&q=80", "alt": "Lapel & Horn Button Tailoring Close-Up", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=1000&q=80", "alt": "Overcoat Collar & Back Structure View", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "38R", "color_name": "Camel", "color_hex": "#C19A6B", "sku": "VNX-CT01-CAM-38", "stock": 8},
                    {"size": "40R", "color_name": "Camel", "color_hex": "#C19A6B", "sku": "VNX-CT01-CAM-40", "stock": 12},
                    {"size": "42R", "color_name": "Camel", "color_hex": "#C19A6B", "sku": "VNX-CT01-CAM-42", "stock": 5},
                    {"size": "40R", "color_name": "Midnight Charcoal", "color_hex": "#2C2C2C", "sku": "VNX-CT01-CHR-40", "stock": 6},
                ]
            },

            # 2. Women's Chanderi Silk Saree
            {
                "title": "Chanderi Mulberry Silk Handwoven Saree with Zari Border",
                "slug": "chanderi-mulberry-silk-handwoven-saree",
                "description": "An exquisite blend of pure mulberry silk and mercerized cotton, woven by master artisans with delicate real gold zari floral motifs. Comes with an unstitched contrast silk blouse fabric.",
                "material_care": "Pure Mulberry Silk & Cotton Zari. Dry clean only. Iron on reverse low heat.",
                "sku_prefix": "VNX-SR-02",
                "base_price": 18500.0,
                "sale_price": 15999.0,
                "discount_percent": 13,
                "gender": Gender.WOMEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "ethnic-festive",
                "brand_slug": "varnyxa-heritage",
                "fabric": "Mulberry Silk & Zari",
                "fit": "Traditional Drape",
                "sleeve_length": "Custom Blouse",
                "occasion": "Festive",
                "season": "All Season",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1000&q=80", "alt": "Handwoven Mulberry Silk Saree Front Editorial", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1000&q=80", "alt": "Silk Saree Pallu and Zari Detail", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1610030469668-93510cb67655?auto=format&fit=crop&w=1000&q=80", "alt": "Pleat Texture and Golden Sheen", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1000&q=80", "alt": "Bespoke Festive Saree Bridal Styling", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "Free Size", "color_name": "Emerald & Gold", "color_hex": "#097969", "sku": "VNX-SR02-EMR-FS", "stock": 10},
                    {"size": "Free Size", "color_name": "Royal Crimson", "color_hex": "#9B111E", "sku": "VNX-SR02-CRM-FS", "stock": 7},
                ]
            },

            # 3. Unisex Pure French Linen Shirt
            {
                "title": "Pure French Flax Relaxed Linen Shirt",
                "slug": "pure-french-flax-relaxed-linen-shirt",
                "description": "Woven from sustainable French flax with a soft enzyme wash for unmatched breathability. Features mother-of-pearl buttons, a curved hemline, and a relaxed camp collar ideal for warm evenings.",
                "material_care": "100% French Linen. Machine wash cold on gentle cycle. Hang dry in shade.",
                "sku_prefix": "VNX-SH-03",
                "base_price": 3899.0,
                "sale_price": 2999.0,
                "discount_percent": 23,
                "gender": Gender.UNISEX,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "shirts-tops",
                "brand_slug": "varnyxa-urban",
                "fabric": "100% French Linen",
                "fit": "Relaxed Fit",
                "sleeve_length": "Full Sleeve",
                "occasion": "Casual",
                "season": "Spring/Summer",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1000&q=80", "alt": "Pure Linen Shirt in Natural Warm Ivory", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1000&q=80", "alt": "Linen Shirt Fabric Texture and Collar", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=1000&q=80", "alt": "Side Profile and Rolled Cuff View", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&w=1000&q=80", "alt": "Natural Flax Fibre Texture Macro", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "S", "color_name": "Warm Ivory", "color_hex": "#FDFBF7", "sku": "VNX-SH03-IVR-S", "stock": 15},
                    {"size": "M", "color_name": "Warm Ivory", "color_hex": "#FDFBF7", "sku": "VNX-SH03-IVR-M", "stock": 25},
                    {"size": "L", "color_name": "Warm Ivory", "color_hex": "#FDFBF7", "sku": "VNX-SH03-IVR-L", "stock": 18},
                    {"size": "XL", "color_name": "Warm Ivory", "color_hex": "#FDFBF7", "sku": "VNX-SH03-IVR-XL", "stock": 10},
                    {"size": "M", "color_name": "Sage Olive", "color_hex": "#708238", "sku": "VNX-SH03-SGE-M", "stock": 14},
                    {"size": "L", "color_name": "Sage Olive", "color_hex": "#708238", "sku": "VNX-SH03-SGE-L", "stock": 12},
                ]
            },

            # 4. Women's Ribbed Knit Midi Dress
            {
                "title": "Minimalist Asymmetrical Ribbed Knit Midi Dress",
                "slug": "minimalist-asymmetrical-ribbed-knit-midi-dress",
                "description": "Spun from a fine blend of modal and fine merino wool with vertical ribbing that contours naturally. Designed with a subtle side slit and an asymmetrical high neckline for contemporary evening wear.",
                "material_care": "65% Modal, 35% Merino Wool. Hand wash cold or dry clean flat.",
                "sku_prefix": "VNX-DR-04",
                "base_price": 5499.0,
                "sale_price": 4499.0,
                "discount_percent": 18,
                "gender": Gender.WOMEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "dresses-gowns",
                "brand_slug": "varnyxa-atelier",
                "fabric": "Merino & Modal Ribbed Knit",
                "fit": "Slim Form-Fitting",
                "sleeve_length": "Sleeveless",
                "occasion": "Evening",
                "season": "Autumn/Winter",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1000&q=80", "alt": "Ribbed Knit Midi Dress Editorial Pose", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1000&q=80", "alt": "Midi Dress Back and Neckline Details", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1000&q=80", "alt": "Side Slit and Contour Movement", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=1000&q=80", "alt": "Fine Gauge Ribbed Knit Textile Close-Up", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "XS", "color_name": "Noir Black", "color_hex": "#111111", "sku": "VNX-DR04-BLK-XS", "stock": 9},
                    {"size": "S", "color_name": "Noir Black", "color_hex": "#111111", "sku": "VNX-DR04-BLK-S", "stock": 16},
                    {"size": "M", "color_name": "Noir Black", "color_hex": "#111111", "sku": "VNX-DR04-BLK-M", "stock": 14},
                    {"size": "L", "color_name": "Noir Black", "color_hex": "#111111", "sku": "VNX-DR04-BLK-L", "stock": 7},
                ]
            },

            # 5. Unisex Pleated Wide-Leg Japanese Tencel Trousers
            {
                "title": "Pleated Wide-Leg Japanese Tencel Trousers",
                "slug": "pleated-wide-leg-japanese-tencel-trousers",
                "description": "Constructed from high-twist Japanese Tencel with crisp front double-pleats, blind-stitched cuffs, and internal horn buttons. High-rise waist with side slant pockets and back welt details.",
                "material_care": "100% Japanese Tencel Lyocell. Dry clean or gentle cold wash.",
                "sku_prefix": "VNX-TR-05",
                "base_price": 4999.0,
                "sale_price": 3999.0,
                "discount_percent": 20,
                "gender": Gender.UNISEX,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "trousers-denim",
                "brand_slug": "varnyxa-urban",
                "fabric": "High-Twist Tencel",
                "fit": "Wide Leg Relaxed",
                "sleeve_length": "N/A",
                "occasion": "Workwear",
                "season": "All Season",
                "is_featured": False,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?auto=format&fit=crop&w=1000&q=80", "alt": "Wide-Leg Pleated Trousers Full View", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1000&q=80", "alt": "Trousers Fabric Draping and Pleats", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=1000&q=80", "alt": "Waistband Horn Button & Tailoring Detail", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1000&q=80", "alt": "Editorial Styling in Motion", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "30W", "color_name": "Stone Grey", "color_hex": "#7A7B78", "sku": "VNX-TR05-GRY-30", "stock": 10},
                    {"size": "32W", "color_name": "Stone Grey", "color_hex": "#7A7B78", "sku": "VNX-TR05-GRY-32", "stock": 18},
                    {"size": "34W", "color_name": "Stone Grey", "color_hex": "#7A7B78", "sku": "VNX-TR05-GRY-34", "stock": 15},
                    {"size": "32W", "color_name": "Deep Olive", "color_hex": "#3B443B", "sku": "VNX-TR05-OLV-32", "stock": 8},
                ]
            },

            # 6. Men's Supima Cotton Tee (280 GSM)
            {
                "title": "Raw Edge Heavyweight Supima Cotton Tee (280 GSM)",
                "slug": "raw-edge-heavyweight-supima-cotton-tee",
                "description": "Cut from dense 280 GSM long-staple Supima cotton that maintains its boxy architecture wash after wash. Features reinforced ribbing, dropped shoulders, and subtle tonal branding.",
                "material_care": "100% Certified Supima Cotton. Machine wash cold, dry flat.",
                "sku_prefix": "VNX-TE-06",
                "base_price": 2499.0,
                "sale_price": 1899.0,
                "discount_percent": 24,
                "gender": Gender.MEN,
                "age_group": AgeGroup.TEENS,
                "category_slug": "t-shirts-polos",
                "brand_slug": "varnyxa-urban",
                "fabric": "Heavyweight Supima Cotton",
                "fit": "Boxy Oversized",
                "sleeve_length": "Half Sleeve",
                "occasion": "Casual",
                "season": "All Season",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80", "alt": "Heavyweight Supima Cotton Tee Front", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=1000&q=80", "alt": "Supima Tee Texture and Ribbed Collar", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=1000&q=80", "alt": "Boxy Shoulder Drop and Sleeve Silhouette", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1000&q=80", "alt": "Long-Staple Cotton Fabric Macro", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "S", "color_name": "Off White", "color_hex": "#FAF9F6", "sku": "VNX-TE06-WHT-S", "stock": 20},
                    {"size": "M", "color_name": "Off White", "color_hex": "#FAF9F6", "sku": "VNX-TE06-WHT-M", "stock": 35},
                    {"size": "L", "color_name": "Off White", "color_hex": "#FAF9F6", "sku": "VNX-TE06-WHT-L", "stock": 30},
                    {"size": "XL", "color_name": "Off White", "color_hex": "#FAF9F6", "sku": "VNX-TE06-WHT-XL", "stock": 15},
                    {"size": "M", "color_name": "Vintage Charcoal", "color_hex": "#36454F", "sku": "VNX-TE06-CHR-M", "stock": 20},
                    {"size": "L", "color_name": "Vintage Charcoal", "color_hex": "#36454F", "sku": "VNX-TE06-CHR-L", "stock": 18},
                ]
            },

            # 7. Baby Organic Bamboo Bodysuit & Beanie Duo Set
            {
                "title": "Organic Bamboo Baby Bodysuit & Beanie Duo Set",
                "slug": "organic-bamboo-baby-bodysuit-beanie-duo",
                "description": "Ultra-gentle hypoallergenic bamboo viscose crafted specifically for tender newborn skin. Features smooth flatlock seams, nickel-free magnetic front snaps, and fold-over mittens to protect against scratches.",
                "material_care": "95% Organic Bamboo Viscose, 5% Elastane. Machine wash cold inside out.",
                "sku_prefix": "VNX-BB-07",
                "base_price": 1899.0,
                "sale_price": 1499.0,
                "discount_percent": 21,
                "gender": Gender.BABY,
                "age_group": AgeGroup.NEWBORN,
                "category_slug": "kids-baby-wear",
                "brand_slug": "varnyxa-petite-juniors",
                "fabric": "Organic Bamboo Viscose",
                "fit": "Snug Comfort",
                "sleeve_length": "Full Sleeve",
                "occasion": "Lounge",
                "season": "All Season",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&w=1000&q=80", "alt": "Organic Bamboo Baby Bodysuit Set", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1000&q=80", "alt": "Baby Bodysuit Fabric and Snap Detail", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1000&q=80", "alt": "Gentle Newborn Lifestyle Setting", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1544126592-807ade215a0b?auto=format&fit=crop&w=1000&q=80", "alt": "Fold-over Scratch Protection Mittens", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "0-3M", "color_name": "Oatmeal Heather", "color_hex": "#E3D9C6", "sku": "VNX-BB07-OAT-03", "stock": 15},
                    {"size": "3-6M", "color_name": "Oatmeal Heather", "color_hex": "#E3D9C6", "sku": "VNX-BB07-OAT-36", "stock": 20},
                    {"size": "6-12M", "color_name": "Oatmeal Heather", "color_hex": "#E3D9C6", "sku": "VNX-BB07-OAT-612", "stock": 12},
                    {"size": "0-3M", "color_name": "Powder Sage", "color_hex": "#C1D7AE", "sku": "VNX-BB07-SGE-03", "stock": 10},
                ]
            },

            # 8. Girls Cotton Jacquard Festive Kurta Set
            {
                "title": "Girls Embroidered Cotton Jacquard Festive Kurta Set",
                "slug": "girls-embroidered-cotton-jacquard-festive-kurta",
                "description": "Woven with subtle zari threads on pure breathable cotton jacquard. Embellished with delicate gota patti borders along the sleeves and hemline, paired with matching cotton churidar pants and a lightweight chiffon dupatta.",
                "material_care": "100% Breathable Cotton Jacquard. Hand wash gently.",
                "sku_prefix": "VNX-KD-08",
                "base_price": 3299.0,
                "sale_price": 2599.0,
                "discount_percent": 21,
                "gender": Gender.GIRLS,
                "age_group": AgeGroup.KIDS,
                "category_slug": "kids-baby-wear",
                "brand_slug": "varnyxa-petite-juniors",
                "fabric": "Cotton Jacquard with Gota Patti",
                "fit": "Regular Traditional",
                "sleeve_length": "3/4th Sleeve",
                "occasion": "Festive",
                "season": "All Season",
                "is_featured": False,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1000&q=80", "alt": "Girls Festive Kurta Set Front View", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=1000&q=80", "alt": "Gota Patti Detail on Kurta Sleeves", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1000&q=80", "alt": "Chiffon Dupatta Border & Tassel Finishes", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1000&q=80", "alt": "Festive Kurta Silhouette in Motion", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "4-5Y", "color_name": "Marigold Mustard", "color_hex": "#E1AD01", "sku": "VNX-KD08-MUS-45", "stock": 12},
                    {"size": "6-7Y", "color_name": "Marigold Mustard", "color_hex": "#E1AD01", "sku": "VNX-KD08-MUS-67", "stock": 15},
                    {"size": "8-9Y", "color_name": "Marigold Mustard", "color_hex": "#E1AD01", "sku": "VNX-KD08-MUS-89", "stock": 10},
                    {"size": "6-7Y", "color_name": "Pastel Peach", "color_hex": "#FFDAB9", "sku": "VNX-KD08-PCH-67", "stock": 9},
                ]
            },

            # 9. Men's Raw Silk Bandhgala Tuxedo
            {
                "title": "Raw Silk Bandhgala Tuxedo with Handcrafted Antigravity Motifs",
                "slug": "raw-silk-bandhgala-tuxedo",
                "description": "Tailored from Bhagalpur raw tussar silk with a crisp mandarin collar, custom-cast metal crest buttons, and double back vents. Designed for high-profile galas, formal receptions, and wedding celebrations.",
                "material_care": "100% Pure Tussar Raw Silk. Specialist dry clean only.",
                "sku_prefix": "VNX-BG-09",
                "base_price": 22999.0,
                "sale_price": 19499.0,
                "discount_percent": 15,
                "gender": Gender.MEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "ethnic-festive",
                "brand_slug": "varnyxa-heritage",
                "fabric": "Bhagalpur Raw Silk",
                "fit": "Slim Tailored",
                "sleeve_length": "Full Sleeve",
                "occasion": "Formal",
                "season": "Autumn/Winter",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1000&q=80", "alt": "Men's Formal Bandhgala Suit Editorial", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1000&q=80", "alt": "Silk Texture and Collar Detailing", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&w=1000&q=80", "alt": "Pocket Welt and Hand-Stitched Edges", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?auto=format&fit=crop&w=1000&q=80", "alt": "Tailored Back Vent and Profile", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "38R", "color_name": "Imperial Navy", "color_hex": "#000080", "sku": "VNX-BG09-NVY-38", "stock": 6},
                    {"size": "40R", "color_name": "Imperial Navy", "color_hex": "#000080", "sku": "VNX-BG09-NVY-40", "stock": 10},
                    {"size": "42R", "color_name": "Imperial Navy", "color_hex": "#000080", "sku": "VNX-BG09-NVY-42", "stock": 8},
                ]
            },

            # 10. Women's Seamless Activewear Set
            {
                "title": "Seamless Ribbed Compression Activewear Set",
                "slug": "seamless-ribbed-compression-activewear-set",
                "description": "Constructed from 4-way stretch sweat-wicking microfiber featuring micro-mesh ventilation zones and a reinforced high-support waistband. Includes both the racerback sports top and ankle-length sculpting leggings.",
                "material_care": "78% Recycled Polyamide, 22% Spandex. Machine wash cold gentle.",
                "sku_prefix": "VNX-AC-10",
                "base_price": 4299.0,
                "sale_price": 3299.0,
                "discount_percent": 23,
                "gender": Gender.WOMEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "activewear-loungewear",
                "brand_slug": "varnyxa-urban",
                "fabric": "Recycled Polyamide & Spandex",
                "fit": "Compression Athletic",
                "sleeve_length": "Sleeveless",
                "occasion": "Sportswear",
                "season": "All Season",
                "is_featured": False,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1000&q=80", "alt": "Seamless Activewear Set in Action", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1000&q=80", "alt": "High-Waisted Leggings and Stretch Details", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=1000&q=80", "alt": "Racerback Ergonomic Top Architecture", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=1000&q=80", "alt": "Ribbed Compressive Ankle Texture", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "XS", "color_name": "Forest Green", "color_hex": "#228B22", "sku": "VNX-AC10-GRN-XS", "stock": 8},
                    {"size": "S", "color_name": "Forest Green", "color_hex": "#228B22", "sku": "VNX-AC10-GRN-S", "stock": 16},
                    {"size": "M", "color_name": "Forest Green", "color_hex": "#228B22", "sku": "VNX-AC10-GRN-M", "stock": 14},
                    {"size": "L", "color_name": "Forest Green", "color_hex": "#228B22", "sku": "VNX-AC10-GRN-L", "stock": 7},
                ]
            },

            # 11. Unisex Mongolian Cashmere Turtleneck
            {
                "title": "Chunky Cable-Knit Mongolian Cashmere Turtleneck",
                "slug": "chunky-cable-knit-mongolian-cashmere-turtleneck",
                "description": "Hand-knitted using Grade-A 3-ply long-fiber Mongolian cashmere known for extraordinary softness without pilling. Features intricate honeycomb cable stitches and a ribbed funnel neckline.",
                "material_care": "100% Grade-A Mongolian Cashmere. Hand wash in tepid water with cashmere soap. Dry flat.",
                "sku_prefix": "VNX-KW-11",
                "base_price": 9999.0,
                "sale_price": 7999.0,
                "discount_percent": 20,
                "gender": Gender.UNISEX,
                "age_group": AgeGroup.SENIORS,
                "category_slug": "knitwear-sweaters",
                "brand_slug": "varnyxa-atelier",
                "fabric": "3-Ply Mongolian Cashmere",
                "fit": "Cozy Relaxed",
                "sleeve_length": "Full Sleeve",
                "occasion": "Lounge",
                "season": "Autumn/Winter",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1000&q=80", "alt": "Cable Knit Cashmere Turtleneck Model Portrait", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=1000&q=80", "alt": "Honeycomb Stitch Texture and Funnel Neck", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1000&q=80", "alt": "Ribbed Hem & Cuff Softness", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?auto=format&fit=crop&w=1000&q=80", "alt": "Cashmere Knit Purity Close-Up", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "M", "color_name": "Cream Cashmere", "color_hex": "#FFFDD0", "sku": "VNX-KW11-CRM-M", "stock": 10},
                    {"size": "L", "color_name": "Cream Cashmere", "color_hex": "#FFFDD0", "sku": "VNX-KW11-CRM-L", "stock": 14},
                    {"size": "XL", "color_name": "Cream Cashmere", "color_hex": "#FFFDD0", "sku": "VNX-KW11-CRM-XL", "stock": 8},
                ]
            },

            # 12. Men's Selvedge Denim Jacket
            {
                "title": "Classic Japanese 14oz Selvedge Denim Jacket",
                "slug": "classic-japanese-14oz-selvedge-denim-jacket",
                "description": "Woven on vintage shuttle looms in Okayama using rope-dyed indigo yarn with a red-line selvedge ID. Cut in a classic Type III silhouette with custom copper shank buttons and dual chest flap pockets.",
                "material_care": "100% Cotton 14oz Selvedge Denim. Wash rarely, cold inside out.",
                "sku_prefix": "VNX-JK-12",
                "base_price": 7999.0,
                "sale_price": 6499.0,
                "discount_percent": 18,
                "gender": Gender.MEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "outerwear-coats",
                "brand_slug": "varnyxa-urban",
                "fabric": "14oz Okayama Selvedge Denim",
                "fit": "Classic Boxy",
                "sleeve_length": "Full Sleeve",
                "occasion": "Casual",
                "season": "All Season",
                "is_featured": False,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=1000&q=80", "alt": "Classic Selvedge Denim Jacket Front", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80", "alt": "Denim Collar, Pocket Stitching and Copper Buttons", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1543087903-1ac2ec7aa8c5?auto=format&fit=crop&w=1000&q=80", "alt": "Red-Line Selvedge ID Seam Detail", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1527719327859-c6ce80353573?auto=format&fit=crop&w=1000&q=80", "alt": "Denim Jacket Urban Styling", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "S", "color_name": "Deep Raw Indigo", "color_hex": "#1F2F46", "sku": "VNX-JK12-IND-S", "stock": 7},
                    {"size": "M", "color_name": "Deep Raw Indigo", "color_hex": "#1F2F46", "sku": "VNX-JK12-IND-M", "stock": 15},
                    {"size": "L", "color_name": "Deep Raw Indigo", "color_hex": "#1F2F46", "sku": "VNX-JK12-IND-L", "stock": 12},
                    {"size": "XL", "color_name": "Deep Raw Indigo", "color_hex": "#1F2F46", "sku": "VNX-JK12-IND-XL", "stock": 6},
                ]
            },

            # 13. Boys Nehru Jacket & Chanderi Kurta Pajama Set
            {
                "title": "Boys Handwoven Nehru Jacket & Chanderi Kurta Set",
                "slug": "boys-handwoven-nehru-jacket-chanderi-kurta-set",
                "description": "Specially designed for young gentlemen celebrating weddings and festive festivals. Includes an embroidered brocade Nehru waistcoat paired with a lightweight pure chanderi kurta and comfortable elasticated churidar pants.",
                "material_care": "Chanderi Silk & Pure Cotton Lining. Dry clean recommended.",
                "sku_prefix": "VNX-BY-13",
                "base_price": 4499.0,
                "sale_price": 3699.0,
                "discount_percent": 18,
                "gender": Gender.BOYS,
                "age_group": AgeGroup.KIDS,
                "category_slug": "kids-baby-wear",
                "brand_slug": "varnyxa-petite-juniors",
                "fabric": "Chanderi Silk & Brocade",
                "fit": "Comfort Tailored",
                "sleeve_length": "Full Sleeve",
                "occasion": "Festive",
                "season": "All Season",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1000&q=80", "alt": "Boys Festive Kurta Set Portrait", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1000&q=80", "alt": "Nehru Collar and Metallic Button Row", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1471286174890-9c112ffca564?auto=format&fit=crop&w=1000&q=80", "alt": "Chanderi Weave and Pocket Square", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1000&q=80", "alt": "Festive Outfit Side View", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "4-5Y", "color_name": "Royal Emerald", "color_hex": "#097969", "sku": "VNX-BY13-EMR-45", "stock": 8},
                    {"size": "6-7Y", "color_name": "Royal Emerald", "color_hex": "#097969", "sku": "VNX-BY13-EMR-67", "stock": 14},
                    {"size": "8-9Y", "color_name": "Royal Emerald", "color_hex": "#097969", "sku": "VNX-BY13-EMR-89", "stock": 10},
                    {"size": "6-7Y", "color_name": "Champagne Gold", "color_hex": "#F7E7CE", "sku": "VNX-BY13-GLD-67", "stock": 12},
                ]
            },

            # 14. Women's Chikankari Pure Georgette Anarkali Gown
            {
                "title": "Hand-Embroidered Chikankari Pure Georgette Anarkali Gown",
                "slug": "hand-embroidered-chikankari-pure-georgette-anarkali-gown",
                "description": "Mastercrafted in Lucknow with 32 authentic Chikankari needlework stitches on pure flowing georgette. Adorned with delicate mukaish metallic dots and paired with a scalloped dupatta and modal churidar.",
                "material_care": "Pure Viscose Georgette. Dry clean only. Protect mukaish work.",
                "sku_prefix": "VNX-AK-14",
                "base_price": 16999.0,
                "sale_price": 13999.0,
                "discount_percent": 18,
                "gender": Gender.WOMEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "ethnic-festive",
                "brand_slug": "varnyxa-heritage",
                "fabric": "Pure Georgette with Mukaish",
                "fit": "Flared Anarkali",
                "sleeve_length": "Full Sleeve",
                "occasion": "Festive",
                "season": "All Season",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80", "alt": "Ivory Chikankari Anarkali Front Flare", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=1000&q=80", "alt": "Hand-Embroidered Yoke and Mukaish Needlework", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80", "alt": "Gown Silhouette and Flared Hemline", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=1000&q=80", "alt": "Georgette Dupatta Scalloped Edge", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "XS", "color_name": "Pristine Ivory", "color_hex": "#FFFFF0", "sku": "VNX-AK14-IVR-XS", "stock": 5},
                    {"size": "S", "color_name": "Pristine Ivory", "color_hex": "#FFFFF0", "sku": "VNX-AK14-IVR-S", "stock": 10},
                    {"size": "M", "color_name": "Pristine Ivory", "color_hex": "#FFFFF0", "sku": "VNX-AK14-IVR-M", "stock": 12},
                    {"size": "L", "color_name": "Pristine Ivory", "color_hex": "#FFFFF0", "sku": "VNX-AK14-IVR-L", "stock": 6},
                ]
            },

            # 15. Unisex Heavyweight French Terry Hoodie 450 GSM
            {
                "title": "Oversized Heavyweight French Terry Hoodie (450 GSM)",
                "slug": "oversized-heavyweight-french-terry-hoodie",
                "description": "Constructed from custom-milled 450 GSM 100% combed cotton French terry with double-needle flatlock stitching. Features a double-layer structured hood without drawstrings for a sleek architectural drape.",
                "material_care": "100% Combed Cotton French Terry. Machine wash cold, hang dry.",
                "sku_prefix": "VNX-HD-15",
                "base_price": 4999.0,
                "sale_price": 3899.0,
                "discount_percent": 22,
                "gender": Gender.UNISEX,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "activewear-loungewear",
                "brand_slug": "varnyxa-urban",
                "fabric": "450 GSM French Terry",
                "fit": "Oversized Boxy",
                "sleeve_length": "Full Sleeve",
                "occasion": "Lounge",
                "season": "Autumn/Winter",
                "is_featured": False,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1000&q=80", "alt": "Heather Grey Heavyweight Hoodie Front", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=1000&q=80", "alt": "Structured Double-Layered Hood Profile", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?auto=format&fit=crop&w=1000&q=80", "alt": "Kangaroo Pocket and Heavyweight Ribbed Cuffs", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=1000&q=80", "alt": "Loopback Interior Cotton Weave Macro", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "S", "color_name": "Heather Grey", "color_hex": "#D3D3D3", "sku": "VNX-HD15-GRY-S", "stock": 15},
                    {"size": "M", "color_name": "Heather Grey", "color_hex": "#D3D3D3", "sku": "VNX-HD15-GRY-M", "stock": 25},
                    {"size": "L", "color_name": "Heather Grey", "color_hex": "#D3D3D3", "sku": "VNX-HD15-GRY-L", "stock": 20},
                    {"size": "XL", "color_name": "Heather Grey", "color_hex": "#D3D3D3", "sku": "VNX-HD15-GRY-XL", "stock": 10},
                    {"size": "M", "color_name": "Pitch Black", "color_hex": "#0a0a0a", "sku": "VNX-HD15-BLK-M", "stock": 18},
                ]
            },

            # 16. Women's Mulberry Silk Bias-Cut Slip Dress
            {
                "title": "Pure Mulberry Silk Bias-Cut Cami Slip Dress",
                "slug": "pure-mulberry-silk-bias-cut-cami-slip-dress",
                "description": "Tailored on the true 45-degree bias from heavyweight 22-momme grade 6A mulberry silk. Skims the waist and hips with liquid fluidity, finished with delicate adjustable french-seam straps.",
                "material_care": "100% Grade 6A Mulberry Silk (22 Momme). Hand wash cold with silk detergent.",
                "sku_prefix": "VNX-SL-16",
                "base_price": 8999.0,
                "sale_price": 7499.0,
                "discount_percent": 17,
                "gender": Gender.WOMEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "dresses-gowns",
                "brand_slug": "varnyxa-atelier",
                "fabric": "22-Momme Mulberry Silk",
                "fit": "Bias Fluid Drape",
                "sleeve_length": "Sleeveless",
                "occasion": "Evening",
                "season": "All Season",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=80", "alt": "Champagne Silk Slip Dress Editorial", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?auto=format&fit=crop&w=1000&q=80", "alt": "Cowl Neckline and Fine Strap Finish", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1508427953056-b00b8d78ebf5?auto=format&fit=crop&w=1000&q=80", "alt": "Liquid Silk Luster and Hem Draping", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=80", "alt": "Slip Dress Evening Movement", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "XS", "color_name": "Champagne Sand", "color_hex": "#E3D4C1", "sku": "VNX-SL16-CHP-XS", "stock": 6},
                    {"size": "S", "color_name": "Champagne Sand", "color_hex": "#E3D4C1", "sku": "VNX-SL16-CHP-S", "stock": 14},
                    {"size": "M", "color_name": "Champagne Sand", "color_hex": "#E3D4C1", "sku": "VNX-SL16-CHP-M", "stock": 12},
                    {"size": "L", "color_name": "Champagne Sand", "color_hex": "#E3D4C1", "sku": "VNX-SL16-CHP-L", "stock": 8},
                ]
            },

            # 17. Men's Italian Poplin Spread Collar Dress Shirt
            {
                "title": "Classic Italian Poplin Spread Collar Dress Shirt",
                "slug": "classic-italian-poplin-spread-collar-dress-shirt",
                "description": "Crafted from silky 120s two-ply Egyptian Giza cotton poplin woven in Albini, Italy. Features removable brass collar stays, single-needle 22-stitches-per-inch seam tailoring, and genuine Australian mother-of-pearl buttons.",
                "material_care": "100% Egyptian Giza Cotton. Machine wash warm, warm iron with steam.",
                "sku_prefix": "VNX-PS-17",
                "base_price": 4499.0,
                "sale_price": 3499.0,
                "discount_percent": 22,
                "gender": Gender.MEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "shirts-tops",
                "brand_slug": "varnyxa-atelier",
                "fabric": "120s Two-Ply Giza Cotton",
                "fit": "Tailored Slim",
                "sleeve_length": "Full Sleeve",
                "occasion": "Workwear",
                "season": "All Season",
                "is_featured": False,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1620012253295-c15c429fccf8?auto=format&fit=crop&w=1000&q=80", "alt": "Crisp White Italian Poplin Dress Shirt", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?auto=format&fit=crop&w=1000&q=80", "alt": "Spread Collar and Tie Setting", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1000&q=80", "alt": "Hand-Sewn Mother of Pearl Buttons and Placket", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1594938328870-9623159c8c99?auto=format&fit=crop&w=1000&q=80", "alt": "Poplin Fabric Weave and French Cuff Detail", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "38", "color_name": "Crisp White", "color_hex": "#FFFFFF", "sku": "VNX-PS17-WHT-38", "stock": 12},
                    {"size": "40", "color_name": "Crisp White", "color_hex": "#FFFFFF", "sku": "VNX-PS17-WHT-40", "stock": 20},
                    {"size": "42", "color_name": "Crisp White", "color_hex": "#FFFFFF", "sku": "VNX-PS17-WHT-42", "stock": 15},
                    {"size": "44", "color_name": "Crisp White", "color_hex": "#FFFFFF", "sku": "VNX-PS17-WHT-44", "stock": 8},
                ]
            },

            # 18. Women's Structured Double-Breasted Wool Blazer
            {
                "title": "Structured Double-Breasted Wool Blend Tailored Blazer",
                "slug": "structured-double-breasted-wool-blend-tailored-blazer",
                "description": "Constructed with padded shoulders, peak lapels, and high-quality tortoiseshell buttons. Cut in a modern relaxed masculine tailoring silhouette for effortless day-to-night transitions.",
                "material_care": "80% Wool, 20% Silk. Dry clean only. Hang on wooden suit hangers.",
                "sku_prefix": "VNX-BL-18",
                "base_price": 11999.0,
                "sale_price": 9999.0,
                "discount_percent": 17,
                "gender": Gender.WOMEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "outerwear-coats",
                "brand_slug": "varnyxa-atelier",
                "fabric": "Virgin Wool & Silk Suiting",
                "fit": "Tailored Relaxed",
                "sleeve_length": "Full Sleeve",
                "occasion": "Workwear",
                "season": "Autumn/Winter",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=1000&q=80", "alt": "Oatmeal Wool Double Breasted Blazer", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80", "alt": "Peak Lapels and Tortoiseshell Button Detailing", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1000&q=80", "alt": "Structured Shoulder and Waist Architecture", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1000&q=80", "alt": "Suiting Wool Texture Macro", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "XS", "color_name": "Oatmeal Melange", "color_hex": "#D1C7BD", "sku": "VNX-BL18-OAT-XS", "stock": 7},
                    {"size": "S", "color_name": "Oatmeal Melange", "color_hex": "#D1C7BD", "sku": "VNX-BL18-OAT-S", "stock": 14},
                    {"size": "M", "color_name": "Oatmeal Melange", "color_hex": "#D1C7BD", "sku": "VNX-BL18-OAT-M", "stock": 12},
                    {"size": "L", "color_name": "Oatmeal Melange", "color_hex": "#D1C7BD", "sku": "VNX-BL18-OAT-L", "stock": 6},
                ]
            },

            # 19. Baby Hand-Knit Merino Wool Romper & Booties
            {
                "title": "Hand-Knit Merino Wool Baby Romper & Booties Set",
                "slug": "hand-knit-merino-wool-baby-romper-booties",
                "description": "Gently spun from non-scratch extrafine Australian merino wool with coconut wood front buttons. Thermoregulating, breathable, and warm for infant sleep and outings.",
                "material_care": "100% Extrafine Merino Wool. Hand wash cold with wool wash, dry flat.",
                "sku_prefix": "VNX-BR-19",
                "base_price": 2899.0,
                "sale_price": 2299.0,
                "discount_percent": 21,
                "gender": Gender.BABY,
                "age_group": AgeGroup.INFANT,
                "category_slug": "kids-baby-wear",
                "brand_slug": "varnyxa-petite-juniors",
                "fabric": "Extrafine Merino Wool",
                "fit": "Cozy Comfort",
                "sleeve_length": "Long Sleeve",
                "occasion": "Casual",
                "season": "Autumn/Winter",
                "is_featured": False,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1000&q=80", "alt": "Merino Baby Knit Romper Front", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1000&q=80", "alt": "Cable Knit Detailing & Wooden Buttons", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&w=1000&q=80", "alt": "Handmade Matching Booties Detail", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1000&q=80", "alt": "Infant Comfort Setting", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "3-6M", "color_name": "Cloud White", "color_hex": "#F8F9FA", "sku": "VNX-BR19-WHT-36", "stock": 10},
                    {"size": "6-12M", "color_name": "Cloud White", "color_hex": "#F8F9FA", "sku": "VNX-BR19-WHT-612", "stock": 14},
                    {"size": "12-18M", "color_name": "Cloud White", "color_hex": "#F8F9FA", "sku": "VNX-BR19-WHT-1218", "stock": 8},
                ]
            },

            # 20. Boys Organic Heavyweight Breton Striped Tee
            {
                "title": "Boys 100% Organic Heavyweight Breton Striped Tee",
                "slug": "boys-organic-heavyweight-breton-striped-tee",
                "description": "Constructed from 240 GSM organic ring-spun cotton with classic nautical horizontal stripes. Durable reinforced boat neck and flatlock shoulder seams built for active boys.",
                "material_care": "100% Certified Organic Ring-Spun Cotton. Machine wash cold.",
                "sku_prefix": "VNX-BT-20",
                "base_price": 1799.0,
                "sale_price": 1399.0,
                "discount_percent": 22,
                "gender": Gender.BOYS,
                "age_group": AgeGroup.KIDS,
                "category_slug": "t-shirts-polos",
                "brand_slug": "varnyxa-petite-juniors",
                "fabric": "Ring-Spun Organic Cotton",
                "fit": "Regular Fit",
                "sleeve_length": "Half Sleeve",
                "occasion": "Casual",
                "season": "Spring/Summer",
                "is_featured": False,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1471286174890-9c112ffca564?auto=format&fit=crop&w=1000&q=80", "alt": "Boys Breton Stripe Tee Front View", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1000&q=80", "alt": "Ribbed Neckline and Stripe Alignment Detail", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=1000&q=80", "alt": "Active Boys Outdoor Styling", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1000&q=80", "alt": "Heavyweight Cotton Knit Textile Close-Up", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "4-5Y", "color_name": "Navy & Ivory", "color_hex": "#000080", "sku": "VNX-BT20-NVY-45", "stock": 14},
                    {"size": "6-7Y", "color_name": "Navy & Ivory", "color_hex": "#000080", "sku": "VNX-BT20-NVY-67", "stock": 18},
                    {"size": "8-9Y", "color_name": "Navy & Ivory", "color_hex": "#000080", "sku": "VNX-BT20-NVY-89", "stock": 12},
                    {"size": "10-11Y", "color_name": "Navy & Ivory", "color_hex": "#000080", "sku": "VNX-BT20-NVY-1011", "stock": 9},
                ]
            },

            # 21. Women's Belgian Linen High-Waisted Trousers
            {
                "title": "High-Waisted Wide-Leg Belgian Linen Trousers",
                "slug": "high-waisted-wide-leg-belgian-linen-trousers",
                "description": "Tailored from heavy European flax linen with a dramatic wide-leg hem and flattering high rise. Features deep side slash pockets, belt loops, and clean back darts for effortless elegance.",
                "material_care": "100% Belgian Flax Linen. Gentle machine wash cold, steam iron.",
                "sku_prefix": "VNX-LT-21",
                "base_price": 5499.0,
                "sale_price": 4299.0,
                "discount_percent": 22,
                "gender": Gender.WOMEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "trousers-denim",
                "brand_slug": "varnyxa-urban",
                "fabric": "100% Belgian Linen",
                "fit": "Wide Leg High Rise",
                "sleeve_length": "N/A",
                "occasion": "Workwear",
                "season": "Spring/Summer",
                "is_featured": False,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80", "alt": "Belgian Linen Wide Leg Trousers Full Length", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1000&q=80", "alt": "High Waistband & Fastener Tailoring", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1000&q=80", "alt": "Natural Linen Weave Texture Detail", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=80", "alt": "Hemline Drapery and Movement", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "26W", "color_name": "Terracotta", "color_hex": "#E2725B", "sku": "VNX-LT21-TER-26", "stock": 7},
                    {"size": "28W", "color_name": "Terracotta", "color_hex": "#E2725B", "sku": "VNX-LT21-TER-28", "stock": 15},
                    {"size": "30W", "color_name": "Terracotta", "color_hex": "#E2725B", "sku": "VNX-LT21-TER-30", "stock": 18},
                    {"size": "32W", "color_name": "Terracotta", "color_hex": "#E2725B", "sku": "VNX-LT21-TER-32", "stock": 9},
                ]
            },

            # 22. Teens Utility Cargo Trousers
            {
                "title": "Teenage Relaxed Utility Ripstop Cargo Trousers",
                "slug": "teenage-relaxed-utility-ripstop-cargo-trousers",
                "description": "Constructed from military-spec cotton ripstop with reinforced knee articulation and deep bellows cargo pockets. Features adjustable bungee hem drawstrings to switch between wide-leg and tapered styles.",
                "material_care": "100% Cotton Ripstop. Machine wash cold with similar colors.",
                "sku_prefix": "VNX-CG-22",
                "base_price": 3799.0,
                "sale_price": 2999.0,
                "discount_percent": 21,
                "gender": Gender.MEN,
                "age_group": AgeGroup.TEENS,
                "category_slug": "trousers-denim",
                "brand_slug": "varnyxa-urban",
                "fabric": "Military Cotton Ripstop",
                "fit": "Relaxed Utility",
                "sleeve_length": "N/A",
                "occasion": "Casual",
                "season": "All Season",
                "is_featured": False,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?auto=format&fit=crop&w=1000&q=80", "alt": "Utility Ripstop Cargo Pants Front Profile", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1000&q=80", "alt": "Bellows Pocket Architecture & Heavy Metal Zips", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1000&q=80", "alt": "Knee Articulation Stitching Close-Up", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1000&q=80", "alt": "Teen Streetwear Silhouette Styling", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "28W", "color_name": "Combat Olive", "color_hex": "#556B2F", "sku": "VNX-CG22-OLV-28", "stock": 10},
                    {"size": "30W", "color_name": "Combat Olive", "color_hex": "#556B2F", "sku": "VNX-CG22-OLV-30", "stock": 16},
                    {"size": "32W", "color_name": "Combat Olive", "color_hex": "#556B2F", "sku": "VNX-CG22-OLV-32", "stock": 12},
                ]
            },

            # 23. Girls Tiered Floral Hand-Block Linen Dress
            {
                "title": "Girls Tiered Floral Hand-Block Printed Linen Dress",
                "slug": "girls-tiered-floral-hand-block-printed-linen-dress",
                "description": "Crafted from pure soft-washed linen hand-block printed using natural botanical dyes in Jaipur. Designed with tiered gathers, ruffled cap sleeves, and a delicate tie-back ribbon for birthday and holiday celebrations.",
                "material_care": "100% Breathable Washed Linen. Gentle hand wash in cold water.",
                "sku_prefix": "VNX-GD-23",
                "base_price": 2999.0,
                "sale_price": 2399.0,
                "discount_percent": 20,
                "gender": Gender.GIRLS,
                "age_group": AgeGroup.KIDS,
                "category_slug": "dresses-gowns",
                "brand_slug": "varnyxa-petite-juniors",
                "fabric": "100% Washed Linen",
                "fit": "Relaxed Tiered",
                "sleeve_length": "Cap Sleeve",
                "occasion": "Casual",
                "season": "Spring/Summer",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1000&q=80", "alt": "Girls Floral Linen Tiered Dress Front", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1000&q=80", "alt": "Ruffled Cap Sleeves & Button Back Detail", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1000&q=80", "alt": "Hand-Block Floral Pattern Macro", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1000&q=80", "alt": "Gathered Skirt Volume in Sunlight", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "4-5Y", "color_name": "Blush Rose", "color_hex": "#FFB6C1", "sku": "VNX-GD23-ROSE-45", "stock": 9},
                    {"size": "6-7Y", "color_name": "Blush Rose", "color_hex": "#FFB6C1", "sku": "VNX-GD23-ROSE-67", "stock": 15},
                    {"size": "8-9Y", "color_name": "Blush Rose", "color_hex": "#FFB6C1", "sku": "VNX-GD23-ROSE-89", "stock": 11},
                ]
            },

            # 24. Seniors Brushed Baby Alpaca Cardigan
            {
                "title": "Seniors Ultra-Soft Brushed Baby Alpaca Cardigan",
                "slug": "seniors-ultra-soft-brushed-baby-alpaca-cardigan",
                "description": "Spun from rare Peruvian baby alpaca fleece brushed for a cloud-like texture that provides deep, featherlight warmth without weight. Features deep hand-warmer pockets and ergonomic carved horn buttons for easy dressing.",
                "material_care": "100% Peruvian Baby Alpaca Fleece. Dry clean or hand wash cold.",
                "sku_prefix": "VNX-AC-24",
                "base_price": 8999.0,
                "sale_price": 6999.0,
                "discount_percent": 22,
                "gender": Gender.UNISEX,
                "age_group": AgeGroup.SENIORS,
                "category_slug": "knitwear-sweaters",
                "brand_slug": "varnyxa-atelier",
                "fabric": "Peruvian Baby Alpaca",
                "fit": "Comfort Relaxed",
                "sleeve_length": "Full Sleeve",
                "occasion": "Lounge",
                "season": "Autumn/Winter",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1000&q=80", "alt": "Cozy Brushed Baby Alpaca Cardigan", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1000&q=80", "alt": "Hand-Carved Horn Buttons & Placket", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?auto=format&fit=crop&w=1000&q=80", "alt": "Brushed Alpaca Fiber Cloud Softness", "is_primary": False, "order": 3},
                    {"url": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1000&q=80", "alt": "Relaxed Seniors Thermal Silhouette", "is_primary": False, "order": 4},
                ],
                "variants": [
                    {"size": "M", "color_name": "Soft Heather Camel", "color_hex": "#C2B280", "sku": "VNX-AC24-CAM-M", "stock": 10},
                    {"size": "L", "color_name": "Soft Heather Camel", "color_hex": "#C2B280", "sku": "VNX-AC24-CAM-L", "stock": 15},
                    {"size": "XL", "color_name": "Soft Heather Camel", "color_hex": "#C2B280", "sku": "VNX-AC24-CAM-XL", "stock": 12},
                    {"size": "XXL", "color_name": "Soft Heather Camel", "color_hex": "#C2B280", "sku": "VNX-AC24-CAM-XXL", "stock": 6},
                ]
            },
            # 25. Under 500: Rs 299 Organic Cotton Pocket Square
            {
                "title": "Hand-Spun Organic Cotton Pocket Square",
                "slug": "hand-spun-organic-cotton-pocket-square",
                "description": "Artisan hand-rolled hems and hand-spun organic cotton with understated pick-stitch borders. An essential sartorial accent for suits and blazers.",
                "material_care": "100% Organic Pima Cotton. Hand wash cold or gentle iron.",
                "sku_prefix": "VNX-PS-01",
                "base_price": 499.0,
                "sale_price": 299.0,
                "discount_percent": 40,
                "gender": Gender.UNISEX,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "shirts-tops",
                "brand_slug": "varnyxa-urban",
                "fabric": "100% Organic Cotton",
                "fit": "Square (13x13 in)",
                "sleeve_length": "None",
                "occasion": "Formal & Black Tie",
                "season": "All Season",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1000&q=80", "alt": "Pocket Square Folded View", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1000&q=80", "alt": "Pocket Square in Blazer Pocket", "is_primary": False, "order": 2},
                ],
                "variants": [
                    {"size": "One Size", "color_name": "Crisp White", "color_hex": "#FAF9F6", "sku": "VNX-PS-WHT", "stock": 50},
                    {"size": "One Size", "color_name": "Ivory Bronze", "color_hex": "#C5A880", "sku": "VNX-PS-BRZ", "stock": 35},
                ]
            },
            # 26. Under 500: Rs 449 Mulberry Silk Twilly Scarf
            {
                "title": "Artisanal Mulberry Silk Twilly Neck Scarf",
                "slug": "artisanal-mulberry-silk-twilly-neck-scarf",
                "description": "Double-layered pure mulberry silk band with hand-drawn geometric botanical prints. Versatile styling around collar, hair, wrist, or handbag strap.",
                "material_care": "100% Mulberry Silk. Dry clean or cold hand wash with silk shampoo.",
                "sku_prefix": "VNX-TW-01",
                "base_price": 699.0,
                "sale_price": 449.0,
                "discount_percent": 36,
                "gender": Gender.WOMEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "shirts-tops",
                "brand_slug": "varnyxa-atelier",
                "fabric": "100% Mulberry Silk",
                "fit": "Twilly Ribbon (34x2 in)",
                "sleeve_length": "None",
                "occasion": "Cocktail & Daywear",
                "season": "All Season",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1000&q=80", "alt": "Silk Twilly Ribbon Scarf", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80", "alt": "Silk Twilly Tied Detail", "is_primary": False, "order": 2},
                ],
                "variants": [
                    {"size": "One Size", "color_name": "Champagne Gold", "color_hex": "#D4AF37", "sku": "VNX-TW-GLD", "stock": 40},
                    {"size": "One Size", "color_name": "Rose Blush", "color_hex": "#E0A899", "sku": "VNX-TW-RSE", "stock": 30},
                ]
            },
            # 27. Under 500: Rs 349 Organic Bamboo Baby Beanie Set
            {
                "title": "Organic Bamboo Baby Knot Beanie & Mittens Set",
                "slug": "organic-bamboo-baby-knot-beanie-mittens-set",
                "description": "Buttery soft, breathable, hypoallergenic certified organic bamboo knit with adjustable topknot. Gentle non-scratch mittens keep newborns cozy.",
                "material_care": "95% Bamboo Rayon, 5% Spandex. Machine wash gentle cold.",
                "sku_prefix": "VNX-BB-01",
                "base_price": 549.0,
                "sale_price": 349.0,
                "discount_percent": 36,
                "gender": Gender.BABY,
                "age_group": AgeGroup.NEWBORN,
                "category_slug": "kids-baby-wear",
                "brand_slug": "varnyxa-petite-juniors",
                "fabric": "Organic Bamboo Knit",
                "fit": "Newborn Stretch Fit",
                "sleeve_length": "None",
                "occasion": "Daily Hospital & Home",
                "season": "All Season",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1000&q=80", "alt": "Baby Knot Beanie Set", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1000&q=80", "alt": "Baby Beanie Detail", "is_primary": False, "order": 2},
                ],
                "variants": [
                    {"size": "0-3M", "color_name": "Soft Oat", "color_hex": "#F5F3EF", "sku": "VNX-BB-OAT", "stock": 60},
                    {"size": "3-6M", "color_name": "Sage Mist", "color_hex": "#C2D4C6", "sku": "VNX-BB-SGE", "stock": 45},
                ]
            },
            # 28. Over 50,000: Rs 52,000 Royal Zardozi Sherwani & Stole Ensemble
            {
                "title": "Bespoke Royal Zardozi Hand-Embroidered Velvet Sherwani & Shawl Ensemble",
                "slug": "bespoke-royal-zardozi-velvet-sherwani-shawl-ensemble",
                "description": "Masterwork bridal and regal gala sherwani crafted in imperial midnight silk velvet. Embellished with authentic 24-karat gold-finish metallic thread (zari), dabka, French knots, and semi-precious stones by national award-winning Lucknowi karigars. Accompanied by a coordinated pashmina silk embroidered stole.",
                "material_care": "Pure Silk Velvet & Pashmina Wool. Professional royal couture preservation dry-clean only.",
                "sku_prefix": "VNX-SH-01",
                "base_price": 59999.0,
                "sale_price": 52000.0,
                "discount_percent": 13,
                "gender": Gender.MEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "ethnic-festive",
                "brand_slug": "varnyxa-heritage",
                "fabric": "Pure Silk Velvet & Zari",
                "fit": "Royal Tailored Regal Fit",
                "sleeve_length": "Full Sleeve",
                "occasion": "Royal Wedding & Gala",
                "season": "Winter & Festive",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?auto=format&fit=crop&w=1000&q=80", "alt": "Royal Zardozi Velvet Sherwani", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1000&q=80", "alt": "Zardozi Handwork Collar Detail", "is_primary": False, "order": 2},
                    {"url": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1000&q=80", "alt": "Full Length Royal Presentation", "is_primary": False, "order": 3},
                ],
                "variants": [
                    {"size": "38R", "color_name": "Imperial Midnight Velvet", "color_hex": "#1A1A2E", "sku": "VNX-SH-38R", "stock": 4},
                    {"size": "40R", "color_name": "Imperial Midnight Velvet", "color_hex": "#1A1A2E", "sku": "VNX-SH-40R", "stock": 6},
                    {"size": "42R", "color_name": "Imperial Midnight Velvet", "color_hex": "#1A1A2E", "sku": "VNX-SH-42R", "stock": 5},
                ]
            },
            # 29. Over 50,000: Rs 58,500 Heritage Banarasi Katan Silk Bridal Saree
            {
                "title": "Heritage Banarasi Katan Silk Real Zari Bridal Saree",
                "slug": "heritage-banarasi-katan-silk-real-zari-bridal-saree",
                "description": "Heirloom bridal saree handwoven on traditional pit-looms over 120 days using certified mulberry Katan silk warp and pure silver electroplated gold zari weft. Intricate jangla floral jaal with shikar-gah hunting motifs and opulent meenakari work.",
                "material_care": "100% Pure Katan Silk & Electroplated Gold Zari. Dry clean only. Wrap in unbleached muslin.",
                "sku_prefix": "VNX-SR-02",
                "base_price": 65000.0,
                "sale_price": 58500.0,
                "discount_percent": 10,
                "gender": Gender.WOMEN,
                "age_group": AgeGroup.ADULTS,
                "category_slug": "ethnic-festive",
                "brand_slug": "varnyxa-heritage",
                "fabric": "Pure Katan Silk & Gold Zari",
                "fit": "Classic 6.5m with Blouse Piece",
                "sleeve_length": "Custom Tailored Blouse",
                "occasion": "Bridal & Heritage Wedding",
                "season": "Festive",
                "is_featured": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1000&q=80", "alt": "Banarasi Katan Silk Bridal Saree", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1000&q=80", "alt": "Zari Pallu Detail", "is_primary": False, "order": 2},
                ],
                "variants": [
                    {"size": "One Size", "color_name": "Royal Vermilion Crimson", "color_hex": "#9E1B32", "sku": "VNX-SR-CRM", "stock": 3},
                    {"size": "One Size", "color_name": "Deep Plum Silk", "color_hex": "#4A154B", "sku": "VNX-SR-PLM", "stock": 4},
                ]
            },
        ]

        # Seed or Update Products with complete multiple images and variants
        for p_data in products_seed:
            existing_p = db.query(Product).filter(Product.slug == p_data["slug"]).first()
            if not existing_p:
                product = Product(
                    title=p_data["title"],
                    slug=p_data["slug"],
                    description=p_data["description"],
                    material_care=p_data["material_care"],
                    sku_prefix=p_data["sku_prefix"],
                    base_price=p_data["base_price"],
                    sale_price=p_data["sale_price"],
                    discount_percent=p_data["discount_percent"],
                    gender=p_data["gender"],
                    age_group=p_data["age_group"],
                    category_id=cat_map[p_data["category_slug"]],
                    brand_id=brand_map[p_data["brand_slug"]],
                    fabric=p_data["fabric"],
                    fit=p_data["fit"],
                    sleeve_length=p_data["sleeve_length"],
                    occasion=p_data["occasion"],
                    season=p_data["season"],
                    is_featured=p_data["is_featured"],
                )
                db.add(product)
                db.flush()

                # Add 3-4 Unique Images per product
                for img_data in p_data["images"]:
                    img = ProductImage(
                        product_id=product.id,
                        image_url=img_data["url"],
                        alt_text=img_data["alt"],
                        is_primary=img_data["is_primary"],
                        display_order=img_data["order"],
                    )
                    db.add(img)

                # Add Variants
                for v_data in p_data["variants"]:
                    var = ProductVariant(
                        product_id=product.id,
                        size=v_data["size"],
                        color_name=v_data["color_name"],
                        color_hex=v_data["color_hex"],
                        sku=v_data["sku"],
                        stock_quantity=v_data["stock"],
                        is_active=True,
                    )
                    db.add(var)
            else:
                # Update image records so every existing product gets all 4 unique images
                existing_imgs = {img.display_order: img for img in db.query(ProductImage).filter(ProductImage.product_id == existing_p.id).all()}
                for img_data in p_data["images"]:
                    order = img_data["order"]
                    if order in existing_imgs:
                        existing_imgs[order].image_url = img_data["url"]
                        existing_imgs[order].alt_text = img_data["alt"]
                        existing_imgs[order].is_primary = img_data["is_primary"]
                    else:
                        new_img = ProductImage(
                            product_id=existing_p.id,
                            image_url=img_data["url"],
                            alt_text=img_data["alt"],
                            is_primary=img_data["is_primary"],
                            display_order=order,
                        )
                        db.add(new_img)

        db.commit()
        total_p = db.query(Product).count()
        total_img = db.query(ProductImage).count()
        total_v = db.query(ProductVariant).count()
        print(f"Catalog seeding complete! Total Products: {total_p}, Total Images: {total_img}, Total Variants: {total_v}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_store()
