from backend.app.extensions import db
from sqlalchemy import text
from backend.app.models import Brand, ProductModel, ProductType


def _create_settings_admin(app, username="hierarchy_reader"):
    from backend.app.models import Permission, Role, User
    from werkzeug.security import generate_password_hash

    permission = Permission(key="settings.manage", name="settings.manage")
    role = Role(name=f"HierarchyTestAdmin_{username}", active=True, permissions=[permission])
    user = User(
        username=username,
        password_hash=generate_password_hash("TestPassword123!"),
        role=role,
        active=True,
    )
    db.session.add_all([permission, role, user])
    db.session.commit()


def test_product_hierarchy_endpoint_exposes_type_brand_model_links(client, app):
    with app.app_context():
        _create_settings_admin(app)
        product_type = ProductType(name="Laptop")
        brand = Brand(name="TestBrand")
        product_type.brands.append(brand)
        model = ProductModel(name="TestModel", brand=brand, product_type=product_type)
        db.session.add_all([product_type, brand, model])
        db.session.flush()
        db.session.execute(text("INSERT INTO product_catalog_scopes (entity_type,entity_id,scope) VALUES ('type',:id,'inventory'),('brand',:brand_id,'inventory'),('model',:model_id,'inventory') ON CONFLICT DO NOTHING"), {"id": product_type.id, "brand_id": brand.id, "model_id": model.id})
        db.session.commit()
        type_id, brand_id, model_id = product_type.id, brand.id, model.id

    login = client.post("/api/auth/login", json={"username": "hierarchy_reader", "password": "TestPassword123!"})
    assert login.status_code == 200

    response = client.get("/api/settings/product-hierarchy")
    assert response.status_code == 200
    data = response.get_json()

    hardware_type = next(x for x in data["hardware_types"] if x["id"] == type_id)
    returned_brand = next(x for x in data["brands"] if x["id"] == brand_id)
    returned_model = next(x for x in data["models"] if x["id"] == model_id)

    assert brand_id in hardware_type["brand_ids"]
    assert type_id in returned_brand["product_type_ids"]
    assert returned_model["brand_id"] == brand_id
    assert returned_model["product_type_id"] == type_id


def test_model_creation_rejects_unlinked_brand(client, app):
    from backend.app.models import Permission, Role, User
    from werkzeug.security import generate_password_hash

    with app.app_context():
        permission = Permission(key="settings.manage", name="settings.manage")
        role = Role(name="HierarchyTestAdmin", active=True, permissions=[permission])
        user = User(username="hierarchy_admin", password_hash=generate_password_hash("TestPassword123!"), role=role, active=True)
        first_type = ProductType(name="Notebook")
        second_type = ProductType(name="Monitor")
        brand = Brand(name="LinkedBrand")
        first_type.brands.append(brand)
        db.session.add_all([permission, role, user, first_type, second_type, brand])
        db.session.commit()
        second_type_id, brand_id = second_type.id, brand.id

    login = client.post("/api/auth/login", json={"username": "hierarchy_admin", "password": "TestPassword123!"})
    assert login.status_code == 200
    response = client.post("/api/settings/product-hierarchy/model", json={"name": "InvalidModel", "brand_id": brand_id, "product_type_id": second_type_id})
    assert response.status_code == 400
    assert response.get_json()["error"] == "brand_not_linked_to_product_type"
