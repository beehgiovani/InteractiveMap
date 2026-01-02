# Como Habilitar Realtime no Supabase

## ❌ Problema Atual
O erro "Real-time subscription failed" ocorre porque a tabela `lots` não está configurada para Realtime no Supabase.

## ✅ Solução Manual (Recomendada)

### Opção 1: Via Dashboard do Supabase (Mais Fácil)

1. **Acesse o Dashboard:**
   - URL: https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/database/publications

2. **Edite a Publication:**
   - Clique em "supabase_realtime"
   - Na seção "Tables in this publication", adicione a tabela `lots`
   - Clique em "Save"

### Opção 2: Via SQL Editor

1. **Acesse o SQL Editor:**
   - URL: https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/sql/new

2. **Execute este SQL:**
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE public.lots;
   ```

3. **Clique em "Run"**

## 🔍 Verificar se Funcionou

Depois de habilitar o Realtime, recarregue a aplicação. Você deve ver no console:
```
✅ Real-time subscription active
```

Em vez de:
```
❌ Real-time subscription failed
```

## 📝 Informações Adicionais

- **Projeto Supabase:** tvsbgbroyauxyliybsvo
- **URL:** https://tvsbgbroyauxyliybsvo.supabase.co
- **Tabela:** public.lots
- **Publication:** supabase_realtime

## 🔄 Próximos Passos

Após habilitar o Realtime:
1. O arquivo de migration já foi atualizado com a linha necessária
2. Novos deploys/migrações já criarão a tabela com Realtime habilitado
3. A aplicação poderá sincronizar dados em tempo real entre todos os usuários conectados
