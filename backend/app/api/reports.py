"""Report endpoints — employee / client / org-wide reports."""

from fastapi import APIRouter, HTTPException

from app.services import llm, memory, rbac, vector

router = APIRouter()


@router.get("/reports/employee/{employee_id}")
async def employee_report(employee_id: str, requesting_user_id: str, report_type: str = "weekly"):
    user = rbac.get_user(requesting_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    if not rbac.can_access_portfolio(user, employee_id):
        raise HTTPException(status_code=403, detail=f"Access denied to {employee_id} data.")
    docs = vector.search_documents(
        query="portfolio summary performance investments clients",
        allowed_scopes=[employee_id],
        top_k=10,
    )
    emp_mems = memory.get_user_preferences(employee_id)
    report_text = llm.generate_employee_report(employee_id, docs, emp_mems, report_type)
    return {"employee_id": employee_id, "report_type": report_type, "report": report_text}


@router.get("/reports/client/{client_id}")
async def client_report(client_id: str, requesting_user_id: str):
    user = rbac.get_user(requesting_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    if not rbac.can_access_client(user, client_id):
        raise HTTPException(status_code=403, detail=f"Access denied to {client_id} data.")
    scopes = rbac.resolve_retrieval_scopes(user)
    docs = vector.search_documents(
        query=f"portfolio investments performance for {client_id}",
        allowed_scopes=scopes,
        top_k=6,
        client_id_filter=client_id,
    )
    client_pref = memory.get_client_preference(client_id)
    update_text = llm.generate_client_update(client_id, docs, client_pref, user)
    return {"client_id": client_id, "update": update_text, "preference_applied": client_pref}


@router.get("/reports/all-employees")
async def all_employees_report(requesting_user_id: str):
    user = rbac.get_user(requesting_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    if user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can generate org-wide reports.")
    all_owners = rbac.get_all_accessible_portfolio_owners(user)
    reports = {}
    for owner in all_owners:
        docs = vector.search_documents(
            query="portfolio summary performance clients investments",
            allowed_scopes=[owner],
            top_k=8,
        )
        mems = memory.get_user_preferences(owner)
        reports[owner] = llm.generate_employee_report(owner, docs, mems, "weekly")
    return {"reports": reports, "employee_count": len(reports)}
