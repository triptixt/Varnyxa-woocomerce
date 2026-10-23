import json
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.settings import StoreSetting, AdminDiscountLog
from app.models.user import User

DEFAULT_SETTINGS: Dict[str, Dict[str, Any]] = {
    "gst_rate": {
        "value": "18.0",
        "description": "Applicable Goods and Services Tax percentage (default 18% for apparel)",
    },
    "gst_mode": {
        "value": "exclusive",
        "description": "Tax treatment mode: 'exclusive' (tax added to subtotal) or 'inclusive' (tax calculated within price)",
    },
    "standard_shipping_fee": {
        "value": "79.0",
        "description": "Standard delivery fee in INR applied when order subtotal is below the threshold",
    },
    "free_shipping_threshold": {
        "value": "1499.0",
        "description": "Minimum merchandise subtotal in INR required for complimentary express delivery",
    },
    "admin_global_discount": {
        "value": "0.0",
        "description": "Store-wide promotional discount percentage controlled by the authorized admin slider (0% - 70%)",
    },
    "default_theme": {
        "value": "white",
        "description": "Default active aesthetic palette across the platform (black, white, light-green, light-orange)",
    },
    "admin_allow_cod": {
        "value": "true",
        "description": "Internal toggle enabling Cash on Delivery (COD) for administrative operations only",
    },
}


class SettingsService:
    @staticmethod
    def initialize_defaults(db: Session) -> None:
        """Seed default store settings if they do not yet exist in PostgreSQL."""
        for key, info in DEFAULT_SETTINGS.items():
            existing = db.query(StoreSetting).filter(StoreSetting.key == key).first()
            if not existing:
                setting = StoreSetting(
                    key=key,
                    value=str(info["value"]),
                    description=info["description"],
                )
                db.add(setting)
        db.commit()

    @staticmethod
    def get_setting(db: Session, key: str, default: Optional[str] = None) -> str:
        setting = db.query(StoreSetting).filter(StoreSetting.key == key).first()
        if setting:
            return setting.value
        if default is not None:
            return default
        if key in DEFAULT_SETTINGS:
            return str(DEFAULT_SETTINGS[key]["value"])
        return ""

    @staticmethod
    def get_float_setting(db: Session, key: str, default: float = 0.0) -> float:
        val = SettingsService.get_setting(db, key, str(default))
        try:
            return float(val)
        except ValueError:
            return default

    @staticmethod
    def get_all_settings(db: Session) -> Dict[str, Any]:
        SettingsService.initialize_defaults(db)
        settings_rows = db.query(StoreSetting).all()
        result = {}
        for row in settings_rows:
            # Type cast appropriately
            if row.key in ["gst_rate", "standard_shipping_fee", "free_shipping_threshold", "admin_global_discount"]:
                try:
                    result[row.key] = float(row.value)
                except ValueError:
                    result[row.key] = row.value
            elif row.key in ["admin_allow_cod"]:
                result[row.key] = row.value.lower() in ("true", "1", "yes")
            else:
                result[row.key] = row.value
        return result

    @staticmethod
    def get_public_settings(db: Session) -> Dict[str, Any]:
        """Publicly visible business settings consumed by customer frontend."""
        SettingsService.initialize_defaults(db)
        return {
            "gst_rate": SettingsService.get_float_setting(db, "gst_rate", 18.0),
            "gst_mode": SettingsService.get_setting(db, "gst_mode", "exclusive"),
            "standard_shipping_fee": SettingsService.get_float_setting(db, "standard_shipping_fee", 79.0),
            "free_shipping_threshold": SettingsService.get_float_setting(db, "free_shipping_threshold", 1499.0),
            "admin_global_discount": SettingsService.get_float_setting(db, "admin_global_discount", 0.0),
            "default_theme": SettingsService.get_setting(db, "default_theme", "white"),
            "currency": "INR",
            "currency_symbol": "₹",
        }

    @staticmethod
    def update_settings(db: Session, updates: Dict[str, Any], admin_user: User) -> Dict[str, Any]:
        for key, raw_val in updates.items():
            if raw_val is None:
                continue
            str_val = str(raw_val)
            setting = db.query(StoreSetting).filter(StoreSetting.key == key).first()
            if setting:
                setting.value = str_val
                setting.updated_at = datetime.now(timezone.utc)
                setting.updated_by = admin_user.id
            else:
                setting = StoreSetting(
                    key=key,
                    value=str_val,
                    description=DEFAULT_SETTINGS.get(key, {}).get("description", ""),
                    updated_by=admin_user.id,
                )
                db.add(setting)
        db.commit()
        return SettingsService.get_all_settings(db)

    @staticmethod
    def set_discount_slider(
        db: Session,
        discount_percent: float,
        admin_user: User,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        # Validate slider bounds (0% to 70%)
        if discount_percent < 0.0 or discount_percent > 70.0:
            raise ValueError("Discount percentage must be between 0% and 70%.")

        rounded_discount = round(discount_percent, 2)

        # Update in store_settings
        setting = db.query(StoreSetting).filter(StoreSetting.key == "admin_global_discount").first()
        if setting:
            setting.value = str(rounded_discount)
            setting.updated_at = datetime.now(timezone.utc)
            setting.updated_by = admin_user.id
        else:
            setting = StoreSetting(
                key="admin_global_discount",
                value=str(rounded_discount),
                description=DEFAULT_SETTINGS["admin_global_discount"]["description"],
                updated_by=admin_user.id,
            )
            db.add(setting)

        # Record immutable audit log
        log = AdminDiscountLog(
            discount_percent=rounded_discount,
            admin_id=admin_user.id,
            admin_email=admin_user.email,
            reason=reason or f"Admin adjusted discount slider to {rounded_discount}%",
        )
        db.add(log)
        db.commit()

        return {
            "discount_percent": rounded_discount,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": admin_user.email,
            "applied_by": admin_user.email,
        }
