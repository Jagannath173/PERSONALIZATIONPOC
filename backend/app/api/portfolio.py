"""Portfolio endpoints — document insert / search with RBAC enforcement."""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import rbac, vector

router = APIRouter()


class AddDocumentRequest(BaseModel):
    requesting_user_id: str
    portfolio_owner: str
    client_id: str
    document_type: str
    content: str
    document_id: Optional[str] = None


@router.post("/portfolio/document")
async def add_document(req: AddDocumentRequest):
    user = rbac.get_user(req.requesting_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    if not rbac.can_modify_portfolio(user, req.portfolio_owner):
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: You cannot modify {req.portfolio_owner}'s portfolio.",
        )
    doc_id = vector.insert_document(
        portfolio_owner=req.portfolio_owner,
        client_id=req.client_id,
        document_type=req.document_type,
        content=req.content,
        document_id=req.document_id,
    )
    return {"status": "stored", "document_id": doc_id}


@router.get("/portfolio/search")
async def search(requesting_user_id: str, query: str, client_id: Optional[str] = None):
    user = rbac.get_user(requesting_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    scopes = rbac.get_allowed_scopes(user)
    docs = vector.search_documents(query=query, allowed_scopes=scopes, client_id_filter=client_id)
    return {"results": docs, "count": len(docs)}


@router.get("/portfolio/stats")
async def stats():
    return vector.collection_stats()
