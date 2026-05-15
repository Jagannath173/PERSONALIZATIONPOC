"""Upload endpoint — Super-Admin only, RBAC-tagged document ingestion."""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.logging import get
from app.services import ingest, rbac, registry

log = get("upload")
router = APIRouter()

MAX_BYTES = 25 * 1024 * 1024   # 25 MB cap per file


@router.post("/admin/upload")
async def upload_document(
    file: UploadFile = File(...),
    requesting_user_id: str = Form(...),
    assigned_employee: str = Form(...),
    client_id: str = Form("general"),
    document_type: str = Form("uploaded_document"),
):
    """
    Super-Admin uploads a file for a specific employee. RBAC isolation is
    enforced at storage time: the chunks are tagged with portfolio_owner =
    assigned_employee, so the vector search filter prevents any other
    employee from ever retrieving them.
    """
    # 1. Auth — must be super admin
    requester = registry.get_user(requesting_user_id)
    if not requester:
        raise HTTPException(status_code=401, detail="Unknown user")
    if not rbac.is_super_admin(requester):
        log.warning("upload DENIED non-admin user=%s", requesting_user_id)
        raise HTTPException(status_code=403, detail="Super Admin access required")

    # 2. Target validation — must be a real employee
    target = registry.get_user(assigned_employee)
    if not target or target.get("role") != "employee":
        raise HTTPException(
            status_code=400,
            detail=f"assigned_employee {assigned_employee!r} is not a valid employee",
        )

    # 3. Client validation — if specified (and not "general"), must exist and
    #    belong to the target employee (otherwise we'd cross RBAC boundaries).
    if client_id and client_id != "general":
        client = registry.get_client(client_id)
        if not client:
            raise HTTPException(status_code=400, detail=f"Unknown client {client_id}")
        if client.get("assigned_employee") != assigned_employee:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Client {client_id} is not assigned to employee "
                    f"{assigned_employee} — cannot upload across RBAC boundaries."
                ),
            )

    # 4. Read + size check
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(data)} bytes); max {MAX_BYTES} bytes",
        )

    # 5. Ingest — extract / chunk / embed / RBAC-tagged insert
    try:
        summary = ingest.ingest_file(
            filename=file.filename or "untitled",
            data=data,
            portfolio_owner=assigned_employee,
            client_id=client_id or "general",
            document_type=document_type or "uploaded_document",
            uploaded_by=requesting_user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.exception("ingest failed for %s: %s", file.filename, e)
        raise HTTPException(status_code=500, detail=f"Ingest failed: {e}")

    return {"status": "ok", **summary}
