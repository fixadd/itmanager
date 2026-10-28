from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from odf.opendocument import load
from odf.table import Table, TableRow
from odf.namespaces import TABLENS
from odf.teletype import extractText

from ..extensions import db
from ..models import AuditLog, NetworkPort
from .auth_routes import current_user, login_required

network_bp = Blueprint("network", __name__)


def _clean(value):
    value = str(value or "").strip()
    return value or None


def _dict(row):
    return {
        "id": row.id,
        "cabinet_name": row.cabinet_name,
        "row_number": row.row_number,
        "device_type": row.device_type,
        "port_label": row.port_label,
        "patch_panel": row.patch_panel,
        "ip_address": row.ip_address,
        "switch_port": row.switch_port,
        "mounting_location": row.mounting_location,
        "note": row.note,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _audit(action, row, details=None):
    user = current_user()
    db.session.add(AuditLog(
        action=action,
        entity_type="network_port",
        entity_id=row.id,
        actor_user_id=user.id if user else None,
        details=details or {},
    ))


def _payload(data, existing=None):
    cabinet = str(data.get("cabinet_name", existing.cabinet_name if existing else "") or "").strip()
    if not cabinet:
        raise ValueError("Kabinet adı zorunludur")
    row_number = data.get("row_number", existing.row_number if existing else None)
    try:
        row_number = int(row_number)
    except (TypeError, ValueError):
        raise ValueError("Port sıra numarası pozitif tam sayı olmalıdır")
    if row_number < 1:
        raise ValueError("Port sıra numarası pozitif tam sayı olmalıdır")
    return {
        "cabinet_name": cabinet,
        "row_number": row_number,
        "device_type": _clean(data.get("device_type", existing.device_type if existing else None)),
        "port_label": _clean(data.get("port_label", existing.port_label if existing else None)),
        "patch_panel": _clean(data.get("patch_panel", existing.patch_panel if existing else None)),
        "ip_address": _clean(data.get("ip_address", existing.ip_address if existing else None)),
        "switch_port": _clean(data.get("switch_port", existing.switch_port if existing else None)),
        "mounting_location": _clean(data.get("mounting_location", existing.mounting_location if existing else None)),
        "note": _clean(data.get("note", existing.note if existing else None)),
    }


@network_bp.get("/network-ports")
@login_required
def list_ports():
    query = NetworkPort.query
    cabinet = str(request.args.get("cabinet") or "").strip()
    search = str(request.args.get("search") or "").strip()
    if cabinet:
        query = query.filter(NetworkPort.cabinet_name == cabinet)
    if search:
        pattern = f"%{search}%"
        query = query.filter(or_(
            NetworkPort.cabinet_name.ilike(pattern),
            NetworkPort.device_type.ilike(pattern),
            NetworkPort.port_label.ilike(pattern),
            NetworkPort.patch_panel.ilike(pattern),
            NetworkPort.ip_address.ilike(pattern),
            NetworkPort.switch_port.ilike(pattern),
            NetworkPort.mounting_location.ilike(pattern),
            NetworkPort.note.ilike(pattern),
        ))
    rows = query.order_by(NetworkPort.cabinet_name, NetworkPort.row_number).all()
    cabinets = [x[0] for x in db.session.query(NetworkPort.cabinet_name).distinct().order_by(NetworkPort.cabinet_name).all()]
    return jsonify({"items": [_dict(row) for row in rows], "cabinets": cabinets})


@network_bp.post("/network-ports")
@login_required
def create_port():
    try:
        values = _payload(request.get_json(silent=True) or {})
        if NetworkPort.query.filter_by(cabinet_name=values["cabinet_name"], row_number=values["row_number"], switch_port=values["switch_port"]).first():
            return jsonify({"error": "Bu kabinet için bu sıra numarası zaten kayıtlı"}), 409
        row = NetworkPort(**values)
        db.session.add(row)
        db.session.flush()
        _audit("network_port.created", row, values)
        db.session.commit()
        return jsonify(_dict(row)), 201
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    except Exception:
        db.session.rollback()
        raise


@network_bp.patch("/network-ports/<int:port_id>")
@login_required
def update_port(port_id):
    row = db.session.get(NetworkPort, port_id)
    if not row:
        return jsonify({"error": "Port kaydı bulunamadı"}), 404
    try:
        before = _dict(row)
        values = _payload(request.get_json(silent=True) or {}, row)
        duplicate = NetworkPort.query.filter(
            NetworkPort.id != row.id,
            NetworkPort.cabinet_name == values["cabinet_name"],
            NetworkPort.row_number == values["row_number"],
        ).first()
        if duplicate:
            return jsonify({"error": "Bu kabinet için bu sıra numarası zaten kayıtlı"}), 409
        for key, value in values.items():
            setattr(row, key, value)
        db.session.flush()
        _audit("network_port.updated", row, {"before": before, "after": values})
        db.session.commit()
        return jsonify(_dict(row))
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    except Exception:
        db.session.rollback()
        raise


@network_bp.post("/network-ports/import-ods")
@login_required
def import_ods():
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "En az bir ODS dosyası seçilmelidir"}), 400
    created = updated = skipped = 0
    try:
        for uploaded in files:
            if not uploaded.filename or not uploaded.filename.lower().endswith(".ods"):
                raise ValueError("Yalnızca .ods dosyaları içe aktarılabilir")
            document = load(uploaded.stream)
            tables = document.spreadsheet.getElementsByType(Table)
            if not tables:
                skipped += 1
                continue
            table = tables[0]
            rows = table.getElementsByType(TableRow)
            matrix = []
            for tr in rows:
                values = []
                for cell in tr.childNodes:
                    if getattr(cell, "qname", None) != (TABLENS, "table-cell"):
                        continue
                    text = extractText(cell).strip()
                    repeat = int(cell.getAttribute("numbercolumnsrepeated") or 1)
                    values.extend([text] * min(repeat, 20))
                    if len(values) >= 20:
                        break
                matrix.append(values[:20])
            cabinet = next((str(v).strip() for row in matrix[:3] for v in row[:2]
                            if v and "KABİN" in str(v).upper()), None)
            if not cabinet:
                cabinet = uploaded.filename.rsplit(".", 1)[0].replace("_", " ").strip()
            for values in matrix[1:]:
                values = (values + [""] * 5)[:5]
                seq, label, ip, location, switch_port = [str(v or "").strip() for v in values]
                if not any((seq, label, ip, location, switch_port)):
                    continue
                try:
                    row_number = int(float(seq)) if seq else None
                except (TypeError, ValueError):
                    row_number = None
                if not row_number or row_number < 1:
                    continue
                existing = NetworkPort.query.filter_by(cabinet_name=cabinet, row_number=row_number, switch_port=switch_port or None).first()
                values_to_save = {
                    "cabinet_name": cabinet,
                    "row_number": row_number,
                    "device_type": None,
                    "port_label": label or None,
                    "patch_panel": None,
                    "ip_address": ip or None,
                    "switch_port": switch_port or None,
                    "mounting_location": location or None,
                    "note": None,
                }
                if existing:
                    for key, value in values_to_save.items():
                        if value is not None or key in {"device_type", "patch_panel", "note"}:
                            setattr(existing, key, value)
                    updated += 1
                    _audit("network_port.import_updated", existing, values_to_save)
                else:
                    existing = NetworkPort(**values_to_save)
                    db.session.add(existing)
                    db.session.flush()
                    created += 1
                    _audit("network_port.imported", existing, values_to_save)
        db.session.commit()
        return jsonify({"created": created, "updated": updated, "skipped_files": skipped})
    except Exception as exc:
        db.session.rollback()
        message = str(exc) if isinstance(exc, ValueError) else "ODS dosyası okunamadı"
        return jsonify({"error": message}), 400
