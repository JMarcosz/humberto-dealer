#!/usr/bin/env bash
# ==============================================================================
# Script DevOps todo-en-uno para Humberto Dealer (Linux / macOS / CI-CD)
# ==============================================================================
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="prod"

# Colores
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "\n${CYAN}==========================================================${NC}"
echo -e "${CYAN}         HUMBERTO DEALER - DEVOPS AUTOMATION              ${NC}"
echo -e "${CYAN}==========================================================${NC}\n"

# Manejo de argumentos
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --dev|-dev) MODE="dev" ;;
        --down|-down)
            echo -e "${YELLOW}[*] Deteniendo contenedores...${NC}"
            docker compose down
            echo -e "${GREEN}[OK] Contenedores detenidos.${NC}"
            exit 0
            ;;
        --logs|-logs)
            docker compose logs -f
            exit 0
            ;;
        --seed|-seed)
            docker compose exec backend python seed.py
            exit 0
            ;;
        --status|-status)
            docker compose ps
            exit 0
            ;;
        *) echo "Opción desconocida: $1"; exit 1 ;;
    esac
    shift
done

# 1. Verificar Docker
echo -e "${YELLOW}[1/5] Verificando Docker Engine...${NC}"
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] El servicio de Docker no está en ejecución.${NC}"
    echo -e "${YELLOW}Inicia el servicio de Docker y vuelve a ejecutar este script.${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Docker está listo.${NC}"

# 2. Configurar .env y claves seguras
echo -e "${YELLOW}[2/5] Verificando y configurando variables de entorno (.env)...${NC}"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.docker.example"

if [ ! -f "$ENV_FILE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo "  -> Creado .env a partir de .env.docker.example"
fi

# Generar SECRET_KEY si es necesario
if grep -q "cambiar_por_clave_secreta_super_segura_32_bytes_minimo" "$ENV_FILE" || grep -q "SECRET_KEY=$" "$ENV_FILE"; then
    RAND_SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
    sed -i.bak "s/SECRET_KEY=.*/SECRET_KEY=$RAND_SECRET/" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
    echo -e "${GREEN}  -> Generada nueva SECRET_KEY${NC}"
fi

# Generar MYSQL_PASSWORD si es necesario
if grep -q "dealer_secure_password_123" "$ENV_FILE" || grep -q "MYSQL_PASSWORD=$" "$ENV_FILE"; then
    RAND_PASS=$(openssl rand -hex 12 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(12))")
    sed -i.bak "s/MYSQL_PASSWORD=.*/MYSQL_PASSWORD=$RAND_PASS/" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
    echo -e "${GREEN}  -> Generada contraseña segura para usuario MySQL${NC}"
fi

# Generar MYSQL_ROOT_PASSWORD si es necesario
if grep -q "dealer_root_password_456" "$ENV_FILE" || grep -q "MYSQL_ROOT_PASSWORD=$" "$ENV_FILE"; then
    RAND_ROOT_PASS=$(openssl rand -hex 16 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(16))")
    sed -i.bak "s/MYSQL_ROOT_PASSWORD=.*/MYSQL_ROOT_PASSWORD=$RAND_ROOT_PASS/" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
    echo -e "${GREEN}  -> Generada contraseña segura para root MySQL${NC}"
fi
echo -e "${GREEN}[OK] Archivo .env configurado con claves criptográficas únicas.${NC}"

# 3. Levantar contenedores
echo -e "${YELLOW}[3/5] Construyendo y levantando contenedores (Modo: $MODE)...${NC}"
if [ "$MODE" = "dev" ]; then
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
else
    docker compose up -d --build
fi
echo -e "${GREEN}[OK] Contenedores iniciados en segundo plano.${NC}"

# 4. Esperar que MySQL esté saludable
echo -e "${YELLOW}[4/5] Esperando a que MySQL esté saludable...${NC}"
for i in {1..30}; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' humberto_db 2>/dev/null || echo "starting")
    if [ "$STATUS" = "healthy" ]; then
        echo -e "${GREEN}[OK] MySQL está saludable.${NC}"
        break
    fi
    echo "  -> Esperando MySQL... ($i/30 - estado: $STATUS)"
    sleep 2
done

# 5. Ejecutar seed y sincronizar contraseñas hasheadas
echo -e "${YELLOW}[5/5] Sincronizando datos y contraseñas hasheadas en backend...${NC}"
docker compose exec backend python seed.py || echo "[WARN] Ejecuta ./deploy.sh --seed más tarde si el backend aún no ha terminado de inicializarse."

echo -e "\n${GREEN}==========================================================${NC}"
echo -e "${GREEN}         DESPLIEGUE COMPLETADO EXITOSAMENTE!              ${NC}"
echo -e "${GREEN}==========================================================${NC}\n"
echo -e "${CYAN}Servicios disponibles:${NC}"
echo "  * Frontend:       http://localhost:3000"
echo "  * API Backend:    http://localhost:5001/api/health"
echo "  * API Proxy:      http://localhost:3000/api/catalogo/vehiculos"
echo "  * Base de datos:  localhost:3306"
echo ""
echo -e "${CYAN}Credenciales de prueba:${NC}"
echo "  * Admin:          admin@concesionaria.com / admin123"
echo "  * Cliente:        maria@email.com / user1234"
echo ""
