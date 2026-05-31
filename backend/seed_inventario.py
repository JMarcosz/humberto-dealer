"""
Seed del inventario desde el Excel de Humberto Auto Import.
Uso: python seed_inventario.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend import create_app
from backend.models import db, Marca, Modelo, Vehiculo, Resena, VehiculoImagen, Reserva, Venta, Pago
from datetime import datetime

# ── Mapeo: nombre en Excel → (marca, modelo, categoria) ─────────────────────
BRAND_MAP = {
    'MERCEDES BENZ':             ('MERCEDES BENZ', 'Clase C',       'SEDAN'),
    'RANGE ROVER':               ('LAND ROVER',    'Range Rover',   'SUV'),
    'RANGE ROVER FREELANDER':    ('LAND ROVER',    'Freelander',    'SUV'),
    'BMW':                       ('BMW',           'Serie 3',       'SEDAN'),
    'BMW X5':                    ('BMW',           'X5',            'SUV'),
    'JEEP G CHEROKE':            ('JEEP',          'Grand Cherokee','SUV'),
    'JEEP GRAND CHEROKEE':       ('JEEP',          'Grand Cherokee','SUV'),
    'JEEP COMPAS':               ('JEEP',          'Compass',       'SUV'),
    'JEEP COMPASS':              ('JEEP',          'Compass',       'SUV'),
    'JEEP PATRIO':               ('JEEP',          'Patriot',       'SUV'),
    'FORD SCAPE':                ('FORD',          'Escape',        'SUV'),
    'FORD ESCAPE':               ('FORD',          'Escape',        'SUV'),
    'FORD EXPLORER':             ('FORD',          'Explorer',      'SUV'),
    'FORD FIESTA':               ('FORD',          'Fiesta',        'SEDAN'),
    'FORD VENZA':                ('FORD',          'Venza',         'SUV'),
    'FORD F-150':                ('FORD',          'F-150',         'PICKUP'),
    'CAMIONETA FORD F-150':      ('FORD',          'F-150',         'PICKUP'),
    'FORD FOCUS':                ('FORD',          'Focus',         'SEDAN'),
    'HYUNDAI SANTAFE':           ('HYUNDAI',       'Santa Fe',      'SUV'),
    'HYUNDAI SANTA FE':          ('HYUNDAI',       'Santa Fe',      'SUV'),
    'HYUNDAI TUZON':             ('HYUNDAI',       'Tucson',        'SUV'),
    'HYUNDAI TUCSON':            ('HYUNDAI',       'Tucson',        'SUV'),
    'HYUNDAI NEW TUCSON':        ('HYUNDAI',       'Tucson',        'SUV'),
    'HYUNDAI':                   ('HYUNDAI',       'Elantra',       'SEDAN'),
    'HYUNDAI LF':                ('HYUNDAI',       'Elantra',       'SEDAN'),
    'HYUNDAI I20':               ('HYUNDAI',       'i20',           'SEDAN'),
    'MAZDA CX9':                 ('MAZDA',         'CX-9',          'SUV'),
    'MAZDA CX7':                 ('MAZDA',         'CX-7',          'SUV'),
    'MAZDA CX-7':                ('MAZDA',         'CX-7',          'SUV'),
    'MAZDA CX8':                 ('MAZDA',         'CX-8',          'SUV'),
    'MAZDA':                     ('MAZDA',         'CX-7',          'SUV'),
    'DOGE G CARAVAN':            ('DODGE',         'Grand Caravan', 'VAN'),
    'DOGE  G CARAVAN':           ('DODGE',         'Grand Caravan', 'VAN'),
    'DOGE CARAVAN':              ('DODGE',         'Caravan',       'VAN'),
    'DOGE  CARAVAN':             ('DODGE',         'Caravan',       'VAN'),
    'DODGE DURANGO':             ('DODGE',         'Durango',       'SUV'),
    'TOYOTA FOR RONER':          ('TOYOTA',        '4Runner',       'SUV'),
    'TOYOTA VENZA':              ('TOYOTA',        'Venza',         'SUV'),
    'TOYOTA TACOMA':             ('TOYOTA',        'Tacoma',        'PICKUP'),
    'TOYOTA HIGHLANDER':         ('TOYOTA',        'Highlander',    'SUV'),
    'SUZUKI VITARA':             ('SUZUKI',        'Vitara',        'SUV'),
    'SUZUKI GRAND VITARA':       ('SUZUKI',        'Grand Vitara',  'SUV'),
    'CHEVROLET EQUINOX':         ('CHEVROLET',     'Equinox',       'SUV'),
    'CHEVROLET EQUINOX LIMITED': ('CHEVROLET',     'Equinox',       'SUV'),
    'CHEVROLET EQUINOX PREMIER': ('CHEVROLET',     'Equinox',       'SUV'),
    'CHEVROLET MALIBU':          ('CHEVROLET',     'Malibu',        'SEDAN'),
    'CHEVROLET SPARK':           ('CHEVROLET',     'Spark',         'SEDAN'),
    'CHEVROLET TRAX':            ('CHEVROLET',     'Trax',          'SUV'),
    'GMC':                       ('GMC',           'Acadia',        'SUV'),
    'MITSUBISHI ENDEAVOR':       ('MITSUBISHI',    'Endeavor',      'SUV'),
    'MITSUBISHI MONTERO':        ('MITSUBISHI',    'Montero',       'SUV'),
    'MITSUBISHI CARA DE GATO':   ('MITSUBISHI',    'Eclipse',       'COUPE'),
    'NISSAN SENTRA':             ('NISSAN',        'Sentra',        'SEDAN'),
    'NISSAN PATHFINDER':         ('NISSAN',        'Pathfinder',    'SUV'),
    'NISSAN NAVARA':             ('NISSAN',        'Navara',        'PICKUP'),
    'NISSAN ROGUE':              ('NISSAN',        'Rogue',         'SUV'),
    'NISSAN NOTE VERSION S':     ('NISSAN',        'Note',          'SEDAN'),
    'NISSAN NOTE VERSIÓN S':     ('NISSAN',        'Note',          'SEDAN'),
    'HONDA PILOT':               ('HONDA',         'Pilot',         'SUV'),
    'HONDA CR-V':                ('HONDA',         'CR-V',          'SUV'),
    'HONDA FIT':                 ('HONDA',         'Fit',           'SEDAN'),
    'HONDA CIVIC':               ('HONDA',         'Civic',         'SEDAN'),
    'KIA SOUL':                  ('KIA',           'Soul',          'SEDAN'),
    'KIA SPORTAGE':              ('KIA',           'Sportage',      'SUV'),
    'KIA K5':                    ('KIA',           'K5',            'SEDAN'),
    'ACURA TL':                  ('ACURA',         'TL',            'SEDAN'),
    'VOLKSWAGEN TOUAREG':        ('VOLKSWAGEN',    'Touareg',       'SUV'),
}

SKIP = {'LÍNEA VACÍA', 'LINEA VACIA', 'CAMION HYUNDAI FURGON', 'CAMOIN HYUNDAI FURGOM'}

def get_or_create_marca(nombre):
    m = Marca.query.filter_by(nombre=nombre).first()
    if not m:
        m = Marca(nombre=nombre)
        db.session.add(m)
        db.session.flush()
    return m

def get_or_create_modelo(marca, nombre, categoria):
    mo = Modelo.query.filter_by(marca_id=marca.id, nombre=nombre).first()
    if not mo:
        mo = Modelo(marca_id=marca.id, nombre=nombre, categoria=categoria)
        db.session.add(mo)
        db.session.flush()
    return mo

def main():
    import openpyxl
    app = create_app()
    with app.app_context():
        wb = openpyxl.load_workbook(
            r'.\Inventario Excel\rrjbjxt.xlsx',
            read_only=True, data_only=True
        )
        ws = wb.active

        # Obtener IDs de vehículos a eliminar (DISPONIBLE/BORRADOR/PENDIENTE)
        ids = [v.id for v in Vehiculo.query.filter(
            Vehiculo.estado.in_(['DISPONIBLE', 'BORRADOR', 'PENDIENTE_VALIDACION'])
        ).all()]

        if ids:
            # 1. Pagos → Ventas → Reservas → Reseñas → Imágenes → Vehículos
            venta_ids = [v.id for v in Venta.query.filter(Venta.vehiculo_id.in_(ids)).all()]
            if venta_ids:
                Pago.query.filter(Pago.venta_id.in_(venta_ids)).delete(synchronize_session=False)
            Venta.query.filter(Venta.vehiculo_id.in_(ids)).delete(synchronize_session=False)
            Reserva.query.filter(Reserva.vehiculo_id.in_(ids)).delete(synchronize_session=False)
            Resena.query.filter(Resena.vehiculo_id.in_(ids)).delete(synchronize_session=False)
            VehiculoImagen.query.filter(VehiculoImagen.vehiculo_id.in_(ids)).delete(synchronize_session=False)
            eliminados = Vehiculo.query.filter(Vehiculo.id.in_(ids)).delete(synchronize_session=False)
            db.session.commit()
            print(f"Eliminados {eliminados} vehículos anteriores.")
        else:
            print("No había vehículos previos que eliminar.")

        insertados  = 0
        omitidos    = 0
        vin_counter = 1

        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i < 5:
                continue  # saltar encabezados
            num, nombre_raw, color_raw, anio_raw, precio_raw = row[:5]
            if not nombre_raw or not num:
                continue

            nombre = str(nombre_raw).strip().upper()
            if nombre in SKIP or nombre.startswith('LÍNEA') or nombre.startswith('LINEA') or 'L?NEA' in nombre:
                continue

            precio = float(precio_raw) if precio_raw else 0
            if precio <= 0:
                omitidos += 1
                continue

            anio = int(anio_raw) if anio_raw and str(anio_raw).isdigit() else None
            if anio and (anio < 1990 or anio > 2026):
                anio = None  # año inválido, dejar en blanco no es posible — usar 2000
                anio = 2000

            color = str(color_raw).strip().upper() if color_raw and str(color_raw).strip() not in ('-', '') else 'OTRO'

            mapping = BRAND_MAP.get(nombre)
            if not mapping:
                # Intentar match parcial
                for key, val in BRAND_MAP.items():
                    if nombre.startswith(key) or key in nombre:
                        mapping = val
                        break
            if not mapping:
                print(f"  ⚠ Sin mapeo para: '{nombre}' — omitido")
                omitidos += 1
                continue

            marca_nombre, modelo_nombre, categoria = mapping
            vin = f'HAI{vin_counter:014d}'
            vin_counter += 1

            try:
                marca  = get_or_create_marca(marca_nombre)
                modelo = get_or_create_modelo(marca, modelo_nombre, categoria)

                v = Vehiculo(
                    modelo_id    = modelo.id,
                    anio         = anio or 2000,
                    vin          = vin,
                    color        = color,
                    precio       = precio,
                    kilometraje  = 0,
                    combustible  = 'GASOLINA',
                    transmision  = 'AUTOMATICA',
                    estado       = 'DISPONIBLE',
                    publicado_en = datetime.utcnow(),
                )
                db.session.add(v)
                db.session.commit()
                insertados += 1
            except Exception as e:
                db.session.rollback()
                print(f"  ✗ Error en fila {i}: {e}")
                omitidos += 1

        wb.close()
        print(f"\n✅ Completado: {insertados} vehículos insertados, {omitidos} omitidos.")

if __name__ == '__main__':
    main()
