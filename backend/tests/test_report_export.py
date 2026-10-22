from backend.app.api.report_routes import _export_cell, _export_value


def test_export_cell_neutralizes_spreadsheet_formulas():
    for value in ("=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "\tformula"):
        assert _export_cell(value).startswith("'")


def test_export_cell_preserves_normal_values():
    assert _export_cell("Baylan") == "Baylan"
    assert _export_cell(42) == 42
    assert _export_cell(None) == ""


def test_export_value_converts_decimal_and_dates():
    from datetime import date
    from decimal import Decimal

    assert _export_value(Decimal("2.50")) == 2.5
    assert _export_value(date(2026, 10, 20)) == "2026-10-20"


def test_safe_audit_details_removes_normalized_secret_fields():
    from backend.app.api.report_routes import _safe_audit_details

    details = {
        "licenseKey": "do-not-export",
        "api_key": "do-not-export",
        "Password": "do-not-export",
        "request_no": "SAT-2026-001",
        "nested": {"private_key": "do-not-export", "status": "approved"},
    }
    safe = _safe_audit_details(details)
    assert "licenseKey" not in safe
    assert "api_key" not in safe
    assert "Password" not in safe
    assert safe["request_no"] == "SAT-2026-001"
    assert safe["nested"] == {"status": "approved"}



def test_report_status_filter_normalizes_turkish_labels():
    from backend.app.api.report_routes import _normalize_status

    assert _normalize_status("Aktif") == "active"
    assert _normalize_status("Pasif") == "inactive"
    assert _normalize_status("Arızalı") == "faulty"
    assert _normalize_status("Bakımda") == "maintenance"
    assert _normalize_status("Tamamlandı") == "completed"
    assert _normalize_status("assigned") == "assigned"
