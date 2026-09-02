"""Entry point de la aplicación."""
from backend import create_app

def crear_app():
    app = create_app()

    # Crear tablas nuevas si no existen (seguro en producción, no elimina datos)
    with app.app_context():
        from backend.models import db
        from sqlalchemy import inspect, text
        db.create_all()

        # Migración automática de columnas añadidas a vehiculos
        try:
            with db.engine.connect() as conn:
                inspector = inspect(db.engine)
                existing_cols = {c['name'] for c in inspector.get_columns('vehiculos')}
                
                alter_statements = []
                if 'disponible_para' not in existing_cols:
                    alter_statements.append("ADD COLUMN disponible_para ENUM('VENTA', 'RENTA', 'AMBOS') NOT NULL DEFAULT 'AMBOS'")
                if 'pasajeros' not in existing_cols:
                    alter_statements.append("ADD COLUMN pasajeros SMALLINT NOT NULL DEFAULT 5")
                if 'maletas_grandes' not in existing_cols:
                    alter_statements.append("ADD COLUMN maletas_grandes SMALLINT NOT NULL DEFAULT 2")
                if 'maletas_pequenas' not in existing_cols:
                    alter_statements.append("ADD COLUMN maletas_pequenas SMALLINT NOT NULL DEFAULT 2")
                if 'tiene_aire_acondicionado' not in existing_cols:
                    alter_statements.append("ADD COLUMN tiene_aire_acondicionado TINYINT(1) NOT NULL DEFAULT 1")
                
                if alter_statements:
                    sql = f"ALTER TABLE vehiculos {', '.join(alter_statements)}"
                    conn.execute(text(sql))
                    conn.commit()
                    app.logger.info("Columnas de renta agregadas a vehiculos exitosamente.")

                # Migración de coberturas_seguro
                if 'coberturas_seguro' in inspector.get_table_names():
                    existing_cob_cols = {c['name'] for c in inspector.get_columns('coberturas_seguro')}
                    if 'reduccion_deposito_pct' not in existing_cob_cols:
                        conn.execute(text("ALTER TABLE coberturas_seguro ADD COLUMN reduccion_deposito_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00"))
                        conn.commit()
                        app.logger.info("Columna reduccion_deposito_pct agregada a coberturas_seguro.")
        except Exception as e:
            app.logger.warning("Verificación de esquema: %s", e)

    return app

if __name__ == "__main__":
    app = crear_app();
    app.run(host="0.0.0.0", port=5001, use_reloader=False)
