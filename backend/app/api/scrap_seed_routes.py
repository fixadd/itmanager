from flask import Blueprint, jsonify
from ..extensions import db
from ..models import Inventory, License, StockItem, ScrapRecord

scrap_seed_bp = Blueprint("scrap_seed", __name__)

@scrap_seed_bp.get("/scrap/stats")
def scrap_stats():
    return jsonify({
        "total": ScrapRecord.query.count(),
        "inventory": ScrapRecord.query.filter_by(source_type="inventory").count(),
        "license": ScrapRecord.query.filter_by(source_type="license").count(),
        "stock": ScrapRecord.query.filter_by(source_type="stock").count(),
    })
