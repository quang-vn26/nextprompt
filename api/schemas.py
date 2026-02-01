from pydantic import BaseModel

class RootResponse(BaseModel):
    message: str
    version: str
    docs: str

class HealthResponse(BaseModel):
    status: str
    database: str
    api_version: str
