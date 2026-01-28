from pydantic import BaseModel

class APIInfo(BaseModel):
    message: str
    version: str
    docs: str

class HealthResponse(BaseModel):
    status: str
    database: str
    api_version: str
