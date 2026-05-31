"""Validaciones de servidor. Regla de oro: campos clave en MAYÚSCULAS."""
import re
from typing import Any


CAMPOS_MAYUSCULAS = {"marca", "modelo", "color", "nombre", "apellido", "cargo"}


def validar_mayusculas(data: dict, campos: list[str] | None = None) -> list[str]:
    """Devuelve lista de errores para campos que no estén en MAYÚSCULAS."""
    campos_a_revisar = campos or CAMPOS_MAYUSCULAS
    errores = []
    for campo in campos_a_revisar:
        valor = data.get(campo)
        if isinstance(valor, str) and valor != valor.upper():
            errores.append(
                f"Error de validación: '{campo}' debe estar en MAYÚSCULAS."
            )
    return errores


def forzar_mayusculas(data: dict, campos: list[str] | None = None) -> dict:
    """Normaliza a MAYÚSCULAS in-place. Retorna el mismo dict."""
    campos_a_normalizar = campos or CAMPOS_MAYUSCULAS
    for campo in campos_a_normalizar:
        if isinstance(data.get(campo), str):
            data[campo] = data[campo].upper()
    return data


def validar_vin(vin: str) -> bool:
    """VIN de 17 caracteres alfanuméricos (excluye I, O, Q)."""
    return bool(re.fullmatch(r"[A-HJ-NPR-Z0-9]{17}", vin.upper()))


def validar_precio(precio: Any) -> bool:
    try:
        return float(precio) > 0
    except (TypeError, ValueError):
        return False


def validar_estrellas(estrellas: Any) -> bool:
    try:
        return 1 <= int(estrellas) <= 5
    except (TypeError, ValueError):
        return False


def validar_email(email: str) -> bool:
    return bool(re.fullmatch(r"[^@]+@[^@]+\.[^@]+", email))
