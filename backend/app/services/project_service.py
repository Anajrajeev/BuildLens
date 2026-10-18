from app.core.errors import api_error
from app.core.security import CurrentUser
from app.repositories.project_repository import ProjectRepository

class ProjectService:
    def __init__(self, repository: ProjectRepository): self.repository = repository

    async def list(self, user: CurrentUser, page: int, page_size: int):
        if user.organization_id is None:
            raise api_error("ORG_CONTEXT_REQUIRED", "An organization context is required.", 403)
        return await self.repository.list_for_organization(user.organization_id, page, page_size)
