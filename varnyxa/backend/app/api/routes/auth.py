from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    UserResponse,
    UserProfileUpdate,
    ChangePasswordRequest,
    AdminProvisionRequest,
)
from app.services.auth_service import AuthService
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, response: Response, db: Session = Depends(get_db)):
    user = AuthService.register(db, data)
    token_resp = AuthService.create_token_response(user)
    response.set_cookie(
        key="access_token",
        value=token_resp.access_token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in production HTTPS
        max_age=86400,
    )
    return token_resp


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = AuthService.authenticate(db, data)
    token_resp = AuthService.create_token_response(user)
    response.set_cookie(
        key="access_token",
        value=token_resp.access_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=86400,
    )
    return token_resp


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=UserResponse)
def update_profile(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return AuthService.update_profile(db, current_user, data)


@router.put("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    AuthService.change_password(db, current_user, data)
    return {"message": "Password changed successfully."}


@router.post("/provision-admin", response_model=UserResponse)
def provision_admin(data: AdminProvisionRequest, db: Session = Depends(get_db)):
    admin_user = AuthService.provision_admin(db, data)
    return admin_user
