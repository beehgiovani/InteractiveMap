#!/bin/bash

# Supabase credentials
SUPABASE_URL="https://tvsbgbroyauxyliybsvo.supabase.co"
SUPABASE_KEY="sb_publishable_wCA2Jp5NYsa642jfygTITA_-fedhR-s"

# Read the SQL file
SQL_FILE="supabase/migrations/001_create_lots_table.sql"

echo "🚀 Criando tabela 'lots' no Supabase via comando..."
echo ""

# Try using curl to execute SQL via Supabase REST API
# This attempts to use the PostgREST API with a custom SQL execution

# Method 1: Try using the query endpoint (if available)
echo "Método 1: Tentando via endpoint de query..."
RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(jq -Rs . < "$SQL_FILE")}")

echo "Resposta: $RESPONSE"
echo ""

# Method 2: Try direct database connection using psql (if connection string is available)
# PostgreSQL connection format: postgresql://[user[:password]@][host][:port][/dbname][?param1=value1&...]
echo "Método 2: Tentando via psql (conexão direta ao PostgreSQL)..."
echo ""

# Supabase database connection info
DB_HOST="db.tvsbgbroyauxyliybsvo.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

# Note: You'll need the database password. This is different from the API key.
# The password can be found in the Supabase dashboard under Settings > Database > Connection string

echo "Para conectar via psql, você precisa da senha do banco de dados."
echo "A senha pode ser encontrada em:"
echo "https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/settings/database"
echo ""
echo "Execute o seguinte comando com a senha:"
echo ""
echo "PGPASSWORD='sua_senha_aqui' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $SQL_FILE"
echo ""

# Method 3: Check if table exists
echo "Verificando se a tabela foi criada..."
CHECK_RESPONSE=$(curl -s -X GET "$SUPABASE_URL/rest/v1/lots?limit=1" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY")

if echo "$CHECK_RESPONSE" | grep -q "Could not find"; then
  echo "❌ Tabela ainda não existe"
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "Soluções disponíveis:"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  echo "OPÇÃO A - Usar psql (Recomendado):"
  echo "  1. Obtenha a senha do banco em: https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/settings/database"
  echo "  2. Execute: PGPASSWORD='senha' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $SQL_FILE"
  echo ""
  echo "OPÇÃO B - Usar o Supabase CLI:"
  echo "  1. Instale: npm install -g supabase"
  echo "  2. Execute: supabase db push --db-url postgresql://postgres:senha@$DB_HOST:$DB_PORT/$DB_NAME"
  echo ""
  echo "OPÇÃO C - Via Dashboard (Interface Web):"
  echo "  1. Acesse: https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/sql/new"
  echo "  2. Cole o conteúdo de: $SQL_FILE"
  echo "  3. Clique em RUN"
  echo ""
else
  echo "✅ Tabela criada com sucesso!"
  echo "Dados: $CHECK_RESPONSE"
fi
