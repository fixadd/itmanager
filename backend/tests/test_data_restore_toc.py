from backend.app.api.data_routes import _restore_toc_without_managed_objects


def test_restore_toc_keeps_public_schema_and_pg_trgm_out_of_clean_list():
    listing = """;
; Archive created at 2026-10-22
6; 2615 57347 SCHEMA - public itmanager
2; 3079 57797 EXTENSION - pg_trgm
3886; 0 0 COMMENT SCHEMA public itmanager
12; 1259 57451 TABLE public users itmanager
3845; 0 57451 TABLE DATA public users itmanager
"""
    filtered = _restore_toc_without_managed_objects(listing)
    lines = filtered.splitlines()

    assert "; 6; 2615 57347 SCHEMA - public itmanager" in lines
    assert "; 2; 3079 57797 EXTENSION - pg_trgm" in lines
    assert "; 3886; 0 0 COMMENT SCHEMA public itmanager" in lines
    assert "12; 1259 57451 TABLE public users itmanager" in lines
    assert "3845; 0 57451 TABLE DATA public users itmanager" in lines


def test_restore_toc_does_not_filter_unrelated_extensions_or_schemas():
    listing = """;
3; 2615 2200 SCHEMA - app_schema itmanager
4; 3079 12345 EXTENSION - hstore
"""
    filtered = _restore_toc_without_managed_objects(listing)
    assert "3; 2615 2200 SCHEMA - app_schema itmanager" in filtered
    assert "4; 3079 12345 EXTENSION - hstore" in filtered
