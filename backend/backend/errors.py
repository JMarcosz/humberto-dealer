"""Excepción tipada de reglas de negocio.

Este módulo NO importa Flask, SQLAlchemy ni ningún otro componente de la app:
lo consumen tanto los decoradores como la capa de política pura.
"""


class ReglaNegocioError(Exception):
    """Rechazo atribuible a la petición del usuario, no a un fallo del servidor.

    El decorador `maneja_errores_renta` la traduce a una respuesta JSON con el
    status indicado, de modo que una entrada inválida nunca produzca un 500.

    Args:
        mensaje:  texto orientado al usuario final, en español.
        status:   código HTTP (400 formato/tipo, 403 autorización de recurso,
                  404 inexistente, 409 conflicto de estado, 422 regla de negocio).
        codigo:   identificador estable para que el frontend reaccione sin
                  depender del texto (p. ej. "FECHA_PASADA").
        detalles: datos adicionales serializables (campo afectado, límites…).
    """

    def __init__(self, mensaje: str, status: int = 422,
                 codigo: str | None = None, detalles: dict | None = None):
        super().__init__(mensaje)
        self.mensaje  = mensaje
        self.status   = status
        self.codigo   = codigo
        self.detalles = detalles
