from datetime import datetime, timezone
from decimal import Decimal

from werkzeug.security import generate_password_hash
from sqlalchemy import text

from backend.app.extensions import db
from backend.app.models import (
    Brand,
    Department,
    Factory,
    Permission,
    Personnel,
    ProductType,
    PurchaseRequest,
    PurchaseRequestItem,
    Role,
    StockItem,
    StockMovement,
    User,
)


def test_purchase_request_transfer_adds_fractional_stock(client, app):
    with app.app_context():
        permission = Permission(key="requests.manage", name="Talep yönetimi")
        role = Role(name="Request Manager", active=True, permissions=[permission])
        user = User(
            username="stock-transfer-test",
            password_hash=generate_password_hash("TestPassword123!"),
            role=role,
            active=True,
        )
        factory = Factory(name="Test Factory")
        department = Department(name="Test Department")
        product_type = ProductType(name="Kablo", active=True)
        brand = Brand(name="Ugreen", active=True)
        brand.product_types.append(product_type)
        personnel = Personnel(name="Test Person", department=department, active=True)
        db.session.add_all(
            [user, factory, department, product_type, brand, personnel]
        )
        db.session.flush()

        db.session.execute(
            text(
                "INSERT INTO product_catalog_scopes (entity_type, entity_id, scope) "
                "VALUES ('type', :type_id, 'stock'), ('brand', :brand_id, 'stock')"
            ),
            {"type_id": product_type.id, "brand_id": brand.id},
        )

        request_record = PurchaseRequest(
            request_no="REQ-STOCK-TRANSFER-TEST",
            requester=personnel,
            department=department,
            factory=factory,
            status="ordered",
            priority="normal",
            requested_at=datetime.now(timezone.utc),
            items=[
                PurchaseRequestItem(
                    product_type="Stok",
                    device_type=product_type.name,
                    brand=brand.name,
                    model=None,
                    quantity=Decimal("1.00"),
                    unit="Metre",
                    received_quantity=Decimal("0.00"),
                )
            ],
        )
        db.session.add(request_record)
        db.session.commit()
        request_id = request_record.id
        item_id = request_record.items[0].id
        product_type_id = product_type.id
        brand_id = brand.id
        user_name = user.username

    login = client.post(
        "/api/auth/login",
        json={"username": user_name, "password": "TestPassword123!"},
    )
    assert login.status_code == 200

    response = client.post(
        f"/api/requests/{request_id}/transfer",
        json={
            "items": [
                {
                    "item_id": item_id,
                    "selected": True,
                    "received_quantity": 0.5,
                    "device_type": "Kablo",
                    "brand": "Ugreen",
                    "unit": "Metre",
                }
            ]
        },
    )
    assert response.status_code == 200, response.json
    assert response.json["transferred"][0]["type"] == "Stok"

    with app.app_context():
        stock = StockItem.query.filter_by(
            product_type_id=product_type_id,
            brand_id=brand_id,
            unit="Metre",
        ).one()
        assert stock.quantity == Decimal("0.50")
        movement = StockMovement.query.filter_by(
            stock_item_id=stock.id, movement_type="in"
        ).one()
        assert movement.quantity == Decimal("0.50")
        updated_item = db.session.get(PurchaseRequestItem, item_id)
        assert updated_item.received_quantity == Decimal("0.50")
