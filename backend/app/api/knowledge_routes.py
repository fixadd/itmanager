from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from ..extensions import db
from ..models import AuditLog, KnowledgeArticle, Personnel

knowledge_bp = Blueprint("knowledge", __name__)

STATUSES = {"draft", "published", "archived"}


def article_json(article, include_content=False):
    data = {
        "id": article.id,
        "title": article.title,
        "slug": article.slug,
        "category": article.category,
        "summary": article.summary,
        "tags": [x.strip() for x in (article.tags or "").split(",") if x.strip()],
        "status": article.status,
        "author": {"id": article.author.id, "name": article.author.name} if article.author else None,
        "view_count": article.view_count,
        "created_at": article.created_at.isoformat() if article.created_at else None,
        "updated_at": article.updated_at.isoformat() if article.updated_at else None,
    }
    if include_content:
        data["content"] = article.content
    return data


def slugify(value):
    import re
    value = (value or "").strip().lower()
    value = value.translate(str.maketrans("çğıöşü", "cgiosu"))
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "makale"


def unique_slug(title, current_id=None):
    base = slugify(title)
    slug = base
    counter = 2
    while True:
        query = KnowledgeArticle.query.filter_by(slug=slug)
        if current_id:
            query = query.filter(KnowledgeArticle.id != current_id)
        if not query.first():
            return slug
        slug = f"{base}-{counter}"
        counter += 1


def audit(action, article, details=None):
    db.session.add(AuditLog(action=action, entity_type="knowledge_article", entity_id=article.id, details=details or {}))


@knowledge_bp.get("/knowledge")
def list_articles():
    q = (request.args.get("q") or "").strip()
    category = (request.args.get("category") or "").strip()
    status = (request.args.get("status") or "").strip()
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 20, type=int), 1), 100)

    query = KnowledgeArticle.query
    if q:
        like = f"%{q}%"
        query = query.filter(or_(KnowledgeArticle.title.ilike(like), KnowledgeArticle.summary.ilike(like), KnowledgeArticle.content.ilike(like), KnowledgeArticle.tags.ilike(like)))
    if category:
        query = query.filter(KnowledgeArticle.category == category)
    if status:
        query = query.filter(KnowledgeArticle.status == status)

    pagination = query.order_by(KnowledgeArticle.updated_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "items": [article_json(a) for a in pagination.items],
        "pagination": {"page": pagination.page, "per_page": pagination.per_page, "total": pagination.total, "pages": pagination.pages},
    })


@knowledge_bp.get("/knowledge/categories")
def categories():
    rows = db.session.query(KnowledgeArticle.category).distinct().order_by(KnowledgeArticle.category.asc()).all()
    return jsonify([r[0] for r in rows if r[0]])


@knowledge_bp.get("/knowledge/<int:article_id>")
def get_article(article_id):
    article = db.get_or_404(KnowledgeArticle, article_id)
    article.view_count += 1
    db.session.commit()
    return jsonify(article_json(article, include_content=True))


@knowledge_bp.post("/knowledge")
def create_article():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    if not title or not content:
        return jsonify({"error": "title ve content zorunludur"}), 400

    author_id = data.get("author_id")
    if author_id and not db.session.get(Personnel, author_id):
        return jsonify({"error": "Geçersiz author_id"}), 400

    status = (data.get("status") or "draft").strip().lower()
    if status not in STATUSES:
        return jsonify({"error": "Geçersiz status"}), 400

    article = KnowledgeArticle(
        title=title,
        slug=unique_slug(title),
        category=(data.get("category") or "Genel").strip() or "Genel",
        summary=(data.get("summary") or "").strip() or None,
        content=content,
        tags=", ".join(data.get("tags", [])) if isinstance(data.get("tags"), list) else (data.get("tags") or "").strip(),
        status=status,
        author_id=author_id,
    )
    db.session.add(article)
    db.session.flush()
    audit("knowledge_created", article, {"title": article.title, "status": article.status})
    db.session.commit()
    return jsonify(article_json(article, include_content=True)), 201


@knowledge_bp.route("/knowledge/<int:article_id>", methods=["PATCH", "PUT"])
def update_article(article_id):
    article = db.get_or_404(KnowledgeArticle, article_id)
    data = request.get_json(silent=True) or {}

    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"error": "title boş olamaz"}), 400
        article.title = title
        article.slug = unique_slug(title, article.id)
    if "content" in data:
        content = (data.get("content") or "").strip()
        if not content:
            return jsonify({"error": "content boş olamaz"}), 400
        article.content = content
    for field in ("category", "summary"):
        if field in data:
            value = (data.get(field) or "").strip()
            setattr(article, field, value or ("Genel" if field == "category" else None))
    if "tags" in data:
        article.tags = ", ".join(data.get("tags", [])) if isinstance(data.get("tags"), list) else (data.get("tags") or "").strip()
    if "author_id" in data:
        author_id = data.get("author_id")
        if author_id and not db.session.get(Personnel, author_id):
            return jsonify({"error": "Geçersiz author_id"}), 400
        article.author_id = author_id
    if "status" in data:
        status = (data.get("status") or "").strip().lower()
        if status not in STATUSES:
            return jsonify({"error": "Geçersiz status"}), 400
        article.status = status

    audit("knowledge_updated", article, {"title": article.title, "status": article.status})
    db.session.commit()
    return jsonify(article_json(article, include_content=True))


def change_status(article_id, status, action):
    article = db.get_or_404(KnowledgeArticle, article_id)
    article.status = status
    audit(action, article, {"status": status})
    db.session.commit()
    return jsonify(article_json(article, include_content=True))


@knowledge_bp.post("/knowledge/<int:article_id>/publish")
def publish_article(article_id):
    return change_status(article_id, "published", "knowledge_published")


@knowledge_bp.post("/knowledge/<int:article_id>/archive")
def archive_article(article_id):
    return change_status(article_id, "archived", "knowledge_archived")


@knowledge_bp.post("/knowledge/<int:article_id>/restore")
def restore_article(article_id):
    return change_status(article_id, "draft", "knowledge_restored")
