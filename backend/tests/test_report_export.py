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
