import argparse
import sys
from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash


def provision_admin(email: str, password: str, full_name: str):
    db = SessionLocal()
    try:
        email_clean = email.strip().lower()
        existing = db.query(User).filter(User.email == email_clean).first()
        if existing:
            existing.role = UserRole.ADMIN
            existing.password_hash = get_password_hash(password)
            existing.full_name = full_name.strip()
            db.commit()
            print(f"Updated existing user '{email_clean}' to Administrator role.")
        else:
            admin_user = User(
                email=email_clean,
                password_hash=get_password_hash(password),
                full_name=full_name.strip(),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            db.add(admin_user)
            db.commit()
            print(f"Provisioned new Administrator '{email_clean}' successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Provision VARNYXA Administrator Account")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=True, help="Admin password (min 8 chars)")
    parser.add_argument("--name", default="VARNYXA Administrator", help="Admin full name")
    args = parser.parse_args()

    if len(args.password) < 8:
        print("Error: Password must be at least 8 characters long.")
        sys.exit(1)

    provision_admin(args.email, args.password, args.name)
