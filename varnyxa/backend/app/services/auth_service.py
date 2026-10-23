from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User, UserRole
from app.models.wishlist import Wishlist
from app.models.cart import Cart
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse, UserProfileUpdate, ChangePasswordRequest, AdminProvisionRequest
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings


class AuthService:
    @staticmethod
    def register(db: Session, data: UserRegister) -> User:
        existing = db.query(User).filter(User.email == data.email.lower().strip()).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists.",
            )

        new_user = User(
            email=data.email.lower().strip(),
            password_hash=get_password_hash(data.password),
            full_name=data.full_name.strip(),
            phone=data.phone.strip() if data.phone else None,
            role=UserRole.CUSTOMER,
            is_active=True,
            is_verified=True,  # Default active for checkout readiness
        )
        db.add(new_user)
        db.flush()

        # Initialize user's wishlist
        user_wishlist = Wishlist(user_id=new_user.id)
        db.add(user_wishlist)

        # Initialize user's primary cart
        user_cart = Cart(user_id=new_user.id)
        db.add(user_cart)

        db.commit()
        db.refresh(new_user)
        return new_user

    @staticmethod
    def authenticate(db: Session, data: UserLogin) -> User:
        user = db.query(User).filter(User.email == data.email.lower().strip()).first()
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password. Please verify your credentials.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deactivated. Please contact support.",
            )
        return user

    @staticmethod
    def create_token_response(user: User) -> TokenResponse:
        claims = {
            "sub": user.id,
            "email": user.email,
            "role": user.role.value,
            "full_name": user.full_name,
        }
        token = create_access_token(subject=user.id, claims=claims)
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        )

    @staticmethod
    def provision_admin(db: Session, data: AdminProvisionRequest) -> User:
        if not settings.ADMIN_PROVISION_KEY or data.admin_provision_key != settings.ADMIN_PROVISION_KEY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid administrator provisioning secret key.",
            )

        existing = db.query(User).filter(User.email == data.email.lower().strip()).first()
        if existing:
            # Upgrade existing user to admin
            existing.role = UserRole.ADMIN
            existing.password_hash = get_password_hash(data.password)
            existing.full_name = data.full_name.strip()
            db.commit()
            db.refresh(existing)
            return existing

        admin_user = User(
            email=data.email.lower().strip(),
            password_hash=get_password_hash(data.password),
            full_name=data.full_name.strip(),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        return admin_user

    @staticmethod
    def update_profile(db: Session, user: User, data: UserProfileUpdate) -> User:
        if data.full_name is not None:
            user.full_name = data.full_name.strip()
        if data.phone is not None:
            user.phone = data.phone.strip() if data.phone else None
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def change_password(db: Session, user: User, data: ChangePasswordRequest) -> None:
        if not verify_password(data.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password does not match.",
            )
        user.password_hash = get_password_hash(data.new_password)
        db.commit()

    @staticmethod
    def delete_account(db: Session, user: User) -> None:
        db.delete(user)
        db.commit()
