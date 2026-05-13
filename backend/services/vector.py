"""
Milvus Lite vector store (no separate server needed).

RBAC isolation is enforced at two levels:
  1. filter expression passed to search() — restricts by portfolio_owner server-side
  2. Python re-validates portfolio_owner on every returned hit (defence in depth)
"""

import uuid
from datetime import datetime
from pymilvus import MilvusClient, DataType
from sentence_transformers import SentenceTransformer
from config import MILVUS_URI, COLLECTION_NAME, EMBEDDING_DIM, EMBEDDING_MODEL

_client = None
_embedder = None


def _get_client() -> MilvusClient:
    global _client
    if _client is None:
        _client = MilvusClient(uri=MILVUS_URI)
        _ensure_collection(_client)
    return _client


def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBEDDING_MODEL)
    return _embedder


def _ensure_collection(client: MilvusClient) -> None:
    if client.has_collection(COLLECTION_NAME):
        return

    schema = client.create_schema(auto_id=True, enable_dynamic_field=False)
    schema.add_field("id",              DataType.INT64,        is_primary=True)
    schema.add_field("document_id",     DataType.VARCHAR,      max_length=200)
    schema.add_field("portfolio_owner", DataType.VARCHAR,      max_length=100)
    schema.add_field("client_id",       DataType.VARCHAR,      max_length=100)
    schema.add_field("document_type",   DataType.VARCHAR,      max_length=100)
    schema.add_field("access_scope",    DataType.VARCHAR,      max_length=100)
    schema.add_field("content",         DataType.VARCHAR,      max_length=65535)
    schema.add_field("created_at",      DataType.VARCHAR,      max_length=50)
    schema.add_field("updated_at",      DataType.VARCHAR,      max_length=50)
    schema.add_field("embedding",       DataType.FLOAT_VECTOR, dim=EMBEDDING_DIM)

    index_params = client.prepare_index_params()
    index_params.add_index(
        field_name="embedding",
        index_type="IVF_FLAT",
        metric_type="COSINE",
        params={"nlist": 128},
    )

    client.create_collection(
        collection_name=COLLECTION_NAME,
        schema=schema,
        index_params=index_params,
    )


def embed(text: str) -> list:
    return _get_embedder().encode(text).tolist()


def insert_document(
    portfolio_owner: str,
    client_id: str,
    document_type: str,
    content: str,
    document_id: str = None,
) -> str:
    client = _get_client()
    doc_id = document_id or f"doc_{uuid.uuid4().hex[:8]}"
    now = datetime.now().isoformat()

    client.insert(
        collection_name=COLLECTION_NAME,
        data=[{
            "document_id":     doc_id,
            "portfolio_owner": portfolio_owner,
            "client_id":       client_id,
            "document_type":   document_type,
            "access_scope":    portfolio_owner,
            "content":         content,
            "created_at":      now,
            "updated_at":      now,
            "embedding":       embed(content),
        }],
    )
    return doc_id


def search_documents(
    query: str,
    allowed_scopes,          # None = super_admin (all), list = agent scope
    top_k: int = 6,
    client_id_filter: str = None,
) -> list:
    client = _get_client()

    conditions = []
    if allowed_scopes is not None:
        quoted = ", ".join(f'"{s}"' for s in allowed_scopes)
        conditions.append(f"portfolio_owner in [{quoted}]")
    if client_id_filter:
        conditions.append(f'client_id == "{client_id_filter}"')

    expr = " && ".join(conditions) if conditions else None

    raw = client.search(
        collection_name=COLLECTION_NAME,
        data=[embed(query)],
        limit=top_k,
        search_params={"metric_type": "COSINE", "params": {"nprobe": 10}},
        filter=expr,
        output_fields=[
            "document_id", "portfolio_owner", "client_id",
            "document_type", "content", "access_scope", "created_at",
        ],
    )

    results = []
    for hits in raw:
        for hit in hits:
            entity = hit["entity"]
            owner = entity.get("portfolio_owner", "")
            # Defence-in-depth: validate scope after Milvus filter
            if allowed_scopes is not None and owner not in allowed_scopes:
                continue
            results.append({
                "document_id":     entity.get("document_id"),
                "portfolio_owner": owner,
                "client_id":       entity.get("client_id"),
                "document_type":   entity.get("document_type"),
                "content":         entity.get("content"),
                "access_scope":    entity.get("access_scope"),
                "created_at":      entity.get("created_at"),
                "score":           round(hit.get("distance", 0), 4),
            })
    return results


def collection_stats() -> dict:
    client = _get_client()
    return client.get_collection_stats(COLLECTION_NAME)
