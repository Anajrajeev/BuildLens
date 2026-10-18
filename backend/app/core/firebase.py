"""Server-only Firebase clients. Production uses application default credentials."""
from functools import lru_cache

import firebase_admin
from firebase_admin import credentials, firestore
from app.core.config import get_settings


@lru_cache
def firebase_app():
    settings = get_settings()
    credential = credentials.ApplicationDefault()
    if settings.firebase_credentials_file:
        from google.oauth2.credentials import Credentials
        from firebase_admin.credentials import Base

        class LocalCredential(Base):
            def get_credential(self):
                return Credentials.from_authorized_user_file(settings.firebase_credentials_file)

        credential = LocalCredential()
    return firebase_admin.initialize_app(credential, {"projectId": settings.firebase_project_id})


@lru_cache
def database():
    return firestore.client(app=firebase_app())
