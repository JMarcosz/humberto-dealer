"""Servicio de importación y exportación Excel con openpyxl."""
import logging
import os
from datetime import datetime
from typing import Any

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

log = logging.getLogger(__name__)

# Columnas esperadas en el Excel de importación (orden no importa, se busca por header)
COLUMNAS_REQUERIDAS = {"modelo", "anio", "vin", "color", "precio", "combustible", "transmision"}
COLUMNAS_OPCIONALES = {"kilometraje", "descripcion"}


class ExcelService:

    # ----------------------------------------------------------
    # Leer Excel → lista de dicts + lista de errores por línea
    # ----------------------------------------------------------
    @staticmethod
    def leer_vehiculos(ruta: str) -> tuple[list[dict], list[str]]:
        filas:   list[dict] = []
        errores: list[str]  = []

        try:
            wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
            ws = wb.active

            headers = [str(c.value).strip().lower() if c.value else "" for c in next(ws.iter_rows(min_row=1, max_row=1))]
            col_idx = {h: i for i, h in enumerate(headers)}

            faltantes = COLUMNAS_REQUERIDAS - set(col_idx.keys())
            if faltantes:
                errores.append(f"Columnas faltantes en el archivo: {', '.join(faltantes)}")
                return filas, errores

            for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                if not any(row):
                    continue
                try:
                    fila = ExcelService._parsear_fila(row, col_idx, row_num)
                    filas.append(fila)
                except ValueError as ve:
                    errores.append(str(ve))

            wb.close()
        except Exception as exc:
            errores.append(f"Error al leer el archivo: {exc}")

        return filas, errores

    @staticmethod
    def _parsear_fila(row: tuple, col_idx: dict, row_num: int) -> dict:
        def get(campo: str) -> Any:
            idx = col_idx.get(campo)
            return row[idx] if idx is not None and idx < len(row) else None

        errores_fila = []

        modelo      = str(get("modelo") or "").strip().upper()
        vin         = str(get("vin") or "").strip().upper()
        color       = str(get("color") or "").strip().upper()
        combustible = str(get("combustible") or "").strip().upper()
        transmision = str(get("transmision") or "").strip().upper()

        try:
            anio = int(get("anio") or 0)
            if not (1990 <= anio <= datetime.utcnow().year + 1):
                errores_fila.append(f"Fila {row_num}: año inválido ({anio})")
        except (TypeError, ValueError):
            errores_fila.append(f"Fila {row_num}: año no numérico")
            anio = 0

        try:
            precio = float(get("precio") or 0)
            if precio <= 0:
                errores_fila.append(f"Fila {row_num}: precio debe ser positivo")
        except (TypeError, ValueError):
            errores_fila.append(f"Fila {row_num}: precio no numérico")
            precio = 0.0

        if not modelo:
            errores_fila.append(f"Fila {row_num}: modelo vacío")
        if len(vin) != 17:
            errores_fila.append(f"Fila {row_num}: VIN inválido ({vin})")

        if errores_fila:
            raise ValueError(" | ".join(errores_fila))

        return {
            "modelo":      modelo,
            "anio":        anio,
            "vin":         vin,
            "color":       color,
            "precio":      precio,
            "combustible": combustible,
            "transmision": transmision,
            "kilometraje": int(get("kilometraje") or 0),
            "descripcion": str(get("descripcion") or "").strip() or None,
        }

    # ----------------------------------------------------------
    # Exportar lista de Vehiculo → archivo .xlsx
    # ----------------------------------------------------------
    @staticmethod
    def exportar_vehiculos(vehiculos: list) -> str:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Inventario"

        headers = [
            "ID", "Marca", "Modelo", "Año", "VIN", "Color",
            "Precio (USD)", "Km", "Combustible", "Transmisión",
            "Estado", "Publicado en",
        ]
        header_fill = PatternFill("solid", fgColor="1A1A2E")
        header_font = Font(color="FFFFFF", bold=True)

        for col, h in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=h)
            cell.fill   = header_fill
            cell.font   = header_font
            cell.alignment = Alignment(horizontal="center")

        for row_num, v in enumerate(vehiculos, start=2):
            marca  = v.modelo.marca.nombre if v.modelo and v.modelo.marca else ""
            modelo = v.modelo.nombre if v.modelo else ""
            ws.append([
                v.id, marca, modelo, v.anio, v.vin, v.color,
                float(v.precio), v.kilometraje, v.combustible, v.transmision,
                v.estado, v.publicado_en.strftime("%Y-%m-%d %H:%M") if v.publicado_en else "",
            ])

        for col in range(1, len(headers) + 1):
            ws.column_dimensions[get_column_letter(col)].auto_size = True  # type: ignore

        ruta = os.path.join(os.path.dirname(__file__), "..", "..", "tmp_exports", "inventario.xlsx")
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        ruta = os.path.normpath(ruta)
        wb.save(ruta)
        log.info("Excel exportado: %d vehículos → %s", len(vehiculos), ruta)
        return ruta

    # ----------------------------------------------------------
    # Generar plantilla Excel vacía para importación
    # ----------------------------------------------------------
    @staticmethod
    def generar_plantilla() -> str:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Plantilla"

        headers = ["modelo", "anio", "vin", "color", "precio",
                   "combustible", "transmision", "kilometraje", "descripcion"]
        header_fill = PatternFill("solid", fgColor="1A1A2E")
        header_font = Font(color="FFFFFF", bold=True)

        for col, h in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=h)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")

        # Fila de ejemplo
        ws.append(["Corolla", 2023, "1HGBH41JXMN109186", "BLANCO",
                   25000, "GASOLINA", "AUTOMATICA", 0, "Descripción opcional"])

        for col in range(1, len(headers) + 1):
            ws.column_dimensions[get_column_letter(col)].auto_size = True  # type: ignore

        ruta = os.path.join(os.path.dirname(__file__), "..", "..", "tmp_exports", "plantilla_vehiculos.xlsx")
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        ruta = os.path.normpath(ruta)
        wb.save(ruta)
        return ruta
