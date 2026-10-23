from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.catalog import Category, Brand, Product, ProductVariant, ProductImage, Gender, AgeGroup

def add_price_variety():
    db: Session = SessionLocal()
    try:
        brand_atelier = db.query(Brand).filter(Brand.slug == "varnyxa-atelier").first()
        brand_heritage = db.query(Brand).filter(Brand.slug == "varnyxa-heritage").first()
        brand_urban = db.query(Brand).filter(Brand.slug == "varnyxa-urban").first()
        brand_petite = db.query(Brand).filter(Brand.slug == "varnyxa-petite-juniors").first()

        cat_shirts = db.query(Category).filter(Category.slug == "shirts-tops").first()
        cat_ethnic = db.query(Category).filter(Category.slug == "ethnic-festive").first()
        cat_kids = db.query(Category).filter(Category.slug == "kids-baby-wear").first()

        new_items = [
            # 1. Under 500: Rs 299 Organic Cotton Pocket Square
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
                "category_id": cat_shirts.id,
                "brand_id": brand_urban.id,
                "fabric": "100% Organic Cotton",
                "fit": "Square (13x13 in)",
                "sleeve_length": "None",
                "occasion": "Formal & Black Tie",
                "season": "All Season",
                "is_featured": True,
                "is_active": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1000&q=80", "alt": "Pocket Square Folded View", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1000&q=80", "alt": "Pocket Square in Blazer Pocket", "is_primary": False, "order": 2},
                ],
                "variants": [
                    {"size": "One Size", "color_name": "Crisp White", "color_hex": "#FAF9F6", "sku": "VNX-PS-WHT", "stock": 50},
                    {"size": "One Size", "color_name": "Ivory Bronze", "color_hex": "#C5A880", "sku": "VNX-PS-BRZ", "stock": 35},
                ]
            },
            # 2. Under 500: Rs 449 Mulberry Silk Twilly Scarf
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
                "category_id": cat_shirts.id,
                "brand_id": brand_atelier.id,
                "fabric": "100% Mulberry Silk",
                "fit": "Twilly Ribbon (34x2 in)",
                "sleeve_length": "None",
                "occasion": "Cocktail & Daywear",
                "season": "All Season",
                "is_featured": True,
                "is_active": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1000&q=80", "alt": "Silk Twilly Ribbon Scarf", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80", "alt": "Silk Twilly Tied Detail", "is_primary": False, "order": 2},
                ],
                "variants": [
                    {"size": "One Size", "color_name": "Champagne Gold", "color_hex": "#D4AF37", "sku": "VNX-TW-GLD", "stock": 40},
                    {"size": "One Size", "color_name": "Rose Blush", "color_hex": "#E0A899", "sku": "VNX-TW-RSE", "stock": 30},
                ]
            },
            # 3. Under 500: Rs 349 Organic Bamboo Baby Beanie Set
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
                "category_id": cat_kids.id,
                "brand_id": brand_petite.id,
                "fabric": "Organic Bamboo Knit",
                "fit": "Newborn Stretch Fit",
                "sleeve_length": "None",
                "occasion": "Daily Hospital & Home",
                "season": "All Season",
                "is_featured": True,
                "is_active": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1000&q=80", "alt": "Baby Knot Beanie Set", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1000&q=80", "alt": "Baby Beanie Detail", "is_primary": False, "order": 2},
                ],
                "variants": [
                    {"size": "0-3M", "color_name": "Soft Oat", "color_hex": "#F5F3EF", "sku": "VNX-BB-OAT", "stock": 60},
                    {"size": "3-6M", "color_name": "Sage Mist", "color_hex": "#C2D4C6", "sku": "VNX-BB-SGE", "stock": 45},
                ]
            },
            # 4. Over 50,000: Rs 52,000 Royal Zardozi Sherwani & Stole Ensemble
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
                "category_id": cat_ethnic.id,
                "brand_id": brand_heritage.id,
                "fabric": "Pure Silk Velvet & Zari",
                "fit": "Royal Tailored Regal Fit",
                "sleeve_length": "Full Sleeve",
                "occasion": "Royal Wedding & Gala",
                "season": "Winter & Festive",
                "is_featured": True,
                "is_active": True,
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
            # 5. Over 50,000: Rs 58,500 Heritage Banarasi Katan Silk Bridal Saree
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
                "category_id": cat_ethnic.id,
                "brand_id": brand_heritage.id,
                "fabric": "Pure Katan Silk & Gold Zari",
                "fit": "Classic 6.5m with Blouse Piece",
                "sleeve_length": "Custom Tailored Blouse",
                "occasion": "Bridal & Heritage Wedding",
                "season": "Festive",
                "is_featured": True,
                "is_active": True,
                "images": [
                    {"url": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1000&q=80", "alt": "Banarasi Katan Silk Bridal Saree", "is_primary": True, "order": 1},
                    {"url": "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1000&q=80", "alt": "Zari Pallu Detail", "is_primary": False, "order": 2},
                ],
                "variants": [
                    {"size": "One Size", "color_name": "Royal Vermilion Crimson", "color_hex": "#9E1B32", "sku": "VNX-SR-CRM", "stock": 3},
                    {"size": "One Size", "color_name": "Deep Plum Silk", "color_hex": "#4A154B", "sku": "VNX-SR-PLM", "stock": 4},
                ]
            }
        ]

        for item in new_items:
            existing = db.query(Product).filter(Product.slug == item["slug"]).first()
            if not existing:
                p = Product(
                    title=item["title"],
                    slug=item["slug"],
                    description=item["description"],
                    material_care=item["material_care"],
                    sku_prefix=item["sku_prefix"],
                    base_price=item["base_price"],
                    sale_price=item["sale_price"],
                    discount_percent=item["discount_percent"],
                    gender=item["gender"],
                    age_group=item["age_group"],
                    category_id=item["category_id"],
                    brand_id=item["brand_id"],
                    fabric=item["fabric"],
                    fit=item["fit"],
                    sleeve_length=item["sleeve_length"],
                    occasion=item["occasion"],
                    season=item["season"],
                    is_featured=item["is_featured"],
                    is_active=item["is_active"],
                )
                db.add(p)
                db.flush()

                for img_data in item["images"]:
                    img = ProductImage(
                        product_id=p.id,
                        image_url=img_data["url"],
                        alt_text=img_data["alt"],
                        is_primary=img_data["is_primary"],
                        display_order=img_data["order"],
                    )
                    db.add(img)

                for v_data in item["variants"]:
                    var = ProductVariant(
                        product_id=p.id,
                        size=v_data["size"],
                        color_name=v_data["color_name"],
                        color_hex=v_data["color_hex"],
                        sku=v_data["sku"],
                        stock_quantity=v_data["stock"],
                        is_active=True,
                    )
                    db.add(var)

        db.commit()
        print("Successfully added price variety products (Under 500 & Over 50,000)!")
    except Exception as e:
        db.rollback()
        print(f"Error adding items: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    add_price_variety()
